-- User notification preferences (settings UI)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{
    "group_chat": true,
    "comment": true,
    "like": true
  }'::jsonb;
