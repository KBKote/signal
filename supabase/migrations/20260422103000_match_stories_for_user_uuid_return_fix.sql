-- Older applied copies of 20260422100000 declared `id bigint` while raw_stories.id is uuid.
-- Replace the function so return types match (required for PostgREST / Supabase RPC).

drop function if exists public.match_stories_for_user(uuid, extensions.vector, int);
drop function if exists public.match_stories_for_user(uuid, extensions.vector(1536), int);

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

revoke all on function public.match_stories_for_user(uuid, extensions.vector, int) from public;
grant execute on function public.match_stories_for_user(uuid, extensions.vector, int) to service_role;
