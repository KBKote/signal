-- DB-backed scrape rate limit for signed-in users (serverless-safe).
CREATE TABLE IF NOT EXISTS public.scrape_user_throttle (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  last_scrape_at timestamptz NOT NULL
);

ALTER TABLE public.scrape_user_throttle ENABLE ROW LEVEL SECURITY;
