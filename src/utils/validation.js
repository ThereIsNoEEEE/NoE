// 사용자 입력 검증 유틸

export function validateProfile(profile) {
  const errors = []
  if (!profile) {
    return { valid: false, errors: ['프로필이 없습니다.'] }
  }
  if (!profile.studentType) {
    errors.push('학적을 선택하세요.')
  }
  if (!Array.isArray(profile.interests) || profile.interests.length === 0) {
    errors.push('관심 분야를 1개 이상 선택하세요.')
  }
  return { valid: errors.length === 0, errors }
}

export function normalizeKeywords(input) {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean)
  }
  return String(input || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default validateProfile
