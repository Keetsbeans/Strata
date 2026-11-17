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
