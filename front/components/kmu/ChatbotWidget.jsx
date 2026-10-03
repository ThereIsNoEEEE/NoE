"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "./ChatPanel";

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const dockRef = useRef(null);
  const panelId = useId();
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    dockRef.current?.querySelector("input")?.focus({ preventScroll: true });
    const log = dockRef.current?.querySelector(".chat-log");
    if (log) log.scrollTop = log.scrollHeight;
    const onKey = (event) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <div className="chat-dock" ref={dockRef} hidden={!open}>
        <section id={panelId} className="chat-window" role="dialog" aria-label="공지 AI 도우미" aria-modal="false">
          <header className="chat-head">
            <div className="chat-head-copy">
              <strong>공지 AI 도우미</strong>
              <span>궁금한 학교 공지를 물어보세요</span>
            </div>
            <Button variant="original" className="chat-close" onClick={close} aria-label="챗봇 닫기" type="button">×</Button>
          </header>
          <ChatPanel />
        </section>
      </div>
      <Button ref={triggerRef} variant="original" className="chat-fab" onClick={() => open ? close() : setOpen(true)} aria-label={open ? "챗봇 닫기" : "챗봇 열기"} aria-expanded={open} aria-controls={panelId} type="button">
        {open ? "닫기" : "챗봇"}
      </Button>
    </>
  );
}
