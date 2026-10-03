import { createHash } from 'node:crypto';
import { QdrantError } from './qdrant.mjs';
import { ApiError } from '../http.mjs';
import { UUID } from './profile-schema.mjs';
import { imageCandidates, readNoticeImage } from './notice-images.mjs';

export const NOTICES_COLLECTION = 'kmu_notices_raw_v1';
const CONTENT_STATUSES = new Set(['text_extracted', 'image_only', 'attachment_only', 'extraction_failed']);

// RFC 4122 UUID v5: the same source/post maps to the same Qdrant point.
export function noticePointId(identity) {
  const namespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1').update(namespace).update(`kmu-notice:${identity}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function validateNotice(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('공지 객체가 필요합니다.');
  for (const field of ['id', 'sourceId', 'title', 'url']) {
    if (typeof input[field] !== 'string' || !input[field].trim()) throw new Error(`${field}: 비어 있지 않은 문자열이 필요합니다.`);
  }
  const url = new URL(input.url);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('url: HTTP(S) 원문 주소가 필요합니다.');
  if (typeof input.content !== 'string') throw new Error('content: 문자열이 필요합니다.');
  if (!CONTENT_STATUSES.has(input.contentStatus)) throw new Error('contentStatus: 지원하지 않는 추출 상태입니다.');
  if (input.contentStatus === 'text_extracted' && !input.content.trim()) throw new Error('text_extracted인데 본문이 비어 있습니다.');
  if (input.date != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('date: YYYY-MM-DD 형식이 필요합니다.');
    const parsed = new Date(`${input.date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.date) throw new Error('date: 존재하지 않는 날짜입니다.');
  }
  for (const field of ['images', 'attachments']) {
    if (input[field] != null && !Array.isArray(input[field])) throw new Error(`${field}: 배열이 필요합니다.`);
    for (const asset of input[field] || []) {
      if (!asset || typeof asset !== 'object' || Array.isArray(asset)) throw new Error(`${field}: 파일 객체가 필요합니다.`);
      if (asset.localPath != null && typeof asset.localPath !== 'string') throw new Error(`${field}: localPath는 문자열이어야 합니다.`);
      if (asset.url != null) {
        const assetUrl = new URL(asset.url);
        if (!['https:', 'http:', 'file:'].includes(assetUrl.protocol)) throw new Error(`${field}: 지원하지 않는 URL 형식입니다.`);
      }
      if (!asset.url && !asset.localPath && !(asset.availability === 'unavailable' && typeof asset.originalUrl === 'string' && asset.originalUrl.startsWith('file:'))) throw new Error(`${field}: URL 또는 파일 경로가 필요합니다.`);
    }
  }
  if (input.reviewReasons != null && !Array.isArray(input.reviewReasons)) throw new Error('reviewReasons: 배열이 필요합니다.');
  // Preserve original text, HTML, metadata and unknown fields without truncation.
  const normalizeAsset = asset => {
    if (asset.url?.startsWith('file:')) return { ...asset, originalUrl: asset.url, url: null, availability: 'unavailable', unavailableReason: 'source_local_file_url' };
    return { ...asset };
  };
  return { ...input, id: input.id.trim(), sourceId: input.sourceId.trim(), title: input.title.trim(), date: input.date ?? null, images: (input.images ?? []).map(normalizeAsset), attachments: (input.attachments ?? []).map(normalizeAsset) };
}

export function prepareNotices(document) {
  const rows = Array.isArray(document) ? document : document?.notices ?? document?.items;
  if (!Array.isArray(rows) || !rows.length) throw new Error('비어 있지 않은 공지 배열 또는 notices/items 배열이 필요합니다.');
  const points = new Map();
  const errors = [];
  let duplicates = 0;
  const statusCounts = {};
  for (const [index, input] of rows.entries()) {
    try {
      const notice = validateNotice(input);
      const identity = `${notice.sourceId}:${notice.externalId ?? notice.id}`;
      const id = noticePointId(identity);
      const previous = points.get(id);
      if (previous) {
        if (JSON.stringify(previous.payload.notice) !== JSON.stringify(notice)) throw new Error('동일 게시물 ID에 서로 다른 데이터가 있습니다. 중복을 정리하세요.');
        duplicates++;
        continue;
      }
      const needsOcr = notice.images.some(asset => asset.availability !== 'unavailable' && asset.textStatus !== 'extracted' && !asset.text);
      const needsAttachmentExtraction = notice.attachments.some(asset => asset.availability !== 'unavailable' && asset.textStatus !== 'extracted' && !asset.text);
      points.set(id, { id, vector: {}, payload: { kind: 'notice', schemaVersion: 1, notice, analysisStatus: 'pending', needsOcr, needsAttachmentExtraction, reviewRequired: notice.contentStatus === 'extraction_failed' || notice.isTruncated === true || Boolean(notice.reviewReasons?.length) } });
      statusCounts[notice.contentStatus] = (statusCounts[notice.contentStatus] || 0) + 1;
    } catch (error) { errors.push({ index, id: input?.id ?? null, message: error.message }); }
  }
  const values = [...points.values()];
  return { points: values, summary: { inputCount: rows.length, validCount: values.length, duplicates, invalidCount: errors.length, statusCounts, needsOcrCount: values.filter(p => p.payload.needsOcr).length, needsAttachmentExtractionCount: values.filter(p => p.payload.needsAttachmentExtraction).length, unavailableAssetCount: values.reduce((total, p) => total + [...p.payload.notice.images, ...p.payload.notice.attachments].filter(a => a.availability === 'unavailable').length, 0), reviewRequiredCount: values.filter(p => p.payload.reviewRequired).length }, errors };
}

const LIST_PAGE_SIZE = 256;
const LIST_MAX_NOTICES = 2000;
const LIST_MAX_CONTENT = 2000;

// Maps a stored payload to the shape the front dashboard consumes.
export function toNoticeItem(payload, pointId = null) {
  const n = payload?.notice;
  if (!n || typeof n !== 'object' || !n.id || !n.title) return null;
  return {
    id: String(n.id),
    imageUrl: pointId && imageCandidates(payload).length ? `/api/db/notices/${pointId}/image` : null,
    title: String(n.title),
    content: String(n.content || '').slice(0, LIST_MAX_CONTENT),
    date: n.dateUnknown ? '' : String(n.date || ''),
    url: String(n.url || ''),
    sourceType: n.sourceType || 'website',
    sourceName: n.sourceName || '',
    category: n.sourceCategory || n.sourceBoard || '',
    pinned: Boolean(n.pinned),
    sourceId: n.sourceId || '',
    sourceBoard: n.sourceBoard || '',
    contentStatus: n.contentStatus || null,
    collectedAt: n.collectedAt || null,
    analysisStatus: payload.analysisStatus || null,
    needsOcr: Boolean(payload.needsOcr),
  };
}

export class NoticesRepository {
  constructor(client, collection = NOTICES_COLLECTION) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(collection) || /profile/i.test(collection)) throw new Error('프로필 컬렉션과 구분되는 공지 컬렉션 이름이 필요합니다.');
    this.client = client;
    this.collection = collection;
  }

  async ensureCollection() {
    let info;
    try { info = await this.client.collection(this.collection); }
    catch (error) {
      if (!(error instanceof QdrantError) || error.status !== 404) throw error;
      try { await this.client.createCollection(this.collection); }
      catch (createError) { if (!(createError instanceof QdrantError) || ![400, 409].includes(createError.status)) throw createError; }
      info = await this.client.collection(this.collection);
    }
    const vectors = info?.config?.params?.vectors;
    if (!vectors || Array.isArray(vectors) || typeof vectors !== 'object' || Object.keys(vectors).length || Object.keys(info?.config?.params?.sparse_vectors || {}).length) throw new Error('공지 원문용 payload-only 컬렉션이 아닙니다. 기존 컬렉션은 변경하지 않았습니다.');
  }

  async save(points, onProgress = () => {}) {
    await this.ensureCollection();
    let saved = 0;
    // One point at a time also accommodates large, untruncated HTML payloads.
    for (const point of points) {
      await this.client.upsert(this.collection, point.id, point.payload);
      saved++;
      onProgress(saved, points.length);
    }
    return saved;
  }

  async image(id) {
    if (!UUID.test(id)) throw new ApiError(400, 'INVALID_NOTICE_ID', '올바른 공지 ID가 필요합니다.');
    let point;
    try { point = await this.client.point(this.collection, id); }
    catch (error) {
      if (error instanceof QdrantError && error.status === 404) throw new ApiError(404, 'NOTICE_NOT_FOUND', '공지를 찾을 수 없습니다.');
      throw error;
    }
    if (point?.payload?.kind !== 'notice') throw new ApiError(404, 'NOTICE_NOT_FOUND', '공지를 찾을 수 없습니다.');
    const image = await readNoticeImage(point.payload);
    if (!image) throw new ApiError(404, 'NOTICE_IMAGE_NOT_FOUND', '표시할 공지 이미지가 없습니다.');
    return image;
  }

  async list() {
    const items = [];
    let offset = null;
    do {
      const result = await this.client.request('POST', `${this.client.collectionPath(this.collection)}/points/scroll`, {
        limit: LIST_PAGE_SIZE, with_payload: true, with_vector: false, ...(offset === null ? {} : { offset }),
        filter: { must: [{ key: 'kind', match: { value: 'notice' } }] },
      });
      for (const point of result?.points || []) {
        const item = toNoticeItem(point.payload, point.id);
        if (item) items.push(item);
      }
      offset = result?.next_page_offset ?? null;
    } while (offset !== null && items.length < LIST_MAX_NOTICES);
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }
}
