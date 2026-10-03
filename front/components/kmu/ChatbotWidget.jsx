"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GREETING = "안녕하세요! Chat-Bot과 함께 계획을 짜봅시다.";
// 챗봇 백엔드가 아직 없어 답변은 안내 문구로 대신한다.
const PLACEHOLDER_REPLY =
  "챗봇 기능은 아직 준비 중이에요. 연결되면 추천 공지를 바탕으로 일정과 준비 계획을 같이 짜 드릴게요.";

// 오른쪽 하단 고정 챗봇 버튼 + 클릭 시 열리는 팝업 창
export function ChatbotWidget() {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [messages, setMessages] = React.useState([{ role: "bot", text: GREETING }]);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const send = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setMessages((m) => [...m, { role: "user", text: value }, { role: "bot", text: PLACEHOLDER_REPLY }]);
    setText("");
  };

  return (
    <>
      {open && (
        <div
          className="chat-backdrop"
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
            <div className="chat-messages" ref={listRef} aria-live="polite">
              {messages.map((m, i) => (
                <p key={i} className={`chat-msg ${m.role}`}>
                  {m.text}
                </p>
              ))}
            </div>
            <form className="chatbar" onSubmit={send}>
              <strong>{"챗봇"}</strong>
              <Input
                original={true}
                className="text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Chat-Bot과 함께 계획을 짜봅시다!"
                aria-label="챗봇에게 질문하기"
                autoFocus
              />
              <Button variant="original" type="submit" className="btn-sm solid">
                {"보내기"}
              </Button>
            </form>
          </section>
        </div>
      )}
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
