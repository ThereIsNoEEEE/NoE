// 사용자 프로필 설정 패널 (PRD 14장 왼쪽 영역)
import React from 'react'
import InterestSelector from './InterestSelector.jsx'

const STUDENT_TYPES = ['학부', '대학원']

const SCHOOL_OPTIONS = [
  '소프트웨어융합대학',
  '소프트웨어융합대학원',
  '경영대학',
  '공과대학',
  '사회과학대학',
  '예술대학',
  '일반대학원',
  '기타',
]

const GRADE_OPTIONS = ['1학년', '2학년', '3학년', '4학년', '석사', '박사']

function ProfilePanel({
  profile,
  onChange,
  onFindNotices,
  loading,
  customInterests = [],
  onAddCustomInterest,
  onRemoveCustomInterest,
}) {
  const update = (patch) => onChange({ ...profile, ...patch })

  return (
    <aside className="profile-panel">
      <h2 className="panel-title">내 프로필</h2>

      <label className="field">
        <span className="field-label">학적</span>
        <div className="segment">
          {STUDENT_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className={`segment-btn ${profile.studentType === type ? 'segment-btn--active' : ''}`}
              onClick={() => update({ studentType: type })}
            >
              {type}
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span className="field-label">소속 단과대학 / 대학원</span>
        <select
          value={profile.school || ''}
          onChange={(e) => update({ school: e.target.value })}
        >
          <option value="">선택</option>
          {SCHOOL_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">전공</span>
        <input
          type="text"
          placeholder="예: AI"
          value={profile.major || ''}
          onChange={(e) => update({ major: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field-label">학년</span>
        <select
          value={profile.grade || ''}
          onChange={(e) => update({ grade: e.target.value })}
        >
          <option value="">선택</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field-label">관심 분야</span>
        <InterestSelector
          selected={profile.interests || []}
          customInterests={customInterests}
          onChange={(interests) => update({ interests })}
          onAddCustom={onAddCustomInterest}
          onRemoveCustom={onRemoveCustomInterest}
        />
      </div>

      <label className="field">
        <span className="field-label">관심 키워드 (쉼표로 구분)</span>
        <input
          type="text"
          placeholder="예: AI, 데이터, 해커톤"
          value={profile.keywordsText ?? ''}
          onChange={(e) => update({ keywordsText: e.target.value })}
        />
      </label>

      <button
        type="button"
        className="find-btn"
        onClick={onFindNotices}
        disabled={loading}
      >
        {loading ? '분석 중…' : '내 공지 찾기'}
      </button>
    </aside>
  )
}

export default ProfilePanel
