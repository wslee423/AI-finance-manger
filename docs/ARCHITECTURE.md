# ARCHITECTURE.md — AI Finance Management

> 기술 스택 결정 및 전체 구조 참조 문서.
> DB 스키마 상세는 `product-specs/01-db-schema.md`가 기준.

---

## 1. 기술 스택

| 역할 | 기술 | 선택 이유 |
|------|------|----------|
| Framework | Next.js 15 (App Router) | 서버 컴포넌트 + API Route 통합, Vercel 최적화 |
| Language | TypeScript (strict) | 타입 안정성, AI 코딩 툴 친화적 |
| Styling | Tailwind CSS | 빠른 UI 구성 |
| DB / Auth | Supabase (PostgreSQL) | Auth 내장, RLS, 무료 티어 충분 |
| AI | OpenAI API (gpt-5.1) | Tool use 지원, 비용 효율 |
| 차트 | Recharts | React 친화적, TypeScript 지원 |
| 배포 | Vercel | Next.js 최적화, Cron Job 지원 (Pro 플랜) |
| 텔레그램 | node-telegram-bot-api | 경량, Webhook 지원 |

> **주의**: Vercel Cron Job은 Pro 플랜 이상에서만 지원. 월말 자동 백업(Phase 6)에 필요.

---

## 2. DB 테이블 요약

상세 SQL, 인덱스, RLS, 타입 정의는 `product-specs/01-db-schema.md` 참조.

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|---------|
| `transactions` | 가계부 원장 | date, class, type, category, amount, user_name, deleted_at |
| `assets` | 월별 자산 스냅샷 | snapshot_date, asset_type, institution, owner, balance, contribution_rate |
| `dividend` | 배당금 수령 이력 | date, ticker_name, exchange_rate, usd_amount, krw_amount |
| `preset_templates` | 고정지출 월별 입력용 템플릿 | name, category, amount, is_active |
| `backup_logs` | 월말 백업 실행 이력 | backup_month, status, executed_at |

**대출 처리**: `assets.asset_type = '대출'`, `balance`는 음수로 기록. 별도 컬럼 없음.

---

## 3. 폴더 구조

```
/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← 사이드바 + 헤더
│   │   ├── page.tsx                ← 재정 대시보드
│   │   ├── admin/
│   │   │   ├── transactions/page.tsx
│   │   │   ├── assets/page.tsx
│   │   │   ├── dividend/page.tsx
│   │   │   └── presets/page.tsx
│   │   └── chat/page.tsx           ← AI 재정 에이전트
│   └── api/
│       ├── transactions/route.ts
│       ├── assets/route.ts
│       ├── dividend/route.ts
│       ├── dashboard/[...]/route.ts
│       ├── chat/route.ts           ← OpenAI API + SSE
│       ├── cron/monthly-backup/route.ts
│       └── telegram/route.ts       ← Webhook
│
├── components/
│   ├── ui/                         ← Button, Input, Card 등 원자 컴포넌트
│   ├── charts/                     ← Recharts 래퍼
│   ├── dashboard/                  ← KPI 카드, 대시보드 위젯
│   ├── admin/                      ← 입력 폼
│   └── chat/                       ← 채팅 UI
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ← 브라우저용
│   │   └── server.ts               ← 서버 컴포넌트/API Route용
│   ├── openai/
│   │   ├── tools.ts                ← Tool use 정의
│   │   └── prompts.ts              ← 시스템 프롬프트
│   ├── backup/
│   │   └── sheets.ts               ← Google Sheets API append
│   ├── telegram/
│   │   └── bot.ts
│   └── utils/
│       └── format.ts               ← 금액·날짜 포맷
│
├── types/
│   └── index.ts                    ← Transaction, Asset, Dividend TypeScript 타입
│
└── docs/                           ← 프로젝트 문서 (이 파일들)
```

---

## 4. 구현 순서 원칙

기능 하나를 구현할 때 항상 이 순서를 따른다:

```
1. DB 스키마 / RLS 정책  (사람 승인 필요)
2. TypeScript 타입 정의  (/types/index.ts)
3. API Route             (서버 로직)
4. UI 컴포넌트
5. 연결 + 통합 확인
6. 엣지 케이스 처리
```

---

## 5. 데이터 흐름

```
[과거 데이터 마이그레이션 — 1회]
구글시트 (2022.05~현재)
    ↓ Node.js 스크립트 (CSV export → upsert)
Supabase

[신규 데이터 — 지속]
웹 Admin 입력 → Supabase → 대시보드 + AI 에이전트

[월말 백업 — 자동]
Vercel Cron (매달 1일 15:00 UTC = KST 00:00)
    → Supabase 전월 데이터 조회
    → 구글시트 백업 시트 append
    → backup_logs 기록
    → 텔레그램 알림 (Phase 5 이후)
```

---

## 6. 환경 변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 서버 전용. 클라이언트 절대 노출 금지.

# OpenAI
OPENAI_API_KEY=                   # 서버 전용.

# Telegram
TELEGRAM_BOT_TOKEN=               # 서버 전용.
TELEGRAM_ALLOWED_CHAT_IDS=        # 허용 chat_id 목록 (콤마 구분)

# Backup
CRON_SECRET=                      # Vercel Cron 인증용
GOOGLE_SERVICE_ACCOUNT_JSON=      # 구글 서비스 계정 JSON (문자열화)
BACKUP_SPREADSHEET_ID=            # 백업 구글시트 ID
```

---

## 7. 의사결정 기록

| 결정 | 선택 | 기각 대안 | 이유 |
|------|------|----------|------|
| DB | Supabase | Firebase | PostgreSQL 쿼리 유연성, RLS, AI Tool use 연동 |
| AI | OpenAI (gpt-5.1) | Anthropic | 비용 효율(28% 저렴), Tool use 지원 |
| 차트 | Recharts | Chart.js / Nivo | React·TypeScript 친화적 |
| 배포 | Vercel | Railway | Next.js 최적화, Cron 내장 |
| 동기화 | 월말 자동 백업 | 실시간 Google Sheets 동기화 | 단순성·안정성 우선 |
| 대출 처리 | asset_type='대출', balance 음수 | loan_amount 별도 컬럼 | 테이블 단순화, 일관된 순자산 계산 |
