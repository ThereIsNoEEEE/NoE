"use client";

import { NoticeImage } from "./NoticeImage";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "./SourceBadge";
import { DeadlineBadge } from "./DeadlineBadge";
export function TopNoticeCard({
  item: item,
  saved: saved,
  onSave: onSave,
  onOpen: onOpen,
}) {
  var s;
  const { notice: notice, score: score, rank: rank } = item;
  return (
    <article className={`top-card rank-${rank}`}>
      <div className="rank" aria-label={`${rank}위`}>
        {String(rank).padStart(2, "0")}
      </div>
      <div className="top-body">
        <div className="source-row">
          <SourceBadge notice={notice} />
          <span>{notice.boardName || "공지"}</span>
          <span>{"·"}</span>
          <span>{notice.date || "날짜 미상"}</span>
        </div>
        <h3>{notice.title}</h3>
        {((s = notice.category) == null ? void 0 : s.length) > 0 && (
          <div className="cat-row">
            {notice.category.map((a) => (
              <span key={a} className="cat">
                {a}
              </span>
            ))}
          </div>
        )}
        <p className="ai-line">
          <b>{notice.analyzedBy === "ai" ? "AI 요약" : "요약"}</b>
          {notice.summary}
        </p>
        <p className="ai-line reason">
          <b>{"추천 이유"}</b>
          {score.reason}
        </p>
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
            className="btn-sm"
            onClick={() => onOpen(item)}
          >
            {"점수 근거"}
          </Button>
          <Button
            variant="original"
            type="button"
            className={`btn-sm${saved ? " on" : ""}`}
            onClick={() => onSave(notice.id)}
            aria-pressed={saved}
          >
            {saved ? "저장됨" : "저장"}
          </Button>
        </div>
      </div>
      {notice.imageUrl ? (
        <div className="top-poster">
          <NoticeImage src={notice.imageUrl} title={notice.title} />
        </div>
      ) : null}
      <div className="score-col">
        <div
          className="score-ring"
          style={{
            "--score": `${score.total}%`,
          }}
        >
          <strong>{score.total}</strong>
        </div>
        <span className="score-label">{"OPPORTUNITY"}</span>
        <DeadlineBadge dday={score.dday} />
      </div>
    </article>
  );
}
