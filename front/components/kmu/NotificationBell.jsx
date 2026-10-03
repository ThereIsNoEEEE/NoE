"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "./Icon";

const SEEN_STORAGE_KEY = "kmu-pick-notice-seen-v1";
const MAX_ITEMS = 30;

function readSeen() {
  try {
    const value = JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || "null");
    return Array.isArray(value) ? new Set(value) : null;
  } catch {
    return null;
  }
}

function writeSeen(ids) {
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {}
}

// Live notice feed over WebSocket (/ws/notices): `hello` = latest notices on connect,
// `notices` = notices that arrived after connecting. Reconnects with backoff.
function useNoticeFeed(onNew) {
  const [items, setItems] = React.useState([]);
  const [connected, setConnected] = React.useState(false);
  const onNewRef = React.useRef(onNew);
  onNewRef.current = onNew;

  React.useEffect(() => {
    let ws;
    let retry;
    let delay = 2000;
    let stopped = false;
    const connect = () => {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/notices`);
      ws.onopen = () => {
        delay = 2000;
        setConnected(true);
      };
      ws.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!Array.isArray(message.items)) return;
        if (message.type === "hello") {
          setItems((prev) => mergeItems(message.items, prev));
        } else if (message.type === "notices") {
          setItems((prev) => mergeItems(message.items, prev));
          onNewRef.current?.(message.items);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (stopped) return;
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30000);
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return { items, connected };
}

function mergeItems(incoming, prev) {
  const seen = new Set();
  return [...incoming, ...prev].filter((item) => item?.id && !seen.has(item.id) && seen.add(item.id)).slice(0, MAX_ITEMS);
}

export function NotificationBell({ onNew }) {
  const { items, connected } = useNoticeFeed(onNew);
  const [seen, setSeen] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);

  // First visit: treat the current latest list as already seen so only real arrivals count.
  React.useEffect(() => {
    if (!items.length) return;
    setSeen((current) => {
      if (current) return current;
      const stored = readSeen();
      if (stored) return stored;
      const initial = new Set(items.map((item) => item.id));
      writeSeen(initial);
      return initial;
    });
  }, [items]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = seen ? items.filter((item) => !seen.has(item.id)) : [];
  const markAllRead = () => {
    const next = new Set([...(seen || []), ...items.map((item) => item.id)]);
    writeSeen(next);
    setSeen(next);
  };

  return (
    <div className="bell" ref={rootRef}>
      <Button
        variant="original"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread.length ? `새 공지 알림 ${unread.length}건` : "공지 알림"}
        aria-expanded={open}
      >
        <Icon name="bell" />
        {unread.length > 0 && <span className="bell-badge">{unread.length > 9 ? "9+" : unread.length}</span>}
      </Button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="최신 공지 알림">
          <div className="bell-head">
            <strong>{"최신 공지"}</strong>
            <span className={`bell-status${connected ? " on" : ""}`}>{connected ? "실시간 연결됨" : "연결 중…"}</span>
            <Button variant="original" className="bell-read" onClick={markAllRead} disabled={!unread.length} type="button">
              {"모두 읽음"}
            </Button>
          </div>
          <ul className="bell-list">
            {items.length === 0 && <li className="bell-empty">{connected ? "아직 알림이 없어요." : "알림 서버에 연결하는 중이에요."}</li>}
            {items.map((item) => {
              const isNew = seen && !seen.has(item.id);
              return (
                <li key={item.id}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className={isNew ? "new" : ""}
                    onClick={() => {
                      const next = new Set([...(seen || []), item.id]);
                      writeSeen(next);
                      setSeen(next);
                    }}
                  >
                    <span className="bell-title">
                      {isNew && <em>{"NEW"}</em>}
                      {item.title}
                    </span>
                    <small>{[String(item.sourceName || "").replace(/^국민대학교\s*/, ""), item.date].filter(Boolean).join(" · ")}</small>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
