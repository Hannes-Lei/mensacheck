-- ============================================================================
-- 14: Melden + Moderation (Meldungen, Kommentare entfernen, Konten sperren)
-- Kann gefahrlos auch ein zweites Mal ausgeführt werden.
-- ============================================================================

-- 1) MELDUNGEN ---------------------------------------------------------------
-- Gemeldet wird entweder ein Kommentar (rating_id) oder eine Antwort (reply_id).
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  rating_id   bigint references public.ratings (id) on delete cascade,
  reply_id    bigint references public.replies (id) on delete cascade,
  reporter    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason      text not null check (reason in ('beleidigend', 'spam', 'falsch', 'sonstiges')),
  note        text check (note is null or char_length(note) <= 300),
  status      text not null default 'open' check (status in ('open', 'done')),
  created_at  timestamptz not null default now(),
  check ((rating_id is null) <> (reply_id is null))
);
-- jede Person kann denselben Inhalt nur einmal melden
create unique index if not exists reports_once
  on public.reports (reporter, coalesce(rating_id, 0), coalesce(reply_id, 0));

alter table public.reports enable row level security;
-- Melden darf jeder Angemeldete, lesen kann die Tabelle niemand über die App
-- (Moderatoren sehen Meldungen nur über die Funktion mod_reports).
drop policy if exists "Selbst melden" on public.reports;
create policy "Selbst melden" on public.reports
  for insert to authenticated with check (reporter = auth.uid());


-- 2) GESPERRTE KONTEN --------------------------------------------------------
-- Gesperrte können weiter lesen, aber nichts mehr bewerten, kommentieren oder antworten.
create table if not exists public.banned_users (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  banned_at  timestamptz not null default now()
);
alter table public.banned_users enable row level security;  -- über die App unsichtbar

create or replace function public.block_banned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.banned_users where user_id = new.user_id) then
    raise exception 'Dein Konto ist gesperrt. Bei Fragen melde dich beim Betreiber.';
  end if;
  return new;
end;
$$;

drop trigger if exists ratings_block_banned on public.ratings;
create trigger ratings_block_banned before insert on public.ratings
  for each row execute function public.block_banned();
drop trigger if exists ratings_block_banned_upd on public.ratings;
create trigger ratings_block_banned_upd before update of comment, stars on public.ratings
  for each row when (new.comment is distinct from old.comment and new.comment is not null or new.stars is distinct from old.stars)
  execute function public.block_banned();
drop trigger if exists replies_block_banned on public.replies;
create trigger replies_block_banned before insert on public.replies
  for each row execute function public.block_banned();


-- 3) FUNKTIONEN FÜR MODERATOREN ---------------------------------------------
-- Offene Meldungen, je Inhalt zusammengefasst
create or replace function public.mod_reports()
returns table (
  rating_id   bigint,
  reply_id    bigint,
  content     text,
  author_id   uuid,
  author      text,
  meal_name   text,
  canteen_id  integer,
  meal_date   date,
  reports     bigint,
  reasons     text,
  notes       text,
  last_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für Moderatoren.'; end if;
  return query
    select o.rating_id, o.reply_id,
           coalesce(rp.body, ra.comment),
           coalesce(rp.user_id, ra.user_id),
           pr.username,
           base.meal_name, base.canteen_id, base.meal_date,
           count(*),
           string_agg(distinct o.reason, ', '),
           string_agg(o.note, ' | ') filter (where o.note is not null),
           max(o.created_at)
    from public.reports o
    left join public.replies rp on rp.id = o.reply_id
    left join public.ratings ra on ra.id = o.rating_id
    join public.ratings base on base.id = coalesce(o.rating_id, rp.rating_id)
    join public.profiles pr on pr.id = coalesce(rp.user_id, ra.user_id)
    where o.status = 'open'
    group by o.rating_id, o.reply_id, rp.body, ra.comment, rp.user_id, ra.user_id, pr.username,
             base.meal_name, base.canteen_id, base.meal_date
    order by max(o.created_at) desc;
end;
$$;

-- Meldung erledigen: Inhalt entfernen (p_remove = true) oder Meldung ignorieren.
-- Bei Kommentaren bleibt die Sternebewertung, nur der Text verschwindet.
-- Geht auch ohne Meldung (Ansicht "Neueste Kommentare").
create or replace function public.mod_resolve(p_rating bigint, p_reply bigint, p_remove boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für Moderatoren.'; end if;
  if p_remove then
    if p_reply is not null then
      delete from public.replies where id = p_reply;
    elsif p_rating is not null then
      update public.ratings set comment = null where id = p_rating;
    end if;
  end if;
  update public.reports set status = 'done'
   where (p_rating is not null and rating_id = p_rating)
      or (p_reply is not null and reply_id = p_reply);
end;
$$;

-- Die neuesten Kommentare und Antworten aller Nutzer (zum Durchschauen)
create or replace function public.mod_recent_comments(p_limit integer default 60)
returns table (
  rating_id   bigint,
  reply_id    bigint,
  content     text,
  author_id   uuid,
  author      text,
  meal_name   text,
  canteen_id  integer,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für Moderatoren.'; end if;
  return query
    select * from (
      select r.id, null::bigint, r.comment, r.user_id, p.username, r.meal_name, r.canteen_id, r.created_at
        from public.ratings r join public.profiles p on p.id = r.user_id
       where r.comment is not null and trim(r.comment) <> ''
      union all
      select rp.rating_id, rp.id, rp.body, rp.user_id, p.username, r.meal_name, r.canteen_id, rp.created_at
        from public.replies rp
        join public.ratings r on r.id = rp.rating_id
        join public.profiles p on p.id = rp.user_id
    ) x
    order by 8 desc
    limit least(greatest(p_limit, 1), 200);
end;
$$;

-- Konto sperren / entsperren
create or replace function public.mod_set_ban(p_user uuid, p_ban boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für Moderatoren.'; end if;
  if p_user = auth.uid() then raise exception 'Dich selbst kannst du nicht sperren.'; end if;
  if p_ban then
    insert into public.banned_users (user_id) values (p_user) on conflict do nothing;
  else
    delete from public.banned_users where user_id = p_user;
  end if;
end;
$$;

-- Wer ist gesperrt? (für die Nutzerliste)
create or replace function public.mod_banned()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then raise exception 'Nur für Moderatoren.'; end if;
  return query select user_id from public.banned_users;
end;
$$;

revoke execute on function public.mod_reports() from public, anon;
revoke execute on function public.mod_resolve(bigint, bigint, boolean) from public, anon;
revoke execute on function public.mod_recent_comments(integer) from public, anon;
revoke execute on function public.mod_set_ban(uuid, boolean) from public, anon;
revoke execute on function public.mod_banned() from public, anon;
grant execute on function public.mod_reports() to authenticated;
grant execute on function public.mod_resolve(bigint, bigint, boolean) to authenticated;
grant execute on function public.mod_recent_comments(integer) to authenticated;
grant execute on function public.mod_set_ban(uuid, boolean) to authenticated;
grant execute on function public.mod_banned() to authenticated;
