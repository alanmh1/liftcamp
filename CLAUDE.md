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
- Units: `user_profiles.weight_unit` (`kg` or `lb`, CHECK) is the user's
  unit, picked in Settings. Each set keeps the unit it was logged in, in
  `sets.weight_unit`, and is converted for display, never rewritten.
  Bodyweight is stored in the profile's unit and converted in the same
  write as a unit change. On mobile every screen that shows a weight reads
  the unit from `useWeightUnit` (`components/unit-provider.tsx`): the
  workout screen, Home, History, the exercise screen and the summary. The
  app shows `lbs`; the database stores `lb`.
- Grants are **not uniform across tables**. Never write `GRANT ALL`. `app_events`
  gives `anon` only SELECT and INSERT. `email_send_state` gives `anon` nothing.
- TRUNCATE is revoked from `anon` and `authenticated` on all public tables and
  in `postgres`'s default privileges (28 Sep 2026).
- RLS is on for all 17 tables, 57 policies, all keyed on `auth.uid()`.
- `signInAnonymously` is enabled. It did not carry over from Lovable Cloud and
  had to be re-enabled on the new project on 9 Sep 2026, under Authentication →
  Sign In / Providers → Allow anonymous sign-ins. Still on as of 28 Sep 2026
  (guests work). Anonymous users get a real `auth.uid()`, so the RLS model
  works for them without policy changes.
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

## Mobile auth

Native Google and Apple sign-in, both landing on `signInWithIdToken`. Set up
11 Sep 2026.

- Bundle ID `app.liftcamp.mobile`, iOS and Android.
- Google iOS client ID lives in `apps/mobile/.env` as
  `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Its reversed form is the URL scheme in
  `app.json` under the google-signin plugin; that one is public.
- **SUPABASE (Authentication → Providers → Google)**: the Client IDs field
  lists the web client ID first, then the iOS client ID. Order matters to
  Supabase; the first is the one it reports in errors.
- **SUPABASE (Authentication → Providers → Apple)**: Client ID
  `app.liftcamp.mobile`, no secret. Native sign-in only; the web has no Apple
  button.
- Manual linking is enabled (11 Sep 2026). An anonymous user attaching Google
  or Apple goes through `linkIdentity`, so their workouts stay on the same
  `auth.uid()`. If the identity already belongs to another account, the app
  signs into that account and says the guest workouts were not moved. Moving
  rows between users would need a database function; none exists.
- Google tokens carry no nonce, because the native SDK cannot set one. If
  Supabase rejects a Google token over a nonce mismatch, the fix is the
  provider's "Skip nonce checks" setting, not code.
- `apps/mobile/.env` is gitignored. Dev builds read it through Metro. EAS
  preview and production builds do not see it, so `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  are set as EAS environment variables for both `preview` and `production`
  (done; checked with `eas env:list` on 28 Sep 2026). A new `EXPO_PUBLIC_`
  variable has to be added there too.

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

Type: Outfit throughout, mobile and web, since 14 Sep 2026 (before that,
Hanken Grotesk on the web, system font plus DM Mono on mobile).

Numbers that line up in a column are always tabular figures: `fontVariant:
['tabular-nums']` on mobile, `font-variant-numeric: tabular-nums` on the web.
Outfit ships them; its default digits are proportional. On mobile, `Text` and
`TextInput` come from `@/components/text`, never from `react-native`, so a
`fontWeight` resolves to the right Outfit face. Weight left, reps right, in
that column order, on every screen without exception.

---

## Licensed content

ExerciseDB GIFs (Starter package, $199, DevWorx Consulting LLC) may be shown
**in-app only, behind auth, and only alongside the exercise data**. The licence
forbids standalone display, which rules out using them on public `/exercises`
pages. The free-exercise-db images (public domain) stay on public pages.

548 of 898 exercises have GIFs, in the public bucket `exercise-gifs` with two
folders: `180/` (`exercises.gif_url_sm`, the picker thumbnail) and `360/`
(`exercises.gif_url`, the info sheet animation). 882 have a static photo in
`exercises.image_url`; 16 have neither and fall back to a letter tile. The
mobile app shows the GIFs only inside the picker and the exercise info sheet,
both behind the session, which is what the licence allows.

---

## App Store requirements

Non-negotiable for review:

- In-app account deletion (guideline 5.1.1(v)). Shipped: Settings → Delete
  account, for guests too, calls the `delete-account` Edge Function
  (`supabase/functions/delete-account`), deployed with `--no-verify-jwt` and
  the secrets `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` and
  `RESEND_API_KEY`. It verifies the caller's token, revokes the Apple token
  when the account has one (a failed revoke is logged, the delete goes
  ahead), deletes the email-keyed rows (`suppressed_emails` is kept), deletes
  the auth user, which cascades to every per-user table, then sends a
  confirmation from `noreply@liftcamp.app` through Resend.
- Sign in with Apple (guideline 4.8), required because Google sign-in is offered.
- `PrivacyInfo.xcprivacy`: declared in `app.json` `ios.privacyManifests`;
  App Store Connect privacy labels still to fill in.
- A working demo account in the App Store Connect review notes.
- No medical claims. Avoid "prevents injury" phrasing anywhere in copy.

### Before App Store submission

Engineering work still open as of 28 Sep 2026. Each item blocks a public
release, none blocks a dev or preview build.

- EAS environment variables: done. All three `EXPO_PUBLIC_` variables are set
  for `preview` and `production` (checked 28 Sep 2026).
- Offline write queue behind `apps/mobile/src/data/workouts.ts`. Every write
  already goes through that module with a client UUID and an idempotent
  insert, so the queue slots in without touching screens. Today a set logged
  with no signal fails.

### Captcha: deferred

Not a launch blocker as of 28 Sep 2026. Deferred until there is evidence of
abuse (a spike in anonymous sign-ups). Until then the defence is Supabase's
anonymous sign-in rate limit, left at the default 30 per hour per IP on
purpose (carrier NAT and gym Wi-Fi put many real users behind one IP), and
the nightly cleanup of empty guest accounts.

Supabase captcha is one switch for the whole project, so turning it on
breaks every covered call below until it sends a `captchaToken`. Covered
endpoints: `/signup` (including anonymous), `/otp`, `/magiclink`,
`/recover`, `/resend`, `/sso`, and `/token` except the `id_token`,
`refresh_token` and `pkce` grants (from `isIgnoreCaptchaRoute` in the
supabase/auth source).

| Call | Where | Needs a token |
|---|---|---|
| `signInAnonymously` | mobile `auth-provider.tsx`, `dev-reset.ts` | yes |
| `signInWithOtp` | mobile `email-sign-in.ts` | yes |
| `verifyOtp` | mobile `email-sign-in.ts` | no |
| `updateUser` | mobile `email-sign-in.ts`, `native-sign-in.ts`; web `reset-password.tsx` | no |
| `signInWithIdToken` (Apple, Google, One Tap) | mobile `native-sign-in.ts`, web `login.tsx` | no |
| `linkIdentity` with an ID token | mobile `native-sign-in.ts` | no (id_token grant) |
| `signInWithOAuth` | web `login.tsx` | no |
| `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `resend` | web `login.tsx` | yes |

When it is needed: Cloudflare Turnstile, invisible, in front of
`signInAnonymously` and `signInWithOtp` on mobile (needs
`react-native-webview`, so a new native build; `@steve228uk/react-native-turnstile`
or a hand-rolled hidden WebView with `baseUrl` `https://liftcamp.app`), and
`@marsidev/react-turnstile` on the four web login flows, all shipped
together. Invisible mode means naming Cloudflare in the privacy policy.

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
