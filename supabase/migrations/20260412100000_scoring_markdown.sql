-- Per-user synthesized scoring profile (Haiku batch context) + questionnaire snapshot
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS scoring_markdown   text,
  ADD COLUMN IF NOT EXISTS questionnaire_answers jsonb,
  ADD COLUMN IF NOT EXISTS synthesized_at     timestamptz;
