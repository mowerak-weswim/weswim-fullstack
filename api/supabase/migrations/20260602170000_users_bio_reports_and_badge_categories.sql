-- Profile bio and system notification default
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio VARCHAR(100);

ALTER TABLE users
  ALTER COLUMN notification_prefs
  SET DEFAULT '{
    "group_chat": true,
    "comment": true,
    "like": true,
    "system": true
  }'::jsonb;

UPDATE users
SET notification_prefs = COALESCE(notification_prefs, '{}'::jsonb) || '{"system": true}'::jsonb
WHERE NOT (COALESCE(notification_prefs, '{}'::jsonb) ? 'system');

-- User reports (fixed reason codes + moderation status)
CREATE TABLE IF NOT EXISTS user_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  reason_code VARCHAR(20) NOT NULL CHECK (reason_code IN ('spam', 'abuse', 'fake', 'other')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'actioned', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewer_note TEXT,
  CHECK (reporter_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_reports_target_created
  ON user_reports(target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_target_reason_created
  ON user_reports(reporter_id, target_user_id, reason_code, created_at DESC);

-- 24h duplicate report: enforced in API (rolling window, KST) — reports.py create_user_report.
-- Functional unique index on date_trunc(timestamptz) is not IMMUTABLE (SQLSTATE 42P17).
