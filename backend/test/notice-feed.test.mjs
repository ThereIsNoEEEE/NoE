import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { loadConfig } from '../src/config.mjs';
import { createServer } from '../src/server.mjs';
import { NoticeFeed } from '../src/notice-feed.mjs';

const notice = (id, date) => ({ id, title: `공지 ${id}`, date, url: `https://cs.kookmin.ac.kr/${id}`, sourceName: '국민대학교 소프트웨어융합대학', imageUrl: null, collectedAt: '2026-10-03T00:00:00Z', content: '본문은 보내지 않음' });

function nextMessage(ws) {
  return new Promise((resolve, reject) => {
    ws.addEventListener('message', event => resolve(JSON.parse(event.data)), { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
}

test('WebSocket /ws/notices: 연결 시 최신 공지(hello), 새 공지는 notices로 푸시한다', async t => {
  let items = [notice('a', '2026-10-02'), notice('b', '2026-10-01')];
  const feed = new NoticeFeed({ list: async () => items }, { latestCount: 1 });
  await feed.refresh();
  const app = createServer({ config: loadConfig({}), feed, chatbot: { status: () => ({}) } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { feed.stop(); app.closeAllConnections(); app.close(); });
  const ws = new WebSocket(`ws://127.0.0.1:${app.address().port}/ws/notices`);
  const hello = await nextMessage(ws);
  assert.equal(hello.type, 'hello');
  assert.deepEqual(hello.items.map(i => i.id), ['a']);
  assert.equal(hello.items[0].content, undefined);
  items = [notice('c', '2026-10-03'), ...items];
  const pushed = nextMessage(ws);
  assert.deepEqual((await feed.refresh()).map(i => i.id), ['c']);
  const message = await pushed;
  assert.equal(message.type, 'notices');
  assert.deepEqual(message.items.map(i => i.id), ['c']);
  assert.deepEqual(await feed.refresh(), []);
  ws.close(); await once(ws, 'close');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(feed.clients.size, 0);
});

test('WebSocket은 /ws/notices 외 경로와 허용되지 않은 Host를 거부한다', async t => {
  const feed = new NoticeFeed({ list: async () => [] });
  const app = createServer({ config: loadConfig({}), feed, chatbot: { status: () => ({}) } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const port = app.address().port;
  const wrong = new WebSocket(`ws://127.0.0.1:${port}/ws/other`);
  await once(wrong, 'error');
  const raw = await new Promise(resolve => {
    import('node:net').then(({ connect }) => {
      const socket = connect(port, '127.0.0.1', () => socket.write('GET /ws/notices HTTP/1.1\r\nHost: evil.example\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'));
      let data = ''; socket.on('data', c => { data += c; }); socket.on('end', () => resolve(data)); socket.on('close', () => resolve(data));
    });
  });
  assert.match(raw, /^HTTP\/1\.1 403/);
});
