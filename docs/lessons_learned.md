# lessons_learned.md — 프로젝트 회고 & 배운 점

> 다음 프로젝트에서 재사용할 수 있는 기술적 결정과 실수 모음.
> 세션이 끝날 때마다 업데이트.

---

## Phase 1 — 기반 세팅

### ✅ 잘 된 것

**Supabase SSR 클라이언트 분리**
- `lib/supabase/client.ts` (브라우저), `lib/supabase/server.ts` (서버) 분리
- 미들웨어에서도 별도 인스턴스 사용 → Next.js App Router 쿠키 동기화 정상 작동

**인증 미들웨어 패턴**
- `middleware.ts`에서 `supabaseResponse`를 통해 쿠키를 양방향 동기화하는 패턴이 핵심
- 미들웨어에서 `supabase.auth.getUser()` 호출 시 세션 갱신까지 처리됨

---

### ⚠️ 트러블슈팅

**폴더명 괄호 문제**
- `ai-finance-manager(claude)` 폴더명에 괄호가 포함되어 `create-next-app .` 실패
- 해결: 설정 파일들 수동 생성
- 교훈: 프로젝트 폴더명에 특수문자 사용 금지

**Supabase `app.allowed_email_*` 설정 불가**
- `ALTER DATABASE postgres SET app.allowed_email_owner = '...'` 권한 오류
- 해결: `auth.role() = 'authenticated'` RLS 정책으로 대체 (신규 가입 차단으로 보안 유지)
- 교훈: Supabase 무료 티어에서는 DB 파라미터 설정 권한이 제한됨

**autoprefixer 누락**
- `postcss.config.mjs`에 autoprefixer 플러그인 설정했지만 패키지 미설치
- `package.json`에 autoprefixer를 명시적으로 추가해야 함

---

## Phase 2 — Admin 데이터 입력

### ✅ 잘 된 것

**파일 업로드 Import 기능**
- 2단계 방식(preview → confirm) 효과적: 사용자가 데이터 확인 후 저장 가능
- 서버에서 xlsx 파싱 → 클라이언트 번들 크기 증가 없음
- 기존 구글시트 컬럼명 자동 매핑으로 별도 변환 작업 불필요

**getYearOptions() 동적 생성**
- 연도 하드코딩 → 매년 코드 수정 필요 → 동적 함수로 해결

---

### ⚠️ 트러블슈팅

**Supabase upsert onConflict 오류**
- `onConflict: 'date,amount,category,user_name'` 사용 시 해당 컬럼 조합에 UNIQUE constraint가 없으면 오류
- 해결: 1회성 마이그레이션이므로 upsert → insert로 변경
- 교훈: upsert onConflict는 반드시 DB UNIQUE constraint와 쌍으로 필요

**Service Role Key RLS 우회 오작동**
- migrate.ts에서 Service Role Key로 insert 성공 메시지 → 실제 데이터 0건
- 원인: RLS INSERT 정책이 `auth.role() = 'authenticated'`인데 service_role은 별도 role
- 해결: Supabase 대시보드에서 직접 확인 후 재마이그레이션
- 교훈: Service Role Key라도 RLS 정책에 따라 제한될 수 있음. 마이그레이션 후 반드시 건수 검증 필요

**Excel amount check constraint 오류**
- DB에 `check (amount > 0)` 있는데 이체(이체 금액 = 0)나 0원 데이터 존재
- 해결: constraint를 `check (amount >= 0)`으로 완화
- 교훈: 마이그레이션 전 원본 데이터의 edge case 분석 필수

**class_type 설계 중간 변경**
- 초기: `Owner/Spouse/Child/Shared` → 중간: 실제 이름으로 변경
- DB constraint, TypeScript 타입, 모든 페이지 전체 수정 필요
- 교훈: 도메인 엔티티(사용자명, 분류값)는 초기 설계 시 실제 데이터와 맞춰서 결정

**EMPTY_FORM 모듈 레벨 날짜 버그**
- `const EMPTY_FORM = { date: getTodayStr() }` → 빌드 시점 날짜로 고정
- 해결: `const makeEmptyForm = () => ({ date: getTodayStr() })` 함수로 변경
- 교훈: 동적 값(현재 날짜, 랜덤 등)은 절대 모듈 레벨 상수로 초기화 금지

**이체 집계 누락**
- 이체 거래를 DB에 넣었지만 월 합계에서 지출로 집계됨 → 저축률 오계산
- 해결: 수입/지출 합계 계산 시 이체 필터링
- 교훈: 새 class_type 추가 시 집계 로직에 영향 전체 검토 필요

---

## 재사용 가능한 패턴

### API Route 인증 헬퍼
```typescript
// lib/api.ts
export async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
export const serverError = (msg: string) => NextResponse.json({ error: msg }, { status: 500 })
```

### 동적 폼 초기값
```typescript
// ❌ 잘못된 방법 — 날짜가 빌드 시점으로 고정
const EMPTY_FORM = { date: getTodayStr() }

// ✅ 올바른 방법 — 매 호출마다 오늘 날짜
const makeEmptyForm = () => ({ date: getTodayStr() })
```

### 연도 옵션 동적 생성
```typescript
export function getYearOptions(startYear = 2022): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i)
}
```

### 마이그레이션 후 건수 검증
```typescript
// 마이그레이션 완료 후 반드시 실행
const { count } = await supabase.from('table').select('*', { count: 'exact', head: true })
console.assert(count === expectedCount, `건수 불일치: ${count} !== ${expectedCount}`)
```

---

## Phase 3 — 재정 대시보드

### ✅ 잘 된 것

**서버 컴포넌트에서 직접 DB 쿼리 호출**
- 초기에 서버 컴포넌트 → API fetch 방식으로 구현했다가 Internal Server Error 발생
- `lib/dashboard/queries.ts`로 쿼리 로직 분리 후 서버 컴포넌트에서 직접 호출로 전환
- API Routes는 Phase 4 AI Tool use용으로 별도 유지

**fetchAll 페이지네이션 헬퍼**
- Supabase 프로젝트 레벨 max-rows(기본 1000) 설정은 `.limit()`으로 오버라이드 불가
- 1000건씩 `.range()`로 반복 조회하는 fetchAll 헬퍼로 해결

---

### ⚠️ 트러블슈팅

**서버 컴포넌트에서 자기 자신의 API Route를 fetch하면 절대 URL 필요**
- 개발 환경에서 `http://localhost:3000`이 맞지 않아 Internal Server Error
- 해결: 서버 컴포넌트 → 직접 함수 호출 패턴 사용
- 교훈: Next.js 서버 컴포넌트는 API Route를 경유하지 않고 직접 DB/함수 호출 권장

**Supabase max-rows 1000 제한**
- `.limit(10000)` 설정해도 프로젝트 설정값이 우선되어 1000건 고정
- 해결: fetchAll 페이지네이션 헬퍼 (1000건씩 range 반복)
- 교훈: Supabase 쿼리에서 전체 데이터 조회 시 항상 페이지네이션 고려

**formatAuk 함수 4곳 중복**
- MonthlyChart, NetWorthChart, DividendSection, DividendCumulativeChart에 각각 정의
- 해결: `lib/utils.ts`에 공통 함수로 추출
- 교훈: 차트 포맷 유틸은 처음부터 utils에 두고 import

---

### 재사용 가능한 패턴

**Supabase 전체 데이터 조회 (max-rows 우회)**
```typescript
async function fetchAll<T>(supabase, table, columns, applyFilters) {
  const PAGE = 1000
  const result: T[] = []
  let from = 0
  while (true) {
    const { data } = await applyFilters(supabase.from(table).select(columns)).range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    result.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return result
}
```

**차트 Y축 금액 포맷 (억/만 단위)**
```typescript
// lib/utils.ts
export function formatAuk(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100000000) return `${(value / 100000000).toFixed(1)}억`
  if (abs >= 10000) return `${(value / 10000).toFixed(0)}만`
  return String(value)
}
```
