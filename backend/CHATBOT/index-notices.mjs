// Explicit operator action only. No automatic crawl/index/LLM calls at server startup.
import { readFile, stat } from 'node:fs/promises';
import { loadConfig } from '../src/config.mjs';
import { getNotices } from '../src/crawler.mjs';
import { QdrantClient } from '../src/db/qdrant.mjs';
import { HttpEmbeddingProvider } from './providers.mjs';
import { NoticeIndexer } from './indexer.mjs';
import { readRawNoticeBatches } from './raw-notices.mjs';

try {
  const config = loadConfig();
  const embedder = new HttpEmbeddingProvider(config.chatbot.embedding, config.chatbot.timeoutMs);
  if (!embedder.isConfigured()) throw new Error('임베딩 API 설정 후 실행하세요.');
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--file') && !(args.length === 1 && args[0] === '--crawl')) throw new Error('사용법: index-notices.mjs [--file notices.json | --crawl] (기본: 원문 DB)');
  const client = new QdrantClient(config.qdrant);
  const indexer = new NoticeIndexer({ client, embedder, config: config.chatbot });
  if (!args.length) {
    let indexedNotices = 0, skippedNotices = 0, indexedChunks = 0;
    for await (const batch of readRawNoticeBatches(client, config.chatbot.rawCollection)) {
      const result = await indexer.index(batch);
      indexedNotices += result.indexedNotices; skippedNotices += result.skippedNotices; indexedChunks += result.indexedChunks;
      console.log(JSON.stringify({ indexedNotices, skippedNotices, indexedChunks, collection: config.chatbot.collection }));
    }
    console.log(JSON.stringify({ complete: true, indexedNotices, skippedNotices, indexedChunks }));
    process.exitCode = 0;
  } else {
  let notices;
  if (args[0] === '--file') {
    if ((await stat(args[1])).size > 5 * 1024 * 1024) throw new Error('JSON 파일은 5MB 이하만 허용합니다.');
    const file = await readFile(args[1]);
    if (file.length > 5 * 1024 * 1024) throw new Error('JSON 파일은 5MB 이하만 허용합니다.');
    const parsed = JSON.parse(file.toString('utf8').replace(/^\uFEFF/, ''));
    notices = Array.isArray(parsed) ? parsed : parsed.notices ?? parsed.items;
  } else {
    const result = await getNotices(true);
    if (result.mode === 'error') throw new Error('수집 실패로 색인을 중단했습니다.');
    if (result.mode === 'mixed') console.warn('일부 게시판만 수집됐습니다. 성공한 공지만 색인합니다.');
    notices = result.items;
  }
  console.log(JSON.stringify(await indexer.index(notices)));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
