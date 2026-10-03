"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Home chatbot. Sends the conversation plus profile / ranked notices as context.
export function ChatPanel({ profile, ranked }) {
  const [messages, setMessages] = React.useState([]);
  const [question, setQuestion] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const logRef = React.useRef(null);

  React.useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const send = async (e) => {
    e.preventDefault();
    const text = question.trim();
    if (!text || pending) return;
    const history = [...messages.filter((m) => !m.error), { role: "user", content: text }];
    setMessages((m) => [...m, { role: "user", content: text }]);
    setQuestion("");
    setPending(true);
    try {
      const notices = (ranked || []).slice(0, 20).map(({ notice, score }) => ({
        title: notice.title,
        date: notice.date,
        deadline: notice.deadline || null,
        dday: score?.dday ?? null,
        score: score?.total,
        category: notice.category,
        summary: notice.summary,
        sourceName: notice.sourceName,
        url: notice.url,
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, profile, notices }),
        signal: AbortSignal.timeout(40000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "챗봇 응답을 받지 못했어요.");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      const message = err?.name === "TimeoutError" ? "챗봇 응답이 늦어지고 있어요. 다시 시도해 주세요." : err?.message;
      setMessages((m) => [...m, { role: "assistant", content: message || "챗봇 응답을 받지 못했어요.", error: true }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="chat-panel" aria-label="챗봇">
      {(messages.length > 0 || pending) && (
        <div className="chat-log" ref={logRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}${m.error ? " error" : ""}`}>
              {m.content}
            </div>
          ))}
          {pending && <div className="chat-msg assistant pending">{"답변을 작성하고 있어요…"}</div>}
        </div>
      )}
      <form className="chatbar" onSubmit={send}>
        <strong>{"챗봇"}</strong>
        <Input
          original={true}
          className="text-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Chat-Bot과 함께 계획을 짜봅시다!"
          aria-label="챗봇에게 질문하기"
          maxLength={1000}
        />
        <Button variant="original" type="submit" className="btn-sm solid" disabled={pending || !question.trim()}>
          {pending ? "답변 중…" : "보내기"}
        </Button>
      </form>
    </section>
  );
}
