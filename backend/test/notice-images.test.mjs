import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { imageCandidates, readNoticeImage } from '../src/db/notice-images.mjs';
import { toNoticeItem } from '../src/db/notices.mjs';
import { createServer } from '../src/server.mjs';
import { loadConfig } from '../src/config.mjs';
const id = '11111111-1111-5111-8111-111111111111';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKioAAAAASUVORK5CYII=', 'base64');

test('DB image URL uses point UUID and excludes unavailable/decorative/external references', () => {
  const payload = { notice: { id: 'cs-1', title: '공지', images: [
    { url: 'file:///C:/image.jpg', availability: 'unavailable' },
    { url: 'https://cs.kookmin.ac.kr/images/common/logo.png' },
    { url: 'https://kookmin.ac.kr.evil.com/poster.png' },
    { url: 'https://wfile.kookmin.ac.kr:8080/poster.png' },
    { url: 'http://wfile.kookmin.ac.kr/poster.png?type=image&amp;id=1' },
  ] } };
  assert.deepEqual(imageCandidates(payload), [{ src: 'https://wfile.kookmin.ac.kr/poster.png?type=image&id=1' }]);
  assert.equal(toNoticeItem(payload, id).imageUrl, `/api/db/notices/${id}/image`);
  assert.equal(toNoticeItem({ notice: { id: 'cs-1', title: '공지' } }, id).imageUrl, null);
});

test('local image is served by signature, with traversal and non-image files rejected', async t => {
  const root = await mkdtemp(join(tmpdir(), 'notice-images-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'imports/assets'), { recursive: true });
  await writeFile(join(root, 'imports/assets/poster.png'), png);
  await writeFile(join(root, 'imports/assets/not-image.png'), '<script>bad</script>');
  const payload = { assetDirectory: 'imports', notice: { images: [{ localPath: 'assets/poster.png' }] } };
  const result = await readNoticeImage(payload, { storageRoot: root });
  assert.equal(result.contentType, 'image/png');
  assert.deepEqual(result.bytes, png);
  payload.notice.images[0].localPath = 'assets/not-image.png';
  assert.equal(await readNoticeImage(payload, { storageRoot: root }), null);
  payload.notice.images[0].localPath = '../../outside.png';
  assert.equal(await readNoticeImage(payload, { storageRoot: root }), null);
});

test('broken remote poster tries next valid reference', async () => {
  const payload = { notice: { images: [{ url: 'https://wfile.kookmin.ac.kr/broken.png' }, { url: 'https://wfile.kookmin.ac.kr/good.png' }] } };
  const result = await readNoticeImage(payload, { remoteLoader: async src => { if (src.includes('broken')) throw new Error('404'); return { bytes: png, contentType: 'image/png' }; } });
  assert.deepEqual(result.bytes, png);
});

test('notice image endpoint returns bytes through the existing DB router', async t => {
  const server = createServer({ config: loadConfig(), repository: { client: {} }, notices: { image: async requested => { assert.equal(requested, id); return { bytes: png, contentType: 'image/png' }; } } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/api/db/notices/${id}/image`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
});
