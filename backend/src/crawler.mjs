/**
 * 국민대학교 공지 수집 모듈.
 * 목록/본문/이미지 파싱, 정규화, 캐시를 이 파일에서만 관리합니다.
 * HTTP 라우팅 및 DB 의존성은 없습니다. 수집 실패를 샘플 데이터로 숨기지 않습니다.
 */
import { createHash } from "node:crypto";
const noticeImages = new Map();
const detailCache = new Map();

const SOURCES = [
  {
    id: "kmu-main",
    name: "국민대학교 전체 공지",
    url: "https://www.kookmin.ac.kr/user/kmuNews/notice/index.do",
    parser: "kmu-main",
  },
  {
    id: "kmu-cs",
    name: "소프트웨어융합대학 공지",
    url: "https://cs.kookmin.ac.kr/news/notice/",
    parser: "kmu-cs",
  },
];

const ALLOWED_HOSTS = new Set(SOURCES.map((source) => new URL(source.url).hostname));
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const LIST_LIMIT_PER_SOURCE = 12;


let cache = null;
let crawlPromise = null;

function decodeEntities(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    hellip: "…",
    middot: "·",
    ndash: "–",
    mdash: "—",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    }
    return named[code.toLowerCase()] ?? match;
  });
}

function cleanText(value = "") {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>|<\/li>|<\/tr>|<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDate(rawDate) {
  const match = String(rawDate ?? "").match(/(?:(\d{4})|(\d{2}))[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return null;
  const year = match[1] ? Number(match[1]) : 2000 + Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function absoluteUrl(baseUrl, href) {
  return new URL(decodeEntities(href), baseUrl).href;
}

function parseKmuMainList(html, source) {
  const notices = [];
  const itemPattern = /<li[^>]*>\s*<a\s+[^>]*href=["']([^"']*\/view\.do[^"']*)["'][^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;

  for (const match of html.matchAll(itemPattern)) {
    const body = match[2];
    const title = cleanText(body.match(/<p\s+[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const category = cleanText(body.match(/<span\s+[^>]*class=["'][^"']*ctg_name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const metadata = body.match(/<div\s+[^>]*class=["'][^"']*board_etc[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const date = normalizeDate(metadata);
    if (!title || !date) continue;

    notices.push({
      title,
      content: "",
      date,
      url: absoluteUrl(source.url, match[1]),
      category,
      sourceId: source.id,
      sourceName: source.name,
    });
  }

  return notices;
}

function parseKmuCsList(html, source) {
  const notices = [];
  const rowPattern = /<ul(?:\s+[^>]*)?>([\s\S]*?)<\/ul>/gi;

  for (const row of html.matchAll(rowPattern)) {
    const body = row[1];
    const subject = body.match(/<li\s+[^>]*class=["'][^"']*subject[^"']*["'][^>]*>[\s\S]*?<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const date = normalizeDate(body.match(/<li\s+[^>]*class=["'][^"']*date[^"']*["'][^>]*>([\s\S]*?)<\/li>/i)?.[1] ?? "");
    const title = cleanText(subject?.[2] ?? "");
    if (!subject || !title || !date) continue;

    notices.push({
      title,
      content: "",
      date,
      url: absoluteUrl(source.url, subject[1]),
      category: "",
      sourceId: source.id,
      sourceName: source.name,
    });
  }

  return notices;
}

function detailBody(html, parser) {
  const pattern = parser === "kmu-main"
    ? /<div\s+[^>]*class=["'][^"']*\bview_inner\b[^"']*["'][^>]*>/i
    : /<div\s+[^>]*id=["']view-detail-data["'][^>]*>/i;
  const start = pattern.exec(html);
  if (!start) return "";
  const offset = start.index + start[0].length;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = offset;
  let depth = 1;
  for (let tag; (tag = tags.exec(html));) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (!depth) return html.slice(offset, tag.index);
  }
  return html.slice(offset);
}

function parseDetail(html, parser) {
  return cleanText(detailBody(html, parser)).slice(0, 12_000);
}

function safeImage(value, base) {
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  try {
    const url = new URL(decodeEntities(value), base);
    return url.protocol === "https:" && /(^|\.)kookmin\.ac\.kr$/.test(url.hostname) ? url.href : null;
  } catch { return null; }
}

function parseDetailImage(html, parser, base) {
  const body = detailBody(html, parser);
  for (const image of body.matchAll(/<img\b[^>]*>/gi)) {
    const src = image[0].match(/\b(?:data-src|src)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) { const safe = safeImage(src, base); if (safe) return safe; }
  }
  // Some notices attach a poster as a downloadable image instead of embedding it.
  for (const link of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/\.(?:png|jpe?g|gif|webp)(?:[?#\s]|$)/i.test(cleanText(link[2]) + " " + link[1])) continue;
    const safe = safeImage(link[1], base);
    if (safe) return safe;
  }
  return null;
}

function classifyCategory(title, content, listedCategory = "") {
  if (listedCategory) return listedCategory.replace(/공지$/, "") || "기타";
  const text = `${title} ${content}`.toLowerCase();
  const rules = [
    ["장학금", ["장학", "학자금"]],
    ["인턴", ["인턴", "현장실습"]],
    ["취업", ["취업", "채용", "career"]],
    ["공모전", ["공모전", "챌린지", "경진대회", "해커톤", "대회"]],
    ["AI/데이터", ["ai", "인공지능", "데이터", "소프트웨어", "sw"]],
    ["특강", ["특강", "세미나", "강연"]],
    ["교환학생", ["교환학생", "국제교류", "파견"]],
    ["수강신청", ["수강", "전공 신청", "다전공"]],
    ["학사", ["학사", "졸업", "휴학", "복학", "시험"]],
    ["교내행사", ["행사", "축제", "멘토링", "버디"]],
  ];
  return rules.find(([, words]) => words.some((word) => text.includes(word)))?.[0] ?? "기타";
}

function inferTargets(title, content) {
  const text = `${title} ${content}`;
  const targets = [];
  if (/학부|재학생|대학생|학년/.test(text)) targets.push("학부");
  if (/대학원|석사|박사|연구생/.test(text)) targets.push("대학원");
  return [...new Set(targets)];
}

function extractKeywords(title, content, category) {
  const text = `${title} ${content}`.toLowerCase();
  const candidates = [
    "AI", "데이터", "소프트웨어", "SW", "인턴", "취업", "장학금", "공모전", "해커톤",
    "특강", "교환학생", "국제교류", "수강신청", "졸업", "창업", "연구", "멘토링",
  ];
  const found = candidates.filter((keyword) => text.includes(keyword.toLowerCase()));
  return [...new Set([category, ...found])].filter(Boolean).slice(0, 6);
}

function extractDeadline(title, content, publishedDate) {
  const text = `${title} ${content}`.slice(0, 5_000);
  const yearHint = Number(publishedDate?.slice(0, 4)) || new Date().getFullYear();
  const published = publishedDate ? new Date(`${publishedDate}T00:00:00+09:00`) : null;
  const candidates = [];
  const datePattern = /(?:(20\d{2})\s*[.\-/년]\s*)?(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g;

  for (const match of text.matchAll(datePattern)) {
    const context = text.slice(Math.max(0, match.index - 8), Math.min(text.length, match.index + match[0].length + 18));
    if (!/[~～까지마감접수신청기간]/.test(context)) continue;
    const year = Number(match[1] || yearHint);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const candidate = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59+09:00`);
    if (Number.isNaN(candidate.getTime()) || candidate.getMonth() + 1 !== month || candidate.getDate() !== day) continue;
    if (published && candidate < new Date(published.getTime() - 24 * 60 * 60 * 1000)) continue;
    candidates.push(candidate);
  }

  if (!candidates.length) return null;
  const deadline = candidates.sort((a, b) => b - a)[0];
  return deadline.toISOString().slice(0, 10);
}

function makeSummary(title, content) {
  const text = cleanText(content);
  if (!text) return `${title}의 신청 대상과 세부 일정은 원문에서 확인해 주세요.`;
  const firstSentence = text.split(/(?<=[.!?다요])\s+/)[0] || text;
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 177)}…` : firstSentence;
}

function normalizeNotice(raw) {
  const category = classifyCategory(raw.title, raw.content, raw.category);
  const deadline = raw.deadline ?? extractDeadline(raw.title, raw.content, raw.date);
  const id = raw.id ?? createHash("sha1").update(raw.url).digest("hex").slice(0, 16);
  if (raw.imageSrc) noticeImages.set(id, { src: raw.imageSrc });
  const now = Date.now();
  const createdAt = raw.date ? new Date(`${raw.date}T00:00:00+09:00`).getTime() : 0;
  const isNew = createdAt > 0 && now - createdAt <= 3 * 24 * 60 * 60 * 1000;

  return {
    id,
    title: raw.title,
    content: raw.content || "",
    imageUrl: raw.imageSrc ? `/api/images/${id}` : null,
    date: raw.date,
    url: raw.url,
    sourceType: "website",
    sourceName: raw.sourceName,
    sourceId: raw.sourceId,
    category,
    boardName: raw.category || category,
    deadline,
    summary: makeSummary(raw.title, raw.content),
    target: inferTargets(raw.title, raw.content),
    keywords: extractKeywords(raw.title, raw.content, category),
    site_id: raw.sourceId,
    source_url: raw.url,
    event_date: deadline,
    event_start_date: null,
    event_end_date: deadline,
    location: null,
    created_at: raw.date ? `${raw.date}T00:00:00+09:00` : null,
    updated_at: null,
    category_name: category,
    site_name: raw.sourceName,
    is_new: isNew,
  };
}

async function fetchHtml(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`허용되지 않은 수집 URL: ${url}`);
  }

  let target = parsed;
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  for (let redirects = 0; redirects < 4; redirects++) {
    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) throw new Error('허용되지 않은 리디렉션');
    const response = await fetch(target, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9', 'User-Agent': 'KMUPickLocalCrawler/1.0 (+local demo; limited requests)' },
      redirect: 'manual', signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('리디렉션 주소 없음');
      target = new URL(location, target); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 16 * 1024 * 1024) throw new Error('본문 크기 초과');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new Error('리디렉션 횟수 초과');
}

async function crawlSource(source) {
  const listHtml = await fetchHtml(source.url);
  const parser = source.parser === "kmu-main" ? parseKmuMainList : parseKmuCsList;
  const parsed = parser(listHtml, source)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, LIST_LIMIT_PER_SOURCE);
  if (!parsed.length) throw new Error("공지 목록을 찾지 못했습니다.");

  const enriched = [];
  // One detail request at a time per source; cache details for an hour.
  for (const notice of parsed) {
    try {
      let detail = detailCache.get(notice.url);
      if (!detail || Date.now() - detail.at > 60 * 60 * 1000) {
        const detailHtml = await fetchHtml(notice.url);
        const fullTitle = source.parser === 'kmu-cs' ? cleanText(detailHtml.match(/<div\b[^>]*class=["'][^"']*\bview-thead\b[^"']*["'][^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '') : '';
        detail = { at: Date.now(), ...(fullTitle ? {title: fullTitle} : {}), content: parseDetail(detailHtml, source.parser), imageSrc: parseDetailImage(detailHtml, source.parser, notice.url) };
        detailCache.set(notice.url, detail);
      }
      enriched.push({ ...notice, ...detail });
    } catch {
      enriched.push(notice);
    }
  }
  while (detailCache.size > 100) detailCache.delete(detailCache.keys().next().value);

  return enriched.map(normalizeNotice);
}

async function performCrawl() {
  const sourceResults = await Promise.all(SOURCES.map(async (source) => {
    try {
      const items = await crawlSource(source);
      return { source, status: "live", items, error: null };
    } catch (error) {
      return {
        source,
        status: "error",
        items: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }));

  let items = sourceResults.flatMap((result) => result.items);
  items = [...new Map(items.map((item) => [item.url, item])).values()]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const currentIds = new Set(items.map(item => item.id));
  for (const id of noticeImages.keys()) if (!currentIds.has(id)) noticeImages.delete(id);

  const liveCount = sourceResults.filter((result) => result.status === "live").length;
  const mode = liveCount === SOURCES.length ? "live" : liveCount === 0 ? "error" : "mixed";
  return {
    mode,
    fetchedAt: new Date().toISOString(),
    total: items.length,
    sources: sourceResults.map(({ source, status, error, items: sourceItems }) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      status,
      count: sourceItems.length,
      error,
    })),
    items,
  };
}

async function getNotices(force = false) {
  if (cache && Date.now() - cache.cachedAt < 30_000) return cache.payload;
  if (!force && cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) return cache.payload;
  if (crawlPromise) return crawlPromise;

  crawlPromise = performCrawl()
    .then((payload) => {
      cache = { cachedAt: Date.now(), payload };
      return payload;
    })
    .finally(() => {
      crawlPromise = null;
    });
  return crawlPromise;
}


async function getNoticeImage(id) {
  const entry = noticeImages.get(id);
  if (!entry) return null;
    if (!entry.bytes) {
      if (entry.src.startsWith("data:")) {
        entry.type = entry.src.slice(5, entry.src.indexOf(";"));
        entry.bytes = Buffer.from(entry.src.slice(entry.src.indexOf(",") + 1), "base64");
      } else {
        let target = entry.src;
        let remote;
        for (let redirects = 0; redirects < 4; redirects++) {
          if (!safeImage(target, target)) throw new Error("허용되지 않은 이미지 주소");
          remote = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
          if (remote.status >= 300 && remote.status < 400) {
            target = new URL(remote.headers.get("location"), target).href;
            await remote.body?.cancel();
          } else break;
        }
        if (!remote.ok) throw new Error("이미지 응답 실패");
        const chunks = []; let size = 0;
        for await (const chunk of remote.body) {
          size += chunk.length;
          if (size > 12 * 1024 * 1024) throw new Error("이미지 크기 초과");
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        // Attachment endpoints may return application/octet-stream; inspect signatures.
        const hex = bytes.subarray(0, 12).toString("hex");
        entry.type = hex.startsWith("89504e470d0a1a0a") ? "image/png" : hex.startsWith("ffd8ff") ? "image/jpeg" : bytes.subarray(0, 3).toString() === "GIF" ? "image/gif" : bytes.subarray(8, 12).toString() === "WEBP" ? "image/webp" : null;
        if (!entry.type) throw new Error("지원하지 않는 이미지 형식");
        entry.bytes = bytes;
      }
    }

  return { bytes: entry.bytes, contentType: entry.type };
}

export { getNotices, getNoticeImage, parseKmuMainList, parseKmuCsList,
  parseDetail, parseDetailImage, normalizeNotice, normalizeDate,
  cleanText, classifyCategory, extractDeadline };
