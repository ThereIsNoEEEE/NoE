"use client";

import * as React from "react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_PROFILES, NAVIGATION } from "@/data/profile";
import {
  validateInterest,
  PROFILE_STORAGE_KEY,
  SAVED_STORAGE_KEY,
  ONBOARDED_STORAGE_KEY,
  readStorage,
  writeStorage,
  loadProfile,
} from "@/lib/profile";
import { rankNotices, getTopNotices } from "@/lib/recommendations";
import { loadNoticeData } from "@/services/notices";
import { Icon } from "./Icon";
import { ProfilePanel } from "./ProfilePanel";
import { SummaryPanel } from "./SummaryPanel";
import { NoticeList } from "./NoticeList";
import { NoticeDetail } from "./NoticeDetail";
import { HomeDashboard } from "./HomeDashboard";
import { NoticeFeed } from "./NoticeFeed";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { ChatbotWidget } from "./ChatbotWidget";
import { CollectedNotices } from "./CollectedNotices";
import { ProfileDialog } from "./ProfileDialog";
import { NoticeSources } from "./NoticeSources";
export function CampusDashboard() {
  React.useEffect(() => {
    const applyTheme = (theme) => {
      if (theme !== "dark" && theme !== "light") return;
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem("kmu-pick-theme", theme); } catch {}
    };
    applyTheme(new URLSearchParams(window.location.search).get("theme"));
    const receiveTheme = (event) => {
      if (!["http://localhost:3200", "http://127.0.0.1:3200"].includes(event.origin)) return;
      if (event.data?.type === "kmu-compare-theme") applyTheme(event.data.theme);
    };
    window.addEventListener("message", receiveTheme);
    return () => window.removeEventListener("message", receiveTheme);
  }, []);
  const today = React.useMemo(() => new Date(), []);
  const [profile, setProfile] = React.useState(loadProfile);
  const [onboarded, setOnboarded] = React.useState(
    () => readStorage(ONBOARDED_STORAGE_KEY, !1) === !0,
  );
  const [profileDialogOpen, setProfileDialogOpen] = React.useState(() => {
    const preview = new URLSearchParams(window.location.search).get("preview");
    if (preview === "home") return false;
    return preview === "onboarding" || !readStorage(ONBOARDED_STORAGE_KEY, false);
  });
  const [view, setView] = React.useState("home");
  const [savedIds, setSavedIds] = React.useState(() =>
    readStorage(SAVED_STORAGE_KEY, []),
  );
  const [notices, setNotices] = React.useState([]);
  const [analysis, setAnalysis] = React.useState({});
  const [dataStatus, setDataStatus] = React.useState({
    kind: null,
    mode: null,
  });
  const [loading, setLoading] = React.useState(!0);
  const [filter, setFilter] = React.useState("all");
  const [selectedNoticeId, setSelectedNoticeId] = React.useState(null);
  const [toast, setToast] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(!1);
  const toastTimer = React.useRef(null);
  const showToast = React.useCallback((S) => {
    setToast(S);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2300);
  }, []);
  React.useEffect(() => () => clearTimeout(toastTimer.current), []);
  React.useEffect(() => writeStorage(PROFILE_STORAGE_KEY, profile), [profile]);
  React.useEffect(() => writeStorage(SAVED_STORAGE_KEY, savedIds), [savedIds]);
  const applyNoticeData = React.useCallback(
    ({ source, notices, analysis, mode }) => {
      setNotices(notices);
      setAnalysis(analysis);
      setDataStatus({ kind: source, mode });
      setLoading(false);
    },
    [],
  );
  const refreshNotices = React.useCallback(async () => {
    const result = await loadNoticeData();
    applyNoticeData(result);
    return result.source;
  }, [applyNoticeData]);
  React.useEffect(() => {
    let active = true;
    loadNoticeData().then((result) => {
      if (active) applyNoticeData(result);
    });
    return () => {
      active = false;
    };
  }, [applyNoticeData]);
  const analyzedNotices = React.useMemo(
    () =>
      notices.map((S) => ({
        ...S,
        ...(analysis[S.id] || {}),
      })),
    [notices, analysis],
  );
  const ranked = React.useMemo(
    () => rankNotices(profile, analyzedNotices, today),
    [profile, analyzedNotices, today],
  );
  // TOP 3: 제외 조건 → 점수 → 정렬 → 상위 3개 (TOP3_산출기준.md)
  const top3 = React.useMemo(
    () => getTopNotices(profile, analyzedNotices, today),
    [profile, analyzedNotices, today],
  );
  const summary = React.useMemo(() => {
    var S;
    return {
      total: notices.length,
      expired: notices.length - ranked.length,
      recommended: ranked.filter((D) => D.score.total >= 60).length,
      urgent: ranked.filter((D) => D.score.dday !== null && D.score.dday <= 7)
        .length,
      topScore: ((S = ranked[0]) == null ? void 0 : S.score.total) ?? 0,
    };
  }, [notices, ranked]);
  const eligibleNotices = React.useMemo(
    () =>
      ranked.filter(
        (S) => S.score.targetStatus === "ok" && S.score.total >= 50,
      ),
    [ranked],
  );
  const upcomingNotices = React.useMemo(
    () =>
      ranked
        .filter((S) => S.score.dday !== null && S.score.dday <= 7)
        .sort((S, D) => S.score.dday - D.score.dday),
    [ranked],
  );
  const savedNotices = React.useMemo(
    () => ranked.filter((S) => savedIds.includes(S.notice.id)),
    [ranked, savedIds],
  );
  const j = React.useMemo(
    () =>
      ranked.filter(
        (S) =>
          /행정|학사/.test(S.notice.boardName || "") ||
          (S.notice.category || []).includes("수강신청"),
      ).length,
    [ranked],
  );
  const selectedNotice =
    ranked.find((S) => S.notice.id === selectedNoticeId) || null;
  const updateProfile = (S) =>
    setProfile((D) => ({
      ...D,
      ...S,
    }));
  const toggleInterest = (S) =>
    setProfile((D) => ({
      ...D,
      interests: D.interests.includes(S)
        ? D.interests.filter((Me) => Me !== S)
        : [...D.interests, S],
    }));
  const addInterest = (S) => {
    const D = validateInterest(S, profile.customInterests);
    if (D.ok) {
      setProfile((Me) => ({
        ...Me,
        customInterests: [...Me.customInterests, D.value],
        interests: [...Me.interests, D.value],
      }));
    }
    return D;
  };
  const removeInterest = (S) =>
    setProfile((D) => ({
      ...D,
      customInterests: D.customInterests.filter((Me) => Me !== S),
      interests: D.interests.filter((Me) => Me !== S),
    }));
  const applyPreset = (S) => {
    setProfile((D) => ({
      ...D,
      ...DEMO_PROFILES[S].profile,
    }));
    showToast(`${DEMO_PROFILES[S].label} 프로필로 순위를 다시 계산했어요.`);
  };
  const toggleSaved = (S) => {
    const D = savedIds.includes(S);
    setSavedIds(D ? savedIds.filter((Me) => Me !== S) : [...savedIds, S]);
    showToast(D ? "저장을 취소했어요." : "관심 공지로 저장했어요.");
  };
  const navigate = (S) => {
    setMenuOpen(!1);
    setView(S);
    if (S === "notice") {
      setFilter("all");
    }
    window.scrollTo({
      top: 0,
    });
  };
  const saveProfile = () => {
    if (profile.interests.length === 0) {
      showToast("관심 분야를 1개 이상 선택해 주세요.");
      return;
    }
    if (onboarded) {
      showToast("나의 정보를 저장했어요. 추천 순위를 다시 계산했어요.");
    } else {
      setOnboarded(!0);
      writeStorage(ONBOARDED_STORAGE_KEY, !0);
      showToast("프로필을 저장했어요. 맞춤 공지를 골라드릴게요!");
    }
    setProfileDialogOpen(false);
    navigate("home");
  };
  const handleRefresh = async () => {
    setLoading(true);
    const S = await refreshNotices();
    showToast(
      S === "qdrant"
        ? "수집된 국민대 공지를 다시 불러왔어요."
        : "수집에 실패해 샘플 데이터를 사용 중이에요.",
    );
  };
  const dateLabel = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  const profileLabel = `학부생 · ${profile.major} ${profile.grade}학년`;
  const counts = {
    notice: ranked.length,
    benefit: eligibleNotices.length,
    schedule: upcomingNotices.length,
    saved: savedIds.length,
  };
  const tiles = [
    {
      view: "notice",
      label: "맞춤 공지",
      value: summary.recommended,
      unit: "건",
      note: "점수 60점 이상",
    },
    {
      view: "benefit",
      label: "지원 가능",
      value: eligibleNotices.length,
      unit: "개",
      note: "내가 대상인 공지",
    },
    {
      view: "schedule",
      label: "이번 주 일정",
      value: upcomingNotices.length,
      unit: "개",
      note: "D-7 이내 마감",
    },
    {
      view: "notice",
      label: "확인할 행정",
      value: j,
      unit: "건",
      note: "학사·행정 공지",
    },
  ];
  const statusIndicators = (
    <div className="status-row" aria-live="polite">
      {dataStatus.kind === "qdrant" && (
        <span className="status-pill">
          <i />
          {"국민대 홈페이지 수집 공지 "}
          {summary.total}
          {"건 수집"}
        </span>
      )}
      {dataStatus.kind === "sample" && (
        <span className="status-pill warn">
          <i />
          {"홈페이지 수집 실패 → 샘플 데이터 사용 중"}
        </span>
      )}
      {dataStatus.mode === "ai" && (
        <span className="status-pill">
          <i />
          {"AI 분석"}
        </span>
      )}
      {dataStatus.mode === "mock" && (
        <span className="status-pill warn">
          <i />
          {"AI 서버 미연결 → 규칙 기반 분석"}
        </span>
      )}
      {dataStatus.mode === "mixed" && (
        <span className="status-pill warn">
          <i />
          {"AI 분석 + 일부 규칙 기반 대체"}
        </span>
      )}
    </div>
  );
  const renderProfile = (S, wide = false) => (
    <ProfilePanel
      wide={wide}
      profile={profile}
      onChange={updateProfile}
      onToggleInterest={toggleInterest}
      onAddCustom={addInterest}
      onRemoveCustom={removeInterest}
      onPreset={applyPreset}
      onSearch={saveProfile}
      searching={!1}
      buttonLabel={S}
    />
  );
  const loadingCards = (
    <div
      className="home-grid grid grid-cols-1 gap-4 min-[1121px]:grid-cols-3"
      aria-busy="true"
    >
      <div className="skeleton tall" />
      <div className="skeleton tall" />
      <div className="skeleton tall" />
    </div>
  );
  let content;
  if (view === "settings") {
    content = (
      <section>
        <div className="section-head">
          <div>
            <div className="eyebrow">{"MY INFO"}</div>
            <h2 className="home-h">{"나의 정보"}</h2>
            <p>
              {"바꾸면 추천 순위가 바로 달라져요. 저장하면 홈으로 돌아가요."}
            </p>
          </div>
        </div>
        {renderProfile("저장하고 추천 보기", true)}
        <NoticeSources college={profile.college} />
        <CollectedNotices />
      </section>
    );
  } else {
    if (loading) {
      content = loadingCards;
    } else {
      if (view === "home") {
        content = (
          <HomeDashboard
            top3={top3}
            savedIds={savedIds}
            onSave={toggleSaved}
            onOpen={(S) => setSelectedNoticeId(S.notice.id)}
            tiles={tiles}
            onGo={navigate}
            who={profileLabel}
          />
        );
      } else {
        if (view === "notice") {
          content = (
            <Fragment>
              <SummaryPanel
                total={summary.total}
                expired={summary.expired}
                recommended={summary.recommended}
                urgent={summary.urgent}
                topScore={summary.topScore}
              />
              <NoticeList
                top3={top3}
                ranked={ranked}
                savedIds={savedIds}
                onSave={toggleSaved}
                onOpen={(S) => setSelectedNoticeId(S.notice.id)}
                filter={filter}
                onFilter={setFilter}
              />
            </Fragment>
          );
        } else {
          if (view === "benefit") {
            content = (
              <NoticeFeed
                eyebrow="BENEFIT CHECK"
                title="지원 가능한 공지"
                desc="내 학적·학년 조건에 맞고 점수가 50점 이상인 공지예요."
                items={eligibleNotices}
                onOpen={(S) => setSelectedNoticeId(S.notice.id)}
                empty="지원 가능한 공지가 아직 없어요. 나의 정보에서 관심 분야를 늘려 보세요."
              />
            );
          } else {
            if (view === "schedule") {
              content = (
                <NoticeFeed
                  eyebrow="WEEKLY PLAN"
                  title="이번 주 일정"
                  desc="7일 안에 마감되는 공지를 마감 임박 순으로 정리했어요."
                  items={upcomingNotices}
                  onOpen={(S) => setSelectedNoticeId(S.notice.id)}
                  empty="이번 주 안에 마감되는 공지가 없어요."
                />
              );
            } else {
              content = (
                <NoticeFeed
                  eyebrow="SAVED"
                  title="저장한 항목"
                  desc="관심 공지로 저장한 목록이에요."
                  items={savedNotices}
                  onOpen={(S) => setSelectedNoticeId(S.notice.id)}
                  empty="저장한 공지가 아직 없어요. 카드의 저장 버튼을 눌러 보세요."
                />
              );
            }
          }
        }
      }
    }
  }
  return (
    <div className="shell">
      <aside
        className={`sidebar${menuOpen ? " open" : ""}`}
        aria-label="주요 메뉴"
      >
        <div className="brand">
          <span className="brand-mark">{"K"}</span>
          <span>
            {"KMU Pick AI"}
            <small>{"PERSONAL NOTICE RADAR"}</small>
          </span>
        </div>
        <div className="nav-title">{"MY CAMPUS"}</div>
        <nav className="nav-list">
          {NAVIGATION.map((S) => (
            <Button
              variant="original"
              key={S.view}
              className={`nav-item${view === S.view ? " active" : ""}`}
              onClick={() => navigate(S.view)}
            >
              <Icon name={S.icon} />
              {S.label}
              {counts[S.view] !== void 0 && (
                <span className="count">{counts[S.view]}</span>
              )}
            </Button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Button
            variant="original"
            className="profile-mini profile-link"
            onClick={() => navigate("settings")}
            aria-label="나의 정보 열기"
          >
            <div className="avatar">
              {"학"}
            </div>
            <div>
              <strong>{"내 프로필"}</strong>
              <span>{profileLabel}</span>
            </div>
          </Button>
        </div>
      </aside>
      <main className="main" id="top">
        <header className="topbar">
          <div className="mobile-bar">
            <Button
              variant="original"
              onClick={() => setMenuOpen((S) => !S)}
              aria-label="메뉴 열기"
            >
              <Icon name="menu" />
            </Button>
            <strong>{"KMU Pick AI"}</strong>
          </div>
          <div className="term desktop-term">
            <span className="live-dot" />
            {dateLabel}
            {" · "}
            {dataStatus.kind === "qdrant"
              ? "국민대 홈페이지 수집 공지 (Qdrant)"
              : dataStatus.kind === "sample"
                ? "Local Sample Data (수집 실패 대체)"
                : "공지 수집 중…"}
          </div>
          <div className="top-actions">
            <NotificationBell
              onNew={(items) => showToast(items.length > 1 ? `새 공지 ${items.length}건이 올라왔어요.` : `새 공지: ${items[0].title}`)}
            />
            <ThemeToggle />
            <Button
              variant="original"
              className="icon-btn"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="공지 다시 수집"
            >
              <Icon
                name="refresh"
                className={`icon${loading ? " spin" : ""}`}
              />
            </Button>
          </div>
        </header>
        <div className="content">
          {view !== "settings" && statusIndicators}
          {content}
          <footer className="footer">
            <span>
              {"KMU Pick AI · HACKATHON MVP · "}
              <a href="/business">{"비즈니스 가치 검증"}</a>
            </span>
            <span>
              {
                "공지 원문은 국민대학교 공식 홈페이지 기준이며, 점수·요약은 참고용입니다. 지원 자격과 마감일은 반드시 원문에서 확인하세요."
              }
            </span>
          </footer>
        </div>
      </main>
      <ProfileDialog open={profileDialogOpen} onClose={() => setProfileDialogOpen(false)}>
        {renderProfile("저장하고 맞춤 공지 보기")}
        {toast && <p className="dialog-feedback" role="status">{toast}</p>}
      </ProfileDialog>
      <ChatbotWidget profile={profile} />
      <NoticeDetail
        item={selectedNotice}
        saved={
          selectedNotice ? savedIds.includes(selectedNotice.notice.id) : !1
        }
        onSave={toggleSaved}
        onClose={() => setSelectedNoticeId(null)}
      />
      <div
        className={`toast${toast ? " show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
