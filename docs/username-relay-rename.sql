-- LiftCamp: rename usernames that come from an Apple private relay address
-- Run in SUPABASE (SQL editor). For review; not yet run.
--
-- HOLD: do not run until build 13 is approved in App Review (CLAUDE.md,
-- Review status).
--
-- Idempotent: it touches only rows whose username is still relay-based, and
-- every new name is checked not to be, so a second run changes nothing.
--
-- The rules are the app's (packages/shared/src/username.ts):
--   - An account's emails: auth.users.email and each identity's email.
--   - A relay address ends in @privaterelay.appleid.com. Its stem is the
--     local part lowercased, stripped to a-z, 0-9 and underscore, at most
--     20 (how an email prefix became a username before 25 Sep 2026).
--     Stems under 6 characters are ignored.
--   - A username is relay-based when it contains a stem, or when it minus
--     its trailing digits (6 or more characters) is the start of a stem.
--   - The new name comes from the account's name: full_name, else name,
--     else given_name and family_name. Lowercased, ß æ œ þ spelled out,
--     accents mapped with the same table as ACCENTS_FROM / ACCENTS_TO (a
--     test in shared holds the two copies equal), everything but a-z and
--     0-9 removed, leading digits dropped, at most 20.
--   - Tried in order: the stem alone (3 or more), then with 2, 3, 4 ... up
--     to 999, cut so the whole fits in 20. The app tries random digits
--     after 3 because it cannot read other users' rows; here the first free
--     number is found. With no name, or nothing free: lifter plus 5 random
--     digits.
--   - Every candidate must match ^[a-z][a-z0-9_]{2,19}$, be free
--     case-insensitively, and not be relay-based itself.


-- Section 0: diagnostic. Read the output before running Section 1.
-- One row per username Section 1 would rename, with the name it would
-- start from. Zero rows means Section 1 changes nothing.

with emails as (
  select u.id as user_id, lower(trim(u.email)) as email
  from auth.users u
  where u.email is not null
  union
  select i.user_id, lower(trim(i.identity_data->>'email'))
  from auth.identities i
  where i.identity_data->>'email' is not null
),
stems as (
  select user_id,
         left(regexp_replace(split_part(email, '@', 1), '[^a-z0-9_]', '', 'g'), 20) as stem
  from emails
  where email like '%@privaterelay.appleid.com'
)
select p.user_id,
       p.username as current_username,
       s.stem as relay_stem,
       coalesce(
         nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
         nullif(trim(u.raw_user_meta_data->>'name'), ''),
         nullif(trim(concat_ws(' ',
           nullif(trim(u.raw_user_meta_data->>'given_name'), ''),
           nullif(trim(u.raw_user_meta_data->>'family_name'), ''))), '')
       ) as account_name
from public.user_profiles p
join auth.users u on u.id = p.user_id
join stems s on s.user_id = p.user_id
where p.username is not null
  and length(s.stem) >= 6
  and (
    position(s.stem in lower(p.username)) > 0
    or (
      length(regexp_replace(lower(p.username), '[0-9]+$', '')) >= 6
      and left(s.stem, length(regexp_replace(lower(p.username), '[0-9]+$', '')))
          = regexp_replace(lower(p.username), '[0-9]+$', '')
    )
  )
order by p.user_id;


-- Section 1: the rename. One DO block; it raises a notice per rename and
-- a total at the end.

do $$
declare
  r record;
  v_stems text[];
  v_name text;
  v_base text;
  v_candidate text;
  v_suffix text;
  v_core text;
  v_found boolean;
  v_renamed int := 0;
  n int;
begin
  for r in
    select p.user_id, p.username, u.raw_user_meta_data as meta
    from public.user_profiles p
    join auth.users u on u.id = p.user_id
    where p.username is not null
    order by p.user_id
  loop
    -- The account's relay stems, 6 characters or more.
    select coalesce(array_agg(distinct stem), '{}') into v_stems
    from (
      select left(regexp_replace(split_part(e, '@', 1), '[^a-z0-9_]', '', 'g'), 20) as stem
      from (
        select lower(trim(u.email)) as e from auth.users u where u.id = r.user_id
        union
        select lower(trim(i.identity_data->>'email')) from auth.identities i where i.user_id = r.user_id
      ) x
      where e like '%@privaterelay.appleid.com'
    ) y
    where length(stem) >= 6;

    if cardinality(v_stems) = 0 then
      continue;
    end if;

    -- Is the current username relay-based?
    v_core := regexp_replace(lower(r.username), '[0-9]+$', '');
    select exists (
      select 1 from unnest(v_stems) st
      where position(st in lower(r.username)) > 0
         or (length(v_core) >= 6 and left(st, length(v_core)) = v_core)
    ) into v_found;
    if not v_found then
      continue;
    end if;

    -- The stem from the account's name.
    v_name := coalesce(
      nullif(trim(r.meta->>'full_name'), ''),
      nullif(trim(r.meta->>'name'), ''),
      nullif(trim(concat_ws(' ',
        nullif(trim(r.meta->>'given_name'), ''),
        nullif(trim(r.meta->>'family_name'), ''))), ''),
      ''
    );
    v_base := lower(v_name);
    v_base := replace(v_base, 'ß', 'ss');
    v_base := replace(v_base, 'æ', 'ae');
    v_base := replace(v_base, 'œ', 'oe');
    v_base := replace(v_base, 'þ', 'th');
    v_base := translate(v_base,
      'àáâãäåāăąçćčďèéêëēėęěìíîïīįñńňòóôõöøōőŕřśšşťùúûüūůűųýÿžźżđł',
      'aaaaaaaaacccdeeeeeeeeiiiiiinnnoooooooorrssstuuuuuuuuyyzzzdl');
    v_base := regexp_replace(v_base, '[^a-z0-9]', '', 'g');
    v_base := regexp_replace(v_base, '^[0-9]+', '');
    v_base := left(v_base, 20);

    v_candidate := null;
    if v_base <> '' then
      n := 1;
      while n <= 999 loop
        v_suffix := case when n = 1 then '' else n::text end;
        v_candidate := left(v_base, 20 - length(v_suffix)) || v_suffix;
        v_core := regexp_replace(v_candidate, '[0-9]+$', '');
        if v_candidate ~ '^[a-z][a-z0-9_]{2,19}$'
           and not exists (
             select 1 from public.user_profiles x
             where lower(x.username) = v_candidate and x.user_id <> r.user_id)
           and not exists (
             select 1 from unnest(v_stems) st
             where position(st in v_candidate) > 0
                or (length(v_core) >= 6 and left(st, length(v_core)) = v_core))
        then
          exit;
        end if;
        v_candidate := null;
        n := n + 1;
      end loop;
    end if;

    -- No name, or nothing free: lifter plus 5 random digits.
    while v_candidate is null loop
      v_candidate := 'lifter' || (10000 + floor(random() * 90000))::int::text;
      if exists (select 1 from public.user_profiles x where lower(x.username) = v_candidate) then
        v_candidate := null;
      end if;
    end loop;

    update public.user_profiles
    set username = v_candidate
    where user_id = r.user_id
      and username = r.username;

    v_renamed := v_renamed + 1;
    raise notice 'renamed %: % -> %', r.user_id, r.username, v_candidate;
  end loop;

  raise notice 'relay-based usernames renamed: %', v_renamed;
end $$;


-- Section 2: check. Run Section 0 again; it should return zero rows.
