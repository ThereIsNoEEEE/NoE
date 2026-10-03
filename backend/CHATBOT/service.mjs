import { ApiError } from '../src/http.mjs';
import { QdrantClient } from '../src/db/qdrant.mjs';
import { HttpEmbeddingProvider, HttpLlmProvider } from './providers.mjs';
import { QdrantRetriever } from './retriever.mjs';
import { profileSearchText, validateChatRequest, validateVector } from './schema.mjs';
import { buildMessages } from './prompt.mjs';

export class ChatbotService {
  constructor({ config, embedder, retriever, llm }) { Object.assign(this, { config, embedder, retriever, llm }); }
  status() {
    return { embeddingConfigured: this.embedder.isConfigured(), llmConfigured: this.llm.isConfigured(), defaultTopK: this.config.topK, modes: ['prepare', 'answer'], indexReadiness: 'not_checked' };
  }
  // Validation, embedding, search and prompt building shared by query() and startStream().
  async retrieve(input, signal) {
    const { prompt, topK, mode, profile } = validateChatRequest(input, this.config.topK);
    if (!this.embedder.isConfigured()) throw new ApiError(503, 'EMBEDDING_NOT_CONFIGURED', '질문을 벡터로 바꾸는 임베딩 API를 설정하세요.');
    // No embedding cost or DB traffic for an answer request with no LLM configured.
    if (mode === 'answer' && !this.llm.isConfigured()) throw new ApiError(503, 'LLM_NOT_CONFIGURED', 'LLM API 미등록 상태입니다. mode: prepare로 검색 문맥만 준비할 수 있습니다.');
    const profileText = profileSearchText(profile);
    const vector = validateVector(await this.embedder.embed(profileText ? `${prompt}\n(관심: ${profileText})` : prompt, { signal }));
    signal.throwIfAborted();
    const documents = await this.retriever.search(vector, topK, { signal });
    signal.throwIfAborted();
    const { sources, messages } = buildMessages(prompt, documents, this.config.maxContextChars, new Date(), profile);
    return { mode, sources, messages, metadata: { topK, retrievedCount: documents.length, contextCount: sources.length } };
  }

  async withImages(sources, signal) {
    const images = sources.length ? (await this.retriever.imageUrls?.(sources.map(source => source.rawPointId), { signal })) ?? {} : {};
    return sources.map(source => ({ ...source, imageUrl: images[source.rawPointId] || null }));
  }

  timeoutError(error, signal) {
    return signal.aborted && !(error instanceof ApiError && error.status < 500) ? new ApiError(504, 'CHATBOT_TIMEOUT', '챗봇 처리 시간 제한을 초과했습니다. 잠시 후 다시 시도하세요.') : error;
  }

  async query(input) {
    const signal = AbortSignal.timeout(this.config.requestTimeoutMs);
    try {
      const { mode, sources, messages, metadata } = await this.retrieve(input, signal);
      if (!sources.length) return { status: 'no_results', answer: NO_RESULTS_ANSWER, sources: [], ...metadata };
      if (mode === 'prepare') return { status: 'prepared', answer: null, sources, messages, ...metadata };
      const [answer, withImages] = await Promise.all([this.llm.generate(messages, { signal }), this.withImages(sources, signal)]);
      signal.throwIfAborted();
      return { status: 'answered', answer, sources: withImages, ...metadata };
    } catch (error) {
      if (signal.aborted) throw new ApiError(504, 'CHATBOT_TIMEOUT', '챗봇 처리 시간 제한을 초과했습니다. 잠시 후 다시 시도하세요.');
      throw error;
    }
  }

  // Streaming answer: errors up to retrieval throw (sent as a normal JSON error);
  // afterwards the caller gets the sources head and an async iterable of text chunks.
  async startStream(input, { signal: external } = {}) {
    const signal = external ? AbortSignal.any([external, AbortSignal.timeout(this.config.requestTimeoutMs)]) : AbortSignal.timeout(this.config.requestTimeoutMs);
    let retrieved;
    try {
      retrieved = await this.retrieve(input, signal);
    } catch (error) { throw this.timeoutError(error, signal); }
    const { sources, messages, metadata } = retrieved;
    const head = { status: sources.length ? 'answering' : 'no_results', sources: await this.withImages(sources, signal), ...metadata };
    const llm = this.llm, toTimeout = error => this.timeoutError(error, signal);
    async function* chunks() {
      if (!sources.length) { yield NO_RESULTS_ANSWER; return; }
      try { yield* llm.stream(messages, { signal }); }
      catch (error) { throw toTimeout(error); }
    }
    return { head, chunks: chunks() };
  }
}

const NO_RESULTS_ANSWER = '질문과 관련된 검색 자료를 찾지 못했습니다. 다른 키워드로 질문하거나 학교 원문을 확인해 주세요.';

export function createChatbotService(config) {
  const chatbot = config.chatbot;
  return new ChatbotService({ config: chatbot,
    embedder: new HttpEmbeddingProvider(chatbot.embedding, chatbot.timeoutMs),
    retriever: new QdrantRetriever(new QdrantClient(config.qdrant), chatbot),
    llm: new HttpLlmProvider(chatbot.llm, chatbot.timeoutMs, chatbot.maxOutputTokens),
  });
}
