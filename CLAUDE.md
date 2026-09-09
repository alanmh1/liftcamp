# LiftCamp

Beginner-focused strength training app. Target user is someone in their first six
months of lifting. The differentiator is beginner framing: starting weight guidance,
form notes, equipment substitutions, and a public exercise library.

Solo project. Alan owns it. Roughly 12 users as of September 2026, so retention work
beats acquisition work in almost every case.

liftcamp.app

---

## Repo layout

```
apps/web        TanStack Start (SSR via Nitro) -> Vercel. The public site and the
                existing authed web app.
apps/mobile     Expo (SDK 57) -> iOS and Android. Phase 2.
packages/shared Types, Supabase client factory, business logic used by both.
```

pnpm workspaces. `.npmrc` must contain `node-linker=hoisted` for Expo to resolve
native modules correctly.

---

## Backend

Supabase, project ref `mnsigwjyskxfuszeegtp`, PostgreSQL 17.6, West US (Oregon),
org "LiftCamp". Migrated off Lovable Cloud on 4 Sep 2026.

Keys live in env vars only. Never commit them.

Direct DB connections are IPv6-only on the free tier and will fail to resolve. Use
the session pooler:

```
host: aws-0-us-west-2.pooler.supabase.com
port: 5432
user: postgres.mnsigwjyskxfuszeegtp
```

The Supabase SQL editor has more privilege than a pooler connection. When a
restore or a DDL statement fails on the `auth` or `storage` schema, run it in the
SQL editor instead.

### Schema facts that have cost real time

- `sets.weight` is `text NOT NULL DEFAULT ''`, not numeric. Empty means empty
  string, never NULL. `sets.weight_value` is the numeric column.
- Grants are **not uniform across tables**. Never write `GRANT ALL`. `app_events`
  gives `anon` only SELECT and INSERT. `email_send_state` gives `anon` nothing.
- RLS is on for all 17 tables, 57 policies, all keyed on `auth.uid()`.
- `signInAnonymously` is enabled. It did not carry over from Lovable Cloud and
  had to be re-enabled on the new project on 9 Sep 2026, under Authentication →
  Sign In / Providers → Allow anonymous sign-ins. Anonymous users get a real
  `auth.uid()`, so the RLS model works for them without policy changes.
- `exercises.search_all` is a generated column with two trigram GIN indexes.
  Depends on `pg_trgm` being installed in schema `public`.
- Muscle names are a canonical 17-value vocabulary enforced by a CHECK constraint.
  Do not invent new muscle strings.
- After inserting into `exercise_synonym_rules`, call `rebuild_exercise_aliases()`.
- `last_sign_in_at` is not activity. Supabase only updates it on fresh sign-ins,
  not token refreshes. Use `GREATEST(last_set_logged, last_page_view)`.

### Migration history drifts from the live schema

`supabase/migrations` is not reliable. Columns exist live that never appear in a
migration file. The live database is the source of truth. Verify against an export
or a live query, never against the migration folder.

### Row counts, 4 Sep 2026

| Table | Rows |
|---|---|
| exercises | 898 |
| sets | 1247 |
| page_views | 3024 |
| app_events | 478 |
| workout_exercises | 410 |
| template_exercises | 194 |
| workouts | 93 |
| beginner_notes | 76 |
| exercise_synonym_rules | 64 |
| templates | 37 |
| user_profiles | 12 |
| auth.users | 12 |

---

## SQL conventions

Always run a diagnostic SELECT before any insert or update migration. Label it
`Section 0` and read the output before running anything else.

- `ON CONFLICT (slug) DO UPDATE` for idempotency
- `DO` blocks with explicit `RAISE EXCEPTION` guards when a slug must exist
- `ADD COLUMN IF NOT EXISTS`, since drift is expected
- View the current function body before any `CREATE OR REPLACE`
- Validate multi-statement files with pglast before running them:
  `python3 -c "import pglast; print(len(pglast.parse_sql(open('f.sql').read())))"`

---

## Build and deploy traps

**A committed `.env` overrides Vercel environment variables at build time.** Vite
reads it during the build and wins. This cost hours. Keep `.env` in `.gitignore`.

`VITE_GOOGLE_CLIENT_ID` must be a build-time **Config** variable in Vercel, not a
Secret. Vercel refuses `visibility: secret` on `VITE_`-prefixed variables and will
not convert an existing Secret, so it has to be deleted and recreated.

The Google OAuth client's authorized JavaScript origins must list every domain
served: `liftcamp.app`, `www.liftcamp.app`, `liftcamp.vercel.app`.

The newer `sb_secret_` API key format does not work with the Storage API
("Invalid Compact JWS"). Use the legacy JWT-format `service_role` key from
Settings → API Keys → "Legacy anon, service_role API keys".

Apex is canonical. `www` 308s to apex. Every canonical tag and the sitemap assume
this.

---

## apps/web conventions

- Route file names use a trailing underscore to prevent nesting:
  `routines_.$slug.tsx`
- Public catalog pages need the shell breakout to escape the 480px app shell in
  `__root.tsx`:
  `style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}`
- Exercises without a `beginner_notes` row render `noindex,follow`
- `/sitemap.xml` is a dynamic route joining exercises to `beginner_notes`.
  `lastmod` should reflect the DB `updated_at`, not the current time.

The authed web app is frozen at current functionality. New product features go to
`apps/mobile`. The web keeps the public catalog, the guides, and the
draft-then-claim signup funnel.

---

## Design system: Chalk

| Token | Hex |
|---|---|
| plate blue | `#1B5FA8` |
| paper | `#FDFCFB` |
| gold | `#F5D272` |
| graphite | `#221F1B` |

Type: Hanken Grotesk (UI), DM Mono (numbers).

Numbers in the logging UI are always DM Mono. Weight left, reps right, in that
column order, on every screen without exception.

---

## Licensed content

ExerciseDB GIFs (Starter package, $199, DevWorx Consulting LLC) may be shown
**in-app only, behind auth, and only alongside the exercise data**. The licence
forbids standalone display, which rules out using them on public `/exercises`
pages. The free-exercise-db images (public domain) stay on public pages.

335 of 898 exercises are mapped. `exercise_media_migration.sql` is written but not
applied. Bucket `exercise-animations` does not exist yet.

---

## App Store requirements

Non-negotiable for review:

- In-app account deletion (guideline 5.1.1(v)). Needs an Edge Function with the
  service role key that deletes the auth user and all owned rows in FK order.
- Sign in with Apple (guideline 4.8), required because Google sign-in is offered.
- `PrivacyInfo.xcprivacy` and accurate privacy nutrition labels.
- A working demo account in the App Store Connect review notes.
- No medical claims. Avoid "prevents injury" phrasing anywhere in copy.

---

## Writing style

Applies to all user-facing copy, all documentation, and commit messages.

- No em dashes. Use periods, commas, colons, semicolons, or parentheses.
- No negative parallelism. Never "It's not X, it's Y" or any variant that rejects
  a frame before asserting one. State the positive claim directly.
- No analogies or metaphors for ordinary ideas.
- Banned vocabulary includes: delve, leverage, seamless, robust, crucial, pivotal,
  elevate, unlock, streamline, empower, transformative, showcase, foster.
- Answer first. No warm-up sentence, no summary that repeats the point.
- Specific over polished. Numbers, names, real examples.

Guide and beginner-note copy follows an answer-block structure: direct starting
weight, then the "too heavy" fallback, then the "add weight when" condition, as the
first three lines. This is tuned for AI Overview citation.

---

## Product priorities

Ranked from the Musklr competitor audit, highest value per unit of effort first:

1. Auto-fill previous set values. Removes typing from every set after the first.
2. Free full history. Musklr paywalls at one month; this is a real gap to hold.
3. Seeded example progress state so a new user's charts are not empty.
4. Estimated 1RM per exercise.
5. Reorder modal with drag handles, replacing up/down arrows.
6. PR share card with the lift name on it.
7. Compounds-first exercise picker. Alphabetical defaults dump beginners into yoga.

Deliberately skipped: a social feed (needs user density LiftCamp does not have),
Apple Watch (a separate Swift target, out of scope for Expo).

---

## How to work with Alan

Name the platform for every step. "SUPABASE (SQL editor)", "VERCEL (Settings →
Environment Variables)", "TERMINAL". He moves between four or five surfaces and
ambiguity costs a round trip.

Give full files rather than diffs when replacing something.

Ask before running a destructive or irreversible operation, and say plainly what
would be lost.
