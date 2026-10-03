"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 50;

const CONTENT_STATUS_LABELS = {
  text_extracted: "본문 추출",
  image_only: "이미지만",
  attachment_only: "첨부만",
  extraction_failed: "추출 실패",
};

function formatDateTime(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Settings view: every notice stored in Qdrant with its posted / collected dates.
export function CollectedNotices() {
  const [state, setState] = React.useState({ status: "loading", items: [] });
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState("all");
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const res = await fetch("/api/db/notices", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({ status: "ok", items: data.items || [], collection: data.collection, fetchedAt: data.fetchedAt });
    } catch {
      setState({ status: "error", items: [] });
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const sources = React.useMemo(() => {
    const counts = new Map();
    for (const n of state.items) counts.set(n.sourceName || "출처 미상", (counts.get(n.sourceName || "출처 미상") || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.items]);

  const lastCollectedAt = React.useMemo(
    () => state.items.reduce((max, n) => (n.collectedAt && n.collectedAt > max ? n.collectedAt : max), ""),
    [state.items],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.items.filter(
      (n) =>
        (source === "all" || (n.sourceName || "출처 미상") === source) &&
        (!q || `${n.title} ${n.sourceName} ${n.sourceBoard}`.toLowerCase().includes(q)),
    );
  }, [state.items, query, source]);

  React.useEffect(() => setLimit(PAGE_SIZE), [query, source]);

  return (
    <section className="collected">
      <div className="section-head">
        <div>
          <div className="eyebrow">{"COLLECTED DATA"}</div>
          <h2 className="home-h">{"수집한 공지 데이터"}</h2>
          <p>{"Qdrant에 저장된 전체 공지와 게시일·수집일시를 확인할 수 있어요."}</p>
        </div>
        <Button variant="original" className="btn-sm" onClick={load} disabled={state.status === "loading"}>
          {state.status === "loading" ? "불러오는 중…" : "새로고침"}
        </Button>
      </div>

      {state.status === "error" && (
        <div className="empty-state show">{"수집 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}</div>
      )}

      {state.status !== "error" && (
        <>
          <div className="collected-stats">
            <span className="status-pill">
              <i />
              {`전체 ${state.items.length}건`}
            </span>
            <span className="status-pill">
              <i />
              {`출처 ${sources.length}곳`}
            </span>
            <span className="status-pill">
              <i />
              {`마지막 수집 ${formatDateTime(lastCollectedAt)}`}
            </span>
            {state.collection && <span className="status-pill">{`컬렉션 ${state.collection}`}</span>}
          </div>

          <div className="collected-toolbar">
            <input
              type="search"
              placeholder="제목·출처·게시판 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="수집 공지 검색"
            />
            <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="출처 필터">
              <option value="all">{`전체 출처 (${state.items.length})`}</option>
              {sources.map(([name, count]) => (
                <option key={name} value={name}>{`${name} (${count})`}</option>
              ))}
            </select>
          </div>

          <div className="collected-table-wrap">
            <table className="collected-table">
              <thead>
                <tr>
                  <th>{"게시일"}</th>
                  <th>{"출처"}</th>
                  <th>{"게시판"}</th>
                  <th>{"제목"}</th>
                  <th>{"본문"}</th>
                  <th>{"분석"}</th>
                  <th>{"수집일시"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((n) => (
                  <tr key={n.id}>
                    <td>{n.date || <span className="muted">{"미상"}</span>}</td>
                    <td className="muted">{(n.sourceName || "-").replace(/^국민대학교\s*/, "")}</td>
                    <td className="muted">{n.sourceBoard || n.category || "-"}</td>
                    <td className="title">
                      <a href={n.url} target="_blank" rel="noreferrer">
                        {n.pinned ? "📌 " : ""}
                        {n.title}
                      </a>
                    </td>
                    <td>
                      <span className={`tag ${n.contentStatus === "text_extracted" ? "" : "warn"}`}>
                        {CONTENT_STATUS_LABELS[n.contentStatus] || n.contentStatus || "-"}
                      </span>
                      {n.needsOcr && <span className="tag warn">{" OCR 필요"}</span>}
                    </td>
                    <td>
                      <span className={`tag ${n.analysisStatus === "pending" ? "warn" : ""}`}>
                        {n.analysisStatus === "pending" ? "대기" : n.analysisStatus || "-"}
                      </span>
                    </td>
                    <td className="muted">{formatDateTime(n.collectedAt)}</td>
                  </tr>
                ))}
                {state.status === "ok" && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      {"조건에 맞는 공지가 없어요."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > limit && (
            <div className="collected-more">
              <Button variant="original" className="btn-sm" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                {`더 보기 (${limit} / ${filtered.length})`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
