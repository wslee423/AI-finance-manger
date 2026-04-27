-- ============================================================
-- AI Finance Management — DB 스키마
-- Supabase SQL Editor에서 순서대로 실행
-- ============================================================

-- 1. transactions (가계부 원장)
drop table if exists transactions cascade;

create table transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  class         text not null check (class in ('수입', '지출', '이체')),
  type          text not null,        -- 주수입 / 고정지출 / 변동지출 / 기타수입 / 기타지출
  category      text,                 -- 월급 / 외식비 / 보험 등
  subcategory   text,                 -- 세부항목
  item          text,                 -- 더 세부항목
  amount        bigint not null default 0,
  payment       text,                 -- 결제수단 (카드/현금 등)
  user_name     text check (user_name in ('Owner', 'Spouse', 'Child', 'Shared')),
  memo          text,
  tags          text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index idx_tr_date     on transactions (date desc);
create index idx_tr_class    on transactions (class, type);
create index idx_tr_category on transactions (category);
create index idx_tr_user     on transactions (user_name);
create index idx_tr_active   on transactions (deleted_at) where deleted_at is null;

-- 2. assets (월별 자산 스냅샷)
drop table if exists assets cascade;

create table assets (
  id                uuid primary key default gen_random_uuid(),
  snapshot_date     date not null,
  asset_type        text not null check (asset_type in ('부동산', '통장', '연금', '예적금', '기타', '대출')),
  assettype         text,             -- 세부 자산 유형 (신용대출, 퇴직금DC, CMA 등)
  institution       text,             -- 금융기관명 (국민은행, k뱅크 등 / 현금은 null)
  balance           bigint not null,
  owner             text not null check (owner in ('Owner', 'Spouse', 'Shared')),
  contribution_rate numeric(5,4),
  memo              text,
  created_at        timestamptz not null default now()
);

create index idx_assets_date  on assets (snapshot_date desc);
create index idx_assets_owner on assets (owner);

-- 3. dividend (배당금)
drop table if exists dividend cascade;

create table dividend (
  id              uuid primary key default gen_random_uuid(),
  date            date not null,
  account         text,
  ticker_name     text not null,
  ticker_symbol   text,
  exchange_rate   numeric(10,2),
  usd_amount      numeric(14,4),
  krw_amount      bigint not null,
  created_at      timestamptz not null default now()
);

create index idx_div_date   on dividend (date desc);
create index idx_div_ticker on dividend (ticker_symbol);

-- 4. preset_templates (고정지출 템플릿)
drop table if exists preset_templates cascade;

create table preset_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null default '고정지출',
  category      text,
  subcategory   text,
  item          text,
  user_name     text check (user_name in ('Owner', 'Spouse', 'Child', 'Shared')),
  memo          text,
  amount        bigint not null check (amount >= 0),
  sort_order    int default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 5. backup_logs (월말 백업 이력)
drop table if exists backup_logs cascade;

create table backup_logs (
  id             uuid primary key default gen_random_uuid(),
  backup_month   text not null,
  status         text not null check (status in ('success', 'failure')),
  transactions   int default 0,
  assets         int default 0,
  dividends      int default 0,
  error_message  text,
  executed_at    timestamptz not null default now()
);

-- 6. updated_at 트리거
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_updated_at on transactions;
create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

drop trigger if exists trg_preset_updated_at on preset_templates;
create trigger trg_preset_updated_at
  before update on preset_templates
  for each row execute function set_updated_at();

-- 7. RLS 활성화
alter table transactions      enable row level security;
alter table assets            enable row level security;
alter table dividend          enable row level security;
alter table preset_templates  enable row level security;
alter table backup_logs       enable row level security;

-- 8. RLS 정책
drop policy if exists "tr_select" on transactions;
create policy "tr_select" on transactions for select using (auth.role() = 'authenticated' and deleted_at is null);
drop policy if exists "tr_insert" on transactions;
create policy "tr_insert" on transactions for insert with check (auth.role() = 'authenticated');
drop policy if exists "tr_update" on transactions;
create policy "tr_update" on transactions for update using (auth.role() = 'authenticated');

drop policy if exists "as_select" on assets;
create policy "as_select" on assets for select using (auth.role() = 'authenticated');
drop policy if exists "as_insert" on assets;
create policy "as_insert" on assets for insert with check (auth.role() = 'authenticated');
drop policy if exists "as_update" on assets;
create policy "as_update" on assets for update using (auth.role() = 'authenticated');

drop policy if exists "div_select" on dividend;
create policy "div_select" on dividend for select using (auth.role() = 'authenticated');
drop policy if exists "div_insert" on dividend;
create policy "div_insert" on dividend for insert with check (auth.role() = 'authenticated');
drop policy if exists "div_update" on dividend;
create policy "div_update" on dividend for update using (auth.role() = 'authenticated');

drop policy if exists "pre_select" on preset_templates;
create policy "pre_select" on preset_templates for select using (auth.role() = 'authenticated');
drop policy if exists "pre_insert" on preset_templates;
create policy "pre_insert" on preset_templates for insert with check (auth.role() = 'authenticated');
drop policy if exists "pre_update" on preset_templates;
create policy "pre_update" on preset_templates for update using (auth.role() = 'authenticated');

drop policy if exists "log_select" on backup_logs;
create policy "log_select" on backup_logs for select using (auth.role() = 'authenticated');
drop policy if exists "log_insert" on backup_logs;
create policy "log_insert" on backup_logs for insert with check (auth.role() = 'authenticated');
