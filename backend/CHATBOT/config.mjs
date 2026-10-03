// Provider URLs are server-owned configuration, never taken from user requests.
export function loadChatbotConfig(env = process.env) {
  const integer = (key, fallback, min, max) => {
    const value = Number(env[key] || fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key}: ${min}~${max} 정수가 필요합니다.`);
    return value;
  };
  const endpoint = key => {
    if (!env[key]) return '';
    const url = new URL(env[key]);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error(`${key}: HTTPS 또는 로컬 HTTP URL이 필요합니다. 인증 키는 별도 환경 변수로 설정하세요.`);
    return url.href;
  };
  const collection = env.CHATBOT_COLLECTION || 'kmu_notice_chunks_v1';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(collection) || collection === (env.QDRANT_COLLECTION || 'kmu_academic_profiles_v1')) throw new Error('CHATBOT_COLLECTION은 학사 정보와 분리된 검색 전용 컬렉션이어야 합니다.');
  const threshold = env.CHATBOT_SCORE_THRESHOLD ? Number(env.CHATBOT_SCORE_THRESHOLD) : undefined;
  if (threshold !== undefined && (!Number.isFinite(threshold) || threshold < -1 || threshold > 1)) throw new Error('CHATBOT_SCORE_THRESHOLD는 -1~1 범위입니다.');
  const embeddingModel = env.CHATBOT_EMBEDDING_MODEL || '';
  const embeddingSpace = env.CHATBOT_EMBEDDING_SPACE || embeddingModel;
  const rawCollection = env.CHATBOT_RAW_COLLECTION || env.QDRANT_NOTICES_COLLECTION || 'kmu_notices_raw_v1';
  if (collection === (env.QDRANT_NOTICES_COLLECTION || 'kmu_notices_raw_v1')) throw new Error('CHATBOT_COLLECTION은 기존 공지 컬렉션과 분리해야 합니다.');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(rawCollection) || [collection, env.QDRANT_COLLECTION || 'kmu_academic_profiles_v1'].includes(rawCollection)) throw new Error('공지 원문, 검색 벡터, 학사 정보 컬렉션은 서로 달라야 합니다.');
  return {
    collection, rawCollection, vectorName: env.CHATBOT_VECTOR_NAME || '',
    topK: integer('CHATBOT_TOP_K', 10, 1, 20),
    timeoutMs: integer('CHATBOT_TIMEOUT_MS', 30000, 100, 60000),
    // Existing Next.js proxy waits 20 seconds; leave time to return a structured error.
    requestTimeoutMs: integer('CHATBOT_REQUEST_TIMEOUT_MS', 18000, 100, 19000),
    maxContextChars: integer('CHATBOT_MAX_CONTEXT_CHARS', 12000, 1000, 30000),
    maxOutputTokens: integer('CHATBOT_MAX_OUTPUT_TOKENS', 800, 1, 4096),
    threshold,
    embedding: { url: endpoint('CHATBOT_EMBEDDING_URL'), model: embeddingModel, space: embeddingSpace, apiKey: env.CHATBOT_EMBEDDING_API_KEY || '' },
    llm: { url: endpoint('CHATBOT_LLM_URL'), model: env.CHATBOT_LLM_MODEL || '', apiKey: env.CHATBOT_LLM_API_KEY || '' },
  };
}
