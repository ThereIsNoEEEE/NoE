// KMU Pick AI — 한 화면 Dashboard
// 데이터 흐름: 홈페이지 크롤링 → 정규화 → AI 분석 → Opportunity Score → D-Day → 정렬 → Top 3
// 저장소: Supabase DB (미설정/실패 시 현재 세션 React State로 계속 동작)
// AI 공지 찾기: 자연어 질문 → 의도 분석 → 실제 공지 필터링 → 결과/요약
import React, { useEffect, useMemo, useState } from 'react'
import ProfilePanel from './components/ProfilePanel.jsx'
import SummaryPanel from './components/SummaryPanel.jsx'
import NoticeList from './components/NoticeList.jsx'
import NoticeCarousel from './components/NoticeCarousel.jsx'
import NoticeSearchChat from './components/NoticeSearchChat.jsx'
import { fetchWebsiteNotices, getDataMode } from './services/crawlerService.js'
import { analyzeNotices, buildRecommendationReason } from './services/aiService.js'
import { calculateOpportunityScore } from './utils/calculateOpportunityScore.js'
import { calculateDDay } from './utils/calculateDDay.js'
import { validateProfile, normalizeKeywords } from './utils/validation.js'
import { isSupabaseEnabled } from './services/supabaseClient.js'
import {
  fetchProfile,
  saveProfile,
  fetchInterests,
  addInterest,
  removeInterest,
} from './services/supabaseService.js'

// 데모 기준 날짜 고정 → D-Day/긴급도 계산이 결정적이다.
const TODAY = '2026-10-03'

function normalizeInterest(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

// 데모 기본 프로필: 국민대학교 AI 전공 대학원생
const DEFAULT_PROFILE = {
  studentType: '대학원',
  school: '소프트웨어융합대학원',
  major: 'AI',
  grade: '석사',
  interests: ['AI/데이터', '취업', '인턴', '공모전'],
  keywordsText: 'AI, 데이터, 해커톤',
}

export default function App() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [customInterests, setCustomInterests] = useState([]) // 사용자 직접 추가
  const [analyzed, setAnalyzed] = useState([]) // AI 분석된 공지 (프로필 무관)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [status, setStatus] = useState('') // 공지 수집 fallback 안내
  const [dbStatus, setDbStatus] = useState('') // DB 저장 상태 안내
  const [dataSource, setDataSource] = useState(() => ({
    mode: getDataMode(),
    usedFallback: false,
  })) // 데이터 소스 상태 (LIVE/DEMO)
  const [error, setError] = useState('')

  // 앱 실행 시: Supabase에서 프로필/관심 분야 로드 → 없거나 실패하면 기본값(세션) 사용
  useEffect(() => {
    let cancelled = false
    async function loadFromDb() {
      if (!isSupabaseEnabled()) {
        setDbStatus('Demo mode · 세션 저장')
        return
      }
      const [p, i] = await Promise.all([fetchProfile(), fetchInterests()])
      if (cancelled) return
      if (p.ok && p.data) setProfile((prev) => ({ ...prev, ...p.data }))
      if (i.ok && i.data) {
        setCustomInterests(i.data.custom || [])
        if (Array.isArray(i.data.selected) && i.data.selected.length) {
          setProfile((prev) => ({
            ...prev,
            interests: Array.from(
              new Set([...(prev.interests || []), ...i.data.selected])
            ),
          }))
        }
      }
      setDbStatus(
        !p.ok || !i.ok
          ? 'DB 연결 실패 · 현재 세션에서 계속 이용 가능'
          : 'Supabase 연결됨'
      )
    }
    loadFromDb()
    return () => {
      cancelled = true
    }
  }, [])

  // 사용자 직접 추가 관심 분야 등록: 세션 즉시 반영 + DB 저장 시도
  async function handleAddCustomInterest(value) {
    const trimmed = String(value || '').trim()
    if (!trimmed) return // 빈 문자열/공백만 → 추가하지 않음
    const norm = normalizeInterest(trimmed)
    const exists = customInterests.some((i) => normalizeInterest(i) === norm)
    if (exists) return // 중복(대소문자/공백 차이 포함) → 추가하지 않음

    setCustomInterests((prev) => [...prev, trimmed])
    setProfile((prev) => {
      const interests = prev.interests || []
      return interests.includes(trimmed)
        ? prev
        : { ...prev, interests: [...interests, trimmed] }
    })

    const res = await addInterest(trimmed, true)
    if (!res.ok && !res.disabled) {
      setDbStatus('DB 연결 실패 · 현재 세션에서 계속 이용 가능')
    }
  }

  // 사용자 직접 추가 관심 분야만 삭제: 세션 즉시 반영 + DB 삭제 시도
  async function handleRemoveCustomInterest(value) {
    setCustomInterests((prev) => prev.filter((i) => i !== value))
    setProfile((prev) => ({
      ...prev,
      interests: (prev.interests || []).filter((i) => i !== value),
    }))
    const res = await removeInterest(value)
    if (!res.ok && !res.disabled) {
      setDbStatus('DB 연결 실패 · 현재 세션에서 계속 이용 가능')
    }
  }

  // 수집 + 분석 (프로필과 무관한 단계). "내 공지 찾기" 시 실행.
  async function loadAndAnalyze() {
    const { valid, errors } = validateProfile({
      ...profile,
      interests: profile.interests,
    })
    if (!valid) {
      setError(errors.join(' '))
      return
    }
    setError('')
    setLoading(true)
    try {
      const { notices, usedFallback, mode } = await fetchWebsiteNotices()
      const { analyzed: analyzedNotices, usedMock } = await analyzeNotices(notices)
      setAnalyzed(analyzedNotices)
      setHasSearched(true)
      setDataSource({ mode, usedFallback })
      const parts = []
      if (mode === 'demo') parts.push('DEMO · Sample Data')
      else parts.push(usedFallback ? 'LIVE 연결 실패 · Sample Data' : '국민대학교 실제 공지 수집 완료')
      if (usedMock) parts.push('AI 분석: Local Mock')
      setStatus(parts.join(' · '))
      const res = await saveProfile(profile) // 저장 시도 (실패해도 계속)
      if (!res.ok && !res.disabled) {
        setDbStatus('DB 연결 실패 · 현재 세션에서 계속 이용 가능')
      }
    } catch (e) {
      setError('공지를 불러오지 못했습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setLoading(false)
    }
  }

  // 첫 로드시 데모가 바로 보이도록 자동 수집/분석
  useEffect(() => {
    loadAndAnalyze()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 프로필(또는 관심사/키워드)이 바뀌면 점수/추천이유/정렬을 즉시 재계산.
  const ranked = useMemo(() => {
    if (analyzed.length === 0) return []
    const selectedCustom = (profile.interests || []).filter((i) =>
      customInterests.includes(i)
    )
    const mergedKeywords = Array.from(
      new Set([...normalizeKeywords(profile.keywordsText), ...selectedCustom])
    )
    const profileForScore = { ...profile, keywords: mergedKeywords }
    return analyzed
      .map((notice) => {
        const { score, breakdown } = calculateOpportunityScore(
          profileForScore,
          notice,
          TODAY
        )
        return {
          ...notice,
          score,
          breakdown,
          reason: buildRecommendationReason(profileForScore, notice),
        }
      })
      .sort((a, b) => b.score - a.score)
  }, [analyzed, profile, customInterests])

  // 오늘의 요약 지표
  const summary = useMemo(() => {
    const recommended = ranked.filter((n) => n.score >= 50)
    const urgent = ranked.filter((n) => {
      const d = calculateDDay(n.deadline, TODAY)
      return d !== null && d >= 0 && d <= 3
    })
    const topScore = ranked.length ? ranked[0].score : 0
    return {
      totalCount: ranked.length,
      recommendedCount: recommended.length,
      urgentCount: urgent.length,
      topScore,
    }
  }, [ranked])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-logo">✦</span>
          <div className="app-header__text">
            <h1 className="app-title">KMU Pick AI</h1>
            <p className="app-subtitle">국민대 공지, 이제 다 읽지 마세요.</p>
          </div>
        </div>
        <div className="app-header__status">
          {(() => {
            // 데이터 소스 pill: LIVE(실제) / LIVE 폴백 / DEMO
            if (dataSource.mode === 'demo') {
              return (
                <span className="status-pill status-pill--demo">
                  DEMO · Sample Data
                </span>
              )
            }
            if (dataSource.usedFallback) {
              return (
                <span className="status-pill status-pill--warn">
                  LIVE 연결 대기 · Sample Data
                </span>
              )
            }
            return (
              <span className="status-pill status-pill--live">
                LIVE · 국민대 실제 공지
              </span>
            )
          })()}
          {dbStatus && (
            <span
              className={`status-pill ${
                dbStatus.includes('실패') ? 'status-pill--warn' : 'status-pill--muted'
              }`}
            >
              {dbStatus}
            </span>
          )}
        </div>
      </header>

      <div className="app-body">
        <ProfilePanel
          profile={profile}
          onChange={setProfile}
          onFindNotices={loadAndAnalyze}
          loading={loading}
          customInterests={customInterests}
          onAddCustomInterest={handleAddCustomInterest}
          onRemoveCustomInterest={handleRemoveCustomInterest}
        />

        <main className="main-panel">
          <SummaryPanel
            totalCount={summary.totalCount}
            recommendedCount={summary.recommendedCount}
            urgentCount={summary.urgentCount}
            topScore={summary.topScore}
            sourceInfo={status}
          />

          {error && <div className="alert alert--error">{error}</div>}

          {loading ? (
            <div className="empty-state">
              <p>공지를 수집하고 AI가 분석하는 중입니다…</p>
            </div>
          ) : hasSearched ? (
            <>
              <NoticeCarousel notices={ranked} today={TODAY} />
              <NoticeSearchChat notices={ranked} today={TODAY} />
              {ranked.length > 3 && (
                <section className="full-list">
                  <h2 className="section-title section-title--sub">전체 추천 공지</h2>
                  <NoticeList notices={ranked} today={TODAY} mode="restOnly" />
                </section>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>왼쪽에서 프로필과 관심 분야를 설정하고 “내 공지 찾기”를 눌러보세요.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
