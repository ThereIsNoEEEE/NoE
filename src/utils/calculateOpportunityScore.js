// Opportunity Score 계산 (deterministic logic)
// PRD 8장 규칙:
//   - 관심사 일치도: 40점
//   - 지원 대상 적합성: 30점
//   - 마감 긴급도: 20점
//   - 관심 키워드 일치: 10점
//   총점 100점
//
// AI는 점수를 직접 결정하지 않는다. 동일 입력 → 동일 결과.

import { calculateDDay } from './calculateDDay.js'

const MAX_INTEREST = 40
const MAX_TARGET = 30
const MAX_DEADLINE = 20
const MAX_KEYWORD = 10

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s/·]+/g, '')
}

function hasAny(listA = [], listB = []) {
  const setB = new Set(listB.map(normalize))
  return listA.map(normalize).some((v) => v && setB.has(v))
}

function countMatches(listA = [], listB = []) {
  const setB = new Set(listB.map(normalize))
  let count = 0
  for (const v of listA.map(normalize)) {
    if (v && setB.has(v)) count += 1
  }
  return count
}

// 관심사 일치도 (40): 공지 카테고리와 사용자 관심 분야 교집합 비율
function interestScore(profile, notice) {
  const interests = profile.interests || []
  const categories = notice.category || []
  if (interests.length === 0 || categories.length === 0) return 0
  const matches = countMatches(categories, interests)
  if (matches === 0) return 0
  // 하나라도 맞으면 비율 기반 가점, 최소 50% 보장으로 상위권 유도
  const ratio = matches / categories.length
  return Math.round(MAX_INTEREST * Math.max(0.5, ratio))
}

// 지원 대상 적합성 (30): 사용자의 학적(학부/대학원)이 공지 대상에 포함되는지
function targetScore(profile, notice) {
  const targets = (notice.target || []).map(normalize)
  if (targets.length === 0) return Math.round(MAX_TARGET * 0.5) // 대상 미지정 공지는 중립 가점
  const studentType = normalize(profile.studentType)
  if (studentType && targets.includes(studentType)) return MAX_TARGET
  return 0
}

// 마감 긴급도 (20): 마감이 가까울수록 높음. deterministic 구간 매핑.
function deadlineScore(notice, today) {
  const dday = calculateDDay(notice.deadline, today)
  if (dday === null) return Math.round(MAX_DEADLINE * 0.25) // 마감 없음: 낮은 기본 가점
  if (dday < 0) return 0 // 이미 마감
  if (dday === 0) return MAX_DEADLINE // 오늘 마감
  if (dday <= 3) return 18
  if (dday <= 7) return 14
  if (dday <= 14) return 8
  return 4
}

// 관심 키워드 일치 (10): 사용자 키워드와 공지 키워드 교집합 유무
function keywordScore(profile, notice) {
  const matches = countMatches(profile.keywords || [], notice.keywords || [])
  if (matches === 0) return 0
  if (matches === 1) return 6
  return MAX_KEYWORD
}

/**
 * Opportunity Score와 세부 항목을 계산한다.
 * @param {object} profile - 사용자 프로필
 * @param {object} notice - AI 분석이 끝난 공지 (category, target, keywords, deadline 포함)
 * @param {string|Date} [today] - 기준 날짜
 * @returns {{ score: number, breakdown: object }}
 */
export function calculateOpportunityScore(profile, notice, today = new Date()) {
  const breakdown = {
    interest: interestScore(profile, notice),
    target: targetScore(profile, notice),
    deadline: deadlineScore(notice, today),
    keyword: keywordScore(profile, notice),
  }
  const score =
    breakdown.interest + breakdown.target + breakdown.deadline + breakdown.keyword
  return { score: Math.min(100, Math.max(0, score)), breakdown }
}

export { hasAny, countMatches }
export default calculateOpportunityScore
