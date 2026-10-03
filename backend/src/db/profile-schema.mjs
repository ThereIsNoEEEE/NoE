import { ApiError } from '../http.mjs';

export const PROFILE_FIELDS = ['studentType', 'college', 'major', 'grade', 'interests', 'customInterests', 'keywords'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateProfile(input) {
  const issues = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(422, 'VALIDATION_ERROR', '학사 정보 객체가 필요합니다.');
  for (const key of Object.keys(input)) if (!PROFILE_FIELDS.includes(key)) issues.push({ field: key, message: '허용되지 않은 필드입니다.' });
  const string = (value, field, max) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) {
      issues.push({ field, message: `비어 있지 않은 ${max}자 이하 문자열이 필요합니다.` });
      return '';
    }
    return value.trim().normalize('NFC');
  };
  const array = (value, field, min = 0) => {
    if (!Array.isArray(value) || value.length < min || value.length > 20) {
      issues.push({ field, message: `${min}~20개의 문자열 배열이 필요합니다.` }); return [];
    }
    const normalized = value.map((v, i) => string(v, `${field}[${i}]`, 50));
    return normalized.filter((v, i) => normalized.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);
  };
  if (!['학부', '대학원'].includes(input.studentType)) issues.push({ field: 'studentType', message: '학부 또는 대학원을 선택하세요.' });
  const maxGrade = input.studentType === '대학원' ? 3 : 4;
  if (!Number.isInteger(input.grade) || input.grade < 1 || input.grade > maxGrade) issues.push({ field: 'grade', message: `학년은 1~${maxGrade} 정수여야 합니다.` });
  const profile = {
    studentType: input.studentType,
    college: string(input.college, 'college', 100),
    major: string(input.major, 'major', 100),
    grade: input.grade,
    interests: array(input.interests, 'interests', 1),
    customInterests: array(input.customInterests ?? [], 'customInterests'),
    keywords: array(input.keywords ?? [], 'keywords'),
  };
  if (issues.length) throw new ApiError(422, 'VALIDATION_ERROR', '입력한 학사 정보를 확인해 주세요.', issues);
  return profile;
}

export function validateId(id) {
  if (!UUID.test(id)) throw new ApiError(400, 'INVALID_PROFILE_ID', '올바른 UUID 프로필 ID가 필요합니다.');
  return id.toLowerCase();
}
