# People table and source on /admin, plus the "How did you find LiftCamp?" card

Same branch and worktree as docs/funnel-admin-spec.md (`admin-funnel`,
`~/code/liftcamp-admin-funnel`). Build that spec first, then this one.
Branch, commit, push. No merging, no Metro, no Simulator runs, no SQL:
Alan runs `docs/funnel-people.sql` in the Supabase SQL editor before this
ships, so `user_sources`, `admin_set_source()` and `admin_people()` exist.

Mobile changes are JS only (OTA). Web ships on the next Vercel deploy.

## Why

The admin's Per account table hides guests (10 of the 15 people who signed
up since launch), counts every seeded set row as a logged set (a routine
day starts with 15 to 20 rows before anyone ticks one, so a user who never
logged shows "15 sets"), reads Last seen from those seeded rows, and says
nothing about where a person came from. The funnel section from the other
spec gives the aggregate; this gives the per-person view: how far each
person got, and the source so a Reddit commenter and an unknown fastmail
sign-up stop looking identical.

## Data model (already created by docs/funnel-people.sql; do not write SQL)

- `public.user_sources(user_id, source, detail, set_by, created_at,
  updated_at)`. One row per user. The app may insert its own row once
  (RLS: `user_id = auth.uid()`, `set_by = 'user'`, source one of the seven
  app values). No select, update or delete for users.
- `public.admin_set_source(p_user_id uuid, p_source text, p_detail text)`
  returns void. Upserts an admin row (`set_by = 'admin'`); `p_source null`
  deletes the row.
- `public.admin_people(_since timestamptz default null)` returns rows of
  `user_id, email, kind, is_team, joined_at, source, source_detail,
  source_set_by, stage, routines, workouts, finished, sets_done,
  last_seen, platform, app_version`. `kind` is `guest`, `email`, `apple`
  or `google`. `stage` is 0 to 5 (ladder below). `_since null` returns
  everyone.

Add `user_sources` (table) and the two functions to
`packages/shared/src/database.types.ts` by hand, matching the SQL.

### Stage ladder

| stage | key      | label             | from                         |
|-------|----------|-------------------|------------------------------|
| 0     | started  | Got started       | auth user exists             |
| 1     | routine  | Picked a routine  | a `templates` row            |
| 2     | workout  | Started a workout | a `workouts` row             |
| 3     | set      | Logged a set      | a `sets` row with completed  |
| 4     | finished | Finished a workout| `workouts.finished_at`       |
| 5     | second   | Second workout    | two finished workouts        |

## Shared

### `packages/shared/src/user-sources.ts` (new)

```ts
/** Offered in the app, in this order. */
export const USER_SOURCES = [
  { key: 'app_store', label: 'App Store' },
  { key: 'reddit', label: 'Reddit' },
  { key: 'friend', label: 'A friend' },
  { key: 'web', label: 'Google or the website' },
  { key: 'chatbot', label: 'ChatGPT or Claude' },
  { key: 'social', label: 'Instagram or TikTok' },
  { key: 'other', label: 'Somewhere else' },
] as const;

/** Admin only, on top of USER_SOURCES. */
export const ADMIN_SOURCES = [
  { key: 'app_review', label: 'App Review' },
  { key: 'tester', label: 'Tester' },
  { key: 'flier', label: 'Gym flier' },
  { key: 'trainer', label: 'Trainer' },
  { key: 'unknown', label: 'Unknown' },
] as const;

export type UserSourceKey = (typeof USER_SOURCES)[number]['key'];
export type SourceKey = UserSourceKey | (typeof ADMIN_SOURCES)[number]['key'];

export const STAGES = [
  { stage: 0, key: 'started', label: 'Got started' },
  { stage: 1, key: 'routine', label: 'Picked a routine' },
  { stage: 2, key: 'workout', label: 'Started a workout' },
  { stage: 3, key: 'set', label: 'Logged a set' },
  { stage: 4, key: 'finished', label: 'Finished a workout' },
  { stage: 5, key: 'second', label: 'Second workout' },
] as const;

export function sourceLabel(key: string | null): string | null;
```

Export from the package index like the other modules.

## Mobile

### 1. `apps/mobile/src/data/source.ts` (new)

- Local flag per user in AsyncStorage: `liftcamp:source:${userId}` with
  value `answered` or `dismissed`. The `liftcamp:` prefix is on purpose:
  dev Start fresh clears it, so a fresh dev user sees the card again.
- `shouldAskSource(userId)`: true when no flag. Not gated on `__DEV__`
  (Alan checks the card in the Simulator; dev users are tagged team on
  /admin and left out of the funnel anyway).
- `saveSource(userId, key: UserSourceKey)`: `supabase.from('user_sources')
  .upsert({ user_id: userId, source: key, set_by: 'user' }, { onConflict:
  'user_id', ignoreDuplicates: true })`. On success write the `answered`
  flag. On error (offline, RLS) write nothing, so the card asks again next
  launch; never show an error to the user. The write queue is for workout
  data; do not route this through it.
- `dismissSource(userId)`: writes `dismissed`.

### 2. `apps/mobile/src/components/home/source-card.tsx` (new)

Modelled on `whats-new-card.tsx` (`WhatsNewSlot`): same hold rules, same
exit animation, no haptic.

- Home renders `SourceSlot` keyed by the user right after `WhatsNewSlot`.
- Shows when `shouldAskSource` is true and neither hold applies: not while
  a workout is in progress, not on a launch the week card celebrates, and
  not on a launch where the What's new card is shown (one card per
  launch; the source card waits for the next one).
- Card: title "How did you find LiftCamp?", one muted line "One tap helps
  a small app find more beginners." No colons, no em dashes.
- Below it the seven `USER_SOURCES` as wrapping chips (outline, 36 pt
  tall, 12 pt radius, `type.body`). Tapping a chip saves it, fills the
  chip with accent for about 400 ms, then the card fades out and Home
  slides up, like What's new. No Save button.
- A 44 pt X target top right dismisses (writes `dismissed`, same exit).
- Guests see it too (an anonymous session carries the `authenticated`
  role, so the insert passes RLS).

## Web

### 3. Replace the Per account section with People

In `apps/web/src/routes/admin.tsx`, replace the Per account section and
its `admin_users` / `admin_guest_count` queries. Keep the Pro access and
Delete user sections as they are (they take an email).

Query: `supabase.rpc('admin_people', { _since })`.

Controls above the table:

- Range toggle: "Since launch" (default, the launch constant the funnel
  section uses, 2026-10-13) / "All time" (`_since: null`).
- "Show team" checkbox, default off. Hidden rows are `is_team`. A muted
  line under the table says "N team rows hidden" when off.

Stage strip, one line above the table: six chips, each "label · count",
where count is the number of visible rows at or beyond that stage
(cumulative, so it reads as a funnel and matches the toggles). Example
today: "Got started 15 · Picked a routine 11 · Started a workout 7 ·
Logged a set 1 · Finished a workout 0 · Second workout 0".

Table columns, sortable with `SortableHeader` like today:

- Who: email, or for guests "Guest" plus the first 8 characters of
  `user_id` muted. A small kind chip after it: Guest, Email, Apple,
  Google. `privaterelay.appleid.com` addresses keep the address and get
  the Apple chip.
- Source: a chip with `sourceLabel(source)`; `source_detail` in the title
  tooltip, prefixed "said: " when `source_set_by === 'user'` and "tagged: "
  when admin. Empty shows a muted "Set source" button. Clicking the chip
  or the button opens an inline editor in the cell: a select listing
  USER_SOURCES then ADMIN_SOURCES, a detail text input (placeholder
  "note, optional", max 200), Save and Cancel, and a Clear link that
  calls `admin_set_source` with `p_source: null`. Save calls
  `admin_set_source({ p_user_id, p_source, p_detail })` and refetches.
- Joined: `fmtDate`.
- Stage: chip with the stage label. Stages 0 and 1 muted, 2 and 3 default
  foreground, 4 and 5 the accent treatment the page already uses for
  positive states.
- Workouts, Sets done, Finished: right-aligned tabular numbers.
- Last seen: `relativeTime(last_seen)`, full timestamp in the title.
- App: `platform` and `app_version` muted ("ios 1.1.0 (18)"), blank when
  the person has no workout.

Default sort is joined descending. The table keeps `min-w` and horizontal
scroll like today; it gets wider, so drop the `max-w` cap if one bites.

## Out of scope

- No source attribution from install_events or page_views; iOS gives no
  install referrer, so the tap and the admin tag are the sources.
- No per-person event timeline. The stage chip plus the counts cover
  "how far did they get" for now.
- `admin_users` and `admin_guest_count` stay in the database (no SQL);
  the page just stops calling them.

## Checks before pushing

- `pnpm -C apps/web build` passes.
- `pnpm -C packages/shared test` passes.
- TypeScript compiles across the monorepo with the hand-added
  `database.types.ts` entries.
