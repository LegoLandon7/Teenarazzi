CREATE TABLE IF NOT EXISTS users (
  slug TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_json TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  display_name TEXT NOT NULL,
  active_community TEXT NOT NULL
    CHECK (active_community IN ('discord', 'reddit', 'both')),
  payload_json TEXT NOT NULL,
  turnstile_passed INTEGER NOT NULL DEFAULT 0
    CHECK (turnstile_passed IN (0, 1)),
  ip_hash TEXT NOT NULL,
  origin TEXT,
  user_agent TEXT,
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created_at
  ON submissions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT NOT NULL,
  bucket_hour INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, bucket_hour)
);
