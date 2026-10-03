import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCategory,
  extractDeadline,
  normalizeDate,
  parseDetail,
  parseDetailImage,
  parseKmuCsList,
  parseKmuMainList,
} from "../src/crawler.mjs";

test("국민대학교 전체 공지 목록을 정규화한다", () => {
  const html = `
    <div class="board_list"><ul><li>
      <a href="/user/kmuNews/notice/7/123/view.do?currentPageNo=1">
        <div class="board_txt">
          <span class="ctg_name">장학공지</span>
          <p class="title">2026 장학생 모집 안내</p>
          <div class="board_etc"><span>2026.10.02</span><span>학생지원팀</span></div>
        </div>
      </a>
    </li></ul></div>`;
  const result = parseKmuMainList(html, {
    id: "kmu-main",
    name: "국민대학교 전체 공지",
    url: "https://www.kookmin.ac.kr/user/kmuNews/notice/index.do",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "2026 장학생 모집 안내");
  assert.equal(result[0].category, "장학공지");
  assert.equal(result[0].date, "2026-10-02");
  assert.match(result[0].url, /\/123\/view\.do/);
});

test("소프트웨어융합대학 공지 목록을 정규화한다", () => {
  const html = `
    <ul>
      <li>123</li>
      <li class="subject"><a href="./2871">제1전공 신청 안내 (10/13 ~ 10/16)</a></li>
      <li>소프트웨어융합대학</li>
      <li class="date">26.09.28</li>
    </ul>`;
  const result = parseKmuCsList(html, {
    id: "kmu-cs",
    name: "소프트웨어융합대학 공지",
    url: "https://cs.kookmin.ac.kr/news/notice/",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].date, "2026-09-28");
  assert.equal(result[0].url, "https://cs.kookmin.ac.kr/news/notice/2871");
});

test("본문 HTML에서 표시 텍스트만 추출한다", () => {
  const html = `<div class="view_inner"><p>첫 문장입니다.</p><img src="data:image/png;base64,AAA"><p>둘째 문장입니다.</p></div>`;
  assert.equal(parseDetail(html, "kmu-main"), "첫 문장입니다.\n둘째 문장입니다.");
});

test("두 자리 연도를 ISO 날짜로 변환한다", () => {
  assert.equal(normalizeDate("26.09.28"), "2026-09-28");
  assert.equal(normalizeDate("2026.10.02"), "2026-10-02");
  assert.equal(normalizeDate("잘못된 값"), null);
});

test("중첩된 본문 전체에서 첫 이미지를 선택하고 상대 주소를 해석한다", () => {
  const html = `<img src="/logo.png"><div id="view-detail-data"><div>안내</div><p>모집 내용</p><img src="/uploads/poster.jpg?x=1&amp;y=2"><img src="/second.png"></div><div>푸터</div>`;
  assert.equal(parseDetail(html, "kmu-cs"), "안내\n모집 내용");
  assert.equal(parseDetailImage(html, "kmu-cs", "https://cs.kookmin.ac.kr/news/notice/1"), "https://cs.kookmin.ac.kr/uploads/poster.jpg?x=1&y=2");
});

test("인라인 PNG와 이미지 첨부는 지원하고 위험한 주소는 거부한다", () => {
  const base = "https://www.kookmin.ac.kr/";
  assert.equal(parseDetailImage('<div class="view_inner"><img src="data:image/png;base64,AAAA"></div>', "kmu-main", base), "data:image/png;base64,AAAA");
  assert.equal(parseDetailImage('<div class="view_inner"><img src="javascript:alert(1)"><img src="http://127.0.0.1/private"></div>', "kmu-main", base), null);
  assert.equal(parseDetailImage('<a href="/download?id=3">poster.jpg</a>', "kmu-main", base), base + "download?id=3");
});

test("기간 표기에서 마지막 마감일을 선택한다", () => {
  const deadline = extractDeadline("다전공 신청 (10/13 10:00 ~ 10/16 17:00)", "", "2026-09-22");
  assert.equal(deadline, "2026-10-16");
});

test("공지 제목 기반 카테고리를 결정한다", () => {
  assert.equal(classifyCategory("AI 해커톤 참가자 모집", "", ""), "공모전");
  assert.equal(classifyCategory("교내 장학생 선발", "", ""), "장학금");
});
