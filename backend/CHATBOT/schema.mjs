import { ApiError } from '../src/http.mjs';
import { PROFILE_FIELDS, validateProfile } from '../src/db/profile-schema.mjs';

export function validateChatRequest(input, defaultTopK = 10) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', '질문 객체가 필요합니다.');
  if (Object.keys(input).some(key => !['prompt', 'topK', 'mode', 'profile', 'stream'].includes(key))) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'prompt, topK, mode, profile, stream만 허용합니다.');
  if (input.stream !== undefined && typeof input.stream !== 'boolean') throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'stream은 true 또는 false여야 합니다.');
  if (input.stream === true && input.mode === 'prepare') throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'stream은 answer 모드에서만 사용할 수 있습니다.');
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.prompt)) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'prompt는 1~4000자의 텍스트여야 합니다.');
  const topK = input.topK ?? defaultTopK, mode = input.mode ?? 'answer';
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'topK는 1~20 정수여야 합니다.');
  if (!['answer', 'prepare'].includes(mode)) throw new ApiError(422, 'CHATBOT_INPUT_INVALID', 'mode는 answer 또는 prepare여야 합니다.');
  return { prompt: input.prompt.trim(), topK, mode, profile: chatProfile(input.profile) };
}

export function validateVector(vector) {
  if (!Array.isArray(vector) || !vector.length || vector.length > 65536 || vector.some(x => typeof x !== 'number' || !Number.isFinite(x)) || !vector.some(x => x !== 0)) throw new ApiError(502, 'EMBEDDING_RESPONSE_INVALID', '임베딩 응답에 유효한 숫자 벡터가 없습니다.');
  return vector;
}

// Optional "나의 정보" for personalised answers. Same rules as saved profiles; an
// incomplete profile is dropped instead of failing the question.
export function chatProfile(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  try { return validateProfile(Object.fromEntries(PROFILE_FIELDS.filter(key => key in input).map(key => [key, input[key]]))); }
  catch { return null; }
}

// Profile terms appended to the search query so "추천해줘"-style questions retrieve relevant notices.
export function profileSearchText(profile) {
  if (!profile) return '';
  return [profile.major, ...profile.interests, ...profile.customInterests, ...profile.keywords].filter(Boolean).join(', ');
}
