import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { loadConfig } from '../src/config.mjs';
import { QdrantClient, QdrantError } from '../src/db/qdrant.mjs';
import { NoticesRepository, NOTICES_COLLECTION, prepareNotices } from '../src/db/notices.mjs';

export function canonicalUrl(raw) {
  const url = new URL(raw.replace(/&amp;/g, '&'));
  for (const key of [...url.searchParams.keys()]) if (['page', 'pn', 'article.offset', 'articleLimit'].includes(key) || key.startsWith('utm_')) url.searchParams.delete(key);
  url.hash = '';
  url.searchParams.sort();
  return url.href;
}
const genericTitle = title => /^(?:대학소개\s*About College|SW 학사공지|단과대학공지|경영대공지|공지사항|게시물 내용|학사공지)$/i.test(title.trim());
const decorative = url => /\/_res\/|\/images\/(?:common|mbl)\/|(?:logo|emblem|g-translate|ico_attach_file|ico_facebook|ico_youtube)/i.test(url);

export function mergeNotice(incoming, previous, collectedAt) {
  const warnings = [];
  const excludedAssets = [];
  const normalizeAssets = (entries = []) => entries.flatMap(entry => {
    const asset = typeof entry === 'string' ? { url: entry } : { ...entry };
    if (asset.url) asset.url = asset.url.replace(/&amp;/g, '&');
    if (asset.url && (decorative(asset.url) || /\/pdf\/2022_cba_br\.pdf/i.test(asset.url))) { excludedAssets.push(asset); return []; }
    return [{ ...asset, localPath: asset.localPath ?? null, text: asset.text ?? null, textStatus: asset.textStatus ?? 'not_processed' }];
  });
  const newImages = normalizeAssets(incoming.images);
  const newAttachments = normalizeAssets(incoming.attachments);
  if (incoming.contentStatus === 'extraction_failed') return { skip: 'extraction_failed' };
  if (genericTitle(incoming.title)) {
    if (!previous) return { skip: 'generic_title_without_existing_notice' };
    warnings.push('generic_title_preserved_existing');
  }
  let content = incoming.content ?? '';
  let contentHtml = incoming.contentHtml ?? '';
  let contentStatus = incoming.contentStatus;
  if (previous?.content?.trim() && (!content.trim() || content.length < previous.content.length * 0.7)) {
    content = previous.content;
    contentHtml = previous.contentHtml;
    contentStatus = previous.contentStatus;
    warnings.push('richer_existing_body_preserved');
  }
  const union = (oldAssets, newAssets) => {
    const entries = new Map();
    for (const asset of [...(oldAssets || []), ...newAssets]) {
      const key = asset.url?.replace(/&amp;/g, '&') || asset.localPath || asset.originalUrl;
      if (!key) continue;
      const old = entries.get(key);
      entries.set(key, old ? { ...asset, ...old } : asset);
    }
    return [...entries.values()];
  };
  const notice = {
    ...(previous || {}), ...incoming,
    sourceId: previous?.sourceId || incoming.sourceId || incoming.id.replace(/-[^-]+$/, ''),
    externalId: previous?.externalId || incoming.externalId || incoming.articleId,
    title: genericTitle(incoming.title) ? previous.title : incoming.title,
    url: canonicalUrl(incoming.url), content, contentHtml, contentStatus,
    images: union(previous?.images, newImages), attachments: union(previous?.attachments, newAttachments),
    collectedAt: incoming.collectedAt || collectedAt,
    updateWarnings: warnings,
    excludedAssetReferences: excludedAssets,
  };
  if (contentStatus === 'image_only' && !notice.images.length && !notice.attachments.length) return { skip: 'no_content_after_decorative_asset_filter' };
  notice.contentHash = createHash('sha256').update(JSON.stringify({ title: notice.title, content, contentHtml, images: notice.images, attachments: notice.attachments })).digest('hex');
  return { notice, warnings };
}

async function readAll(client) {
  const points = [];
  let offset;
  do {
    const result = await client.request('POST', `${client.collectionPath(NOTICES_COLLECTION)}/points/scroll`, { limit: 50, with_payload: true, with_vector: false, ...(offset ? { offset } : {}), filter: { must: [{ key: 'kind', match: { value: 'notice' } }] } });
    points.push(...result.points);
    offset = result.next_page_offset;
  } while (offset);
  return points;
}

export async function main(args = process.argv.slice(2)) {
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options: { write: { type: 'boolean' } } });
  if (positionals.length !== 1) throw new Error('사용법: node --env-file=.env scripts/update-notices.mjs <JSON> [--write]');
  const text = await readFile(resolve(positionals[0]), 'utf8');
  const input = JSON.parse(text);
  const rows = Array.isArray(input) ? input : input.notices || input.items;
  if (!Array.isArray(rows) || !rows.length) throw new Error('공지 배열이 없습니다.');
  const client = new QdrantClient(loadConfig().qdrant);
  const existing = await readAll(client);
  const byUrl = new Map(existing.map(point => [canonicalUrl(point.payload.notice.url), point]));
  const merged = [];
  const previousPoints = new Map();
  const skipped = [];
  const warnings = [];
  let newCount = 0;
  for (const incoming of rows) {
    const previous = byUrl.get(canonicalUrl(incoming.url));
    const result = mergeNotice(incoming, previous?.payload.notice, input.collectedAt || new Date().toISOString());
    if (result.skip) { skipped.push({ id: incoming.id, reason: result.skip }); continue; }
    merged.push(result.notice);
    if (previous) previousPoints.set(result.notice.id, previous); else newCount++;
    if (result.warnings.length) warnings.push({ id: incoming.id, reasons: result.warnings });
  }
  const prepared = prepareNotices(merged);
  if (prepared.errors.length) throw new Error(JSON.stringify(prepared.errors));
  for (const point of prepared.points) {
    const previous = previousPoints.get(point.payload.notice.id);
    if (previous) {
      point.id = previous.id;
      point.payload.assetDirectory = previous.payload.assetDirectory;
    }
    if (point.payload.notice.images.concat(point.payload.notice.attachments).some(asset => asset.localPath) && !previous) throw new Error('신규 로컬 파일은 import-notices.mjs로 먼저 가져와야 합니다.');
    point.payload.lastUpdatedAt = new Date().toISOString();
  }
  const report = { ...prepared.summary, inputCount: rows.length, beforeCount: existing.length, newCount, updatedCount: prepared.points.length - newCount, skipped, warnings };
  console.log(JSON.stringify({ mode: values.write ? 'write' : 'dry-run', ...report, skipped, warningsCount: warnings.length, warnings: undefined }, null, 2));
  if (!values.write) return;
  const backupStorage = fileURLToPath(new URL('../storage/updates/', import.meta.url));
  await mkdir(backupStorage, { recursive: true });
  const updateBatchId = createHash('sha256').update(text).digest('hex').slice(0, 16);
  await writeFile(resolve(backupStorage, `${updateBatchId}-before.json`), JSON.stringify(existing));
  const saved = await new NoticesRepository(client).save(prepared.points, (count, total) => { if (count % 25 === 0 || count === total) console.log(`저장 ${count}/${total}`); });
  for (let index = 0; index < prepared.points.length; index += 25) {
    const batch = prepared.points.slice(index, index + 25);
    const actual = await client.request('POST', `${client.collectionPath(NOTICES_COLLECTION)}/points`, { ids: batch.map(p => p.id), with_payload: true, with_vector: false });
    const found = new Map(actual.map(p => [p.id, p.payload]));
    for (const point of batch) {
      if (!isDeepStrictEqual(found.get(point.id), point.payload)) throw new Error(`저장 검증 실패: ${point.payload.notice.id}`);
    }
  }
  const count = await client.request('POST', `${client.collectionPath(NOTICES_COLLECTION)}/points/count`, { exact: true, filter: { must: [{ key: 'kind', match: { value: 'notice' } }] } });
  if (count.count !== existing.length + newCount) throw new Error('예상한 최종 건수와 다릅니다.');
  const storage = fileURLToPath(new URL('../storage/updates/', import.meta.url));
  await mkdir(storage, { recursive: true });
  const batchId = createHash('sha256').update(text).digest('hex').slice(0, 16);
  await writeFile(resolve(storage, `${batchId}-input.json`), text);
  await writeFile(resolve(storage, `${batchId}-report.json`), JSON.stringify({ ...report, saved, verifiedCount: saved, afterCount: count.count, verifiedAt: new Date().toISOString() }, null, 2)+'\n');
  console.log(JSON.stringify({ saved, verifiedCount: saved, finalCount: count.count, report: `storage/updates/${batchId}-report.json` }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof QdrantError ? `DB 요청 실패: HTTP ${error.status}` : error.message); process.exitCode = 1; });
