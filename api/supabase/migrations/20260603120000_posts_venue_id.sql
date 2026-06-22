-- Venue hub: link square venue posts to a swimming pool
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(venue_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_venue ON posts(venue_id, created_at DESC)
  WHERE venue_id IS NOT NULL;
