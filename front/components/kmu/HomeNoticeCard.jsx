"use client";

import { NoticeImage } from "./NoticeImage";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "./SourceBadge";
import { DeadlineBadge } from "./DeadlineBadge";
export function HomeNoticeCard({
  item: item,
  saved: saved,
  onSave: onSave,
  onOpen: onOpen,
}) {
  var s;
  const { notice: notice, score: score, rank: rank } = item;
  return (
    <article className={`home-card rank-${rank}`}>
      <div className="home-rank">
        {"#"}
        {rank}
      </div>
      <div
        className="home-card-body"
        onClick={() => onOpen(item)}
        role="button"
        tabIndex={0}
        onKeyDown={(a) => {
          if (a.key === "Enter" || a.key === " ") {
            a.preventDefault();
            onOpen(item);
          }
        }}
      >
        <div className="source-row">
          <SourceBadge notice={notice} />
          <span>{notice.boardName || "공지"}</span>
          <span>{"·"}</span>
          <span>{notice.date}</span>
        </div>
        <h3>{notice.title}</h3>
        <div className="home-visual">
          <NoticeImage src={notice.imageUrl} title={notice.title} />
          <span className="hv-cat">
            {((s = notice.category) == null ? void 0 : s[0]) || "공지"}
          </span>
          <div className="hv-meta">
            <DeadlineBadge dday={score.dday} />
          </div>
          <div
            className="score-ring"
            style={{
              "--score": `${score.total}%`,
            }}
          >
            <strong>{score.total}</strong>
          </div>
        </div>
        <p className="ai-line">
          <b>{notice.analyzedBy === "ai" ? "AI 요약" : "내용 요약"}</b>
          {notice.summary}
        </p>
        <p className="ai-line reason">
          <b>{"추천 이유"}</b>
          {score.reason}
        </p>
      </div>
      <div className="card-actions flex flex-wrap gap-[7px]">
        <a
          className="btn-sm solid"
          href={notice.url}
          target="_blank"
          rel="noreferrer"
        >
          {"원문 보기"}
        </a>
        <Button
          variant="original"
          type="button"
          className={`btn-sm${saved ? " on" : ""}`}
          onClick={() => onSave(notice.id)}
        >
          {saved ? "저장됨" : "저장"}
        </Button>
      </div>
    </article>
  );
}
