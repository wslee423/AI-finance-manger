# AI Finance Management

가족의 가계부·자산·배당 데이터를 기반으로 AI가 자연어로 재정 분석·조회 및 생활 비서 역할을 하는 **자산관리 웹 서비스**.

구글시트로 관리하던 가계부를 Supabase로 이전하고, 대시보드 + AI 질의응답을 한 화면에서 제공한다.

---

## 기술 스택

| 역할 | 기술 |
|------|------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| DB / Auth | Supabase (PostgreSQL + Auth + RLS) |
| AI | Anthropic Claude API (`claude-sonnet-4-5`) |
| 차트 | Recharts |
| 배포 | Vercel (Pro 플랜) |
| 텔레그램 | node-telegram-bot-api |

---

## 주요 기능

- **Admin** — 수입/지출/자산/배당금 웹 입력 (단건 + 파일 업로드 일괄 입력) ✅
- **Dashboard** — KPI 카드, 월별 수입/지출, 순자산 성장, 저축률 추이, 배당금 분석 (누적/종목별 시계열) ✅
- **AI 에이전트** — 자연어로 재정 질의응답 ("지난달 외식비 얼마야?") 🔲 Phase 4
- **텔레그램 봇** — 모바일에서 AI 에이전트 접근 🔲 Phase 5
- **월말 자동 백업** — Supabase → 구글시트 자동 export (Vercel Cron) 🔲 Phase 6

---

## 프로젝트 현황

| Phase | 이름 | 상태 |
|-------|------|------|
| Phase 1 | 기반 세팅 (Next.js + Supabase + Auth) | ✅ |
| Phase 2 | 데이터 관리 Admin + 마이그레이션 | ✅ |
| Phase 3 | 재정 대시보드 | ✅ |
| Phase 4 | AI 재정 에이전트 | 🔲 |
| Phase 5 | 텔레그램 봇 | 🔲 |
| Phase 6 | 안정화 | 🔲 |

**현재 데이터:**
- transactions: 3,147건 (수입/지출/이체)
- assets: 819건 (월별 스냅샷)
- dividend: 196건 (배당 내역)

---

## 파일 구조

```
├── README.md                    GitHub 표지
├── CLAUDE.md                    Claude Code 자동 로드 컨텍스트
│
├── docs/                        프로젝트 운영 문서
│   ├── CONSTITUTION.md          최상위 불변 원칙
│   ├── AGENTS.md                에이전트 역할 & 자율 범위
│   ├── PLANS.md                 Phase별 개발 로드맵
│   ├── WORKFLOW.md              개발 워크플로우
│   ├── ARCHITECTURE.md          기술 스택 & 폴더 구조
│   ├── QUALITY_SCORE.md         품질 검증 기준
│   ├── MIGRATION.md             데이터 마이그레이션 가이드
│   ├── NEXT_SESSION.md          다음 세션 핸드오프
│   ├── open-decisions.md        의사결정 추적
│   ├── tech-debt.md             기술 부채 추적
│   ├── lessons_learned.md       트러블슈팅 & 재사용 패턴
│   └── specs/                   기능별 상세 스펙
│       ├── 01-db-schema.md
│       ├── 02-admin-data-entry.md
│       ├── 03-backup.md
│       ├── 04-dashboard.md
│       └── 05-ai-agent.md
│
├── app/                         Next.js App Router
├── components/                  React 컴포넌트
├── lib/                         서버/클라이언트 유틸
├── types/                       TypeScript 타입
├── scripts/                     1회성 스크립트
├── supabase/                    DB 스키마 SQL
└── .claude/                     Claude Code 설정 & 커맨드
```

---

## 빠른 시작

### 환경 설정

```bash
cp .env.example .env.local
# .env.local에 Supabase, Anthropic, Telegram 등 설정
```

### 개발 서버

```bash
npm install
npm run dev
```

### 마이그레이션 (Phase 2)

```bash
# 검증 모드 (DB 변경 없음)
npx tsx scripts/migrate.ts --dry-run

# 실제 실행
npx tsx scripts/migrate.ts
```

---

## 핵심 원칙

1. **금융 데이터 무결성** — hard delete 금지, soft-delete(`deleted_at`)만 허용
2. **가족 전용 접근** — Owner·Spouse 두 사람만 (RLS + 이메일 whitelist)
3. **AI는 생활 비서** — 투자 자문 아님. 데이터 조회·분석에 집중
4. **Supabase = Source of Truth** — 구글시트는 월말 자동 백업 아카이브

---

## 에이전트 대화 예시

```
Q: "지난달 외식비 얼마나 썼어?"
A: "지난달 외식비로 XXX,XXX원 쓰셨어요. 총 X번 외식하셨고..."

Q: "배당금 월 100만원 목표까지 얼마나 남았어?"
A: "이미 달성하셨어요! 월평균 배당금이 목표를 초과달성 중이에요."

Q: "아이 관련 지출만 보여줘"
A: "Child 관련 지출을 조회해드릴게요..."
```
