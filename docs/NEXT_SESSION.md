# NEXT_SESSION.md — 핸드오프 (2026-04-27)

> 이전 세션에서 완료한 내용 및 다음 세션 시작점.

---

## 현황 (Phase 4 완료, Phase 5 시작)

| Phase | 이름 | 상태 | 설명 |
|-------|------|------|------|
| Phase 1 | 기반 세팅 | ✅ | Next.js + Supabase 기반 완료 |
| Phase 2 | Admin 데이터 입력 | ✅ | 가계부/자산/배당금 입력 완료, 3,147건 마이그레이션 |
| Phase 3 | 재정 대시보드 | ✅ | KPI 카드, 차트, 태그별 지출 Top 10 완료 |
| Phase 4 | AI 재정 에이전트 | ✅ | 웹 채팅 UI + OpenAI API (gpt-5.1) 완료, Phase Gate 검증 필요 |
| Phase 5 | 텔레그램 봇 | 🔲 | **다음 단계** — 스펙 및 구현 필요 |
| Phase 6 | 안정화 | 🔲 | 백업 스크립트, 모니터링 등 |

---

## Phase 4 완료 내용

**구현됨:**
- `/chat` 페이지: 채팅 UI (메시지 입력/표시, SSE 스트리밍)
- `/api/chat` Route: OpenAI API (gpt-5.1) 통합, Tool use + 에러 핸들링
- Tool 4종: `query_transactions`, `query_assets`, `query_dividend`, `calculate_summary`
- 시스템 프롬프트: 430토큰 (최적화 완료), 핵심 5개 매핑만 유지
- DB 스키마: `class`/`type` 분리, `user_name` 한글 (운섭, 아름, 희온, 공동)
- 태그 기능: 자유 입력 UI + 대시보드 태그별 지출 Top 10 추가
- 마이그레이션: 3,151 transactions, 819 assets, 196 dividends 모두 정상

**Phase Gate 검증 필요 (구현은 완료):**
- [ ] 채팅 UI 스트리밍 응답 테스트
- [ ] Tool use 4종 정확성 검증 ("지난달 외식비", "경조사", "배당금 목표" 등)
- [ ] 면책 문구 조건부 적용 (투자 질문만)
- [ ] 데이터 없는 기간 응답 확인

---

## 환경 변수 (현재 상태)

| 변수 | 필요 | 상태 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | 설정됨 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 설정됨 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 설정됨 |
| `OPENAI_API_KEY` | ✅ | **필수 (Phase 4)** — 설정 확인 필요 |
| `TELEGRAM_BOT_TOKEN` | ✅ | **Phase 5 필요** |
| `TELEGRAM_ALLOWED_CHAT_IDS` | ✅ | **Phase 5 필요** |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Phase 6 백업용 |
| `BACKUP_SPREADSHEET_ID` | ✅ | Phase 6 백업용 |
| `CRON_SECRET` | ✅ | Phase 6 백업용 |

---

## 이월된 기술 부채

| 항목 | 상태 | Phase |
|------|------|-------|
| 월말 자동 백업 스크립트 | 🔲 | Phase 6 |
| `any` 타입 사용 (tools.ts) | 🔲 | Phase 6 |
| tags: DB/코드 타입 불일치 | ⚠️ 운영 중 | Tech Debt |
| 문서 정합성 (스펙 vs 코드) | ⚠️ | 검토 진행 중 |

---

## 다음 단계: Phase 5 (텔레그램 봇)

**선행 조건:**
1. `TELEGRAM_BOT_TOKEN` 획득 (BotFather에서)
2. `TELEGRAM_ALLOWED_CHAT_IDS` 획득 (소유자·배우자 chat_id)
3. 스펙 문서 작성: `docs/specs/06-telegram-bot.md`

**구현 항목:**
1. POST `/api/telegram/webhook` 라우트
2. chat_id → user_name 인증 매핑
3. 웹 AI 로직 재사용 (`lib/openai/tools.ts`)
4. 빠른 명령어: `/이번달`, `/순자산`, `/배당금`
5. Vercel 대시보드에서 Webhook URL 등록

---

## 최근 작업 (2026-04-27)

1. **문서 전체 검토**: 37개 문제 식별 (모순 16개, 불일치 12개, 모호 3개, 코드 6개)
2. **프롬프트 최적화**: 900 → 430토큰 (52% 절감, $5/월 비용 절감)
3. **답변 길이 제한**: 간단한 질문은 2-3문장, 목록은 5개 이내
4. **문서 동기화**: Anthropic → OpenAI, 파일 경로 통일 중

---

## 검증 항목

**TypeScript / Lint:**
```bash
npm run typecheck  # 통과
npm run lint       # 통과
```

**배포:**
```bash
npm run build   # Vercel에서 자동 실행
```

---

## 파일 구조 참조

**AI 에이전트:**
```
lib/openai/
├── prompts.ts     ← 시스템 프롬프트 (430토큰)
├── tools.ts       ← Tool 정의 4종 + 실행 함수
app/api/chat/route.ts  ← OpenAI API + SSE + Tool 루프
app/(dashboard)/chat/page.tsx  ← 채팅 UI
```

**DB 스키마 (최신):**
- `class`: 수입 / 지출 / 이체
- `type`: 주수입, 기타수입, 고정지출, 변동지출, 저축/투자
- `user_name`: 운섭, 아름, 희온, 공동
- `tags`: 쉼표 구분 문자열 (예: `#육아,#주식매도`)
