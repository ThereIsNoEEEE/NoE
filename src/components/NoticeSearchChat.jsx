// AI 공지 찾기 (PRD 15장) — 자연어 질문 → AI 의도 분석 → 실제 공지 필터링 → Top 3~5 → 요약
// AI는 공지를 생성하지 않는다. props.notices(실제 데이터)만 검색 대상으로 사용한다.
import React, { useState } from 'react'
import NoticeCard from './NoticeCard.jsx'
import { analyzeQuery, buildActionPlan } from '../services/aiSearchService.js'
import { filterNotices } from '../utils/filterNotices.js'
import { formatDDay } from '../utils/calculateDDay.js'

const QUICK_PROMPTS = ['이번 주 마감', '취업/인턴', '장학금', 'AI/데이터', '공모전']
const RESULT_LIMIT = 5

// 공지 실행 비서 카드 — 대상/마감/핵심/준비물/해야 할 일(체크리스트)/원문
function ActionCard({ plan, today }) {
  const [checked, setChecked] = useState({})
  const dday = plan.dday || formatDDay(plan.deadline, today) || '상시/마감 미정'
  const toggle = (idx) => setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }))

  return (
    <article className="action-card">
      <h4 className="action-card__title">{plan.title}</h4>

      <dl className="action-card__meta">
        <div className="action-card__row">
          <dt>지원/참여 대상</dt>
          <dd>{plan.target}</dd>
        </div>
        <div className="action-card__row">
          <dt>마감일 / D-Day</dt>
          <dd>
            {plan.deadline ? `${plan.deadline} · ` : ''}
            <span className="action-card__dday">{dday}</span>
          </dd>
        </div>
        <div className="action-card__row">
          <dt>핵심 내용</dt>
          <dd>{plan.core}</dd>
        </div>
        <div className="action-card__row">
          <dt>준비해야 할 것</dt>
          <dd>{plan.preparations.join(', ')}</dd>
        </div>
      </dl>

      <div className="action-card__todo">
        <span className="action-card__todoLabel">해야 할 일</span>
        <ul className="checklist">
          {plan.checklist.map((item, idx) => (
            <li key={idx} className="checklist__item">
              <label className={checked[idx] ? 'checklist__label checklist__label--done' : 'checklist__label'}>
                <input
                  type="checkbox"
                  checked={!!checked[idx]}
                  onChange={() => toggle(idx)}
                />
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {plan.url && (
        <a
          className="btn-link"
          href={plan.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          원문 링크 ↗
        </a>
      )}
    </article>
  )
}

function NoticeSearchChat({ notices, today }) {
  const [query, setQuery] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [results, setResults] = useState(null) // null=검색 전, []=결과 없음
  const [actionPlan, setActionPlan] = useState(null) // 공지 실행 비서 결과
  const [searching, setSearching] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [intentFallback, setIntentFallback] = useState(false)

  async function runSearch(text) {
    const q = String(text ?? query).trim()
    if (!q) return
    setSearching(true)
    setActionPlan(null)
    setLastQuery(q)
    try {
      const { condition, usedFallback } = await analyzeQuery(q)
      setIntentFallback(usedFallback)
      // 코드가 실제 공지만 필터링 (AI 생성 없음)
      const found = filterNotices(notices, condition, today, RESULT_LIMIT)
      setResults(found)
    } finally {
      setSearching(false)
    }
  }

  async function runSummarize() {
    if (!results || results.length === 0) return
    setSummarizing(true)
    try {
      // 현재 검색된 공지들만 대상으로 실행 비서 결과 생성 (실제 데이터 근거)
      const plan = buildActionPlan(results, today)
      setActionPlan(plan)
    } finally {
      setSummarizing(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runSearch()
    }
  }

  const handleQuick = (prompt) => {
    setQuery(prompt)
    runSearch(prompt)
  }

  return (
    <section className="search-chat">
      <div className="search-chat__header">
        <h2 className="section-title">AI에게 공지를 물어보세요</h2>
        <p className="search-chat__desc">
          원하는 조건을 자연어로 입력하면 관련 공지만 찾아드립니다.
        </p>
      </div>

      <div className="search-chat__inputRow">
        <input
          type="text"
          className="search-chat__input"
          value={query}
          placeholder="예: AI 해커톤 중 이번 주 마감인 공지 찾아줘"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="search-chat__send"
          onClick={() => runSearch()}
          disabled={searching || !query.trim()}
        >
          {searching ? '검색 중…' : '전송'}
        </button>
      </div>

      <div className="search-chat__quick">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            className="quick-chip"
            onClick={() => handleQuick(p)}
            disabled={searching}
          >
            {p}
          </button>
        ))}
      </div>

      {lastQuery && (
        <div className="search-chat__lastQuery">
          <span className="search-chat__qlabel">질문</span> {lastQuery}
          {intentFallback && (
            <span className="status-badge status-badge--muted">
              keyword 검색 fallback
            </span>
          )}
        </div>
      )}

      {results !== null && (
        <div className="search-chat__results">
          {results.length === 0 ? (
            <div className="empty-state empty-state--sm">
              <p>현재 조건에 맞는 공지가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="search-chat__resultsHead">
                <span className="search-chat__count">
                  관련 공지 {results.length}건
                </span>
                <button
                  type="button"
                  className="summarize-btn"
                  onClick={runSummarize}
                  disabled={summarizing}
                >
                  {summarizing ? '정리 중…' : '✨ AI로 정리하기'}
                </button>
              </div>

              {actionPlan && actionPlan.length > 0 && (
                <div className="action-plan">
                  <div className="action-plan__head">
                    <span className="action-plan__title">🤖 공지 실행 비서</span>
                    <span className="action-plan__hint">
                      공지 원문에 근거한 내용만 정리합니다.
                    </span>
                  </div>
                  <div className="action-plan__cards">
                    {actionPlan.map((a) => (
                      <ActionCard key={a.id} plan={a} today={today} />
                    ))}
                  </div>
                </div>
              )}

              <div className="search-chat__cards">
                {results.map((n) => (
                  <NoticeCard key={n.id} notice={n} today={today} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default NoticeSearchChat
