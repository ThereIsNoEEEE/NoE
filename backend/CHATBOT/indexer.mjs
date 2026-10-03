import { createHash } from 'node:crypto';
import { ApiError } from '../src/http.mjs';
import { QdrantError } from '../src/db/qdrant.mjs';
import { assertVectorConfig, dbError, safeSourceUrl } from './retriever.mjs';
import { validateVector } from './schema.mjs';
import { noticePointId } from '../src/db/notices.mjs';

export function chunkText(text, size = 1400, overlap = 200) {
  if (!Number.isInteger(size) || !Number.isInteger(overlap) || size < 1 || overlap < 0 || overlap >= size) throw new Error('잘못된 청크 크기');
  const result = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    const chunk = text.slice(start, start + size).trim();
    if (chunk) result.push(chunk);
    if (start + size >= text.length) break;
  }
  return result;
}

function pointId(space, noticeId, index) {
  const hex = createHash('sha256').update(JSON.stringify([space, noticeId, index])).digest('hex').slice(0, 32).split('');
  hex[12] = '5'; hex[16] = '8';
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

// Deliberately not exposed as a public HTTP write endpoint.
export class NoticeIndexer {
  constructor({ client, embedder, config }) { Object.assign(this, { client, embedder, config }); }
  async ensureCollection(size) {
    try {
      let info;
      try { info = await this.client.collection(this.config.collection); }
      catch (error) {
        if (!(error instanceof QdrantError) || error.status !== 404) throw error;
        const params = { size, distance: 'Cosine' };
        try {
          await this.client.request('PUT', this.client.collectionPath(this.config.collection), { vectors: this.config.vectorName ? { [this.config.vectorName]: params } : params });
        } catch (createError) {
          if (!(createError instanceof QdrantError) || ![400, 409].includes(createError.status)) throw createError;
        }
        info = await this.client.collection(this.config.collection);
      }
      assertVectorConfig(info, this.config, size);
    } catch (error) { throw dbError(error); }
  }

  async index(notices) {
    if (!this.embedder.isConfigured()) throw new ApiError(503, 'EMBEDDING_NOT_CONFIGURED', '공지와 질문에 공통으로 사용할 임베딩 API를 설정하세요.');
    if (!Array.isArray(notices) || notices.length > 100) throw new ApiError(422, 'INDEX_INPUT_INVALID', '한 번에 최대 100개 공지를 넣을 수 있습니다.');
    // Validate the entire batch before any remote write. Allowlist public notice fields only.
    const docs = notices.map(notice => {
      const url = safeSourceUrl(notice?.url);
      if (typeof notice?.title !== 'string' || !notice.title.trim() || typeof notice?.content !== 'string' || !url) throw new ApiError(422, 'INDEX_INPUT_INVALID', '공지 title, content, HTTP(S) 원문 URL이 필요합니다.');
      if (typeof notice.id !== 'string' || !notice.id || typeof notice.sourceId !== 'string' || !notice.sourceId) throw new ApiError(422, 'INDEX_INPUT_INVALID', '원문 공지의 id와 sourceId가 필요합니다.');
      const rawPointId = notice.rawPointId || noticePointId(`${notice.sourceId}:${notice.externalId ?? notice.id}`);
      const assets = [...(Array.isArray(notice.images) ? notice.images : []), ...(Array.isArray(notice.attachments) ? notice.attachments : [])];
      const extracted = assets.filter(a => a && a.availability !== 'unavailable' && a.textStatus === 'extracted' && typeof a.text === 'string').map(a => a.text);
      const content = [notice.content, ...extracted].join('\n').trim();
      if (content.length > 100000) throw new ApiError(422, 'INDEX_INPUT_INVALID', '100,000자를 초과한 공지는 별도로 분할해 주세요. 원문은 수정하지 않았습니다.');
      return { noticeId: notice.id, rawPointId, sourceContentHash: notice.contentHash || createHash('sha256').update(content).digest('hex'),
        title: notice.title.trim().slice(0, 300), content, url, date: !notice.dateUnknown && typeof notice.date === 'string' ? notice.date.slice(0, 30) : null,
        contentStatus: notice.contentStatus || (notice.content.trim() ? 'text_extracted' : 'extraction_unknown'),
        needsOcr: notice.needsOcr ?? (Array.isArray(notice.images) && notice.images.some(a => a && a.availability !== 'unavailable' && a.textStatus !== 'extracted')),
        needsAttachmentExtraction: notice.needsAttachmentExtraction ?? (Array.isArray(notice.attachments) && notice.attachments.some(a => a && a.availability !== 'unavailable' && a.textStatus !== 'extracted')),
        reviewRequired: Boolean(notice.reviewRequired || notice.isTruncated || notice.contentStatus === 'extraction_failed'),
      };
    });
    let pointCount = 0;
    for (const doc of docs) {
      const chunks = chunkText(`${doc.title}\n${doc.content}`);
      const points = [];
      for (const [index, content] of chunks.entries()) {
        const vector = validateVector(await this.embedder.embed(content));
        if (points.length && (this.config.vectorName ? points[0].vector[this.config.vectorName] : points[0].vector).length !== vector.length) throw new ApiError(502, 'EMBEDDING_RESPONSE_INVALID', '청크 간 임베딩 차원이 일치하지 않습니다.');
        points.push({ id: pointId(this.config.embedding.space, doc.rawPointId, index), vector: this.config.vectorName ? { [this.config.vectorName]: vector } : vector,
          payload: { ...doc, kind: 'notice_chunk', embeddingSpace: this.config.embedding.space, embeddingModel: this.config.embedding.model, content, chunkIndex: index, chunkCount: chunks.length } });
      }
      const firstVector = this.config.vectorName ? points[0].vector[this.config.vectorName] : points[0].vector;
      await this.ensureCollection(firstVector.length);
      try {
        const base = this.client.collectionPath(this.config.collection);
        const saved = await this.client.request('PUT', `${base}/points?wait=true`, { points });
        if (saved?.status !== 'completed') throw new QdrantError();
        // After a successful shorter update, remove stale trailing chunks for ONLY this document/space.
        const removed = await this.client.request('POST', `${base}/points/delete?wait=true`, { filter: {
          must: [{ key: 'kind', match: { value: 'notice_chunk' } }, { key: 'embeddingSpace', match: { value: this.config.embedding.space } }, { key: 'rawPointId', match: { value: doc.rawPointId } }],
          must_not: [{ has_id: points.map(point => point.id) }],
        } });
        if (removed?.status !== 'completed') throw new QdrantError();
      } catch (error) { throw dbError(error); }
      pointCount += points.length;
    }
    return { indexedNotices: docs.length, indexedChunks: pointCount, collection: this.config.collection };
  }
}
