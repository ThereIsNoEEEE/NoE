"use client";

import { NoticeListItem } from "./NoticeListItem";
export function NoticeFeed({
  eyebrow: eyebrow,
  title: title,
  desc: desc,
  items: items,
  onOpen: onOpen,
  empty: empty,
}) {
  return (
    <section>
      <div className="section-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
          <p>{desc}</p>
        </div>
      </div>
      <div className="feed">
        {items.map((o) => (
          <NoticeListItem key={o.notice.id} item={o} onOpen={onOpen} />
        ))}
      </div>
      <div className={`empty-state${items.length === 0 ? " show" : ""}`}>
        {empty}
      </div>
    </section>
  );
}
