import { INTEREST_KEYWORDS, SCHOOLS } from "@/data/profile";
import { calculateDDay, formatDDay, parseDate, startOfDay } from "@/lib/dates";

function matchesKeyword(e, t) {
  const n = String(t || "")
    .trim()
    .toLowerCase();
  if (!n) return !1;
  const r = String(e || "").toLowerCase();
  if (/^[a-z0-9 .+#]+$/.test(n)) {
    const l = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${l}([^a-z0-9]|$)`).test(r);
  }
  return r.includes(n);
}

function getInterestKeywords(e) {
  return INTEREST_KEYWORDS[e] || [String(e).toLowerCase()];
}

const SCORE_WEIGHTS = {
  interest: 40,
  target: 30,
  urgency: 20,
  keyword: 10,
};

const KNOWN_SCHOOL_UNITS = [
  ...new Set(
    Object.values(SCHOOLS).flatMap((e) =>
      Object.entries(e).flatMap(([t, n]) => [t, ...n]),
    ),
  ),
].filter((e) => e.length >= 4);

const KNOWN_COLLEGES = Object.values(SCHOOLS).flatMap((e) => Object.keys(e));

function getNoticeSearchText(e) {
  return [
    e.title,
    (e.keywords || []).join(" "),
    (e.category || []).join(" "),
    e.summary,
  ].join(" ");
}

function getNoticeFullText(e) {
  return `${getNoticeSearchText(e)} ${(e.content || "").slice(0, 800)}`;
}

function calculateUrgencyScore(e) {
  return e === null
    ? 8
    : e < 0
      ? 0
      : e <= 3
        ? 20
        : e <= 7
          ? 16
          : e <= 14
            ? 12
            : e <= 30
              ? 8
              : 4;
}

// "소프트웨어학부" → ["소프트웨어학부", "소프트웨어"]; 너무 짧은 핵심어(예: "법")는 쓰지 않는다.
function getMajorTerms(major) {
  const full = String(major || "").trim();
  if (full.length < 2) return [];
  const core = full.replace(/(학부|학과|전공)$/, "");
  return core !== full && core.length >= 2 ? [full, core] : [full];
}

// 공지 출처 단과대(sourceName)와 본문을 나의 단과대·학과와 비교한다 (최대 15점).
//  major   : 공지에 내 학과가 나온다            → 15
//  college : 내 단과대 게시판 공지              → 12
//  general : 소속 구분 없는 공지                → 8
//  other-college : 다른 단과대 게시판 공지       → 0
//  other   : 다른 소속만 언급                   → 0
// 공지 출처 이름이 단과대 목록 이름과 다른 경우
const UNIT_ALIASES = { KIBS: "KMU International Business School" };

function calculateUnitMatch(profile, notice, text) {
  const rawUnit = String(notice.sourceName || "").replace(/^국민대학교\s*/, "").trim();
  const sourceUnit = UNIT_ALIASES[rawUnit] || rawUnit;
  const college = String(profile.college || "").trim();
  const sameCollege = (unit) => Boolean(unit && college && (unit.includes(college) || college.includes(unit)));
  if (getMajorTerms(profile.major).some((term) => matchesKeyword(`${notice.title} ${text}`, term))) {
    return { points: 15, match: "major", sourceUnit };
  }
  if (sameCollege(sourceUnit)) return { points: 12, match: "college", sourceUnit };
  const sourceIsCollege = KNOWN_COLLEGES.some((c) => sourceUnit && (sourceUnit.includes(c) || c.includes(sourceUnit)));
  const mentionsOtherUnit = KNOWN_SCHOOL_UNITS.some((u) => text.includes(u) && !sameCollege(u));
  if (sourceIsCollege) return { points: 0, match: "other-college", sourceUnit };
  if (mentionsOtherUnit) return { points: 0, match: "other", sourceUnit };
  return { points: 8, match: "general", sourceUnit };
}

function calculateOpportunityScore(e, t, n = new Date()) {
  const r = getNoticeSearchText(t);
  const l = getNoticeFullText(t);
  const o = (e.interests || []).filter((c) => {
    if ((t.category || []).includes(c)) return !0;
    const m = c in INTEREST_KEYWORDS ? r : l;
    return getInterestKeywords(c).some((y) => matchesKeyword(m, y));
  });
  const s = o.length === 0 ? 0 : o.length === 1 ? 28 : 40;
  // 지원 대상 적합성(30) = 학적 10 + 학년 5 + 소속(단과대·학과) 15
  const a = t.target || [];
  let f = 0;
  let p = "ok";
  const unit = calculateUnitMatch(e, t, l);
  if (a.length > 0 && !a.includes(e.studentType)) {
    p = "no";
  } else {
    f = a.length === 0 ? 6 : 10;
    if (a.length === 0) p = "unknown";
    const c = t.grades || [];
    if (c.length === 0 || c.includes(Number(e.grade))) {
      f += 5;
    } else if (p === "ok") {
      p = "grade";
    }
    f += unit.points;
    if (unit.match.startsWith("other") && p === "ok") {
      p = "unit";
    }
  }
  const h = calculateDDay(t.deadline, n);
  const v = h !== null && h < 0;
  const g = calculateUrgencyScore(h);
  const x = (e.keywords || []).filter((c) => matchesKeyword(l, c));
  const k = x.length === 0 ? 0 : x.length === 1 ? 6 : 10;
  const d = {
    total: Math.max(0, Math.min(100, s + f + g + k)),
    parts: {
      interest: s,
      target: f,
      urgency: g,
      keyword: k,
    },
    matchedInterests: o,
    matchedKeywords: x,
    targetStatus: p,
    unitMatch: unit.match,
    sourceUnit: unit.sourceUnit,
    dday: h,
    expired: v,
  };
  return ((d.reason = buildRecommendationReason(d, e)), d);
}

function buildRecommendationReason(e, t) {
  const n = (l) =>
    l
      .slice(0, 3)
      .map((i) => `'${i}'`)
      .join("·");
  const r = [];
  return (
    e.matchedInterests.length &&
      r.push(`관심 분야 ${n(e.matchedInterests)} 일치`),
    e.targetStatus === "ok"
      ? r.push(`${t.studentType}생 지원 가능`)
      : e.targetStatus === "grade"
        ? r.push(`${t.studentType}생 대상이지만 학년 조건 확인 필요`)
        : e.targetStatus === "unit"
          ? r.push("다른 소속 대상일 수 있어 확인 필요")
          : e.targetStatus === "no"
            ? r.push(`${t.studentType}생 대상이 아닐 수 있어요`)
            : r.push("지원 대상이 명시되지 않아 원문 확인 필요"),
    e.unitMatch === "major"
      ? r.push(`내 학과(${t.major}) 관련`)
      : e.unitMatch === "college" && r.push(`내 단과대(${e.sourceUnit}) 공지`),
    e.matchedKeywords.length && r.push(`키워드 ${n(e.matchedKeywords)} 포함`),
    e.dday === null
      ? r.push("마감일 미확인(원문 확인)")
      : e.dday >= 0 &&
        r.push(
          e.dday <= 7
            ? `마감 ${formatDDay(e.dday)} 임박`
            : `마감 ${formatDDay(e.dday)}`,
        ),
    r.join(" · ")
  );
}

// 점수 내림차순 → 마감 임박 → 최신 게시 → id (같은 입력이면 항상 같은 순서)
function compareRanked(r, l) {
  if (l.score.total !== r.score.total) return l.score.total - r.score.total;
  const i = r.score.dday ?? 9999;
  const o = l.score.dday ?? 9999;
  return i !== o
    ? i - o
    : String(l.notice.date).localeCompare(String(r.notice.date)) ||
        String(r.notice.id).localeCompare(String(l.notice.id));
}

function rankNotices(e, t, n = new Date()) {
  return t
    .map((r) => ({
      notice: r,
      score: calculateOpportunityScore(e, r, n),
    }))
    .filter((r) => !r.score.expired)
    .sort(compareRanked)
    .map((r, l) => ({
      ...r,
      rank: l + 1,
    }));
}

// ---- TOP 3 산출 기준 (TOP3_산출기준.md) ----
const TOP_COUNT = 3;
const UNKNOWN_DEADLINE_MAX_AGE_DAYS = 30;

// TOP 3 후보에서 제외해야 하면 이유 코드를, 아니면 null 을 반환한다.
//  expired       : 접수 기간 지남 (오늘 마감 D-Day 는 포함)
//  target        : 지원 대상 학적이 내 학적과 다름
//  no-match      : 관심 분야·키워드가 하나도 안 맞음
//  stale-unknown : 마감일 미확인 + 게시 후 30일 초과
function getExclusionReason(notice, score, today = new Date()) {
  if (score.expired) return "expired";
  if (score.targetStatus === "no") return "target";
  if (score.matchedInterests.length === 0 && score.matchedKeywords.length === 0)
    return "no-match";
  if (score.dday === null) {
    const posted = parseDate(notice.date);
    if (
      posted &&
      Math.round((startOfDay(today) - posted) / 864e5) >
        UNKNOWN_DEADLINE_MAX_AGE_DAYS
    )
      return "stale-unknown";
  }
  return null;
}

// 수집·분석된 공지 → TOP 3. 제외 → 점수 → 정렬 → 상위 3개.
// 후보가 3개 미만이면 있는 만큼만 반환한다 (빈자리를 채우지 않음).
function getTopNotices(profile, notices, today = new Date(), count = TOP_COUNT) {
  return (Array.isArray(notices) ? notices : [])
    .map((notice) => ({
      notice,
      score: calculateOpportunityScore(profile, notice, today),
    }))
    .filter((x) => getExclusionReason(x.notice, x.score, today) === null)
    .sort(compareRanked)
    .slice(0, count)
    .map((x, i) => ({
      ...x,
      rank: i + 1,
      deadlineUnknown: x.score.dday === null,
    }));
}

export {
  matchesKeyword,
  getInterestKeywords,
  SCORE_WEIGHTS,
  KNOWN_SCHOOL_UNITS,
  getNoticeSearchText,
  getNoticeFullText,
  calculateUrgencyScore,
  calculateOpportunityScore,
  buildRecommendationReason,
  rankNotices,
  TOP_COUNT,
  UNKNOWN_DEADLINE_MAX_AGE_DAYS,
  getExclusionReason,
  getTopNotices,
};
