"use client";

import { Icon } from "./Icon";
export function SummaryPanel({
  total: total,
  recommended: recommended,
  urgent: urgent,
  topScore: topScore,
  expired: expired,
}) {
  const i = [
    {
      label: "가져온 전체 공지",
      value: total,
      unit: "건",
      note: expired ? `마감 지난 ${expired}건 제외` : "최신 공지 기준",
      icon: "list",
    },
    {
      label: "추천 공지",
      value: recommended,
      unit: "건",
      note: "Opportunity Score 60+",
      icon: "gift",
    },
    {
      label: "마감 임박",
      value: urgent,
      unit: "건",
      note: "D-7 이내",
      icon: "alert",
      urgent: !0,
    },
    {
      label: "최고 Opportunity Score",
      value: topScore,
      unit: "점",
      note: "100점 만점",
      icon: "chart",
    },
  ];
  return (
    <section className="stats" aria-label="오늘의 요약">
      {i.map((o) => (
        <div
          key={o.label}
          className={`stat-card static${o.urgent ? " urgent" : ""}`}
        >
          <div className="stat-top">
            <span>{o.label}</span>
            <Icon name={o.icon} />
          </div>
          <div className="stat-num">
            {String(o.value).padStart(2, "0")}
            <small>{o.unit}</small>
          </div>
          <div className="stat-note">{o.note}</div>
        </div>
      ))}
    </section>
  );
}
