// Explicit operator action only. No automatic crawl/index/LLM calls at server startup.
import { readFile } from 'node:fs/promises';
import { loadConfig } from '../src/config.mjs';
import { getNotices } from '../src/crawler.mjs';
import { QdrantClient } from '../src/db/qdrant.mjs';
import { HttpEmbeddingProvider } from './providers.mjs';
import { NoticeIndexer } from './indexer.mjs';

try {
  const config = loadConfig();
  const embedder = new HttpEmbeddingProvider(config.chatbot.embedding, config.chatbot.timeoutMs);
  if (!embedder.isConfigured()) throw new Error('임베딩 API 설정 후 실행하세요.');
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--file')) throw new Error('사용법: index-notices.mjs [--file notices.json]');
  let notices;
  if (args[0] === '--file') {
    const file = await readFile(args[1]);
    if (file.length > 5 * 1024 * 1024) throw new Error('JSON 파일은 5MB 이하만 허용합니다.');
    const parsed = JSON.parse(file.toString('utf8'));
    notices = Array.isArray(parsed) ? parsed : parsed.items;
  } else {
    const result = await getNotices(true);
    if (result.mode === 'error') throw new Error('수집 실패로 색인을 중단했습니다.');
    if (result.mode === 'mixed') console.warn('일부 게시판만 수집됐습니다. 성공한 공지만 색인합니다.');
    notices = result.items;
  }
  const indexer = new NoticeIndexer({ client: new QdrantClient(config.qdrant), embedder, config: config.chatbot });
  console.log(JSON.stringify(await indexer.index(notices)));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
