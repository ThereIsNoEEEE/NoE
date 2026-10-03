// 국민대학교 학생에게 실제로 있을 법한 샘플 공지 데이터.
// 크롤링 실패 시 fallback으로 사용되며, 원문(raw) 형태를 가정한다.
// 날짜 기준: 2026-10-03 (PRD 작성일) — D-Day 데모가 자연스럽도록 마감일을 가깝게 설정.

export const sampleNotices = [
  {
    id: 1,
    title: '2026 AI 산학협력 인턴 모집 (현대오토에버·네이버클라우드 연계)',
    date: '2026-09-29',
    url: 'https://cs.kookmin.ac.kr/notice/intern-ai-2026',
    content:
      '소프트웨어융합대학 및 AI 전공 학부생·대학원생을 대상으로 AI 산학협력 인턴을 모집합니다. ' +
      '머신러닝, 데이터 분석 직무이며 방학 중 8주 과정으로 진행됩니다. 지원 마감 2026-10-06. ' +
      '대상: 학부 3학년 이상 및 대학원생. 포트폴리오 제출 필수.',
    source: '국민대학교 소프트웨어융합대학',
  },
  {
    id: 2,
    title: '2026-2학기 국가장학금 2차 신청 안내',
    date: '2026-09-28',
    url: 'https://www.kookmin.ac.kr/notice/scholarship-national-2026-2',
    content:
      '2026학년도 2학기 국가장학금 2차 신청을 안내합니다. 모든 학부 재학생이 신청 대상이며 ' +
      '한국장학재단 홈페이지를 통해 신청합니다. 신청 마감 2026-10-10. 소득분위 산정 필요.',
    source: '국민대학교 학생지원처',
  },
  {
    id: 3,
    title: '생성형 AI 활용 실무 특강 (ChatGPT·RAG·LangChain)',
    date: '2026-09-30',
    url: 'https://ai.kookmin.ac.kr/notice/genai-special-lecture',
    content:
      '생성형 AI와 LLM 애플리케이션 개발을 주제로 한 특강을 개최합니다. ' +
      '데이터·AI에 관심 있는 학부생과 대학원생 누구나 참여 가능합니다. ' +
      '일시 2026-10-05, 장소 미래관. 사전 신청 마감 2026-10-04.',
    source: '국민대학교 인공지능연구원',
  },
  {
    id: 4,
    title: '제8회 국민 캠퍼스 창업·데이터 공모전 참가팀 모집',
    date: '2026-09-25',
    url: 'https://startup.kookmin.ac.kr/notice/data-contest-2026',
    content:
      '데이터 분석 및 아이디어 기반 창업 공모전 참가팀을 모집합니다. 학부·대학원 모두 참여 가능하며 ' +
      '팀 단위(2~4명) 지원입니다. 최우수팀 상금 300만원. 접수 마감 2026-10-15.',
    source: '국민대학교 창업지원단',
  },
  {
    id: 5,
    title: '2026-2학기 수강신청 정정 및 추가 기간 안내',
    date: '2026-09-27',
    url: 'https://www.kookmin.ac.kr/notice/course-registration-2026-2',
    content:
      '2026학년도 2학기 수강신청 정정·추가 기간을 안내합니다. 전 학부 재학생 대상이며 ' +
      '학사 포털에서 진행합니다. 정정 기간 2026-10-07 ~ 2026-10-09.',
    source: '국민대학교 교무처',
  },
  {
    id: 6,
    title: '2027학년도 전기 일반대학원 신입생 모집 (AI·소프트웨어)',
    date: '2026-09-22',
    url: 'https://grad.kookmin.ac.kr/notice/admission-2027',
    content:
      '2027학년도 전기 일반대학원 신입생을 모집합니다. AI, 소프트웨어, 데이터사이언스 전공 포함. ' +
      '학부 졸업예정자 및 졸업생 대상. 원서 접수 마감 2026-10-20.',
    source: '국민대학교 일반대학원',
  },
  {
    id: 7,
    title: '2027 교환학생 파견 프로그램 선발 안내 (미국·독일·일본)',
    date: '2026-09-20',
    url: 'https://oia.kookmin.ac.kr/notice/exchange-2027',
    content:
      '2027학년도 해외 교환학생 파견 프로그램 선발을 안내합니다. 학부 재학생 대상이며 ' +
      '어학성적과 학점 기준이 적용됩니다. 1차 서류 마감 2026-10-25.',
    source: '국민대학교 국제교류처',
  },
  {
    id: 8,
    title: '교내 근로장학생 및 학생지원 프로그램 모집',
    date: '2026-09-26',
    url: 'https://www.kookmin.ac.kr/notice/campus-work-study',
    content:
      '교내 행정부서 근로장학생을 모집합니다. 학부 재학생 대상이며 주 15시간 이내 근무합니다. ' +
      '교내 학생지원 프로그램과 연계됩니다. 신청 마감 2026-10-12.',
    source: '국민대학교 학생지원처',
  },
  {
    id: 9,
    title: '2026 KMU 해커톤 "AI for Campus" 참가자 모집',
    date: '2026-09-24',
    url: 'https://sw.kookmin.ac.kr/notice/kmu-hackathon-2026',
    content:
      'AI를 활용해 캠퍼스 문제를 해결하는 교내 해커톤 참가자를 모집합니다. ' +
      '학부·대학원 모두 참여 가능하며 팀 또는 개인 참가 가능. 무박 2일 진행. 접수 마감 2026-10-08.',
    source: '국민대학교 소프트웨어융합대학',
  },
  {
    id: 10,
    title: 'IT 대기업 취업 설명회 및 모의면접 프로그램',
    date: '2026-09-23',
    url: 'https://career.kookmin.ac.kr/notice/job-fair-2026',
    content:
      'IT 대기업 채용 설명회와 직무별 모의면접 프로그램을 운영합니다. 취업을 준비하는 ' +
      '학부 고학년 및 대학원생 대상입니다. 사전 신청 마감 2026-10-11.',
    source: '국민대학교 취업지원센터',
  },
]

export default sampleNotices
