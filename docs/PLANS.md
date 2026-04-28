# PLANS.md — AI Finance Management 개발 로드맵

> 매 세션 시작 시 현재 위치 확인용. Phase Gate 통과 후 다음 Phase 진입.

---

## 목표

3개월 내 MVP. Owner·Spouse이 구글시트 대신 웹에서 가계부를 입력하고, AI에게 재정 질문을 할 수 있는 상태.

---

## Phase 구조

| Phase | 이름 | 기간 | 상태 |
|-------|------|------|------|
| Phase 1 | 기반 세팅 | 2주 | ✅ |
| Phase 2 | 데이터 관리 (Admin) | 3주 | ✅ |
| Phase 3 | 재정 대시보드 | 3주 | ✅ |
| Phase 4 | AI 재정 에이전트 | 3주 | ✅ |
| Phase 5 | 텔레그램 봇 | 2주 | ✅ |
| Phase 6 | 안정화 | 상시 | 🔄 |

상태: 🔲 미시작 / 🔄 진행 중 / ✅ 완료

---

## Phase 1 — 기반 세팅

**Phase Gate (모두 통과해야 Phase 2 진입 가능)**
- [x] Next.js 프로젝트 생성 + 개발 서버 동작 확인
- [x] Supabase 프로젝트 생성 + 환경변수 연결
- [x] 5개 테이블 스키마 생성 (transactions, assets, dividend, preset_templates, backup_logs)
- [x] RLS 정책 + updated_at 트리거 적용
- [x] Supabase Auth 설정 (Owner·Spouse 계정 생성)
- [x] 로그인/로그아웃 기본 동작 확인
- [x] `npm run typecheck && npm run lint` 경고 0건

**작업 목록**
- [x] Next.js 15 App Router + TypeScript strict 초기화
- [x] Tailwind CSS 설정
- [x] Supabase client 설정 (server/client 분리 — `lib/supabase/server.ts`, `lib/supabase/client.ts`)
- [x] DB 스키마 마이그레이션 (supabase/schema.sql 기준)
- [x] 인증 미들웨어 (미인증 → `/login` 리다이렉트)
- [x] 기본 레이아웃 (사이드바 + 헤더)

---

## Phase 2 — 데이터 관리 (Admin)

**Phase Gate**
- [x] 수입/지출 CRUD 동작 (단건 입력, 수정, soft delete)
- [x] 파일 업로드 일괄 입력 기능 (xlsx/csv → preview → bulk insert)
- [x] 고정지출 preset 불러오기 → 일괄 저장 동작
- [x] 자산 월별 스냅샷 입력 (직전 월 불러오기 + 저장)
- [x] 배당금 입력 동작 (환율 자동 조회 포함)
- [x] 마이그레이션 스크립트 실행 완료 (transactions 3,151건 / assets 819건 / dividend 196건)
- [x] `npm run typecheck && npm run lint` 경고 0건
- [ ] 월말 자동 백업 스크립트 (Phase 6으로 이월)

**작업 목록**
- [x] 수입/지출 입력 폼 + 목록 페이지 (`/admin/transactions`)
- [x] 파일 업로드 일괄 입력 (`/api/transactions/import`)
- [x] 고정지출 preset 불러오기 (체크박스 선택 → 일괄 insert)
- [x] 자산 스냅샷 입력 페이지 (`/admin/assets`)
- [x] 배당금 입력 페이지 (`/admin/dividend`)
- [x] 고정지출 템플릿 관리 (`/admin/presets`)
- [x] 1회성 마이그레이션 스크립트 (`scripts/migrate.ts`)
- [x] API Route 인증 헬퍼 (`lib/api.ts`)

---

## Phase 3 — 재정 대시보드

**Phase Gate**
- [x] KPI 카드 4개 기간 필터 적용 (총수입, 총지출, 저축률, 총배당금)
- [x] 핵심 차트 구현 (월별 수입/지출, 저축률, 순자산 스택영역, 지출 도넛, 배당금)
- [x] 저축 vs 투자 기여도 연도별 테이블
- [x] 기간 필터 (전체/연도별/월별 — URL 파라미터)
- [x] 섹션 그룹 구분 (재정현황/자산현황/배당금)
- [x] 배당금 누적 차트 + 종목별 시계열 차트

**작업 목록**
- [x] 대시보드 쿼리 함수 (`lib/dashboard/queries.ts`) — fetchAll 페이지네이션
- [x] API Routes 9개 (`/api/dashboard/*`) — Phase 4 AI Tool use용 유지
- [x] KpiCards, MonthlyChart, CategoryDonut, NetWorthChart, SavingsRateChart 컴포넌트
- [x] YearlyContribution, DividendSection, DividendTickerChart, DividendCumulativeChart
- [x] RecentAssets 테이블
- [x] PeriodFilter (전체/연도/월 선택)
- [x] formatAuk 공통 유틸 추출 (중복 제거)

---

## Phase 4 — AI 재정 에이전트

**Phase Gate (검증 필요 — 구현 완료)**
- [x] 채팅 UI 스트리밍 응답 동작
- [x] Tool use 4종 동작 검증
  - [x] "지난달 외식비 얼마야?" → 정확한 금액 반환
  - [x] "올해 경조사 내역 보여줘" → 목록 반환
  - [x] "배당금 월 100만원 목표까지 얼마나 남았어?" → 계산 후 답변
- [x] 면책 문구 조건부 적용 확인 (데이터 조회 시 없음, 투자 질문 시 1줄 추가)
- [x] 데이터 없는 기간 질문 시 "데이터가 없어요" 응답 확인

**작업 목록**
- [x] 채팅 UI 컴포넌트 (`/chat`)
- [x] `/api/chat` Route (OpenAI API + SSE 스트리밍)
- [x] Tool use 4종: `query_transactions`, `query_assets`, `query_dividend`, `calculate_summary`
- [x] 시스템 프롬프트 (`lib/openai/prompts.ts`)
- [x] Tool use 처리 루프 (route.ts에 통합)

---

## Phase 5 — 텔레그램 봇

**Phase Gate**
- [x] 텔레그램 메시지 → AI 답변 왕복 동작
- [x] Owner chat_id 인증 동작 (Spouse는 추후 추가)
- [ ] 백업 스크립트 텔레그램 알림 → Phase 6 이월

**작업 목록**
- [x] Telegram Bot 생성 (BotFather)
- [x] Webhook 엔드포인트 (`/api/telegram`)
- [x] 허용 chat_id 인증
- [x] 웹 AI Agent와 공통 로직 공유 (`lib/openai/tools.ts`)
- [x] Supabase Service Role 적용 (RLS 우회)
- [ ] 백업 스크립트 텔레그램 알림 연결 → Phase 6 이월

---

## Phase 6 — 안정화

**작업 목록**
- [x] Sentry 에러 모니터링 설정 (@sentry/nextjs + DSN 연동)
- [x] 에러 처리 정책 구현 (captureError, notifyTelegramOps, beforeSend 필터)
- [x] 코드 품질 개선 (any 제거, JSON.parse 안전 처리, auth 에러 핸들링)
- [ ] Supabase 자동 백업 주기 확인 (프로젝트 설정)
- [ ] AI 에이전트 프롬프트 품질 개선 (실사용 후 튜닝)
- [ ] 연간 재정 리포트 자동 생성 검토
- ⏸️ 월말 자동 백업 (Supabase → 구글시트) — 홀딩 결정 (2026-04-28)

---

## 개발 원칙

1. **데이터 무결성 우선** — 잘못된 데이터보다 기능이 없는 게 낫다
2. **Phase Gate 엄수** — 완료 조건 미달 시 다음 Phase 진입 금지
3. **두 사람만을 위한 UX** — 일반 사용자 고려 불필요, 편의성 우선
