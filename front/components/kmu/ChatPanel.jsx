"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CHAT_ERRORS = {
  CHATBOT_INPUT_INVALID: "질문을 다시 입력해 주세요.",
  EMBEDDING_NOT_CONFIGURED: "챗봇 AI 설정이 아직 준비되지 않았어요.",
  LLM_NOT_CONFIGURED: "챗봇 AI 설정이 아직 준비되지 않았어요.",
  CHATBOT_INDEX_MISSING: "공지 검색 색인이 아직 준비되지 않았어요.",
  CHATBOT_VECTOR_MISMATCH: "공지 검색 색인 설정이 맞지 않아요. 관리자에게 문의해 주세요.",
  EMBEDDING_API_ERROR: "지금은 AI 답변을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.",
  LLM_API_ERROR: "지금은 AI 답변을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.",
  CHATBOT_TIMEOUT: "챗봇 응답이 늦어지고 있어요. 다시 시도해 주세요.",
};

// Home chatbot backed by the backend RAG endpoint (POST /api/chatbot).
export function ChatPanel() {
  const [messages, setMessages] = React.useState([]);
  const [question, setQuestion] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const logRef = React.useRef(null);

  React.useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const send = async (e, suggestedQuestion) => {
    e.preventDefault();
    const text = (suggestedQuestion ?? question).trim();
    if (!text || pending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setQuestion("");
    setPending(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(CHAT_ERRORS[data?.error?.code] || "챗봇 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.");
      const seen = new Set();
      const sources = (data.sources || []).filter((src) => src.url && !seen.has(src.noticeId) && seen.add(src.noticeId)).slice(0, 5);
      setMessages((m) => [...m, { role: "assistant", content: data.answer || "관련 공지를 찾지 못했어요.", sources }]);
    } catch (err) {
      const message = err?.name === "TimeoutError" ? "챗봇 응답이 늦어지고 있어요. 다시 시도해 주세요." : err?.message;
      setMessages((m) => [...m, { role: "assistant", content: message || "챗봇 응답을 받지 못했어요.", error: true }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="chat-panel" aria-label="챗봇">
      {(
        <div className="chat-log" ref={logRef} aria-live="polite">
          {messages.length === 0 && !pending && (
            <div className="chat-empty">
              <h3>어떤 공지를 찾고 있나요?</h3>
              <p>학교 공지의 대상 조건과 마감일을 함께 확인해 보세요.</p>
              <div className="chat-prompts">
                {["이번 주 마감하는 공지 찾아줘", "장학금 관련 공지 알려줘", "인턴 모집 공지 찾아줘"].map(prompt => (
                  <Button key={prompt} variant="original" type="button" onClick={event => send(event, prompt)}>{prompt}</Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}${m.error ? " error" : ""}`}>
              {m.content}
              {m.sources?.length > 0 && (
                <ul className="chat-sources">
                  {m.sources.map((src) => (
                    <li key={src.noticeId}>
                      <a href={src.url} target="_blank" rel="noreferrer">
                        {`[${src.reference}] ${src.title}`}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
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
          placeholder="궁금한 공지를 물어보세요"
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
