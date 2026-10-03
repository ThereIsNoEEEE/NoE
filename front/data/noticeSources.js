// 국민대학교 공지 소스 목록 (2026년 10월 3일 기준, 총 17개) — 국민대학교_공지_소스_목록.html 기준.
// 단과대학·학부/학과 선택지(SCHOOLS.학부)와 "나의 정보" 화면의 공지 소스 표가 이 데이터를 함께 쓴다.
const NOTICE_SOURCES_AS_OF = "2026년 10월 3일";

const NOTICE_SOURCES = [
  {
    college: "국민대학교 전체",
    isCollege: false,
    majors: ["전체"],
    url: "https://www.kookmin.ac.kr/user/kmuNews/notice/index.do",
    kind: "학교 전체 공지",
  },
  {
    college: "글로벌인문·지역대학",
    majors: ["한국어문학부", "영어영문학부", "중어중문학과", "한국역사학과"],
    url: "https://humanities.kookmin.ac.kr/humanities/notice/notice_college.do",
    kind: "단과대 + 학부별 게시판 존재",
  },
  {
    college: "사회과학대학",
    majors: [
      "행정학과",
      "정치외교학과",
      "사회학과",
      "미디어·광고학부",
      "교육학과",
      "러시아·유라시아학과",
      "동아시아국제학부",
      "글로벌기후환경융합학부",
      "글로벌공생융합학부",
    ],
    url: "https://social.kookmin.ac.kr/social/menu/social_notice.do",
    kind: "단과대 공지",
  },
  {
    college: "법과대학",
    majors: ["법학부", "기업융합법학과"],
    url: "https://law.kookmin.ac.kr/law/etc-board/notice01.do",
    kind: "법대 통합 공지",
  },
  {
    college: "경상대학",
    majors: ["경제학과", "국제통상학과"],
    url: "https://kyungsang.kookmin.ac.kr/community/board/notice/",
    kind: "대학공지",
  },
  {
    college: "공과대학",
    majors: [
      "신소재공학부",
      "기계공학부",
      "건설시스템공학부",
      "전자공학부",
      "양자보안차세대통신학부",
    ],
    url: "https://engineering.kookmin.ac.kr/engineering/etc-board/eng-notice.do",
    kind: "공대 공지",
  },
  {
    college: "조형대학",
    majors: [
      "공업디자인학과",
      "시각디자인학과",
      "금속공예학과",
      "도자공예학과",
      "의상디자인학과",
      "공간디자인학과",
      "영상디자인학과",
      "자동차·운송디자인학과",
      "AI디자인학과",
    ],
    url: "https://design.kookmin.ac.kr/community/notice/",
    kind: "학사 중심",
  },
  {
    college: "과학기술대학",
    majors: [
      "산림환경시스템학과",
      "임산생명공학과",
      "나노전자물리학과",
      "응용화학부",
      "식품영양학과",
      "정보보안암호수학과",
      "융합바이오공학과",
    ],
    url: "https://cst.kookmin.ac.kr/community/notice/",
    kind: "학과 필터 지원",
  },
  {
    college: "예술대학",
    majors: ["음악학부", "미술학부", "공연예술학부"],
    url: "https://art.kookmin.ac.kr/community/notice/",
    kind: "대학공지",
  },
  {
    college: "체육대학",
    majors: ["스포츠교육학과", "스포츠산업레저학과", "스포츠건강재활학과"],
    url: "https://sport.kookmin.ac.kr/sports/notice/notice01.do",
    kind: "대학 통합공지",
  },
  {
    college: "경영대학",
    majors: [
      "경영학부",
      "경영정보학부",
      "AI빅데이터융합경영학과",
      "기업경영학부",
      "회계세무학과",
    ],
    url: "https://biz.kookmin.ac.kr/community/notice/",
    kind: "학사·취업·국제교류·행사·장학 분류",
  },
  {
    college: "소프트웨어융합대학",
    majors: ["소프트웨어학부", "인공지능학부"],
    url: "https://cs.kookmin.ac.kr/news/notice/",
    kind: "학사 / 취업 / 장학 / 행사 별도",
  },
  {
    college: "건축대학",
    majors: ["건축학부"],
    url: "https://archi.kookmin.ac.kr/life/notice/",
    kind: "대학공지",
  },
  {
    college: "자동차모빌리티대학",
    majors: [
      "자동차공학과",
      "자동차IT융합학과",
      "미래자동차학부",
      "미래모빌리티학과",
      "전공자율선택",
    ],
    url: "https://auto.kookmin.ac.kr/board/notice/",
    kind: "학사공지 중심",
  },
  {
    college: "미래융합대학",
    majors: ["인문기술융합학부"],
    url: "https://kmu-cts.kookmin.ac.kr/kmu-cts/etc/sitemap016.do",
    kind: "대학공지",
  },
  {
    college: "KMU International Business School",
    majors: ["KMU International Business School", "International Business"],
    url: "https://kibs.kookmin.ac.kr/notice/",
    kind: "학사·행사·장학 통합",
  },
  {
    college: "교양대학",
    majors: ["별도 학위 학부 없음"],
    majorsNote: "별도 학위 학부 없음 — 기초교양·핵심교양·자유교양 등 담당",
    url: "https://culture.kookmin.ac.kr/community/notice/",
    kind: "교양 관련 공지",
  },
];

// 학부 단과대학 → 학부·학과 (선택지). '국민대학교 전체'는 단과대학이 아니므로 제외한다.
const UNDERGRAD_SCHOOLS = Object.fromEntries(
  NOTICE_SOURCES.filter((s) => s.isCollege !== false).map((s) => [
    s.college,
    s.majors,
  ]),
);

export { NOTICE_SOURCES_AS_OF, NOTICE_SOURCES, UNDERGRAD_SCHOOLS };
