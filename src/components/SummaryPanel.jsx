// 오늘의 요약 패널 (PRD 14장 오른쪽 상단)
import React from 'react'

function SummaryPanel({ totalCount, recommendedCount, urgentCount, topScore, sourceInfo }) {
  return (
    <section className="summary-panel">
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-value">{totalCount}</div>
          <div className="summary-label">전체 공지</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{recommendedCount}</div>
          <div className="summary-label">추천 공지</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{urgentCount}</div>
          <div className="summary-label">마감 임박</div>
        </div>
        <div className="summary-card summary-card--accent">
          <div className="summary-value">{topScore}</div>
          <div className="summary-label">최고 Score</div>
        </div>
      </div>
      {sourceInfo && <p className="source-info">{sourceInfo}</p>}
    </section>
  )
}

export default SummaryPanel
