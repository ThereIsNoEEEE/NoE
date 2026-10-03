import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NoticesRepository, prepareNotices, noticePointId } from '../src/db/notices.mjs';
import { loadImport } from '../scripts/import-notices.mjs';
import { QdrantClient, QdrantError } from '../src/db/qdrant.mjs';

const notice = { id: 'cs-2872', sourceId: 'cs', externalId: '2872', title: '테스트 공지', url: 'https://cs.kookmin.ac.kr/news/notice/2872', date: '2026-10-01', content: '본문\n마지막 조건', contentHtml: '<p>본문</p>', contentStatus: 'text_extracted', images: [], attachments: [] };

test('stable UUID, full text preservation, deduplication and conflicting duplicate rejection', () => {
  assert.match(noticePointId('cs:2872'), /^[0-9a-f-]{14}5[0-9a-f-]{21}$/);
  const long = { ...notice, content: '조건'.repeat(15000) };
  const prepared = prepareNotices([long, { ...long }]);
  assert.equal(prepared.points.length, 1);
  assert.equal(prepared.summary.duplicates, 1);
  assert.equal(prepared.points[0].payload.notice.content.length, 30000);
  assert.equal(prepared.points[0].id, prepareNotices([long]).points[0].id);
  assert.equal(prepareNotices([notice, { ...notice, title: '다른 내용' }]).errors.length, 1);
});

test('image-only notices and inaccessible source-local image references are retained', () => {
  const input = { ...notice, content: '', contentStatus: 'image_only', images: [{ url: 'https://example.com/poster.png', textStatus: 'not_processed' }, { url: 'file:///C:/temp/image.jpg' }] };
  const prepared = prepareNotices([input]);
  assert.equal(prepared.errors.length, 0);
  assert.equal(prepared.summary.needsOcrCount, 1);
  assert.equal(prepared.summary.unavailableAssetCount, 1);
  assert.equal(prepared.points[0].payload.notice.images[1].originalUrl, 'file:///C:/temp/image.jpg');
  assert.equal(input.images[1].url, 'file:///C:/temp/image.jpg');
  assert.equal(prepared.points[0].payload.analysisStatus, 'pending');
  assert.equal(prepareNotices([{ ...notice, date: '2026-02-30' }]).errors.length, 1);
});

test('read-only preparation validates local assets and rejects path traversal', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'kmu-import-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'assets/poster.png'), 'example');
  const input = { ...notice, images: [{ url: null, localPath: 'assets/poster.png' }] };
  await writeFile(join(directory, 'notices.json'), JSON.stringify([input]));
  const prepared = await loadImport(directory);
  assert.equal(prepared.files.size, 1);
  assert.equal(prepared.summary.validCount, 1);
  input.images[0].localPath = '../outside.png';
  await writeFile(join(directory, 'notices.json'), JSON.stringify([input]));
  await assert.rejects(loadImport(directory), /허용되지 않는 파일 경로/);
});

test('Qdrant protocol: create payload-only collection, upsert with wait=true, reject incompatible schema', async () => {
  const calls = [];
  let exists = false;
  const fetchImpl = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, method: options.method, body });
    let result;
    if (url.endsWith('/points?wait=true')) result = { status: 'completed' };
    else if (options.method === 'PUT') { exists = true; result = true; }
    else if (!exists) return new Response('{}', { status: 404 });
    else result = { config: { params: { vectors: {} } } };
    return Response.json({ status: 'ok', result });
  };
  const repository = new NoticesRepository(new QdrantClient({ url: 'http://localhost:6333' }, fetchImpl));
  const points = prepareNotices([notice]).points;
  assert.equal(await repository.save(points), 1);
  assert.deepEqual(calls.find(c => c.method === 'PUT' && !c.url.includes('/points')).body, { vectors: {} });
  assert.deepEqual(calls.at(-1).body, { points: [{ id: points[0].id, vector: {}, payload: points[0].payload }] });
  const incompatible = new NoticesRepository({ collection: async () => ({ config: { params: { vectors: { size: 384 } } } }) });
  await assert.rejects(incompatible.ensureCollection(), /payload-only/);
  const unauthorized = new NoticesRepository({ collection: async () => { throw new QdrantError(401); } });
  await assert.rejects(unauthorized.ensureCollection(), QdrantError);
  assert.throws(() => new NoticesRepository({}, 'kmu_academic_profiles_v1'), /프로필/);
});
