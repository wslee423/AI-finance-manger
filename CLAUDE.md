# CLAUDE.md — AI Finance Management 에이전트 컨텍스트

> Claude Code가 매 세션 자동으로 읽는 핵심 컨텍스트.

---

## 세션 시작 시 읽을 문서 (순서대로)

1. `docs/CONSTITUTION.md` — 최상위 원칙 (항상)
2. `docs/AGENTS.md` — 에이전트 역할 및 자율 범위
3. `docs/PLANS.md` — 현재 Phase 및 다음 작업
4. `docs/NEXT_SESSION.md` — 이전 세션 핸드오프 (있으면)

---

## 프로젝트 개요

가족 구성원의 가계부·자산·배당 데이터를 기반으로 AI가 재정 질의응답과 시각화 대시보드를 제공하는 가족 전용 웹 서비스.

| 역할 | 기술 |
|------|------|
| Framework | Next.js 15 App Router |
| Language | TypeScript strict |
| DB / Auth | Supabase (PostgreSQL + Auth + RLS) |
| AI | OpenAI API (gpt-5.1) |
| 차트 | Recharts |
| 배포 | Vercel (Pro 플랜) |
| 텔레그램 | Telegram Bot API (Webhook, 외부 패키지 없음) |
| 에러 모니터링 | Sentry (@sentry/nextjs) |

---

## 핵심 명령어

```bash
npm run dev
npm run typecheck   # 매 작업 후 반드시 실행
npm run lint        # 매 작업 후 반드시 실행
npm run test
```

---

## Critical Rules

**Must Follow**
- TypeScript strict 모드 — `any` 사용 금지
- 모든 DB 테이블 RLS 활성화 (허용된 두 사용자만 접근 가능)
- **금융 데이터 soft delete만** — `.delete()` 직접 실행 금지
- 모든 API Route 인증 확인 (미인증 → 401)
- AI 에이전트 = 생활 비서 — 투자·세무 질문 시에만 면책 문구 1줄
- 빈 catch 블록 금지 (조용한 실패 금지)
- typecheck + lint 통과 후 커밋

**Must NOT Do**
- 외부 패키지 무단 추가
- DB 스키마 무단 변경 (마이그레이션 파일 작성은 가능, 적용은 Owner 승인 필요)
- transactions / assets / dividend hard delete
- 허용 이메일 외 사용자 접근 허용
- AI 에이전트 역할 임의 변경
- `as SomeType[]` 강제 캐스팅 — Supabase 자동생성 타입 사용 (불가피한 경우 `as unknown as Type[]` 허용, 주석 필수)

**핵심 파일 (테스트 없이 수정 금지)**
```
lib/supabase/server.ts
lib/openai/tools.ts
lib/openai/prompts.ts
app/api/chat/route.ts
```

---

## 도메인 컨텍스트

```
[가족 구성]
- Owner : 주 소득자, 주식·ETF 투자 담당
- Spouse: 육아휴직 중, 연금저축·ISA 보유
- Child : 자녀 (영아)

[자산 구조 (최신 기준)]
- 순자산: XX억 이상
- 부동산: 아파트 + 전세보증금
- 주식통장: [증권사] 계좌
- 연금: 퇴직금(DC/DB), 연금저축, ISA
- 월 배당금: 목표 100만원 초과 달성

[지출 분류]
- 고정지출: 보험, 용돈, 관리비, 구독, 통신비, 교통
- 변동지출: 마트/외식/의류/여가/병원 등
- 기타지출: 경조사, 기타
```

---

## 파일 구조

```
/                              ← Next.js 프로젝트 루트
├── README.md                  ← GitHub 표지
├── CLAUDE.md                  ← 이 파일 (Claude Code 자동 로드)
│
├── docs/                      ← 프로젝트 운영 문서
│   ├── CONSTITUTION.md        ← 최상위 불변 원칙
│   ├── AGENTS.md              ← 에이전트 역할 & 자율 범위
│   ├── PLANS.md               ← Phase별 개발 로드맵
│   ├── WORKFLOW.md            ← 개발 워크플로우
│   ├── ARCHITECTURE.md        ← 기술 스택 & 폴더 구조
│   ├── QUALITY_SCORE.md       ← 품질 검증 기준
│   ├── MIGRATION.md           ← 데이터 마이그레이션 가이드
│   ├── NEXT_SESSION.md        ← 다음 세션 핸드오프
│   ├── open-decisions.md      ← 의사결정 추적
│   ├── tech-debt.md           ← 기술 부채 추적
│   ├── lessons_learned.md     ← 트러블슈팅 & 재사용 패턴
│   └── specs/                 ← 기능별 상세 스펙
│       ├── 01-db-schema.md
│       ├── 02-admin-data-entry.md
│       ├── 03-backup.md
│       ├── 04-dashboard.md
│       └── 05-ai-agent.md
│
├── app/                       ← Next.js App Router
├── components/                ← React 컴포넌트
├── lib/                       ← 서버/클라이언트 유틸
├── types/                     ← TypeScript 타입 정의
├── scripts/                   ← 1회성 스크립트 (migrate.ts)
├── supabase/                  ← DB 스키마 SQL
└── .claude/                   ← Claude Code 설정 & 커맨드
```

---

## 환경 변수

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # 서버 전용
OPENAI_API_KEY=                     # 서버 전용
NEXT_PUBLIC_SENTRY_DSN=             # Sentry 에러 모니터링
TELEGRAM_BOT_TOKEN=                 # 서버 전용
TELEGRAM_ALLOWED_CHAT_IDS=          # 허용 chat_id (콤마 구분)
TELEGRAM_OPS_CHAT_ID=               # 운영 에러 알림 수신 chat_id
EXCHANGE_RATE_API_KEY=              # 환율 API
# 아래는 월말 자동 백업 구현 시 필요 (현재 홀딩)
# CRON_SECRET=
# GOOGLE_SERVICE_ACCOUNT_JSON=
# BACKUP_SPREADSHEET_ID=
```
