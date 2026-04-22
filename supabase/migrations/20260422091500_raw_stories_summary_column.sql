-- Embeddings + match_stories_for_user reference rs.summary; base schema.sql omitted it.
alter table public.raw_stories
  add column if not exists summary text;
