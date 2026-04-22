-- Keyset pagination for /api/stories (score DESC, scored_at DESC, id DESC).
-- Called only with service role from Next.js.

CREATE INDEX IF NOT EXISTS idx_scored_stories_user_feed_sort
  ON scored_stories (user_id, score DESC, scored_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.api_scored_stories_page(
  p_user_id uuid,
  p_limit int,
  p_cutoff timestamptz,
  p_min_score int,
  p_cursor_score int DEFAULT NULL,
  p_cursor_scored_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_published_cutoff timestamptz DEFAULT NULL
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
    AND (p_published_cutoff IS NULL OR s.published_at IS NULL OR s.published_at >= p_published_cutoff)
    AND (
      p_cursor_id IS NULL
      OR (s.score, s.scored_at, s.id) < (p_cursor_score, p_cursor_scored_at, p_cursor_id)
    )
  ORDER BY s.score DESC, s.scored_at DESC, s.id DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.api_scored_stories_page(uuid, int, timestamptz, int, int, timestamptz, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_scored_stories_page(uuid, int, timestamptz, int, int, timestamptz, uuid, timestamptz) TO service_role;
