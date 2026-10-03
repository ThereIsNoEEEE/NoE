"use client";

import * as React from "react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { formatDDay } from "@/lib/dates";
import { SCORE_WEIGHTS } from "@/lib/recommendations";
import { SCORE_LABELS } from "@/data/profile";
import { SourceBadge } from "./SourceBadge";
export function NoticeDetail({
  item: item,
  saved: saved,
  onSave: onSave,
  onClose: onClose,
}) {
  var o;
  React.useEffect(() => {
    if (!item) return;
    const s = (a) => {
      if (a.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", s);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", s);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);
  const l = item == null ? void 0 : item.notice;
  const i = item == null ? void 0 : item.score;
  return (
    <div
      className={`drawer-backdrop${item ? " open" : ""}`}
      aria-hidden={!item}
      onClick={(s) => {
        if (s.target === s.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawerTitle"
      >
        <Button
          variant="original"
          className="drawer-close"
          onClick={onClose}
          aria-label="상세 정보 닫기"
        >
          {"×"}
        </Button>
        {item && (
          <Fragment>
            <div
              className="source-row"
              style={{
                marginTop: 22,
              }}
            >
              <SourceBadge notice={l} />
              <span>{l.sourceName}</span>
            </div>
            <h2 id="drawerTitle">{l.title}</h2>
            <p className="ai-line">
              <b
                style={{
                  color: "var(--green)",
                }}
              >
                {"요약"}
              </b>{" "}
              {l.summary}
            </p>
            <p className="ai-line reason">
              <b
                style={{
                  color: "var(--accent)",
                }}
              >
                {"추천 이유"}
              </b>{" "}
              {i.reason}
            </p>
            <div className="detail-box">
              <div className="detail-row">
                <span>{"Opportunity Score"}</span>
                <strong>
                  {i.total}
                  {" / 100"}
                </strong>
              </div>
              <div className="detail-row">
                <span>{"게시일"}</span>
                <strong>{l.date || "-"}</strong>
              </div>
              <div className="detail-row">
                <span>{"마감"}</span>
                <strong>
                  {l.deadline
                    ? `${l.deadline} (${formatDDay(i.dday)})`
                    : "상시 / 미표기"}
                </strong>
              </div>
              <div className="detail-row">
                <span>{"지원 대상"}</span>
                <strong>
                  {(l.target || []).join(" · ") || "명시 없음"}
                  {(o = l.grades) != null && o.length
                    ? ` · ${l.grades.join(",")}학년`
                    : ""}
                </strong>
              </div>
              <div className="detail-row">
                <span>{"분석 방식"}</span>
                <strong>
                  {l.analyzedBy === "ai" ? "AI 분석" : "규칙 기반"}
                </strong>
              </div>
            </div>
            <div
              className="eyebrow"
              style={{
                marginBottom: 10,
              }}
            >
              {"SCORE BREAKDOWN"}
            </div>
            <div className="bar-list">
              {SCORE_LABELS.map(([s, a]) => (
                <div key={s} className="bar-row">
                  <div className="progress-label">
                    <span>{a}</span>
                    <strong>
                      {i.parts[s]}
                      {" / "}
                      {SCORE_WEIGHTS[s]}
                    </strong>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${(i.parts[s] / SCORE_WEIGHTS[s]) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {l.content && (
              <div className="detail-box">
                <div
                  className="eyebrow"
                  style={{
                    marginBottom: 8,
                  }}
                >
                  {"본문 미리보기"}
                </div>
                <p className="excerpt">
                  {l.content.slice(0, 600)}
                  {l.content.length > 600 ? "…" : ""}
                </p>
              </div>
            )}
            <div className="drawer-actions">
              <a
                className="btn-sm solid"
                href={l.url}
                target="_blank"
                rel="noreferrer"
              >
                {"원문 보기"}
              </a>
              <Button
                variant="original"
                type="button"
                className={`btn-sm${saved ? " on" : ""}`}
                onClick={() => onSave(l.id)}
              >
                {saved ? "저장 취소" : "관심 공지로 저장"}
              </Button>
            </div>
          </Fragment>
        )}
      </section>
    </div>
  );
}
