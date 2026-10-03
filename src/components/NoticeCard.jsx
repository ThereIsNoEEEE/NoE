// 공지 카드 (PRD 14장) — 출처 배지, Opportunity Score, 카테고리, D-Day, 요약, 추천 이유
import React from 'react'
import { formatDDay } from '../utils/calculateDDay.js'

function ScoreRing({ score }) {
  let level = 'low'
  if (score >= 80) level = 'high'
  else if (score >= 50) level = 'mid'
  return (
    <div className={`score-ring score-ring--${level}`}>
      <span className="score-ring__value">{score}</span>
      <span className="score-ring__label">Score</span>
    </div>
  )
}

function SourceBadge({ sourceBadge }) {
  return <span className="badge badge--website">{sourceBadge}</span>
}

function NoticeCard({ notice, today, rank }) {
  const dday = formatDDay(notice.deadline, today)
  const isUrgent =
    dday && dday !== '마감' && (dday === 'D-DAY' || Number(dday.replace('D-', '')) <= 3)

  return (
    <article className="notice-card">
      <div className="notice-card__head">
        <div className="notice-card__badges">
          {typeof rank === 'number' && <span className="rank-badge">{rank}위</span>}
          <SourceBadge sourceBadge={notice.sourceBadge} />
          {dday && (
            <span className={`dday ${isUrgent ? 'dday--urgent' : ''}`}>{dday}</span>
          )}
        </div>
        <ScoreRing score={notice.score} />
      </div>

      <h3 className="notice-card__title">{notice.title}</h3>

      <div className="notice-card__categories">
        {(notice.category || []).map((c) => (
          <span key={c} className="cat-tag">
            {c}
          </span>
        ))}
      </div>

      {notice.summary && (
        <p className="notice-card__summary">
          <strong>AI 요약</strong> {notice.summary}
        </p>
      )}

      {notice.reason && (
        <p className="notice-card__reason">
          <strong>추천 이유</strong> {notice.reason}
        </p>
      )}

      <div className="notice-card__foot">
        <span className="notice-card__source">{notice.sourceName}</span>
        {notice.url && (
          <a
            className="notice-card__link"
            href={notice.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            원문 보기 ↗
          </a>
        )}
      </div>
    </article>
  )
}

export default NoticeCard
