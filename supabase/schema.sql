-- Strata database. Paste this whole file into Supabase > SQL Editor > New query, then Run.
-- Every table is locked with row level security: a signed-in person can only ever see
-- and change their own rows. Nobody who isn't signed in can read anything.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  state text not null default 'ongoing' check (state in ('ongoing', 'resting')),
  created_at timestamptz not null default now(),
  discarded_at timestamptz,
  released_ids uuid[] not null default '{}'
);

create table if not exists public.thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 100000),
  kind text not null default 'card' check (kind in ('card', 'page')),
  topics text[] not null default '{}' check (cardinality(topics) <= 20),
  finished boolean not null default true,
  kept boolean not null default false,
  thread_id uuid references public.threads (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  discarded_at timestamptz,
  version_count integer not null default 0,
  search_text text not null default ''
);

create table if not exists public.thought_versions (
  id uuid primary key default gen_random_uuid(),
  thought_id uuid not null references public.thoughts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists thoughts_user_created on public.thoughts (user_id, created_at desc);
create index if not exists thoughts_thread on public.thoughts (thread_id);
create index if not exists threads_user on public.threads (user_id);
create index if not exists versions_thought on public.thought_versions (thought_id);

-- ---------- keep things consistent ----------
create or replace function public.thoughts_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
    new.version_count := 0;
  else
    new.user_id := old.user_id;       -- a row can never change owner
    new.created_at := old.created_at;
    new.version_count := old.version_count;
    -- keep the earlier wording when a finished thought is edited
    if new.body is distinct from old.body and old.finished then
      insert into public.thought_versions (thought_id, user_id, body, created_at)
      values (old.id, old.user_id, old.body, old.updated_at);
      new.version_count := old.version_count + 1;
    end if;
  end if;
  -- a thought can only join one of its owner's own threads
  if new.thread_id is not null and not exists (
    select 1 from public.threads t where t.id = new.thread_id and t.user_id = new.user_id
  ) then
    raise exception 'That thread does not exist';
  end if;
  new.updated_at := now();
  new.search_text := lower(new.body || ' ' || array_to_string(new.topics, ' '));
  return new;
end $$;

drop trigger if exists thoughts_before_write on public.thoughts;
create trigger thoughts_before_write before insert or update on public.thoughts
for each row execute function public.thoughts_before_write();

create or replace function public.threads_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists threads_before_write on public.threads;
create trigger threads_before_write before insert or update on public.threads
for each row execute function public.threads_before_write();

-- ---------- row level security: only your own rows ----------
alter table public.threads enable row level security;
alter table public.thoughts enable row level security;
alter table public.thought_versions enable row level security;

drop policy if exists "own threads" on public.threads;
create policy "own threads" on public.threads for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own thoughts" on public.thoughts;
create policy "own thoughts" on public.thoughts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- versions are written only by the trigger above; you can read and delete your own
drop policy if exists "read own versions" on public.thought_versions;
create policy "read own versions" on public.thought_versions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "delete own versions" on public.thought_versions;
create policy "delete own versions" on public.thought_versions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.threads, public.thoughts, public.thought_versions from anon;
grant select, insert, update, delete on public.threads, public.thoughts to authenticated;
grant select, delete on public.thought_versions to authenticated;

-- ---------- Discarded ----------
create or replace view public.discarded_threads with (security_invoker = true) as
  select t.*, cardinality(t.released_ids) + (
    select count(*) from public.thoughts x where x.thread_id = t.id and x.discarded_at = t.discarded_at
  )::int as count
  from public.threads t where t.discarded_at is not null;

create or replace view public.discarded_thoughts with (security_invoker = true) as
  select x.* from public.thoughts x
  where x.discarded_at is not null and not exists (
    select 1 from public.threads t where t.id = x.thread_id and t.discarded_at = x.discarded_at
  );

revoke all on public.discarded_threads, public.discarded_thoughts from anon;
grant select on public.discarded_threads, public.discarded_thoughts to authenticated;

-- These run as the signed-in person, so row level security still applies to every step.
create or replace function public.restore_thoughts(ids uuid[]) returns void
language sql security invoker set search_path = public as $$
  update thoughts x set discarded_at = null,
    thread_id = case when exists (select 1 from threads t where t.id = x.thread_id and t.discarded_at is not null) then null else x.thread_id end
  where x.id = any(ids) and x.discarded_at is not null;
$$;

create or replace function public.discard_thread(thread uuid, keep_thoughts boolean) returns void
language plpgsql security invoker set search_path = public as $$
declare at timestamptz := now();
begin
  if keep_thoughts then
    update threads set discarded_at = at,
      released_ids = coalesce((select array_agg(id) from thoughts where thread_id = thread and discarded_at is null), '{}')
    where id = thread;
    update thoughts set thread_id = null where thread_id = thread and discarded_at is null;
  else
    update threads set discarded_at = at, released_ids = '{}' where id = thread;
    update thoughts set discarded_at = at where thread_id = thread and discarded_at is null;
  end if;
end $$;

create or replace function public.restore_threads(ids uuid[]) returns void
language plpgsql security invoker set search_path = public as $$
declare t record;
begin
  for t in select * from threads where id = any(ids) and discarded_at is not null loop
    update thoughts set discarded_at = null where thread_id = t.id and discarded_at = t.discarded_at;
    update thoughts set thread_id = t.id where id = any(t.released_ids) and thread_id is null;
    update threads set discarded_at = null, released_ids = '{}' where id = t.id;
  end loop;
end $$;

create or replace function public.delete_threads_forever(ids uuid[]) returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from thoughts x using threads t
    where t.id = any(ids) and x.thread_id = t.id and x.discarded_at = t.discarded_at;
  delete from threads where id = any(ids) and discarded_at is not null;
end $$;

create or replace function public.purge_discarded() returns void
language plpgsql security invoker set search_path = public as $$
declare cutoff timestamptz := now() - interval '30 days';
begin
  perform delete_threads_forever(coalesce((select array_agg(id) from threads where discarded_at < cutoff), '{}'));
  delete from thoughts where discarded_at < cutoff;
end $$;

revoke execute on function public.restore_thoughts(uuid[]), public.discard_thread(uuid, boolean),
  public.restore_threads(uuid[]), public.delete_threads_forever(uuid[]), public.purge_discarded() from anon, public;
grant execute on function public.restore_thoughts(uuid[]), public.discard_thread(uuid, boolean),
  public.restore_threads(uuid[]), public.delete_threads_forever(uuid[]), public.purge_discarded() to authenticated;

-- =====================================================================
-- Stage 2: interests (films, books, music, articles), collections, Inbox links.
-- Safe to run again on a database that already has stage 1.
-- =====================================================================

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('film', 'book', 'music', 'article')),
  title text not null check (char_length(title) between 1 and 500),
  creator text not null default '' check (char_length(creator) <= 500),
  year integer check (year between 1000 and 3000),
  image_url text check (image_url is null or image_url ~ '^https://'),
  image_checked boolean not null default false,
  source text not null default 'manual' check (char_length(source) <= 40),
  source_id text check (char_length(source_id) <= 500),
  status text not null default 'want' check (status in ('want', 'done')),
  rating smallint check (rating between 1 and 5),
  moods text[] not null default '{}' check (cardinality(moods) <= 20),
  favourite boolean not null default false,
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  nudged_at timestamptz
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  interest_id uuid references public.interests (id) on delete cascade,
  thought_id uuid references public.thoughts (id) on delete cascade,
  added_at timestamptz not null default now(),
  check ((interest_id is null) <> (thought_id is null))
);

create table if not exists public.saved_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null check (url ~ '^https?://' and char_length(url) <= 4000),
  title text not null default '' check (char_length(title) <= 500),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

-- a thought can be pinned to one item; "source" marks thoughts that came in with an import
alter table public.thoughts add column if not exists interest_id uuid references public.interests (id) on delete set null;
alter table public.thoughts add column if not exists source text check (source in ('letterboxd', 'goodreads'));

create index if not exists interests_user on public.interests (user_id, created_at desc);
create index if not exists thoughts_interest on public.thoughts (interest_id);
create index if not exists collections_user on public.collections (user_id);
create index if not exists collection_items_collection on public.collection_items (collection_id);
create index if not exists collection_items_interest on public.collection_items (interest_id);
create index if not exists collection_items_thought on public.collection_items (thought_id);
create unique index if not exists collection_items_once on public.collection_items (collection_id, coalesce(interest_id, thought_id));
create index if not exists saved_links_user on public.saved_links (user_id, created_at desc);

-- thoughts: same rules as before, plus pinning and imported dates
create or replace function public.thoughts_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.version_count := 0;
    -- imported reviews keep the day they were written (never a future date); everything else is "now"
    if new.source is null or new.created_at is null then
      new.created_at := now();
    else
      new.created_at := least(new.created_at, now());
    end if;
  else
    new.user_id := old.user_id;       -- a row can never change owner
    new.created_at := old.created_at;
    new.version_count := old.version_count;
    new.source := old.source;
    -- keep the earlier wording when a finished thought is edited
    if new.body is distinct from old.body and old.finished then
      insert into public.thought_versions (thought_id, user_id, body, created_at)
      values (old.id, old.user_id, old.body, old.updated_at);
      new.version_count := old.version_count + 1;
    end if;
  end if;
  -- a thought can only join one of its owner's own threads
  if new.thread_id is not null and not exists (
    select 1 from public.threads t where t.id = new.thread_id and t.user_id = new.user_id
  ) then
    raise exception 'That thread does not exist';
  end if;
  -- and only be pinned to its owner's own items
  if new.interest_id is not null and not exists (
    select 1 from public.interests i where i.id = new.interest_id and i.user_id = new.user_id
  ) then
    raise exception 'That item does not exist';
  end if;
  new.updated_at := case when new.source is not null and tg_op = 'INSERT' then new.created_at else now() end;
  new.search_text := lower(new.body || ' ' || array_to_string(new.topics, ' '));
  return new;
end $$;

-- owner and creation time are always set by the database, never by the app
create or replace function public.owned_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
  else
    new.user_id := old.user_id;
  end if;
  return new;
end $$;

create or replace function public.interests_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    -- imported items keep the day they were added there (never a future date)
    new.created_at := least(coalesce(new.created_at, now()), now());
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.collections_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.created_at := now();
  else
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- an item on a collection's shelf must belong to the same person as the collection
create or replace function public.collection_items_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.added_at := now();
  if not exists (select 1 from collections c where c.id = new.collection_id and c.user_id = new.user_id)
    or (new.interest_id is not null and not exists (select 1 from interests i where i.id = new.interest_id and i.user_id = new.user_id))
    or (new.thought_id is not null and not exists (select 1 from thoughts t where t.id = new.thought_id and t.user_id = new.user_id)) then
    raise exception 'That collection or item does not exist';
  end if;
  update collections set updated_at = now() where id = new.collection_id;
  return new;
end $$;

drop trigger if exists interests_before_write on public.interests;
create trigger interests_before_write before insert or update on public.interests
for each row execute function public.interests_before_write();
drop trigger if exists collections_before_write on public.collections;
create trigger collections_before_write before insert or update on public.collections
for each row execute function public.collections_before_write();
drop trigger if exists collection_items_before_write on public.collection_items;
create trigger collection_items_before_write before insert or update on public.collection_items
for each row execute function public.collection_items_before_write();
drop trigger if exists saved_links_before_write on public.saved_links;
create trigger saved_links_before_write before insert or update on public.saved_links
for each row execute function public.owned_before_write();

alter table public.interests enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.saved_links enable row level security;

drop policy if exists "own interests" on public.interests;
create policy "own interests" on public.interests for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own collections" on public.collections;
create policy "own collections" on public.collections for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own collection items" on public.collection_items;
create policy "own collection items" on public.collection_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own saved links" on public.saved_links;
create policy "own saved links" on public.saved_links for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.interests, public.collections, public.collection_items, public.saved_links from anon;
grant select, insert, update, delete on public.interests, public.collections, public.collection_items, public.saved_links to authenticated;

-- deleting an item keeps its thoughts (they are just unpinned, by "on delete set null")

-- genres on interests (added after stage 2 went live)
alter table public.interests add column if not exists genres text[] not null default '{}' check (cardinality(genres) <= 20);

-- "Delete my account" on the Profile page. Removes the signed-in person and,
-- through "on delete cascade", every thought, thread, interest and collection they own.
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- the revised structure (threads under a thought, collections as boards, imports) ----------
-- threads grow from one thought, and can say what they follow
alter table public.threads add column if not exists root_id uuid references public.thoughts (id) on delete set null;
alter table public.threads add column if not exists note text not null default '' check (char_length(note) <= 2000);

-- a thought shown inside another thought's thread: a link, never a copy
create table if not exists public.thread_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  thought_id uuid not null references public.thoughts (id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (thread_id, thought_id)
);
create index if not exists thread_links_thought on public.thread_links (thought_id);
alter table public.thread_links enable row level security;
drop policy if exists "own thread links" on public.thread_links;
create policy "own thread links" on public.thread_links for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- collections hold saved things only, have a cover, and remember where things sit on the board
delete from public.collection_items where thought_id is not null;
alter table public.collections add column if not exists cover_id uuid references public.interests (id) on delete set null;
alter table public.collections add column if not exists decor jsonb not null default '[]' check (jsonb_typeof(decor) = 'array' and jsonb_array_length(decor) <= 200);
alter table public.collection_items add column if not exists x real;
alter table public.collection_items add column if not exists y real;
alter table public.collection_items add column if not exists r real;
alter table public.collection_items add column if not exists z integer;

-- each import is one line in Inbox until it is sorted
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('letterboxd', 'goodreads')),
  count integer not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.imports enable row level security;
drop policy if exists "own imports" on public.imports;
create policy "own imports" on public.imports for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.interests add column if not exists import_id uuid references public.imports (id) on delete set null;

revoke all on public.thread_links, public.imports from anon;
grant select, insert, update, delete on public.thread_links, public.imports to authenticated;

-- threads can carry your own labels; a linked thought can hang under one thought in the thread;
-- words in a thought can point at a collection or a saved thing
alter table public.threads add column if not exists labels text[] not null default '{}' check (cardinality(labels) <= 20);
alter table public.thread_links add column if not exists under_id uuid references public.thoughts (id) on delete set null;
alter table public.thoughts add column if not exists word_links jsonb not null default '[]' check (jsonb_typeof(word_links) = 'array' and jsonb_array_length(word_links) <= 200);
