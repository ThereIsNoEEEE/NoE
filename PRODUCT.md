# KMU Pick AI product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

국민대학교 학부생과 대학원생. 학교의 여러 게시판에 흩어진 공지를 확인하고, 학적과 관심사에 맞는 기회를 찾는 학생.

## Product Purpose

개인화 TOP 3 추천과 AI 공지 검색을 통해 학생이 관련 공지를 발견하고 대상 조건과 마감을 확인한 뒤 원문으로 이동하게 한다.

## Positioning

사용자 학적·소속·전공·학년·관심사·키워드와 공지 정보를 비교해 추천하고, 챗봇은 수집한 공지를 근거로 질문에 답변한다.

## Operating Context

PC와 모바일 웹, 해커톤 MVP. 기존 화면에는 온보딩, 홈 추천, 공지 목록·필터, 지원 대상 목록, 일정, 저장, 프로필 설정, 수집 데이터 조회, AI 대화, 공지 상세 패널이 있다.

## Capabilities and Constraints

Next.js App Router, React, Tailwind CSS, shadcn/ui. 백엔드의 Qdrant 공지 목록과 공지 이미지 API를 사용한다. 이미지 카드에는 원격/로컬 실제 이미지와 오류 fallback이 구현되어 있다. 사용자 설정과 공지 저장은 현재 브라우저 저장소를 사용한다. AI 챗봇은 최신 main의 백엔드 RAG endpoint에 연결한다. 데이터의 대상·마감·OCR 미확인은 화면에서 확정 정보로 표현하지 않는다.

## Brand Commitments

서비스 이름은 KMU Pick AI. 사용자는 빠르게 검토할 수 있는 구체적 화면과 기능을 원하며, 상시 펼쳐진 프로필 설정 패널을 선호하지 않는다. 포스터는 카드 영역을 꽉 채우고 위쪽 기준으로 보여야 한다. 최신 피드백에 따라 기존 화면 골격과 다크 톤을 유지하고 시각 디테일을 개선한다. 첫 방문에는 스크롤 없는 2단계 설정 팝업을 사용한다. 선택한 Taste 디자인은 국민대 엠블럼의 노랑·주황·초록을 주요 색상으로 사용한다.

## Evidence on Hand

prd.md, docs/notice-data-spec.md, 현재 front/components/kmu, backend 코드. 원격 DB의 공지 수는 마지막 검증에서 289건이었다. 실제 공지와 이미지가 존재하며 근거 없는 상업적 실적·사용자 후기·지원 가능 확정을 만들지 않는다.

## Product Principles

추천과 질문을 쉽게 시작한다. 원문 출처와 확인 필요 조건을 유지한다. 설정은 필요할 때 접근한다. PC·모바일에서 모든 기존 기능을 유지한다.
