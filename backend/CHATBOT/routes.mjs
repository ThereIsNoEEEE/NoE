import { ApiError, json, readJson } from '../src/http.mjs';

export async function handleChatbotRoutes(request, response, url, service) {
  if (url.pathname !== '/api/chatbot' && !url.pathname.startsWith('/api/chatbot/')) return false;
  if (url.pathname === '/api/chatbot/status') {
    if (request.method !== 'GET') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'GET을 사용하세요.');
    json(response, 200, service.status()); return true;
  }
  if (url.pathname !== '/api/chatbot') throw new ApiError(404, 'NOT_FOUND', '챗봇 API를 찾을 수 없습니다.');
  if (request.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'POST를 사용하세요.');
  const body = await readJson(request);
  if (body?.stream === true) { await streamAnswer(request, response, service, body); return true; }
  json(response, 200, await service.query(body));
  return true;
}

// Server-Sent Events: `sources` (search results + images) → `delta` × N (answer text) → `done` | `error`.
async function streamAnswer(request, response, service, body) {
  const controller = new AbortController();
  const onClose = () => { if (!response.writableEnded) controller.abort(); };
  response.on('close', onClose);
  // Validation/search errors happen before any bytes are sent and use the normal JSON error path.
  const { head, chunks } = await service.startStream(body, { signal: controller.signal });
  response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
  const send = (event, data) => { if (!response.destroyed) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  send('sources', head);
  try {
    for await (const text of chunks) {
      if (controller.signal.aborted) break;
      send('delta', { text });
    }
    send('done', { status: head.status === 'no_results' ? 'no_results' : 'answered' });
  } catch (error) {
    const known = error instanceof ApiError;
    send('error', { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : '답변 생성 중 오류가 발생했습니다.' });
  } finally {
    response.off('close', onClose);
    response.end();
  }
}
