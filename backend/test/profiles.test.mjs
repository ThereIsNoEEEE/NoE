import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import { createServer } from '../src/server.mjs';
import { loadConfig } from '../src/config.mjs';
import { validateProfile } from '../src/db/profile-schema.mjs';

const profile = { studentType: '대학원', college: '소프트웨어융합대학원', major: 'AI', grade: 1, interests: ['취업', 'AI/데이터'], customInterests: ['로봇'], keywords: ['AI', '데이터'] };

// Protocol double only: validates REST requests, not a real Qdrant persistence test.
async function fixture(t) {
  const state = { exists: false, points: new Map(), createCount: 0, calls: [], fail: false, invalidSchema: false, pendingWrite: false };
  const qdrant = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    state.calls.push({ method: req.method, url: req.url, body, key: req.headers['api-key'] });
    const reply = (status, result) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: status < 300 ? 'ok' : 'error', result })); };
    if (state.fail) return reply(503, null);
    if (req.url === '/collections/test_profiles') {
      if (req.method === 'PUT') {
        assert.deepEqual(body, { vectors: {} });
        if (state.exists) return reply(409, null);
        state.exists = true; state.createCount++; return reply(200, true);
      }
      return reply(state.exists ? 200 : 404, { config: { params: { vectors: state.invalidSchema ? { size: 3, distance: 'Cosine' } : {} } } });
    }
    if (req.url === '/collections/test_profiles/points?wait=true' && req.method === 'PUT') {
      if (!state.exists) return reply(404, null);
      assert.deepEqual(body.points[0].vector, {});
      for (const point of body.points) state.points.set(point.id, point);
      return reply(200, { status: state.pendingWrite ? 'acknowledged' : 'completed', operation_id: 1 });
    }
    const id = req.url.match(/\/points\/([^/?]+)$/)?.[1];
    if (req.method === 'GET' && id) return reply(state.points.has(id) ? 200 : 404, state.points.get(id));
    reply(404, null);
  });
  qdrant.listen(0, '127.0.0.1'); await once(qdrant, 'listening');
  const config = loadConfig({ QDRANT_URL: `http://127.0.0.1:${qdrant.address().port}`, QDRANT_COLLECTION: 'test_profiles', QDRANT_API_KEY: 'test-only-key', ALLOWED_ORIGINS: 'http://localhost:5173' });
  const app = createServer({ config, crawler: { getNotices: async () => ({ mode: 'live', items: [], total: 0 }), getNoticeImage: async () => null } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(async () => { app.closeAllConnections(); qdrant.closeAllConnections(); await Promise.all([new Promise(r => app.close(r)), new Promise(r => qdrant.close(r))]); });
  const base = `http://127.0.0.1:${app.address().port}`;
  const request = (path, method = 'GET', body, headers = {}) => fetch(base + path, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { state, base, request };
}

test('최초 POST는 컬렉션 생성 후 wait=true로 저장하고 GET으로 동일한 학사 정보를 반환한다', async t => {
  const { state, request } = await fixture(t);
  const res = await request('/api/db/profiles', 'POST', profile);
  assert.equal(res.status, 201);
  const saved = await res.json();
  assert.match(saved.id, /^[a-f0-9-]{36}$/);
  assert.equal(res.headers.get('location'), `/api/db/profiles/${saved.id}`);
  assert.deepEqual(saved.profile, profile);
  assert.equal(saved.schemaVersion, 1);
  assert.equal(state.createCount, 1);
  assert.equal(state.points.size, 1);
  assert.ok(state.calls.every(call => call.key === 'test-only-key'));
  assert.deepEqual(await (await request(`/api/db/profiles/${saved.id}`)).json(), saved);
});

test('동시 최초 요청은 컬렉션을 한 번만 생성하고 독립 UUID를 반환한다', async t => {
  const { state, request } = await fixture(t);
  const responses = await Promise.all(Array.from({ length: 5 }, () => request('/api/db/profiles', 'POST', profile)));
  assert.ok(responses.every(r => r.status === 201));
  assert.equal(state.createCount, 1); assert.equal(state.points.size, 5);
});

test('PUT은 같은 ID와 createdAt을 보존하며 전체 프로필을 교체한다', async t => {
  const { state, request } = await fixture(t);
  const saved = await (await request('/api/db/profiles', 'POST', profile)).json();
  const updated = await request(`/api/db/profiles/${saved.id}`, 'PUT', { ...profile, grade: 2, interests: ['취업'], customInterests: [] });
  assert.equal(updated.status, 200);
  const result = await updated.json();
  assert.equal(result.createdAt, saved.createdAt); assert.equal(result.id, saved.id);
  assert.equal(result.profile.grade, 2); assert.deepEqual(result.profile.customInterests, []);
  assert.equal(state.points.size, 1);
});

test('잘못된 학적/학년/필드/배열은 Qdrant 접근 전에 422로 거부한다', async t => {
  const { state, request } = await fixture(t);
  const invalid = [null, [], { ...profile, grade: '1' }, { ...profile, grade: 4 }, { ...profile, studentType: '교수' }, { ...profile, major: ' ' }, { ...profile, interests: [] }, { ...profile, id: 'injected' }, { ...profile, keywords: ['x'.repeat(51)] }, { ...profile, keywords: Array(21).fill('AI') }, { ...profile, college: 'bad\nvalue' }];
  for (const input of invalid) assert.equal((await request('/api/db/profiles', 'POST', input)).status, 422);
  assert.equal(state.calls.length, 0);
});

test('공백과 중복 키워드는 정규화하며 선택 배열은 기본값을 가진다', () => {
  const result = validateProfile({ studentType: '학부', college: ' 창의공과대학 ', major: '소프트웨어학부', grade: 4, interests: [' AI ', 'ai', '데이터'] });
  assert.equal(result.college, '창의공과대학');
  assert.deepEqual(result.interests, ['AI', '데이터']);
  assert.deepEqual(result.customInterests, []); assert.deepEqual(result.keywords, []);
});

test('잘못된 JSON, 미지원 형식, 큰 본문은 명확한 4xx 응답을 반환한다', async t => {
  const { base, request } = await fixture(t);
  assert.equal((await fetch(base + '/api/db/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
  assert.equal((await fetch(base + '/api/db/profiles', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await request('/api/db/profiles', 'POST', { ...profile, major: 'x'.repeat(34000) })).status, 413);
});

test('미존재 ID는 404, 잘못된 UUID는 400, 지원하지 않는 메서드는 405다', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/api/db/profiles/not-a-uuid')).status, 400);
  assert.equal((await request('/api/db/profiles/00000000-0000-4000-8000-000000000001')).status, 404);
  assert.equal((await request('/api/db/profiles')).status, 405);
  assert.equal((await request('/api/db/profiles/00000000-0000-4000-8000-000000000001', 'DELETE')).status, 405);
});

test('Qdrant 장애는 503이며 복구 후 재시도하고 크롤링은 DB 장애와 독립이다', async t => {
  const { state, request } = await fixture(t); state.fail = true;
  const failed = await request('/api/db/profiles', 'POST', profile);
  assert.equal(failed.status, 503); assert.equal((await failed.json()).error.code, 'DB_UNAVAILABLE');
  assert.equal((await request('/api/db/health')).status, 503);
  assert.equal((await request('/api/notices')).status, 200);
  state.fail = false;
  assert.equal((await request('/api/db/profiles', 'POST', profile)).status, 201);
});

test('DB 상태 확인은 컬렉션을 만들지 않으며 기존 비호환 컬렉션을 덮어쓰지 않는다', async t => {
  const { state, request } = await fixture(t);
  assert.deepEqual(await (await request('/api/db/health')).json(), { ok: true, database: 'qdrant', collectionExists: false });
  assert.equal(state.createCount, 0);
  state.exists = true; state.invalidSchema = true;
  const response = await request('/api/db/profiles', 'POST', profile);
  assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'DB_SCHEMA_MISMATCH');
  assert.equal(state.points.size, 0); assert.equal(state.createCount, 0);
});

test('Qdrant 작업 완료가 확인되지 않으면 저장 성공으로 응답하지 않는다', async t => {
  const { state, request } = await fixture(t); state.pendingWrite = true;
  assert.equal((await request('/api/db/profiles', 'POST', profile)).status, 503);
});

test('임의 웹사이트/file origin을 차단하고 허용한 개발 origin만 CORS를 연다', async t => {
  const { state, request } = await fixture(t);
  assert.equal((await request('/api/db/profiles', 'POST', profile, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/api/db/profiles', 'POST', profile, { Origin: 'null' })).status, 403);
  assert.equal(state.calls.length, 0);
  const response = await request('/api/db/profiles', 'OPTIONS', undefined, { Origin: 'http://localhost:5173' });
  assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('서버 비밀 환경변수 파일은 HTTP로 노출하지 않는다', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/.env')).status, 404);
  assert.equal((await request('/src/config.mjs')).status, 404);
});

test('안전하지 않은 원격 DB URL과 컬렉션 이름은 시작 전에 거부한다', () => {
  assert.throws(() => loadConfig({ QDRANT_URL: 'http://remote.example:6333' }));
  assert.throws(() => loadConfig({ QDRANT_URL: 'https://secret:pass@db.example' }));
  assert.throws(() => loadConfig({ QDRANT_COLLECTION: '../bad' }));
});

test('제공된 HTTP 개발 DB는 명시적 opt-in 설정이 있을 때만 허용한다', () => {
  const config = loadConfig({ QDRANT_URL: 'http://14.36.30.189:13000', QDRANT_ALLOW_INSECURE_HTTP: 'true' });
  assert.equal(config.qdrant.url, 'http://14.36.30.189:13000');
  assert.equal(config.qdrant.insecureRemote, true);
  assert.throws(() => loadConfig({ QDRANT_URL: 'ftp://14.36.30.189:13000', QDRANT_ALLOW_INSECURE_HTTP: 'true' }));
});
