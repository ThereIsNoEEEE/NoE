// 관심 분야 다중 선택 컴포넌트 (PRD 3장 관심 분야 예시)
// 기본 관심 분야 칩 + 사용자 직접 추가 관심 분야(삭제 가능)
import React, { useState } from 'react'

export const INTEREST_OPTIONS = [
  '취업',
  '인턴',
  '장학금',
  '공모전',
  'AI/데이터',
  '특강',
  '대학원',
  '수강신청',
  '교환학생',
  '교내행사',
]

// 중복 판정용 정규화: 소문자 + 앞뒤/내부 공백 제거
function normalizeInterest(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function InterestSelector({
  selected = [],
  customInterests = [],
  onChange,
  onAddCustom,
  onRemoveCustom,
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const toggle = (interest) => {
    if (selected.includes(interest)) {
      onChange(selected.filter((i) => i !== interest))
    } else {
      onChange([...selected, interest])
    }
  }

  const submitDraft = () => {
    const value = draft.trim()
    if (!value) return // 빈 문자열/공백만 → 추가하지 않음
    const norm = normalizeInterest(value)
    const existing = [...INTEREST_OPTIONS, ...customInterests]
    const isDuplicate = existing.some((i) => normalizeInterest(i) === norm)
    if (isDuplicate) {
      // 이미 존재하면 추가하지 않고, 선택 상태만 보장
      const match = existing.find((i) => normalizeInterest(i) === norm)
      if (match && !selected.includes(match)) onChange([...selected, match])
      setDraft('')
      setAdding(false)
      return
    }
    onAddCustom(value) // 저장 + 즉시 선택은 상위에서 처리
    setDraft('')
    setAdding(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitDraft()
    } else if (e.key === 'Escape') {
      setDraft('')
      setAdding(false)
    }
  }

  const removeCustom = (interest, e) => {
    e.stopPropagation() // 칩 토글과 분리
    onRemoveCustom(interest)
  }

  return (
    <div className="interest-selector">
      {INTEREST_OPTIONS.map((interest) => (
        <button
          type="button"
          key={interest}
          className={`chip ${selected.includes(interest) ? 'chip--active' : ''}`}
          aria-pressed={selected.includes(interest)}
          onClick={() => toggle(interest)}
        >
          {interest}
        </button>
      ))}

      {customInterests.map((interest) => (
        <span
          key={interest}
          className={`chip chip--custom ${selected.includes(interest) ? 'chip--active' : ''}`}
        >
          <button
            type="button"
            className="chip__label"
            aria-pressed={selected.includes(interest)}
            onClick={() => toggle(interest)}
          >
            {interest}
          </button>
          <button
            type="button"
            className="chip__remove"
            aria-label={`${interest} 삭제`}
            onClick={(e) => removeCustom(interest, e)}
          >
            ×
          </button>
        </span>
      ))}

      {adding ? (
        <span className="interest-add">
          <input
            type="text"
            className="interest-add__input"
            value={draft}
            autoFocus
            placeholder="예: 해커톤"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="interest-add__btn" onClick={submitDraft}>
            추가
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="chip chip--add"
          onClick={() => setAdding(true)}
        >
          + 관심 분야 추가
        </button>
      )}
    </div>
  )
}

export default InterestSelector
