CREATE TABLE IF NOT EXISTS auth_rate_limit (
  identifier text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT NOW(),
  blocked_until timestamptz
);

CREATE OR REPLACE FUNCTION check_auth_rate_limit(
  p_identifier text,
  p_max_attempts integer,
  p_window_seconds integer,
  p_block_seconds integer
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  rec auth_rate_limit%ROWTYPE;
  now_ts timestamptz := NOW();
BEGIN
  SELECT * INTO rec FROM auth_rate_limit WHERE identifier = p_identifier;
  IF NOT FOUND THEN
    INSERT INTO auth_rate_limit (identifier, attempt_count, window_start)
    VALUES (p_identifier, 1, now_ts);
    RETURN true;
  END IF;
  IF rec.blocked_until IS NOT NULL AND now_ts < rec.blocked_until THEN
    RETURN false;
  END IF;
  IF now_ts - rec.window_start > (p_window_seconds || ' seconds')::interval THEN
    UPDATE auth_rate_limit
    SET attempt_count = 1, window_start = now_ts, blocked_until = NULL
    WHERE identifier = p_identifier;
    RETURN true;
  END IF;
  IF rec.attempt_count >= p_max_attempts THEN
    UPDATE auth_rate_limit
    SET blocked_until = now_ts + (p_block_seconds || ' seconds')::interval
    WHERE identifier = p_identifier;
    RETURN false;
  END IF;
  UPDATE auth_rate_limit SET attempt_count = attempt_count + 1
  WHERE identifier = p_identifier;
  RETURN true;
END; $$;
