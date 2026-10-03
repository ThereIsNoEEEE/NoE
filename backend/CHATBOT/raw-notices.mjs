import { ApiError } from '../src/http.mjs';
import { dbError } from './retriever.mjs';

// Read existing importer envelopes in bounded pages. Never write to the raw collection.
export async function* readRawNoticeBatches(client, collection) {
  let offset;
  const seenOffsets = new Set();
  for (let page = 0; page < 100; page++) {
    let result;
    try {
      result = await client.request('POST', `${client.collectionPath(collection)}/points/scroll`, {
        limit: 50, with_vector: false,
        with_payload: ['kind', 'notice.id', 'notice.externalId', 'notice.sourceId', 'notice.title', 'notice.content', 'notice.contentHash', 'notice.contentStatus', 'notice.date', 'notice.url', 'notice.images', 'notice.attachments', 'needsOcr', 'needsAttachmentExtraction', 'reviewRequired'],
        filter: { must: [{ key: 'kind', match: { value: 'notice' } }] },
        ...(offset === undefined ? {} : { offset }),
      });
    } catch (error) { throw dbError(error); }
    if (!Array.isArray(result?.points)) throw new ApiError(502, 'RAW_NOTICES_INVALID', '공지 원문 조회 응답이 올바르지 않습니다.');
    const notices = result.points.filter(p => p.payload?.kind === 'notice' && p.payload?.notice).map(p => ({ ...p.payload.notice, rawPointId: String(p.id), needsOcr: p.payload.needsOcr, needsAttachmentExtraction: p.payload.needsAttachmentExtraction, reviewRequired: p.payload.reviewRequired }));
    if (notices.length) yield notices;
    offset = result.next_page_offset;
    if (offset == null) return;
    if (seenOffsets.has(String(offset))) throw new ApiError(502, 'RAW_NOTICES_INVALID', 'DB 페이지 커서가 반복되어 중단했습니다.');
    seenOffsets.add(String(offset));
  }
  throw new ApiError(422, 'INDEX_LIMIT_EXCEEDED', '한 번에 최대 5,000개 원문만 색인합니다. 범위를 나누어 주세요.');
}
