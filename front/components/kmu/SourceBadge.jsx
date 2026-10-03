"use client";

export function SourceBadge({ notice: notice }) {
  return notice.sourceType === "sample" ? (
    <span className="source extra">{"샘플 데이터"}</span>
  ) : (
    <span className="source school">{"학교 홈페이지"}</span>
  );
}
