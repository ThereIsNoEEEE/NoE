"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoticeImage } from "./NoticeImage";

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

const PROFILE_FIELDS = ["studentType", "college", "major", "grade", "interests", "customInterests", "keywords"];
const MAX_SOURCE_CARDS = 4;

// Turns [S1] citations into links to the cited notice.
function linkCitations(answer, sources) {
  const urls = Object.fromEntries(sources.filter((s) => s.url).map((s) => [s.reference, s.url]));
  // Handles both [S1] and grouped [S1, S2] citations.
  return answer.replace(/\[(S\d+(?:\s*,\s*S\d+)*)\](?!\()/g, (match, group) =>
    group
      .split(/\s*,\s*/)
      .map((ref) => (urls[ref] ? `[[${ref}]](${urls[ref]})` : `[${ref}]`))
      .join(" "),
  );
}

// Notices cited in the answer first (in citation order), else the top results; one card per notice.
function pickSourceCards(answer, sources) {
  const cited = [...answer.matchAll(/\[(S\d+(?:\s*,\s*S\d+)*)\]/g)].flatMap((m) => m[1].split(/\s*,\s*/));
  const byRef = Object.fromEntries(sources.map((s) => [s.reference, s]));
  const ordered = cited.length ? cited.map((ref) => byRef[ref]).filter(Boolean) : sources.slice(0, 3);
  const seen = new Set();
  return ordered.filter((s) => s.url && !seen.has(s.noticeId) && seen.add(s.noticeId)).slice(0, MAX_SOURCE_CARDS);
}

const markdownComponents = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

function SourceCards({ sources }) {
  return (
    <div className="chat-source-cards">
      {sources.map((src) => (
        <a key={src.noticeId} className="chat-source-card" href={src.url} target="_blank" rel="noreferrer">
          <span className="chat-source-thumb">
            {src.imageUrl ? <NoticeImage src={src.imageUrl} title={src.title} /> : <span className="chat-source-ref">{src.reference}</span>}
          </span>
          <span className="chat-source-text">
            <strong>{src.title}</strong>
            <small>{[src.reference, src.date].filter(Boolean).join(" · ")}</small>
          </span>
        </a>
      ))}
    </div>
  );
}

// Chatbot backed by the backend RAG endpoint (POST /api/chatbot); sends "나의 정보" for personalisation.
export function ChatPanel({ profile }) {
  const [messages, setMessages] = React.useState([]);
  const [question, setQuestion] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const logRef = React.useRef(null);

  React.useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  // Updates the last (streaming) assistant message.
  const patchLast = (patch) =>
    setMessages((m) => [...m.slice(0, -1), { ...m[m.length - 1], ...(typeof patch === "function" ? patch(m[m.length - 1]) : patch) }]);

  const send = async (e, suggestedQuestion) => {
    e.preventDefault();
    const text = (suggestedQuestion ?? question).trim();
    if (!text || pending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setQuestion("");
    setPending(true);
    let started = false;
    try {
      const myInfo = profile ? Object.fromEntries(PROFILE_FIELDS.filter((k) => profile[k] != null).map((k) => [k, profile[k]])) : undefined;
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, stream: true, ...(myInfo ? { profile: myInfo } : {}) }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok || !res.body || !(res.headers.get("content-type") || "").includes("text/event-stream")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(CHAT_ERRORS[data?.error?.code] || "챗봇 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
      // Server-Sent Events: sources → delta × N → done | error
      let sources = [];
      let answer = "";
      let buffer = "";
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let sep;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const event = /^event: (.+)$/m.exec(block)?.[1];
          const raw = /^data: (.+)$/m.exec(block)?.[1];
          if (!event || !raw) continue;
          const data = JSON.parse(raw);
          if (event === "sources") {
            sources = Array.isArray(data.sources) ? data.sources : [];
            started = true;
            setMessages((m) => [...m, { role: "assistant", content: "", sources: [], streaming: true }]);
          } else if (event === "delta") {
            answer += data.text;
            patchLast({ content: linkCitations(answer, sources) });
          } else if (event === "done") {
            patchLast({ content: linkCitations(answer || "관련 공지를 찾지 못했어요.", sources), sources: pickSourceCards(answer, sources), streaming: false });
          } else if (event === "error") {
            throw new Error(CHAT_ERRORS[data.code] || data.message || "챗봇 응답을 받지 못했어요.");
          }
        }
      }
    } catch (err) {
      const message = (err?.name === "TimeoutError" ? "챗봇 응답이 늦어지고 있어요. 다시 시도해 주세요." : err?.message) || "챗봇 응답을 받지 못했어요.";
      // Keep text that already streamed in; otherwise show the error bubble.
      if (started) patchLast((last) => (last.content ? { streaming: false, failedNote: message } : { content: message, error: true, streaming: false }));
      else setMessages((m) => [...m, { role: "assistant", content: message, error: true }]);
    } finally {
      setPending(false);
    }
  };

  const streaming = messages[messages.length - 1]?.streaming;

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
              {m.role === "assistant" && !m.error ? (
                <>
                  <div className="chat-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                  {m.streaming && <span className="chat-caret" aria-hidden="true" />}
                  {m.failedNote && <p className="chat-failed-note">{m.failedNote}</p>}
                  {m.sources?.length > 0 && <SourceCards sources={m.sources} />}
                </>
              ) : (
                m.content
              )}
            </div>
          ))}
          {pending && !streaming && <div className="chat-msg assistant pending">{"관련 공지를 찾고 있어요…"}</div>}
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
