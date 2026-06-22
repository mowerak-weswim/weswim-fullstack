-- RLS: users, posts, comments (read public / write authenticated)

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON users TO anon, authenticated;
GRANT INSERT, UPDATE ON users TO authenticated;

GRANT SELECT ON posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON posts TO authenticated;

GRANT SELECT ON comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON comments TO authenticated;

-- users
CREATE POLICY users_select_public ON users
  FOR SELECT USING (true);

CREATE POLICY users_insert_own ON users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = user_id);

-- posts
CREATE POLICY posts_select_public ON posts
  FOR SELECT USING (true);

CREATE POLICY posts_insert_authenticated ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY posts_update_own ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY posts_delete_own ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- comments
CREATE POLICY comments_select_public ON comments
  FOR SELECT USING (true);

CREATE POLICY comments_insert_authenticated ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY comments_update_own ON comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY comments_delete_own ON comments
  FOR DELETE USING (auth.uid() = user_id);
