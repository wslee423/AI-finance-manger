-- assets 테이블 upsert를 위한 unique constraint 추가
-- onConflict: 'snapshot_date,asset_type,assettype,institution,owner' 동작에 필요
-- NULLS NOT DISTINCT: assettype/institution이 null이어도 동일값으로 취급 (PostgreSQL 15+)
ALTER TABLE assets
  ADD CONSTRAINT assets_snapshot_unique
  UNIQUE NULLS NOT DISTINCT (snapshot_date, asset_type, assettype, institution, owner);
