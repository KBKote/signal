CREATE OR REPLACE FUNCTION take_filter_rate_slot(
  p_user_id uuid,
  p_min_interval_ms integer
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  rows_affected integer;
BEGIN
  INSERT INTO filter_user_throttle (user_id, last_filter_at)
  VALUES (p_user_id, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET last_filter_at = NOW()
    WHERE filter_user_throttle.last_filter_at
      < NOW() - (p_min_interval_ms || ' milliseconds')::interval;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END; $$;

CREATE OR REPLACE FUNCTION take_scrape_rate_slot(
  p_user_id uuid,
  p_min_interval_ms integer
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  rows_affected integer;
BEGIN
  INSERT INTO scrape_user_throttle (user_id, last_scrape_at)
  VALUES (p_user_id, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET last_scrape_at = NOW()
    WHERE scrape_user_throttle.last_scrape_at
      < NOW() - (p_min_interval_ms || ' milliseconds')::interval;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END; $$;
