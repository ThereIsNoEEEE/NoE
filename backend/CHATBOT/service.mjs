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
  async query(input) {
    const { prompt, topK, mode, profile } = validateChatRequest(input, this.config.topK);
    if (!this.embedder.isConfigured()) throw new ApiError(503, 'EMBEDDING_NOT_CONFIGURED', '질문을 벡터로 바꾸는 임베딩 API를 설정하세요.');
    // No embedding cost or DB traffic for an answer request with no LLM configured.
    if (mode === 'answer' && !this.llm.isConfigured()) throw new ApiError(503, 'LLM_NOT_CONFIGURED', 'LLM API 미등록 상태입니다. mode: prepare로 검색 문맥만 준비할 수 있습니다.');
    const signal = AbortSignal.timeout(this.config.requestTimeoutMs);
    try {
      const profileText = profileSearchText(profile);
      const vector = validateVector(await this.embedder.embed(profileText ? `${prompt}\n(관심: ${profileText})` : prompt, { signal }));
      signal.throwIfAborted();
      const documents = await this.retriever.search(vector, topK, { signal });
      signal.throwIfAborted();
      const { sources, messages } = buildMessages(prompt, documents, this.config.maxContextChars, new Date(), profile);
      const metadata = { topK, retrievedCount: documents.length, contextCount: sources.length };
      if (!sources.length) return { status: 'no_results', answer: '질문과 관련된 검색 자료를 찾지 못했습니다. 다른 키워드로 질문하거나 학교 원문을 확인해 주세요.', sources: [], ...metadata };
      if (mode === 'prepare') return { status: 'prepared', answer: null, sources, messages, ...metadata };
      const [answer, images] = await Promise.all([this.llm.generate(messages, { signal }), this.retriever.imageUrls?.(sources.map(source => source.rawPointId), { signal }) ?? {}]);
      signal.throwIfAborted();
      return { status: 'answered', answer, sources: sources.map(source => ({ ...source, imageUrl: images[source.rawPointId] || null })), ...metadata };
    } catch (error) {
      if (signal.aborted) throw new ApiError(504, 'CHATBOT_TIMEOUT', '챗봇 처리 시간 제한을 초과했습니다. 잠시 후 다시 시도하세요.');
      throw error;
    }
  }
}

export function createChatbotService(config) {
  const chatbot = config.chatbot;
  return new ChatbotService({ config: chatbot,
    embedder: new HttpEmbeddingProvider(chatbot.embedding, chatbot.timeoutMs),
    retriever: new QdrantRetriever(new QdrantClient(config.qdrant), chatbot),
    llm: new HttpLlmProvider(chatbot.llm, chatbot.timeoutMs, chatbot.maxOutputTokens),
  });
}
