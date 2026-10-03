"use client";

import * as React from "react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { HomeNoticeCard } from "./HomeNoticeCard";
import { ChatPanel } from "./ChatPanel";
export function HomeDashboard({
  top3: top3,
  savedIds: savedIds,
  onSave: onSave,
  onOpen: onOpen,
  tiles: tiles,
  onGo: onGo,
  profile: profile,
  ranked: ranked,
  who: who,
}) {
  return (
    <Fragment>
      <section aria-labelledby="homeTitle">
        <div className="section-head">
          <div>
            <div className="eyebrow">{"FOR YOU · TODAY"}</div>
            <h2 id="homeTitle" className="home-h">
              {"맞춤 공지"}
            </h2>
            <p>
              {who}
              {" 기준으로 오늘 놓치면 아쉬운 공지 TOP 3예요."}
            </p>
          </div>
          <Button
            variant="original"
            className="text-btn"
            onClick={() => onGo("notice")}
          >
            {"전체 보기 →"}
          </Button>
        </div>
        <div className="home-grid grid grid-cols-1 gap-4 min-[1121px]:grid-cols-3">
          {top3.map((p) => (
            <HomeNoticeCard
              key={`${p.notice.id}-${p.rank}`}
              item={p}
              saved={savedIds.includes(p.notice.id)}
              onSave={onSave}
              onOpen={onOpen}
            />
          ))}
          {top3.length === 0 && (
            <div
              className="empty-state show"
              style={{
                gridColumn: "1 / -1",
              }}
            >
              {
                "조건에 맞는 공지가 없어요. 설정에서 관심 분야·키워드를 늘려 보세요."
              }
            </div>
          )}
        </div>
      </section>
      <section className="tile-row" aria-label="바로가기">
        {tiles.map((p) => (
          <Button
            variant="original"
            key={`${p.view}-${p.label}`}
            className="tile"
            onClick={() => onGo(p.view)}
          >
            <span className="tile-label">{p.label}</span>
            <span className="tile-num">
              {String(p.value).padStart(2, "0")}
              <small>{p.unit}</small>
            </span>
            <span className="tile-note">{p.note}</span>
          </Button>
        ))}
      </section>
      <ChatPanel profile={profile} ranked={ranked} />
    </Fragment>
  );
}
