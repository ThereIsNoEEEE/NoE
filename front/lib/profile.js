import { DEFAULT_INTERESTS, DEFAULT_PROFILE, SCHOOLS } from "@/data/profile";

const MAX_INPUT_LENGTH = 20;

const normalizeInput = (e) => String(e).trim().replace(/\s+/g, " ");

const normalizeInputKey = (e) => normalizeInput(e).toLowerCase();

function validateInterest(e, t = []) {
  const n = normalizeInput(e ?? "");
  return n
    ? n.length > MAX_INPUT_LENGTH
      ? {
          ok: !1,
          error: `${MAX_INPUT_LENGTH}자 이내로 입력해 주세요.`,
        }
      : [...DEFAULT_INTERESTS, ...t]
            .map(normalizeInputKey)
            .includes(normalizeInputKey(n))
        ? {
            ok: !1,
            error: "이미 있는 관심 분야예요.",
          }
        : {
            ok: !0,
            value: n,
          }
    : {
        ok: !1,
        error: "관심 분야를 입력해 주세요.",
      };
}

function validateKeyword(e, t = []) {
  const n = normalizeInput(e ?? "");
  return n
    ? n.length > MAX_INPUT_LENGTH
      ? {
          ok: !1,
          error: `${MAX_INPUT_LENGTH}자 이내로 입력해 주세요.`,
        }
      : t.map(normalizeInputKey).includes(normalizeInputKey(n))
        ? {
            ok: !1,
            error: "이미 추가한 키워드예요.",
          }
        : {
            ok: !0,
            value: n,
          }
    : {
        ok: !1,
        error: "키워드를 입력해 주세요.",
      };
}

const PROFILE_STORAGE_KEY = "kmu-pick-profile-v1";

const SAVED_STORAGE_KEY = "kmu-pick-saved-v1";

const ONBOARDED_STORAGE_KEY = "kmu-pick-onboarded-v1";

function readStorage(e, t) {
  try {
    const n = localStorage.getItem(e);
    return n ? JSON.parse(n) : t;
  } catch {
    return t;
  }
}

function writeStorage(e, t) {
  try {
    localStorage.setItem(e, JSON.stringify(t));
  } catch {}
}

function loadProfile() {
  var t;
  const e = {
    ...DEFAULT_PROFILE,
    ...readStorage(PROFILE_STORAGE_KEY, {}),
  };
  return (t = SCHOOLS[e.studentType]) != null && t[e.college]
    ? !Array.isArray(e.interests) ||
      !Array.isArray(e.customInterests) ||
      !Array.isArray(e.keywords)
      ? {
          ...DEFAULT_PROFILE,
        }
      : e
    : {
        ...DEFAULT_PROFILE,
      };
}

export {
  MAX_INPUT_LENGTH,
  normalizeInput,
  normalizeInputKey,
  validateInterest,
  validateKeyword,
  PROFILE_STORAGE_KEY,
  SAVED_STORAGE_KEY,
  ONBOARDED_STORAGE_KEY,
  readStorage,
  writeStorage,
  loadProfile,
};
