# NEXT_SESSION.md — 다음 세션 핸드오프

**업데이트**: 2026-04-26

---

## 현재 상태

- **Phase 1**: ✅ 완료 — Next.js + Supabase 기반 세팅
- **Phase 2**: ✅ 완료 — Admin 데이터 입력 + 마이그레이션
- **Phase 3**: 🔲 시작 전 — 재정 대시보드

---

## Phase 2에서 완료한 것

- Admin 4개 페이지: 수입/지출, 자산 스냅샷, 배당금, 고정지출 템플릿
- 파일 업로드 일괄 입력 (xlsx/csv → preview → bulk insert)
- 마이그레이션: transactions 3,147건 / assets 819건 / dividend 196건
- API Route 인증 헬퍼 (`lib/api.ts`)
- 코드 리뷰: 버그 7개 수정, 중복 코드 제거

---

## Phase 3 — 재정 대시보드 시작 방법

`product-specs/04-dashboard.md` 기준으로 구현.

### 구현 순서

1. **API 9개** (`/api/dashboard/*`)
   ```
   GET /api/dashboard/kpi
   GET /api/dashboard/monthly-summary
   GET /api/dashboard/category-breakdown
   GET /api/dashboard/networth-history
   GET /api/dashboard/savings-rate
   GET /api/dashboard/yearly-contribution
   GET /api/dashboard/dividend-summary
   GET /api/dashboard/recent-assets
   GET /api/dashboard/personal-networth
   ```

2. **대시보드 페이지** (`app/(dashboard)/dashboard/page.tsx`)
   - KPI 카드 4개 (총수입, 총지출, 저축률, 총배당금)
   - 월별 수입/지출 막대 차트
   - 지출 카테고리 도넛 차트
   - 순자산 성장 영역 차트
   - 배당금 분석 섹션
   - 개인별 순자산 (Owner/Spouse)

3. **기간 필터** — URL 파라미터 연동, 전 차트 공통 적용

### 주의사항

- 이체(`class_type = '이체'`) 거래는 수입/지출 집계에서 **반드시 제외**
- `assets` 테이블은 월말 스냅샷 → 추이 계산 시 `snapshot_date`로 정렬
- 개인별 순자산: 공동 자산은 `contribution_rate`로 각자 지분 계산
- recharts 이미 설치됨

---

## 이월된 작업

- **월말 자동 백업** (Vercel Cron → 구글시트 append) — Phase 3 또는 6에서 구현
  - `03-backup.md` 스펙 참고
  - `CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `BACKUP_SPREADSHEET_ID` 환경변수 미설정

---

## 환경 설정 상태

```
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
❌ ANTHROPIC_API_KEY          ← Phase 4 전 필요
❌ TELEGRAM_BOT_TOKEN          ← Phase 5 전 필요
❌ EXCHANGE_RATE_API_KEY       ← 배당금 환율 자동조회용 (현재 수동 입력)
❌ CRON_SECRET                 ← 월말 백업용
❌ GOOGLE_SERVICE_ACCOUNT_JSON ← 월말 백업용
❌ BACKUP_SPREADSHEET_ID       ← 월말 백업용
```
