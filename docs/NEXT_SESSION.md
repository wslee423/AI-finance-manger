# NEXT_SESSION.md — 핸드오프 (2026-04-28)

> 이전 세션에서 완료한 내용 및 다음 세션 시작점.

---

## 현황

| Phase | 이름 | 상태 | 설명 |
|-------|------|------|------|
| Phase 1 | 기반 세팅 | ✅ | Next.js + Supabase 기반 완료 |
| Phase 2 | Admin 데이터 입력 | ✅ | 가계부/자산/배당금 입력 + 3,151건 마이그레이션 |
| Phase 3 | 재정 대시보드 | ✅ | KPI 카드, 차트, 배당금 분석 완료 |
| Phase 4 | AI 재정 에이전트 | ✅ | 웹 채팅 UI + OpenAI (gpt-5.1) + Tool use 4종 |
| Phase 5 | 텔레그램 봇 | ✅ | Webhook + AI 답변 + chat_id 인증 완료 |
| Phase 6 | 안정화 | 🔄 | **진행 중** |

---

## Phase 6 진행 현황 (2026-04-28 기준)

### ✅ 완료
- **Sentry 에러 모니터링** — `@sentry/nextjs` 설치, DSN 연동, Vercel 배포 완료
- **에러 처리 정책 구현**
  - `lib/errors.ts`: `captureError()` (errorId 생성 + Sentry 전송) + `notifyTelegramOps()` (production 운영 알림)
  - `sentry.server.config.ts`: `beforeSend`로 cookies, authorization 헤더, request body 제거
  - `/api/chat`: 에러 시 errorId 포함 SSE 응답
  - `/api/telegram`: 에러 시 사용자에게 errorId 포함 메시지 전송
- **코드 품질 개선**
  - `lib/openai/tools.ts`: `any` 4개 제거, `toMonthEnd()` 헬퍼 추출
  - `lib/api.ts`: `getAuthUser()` auth 에러 핸들링
  - `app/api/transactions/import/route.ts`: `JSON.parse` try-catch 추가

### 🔲 남은 작업
- Supabase 자동 백업 주기 확인 (프로젝트 설정에서 확인만)
- AI 프롬프트 품질 개선 (실사용 후 튜닝 요청 시 진행)
- 연간 재정 리포트 자동 생성 검토 (선택)
- Spouse chat_id 추가 (TELEGRAM_ALLOWED_CHAT_IDS, TELEGRAM_OPS_CHAT_ID)

### ⏸️ 홀딩 결정
- 월말 자동 백업 (Supabase → 구글시트 Vercel Cron) — 2026-04-28 홀딩

---

## 환경 변수 현황

| 변수 | 상태 | 비고 |
|------|------|------|
| NEXT_PUBLIC_SUPABASE_URL | ✅ | |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ | |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | |
| OPENAI_API_KEY | ✅ | |
| NEXT_PUBLIC_SENTRY_DSN | ✅ | |
| TELEGRAM_BOT_TOKEN | ✅ | |
| TELEGRAM_ALLOWED_CHAT_IDS | ✅ | Owner만, Spouse 미추가 |
| TELEGRAM_OPS_CHAT_ID | ✅ | Owner chat_id |
| EXCHANGE_RATE_API_KEY | ✅ | |
| GOOGLE_SERVICE_ACCOUNT_JSON | ⏸️ | 백업 홀딩 |
| BACKUP_SPREADSHEET_ID | ⏸️ | 백업 홀딩 |
| CRON_SECRET | ⏸️ | 백업 홀딩 |

---

## Spouse chat_id 추가 방법

```bash
# .env.local 및 Vercel 환경변수 업데이트
TELEGRAM_ALLOWED_CHAT_IDS=7553686708,<spouse_chat_id>
TELEGRAM_OPS_CHAT_ID=7553686708  # Owner chat_id 유지
```

---

## 다음 세션 시작 체크리스트

1. `docs/PLANS.md` Phase 6 남은 항목 확인
2. AI 답변 품질 이슈가 있으면 `lib/openai/prompts.ts` 튜닝
3. 신규 기능 요청 시 WORKFLOW.md 구현 순서 준수
