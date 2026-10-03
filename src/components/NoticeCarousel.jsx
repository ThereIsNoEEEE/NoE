// 관심 공지 캐러셀 (PRD 7장) — Top 3를 한 장씩 넘겨보는 premium card carousel
// 기존 추천 데이터(ranked)를 그대로 사용한다. 첫 슬라이드는 Opportunity Score 1위.
// 이미지는 imageService에서 가져오며 실패 시 category fallback. 로딩 중 skeleton 표시.
import React, { useEffect, useRef, useState } from 'react'
import { formatDDay } from '../utils/calculateDDay.js'
import { getNoticeImage } from '../services/imageService.js'

function SlideImage({ notice }) {
  const [img, setImg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setImg(null)
    getNoticeImage(notice)
      .then((res) => {
        if (!cancelled) {
          setImg(res.imageUrl)
          setLoading(false)
        }
      })
      .catch(() => {
        // 이미지 실패가 슬라이드/대시보드를 깨뜨리지 않도록 안전 처리
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [notice.id])

  return (
    <div className="slide__image">
      {loading && <div className="slide__image-skeleton" aria-hidden="true" />}
      {img && (
        <img
          className="slide__image-img"
          src={img}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <div className="slide__image-overlay" aria-hidden="true" />
    </div>
  )
}

function NoticeCarousel({ notices, today }) {
  const slides = (notices || []).slice(0, 3)
  const [index, setIndex] = useState(0)

  // Top 3가 바뀌었는데 현재 index가 범위를 벗어나면 0으로 초기화
  const slidesKey = slides.map((n) => n.id).join('|')
  const prevKey = useRef(slidesKey)
  useEffect(() => {
    if (prevKey.current !== slidesKey) {
      setIndex(0)
      prevKey.current = slidesKey
    }
  }, [slidesKey])
  useEffect(() => {
    if (index > slides.length - 1) setIndex(0)
  }, [index, slides.length])

  if (slides.length === 0) return null

  const current = slides[Math.min(index, slides.length - 1)]
  const dday = formatDDay(current.deadline, today)
  const isUrgent =
    dday && dday !== '마감' && (dday === 'D-DAY' || Number(dday.replace('D-', '')) <= 3)

  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length)
  const next = () => setIndex((i) => (i + 1) % slides.length)

  return (
    <section className="carousel">
      <div className="carousel__head">
        <h2 className="section-title">오늘 놓치면 아쉬운 공지</h2>
        <span className="carousel__counter">
          {index + 1} / {slides.length}
        </span>
      </div>

      <div className="carousel__frame">
        <button
          type="button"
          className="carousel__nav carousel__nav--prev"
          onClick={prev}
          aria-label="이전 공지"
        >
          ‹
        </button>

        <article className="slide" key={current.id}>
          <SlideImage notice={current} />

          <div className="slide__body">
            <div className="slide__badges">
              <span className="rank-badge">#{index + 1} 추천</span>
              <span className={`dday ${isUrgent ? 'dday--urgent' : ''}`}>
                {dday || '상시'}
              </span>
              <span className="slide__score">
                Opportunity <strong>{current.score}</strong>
              </span>
            </div>

            <h3 className="slide__title">{current.title}</h3>

            <div className="slide__cats">
              {(current.category || []).map((c) => (
                <span key={c} className="cat-tag">
                  {c}
                </span>
              ))}
            </div>

            {current.summary && (
              <p className="slide__summary">{current.summary}</p>
            )}

            {current.reason && (
              <div className="reason-box">
                <span className="reason-box__label">✨ AI 추천 이유</span>
                <span className="reason-box__text">{current.reason}</span>
              </div>
            )}

            <div className="slide__foot">
              <span className="slide__source">{current.sourceName}</span>
              {current.url && (
                <a
                  className="btn-link"
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  원문 보기 ↗
                </a>
              )}
            </div>
          </div>
        </article>

        <button
          type="button"
          className="carousel__nav carousel__nav--next"
          onClick={next}
          aria-label="다음 공지"
        >
          ›
        </button>
      </div>

      <div className="carousel__dots" role="tablist" aria-label="공지 슬라이드 위치">
        {slides.map((n, i) => (
          <button
            key={n.id}
            type="button"
            className={`dot ${i === index ? 'dot--active' : ''}`}
            aria-label={`${i + 1}번째 공지`}
            aria-selected={i === index}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  )
}

export default NoticeCarousel
