import { ApiError } from '../src/http.mjs';

export function validateChatRequest(input, defaultTopK = 10) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', '질문 객체가 필요합니다.');
  if (Object.keys(input).some(key => !['prompt', 'topK', 'mode'].includes(key))) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'prompt, topK, mode만 허용합니다.');
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.prompt)) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'prompt는 1~4000자의 텍스트여야 합니다.');
  const topK = input.topK ?? defaultTopK, mode = input.mode ?? 'answer';
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'topK는 1~20 정수여야 합니다.');
  if (!['answer', 'prepare'].includes(mode)) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'mode는 answer 또는 prepare여야 합니다.');
  return { prompt: input.prompt.trim(), topK, mode };
}

export function validateVector(vector) {
  if (!Array.isArray(vector) || !vector.length || vector.length > 65536 || vector.some(x => typeof x !== 'number' || !Number.isFinite(x)) || !vector.some(x => x !== 0)) throw new ApiError(502, 'EMBEDDING_RESPONSE_INVALID', '임베딩 응답에 유효한 숫자 벡터가 없습니다.');
  return vector;
}
