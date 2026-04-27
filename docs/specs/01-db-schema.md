# product-specs/01-db-schema.md — DB 스키마 & 인증

> Phase 1 핵심 스펙. 스키마 변경은 이 문서 업데이트 + Owner 승인 필수.
> ARCHITECTURE.md의 테이블 요약과 이 문서의 SQL이 충돌할 경우 이 문서가 기준.

---

## 1. transactions (가계부 원장)

```sql
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  class         text not null check (class in ('수입', '지출', '이체')),
  type          text not null check (type in ('주수입', '기타수입', '고정지출', '변동지출', '기타지출', '저축/투자')),
  category      text not null,
  subcategory   text,
  item          text,
  user_name     text check (user_name in ('운섭', '아름', '희온', '공동')),
  memo          text,
  amount        bigint not null default 0,  -- 원화. 0 허용 (실제 migration에서 수정됨)
  tags          text[],                               -- ex. '{#육아, #주식매도}'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz                           -- soft delete. null = 유효
);

create index idx_tr_date     on transactions (date desc);
create index idx_tr_category on transactions (category, subcategory);
create index idx_tr_user     on transactions (user_name);
create index idx_tr_active   on transactions (deleted_at) where deleted_at is null;
```

**카테고리 기준값**

| class | type | category | subcategory 예시 |
|-------|------|----------|---------------|
| 수입 | 주수입 | — | 월급, 성과금, 상여금 |
| 수입 | 기타수입 | — | 양육수당, 보험금, 중고판매 |
| 지출 | 고정지출 | 보험, 용돈, 관리비, 통신비, 구독/멤버십 | — |
| 지출 | 변동지출 | 마트/편의점, 외식비, 의류/미용, 여가비, 병원비 | — |
| 지출 | 기타지출 | 경조사, 기타 | — |
| 이체 | 저축/투자 | — | — |

---

## 2. assets (월별 자산 스냅샷)

```sql
create table assets (
  id                uuid primary key default gen_random_uuid(),
  snapshot_date     date not null,
  asset_type        text not null check (asset_type in ('부동산', '통장', '연금', '예적금', '기타', '대출')),
  institution       text not null,
  owner             text not null check (owner in ('운섭', '아름', '공동')),
  memo              text,
  balance           bigint not null,  -- 원화. 대출은 음수로 기록.
  contribution_rate numeric(5,4),     -- 공동 자산의 Owner 기여 비율 (0~1). null = 단독 자산.
  created_at        timestamptz not null default now()
);

create index idx_assets_date  on assets (snapshot_date desc);
create index idx_assets_owner on assets (owner);
```

> **대출 처리**: `asset_type = '대출'`, `balance`는 음수. 별도 컬럼 없음.
> 순자산 = `SUM(balance)` (대출 음수가 자동 차감됨)

**institution 기준값 (예시)**

| asset_type | institution 예시 |
|-----------|----------------|
| 부동산 | [아파트], [전세보증금] |
| 통장 | [증권사A](주식통장), [CMA계좌](저축통장), [스톡옵션계좌] |
| 연금 | 퇴직금(DC), 퇴직금(DB), 연금저축, ISA |
| 대출 | [대출기관] |

**공동 자산 기여도 예시** (contribution_rate 사용법):
- balance: X,XXX,000,000 / contribution_rate: 0.XXXX
- Owner 기여분 = balance × contribution_rate
- Spouse 기여분 = balance × (1 − contribution_rate)

---

## 3. dividend (배당금)

```sql
create table dividend (
  id              uuid primary key default gen_random_uuid(),
  date            date not null,
  account         text,
  ticker_name     text not null,
  ticker_symbol   text,
  exchange_rate   numeric(10,2),   -- OD-002: 환율 API 자동 조회
  usd_amount      numeric(14,4),   -- 원화 ETF는 null
  krw_amount      bigint not null,
  created_at      timestamptz not null default now()
);

create index idx_div_date   on dividend (date desc);
create index idx_div_ticker on dividend (ticker_symbol);
```

**주요 ticker 기준값 (예시)**

| ticker_symbol | ticker_name | 유형 |
|-------------|-------------|-----|
| SCHD | SCHWAB US DIVIDEND ETF | USD |
| TLT | ISHARES 20+Y TREASURY BOND | USD |
| O | Realty Income | USD |
| QQQM | INVESCO NASDAQ 100 ETF | USD |
| SGOV | iShares 0-3 Month Treasury | USD |

---

## 4. preset_templates (고정지출 템플릿)

```sql
create table preset_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,     -- Admin UI 식별용 (ex. '[보험1]/Owner')
  category      text not null default '고정지출',
  subcategory   text,
  item          text,
  user_name     text check (user_name in ('운섭', '아름', '희온', '공동')),
  memo          text,
  amount        bigint not null check (amount >= 0),  -- 0 허용 (관리비 등 매달 변동)
  sort_order    int default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

**초기 데이터 (예시 — 실제 값은 .env.local 또는 DB 시드 파일에서 관리)**

| name | subcategory | user | amount |
|------|------------|------|--------|
| [보험1]/Owner | 보험 | Owner | 00,000 |
| [보험1]/Spouse | 보험 | Spouse | 00,000 |
| [보험2]/Spouse | 보험 | Spouse | 00,000 |
| [보험3]/Owner | 보험 | Owner | 00,000 |
| [보험4]/Child | 보험 | Child | 00,000 |
| 용돈/Owner | 용돈 | Owner | 000,000 |
| 용돈/Spouse | 용돈 | Spouse | 000,000 |
| 아파트관리비 | 관리비 | Shared | 0 |
| [구독서비스] | 구독/멤버십 | Shared | 000,000 |
| 핸드폰요금 | 통신비 | Shared | 00,000 |
| [교통충전] | 교통/차량 | Shared | 00,000 |
| 월세 | 관리비 | Shared | 000,000 |

---

## 5. backup_logs (월말 백업 실행 이력)

```sql
create table backup_logs (
  id             uuid primary key default gen_random_uuid(),
  backup_month   text not null,   -- 'YYYY-MM' (백업 대상 월)
  status         text not null check (status in ('success', 'failure')),
  transactions   int default 0,
  assets         int default 0,
  dividends      int default 0,
  error_message  text,
  executed_at    timestamptz not null default now()
);
```

---

## 6. RLS 정책

```sql
alter table transactions      enable row level security;
alter table assets            enable row level security;
alter table dividend          enable row level security;
alter table preset_templates  enable row level security;
alter table backup_logs       enable row level security;

-- 허용 사용자 확인 함수 (실제 이메일은 .env.local에서 관리)
create or replace function is_allowed_user()
returns boolean language sql security definer as $$
  select auth.email() = any(
    array[
      current_setting('app.allowed_email_owner', true),
      current_setting('app.allowed_email_spouse', true)
    ]
  );
$$;

-- transactions 예시 — assets, dividend, preset_templates 동일 패턴
create policy "select_allowed" on transactions
  for select using (is_allowed_user() and deleted_at is null);
create policy "insert_allowed" on transactions
  for insert with check (is_allowed_user());
create policy "update_allowed" on transactions
  for update using (is_allowed_user());
-- DELETE 정책 없음 → hard delete 원천 차단
```

> **이메일 설정**: Supabase SQL Editor에서 아래 실행 (배포 후 1회)
> ```sql
> alter database postgres set app.allowed_email_owner = 'user-a@example.com';
> alter database postgres set app.allowed_email_spouse = 'user-b@example.com';
> ```

---

## 7. 트리거

```sql
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

create trigger trg_preset_updated_at
  before update on preset_templates
  for each row execute function set_updated_at();
```

---

## 8. TypeScript 타입 (`/types/index.ts`)

```typescript
export type ClassType = '수입' | '지출'
export type UserName  = 'Owner' | 'Spouse' | 'Child' | 'Shared'
export type AssetType = '부동산' | '통장' | '연금' | '예적금' | '기타' | '대출'

export interface Transaction {
  id:           string        // uuid
  date:         string        // 'YYYY-MM-DD'
  class_type:   ClassType
  category:     string
  subcategory:  string | null
  item:         string | null
  user_name:    UserName
  memo:         string | null
  amount:       number
  tags:         string[] | null
  created_at:   string
  updated_at:   string
  deleted_at:   string | null
}

export interface Asset {
  id:                string    // uuid
  snapshot_date:     string    // 'YYYY-MM-DD'
  asset_type:        AssetType
  institution:       string
  owner:             UserName
  balance:           number    // 대출은 음수
  contribution_rate: number | null
  created_at:        string
}

export interface Dividend {
  id:             string
  date:           string
  account:        string | null
  ticker_name:    string
  ticker_symbol:  string | null
  exchange_rate:  number | null
  usd_amount:     number | null
  krw_amount:     number
  created_at:     string
}

export interface PresetTemplate {
  id:           string
  name:         string
  category:     string
  subcategory:  string | null
  item:         string | null
  user_name:    UserName
  memo:         string | null
  amount:       number
  sort_order:   number
  is_active:    boolean
}
```

> **타입 안전성**: Supabase CLI로 자동 생성한 DB 타입 사용 권장.
> `supabase gen types typescript --project-id <ID> > types/supabase.ts`
