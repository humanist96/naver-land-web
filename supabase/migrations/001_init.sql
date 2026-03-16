-- NaverLand Web Dashboard - 초기 스키마

-- 1. 사용자 프로필 (Supabase Auth 확장)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 프로필 자동 생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. 매물 스냅샷
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atcl_no TEXT NOT NULL,
  atcl_nm TEXT NOT NULL,
  district_code TEXT NOT NULL,
  district_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  property_type TEXT NOT NULL,
  exclusive_area REAL NOT NULL,
  supply_area REAL NOT NULL,
  pyeong REAL NOT NULL,
  size_type TEXT NOT NULL,
  price INTEGER NOT NULL,
  price_display TEXT NOT NULL,
  rent_price INTEGER,
  floor_info TEXT,
  confirm_date TEXT,
  tags JSONB DEFAULT '[]',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  naver_url TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_id TEXT NOT NULL
);

CREATE INDEX idx_listings_district ON listings(district_code);
CREATE INDEX idx_listings_snapshot ON listings(snapshot_id);
CREATE INDEX idx_listings_collected ON listings(collected_at DESC);
CREATE INDEX idx_listings_atcl ON listings(atcl_no);
CREATE INDEX idx_listings_trade ON listings(trade_type);
CREATE INDEX idx_listings_size ON listings(size_type);
CREATE INDEX idx_listings_price ON listings(price);

-- 3. 변경 이력
CREATE TABLE listing_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atcl_no TEXT NOT NULL,
  atcl_nm TEXT NOT NULL DEFAULT '',
  change_type TEXT NOT NULL CHECK (change_type IN ('new', 'removed', 'price_up', 'price_down')),
  old_price INTEGER,
  new_price INTEGER,
  price_diff INTEGER,
  price_diff_percent REAL,
  old_rent INTEGER,
  new_rent INTEGER,
  district_code TEXT NOT NULL DEFAULT '',
  district_name TEXT NOT NULL,
  trade_type TEXT NOT NULL DEFAULT '',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_id TEXT NOT NULL
);

CREATE INDEX idx_changes_district ON listing_changes(district_code);
CREATE INDEX idx_changes_detected ON listing_changes(detected_at DESC);
CREATE INDEX idx_changes_type ON listing_changes(change_type);
CREATE INDEX idx_changes_snapshot ON listing_changes(snapshot_id);

-- 4. 수집 작업
CREATE TABLE collection_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_code TEXT NOT NULL,
  district_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  trade_types JSONB NOT NULL DEFAULT '["매매"]',
  property_types JSONB NOT NULL DEFAULT '["APT", "JGC"]',
  schedule TEXT NOT NULL DEFAULT '0 */6 * * *',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('success', 'failed', 'running')),
  last_error TEXT,
  total_count INTEGER,
  change_count INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_active ON collection_jobs(is_active);

-- 5. 시장 스냅샷 (대시보드용)
CREATE TABLE market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_code TEXT NOT NULL,
  district_name TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  trade_type TEXT NOT NULL,
  total_count INTEGER NOT NULL,
  avg_price INTEGER NOT NULL,
  median_price INTEGER NOT NULL,
  min_price INTEGER NOT NULL,
  max_price INTEGER NOT NULL,
  size_distribution JSONB NOT NULL DEFAULT '{}',
  new_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  price_up_count INTEGER NOT NULL DEFAULT 0,
  price_down_count INTEGER NOT NULL DEFAULT 0,
  snapshot_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_district_date ON market_snapshots(district_code, snapshot_date DESC);
CREATE INDEX idx_snapshots_trade ON market_snapshots(trade_type);

-- 6. 즐겨찾기
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query_params JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_user ON saved_searches(user_id);

-- RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- profiles: 자신의 프로필 읽기, 관리자는 전체 읽기/수정
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- listings: 승인된 사용자만 읽기
CREATE POLICY "Approved users can read listings"
  ON listings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- Service role은 insert 가능 (수집 스크립트)
CREATE POLICY "Service can insert listings"
  ON listings FOR INSERT
  WITH CHECK (true);

-- listing_changes: 승인된 사용자만 읽기
CREATE POLICY "Approved users can read changes"
  ON listing_changes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Service can insert changes"
  ON listing_changes FOR INSERT
  WITH CHECK (true);

-- market_snapshots: 승인된 사용자만 읽기
CREATE POLICY "Approved users can read snapshots"
  ON market_snapshots FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Service can insert snapshots"
  ON market_snapshots FOR INSERT
  WITH CHECK (true);

-- collection_jobs: 관리자만
CREATE POLICY "Admins can manage jobs"
  ON collection_jobs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service can update jobs"
  ON collection_jobs FOR UPDATE
  WITH CHECK (true);

-- saved_searches: 자신의 것만
CREATE POLICY "Users can manage own searches"
  ON saved_searches FOR ALL
  USING (auth.uid() = user_id);
