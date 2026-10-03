"use client";

import { NOTICE_SOURCES, NOTICE_SOURCES_AS_OF } from "@/data/noticeSources";

// 국민대학교 공지 소스 목록: 단과대학 · 소속 학부/학과 · 대표 공지 웹페이지 · 형태
export function NoticeSources({ college }) {
  return (
    <section className="collected notice-sources" aria-labelledby="sourcesTitle">
      <div className="section-head">
        <div>
          <div className="eyebrow">{"NOTICE SOURCES"}</div>
          <h2 id="sourcesTitle" className="home-h">
            {"국민대학교 공지 소스 목록"}
          </h2>
          <p>
            {`국민대학교 전체 공지와 단과대학·교양대학의 대표 공지 페이지예요. ${NOTICE_SOURCES_AS_OF} 기준 · 총 ${NOTICE_SOURCES.length}개 공지 소스`}
          </p>
        </div>
      </div>
      <div className="collected-table-wrap">
        <table className="collected-table">
          <thead>
            <tr>
              <th scope="col">{"단과대학"}</th>
              <th scope="col">{"소속 학부·학과"}</th>
              <th scope="col">{"대표 공지 웹페이지"}</th>
              <th scope="col">{"형태"}</th>
            </tr>
          </thead>
          <tbody>
            {NOTICE_SOURCES.map((s) => (
              <tr key={s.college} className={s.college === college ? "mine" : undefined}>
                <th scope="row" className="source-college">
                  {s.college}
                  {s.college === college && <span className="tag">{"내 단과대학"}</span>}
                </th>
                <td>{s.majorsNote || s.majors.join(" / ")}</td>
                <td className="title">
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.url}
                  </a>
                </td>
                <td className="muted">{s.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
