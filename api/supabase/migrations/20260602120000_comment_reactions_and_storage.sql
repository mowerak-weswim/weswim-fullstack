-- Comment likes + Supabase Storage bucket for post images

CREATE TABLE IF NOT EXISTS comment_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(comment_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment
  ON comment_reactions(comment_id);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON comment_reactions TO anon, authenticated;
GRANT INSERT, DELETE ON comment_reactions TO authenticated;

CREATE POLICY comment_reactions_select_public ON comment_reactions
  FOR SELECT USING (true);

CREATE POLICY comment_reactions_insert_own ON comment_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY comment_reactions_delete_own ON comment_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket: post-images (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS post_images_storage_select ON storage.objects;
DROP POLICY IF EXISTS post_images_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS post_images_storage_delete_own ON storage.objects;

CREATE POLICY post_images_storage_select ON storage.objects
  FOR SELECT
  USING (bucket_id = 'post-images');

CREATE POLICY post_images_storage_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY post_images_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
