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

---

## Phase 4 — AI 재정 에이전트

### ✅ 잘 된 것

**category enum 강제 적용으로 AI 오분류 방지**
- 프롬프트로 카테고리 설명 → AI가 `외식비`를 subcategory로 잘못 보내는 오류 발생
- 해결: Tool definition에 category 값을 `enum`으로 강제
- 교훈: AI에게 자유 입력을 허용하면 오분류 발생. 고정 도메인 값은 반드시 enum으로 강제할 것

**subcategory 0건 시 keyword 자동 재조회**
- 사용자: "외식비 보여줘" → AI가 category 대신 subcategory="외식비"로 잘못 전송 → 0건
- 해결: `runTxQuery()`에서 subcategory 0건이면 keyword로 자동 재조회 (코드 레벨 보장)
- 교훈: 프롬프트 의존 정확도 개선보다 코드 레벨 fallback이 더 견고함

---

### ⚠️ 트러블슈팅

**SSE 스트리밍 중 Tool use 루프**
- OpenAI 스트리밍 + Tool use를 동시에 사용하면 청크를 모두 모은 후 tool_calls를 재조립해야 함
- 교훈: 스트리밍 모드에서 tool_calls는 delta로 분할 전송됨. `toolCallMap`으로 index별 조립 필요

---

## Phase 5 — 텔레그램 봇

### ✅ 잘 된 것

**외부 패키지 없이 Telegram Bot API 직접 사용**
- `node-telegram-bot-api` 대신 `fetch`로 직접 Webhook 구현
- 패키지 의존성 최소화, Next.js App Router와 충돌 없음
- 교훈: 단순 Webhook 처리는 SDK 없이 fetch로도 충분. 패키지 추가 전 직접 구현 검토

**non-streaming 에이전트 분리 (lib/openai/agent.ts)**
- 웹(SSE 스트리밍)과 텔레그램(단건 응답)의 에이전트 로직을 분리
- 공통 Tool use 로직(`lib/openai/tools.ts`)은 공유
- 교훈: 동일 AI 기능을 여러 채널에 제공할 때 스트리밍/비스트리밍 분리가 깔끔

---

### ⚠️ 트러블슈팅

**텔레그램 Webhook에서 Supabase 데이터 조회 0건**
- 원인: Webhook 요청에 세션 쿠키 없음 → Supabase anon 클라이언트 → RLS 차단
- 해결: `lib/supabase/service.ts` 생성, Service Role 클라이언트로 RLS 우회
- 교훈: 외부 Webhook(인증 쿠키 없는 서버-서버 요청)은 Service Role 사용 필수. 단, 외부 인증(chat_id 화이트리스트)을 먼저 검증한 후에만 사용

---

### 재사용 가능한 패턴

**Telegram Webhook 엔드포인트 (Next.js App Router)**
```typescript
// 인증: TELEGRAM_ALLOWED_CHAT_IDS 화이트리스트
// 응답: 항상 200 OK 반환 (Telegram 재시도 방지)
export async function POST(request: Request) {
  let chatId: number | undefined
  try {
    const body = await request.json()
    chatId = body.message?.chat?.id
    if (!chatId || !getAllowedIds().includes(String(chatId))) return Response.json({ ok: true })
    // 처리 로직
  } catch (err) {
    captureError(err, { route: '/api/telegram', feature: 'telegram-bot' })
    if (chatId) await sendMessage(chatId, '문제가 발생했습니다.').catch(() => {})
  }
  return Response.json({ ok: true })
}
```

---

## Phase 6 — 안정화

### ✅ 잘 된 것

**Sentry beforeSend로 민감 데이터 자동 필터**
- `sentry.server.config.ts`에서 `beforeSend` 훅으로 cookies, authorization 헤더, request body 제거
- 교훈: 금융 서비스에서 에러 모니터링 도입 시 `beforeSend` 필터 필수. 설정 없이 사용하면 민감 데이터가 외부로 전송될 수 있음

**errorId 기반 에러 응답**
- 사용자에게 스택 트레이스 대신 `문제가 발생했습니다. (ID: A3F9B2C1)` 형태로 노출
- 동일 errorId로 Sentry에서 원인 추적 가능
- 교훈: 프로덕션 에러 메시지에는 상세 내용 노출 금지. errorId만 노출하고 내부에서 추적

---

### ⚠️ 트러블슈팅

**@sentry/nextjs v10 `disableSourceMapUpload` 옵션 제거**
- v10에서 `disableSourceMapUpload` → `sourcemaps: { disable: true }`로 변경됨
- 교훈: Sentry SDK 메이저 버전 업 시 withSentryConfig 옵션 타입 확인 필수

**Supabase 동적 select 컬럼과 TypeScript 타입 추론**
- `select(columns)` where `columns`가 런타임 변수이면 Supabase가 타입 추론 불가 → `ParserError` 반환
- 해결: `as unknown as TargetType[]` 중간 단계 캐스트 (이유 주석 필수)
- 교훈: Supabase TypeScript 타입은 select 문자열이 컴파일 타임 리터럴일 때만 정확히 추론됨
