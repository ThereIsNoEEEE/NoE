const iconPaths = {
  home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  radar:
    "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  list: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5",
  bookmark: "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  menu: "M4 7h16M4 12h16M4 17h16",
  alert: "M12 9v4M12 17h.01M10 3h4l8 18H2z",
  gift: "M20 12v8H4v-8M2 7h20v5H2zM12 7v13",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  calendar: "M3 5h18v16H3zM8 3v4M16 3v4M3 10h18",
};

const DEFAULT_INTERESTS = [
  "취업",
  "인턴",
  "장학금",
  "공모전",
  "AI/데이터",
  "특강",
  "대학원",
  "수강신청",
  "교환학생",
  "교내행사",
];

const INTEREST_KEYWORDS = {
  취업: ["취업", "채용", "일자리", "커리어", "진로"],
  인턴: ["인턴"],
  장학금: ["장학", "학자금"],
  공모전: ["공모", "경진", "대회", "챌린지", "아이디어톤", "해커톤"],
  "AI/데이터": ["ai", "인공지능", "데이터", "머신러닝", "딥러닝", "생성형"],
  특강: ["특강", "세미나", "강연", "포럼", "컨퍼런스"],
  대학원: ["대학원"],
  수강신청: ["수강신청", "수강 신청", "강의평가", "폐강", "정정"],
  교환학생: ["교환학생", "교환 학생", "파견", "해외"],
  교내행사: ["행사", "축제", "캠프", "설명회", "오리엔테이션"],
};

const STUDENT_TYPES = ["학부", "대학원"];

const SCHOOLS = {
  학부: {
    창의공과대학: [
      "소프트웨어학부",
      "자동차공학과",
      "전자공학부",
      "신소재공학부",
    ],
    조형대학: [
      "시각디자인학과",
      "공업디자인학과",
      "공간디자인학과",
      "영상디자인학과",
    ],
    사회과학대학: ["행정학과", "정치외교학과", "사회학과", "미디어·광고학부"],
    경영대학: ["경영학부", "경영정보학부", "재무금융·회계학부"],
  },
  대학원: {
    소프트웨어융합대학원: ["AI", "소프트웨어", "데이터사이언스"],
    일반대학원: ["컴퓨터공학", "전자공학", "경영학", "디자인"],
    테크노디자인전문대학원: ["디자인", "공학"],
  },
};

const GRADES = {
  학부: [1, 2, 3, 4],
  대학원: [1, 2, 3],
};

const DEFAULT_PROFILE = {
  studentType: "대학원",
  college: "소프트웨어융합대학원",
  major: "AI",
  grade: 1,
  interests: ["취업", "인턴", "AI/데이터", "공모전"],
  customInterests: [],
  keywords: ["AI", "데이터", "해커톤"],
};

const DEMO_PROFILES = {
  A: {
    label: "사용자 A · AI 대학원생",
    profile: {
      studentType: "대학원",
      college: "소프트웨어융합대학원",
      major: "AI",
      grade: 1,
      interests: ["AI/데이터", "취업", "인턴", "공모전"],
      keywords: ["AI", "데이터", "해커톤"],
    },
  },
  B: {
    label: "사용자 B · 학부생",
    profile: {
      studentType: "학부",
      college: "창의공과대학",
      major: "소프트웨어학부",
      grade: 2,
      interests: ["장학금", "교환학생"],
      keywords: ["장학", "교환"],
    },
  },
};

const NOTICE_FILTERS = [
  {
    key: "all",
    label: "전체",
  },
  {
    key: "rec",
    label: "추천 (60+)",
  },
  {
    key: "urgent",
    label: "마감 임박",
  },
  {
    key: "saved",
    label: "저장한 공지",
  },
];

const SCORE_LABELS = [
  ["interest", "관심사 일치"],
  ["target", "지원 대상 적합성"],
  ["urgency", "마감 긴급도"],
  ["keyword", "관심 키워드"],
];

const NAVIGATION = [
  {
    view: "home",
    label: "홈",
    icon: "home",
  },
  {
    view: "notice",
    label: "맞춤 공지",
    icon: "radar",
  },
  {
    view: "benefit",
    label: "지원 가능",
    icon: "gift",
  },
  {
    view: "schedule",
    label: "이번 주 일정",
    icon: "calendar",
  },
  {
    view: "saved",
    label: "저장한 항목",
    icon: "bookmark",
  },
  {
    view: "settings",
    label: "나의 정보",
    icon: "settings",
  },
];

export {
  iconPaths,
  DEFAULT_INTERESTS,
  INTEREST_KEYWORDS,
  STUDENT_TYPES,
  SCHOOLS,
  GRADES,
  DEFAULT_PROFILE,
  DEMO_PROFILES,
  NOTICE_FILTERS,
  SCORE_LABELS,
  NAVIGATION,
};
