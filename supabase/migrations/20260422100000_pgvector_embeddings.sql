-- Step 3A: pgvector embeddings + vector similarity RPC
-- Applied 2026-04-22 via Supabase SQL editor

-- Enable pgvector extension (no-op if already enabled)
create extension if not exists vector with schema extensions;

-- Add embedding column to raw_stories (1536-dim for text-embedding-3-small)
alter table public.raw_stories
  add column if not exists embedding extensions.vector(1536);

-- Add profile embedding to user_profiles
alter table public.user_profiles
  add column if not exists profile_embedding extensions.vector(1536);

-- IVFFlat index for approximate nearest-neighbour search
-- lists=100 is a sensible default for up to ~1M rows
create index if not exists idx_raw_stories_embedding
  on public.raw_stories
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_user_profiles_profile_embedding
  on public.user_profiles
  using ivfflat (profile_embedding extensions.vector_cosine_ops)
  with (lists = 10);

-- RPC: return up to p_match_count unscored raw stories closest to a user's profile embedding
-- NOTE: search_path must include 'extensions' for the <=> cosine distance operator to be visible.
-- Supabase creates pgvector in the 'extensions' schema by default, and the operator is not
-- accessible from 'public' alone.
create or replace function public.match_stories_for_user(
  p_user_id   uuid,
  p_embedding extensions.vector(1536),
  p_match_count int default 150
)
returns table (
  id          uuid,
  url         text,
  title       text,
  summary     text,
  source      text,
  raw_text    text,
  scraped_at  timestamptz,
  published_at timestamptz,
  similarity  float
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select
    rs.id,
    rs.url,
    rs.title,
    rs.summary,
    rs.source,
    rs.raw_text,
    rs.scraped_at,
    rs.published_at,
    1 - (rs.embedding <=> p_embedding) as similarity
  from public.raw_stories rs
  where rs.embedding is not null
    and not exists (
      select 1 from public.user_raw_scored urs
      where urs.raw_story_id = rs.id
        and urs.user_id = p_user_id
    )
  order by rs.embedding <=> p_embedding
  limit p_match_count;
end;
$$;

-- Lock down RPC access
revoke all on function public.match_stories_for_user(uuid, extensions.vector, int) from public;
grant execute on function public.match_stories_for_user(uuid, extensions.vector, int) to service_role;
