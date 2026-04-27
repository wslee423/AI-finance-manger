# NEXT_SESSION.md — 다음 세션 핸드오프

**업데이트**: 2026-04-27

---

## 현재 상태

- **Phase 1**: ✅ 완료 — Next.js + Supabase 기반 세팅
- **Phase 2**: ✅ 완료 — Admin 데이터 입력 + 마이그레이션
- **Phase 3**: ✅ 완료 — 재정 대시보드
- **Phase 4**: 🔄 진행 중 — AI 재정 에이전트 (채팅 UI + API 구현 완료)

---

## Phase 3에서 완료한 것

- 대시보드 페이지: KPI 카드 + 차트 9종 + 테이블
- 기간 필터: 전체 / 연도별 / 월별 (URL 파라미터)
- 섹션 그룹화: 📊 재정현황 / 🏦 자산현황 / 💰 배당금 (컬러 헤더)
- 배당금 누적 차트 + 종목별 시계열 차트
- `lib/dashboard/queries.ts` — 서버 컴포넌트 직접 호출 패턴
- `fetchAll` 페이지네이션 헬퍼 (Supabase 1000건 제한 우회)
- `formatAuk` 공통 유틸 추출 (4곳 중복 제거)
- 코드 리뷰 후 PersonalNetWorth dead code 제거

---

## Phase 4 — AI 재정 에이전트 (구현 완료)

### 구현된 파일
- `lib/openai/prompts.ts` — 시스템 프롬프트
- `lib/openai/tools.ts` — Tool 정의 4종 + 실행 함수
- `app/api/chat/route.ts` — SSE 스트리밍 API (gpt-5.1 사용)
- `app/(dashboard)/chat/page.tsx` — 채팅 UI

### 사용 모델 결정 사항
- **모델**: `gpt-5.1` (gpt-4o 대비 28% 저렴, Input $1.25/1M)
- **query_assets**: asset_type별 합계 압축 반환 (institution 행 수십 개 → byType 6개)
- **history**: 20개 유지 (OD-004)
- **list aggregate**: 최대 10건 강제 제한

### Phase Gate 검증 필요
- [ ] `npm run dev` 후 `/chat` 진입 확인
- [ ] "지난달 외식비 얼마야?" → 정확한 금액 반환
- [ ] "올해 경조사 내역 보여줘" → 목록 반환
- [ ] "배당금 월 100만원 목표까지 얼마나 남았어?" → 계산 후 답변
- [ ] 투자 질문 시 면책 문구 자동 추가
- [ ] 데이터 없는 기간 질문 → "데이터가 없어요"

### 다음 할 것
- Phase Gate 통과 확인 후 → Phase 5 (텔레그램 봇) 진입

---

## 이월된 작업

- **월말 자동 백업** (Vercel Cron → 구글시트 append) — Phase 6 안정화에서 구현
  - `docs/specs/03-backup.md` 스펙 참고
  - 환경변수 미설정: `CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `BACKUP_SPREADSHEET_ID`
- **저축률 목표 설정 페이지** — 현재 `SavingsRateChart`에 70% 하드코딩
  - 기술 부채 등록 후 추후 설정 UI 추가
- **배당금 환율 자동 조회** — `EXCHANGE_RATE_API_KEY` 미설정 (현재 수동 입력)

---

## 환경 설정 상태

```
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
❌ ANTHROPIC_API_KEY          ← Phase 4 전 필요 ⭐
❌ EXCHANGE_RATE_API_KEY       ← 배당금 환율 자동조회용 (현재 수동 입력)
❌ TELEGRAM_BOT_TOKEN          ← Phase 5 전 필요
❌ TELEGRAM_ALLOWED_CHAT_IDS   ← Phase 5 전 필요
❌ CRON_SECRET                 ← Phase 6 백업용
❌ GOOGLE_SERVICE_ACCOUNT_JSON ← Phase 6 백업용
❌ BACKUP_SPREADSHEET_ID       ← Phase 6 백업용
```
