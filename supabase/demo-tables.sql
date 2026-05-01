-- ============================================================
-- AI Finance Management — Demo Schema
-- Supabase SQL Editor에서 실행 (1회)
-- ============================================================

-- 1. Demo Schema 생성
CREATE SCHEMA IF NOT EXISTS demo;

-- 2. demo.transactions
DROP TABLE IF EXISTS demo.transactions CASCADE;

CREATE TABLE demo.transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  class         text not null check (class in ('수입', '지출', '이체')),
  type          text not null,
  category      text,
  subcategory   text,
  item          text,
  amount        bigint not null default 0,
  payment       text,
  user_name     text check (user_name in ('Owner', 'Spouse', 'Child', 'Shared')),
  memo          text,
  tags          text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

CREATE INDEX idx_demo_tr_date     ON demo.transactions (date desc);
CREATE INDEX idx_demo_tr_class    ON demo.transactions (class, type);
CREATE INDEX idx_demo_tr_category ON demo.transactions (category);
CREATE INDEX idx_demo_tr_user     ON demo.transactions (user_name);
CREATE INDEX idx_demo_tr_active   ON demo.transactions (deleted_at) WHERE deleted_at IS NULL;

-- 3. demo.assets
DROP TABLE IF EXISTS demo.assets CASCADE;

CREATE TABLE demo.assets (
  id                uuid primary key default gen_random_uuid(),
  snapshot_date     date not null,
  asset_type        text not null check (asset_type in ('부동산', '통장', '연금', '예적금', '기타', '대출')),
  assettype         text,
  institution       text,
  balance           bigint not null,
  owner             text not null check (owner in ('Owner', 'Spouse', 'Shared')),
  contribution_rate numeric(5,4),
  memo              text,
  created_at        timestamptz not null default now()
);

CREATE INDEX idx_demo_assets_date  ON demo.assets (snapshot_date desc);
CREATE INDEX idx_demo_assets_owner ON demo.assets (owner);

-- 4. demo.dividend
DROP TABLE IF EXISTS demo.dividend CASCADE;

CREATE TABLE demo.dividend (
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

CREATE INDEX idx_demo_div_date   ON demo.dividend (date desc);
CREATE INDEX idx_demo_div_ticker ON demo.dividend (ticker_symbol);

-- 5. updated_at 트리거 (set_updated_at 함수는 public schema에 이미 존재)
DROP TRIGGER IF EXISTS trg_demo_transactions_updated_at ON demo.transactions;
CREATE TRIGGER trg_demo_transactions_updated_at
  BEFORE UPDATE ON demo.transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. RLS 활성화
ALTER TABLE demo.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.assets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.dividend     ENABLE ROW LEVEL SECURITY;

-- 7. RLS 정책
DROP POLICY IF EXISTS "demo_tr_select" ON demo.transactions;
CREATE POLICY "demo_tr_select" ON demo.transactions FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);
DROP POLICY IF EXISTS "demo_tr_insert" ON demo.transactions;
CREATE POLICY "demo_tr_insert" ON demo.transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "demo_tr_update" ON demo.transactions;
CREATE POLICY "demo_tr_update" ON demo.transactions FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "demo_as_select" ON demo.assets;
CREATE POLICY "demo_as_select" ON demo.assets FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "demo_as_insert" ON demo.assets;
CREATE POLICY "demo_as_insert" ON demo.assets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "demo_as_update" ON demo.assets;
CREATE POLICY "demo_as_update" ON demo.assets FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "demo_div_select" ON demo.dividend;
CREATE POLICY "demo_div_select" ON demo.dividend FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "demo_div_insert" ON demo.dividend;
CREATE POLICY "demo_div_insert" ON demo.dividend FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "demo_div_update" ON demo.dividend;
CREATE POLICY "demo_div_update" ON demo.dividend FOR UPDATE USING (auth.role() = 'authenticated');

-- 8. Supabase에서 demo schema 접근 허용
GRANT USAGE ON SCHEMA demo TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA demo TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA demo TO authenticated;
