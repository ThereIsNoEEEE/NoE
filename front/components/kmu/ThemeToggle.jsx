"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "kmu-pick-theme";

// 현재 테마의 기준은 <html data-theme>. 처음 값은 layout 의 인라인 스크립트가
// (저장값 → 시스템 설정 → 다크 순으로) 첫 페인트 전에 정해 둔다.
function subscribe(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}
const getSnapshot = () =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
const getServerSnapshot = () => "dark";

export function ThemeToggle({ className = "icon-btn" }) {
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };
  const label = theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";
  return (
    <Button
      variant="original"
      className={className}
      onClick={toggle}
      aria-label={label}
      title={label}
      type="button"
    >
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        {theme === "dark" ? (
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </Button>
  );
}
