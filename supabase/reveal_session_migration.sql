-- Run once in Supabase SQL Editor before deploying the key reveal feature.
alter table public.link_sessions
add column if not exists revealed_at timestamptz;

create index if not exists link_sessions_reveal_lookup_idx
on public.link_sessions (id, app_id);
