import { ApiError } from '../src/http.mjs';
import { QdrantError } from '../src/db/qdrant.mjs';
import { validateVector } from './schema.mjs';
import { imageCandidates } from '../src/db/notice-images.mjs';

export function dbError(error) {
  if (!(error instanceof QdrantError)) return error;
  if ([401, 403].includes(error.status)) return new ApiError(503, 'CHATBOT_DB_AUTH_FAILED', '서버의 QDRANT_API_KEY를 확인하세요.');
  if (error.status === 404) return new ApiError(503, 'CHATBOT_INDEX_MISSING', '검색용 공지 컬렉션이 없습니다. 먼저 공지를 벡터로 저장하세요.');
  return new ApiError(503, 'CHATBOT_DB_UNAVAILABLE', 'Qdrant 검색/저장 요청에 실패했습니다.');
}

export function assertVectorConfig(info, config, size) {
  const vectors = info?.config?.params?.vectors;
  const params = config.vectorName ? vectors?.[config.vectorName] : vectors;
  if (!params || params.size !== size || params.distance !== 'Cosine' || params.multivector_config) throw new ApiError(503, 'CHATBOT_VECTOR_MISMATCH', '검색 컬렉션의 벡터 이름·차원·Cosine 설정과 임베딩 모델이 일치해야 합니다. 기존 컬렉션은 변경하지 않았습니다.');
}

export function safeSourceUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href.slice(0, 2000) : null; } catch { return null; }
}

export class QdrantRetriever {
  constructor(client, config) { Object.assign(this, { client, config }); }

  // Poster URLs (served by GET /api/db/notices/:id/image) for the raw notices behind the sources.
  // Display-only: never sent to the LLM, and failures just mean no images.
  async imageUrls(rawPointIds, { signal } = {}) {
    const ids = [...new Set(rawPointIds.filter(id => /^[0-9a-f-]{36}$/.test(id)))];
    if (!ids.length) return {};
    try {
      const points = await this.client.request('POST', `${this.client.collectionPath(this.config.rawCollection)}/points`, { ids, with_payload: ['notice.images', 'assetDirectory'], with_vector: false }, { signal });
      return Object.fromEntries((points || []).filter(p => imageCandidates(p.payload).length).map(p => [String(p.id), `/api/db/notices/${p.id}/image`]));
    } catch { return {}; }
  }
  async search(vector, topK, { signal } = {}) {
    validateVector(vector);
    try {
      assertVectorConfig(await this.client.collection(this.config.collection, { signal }), this.config, vector.length);
      const result = await this.client.request('POST', `${this.client.collectionPath(this.config.collection)}/points/query`, {
        query: vector, limit: topK, with_vector: false,
        with_payload: ['kind', 'embeddingSpace', 'noticeId', 'rawPointId', 'sourceContentHash', 'chunkIndex', 'title', 'content', 'url', 'date', 'contentStatus', 'needsOcr', 'needsAttachmentExtraction', 'reviewRequired'],
        filter: { must: [{ key: 'kind', match: { value: 'notice_chunk' } }, { key: 'embeddingSpace', match: { value: this.config.embedding.space } }] },
        ...(this.config.vectorName ? { using: this.config.vectorName } : {}),
        ...(this.config.threshold === undefined ? {} : { score_threshold: this.config.threshold }),
      }, { signal });
      if (!Array.isArray(result?.points)) throw new ApiError(502, 'CHATBOT_SEARCH_INVALID', '검색 결과 형식이 올바르지 않습니다.');
      const seen = new Set();
      return result.points.filter(point => {
        const p = point.payload;
        if (!p || p.kind !== 'notice_chunk' || p.embeddingSpace !== this.config.embedding.space || typeof p.content !== 'string' || !p.content.trim() || typeof point.score !== 'number' || !Number.isFinite(point.score) || seen.has(String(point.id))) return false;
        seen.add(String(point.id)); return true;
      }).slice(0, topK).map(point => ({
        id: String(point.id), score: point.score,
        noticeId: String(point.payload.noticeId || '').slice(0, 200),
        rawPointId: String(point.payload.rawPointId || '').slice(0, 100),
        sourceContentHash: String(point.payload.sourceContentHash || '').slice(0, 128),
        contentStatus: String(point.payload.contentStatus || 'unknown').slice(0, 50),
        needsOcr: Boolean(point.payload.needsOcr),
        needsAttachmentExtraction: Boolean(point.payload.needsAttachmentExtraction),
        reviewRequired: Boolean(point.payload.reviewRequired),
        title: String(point.payload.title || '').slice(0, 300),
        content: point.payload.content.slice(0, 4000),
        url: safeSourceUrl(point.payload.url),
        date: typeof point.payload.date === 'string' ? point.payload.date.slice(0, 30) : null,
      }));
    } catch (error) { throw dbError(error); }
  }
}
