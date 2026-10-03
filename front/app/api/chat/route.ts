// Chatbot: answers with the user's profile and ranked notices as context.
// The OpenAI key stays on the server (OPENAI_API_KEY); the browser never sees it.
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1000;
const MAX_NOTICES = 20;

type ChatMessage = { role: "user" | "assistant"; content: string };
type NoticeContext = {
  title?: string;
  date?: string;
  deadline?: string | null;
  dday?: number | null;
  score?: number;
  category?: string[];
  summary?: string;
  sourceName?: string;
  url?: string;
};

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function buildSystemPrompt(profile: Record<string, unknown>, notices: NoticeContext[]) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const lines = notices.slice(0, MAX_NOTICES).map((n, i) =>
    [
      `${i + 1}. ${clean(n.title, 150)}`,
      n.sourceName && `출처: ${clean(n.sourceName, 60)}`,
      n.date && `게시일: ${clean(n.date, 20)}`,
      n.deadline ? `마감: ${clean(n.deadline, 20)}${typeof n.dday === "number" ? ` (D-${n.dday})` : ""}` : "마감일 미확인",
      typeof n.score === "number" && `추천점수: ${n.score}`,
      n.category?.length && `분류: ${n.category.map((c) => clean(c, 20)).join(", ")}`,
      n.summary && `요약: ${clean(n.summary, 200)}`,
      n.url && `원문: ${clean(n.url, 300)}`,
    ]
      .filter(Boolean)
      .join(" | "),
  );
  return [
    "너는 국민대학교 학생을 돕는 공지 추천 서비스 'KMU Pick AI'의 챗봇이다.",
    "아래 사용자 프로필과 추천 공지 목록만 근거로 한국어로 짧고 실용적으로 답한다.",
    "목록에 없는 공지·날짜·조건은 지어내지 말고, 모르면 원문 확인을 권한다.",
    "마감이 가까운 공지를 우선 안내하고, 필요하면 일정 계획을 제안한다.",
    `오늘 날짜: ${today}`,
    `사용자 프로필: ${JSON.stringify(profile).slice(0, 1000)}`,
    "추천 공지 목록:",
    lines.length ? lines.join("\n") : "(없음)",
  ].join("\n");
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return error(503, "CHAT_NOT_CONFIGURED", "챗봇 서버 설정(OPENAI_API_KEY)이 없어요.");

  let body: { messages?: ChatMessage[]; profile?: Record<string, unknown>; notices?: NoticeContext[] };
  try {
    body = await request.json();
  } catch {
    return error(400, "INVALID_JSON", "요청 형식이 올바르지 않아요.");
  }
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return error(400, "EMPTY_QUESTION", "질문을 입력해 주세요.");
  }

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(body.profile ?? {}, Array.isArray(body.notices) ? body.notices : []) },
          ...messages,
        ],
        max_completion_tokens: 800,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const code = data?.error?.code || data?.error?.type;
      if (code === "insufficient_quota" || code === "credit_balance_exhausted") {
        return error(503, "CHAT_NO_CREDIT", "챗봇 API 크레딧이 부족해요. 관리자에게 문의해 주세요.");
      }
      if (upstream.status === 401) return error(503, "CHAT_AUTH_FAILED", "챗봇 API 키가 올바르지 않아요.");
      if (upstream.status === 429) return error(429, "CHAT_RATE_LIMITED", "요청이 많아요. 잠시 후 다시 시도해 주세요.");
      return error(502, "CHAT_UPSTREAM_ERROR", "챗봇 응답을 받지 못했어요.");
    }
    const reply = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) return error(502, "CHAT_EMPTY", "챗봇 응답이 비어 있어요. 다시 시도해 주세요.");
    return Response.json({ reply, model: MODEL });
  } catch {
    return error(504, "CHAT_TIMEOUT", "챗봇 응답이 늦어지고 있어요. 다시 시도해 주세요.");
  }
}
