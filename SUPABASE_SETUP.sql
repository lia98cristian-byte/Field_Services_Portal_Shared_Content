-- Run this once in Supabase > SQL Editor.
-- This table stores LINKS ONLY. Photos/videos/files remain wherever their URLs point.

create extension if not exists pgcrypto;

create table if not exists public.portal_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('file','photo','video')),
  title text not null check (char_length(title) between 1 and 100),
  url text not null check (url ~* '^https?://'),
  description text not null default '' check (char_length(description) <= 300),
  created_at timestamptz not null default now()
);

alter table public.portal_content enable row level security;

-- Everyone visiting the portal may read the shared list.
drop policy if exists "portal content public read" on public.portal_content;
create policy "portal content public read"
on public.portal_content for select
to anon, authenticated
using (true);

-- Everyone visiting the portal may add links.
drop policy if exists "portal content public add" on public.portal_content;
create policy "portal content public add"
on public.portal_content for insert
to anon, authenticated
with check (
  kind in ('file','photo','video')
  and char_length(title) between 1 and 100
  and char_length(description) <= 300
  and url ~* '^https?://'
);

-- Everyone visiting the portal may remove links from the portal.
-- This does NOT delete the original SharePoint/video/photo/file.
drop policy if exists "portal content public remove" on public.portal_content;
create policy "portal content public remove"
on public.portal_content for delete
to anon, authenticated
using (true);
