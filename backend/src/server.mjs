import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { ApiError, json } from './http.mjs';
import { getNotices, getNoticeImage } from './crawler.mjs';
import { QdrantClient } from './db/qdrant.mjs';
import { ProfilesRepository } from './db/profiles.mjs';
import { NoticesRepository } from './db/notices.mjs';
import { handleDbRoutes } from './db/routes.mjs';
import { createChatbotService } from '../CHATBOT/service.mjs';
import { handleChatbotRoutes } from '../CHATBOT/routes.mjs';
import { acceptWebSocket } from './ws.mjs';
import { NoticeFeed } from './notice-feed.mjs';

export function createServer({ config = loadConfig(), repository, notices, chatbot, feed, crawler = { getNotices, getNoticeImage } } = {}) {
  repository ??= new ProfilesRepository(new QdrantClient(config.qdrant), config.qdrant.collection);
  chatbot ??= createChatbotService(config);
  notices ??= new NoticesRepository(repository.client, config.qdrant.noticesCollection);
  const server = http.createServer(async (request, response) => {
    try {
      const base = new URL(`http://${request.headers.host || ''}`);
      if (!(config.allowedHosts ?? ['127.0.0.1', 'localhost', '[::1]']).includes(base.hostname)) throw new ApiError(403, 'HOST_FORBIDDEN', '로컬 주소로만 접속할 수 있습니다.');
      const origin = request.headers.origin;
      if (origin && origin !== base.origin && !config.allowedOrigins.includes(origin)) throw new ApiError(403, 'ORIGIN_FORBIDDEN', '허용되지 않은 웹페이지에서의 요청입니다.');
      if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); response.end(); return;
      }
      const url = new URL(request.url, base);
      if (await handleChatbotRoutes(request, response, url, chatbot)) return;
      if (await handleDbRoutes(request, response, url, repository, notices)) return;
      if (request.method === 'GET' && url.pathname === '/api/health') { json(response, 200, { ok: true, service: 'kmu-pick-backend' }); return; }
      if (request.method === 'GET' && url.pathname === '/api/notices' || request.method === 'POST' && url.pathname === '/api/crawl') {
        const data = await crawler.getNotices(request.method === 'POST' || url.searchParams.get('refresh') === '1');
        json(response, data.mode === 'error' ? 502 : 200, data); return;
      }
      const imageId = url.pathname.match(/^\/api\/images\/([a-f0-9]{16})$/)?.[1];
      if (request.method === 'GET' && imageId) {
        let image;
        try { image = await crawler.getNoticeImage(imageId); } catch { throw new ApiError(502, 'IMAGE_FETCH_FAILED', '학교 원본 이미지를 불러오지 못했습니다.'); }
        if (!image) throw new ApiError(404, 'IMAGE_NOT_FOUND', '수집된 이미지가 없습니다.');
        response.writeHead(200, { 'Content-Type': image.contentType, 'Content-Length': image.bytes.length, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' }); response.end(image.bytes); return;
      }
      if (request.method === 'GET' && url.pathname === '/') {
        json(response, 200, { service: 'NoE backend', apiSpec: '/openapi.json', health: '/api/health', databaseHealth: '/api/db/health' }); return;
      }
      const files = { '/openapi.json': '../openapi.json', '/profile-client.mjs': '../examples/profile-client.mjs' };
      if (request.method === 'GET' && Object.hasOwn(files, url.pathname)) {
        const body = await readFile(new URL(files[url.pathname], import.meta.url));
        const type = url.pathname.endsWith('.json') ? 'application/json' : url.pathname.endsWith('.mjs') ? 'text/javascript' : 'text/html';
        response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Content-Length': body.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); response.end(body); return;
      }
      throw new ApiError(404, 'NOT_FOUND', '요청한 경로를 찾을 수 없습니다.');
    } catch (error) {
      if (response.destroyed || response.headersSent) return;
      const known = error instanceof ApiError;
      json(response, known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : '요청 처리에 실패했습니다.', ...(known && error.details ? { details: error.details } : {}) } });
    }
  });
  // WebSocket: GET /ws/notices (header bell). The front server proxies it from the public port.
  server.on('upgrade', (request, socket) => {
    const hostname = (() => { try { return new URL(`http://${request.headers.host || ''}`).hostname; } catch { return ''; } })();
    const allowedHost = (config.allowedHosts ?? ['127.0.0.1', 'localhost', '[::1]']).includes(hostname);
    if (!feed || !allowedHost || new URL(request.url, 'http://local').pathname !== '/ws/notices') {
      socket.end(`HTTP/1.1 ${allowedHost ? '404 Not Found' : '403 Forbidden'}\r\nConnection: close\r\n\r\n`);
      return;
    }
    const client = acceptWebSocket(request, socket);
    if (client) feed.add(client);
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const config = loadConfig();
  if (config.qdrant.insecureRemote) console.warn('주의: 원격 Qdrant HTTP 개발 연결입니다. 키와 데이터가 암호화되지 않습니다. 실제 개인정보에는 HTTPS 또는 보안 터널을 사용하세요.');
  const feed = new NoticeFeed(new NoticesRepository(new QdrantClient(config.qdrant), config.qdrant.noticesCollection), { intervalMs: config.noticeFeedIntervalMs }).start();
  const server = createServer({ config, feed });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '포트가 사용 중입니다. .env에서 PORT를 변경하세요.' : '서버를 시작하지 못했습니다.'); process.exitCode = 1; });
  server.listen(config.port, config.host, () => console.log(`KMU Pick 백엔드: http://${config.host}:${config.port} (Qdrant 상태: /api/db/health)`));
}
