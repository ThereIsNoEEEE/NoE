// Add future DB endpoints here; keep crawling independent of DB availability.
import { ApiError, json, readJson } from '../http.mjs';
import { QdrantError } from './qdrant.mjs';

export async function handleDbRoutes(request, response, url, repository, notices) {
  if (!url.pathname.startsWith('/api/db/')) return false;
  try {
    if (url.pathname === '/api/db/health') {
      if (request.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'GET만 허용합니다.');
      // Read-only health: readiness succeeds even before the first profile creates a collection.
      let collectionExists = true;
      try { await repository.client.collection(repository.collection); }
      catch (error) { if (error instanceof QdrantError && error.status === 404) collectionExists = false; else throw error; }
      json(response, 200, { ok: true, database: 'qdrant', collectionExists });
    } else if (/^\/api\/db\/notices\/[^/]+\/image$/.test(url.pathname)) {
      if (request.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'GET만 허용합니다.');
      const image = await notices.image(url.pathname.split('/')[4]);
      response.writeHead(200, { 'Content-Type': image.contentType, 'Content-Length': image.bytes.length, 'Cache-Control': 'public, max-age=600', 'X-Content-Type-Options': 'nosniff' });
      response.end(image.bytes);
    } else if (url.pathname === '/api/db/notices') {
      if (request.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'GET만 허용합니다.');
      if (!notices) throw new ApiError(404, 'NOT_FOUND', 'DB API를 찾을 수 없습니다.');
      const items = await notices.list();
      json(response, 200, { items, total: items.length, source: 'qdrant', collection: notices.collection, fetchedAt: new Date().toISOString() });
    } else if (url.pathname === '/api/db/profiles') {
      if (request.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', '최초 저장은 POST를 사용하세요.');
      const result = await repository.create(await readJson(request));
      json(response, 201, result, { Location: `/api/db/profiles/${result.id}` });
    } else {
      const match = url.pathname.match(/^\/api\/db\/profiles\/([^/]+)$/);
      if (!match) throw new ApiError(404, 'NOT_FOUND', 'DB API를 찾을 수 없습니다.');
      if (request.method === 'GET') json(response, 200, await repository.get(match[1]));
      else if (request.method === 'PUT') json(response, 200, await repository.update(match[1], await readJson(request)));
      else throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'GET 또는 PUT을 사용하세요.');
    }
  } catch (error) {
    if (error instanceof QdrantError) {
      if ([401, 403].includes(error.status)) throw new ApiError(503, 'DB_AUTH_FAILED', '서버 환경 변수 QDRANT_API_KEY를 확인하세요. 키는 브라우저에 넣지 마세요.');
      throw new ApiError(503, 'DB_UNAVAILABLE', 'Qdrant 연결 또는 저장에 실패했습니다. DB 실행 상태와 서버 설정을 확인하세요.');
    }
    throw error;
  }
  return true;
}
