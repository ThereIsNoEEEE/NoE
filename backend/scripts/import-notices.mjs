import { readFile, stat, realpath, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { loadConfig } from '../src/config.mjs';
import { QdrantClient, QdrantError } from '../src/db/qdrant.mjs';
import { NOTICES_COLLECTION, NoticesRepository, prepareNotices } from '../src/db/notices.mjs';

export async function loadImport(inputPath) {
  let path = resolve(inputPath);
  if ((await stat(path)).isDirectory()) path = resolve(path, 'notices.json');
  if ((await stat(path)).size > 100 * 1024 * 1024) throw new Error('JSON 파일은 100MB 이하여야 합니다.');
  const text = await readFile(path, 'utf8');
  const prepared = prepareNotices(JSON.parse(text.replace(/^\uFEFF/, '')));
  const directory = await realpath(dirname(path));
  const datasetId = createHash('sha256').update(text).digest('hex').slice(0, 16);
  const files = new Map();
  for (const point of prepared.points) {
    for (const asset of [...point.payload.notice.images, ...point.payload.notice.attachments]) {
      if (!asset.localPath) continue;
      const localPath = asset.localPath.replace(/\\/g, '/');
      if (isAbsolute(localPath) || /^[A-Za-z]:/.test(localPath) || localPath.split('/').includes('..')) throw new Error(`허용되지 않는 파일 경로: ${point.payload.notice.id}`);
      const source = await realpath(resolve(directory, localPath));
      const rel = relative(directory, source);
      if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || !(await stat(source)).isFile()) throw new Error(`데이터 폴더 밖의 파일입니다: ${point.payload.notice.id}`);
      files.set(localPath, source);
    }
    point.payload.assetDirectory = `imports/${datasetId}`;
  }
  return { ...prepared, path, directory, datasetId, files };
}

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { 'dry-run': { type: 'boolean' }, write: { type: 'boolean' }, collection: { type: 'string', default: NOTICES_COLLECTION }, 'storage-dir': { type: 'string', default: fileURLToPath(new URL('../storage/', import.meta.url)) } } });
  if (positionals.length !== 1 || values.write && values['dry-run']) throw new Error('사용법: npm run import:notices -- <폴더 또는 JSON> [--dry-run | --write]');
  const prepared = await loadImport(positionals[0]);
  console.log(JSON.stringify({ mode: values.write ? 'write' : 'dry-run', collection: values.collection, ...prepared.summary, localAssetCount: prepared.files.size, errors: prepared.errors }, null, 2));
  if (prepared.errors.length) throw new Error('검증 오류가 있어 DB에 저장하지 않습니다.');
  if (!values.write) {
    console.log('검증 완료. DB 접속·저장·파일 복사를 실행하지 않았습니다. 실제 저장은 --write로 실행하세요.');
    return;
  }
  const config = loadConfig();
  if (values.collection === config.qdrant.collection) throw new Error('프로필 컬렉션을 공지 저장에 사용할 수 없습니다.');
  const repository = new NoticesRepository(new QdrantClient(config.qdrant), values.collection);
  // Verify DB configuration before copying assets. Never alter an incompatible collection.
  await repository.ensureCollection();
  for (const [localPath, source] of prepared.files) {
    const destination = resolve(values['storage-dir'], 'imports', prepared.datasetId, localPath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  let saved = 0;
  try {
    saved = await repository.save(prepared.points, count => {
      saved = count;
      if (count % 25 === 0 || count === prepared.points.length) console.log(`저장 ${count}/${prepared.points.length}`);
    });
  } catch (error) {
    console.error(`저장 완료 확인 ${saved}/${prepared.points.length}건. 현재 실패한 요청은 서버에서 완료됐을 수 있습니다. 같은 파일로 재실행하면 고정 ID로 갱신됩니다.`);
    throw error;
  }
  console.log(`DB 저장 완료: ${saved}건. 이미지 파일은 ${resolve(values['storage-dir'], 'imports', prepared.datasetId)}에 보존했습니다.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof QdrantError ? `DB 연결·저장 실패 (HTTP ${error.status || '연결 오류'}). 서버 .env의 주소·키를 확인하세요.` : error.message);
    process.exitCode = 1;
  });
}
