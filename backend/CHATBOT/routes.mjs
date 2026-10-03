import { ApiError, json, readJson } from '../src/http.mjs';

export async function handleChatbotRoutes(request, response, url, service) {
  if (url.pathname !== '/api/chatbot' && !url.pathname.startsWith('/api/chatbot/')) return false;
  if (url.pathname === '/api/chatbot/status') {
    if (request.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'GET을 사용하세요.');
    json(response, 200, service.status()); return true;
  }
  if (url.pathname !== '/api/chatbot') throw new ApiError(404, 'NOT_FOUND', '챗봇 API를 찾을 수 없습니다.');
  if (request.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'POST를 사용하세요.');
  json(response, 200, await service.query(await readJson(request)));
  return true;
}
