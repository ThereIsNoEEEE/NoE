// D-Day 계산 (deterministic)
// 기준 날짜(today)를 명시적으로 주입할 수 있어 테스트/데모에서 결정적이다.

function toMidnight(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * 마감일까지 남은 일수를 계산한다.
 * @param {string|Date|null} deadline - "YYYY-MM-DD" 또는 Date
 * @param {string|Date} [today] - 기준 날짜 (기본: 현재)
 * @returns {number|null} 남은 일수. 마감 없음이면 null.
 */
export function calculateDDay(deadline, today = new Date()) {
  if (!deadline) return null
  const end = toMidnight(deadline)
  const base = toMidnight(today)
  if (Number.isNaN(end.getTime())) return null
  const diffMs = end.getTime() - base.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * D-Day 라벨 문자열을 반환한다. (D-3, D-DAY, 마감 등)
 * @param {string|Date|null} deadline
 * @param {string|Date} [today]
 * @returns {string|null}
 */
export function formatDDay(deadline, today = new Date()) {
  const days = calculateDDay(deadline, today)
  if (days === null) return null
  if (days === 0) return 'D-DAY'
  if (days < 0) return '마감'
  return `D-${days}`
}

export default calculateDDay
