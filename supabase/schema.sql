-- Signal App — Database Schema (multi-user + BYOK)
-- Run in Supabase SQL editor. Prefer migrations/ for incremental updates.

-- ─────────────────────────────────────────────
-- raw_stories — shared scrape pool (no user_id)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_stories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  url          text UNIQUE NOT NULL,
  source       text,
  raw_text     text,
  published_at timestamptz,
  scraped_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_stories_scraped_at ON raw_stories (scraped_at DESC);

ALTER TABLE raw_stories ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- scored_stories — per user_id
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scored_stories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  raw_story_id uuid REFERENCES raw_stories (id) ON DELETE CASCADE,
  title        text NOT NULL,
  url          text NOT NULL,
  source       text,
  summary      text,
  category     text CHECK (category IN ('opportunity', 'idea', 'intel')),
  score        int CHECK (score BETWEEN 1 AND 10),
  why          text,
  published_at timestamptz,
  scored_at    timestamptz DEFAULT now(),
  seen         boolean DEFAULT false,
  notified     boolean DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS scored_stories_user_raw_unique
  ON scored_stories (user_id, raw_story_id)
  WHERE raw_story_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scored_stories_user_id ON scored_stories (user_id);
CREATE INDEX IF NOT EXISTS idx_scored_stories_score ON scored_stories (score DESC);
CREATE INDEX IF NOT EXISTS idx_scored_stories_category ON scored_stories (category);
CREATE INDEX IF NOT EXISTS idx_scored_stories_scored_at ON scored_stories (scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_scored_stories_seen ON scored_stories (seen);

ALTER TABLE scored_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own scored_stories" ON scored_stories;
CREATE POLICY "Users read own scored_stories"
  ON scored_stories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- api_usage
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  run_at          timestamptz DEFAULT now(),
  stories_scored  int,
  input_tokens    int,
  output_tokens   int,
  estimated_cost  numeric(10, 6)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage (user_id);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- user_profiles — onboarding json keyed by auth user
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id               uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  profile               jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_completed  boolean NOT NULL DEFAULT false,
  scoring_markdown      text,
  questionnaire_answers jsonb,
  synthesized_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own user_profiles" ON user_profiles;
CREATE POLICY "Users manage own user_profiles"
  ON user_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- user_api_credentials — encrypted Anthropic key
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_api_credentials (
  user_id                  uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  anthropic_key_ciphertext text NOT NULL,
  anthropic_key_iv         text NOT NULL,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_api_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own user_api_credentials" ON user_api_credentials;
CREATE POLICY "Users manage own user_api_credentials"
  ON user_api_credentials FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- push_subscriptions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint   text UNIQUE NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- user_raw_scored — per-user completion for raw rows (incl. noise)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_raw_scored (
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  raw_story_id uuid NOT NULL REFERENCES raw_stories (id) ON DELETE CASCADE,
  scored_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, raw_story_id)
);

CREATE INDEX IF NOT EXISTS idx_user_raw_scored_user ON user_raw_scored (user_id);

ALTER TABLE user_raw_scored ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own user_raw_scored" ON user_raw_scored;
CREATE POLICY "Users read own user_raw_scored"
  ON user_raw_scored FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Stories feed — keyset pagination (service_role RPC from Next.js)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scored_stories_user_feed_sort
  ON scored_stories (user_id, score DESC, scored_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.api_scored_stories_page(
  p_user_id uuid,
  p_limit int,
  p_cutoff timestamptz,
  p_min_score int,
  p_cursor_score int DEFAULT NULL,
  p_cursor_scored_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS SETOF scored_stories
LANGUAGE sql
STABLE
AS $$
  SELECT s.*
  FROM scored_stories s
  WHERE s.user_id = p_user_id
    AND s.scored_at >= p_cutoff
    AND s.score >= p_min_score
    AND (
      p_cursor_id IS NULL
      OR (s.score, s.scored_at, s.id) < (p_cursor_score, p_cursor_scored_at, p_cursor_id)
    )
  ORDER BY s.score DESC, s.scored_at DESC, s.id DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.api_scored_stories_page(uuid, int, timestamptz, int, int, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_scored_stories_page(uuid, int, timestamptz, int, int, timestamptz, uuid) TO service_role;

-- ─────────────────────────────────────────────
-- TTL pruning (run via pg_cron or SELECT manually)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prune_signal_story_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM scored_stories
  WHERE scored_at < now() - interval '7 days';

  DELETE FROM raw_stories
  WHERE scraped_at < now() - interval '14 days';
END;
$$;

REVOKE ALL ON FUNCTION public.prune_signal_story_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_signal_story_tables() TO service_role;
