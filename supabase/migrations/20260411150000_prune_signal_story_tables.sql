-- Time-based pruning so raw_stories / scored_stories do not grow without bound.
-- Order: scored_stories first (feed TTL), then raw pool (older rows may still have recent scores until scored is cleared).
-- user_raw_scored rows referencing deleted raw_stories are removed via ON DELETE CASCADE on raw_story_id.
--
-- Schedule in Supabase (pg_cron extension): e.g. weekly
--   SELECT cron.schedule('prune_signal', '0 4 * * 0', $$SELECT public.prune_signal_story_tables();$$);
-- Or run manually in SQL editor: SELECT public.prune_signal_story_tables();

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

COMMENT ON FUNCTION public.prune_signal_story_tables IS
  'Prunes scored_stories older than 7d and raw_stories older than 14d. Call via pg_cron or SELECT manually.';
