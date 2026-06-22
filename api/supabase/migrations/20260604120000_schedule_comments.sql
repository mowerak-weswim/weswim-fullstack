-- Schedule comments (group lane schedule detail)

CREATE TABLE schedule_comments (
  comment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID NOT NULL REFERENCES group_schedules(schedule_id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  parent_comment_id UUID REFERENCES schedule_comments(comment_id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_comments_schedule ON schedule_comments(schedule_id);
CREATE INDEX idx_schedule_comments_parent ON schedule_comments(parent_comment_id);
