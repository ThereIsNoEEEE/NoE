import { OFFICIAL_SOURCE_NAME, createSampleNotices } from "@/data/notices";
import { parseDate, formatDate } from "@/lib/dates";
import { INTEREST_KEYWORDS, DEFAULT_INTERESTS } from "@/data/profile";
import { matchesKeyword } from "@/lib/recommendations";

function normalizeDate(e) {
  const t = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(String(e || ""));
  if (!t) return "";
  const n = (r) => String(r).padStart(2, "0");
  return `${t[1]}-${n(t[2])}-${n(t[3])}`;
}

function createNoticeId(e) {
  let t = 0;
  for (let n = 0; n < e.length; n += 1) t = (t * 31 + e.charCodeAt(n)) | 0;
  return `n${Math.abs(t).toString(36)}`;
}

function resolveNoticeUrl(e, t) {
  if (!e) return t;
  try {
    return new URL(e, t).href;
  } catch {
    return t;
  }
}

function normalizeNotice(e, t = {}) {
  if (!e || typeof e != "object") return null;
  const n = String(e.title || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return null;
  const r = t.baseUrl || "https://www.kookmin.ac.kr";
  const l = resolveNoticeUrl(e.url || e.href, r);
  return {
    id: String(e.id || createNoticeId(l + n)),
    title: n,
    content: String(e.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2e3),
    date: normalizeDate(e.date),
    url: l,
    sourceType: t.sourceType || e.sourceType || "website",
    sourceName: t.sourceName || e.sourceName || OFFICIAL_SOURCE_NAME,
    boardName: e.category || e.boardName || "",
  };
}

function normalizeNotices(e, t) {
  const n = new Set();
  return (Array.isArray(e) ? e : [])
    .map((r) => normalizeNotice(r, t))
    .filter((r) => r && !n.has(r.id) && n.add(r.id));
}

const FETCH_TIMEOUT_MS = 12e3;

async function fetchWithTimeout(e, t = {}, n = FETCH_TIMEOUT_MS) {
  const r = new AbortController();
  const l = setTimeout(() => r.abort(), n);
  try {
    return await fetch(e, {
      ...t,
      signal: r.signal,
    });
  } finally {
    clearTimeout(l);
  }
}

async function fetchNotices() {
  try {
    const e = await fetchWithTimeout("/api/notices");
    if (!e.ok) throw new Error(`HTTP ${e.status}`);
    const t = await e.json();
    const n = normalizeNotices(t.items);
    if (n.length === 0) throw new Error("empty");
    return {
      notices: n,
      source: t.source || "live",
      fetchedAt: t.fetchedAt,
    };
  } catch (e) {
    return {
      notices: normalizeNotices(createSampleNotices()),
      source: "sample",
      reason:
        (e == null ? void 0 : e.name) === "AbortError"
          ? "timeout"
          : String((e == null ? void 0 : e.message) || e),
    };
  }
}

const BOARD_CATEGORIES = {
  장학공지: "장학금",
  특강공지: "특강",
  "공모∙행사": "공모전",
  "공모·행사": "공모전",
  학사공지: "수강신청",
};

function extractDeadline(e, t, n) {
  const r = parseDate(n) || new Date();
  const l = r.getFullYear();
  const i = (s, a, f) => {
    const p = new Date(Number(s) || l, Number(a) - 1, Number(f));
    return Number.isNaN(p.getTime()) || p.getMonth() !== Number(a) - 1
      ? null
      : (!s &&
          p.getTime() < r.getTime() - 30 * 864e5 &&
          p.setFullYear(p.getFullYear() + 1),
        formatDate(p));
  };
  const o = [
    /~\s*(?:(\d{4})\s*[.\-/년]\s*)?(\d{1,2})\s*[./월-]\s*(\d{1,2})/,
    /(?:마감|까지|기한|접수)[^\d]{0,8}(?:(\d{4})\s*[.\-/년]\s*)?(\d{1,2})\s*[./월-]\s*(\d{1,2})/,
    /(?:(\d{4})\s*[.\-/년]\s*)?(\d{1,2})\s*[./월-]\s*(\d{1,2})\s*일?\s*(?:\([^)]*\))?\s*(?:까지|마감)/,
  ];
  for (const s of [e, t])
    for (const a of o) {
      const f = a.exec(s || "");
      if (f) {
        const p = i(f[1], f[2], f[3]);
        if (p) return p;
      }
    }
  return null;
}

function countKeywordMatches(e, t) {
  const n = t.toLowerCase();
  const r = e.toLowerCase();
  if (/^[a-z0-9 .+#]+$/.test(n)) {
    const l = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (r.match(new RegExp(`(^|[^a-z0-9])${l}(?![a-z0-9])`, "g")) || [])
      .length;
  }
  return r.split(n).length - 1;
}

function extractGrades(e) {
  if (/전\s*학년/.test(e)) return [];
  const t = new RegExp("(?<!\\d)([1-6])\\s*[~-]\\s*([1-6])\\s*학년(?!도)").exec(
    e,
  );
  if (t) {
    const r = [];
    for (let l = Number(t[1]); l <= Number(t[2]); l += 1) r.push(l);
    return r;
  }
  const n = new Set();
  for (const r of e.matchAll(new RegExp("(?<!\\d)([1-6])\\s*학년(?!도)", "g")))
    n.add(Number(r[1]));
  return [...n].sort();
}

function analyzeNoticeLocally(e) {
  const t = (e.content || "").replace(/\s+/g, " ").trim();
  const n = `${e.title} ${t}`;
  const r = (x) =>
    INTEREST_KEYWORDS[x].reduce((k, I) => k + countKeywordMatches(t, I), 0);
  const l = DEFAULT_INTERESTS.filter(
    (x) =>
      INTEREST_KEYWORDS[x].some((k) => matchesKeyword(e.title, k)) || r(x) >= 2,
  );
  const i = BOARD_CATEGORIES[e.boardName];
  if (i && !l.includes(i)) {
    l.push(i);
  }
  const o = /대학원/.test(n);
  const s = /학부|재학생|[1-6]\s*학년(?!도)/.test(n);
  const a =
    o && !s ? ["대학원"] : !o && /학부/.test(n) ? ["학부"] : ["학부", "대학원"];
  const f = [];
  for (const x of l)
    for (const k of INTEREST_KEYWORDS[x] || []) {
      const I = k === "ai" ? "AI" : k;
      if (matchesKeyword(n, k) && !f.includes(I)) {
        f.push(I);
      }
    }
  const p = extractDeadline(e.title, t, e.date);
  const h =
    t
      .replace(/^[\sㅇ○●■□▶※\-•·]+/, "")
      .split(new RegExp("(?<=[.!?다요])\\s+"))
      .find((x) => x.length > 20) || "";
  const v =
    /^.{0,14}\s:\s/.test(h) ||
    /(신청마감|접수기간|제출서류|신청방법)\s*:/.test(h.slice(0, 30));
  let g = h && !v ? h : "";
  if (!g) {
    const [, x, k] = /^\d{4}-(\d{2})-(\d{2})$/.exec(p || "") || [];
    g = `${e.title.replace(/\s*\(~[^)]*\)\s*$/, "").replace(/\s*안내\s*$/, "")} 안내입니다.${x ? ` ${Number(x)}월 ${Number(k)}일까지 확인이 필요해요.` : " 자세한 내용은 원문을 확인하세요."}`;
  }
  return {
    category: l.slice(0, 4),
    target: a,
    grades: extractGrades(n),
    keywords: f.slice(0, 6),
    deadline: p,
    summary: g.slice(0, 110),
    analyzedBy: "mock",
  };
}

const ANALYSIS_STORAGE_KEY = "kmu-pick-analysis-v2";

const AI_TIMEOUT_MS = 15e3;

function readAnalysisCache() {
  try {
    return JSON.parse(localStorage.getItem(ANALYSIS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAnalysisCache(e) {
  try {
    const t = Object.entries(e).slice(-300);
    localStorage.setItem(
      ANALYSIS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(t)),
    );
  } catch {}
}

const analysisCacheKey = (e) =>
  `${e.id}|${e.title}|${(e.content || "").length}`;

function validateAIAnalysis(e) {
  if (!e || typeof e != "object") return null;
  const t = (r, l) =>
    Array.isArray(r)
      ? r
          .map(String)
          .map((i) => i.trim())
          .filter(Boolean)
          .slice(0, l)
      : [];
  const n = typeof e.summary == "string" ? e.summary.trim().slice(0, 140) : "";
  return n
    ? {
        category: t(e.category, 6).filter((r) => DEFAULT_INTERESTS.includes(r)),
        target: t(e.target, 2).filter((r) => r === "학부" || r === "대학원"),
        grades: (Array.isArray(e.grades) ? e.grades : [])
          .map(Number)
          .filter((r) => r >= 1 && r <= 6),
        keywords: t(e.keywords, 8),
        deadline: parseDate(e.deadline) ? e.deadline : null,
        summary: n,
        analyzedBy: "ai",
      }
    : null;
}

async function requestAIAnalysis(e) {
  const t = await fetchWithTimeout(
    "/api/analyze",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notices: e.map(
          ({ id: id, title: title, content: content, date: date }) => ({
            id: id,
            title: title,
            content: content,
            date: date,
          }),
        ),
      }),
    },
    AI_TIMEOUT_MS,
  );
  if (!t.ok) throw new Error(`AI HTTP ${t.status}`);
  const n = await t.json();
  const r = {};
  for (const l of n.results || []) {
    const i = validateAIAnalysis(l);
    if (i && l.id !== void 0) {
      r[String(l.id)] = i;
    }
  }
  return r;
}

async function analyzeNotices(e) {
  const t = readAnalysisCache();
  const n = {};
  const r = [];
  for (const o of e) {
    const s = t[analysisCacheKey(o)];
    if (s) {
      n[o.id] = s;
    } else {
      r.push(o);
    }
  }
  if (r.length) {
    let o = {};
    try {
      o = await requestAIAnalysis(r);
    } catch {}
    for (const s of r) {
      n[s.id] = o[s.id] || analyzeNoticeLocally(s);
      t[analysisCacheKey(s)] = n[s.id];
    }
    writeAnalysisCache(t);
  }
  const l = new Set(
    e.map((o) => {
      var s;
      return (s = n[o.id]) == null ? void 0 : s.analyzedBy;
    }),
  );
  const i = l.size > 1 ? "mixed" : l.has("ai") ? "ai" : "mock";
  return {
    analysis: n,
    mode: i,
  };
}

export {
  normalizeDate,
  createNoticeId,
  resolveNoticeUrl,
  normalizeNotice,
  normalizeNotices,
  FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  fetchNotices,
  BOARD_CATEGORIES,
  extractDeadline,
  countKeywordMatches,
  extractGrades,
  analyzeNoticeLocally,
  ANALYSIS_STORAGE_KEY,
  AI_TIMEOUT_MS,
  readAnalysisCache,
  writeAnalysisCache,
  analysisCacheKey,
  validateAIAnalysis,
  requestAIAnalysis,
  analyzeNotices,
};

export async function loadNoticeData() {
  const source = await fetchNotices();
  const analyzed = await analyzeNotices(source.notices);
  return { ...source, ...analyzed };
}
