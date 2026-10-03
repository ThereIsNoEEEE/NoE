import { loadChatbotConfig } from '../CHATBOT/config.mjs';

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 8001);
  const timeoutMs = Number(env.QDRANT_TIMEOUT_MS || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT는 1~65535 정수여야 합니다.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error('QDRANT_TIMEOUT_MS는 100~30000이어야 합니다.');
  const url = new URL(env.QDRANT_URL || 'http://127.0.0.1:6333');
  if (url.username || url.password || url.search || url.hash) throw new Error('QDRANT_URL에 인증 정보나 쿼리를 넣지 마세요.');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const allowInsecureHttp = env.QDRANT_ALLOW_INSECURE_HTTP === 'true';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (loopback || allowInsecureHttp))) throw new Error('원격 Qdrant는 HTTPS가 기본입니다. 제공된 HTTP 개발 서버는 QDRANT_ALLOW_INSECURE_HTTP=true를 명시해야 합니다.');
  const collection = env.QDRANT_COLLECTION || 'kmu_academic_profiles_v1';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(collection)) throw new Error('QDRANT_COLLECTION 이름이 유효하지 않습니다.');
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  for (const origin of allowedOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) throw new Error('개발용 CORS는 로컬 HTTP(S) origin만 허용합니다.');
  }
  const allowedHosts = ['127.0.0.1', 'localhost', '[::1]', ...(env.ALLOWED_HOSTS || '').split(',').map(x => x.trim()).filter(Boolean)];
  return { port, host: env.HOST || '127.0.0.1', allowedHosts, allowedOrigins, chatbot: loadChatbotConfig(env), qdrant: { url: url.href.replace(/\/$/, ''), apiKey: env.QDRANT_API_KEY || '', collection, timeoutMs, insecureRemote: !loopback && url.protocol === 'http:' } };
}
