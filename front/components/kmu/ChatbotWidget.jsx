"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "./ChatPanel";

// 오른쪽 하단 고정 챗봇 버튼 + 클릭 시 열리는 팝업 창.
// 대화 내용은 백엔드 RAG 챗봇(ChatPanel, POST /api/chatbot)이 처리한다.
export function ChatbotWidget({ profile }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* 닫아도 대화가 사라지지 않도록 언마운트하지 않고 숨긴다 */}
      <div
        className="chat-backdrop"
        hidden={!open}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <section className="chat-window" role="dialog" aria-label="챗봇" aria-modal="true">
          <header className="chat-head">
            <strong>{"챗봇"}</strong>
            <Button variant="original" className="chat-close" onClick={() => setOpen(false)} aria-label="챗봇 닫기" type="button">
              {"×"}
            </Button>
          </header>
          <ChatPanel profile={profile} />
        </section>
      </div>
      <Button
        variant="original"
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "챗봇 닫기" : "챗봇 열기"}
        aria-expanded={open}
        type="button"
      >
        {"챗봇"}
      </Button>
    </>
  );
}
