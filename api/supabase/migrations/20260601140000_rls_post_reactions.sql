-- RLS: post_reactions (read public / write authenticated own)

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON post_reactions TO anon, authenticated;
GRANT INSERT, DELETE ON post_reactions TO authenticated;

CREATE POLICY post_reactions_select_public ON post_reactions
  FOR SELECT USING (true);

CREATE POLICY post_reactions_insert_own ON post_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY post_reactions_delete_own ON post_reactions
  FOR DELETE USING (auth.uid() = user_id);
