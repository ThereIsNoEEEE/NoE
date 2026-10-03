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

test('GET /api/notice-feed: 커서 없으면 최신 목록, 커서 이후 도착분만 돌려주고 다른 epoch 커서는 초기화한다', async t => {
  let items = [notice('a', '2026-10-02')];
  const feed = new NoticeFeed({ list: async () => items });
  await feed.refresh();
  const app = createServer({ config: loadConfig({}), feed, chatbot: { status: () => ({}) } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const get = async after => (await fetch(`http://127.0.0.1:${app.address().port}/api/notice-feed${after ? `?after=${encodeURIComponent(after)}` : ''}`)).json();
  const hello = await get();
  assert.equal(hello.type, 'hello'); assert.deepEqual(hello.items.map(i => i.id), ['a']);
  const empty = await get(hello.cursor);
  assert.deepEqual([empty.type, empty.items.length, empty.cursor], ['notices', 0, hello.cursor]);
  items = [notice('c', '2026-10-03'), notice('b', '2026-10-03'), ...items];
  await feed.refresh();
  const fresh = await get(hello.cursor);
  assert.deepEqual(fresh.items.map(i => i.id).sort(), ['b', 'c']);
  assert.notEqual(fresh.cursor, hello.cursor);
  assert.equal((await get(fresh.cursor)).items.length, 0);
  assert.equal((await get('other-epoch:3')).type, 'hello');
  assert.equal((await get(`${feed.epoch}:999`)).type, 'hello');
});

test('replay 모드는 처음 목록 밖의 실제 공지를 최신순으로 하나씩 새 공지로 알린다', async () => {
  const items = ['a', 'b', 'c', 'd'].map((id, i) => notice(id, `2026-10-0${4 - i}`));
  const feed = new NoticeFeed({ list: async () => items }, { latestCount: 2, replayIntervalMs: 5000 });
  await feed.refresh();
  const sent = [];
  feed.add({ send: m => sent.push(m), onClose: () => {}, ping: () => {} });
  const hello = feed.poll();
  assert.deepEqual(hello.items.map(i => i.id), ['a', 'b']);
  assert.equal(feed.replay().id, 'c');
  assert.deepEqual(sent.at(-1).items.map(i => i.id), ['c']);
  assert.deepEqual(feed.poll(hello.cursor).items.map(i => i.id), ['c']);
  assert.deepEqual(feed.latest.map(i => i.id), ['c', 'a']);
  await feed.refresh();
  assert.deepEqual(feed.latest.map(i => i.id), ['c', 'a'], 'periodic refresh keeps announced notices on top');
  assert.equal(feed.replay().id, 'd');
  assert.equal(feed.replay(), null);
  assert.equal(new Set(feed.log.map(e => e.item.id)).size, feed.log.length);
});
