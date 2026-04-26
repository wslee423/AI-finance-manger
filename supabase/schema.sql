-- ============================================================
-- AI Finance Management — DB 스키마
-- Supabase SQL Editor에서 순서대로 실행
-- ============================================================

-- 1. transactions (가계부 원장)
create table if not exists transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  class_type    text not null check (class_type in ('수입', '지출')),
  category      text not null,
  subcategory   text,
  item          text,
  user_name     text check (user_name in ('Owner', 'Spouse', 'Child', 'Shared')),
  memo          text,
  amount        bigint not null check (amount > 0),
  tags          text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_tr_date     on transactions (date desc);
create index if not exists idx_tr_category on transactions (category, subcategory);
create index if not exists idx_tr_user     on transactions (user_name);
create index if not exists idx_tr_active   on transactions (deleted_at) where deleted_at is null;

-- 2. assets (월별 자산 스냅샷)
create table if not exists assets (
  id                uuid primary key default gen_random_uuid(),
  snapshot_date     date not null,
  asset_type        text not null check (asset_type in ('부동산', '통장', '연금', '예적금', '기타', '대출')),
  institution       text not null,
  owner             text not null check (owner in ('Owner', 'Spouse', 'Shared')),
  balance           bigint not null,
  contribution_rate numeric(5,4),
  memo              text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_assets_date  on assets (snapshot_date desc);
create index if not exists idx_assets_owner on assets (owner);

-- 3. dividend (배당금)
create table if not exists dividend (
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

create index if not exists idx_div_date   on dividend (date desc);
create index if not exists idx_div_ticker on dividend (ticker_symbol);

-- 4. preset_templates (고정지출 템플릿)
create table if not exists preset_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null default '고정지출',
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
create table if not exists backup_logs (
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

create or replace trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

create or replace trigger trg_preset_updated_at
  before update on preset_templates
  for each row execute function set_updated_at();

-- 7. RLS 활성화
alter table transactions      enable row level security;
alter table assets            enable row level security;
alter table dividend          enable row level security;
alter table preset_templates  enable row level security;
alter table backup_logs       enable row level security;

-- 8. 허용 사용자 확인 함수
-- 아래 이메일 값은 실제 이메일로 교체 후 실행
create or replace function is_allowed_user()
returns boolean language sql security definer as $$
  select auth.email() = any(
    array[
      current_setting('app.allowed_email_owner', true),
      current_setting('app.allowed_email_spouse', true)
    ]
  );
$$;

-- 9. RLS 정책
-- transactions
create policy "tr_select" on transactions for select using (is_allowed_user() and deleted_at is null);
create policy "tr_insert" on transactions for insert with check (is_allowed_user());
create policy "tr_update" on transactions for update using (is_allowed_user());

-- assets
create policy "as_select" on assets for select using (is_allowed_user());
create policy "as_insert" on assets for insert with check (is_allowed_user());
create policy "as_update" on assets for update using (is_allowed_user());

-- dividend
create policy "div_select" on dividend for select using (is_allowed_user());
create policy "div_insert" on dividend for insert with check (is_allowed_user());
create policy "div_update" on dividend for update using (is_allowed_user());

-- preset_templates
create policy "pre_select" on preset_templates for select using (is_allowed_user());
create policy "pre_insert" on preset_templates for insert with check (is_allowed_user());
create policy "pre_update" on preset_templates for update using (is_allowed_user());

-- backup_logs
create policy "log_select" on backup_logs for select using (is_allowed_user());
create policy "log_insert" on backup_logs for insert with check (is_allowed_user());
