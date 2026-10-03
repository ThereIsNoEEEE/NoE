"use client";

import { formatDDay } from "@/lib/dates";
export function DeadlineBadge({ dday: dday }) {
  const t = dday === null ? "off" : dday <= 3 ? "hot" : "";
  return (
    <span className={`dday ${t}`}>
      {dday === null ? "마감일 미확인" : formatDDay(dday)}
    </span>
  );
}
