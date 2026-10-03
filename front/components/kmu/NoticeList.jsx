"use client";

import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { NOTICE_FILTERS } from "@/data/profile";
import { TopNoticeCard } from "./TopNoticeCard";
import { NoticeListItem } from "./NoticeListItem";
export function NoticeList({
  top3: top3,
  ranked: ranked,
  savedIds: savedIds,
  onSave: onSave,
  onOpen: onOpen,
  filter: filter,
  onFilter: onFilter,
}) {
  const o = top3;
  const top3Ids = new Set(top3.map((p) => p.notice.id));
  const s = ranked.filter((p) => !top3Ids.has(p.notice.id));
  const a = (p) =>
    filter === "rec"
      ? p.score.total >= 60
      : filter === "urgent"
        ? p.score.dday !== null && p.score.dday <= 7
        : filter === "saved"
          ? savedIds.includes(p.notice.id)
          : !0;
  const f = filter === "all" ? s : ranked.filter(a);
  return (
    <Fragment>
      <section id="top3" aria-labelledby="top3Title">
        <div className="section-head">
          <div>
            <div className="eyebrow">{"FOR YOU · TODAY"}</div>
            <h2 id="top3Title">{"오늘 놓치면 아쉬운 공지 TOP 3"}</h2>
            <p>
              {
                "학적·관심 분야·키워드·마감일을 함께 반영한 Opportunity Score 순위예요."
              }
            </p>
          </div>
        </div>
        <div className="top-list">
          {o.map((p) => (
            <TopNoticeCard
              key={`${p.notice.id}-${p.rank}`}
              item={p}
              saved={savedIds.includes(p.notice.id)}
              onSave={onSave}
              onOpen={onOpen}
            />
          ))}
          {o.length === 0 && (
            <div className="empty-state show">
              {
                "조건에 맞는 공지가 없어요. 나의 정보에서 관심 분야·키워드를 늘리거나 새로고침해 보세요."
              }
            </div>
          )}
          {o.length > 0 && o.length < 3 && (
            <div className="empty-state show">
              {"조건에 맞는 공지가 적어요. 관심 분야를 늘리면 더 보여드릴게요."}
            </div>
          )}
        </div>
      </section>
      <section
        id="all-notices"
        className="list-head"
        aria-labelledby="allTitle"
      >
        <div className="section-head">
          <div>
            <div className="eyebrow">{"ALL NOTICES · BY SCORE"}</div>
            <h2 id="allTitle">
              {filter === "all" ? "나머지 공지" : "공지 목록"}
            </h2>
            <p>
              {
                "Opportunity Score 높은 순 · 카드를 누르면 점수 근거를 볼 수 있어요."
              }
            </p>
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label="공지 필터">
          {NOTICE_FILTERS.map((p) => (
            <Button
              variant="original"
              key={p.key}
              type="button"
              role="tab"
              aria-selected={filter === p.key}
              className={`tab${filter === p.key ? " active" : ""}`}
              onClick={() => onFilter(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="feed">
          {f.map((p) => (
            <NoticeListItem key={p.notice.id} item={p} onOpen={onOpen} />
          ))}
        </div>
        <div className={`empty-state${f.length === 0 ? " show" : ""}`}>
          {filter === "saved"
            ? "저장한 공지가 아직 없어요. 카드의 저장 버튼을 눌러 보세요."
            : "조건에 맞는 공지가 없어요."}
        </div>
      </section>
    </Fragment>
  );
}
