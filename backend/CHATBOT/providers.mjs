import { ApiError } from '../src/http.mjs';
import { validateVector } from './schema.mjs';

// Vendor-neutral JSON adapter contract. Swap these adapters for a chosen SDK later.
// Embeddings: POST {model, input: string} -> {embedding: number[]}
// Generation: POST {model, messages, maxOutputTokens} -> {answer: string}
// format 'openai' maps the same calls to OpenAI's /v1/embeddings and /v1/chat/completions shapes.
async function postJson(config, body, timeoutMs, fetchImpl, kind, signal) {
  try {
    const response = await fetchImpl(config.url, {
      method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ApiError(502, `${kind}_API_ERROR`, `${kind} API 호출 실패. 서버의 연결 설정을 확인하세요.`);
    }
    // Bound memory consumption even for a broken provider response.
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) throw new ApiError(502, `${kind}_RESPONSE_INVALID`, '모델 응답 크기가 제한을 초과했습니다.');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
    throw new ApiError(timeout ? 504 : 502, `${kind}_${timeout ? 'TIMEOUT' : 'API_ERROR'}`, timeout ? '모델 응답 대기 시간이 초과되었습니다.' : '모델 연결 또는 응답 형식에 문제가 있습니다.');
  }
}

export class HttpEmbeddingProvider {
  constructor(config, timeoutMs, fetchImpl = fetch) { Object.assign(this, { config, timeoutMs, fetchImpl }); }
  isConfigured() { return Boolean(this.config.url && this.config.model && this.config.space); }
  async embed(text, { signal } = {}) {
    if (!this.isConfigured()) throw new ApiError(503, 'EMBEDDING_NOT_CONFIGURED', '임베딩 API URL과 모델을 먼저 설정하세요.');
    // Optional pacing for bulk indexing under provider rate limits (CHATBOT_EMBEDDING_MIN_INTERVAL_MS).
    const wait = (this.lastCallAt ?? 0) + (this.config.minIntervalMs || 0) - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    this.lastCallAt = Date.now();
    const result = await postJson(this.config, { model: this.config.model, input: text }, this.timeoutMs, this.fetchImpl, 'EMBEDDING', signal);
    return validateVector(this.config.format === 'openai' ? result?.data?.[0]?.embedding : result?.embedding);
  }
}

export class HttpLlmProvider {
  constructor(config, timeoutMs, maxOutputTokens, fetchImpl = fetch) { Object.assign(this, { config, timeoutMs, maxOutputTokens, fetchImpl }); }
  isConfigured() { return Boolean(this.config.url && this.config.model); }
  async generate(messages, { signal } = {}) {
    if (!this.isConfigured()) throw new ApiError(503, 'LLM_NOT_CONFIGURED', 'LLM API가 미등록 상태입니다. 검색 문맥만 확인하려면 mode: prepare를 사용하세요.');
    const openai = this.config.format === 'openai';
    const body = openai ? { model: this.config.model, messages, max_completion_tokens: this.maxOutputTokens } : { model: this.config.model, messages, maxOutputTokens: this.maxOutputTokens };
    const raw = await postJson(this.config, body, this.timeoutMs, this.fetchImpl, 'LLM', signal);
    const result = openai ? { answer: raw?.choices?.[0]?.message?.content } : raw;
    if (typeof result?.answer !== 'string' || !result.answer.trim() || result.answer.length > 30000) throw new ApiError(502, 'LLM_RESPONSE_INVALID', 'LLM이 유효한 텍스트 답변을 반환하지 않았습니다.');
    return result.answer.trim();
  }

  // Yields answer text chunks. OpenAI-compatible endpoints stream via SSE (stream: true);
  // the neutral JSON contract has no streaming, so it yields the whole answer once.
  async *stream(messages, { signal } = {}) {
    if (!this.isConfigured()) throw new ApiError(503, 'LLM_NOT_CONFIGURED', 'LLM API가 미등록 상태입니다. 검색 문맥만 확인하려면 mode: prepare를 사용하세요.');
    if (this.config.format !== 'openai') { yield await this.generate(messages, { signal }); return; }
    let total = 0;
    try {
      const response = await this.fetchImpl(this.config.url, {
        method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs),
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}) },
        body: JSON.stringify({ model: this.config.model, messages, max_completion_tokens: this.maxOutputTokens, stream: true }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiError(502, 'LLM_API_ERROR', 'LLM API 호출 실패. 서버의 연결 설정을 확인하세요.');
      }
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }
          const text = parsed?.choices?.[0]?.delta?.content;
          if (typeof text !== 'string' || !text) continue;
          total += text.length;
          if (total > 30000) throw new ApiError(502, 'LLM_RESPONSE_INVALID', 'LLM 답변이 길이 제한을 초과했습니다.');
          yield text;
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
      throw new ApiError(timeout ? 504 : 502, `LLM_${timeout ? 'TIMEOUT' : 'API_ERROR'}`, timeout ? '모델 응답 대기 시간이 초과되었습니다.' : '모델 연결 또는 응답 형식에 문제가 있습니다.');
    }
    if (!total) throw new ApiError(502, 'LLM_RESPONSE_INVALID', 'LLM이 유효한 텍스트 답변을 반환하지 않았습니다.');
  }
}
