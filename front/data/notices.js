import { formatDate } from "@/lib/dates";

const OFFICIAL_NOTICE_URL =
  "https://www.kookmin.ac.kr/user/kmuNews/notice/index.do";

const SAMPLE_NOTICES = [
  {
    n: 1,
    age: 0,
    due: 3,
    board: "공모∙행사",
    title: "2026 AI 산학협력 인턴 모집",
    body: "AI·데이터 분야 기업 산학협력 인턴 참가자를 모집합니다. 대상: 대학원생 및 학부 재학생. 채용 연계형 인턴십이며 선발 인원은 기업별 상이합니다.",
  },
  {
    n: 2,
    age: 1,
    due: 7,
    board: "공모∙행사",
    title: "2026 KMU AI 해커톤 참가팀 모집",
    body: "인공지능과 데이터를 활용한 문제 해결 해커톤 참가팀을 모집합니다. 대학원생·학부생 모두 참여할 수 있으며 2~4인 팀으로 신청합니다.",
  },
  {
    n: 3,
    age: 1,
    due: 5,
    board: "특강공지",
    title: "[목요특강] 생성형 AI 활용 특강 신청 안내",
    body: "생성형 AI 실무 활용 사례와 AI 커리어 진로를 다루는 특강입니다. 재학생 및 대학원생 누구나 신청할 수 있으며 선착순 마감됩니다.",
  },
  {
    n: 4,
    age: 2,
    due: 10,
    board: "장학공지",
    title: "2026-2학기 성곡 인재 장학금 신청 안내",
    body: "학부 재학생 대상 장학금 신청을 안내합니다. 직전 학기 12학점 이상 이수 및 평점 기준을 충족해야 하며 2~4학년이 지원할 수 있습니다.",
  },
  {
    n: 5,
    age: 3,
    due: 12,
    board: "행정공지",
    title: "2026학년도 후기 교환학생 파견 모집",
    body: "해외 협정대학 교환학생 파견 모집입니다. 학부 재학생 대상이며 어학성적 증빙서류를 제출해야 합니다.",
  },
  {
    n: 6,
    age: 2,
    due: null,
    board: "행정공지",
    title: "학생지원 프로그램 마음건강 상담주간 참여자 모집",
    body: "학부 재학생과 대학원생이 참여할 수 있는 심리상담 및 학생지원 프로그램입니다. 상시 신청 가능합니다.",
  },
  {
    n: 7,
    age: 4,
    due: 14,
    board: "대학원입학공지",
    title: "대학원 신입생 입학설명회 안내",
    body: "대학원 진학을 준비하는 학생을 위한 입학설명회입니다. 대학원 전공 소개와 입학 전형을 안내합니다.",
  },
  {
    n: 8,
    age: 0,
    due: 2,
    board: "학사공지",
    title: "2026-2학기 수강신청 정정 기간 안내",
    body: "수강신청 정정 기간을 안내합니다. 학부 재학생 및 대학원생은 기간 내에 수강 과목을 정정할 수 있습니다.",
  },
  {
    n: 9,
    age: 3,
    due: 10,
    board: "공모∙행사",
    title: "[캠퍼스타운사업단] KMU 글로벌 창업 챌린지 참가자 모집",
    body: "창업 아이디어를 가진 재학생 및 대학원생을 대상으로 한 공모전입니다. 창업 팀 구성 후 신청하세요.",
  },
  {
    n: 10,
    age: 4,
    due: 20,
    board: "사회봉사",
    title: "캠퍼스 나눔 봉사활동 참여자 모집",
    body: "교내 봉사활동 참여자를 모집합니다. 학부 재학생과 대학원생 모두 신청 가능하며 봉사시간이 인정됩니다.",
  },
  {
    n: 11,
    age: 2,
    due: 9,
    board: "행정공지",
    title: "2026 하반기 채용박람회 참가 안내",
    body: "취업을 준비하는 3~4학년 학부 재학생 대상 채용박람회입니다. 기업 채용 상담과 현직자 멘토링이 진행됩니다.",
  },
  {
    n: 12,
    age: 1,
    due: 6,
    board: "학사공지",
    title: "연구윤리교육 이수 안내 (대학원생 필수)",
    body: "대학원생은 연구윤리교육을 이수해야 합니다. 연구 과제 참여자는 기한 내 온라인 교육을 완료하세요.",
  },
  {
    n: 13,
    age: 3,
    due: 15,
    board: "공모∙행사",
    title: "금융권 데이터 분석 공모전 참가자 모집",
    body: "금융 데이터를 활용한 분석 공모전입니다. 데이터 분석과 AI 모델링에 관심 있는 학부생·대학원생이 지원할 수 있습니다.",
  },
  {
    n: 14,
    age: 4,
    due: 4,
    board: "장학공지",
    title: "국가근로장학생 추가 모집",
    body: "학부 재학생 대상 국가근로장학생 추가 모집입니다. 소득구간 확인이 필요하며 장학 혜택이 제공됩니다.",
  },
  {
    n: 15,
    age: 9,
    due: -3,
    board: "학사공지",
    title: "2026 겨울 계절학기 신청 안내",
    body: "겨울 계절학기 신청 안내입니다. 신청 기간이 종료되었습니다.",
  },
];

function createSampleNotices(e = new Date()) {
  const t = (n) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + n);
  return SAMPLE_NOTICES.map((n) => {
    const r = formatDate(t(-n.age));
    let l = " 접수: 상시.";
    if (n.due !== null) {
      const i = t(n.due);
      l = ` 접수기간: ~ ${i.getMonth() + 1}/${i.getDate()} 까지.`;
    }
    return {
      id: `sample-${n.n}`,
      title: n.title,
      content: `${n.body}${l}`,
      date: r,
      url: OFFICIAL_NOTICE_URL,
      category: n.board,
      sourceType: "sample",
      sourceName: "국민대학교 공식 홈페이지 (샘플 데이터)",
    };
  });
}

const OFFICIAL_SOURCE_NAME = "국민대학교 공식 홈페이지";

export {
  OFFICIAL_NOTICE_URL,
  SAMPLE_NOTICES,
  createSampleNotices,
  OFFICIAL_SOURCE_NAME,
};
