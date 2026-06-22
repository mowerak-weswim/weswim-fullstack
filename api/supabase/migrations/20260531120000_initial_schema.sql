-- WeSwim initial schema (TECHNICAL_SPECIFICATION.md §3, v2.1)
-- Apply: supabase db reset (local) | supabase db push (remote)

-- ---------------------------------------------------------------------------
-- Core users & profiles
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      VARCHAR(255) UNIQUE NOT NULL,
  nickname   VARCHAR(50)  UNIQUE NOT NULL,
  user_type  VARCHAR(20)  DEFAULT 'member',
  venue_request_total_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE sport_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id) ON DELETE CASCADE,
  sport_type VARCHAR(30) NOT NULL,
  level      VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sport_type)
);

-- ---------------------------------------------------------------------------
-- Venues & groups
-- ---------------------------------------------------------------------------

CREATE TABLE venues (
  venue_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_type     VARCHAR(30)  NOT NULL DEFAULT 'swimming',
  name           VARCHAR(100) NOT NULL,
  region         VARCHAR(50),
  address        VARCHAR(200),
  canonical_key  VARCHAR(200),
  status         VARCHAR(20) DEFAULT 'pending',
  created_by     UUID REFERENCES users(user_id),
  activated_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE venue_requests (
  req_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(user_id),
  venue_id       UUID NOT NULL REFERENCES venues(venue_id),
  name           VARCHAR(100) NOT NULL,
  address        VARCHAR(200),
  canonical_key  VARCHAR(200) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, venue_id)
);

CREATE TABLE groups (
  group_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   UUID REFERENCES venues(venue_id),
  sport_type VARCHAR(30) NOT NULL DEFAULT 'swimming',
  level      VARCHAR(20) NOT NULL,
  schedule   JSONB NOT NULL,
  status     VARCHAR(20) DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (venue_id, sport_type, level, schedule)
);

CREATE TABLE group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  role       VARCHAR(20) DEFAULT 'member',
  UNIQUE(group_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Records & posts
-- ---------------------------------------------------------------------------

CREATE TABLE records (
  record_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(user_id) ON DELETE CASCADE,
  sport_type  VARCHAR(30) NOT NULL,
  record_data JSONB NOT NULL,
  is_public   VARCHAR(20) DEFAULT 'private',
  recorded_at DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE posts (
  post_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id) ON DELETE CASCADE,
  sport_type VARCHAR(30),
  group_id   UUID REFERENCES groups(group_id),
  category   VARCHAR(50) NOT NULL,
  title      VARCHAR(200),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE comments (
  comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Group schedules (RSVP / vote)
-- ---------------------------------------------------------------------------

CREATE TABLE group_schedules (
  schedule_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(user_id),
  type          VARCHAR(20) NOT NULL,
  status        VARCHAR(20) NOT NULL,
  title         VARCHAR(200),
  scheduled_at  TIMESTAMPTZ,
  location      VARCHAR(200),
  deadline_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schedule_rsvps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES group_schedules(schedule_id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  response    VARCHAR(20) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schedule_id, user_id)
);

CREATE TABLE schedule_vote_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES group_schedules(schedule_id) ON DELETE CASCADE,
  label       VARCHAR(200) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE schedule_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id   UUID NOT NULL REFERENCES schedule_vote_options(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(option_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  noti_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,
  ref_id     UUID,
  message    TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Badges (§13)
-- ---------------------------------------------------------------------------

CREATE TABLE badges (
  badge_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         VARCHAR(50) NOT NULL,
  level            VARCHAR(50),
  condition_type   VARCHAR(50) NOT NULL,
  condition_value  INTEGER NOT NULL,
  master_threshold INTEGER,
  label            VARCHAR(100) NOT NULL,
  icon             VARCHAR(100) NOT NULL
);

CREATE TABLE user_badges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(user_id),
  badge_id       UUID NOT NULL REFERENCES badges(badge_id),
  earned_count   INTEGER NOT NULL DEFAULT 1,
  streak_count   INTEGER NOT NULL DEFAULT 1,
  is_master      BOOLEAN DEFAULT FALSE,
  verified_by    VARCHAR(50) DEFAULT NULL,
  earned_at      TIMESTAMPTZ DEFAULT now(),
  last_earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE badge_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(user_id),
  badge_id      UUID NOT NULL REFERENCES badges(badge_id),
  current_value INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE user_badge_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id),
  goal_type   VARCHAR(50) NOT NULL,
  goal_value  INTEGER NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, goal_type)
);

-- ---------------------------------------------------------------------------
-- Indexes (§3.3)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX idx_users_email    ON users(email);
CREATE UNIQUE INDEX idx_users_nickname ON users(nickname);

CREATE INDEX idx_posts_feed    ON posts(sport_type, category, created_at DESC);
CREATE INDEX idx_posts_group   ON posts(group_id, created_at DESC);

CREATE INDEX idx_records_user  ON records(user_id, sport_type, recorded_at DESC);

CREATE INDEX idx_groups_venue ON groups(venue_id, sport_type, status);

CREATE INDEX idx_gm_user  ON group_members(user_id);
CREATE INDEX idx_gm_group ON group_members(group_id);

CREATE INDEX idx_noti_user ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX idx_venues_status ON venues(status, sport_type);
CREATE INDEX idx_venues_canonical ON venues(canonical_key);

CREATE INDEX idx_vr_user ON venue_requests(user_id);

CREATE INDEX idx_gs_group ON group_schedules(group_id, status, scheduled_at);

CREATE INDEX idx_comments_post ON comments(post_id, created_at DESC);

CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
