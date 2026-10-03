// 공지 목록 — 모드별 렌더링
//  - 기본(full): TOP 3 강조 + 그 외 목록 (레거시 호환)
//  - restOnly: Top 3를 제외한 나머지 공지만 카드 그리드로 표시 (캐러셀과 함께 사용)
import React from 'react'
import NoticeCard from './NoticeCard.jsx'

function NoticeList({ notices, today, mode = 'full' }) {
  if (!notices || notices.length === 0) {
    if (mode === 'restOnly') return null
    return (
      <div className="empty-state">
        <p>왼쪽에서 프로필과 관심 분야를 설정하고 “내 공지 찾기”를 눌러보세요.</p>
      </div>
    )
  }

  if (mode === 'restOnly') {
    const rest = notices.slice(3)
    if (rest.length === 0) return null
    return (
      <div className="notice-grid">
        {rest.map((notice) => (
          <NoticeCard key={notice.id} notice={notice} today={today} />
        ))}
      </div>
    )
  }

  const top3 = notices.slice(0, 3)
  const rest = notices.slice(3)

  return (
    <div className="notice-list">
      <h2 className="section-title">오늘 놓치면 아쉬운 공지 TOP 3</h2>
      <div className="notice-list__top">
        {top3.map((notice, idx) => (
          <NoticeCard key={notice.id} notice={notice} today={today} rank={idx + 1} />
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <h2 className="section-title section-title--sub">그 외 추천 공지</h2>
          <div className="notice-list__rest">
            {rest.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} today={today} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default NoticeList
