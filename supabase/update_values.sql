-- ============================================================
-- 1. user_name: 영문 → 한글
-- ============================================================
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_name_check;

UPDATE transactions SET user_name = '운섭' WHERE user_name = 'Owner';
UPDATE transactions SET user_name = '아름' WHERE user_name = 'Spouse';
UPDATE transactions SET user_name = '희온' WHERE user_name = 'Child';
UPDATE transactions SET user_name = '공동' WHERE user_name = 'Shared';

ALTER TABLE transactions ADD CONSTRAINT transactions_user_name_check
  CHECK (user_name IN ('운섭', '아름', '희온', '공동'));

-- ============================================================
-- 2. assets owner: 영문 → 한글
-- ============================================================
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_owner_check;

UPDATE assets SET owner = '운섭' WHERE owner = 'Owner';
UPDATE assets SET owner = '아름' WHERE owner = 'Spouse';
UPDATE assets SET owner = '공동' WHERE owner = 'Shared';

ALTER TABLE assets ADD CONSTRAINT assets_owner_check
  CHECK (owner IN ('운섭', '아름', '공동'));

-- ============================================================
-- 3. tags: text[] → text (쉼표 구분 문자열)
-- ============================================================
ALTER TABLE transactions
  ALTER COLUMN tags TYPE text
  USING array_to_string(tags, ',');

-- ============================================================
-- 검증
-- ============================================================
SELECT user_name, count(*) FROM transactions GROUP BY user_name;
SELECT owner, count(*) FROM assets GROUP BY owner;
SELECT tags FROM transactions WHERE tags IS NOT NULL LIMIT 3;
