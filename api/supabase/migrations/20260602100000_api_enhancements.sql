-- API enhancements: tags, views, bookmarks, images, comment replies

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(comment_id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS post_images (
  image_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_images_post ON post_images(post_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user ON post_bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_bookmarks ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON post_images TO anon, authenticated;
GRANT INSERT, DELETE ON post_images TO authenticated;

GRANT SELECT, INSERT, DELETE ON post_bookmarks TO authenticated;

CREATE POLICY post_images_select_public ON post_images
  FOR SELECT USING (true);

CREATE POLICY post_images_insert_authenticated ON post_images
  FOR INSERT WITH CHECK (true);

CREATE POLICY post_images_delete_authenticated ON post_images
  FOR DELETE USING (true);

CREATE POLICY post_bookmarks_select_own ON post_bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY post_bookmarks_insert_own ON post_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY post_bookmarks_delete_own ON post_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Seed badge definitions (MVP samples)
INSERT INTO badges (category, level, condition_type, condition_value, label, icon)
SELECT * FROM (VALUES
  ('distance', 'bronze', 'monthly_distance', 5000, '5km 달성', 'pool'),
  ('distance', 'silver', 'monthly_distance', 15000, '15km 달성', 'pool'),
  ('distance', 'gold', 'monthly_distance', 25000, '25km 달성', 'pool'),
  ('streak', 'bronze', 'swim_days', 7, '7일 연속', 'calendar_month'),
  ('community', NULL, 'comment_count', 50, '댓글 50개', 'mode_comment')
) AS v(category, level, condition_type, condition_value, label, icon)
WHERE NOT EXISTS (SELECT 1 FROM badges LIMIT 1);
