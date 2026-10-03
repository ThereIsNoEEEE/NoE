"use client";

import { SourceBadge } from "./SourceBadge";
import { DeadlineBadge } from "./DeadlineBadge";
export function NoticeListItem({ item: item, onOpen: onOpen }) {
  var i;
  const { notice: notice, score: score, rank: rank } = item;
  return (
    <article
      className="feed-card"
      onClick={() => onOpen(item)}
      tabIndex={0}
      onKeyDown={(o) => {
        if (o.key === "Enter") {
          onOpen(item);
        }
      }}
    >
      <div className="rank-sm">{rank}</div>
      <div className="feed-copy">
        <div className="source-row">
          <SourceBadge notice={notice} />
          <span>{notice.boardName || "공지"}</span>
          <span>{"·"}</span>
          <span>{notice.date}</span>
          {(i = notice.category) == null
            ? void 0
            : i.slice(0, 2).map((o) => (
                <span key={o}>
                  {"#"}
                  {o}
                </span>
              ))}
        </div>
        <h3>{notice.title}</h3>
        <p className="reason">
          {"추천 이유 · "}
          {score.reason}
        </p>
      </div>
      <div className="meta">
        <DeadlineBadge dday={score.dday} />
        <span className="score-mini">
          {"SCORE "}
          <b>{score.total}</b>
        </span>
      </div>
    </article>
  );
}
