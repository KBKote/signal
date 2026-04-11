-- DB-backed rate limit for POST /api/filter (BYOK spend protection on serverless).
CREATE TABLE IF NOT EXISTS public.filter_user_throttle (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  last_filter_at timestamptz NOT NULL
);

ALTER TABLE public.filter_user_throttle ENABLE ROW LEVEL SECURITY;
