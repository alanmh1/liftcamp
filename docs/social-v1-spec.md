# Social v1: ship the feed with the safety pieces

Status: draft, 19 Nov 2026. Builds on docs/social-spec.md (v0, 4 Oct 2026), which stays the reference for the model, invites, follows and the feed. This doc covers only what's left before social can go to everyone.

## Where things stand

Merged to main and live:

- Schema, flag (`social` in `app_flags` and `user_flags`), three-tab nav
- Invites, follow requests, followers and following lists, block, remove, unfollow
- Username fix (no relay-address usernames) and the content rule in the terms
- Server side of the feed: `social_feed`, `social_workout`, `social_profile`, `social_streak`, `toggle_kudos`, `workout_kudos`, `social_kudos_inbox` (from `20261010120000_social_feed.sql`, run in October, then `docs/pro-warmup-social-counts.sql` on 2 Nov)
- Server side of reports: `file_report` (connected people only, 10 a day), `admin_list_reports`, `admin_resolve_report`

Built but never merged:

- The feed client, one commit on `private/social-feed` (f541829e, 10 Oct 2026, about 3,000 lines): feed cards, kudos, person screen, read-only friend workout, notifications bell and inbox, `finishStats` (volume, `pr_count`, `pr_exercise_ids` at finish). It's 347 commits behind main.

Not built:

- Report UI in the app, the report queue on /admin, report emails
- Any text filter
- Community rules agreement, Contact us in Settings

## Decisions (19 Nov 2026)

- **No push in v1.** The bell inbox from the feed commit covers requests, kudos and accepted follows. Everything in v1 is JS, SQL and an Edge Function, so it ships OTA.
- **Text filtering is a blocklist plus a moderation API.** The blocklist catches known words instantly. OpenAI's moderation endpoint checks names, notes and usernames after the fact and files an automatic report when it flags one.
- **Per-workout visibility is deferred.** Follows need approval, so followers are people you chose.
- **Filtering governs what others see. It never blocks someone's own log.** A workout name or note with a blocked word saves normally and stays visible to its owner. Friends see "Workout" and no note. Usernames are the exception: they're public by nature, so a blocked username is refused.
- **Following shows everything. Interacting needs a mutual follow.** If you follow someone (accepted), you see every workout they finish. You can like it (and, in v2, comment) only when they follow you back. The server enforces this; the app reads `can_interact` on each row.
- **The card summary is set counts.** Each exercise row reads "4 sets" and the exercise name. No weight or reps on the card. The read-only friend workout still shows every set.
- **Copy workout.** Anyone who can see a workout can copy it, mutual or not. Details under Branch 1.
- **Home v2.** Home makes room for the feed. Details under Branch 1b.

## What Apple 1.2 asks for, and where each piece lives

| Requirement | v1 |
|---|---|
| Filter objectionable material from being posted | Blocklist on usernames (refused on write) and on names and notes (masked for friends on read). Moderation API after the fact. |
| Report offensive content, timely response | Report from every ⋯ menu. Email to hello@liftcamp.app on each report. Queue on /admin. 24-hour target. |
| Block abusive users | Built. |
| Published contact info | Contact us row in Settings, hello@liftcamp.app on the community rules sheet and in the terms. |

## Database (docs/social-safety.sql)

Run by Alan in the Supabase SQL editor. Sections 0 to 8 are safe to run before any client ships: old builds never read the new columns, and the feed functions keep their signatures. Section 9 runs after the Edge Function is deployed.

- `private.moderation_terms` (372 terms from the LDNOOBW English list, CC BY 4.0, minus fitness false positives like butt, snatch, hardcore, suck). `word` terms match whole words; 18 `any` terms (slurs and the core profanity) match inside a word too, so `fuckyou99` is caught.
- `private.text_blocked(text)`: lowercase, `@` to a, `$` to s, every other non-letter to a space. Digits are not read as letters, so "455" never becomes a word.
- `public.text_allowed(text)`: the app's pre-check, any signed-in user, capped at 1,000 characters.
- Username trigger: a blocked username is refused with SQLSTATE `23514` and the message "That username isn't allowed. Pick another."
- `workouts.hidden_at` (admin hid it; friends never see it), `workouts.moderation_flagged_at` (API flagged it; friends see "Workout", no note), `workouts.moderated_at`. A trigger stops the `authenticated` role from writing these three, since the app writes `workouts` directly under owner RLS.
- `user_profiles.community_rules_accepted_at`, written by the app.
- `social_feed`, `social_workout`, `social_profile` and `private.workout_visible` skip hidden workouts and mask names and notes. `workout_visible` also gates `toggle_kudos`, so hidden workouts can't take kudos.
- `private.mutual(a, b)`: both can view each other. `social_feed` is dropped and recreated with a new `can_interact boolean` column after `kudos_given` (old builds read columns by name, so they keep working). `social_workout` returns `can_interact`, and each exercise carries `is_custom` (a user's own exercise, which Copy skips).
- `toggle_kudos` refuses a workout whose owner doesn't follow you back, with `42501` "You can like workouts once you follow each other." Existing kudos stay.
- `reports.detail` (jsonb) and the reason `auto_flag`, which only the Edge Function files. `file_report` still accepts only the four user reasons.
- Every new report emails hello@liftcamp.app through Resend, the same way `notify_admin_new_user` does.
- A trigger posts `{table, id}` to the `moderate-text` Edge Function when a finished, app-made workout's name or note changes, or a username changes. Only for users with social on. The text itself is never in the request.
- `admin_list_reports` gains `workout_name`, `workout_note` (raw, unmasked), `workout_hidden`, `workout_flagged`, `detail`. `admin_resolve_report` gains `hide_workout` and `reset_username` (gives a `lifterNNNNN` name, the same shape as `fallbackUsername`). Dismissing an `auto_flag` report clears the workout's flag. `admin_set_workout_hidden(p_workout, p_hidden)` undoes a hide.

## Edge Function: moderate-text

`supabase/functions/moderate-text/index.ts`, `verify_jwt = false` in `supabase/config.toml`, deployed with `--no-verify-jwt`.

- POST only. Compares the `x-moderation-secret` header to `MODERATION_HOOK_SECRET` in constant time. Anything else gets 401.
- Body `{ table: 'workouts' | 'user_profiles', id: uuid }`. Reads the row itself with the service role client. Never trusts text from the request.
- **workouts:** text is the name and note joined by a newline. Skips (200) if the row is gone, unfinished, not `ios` or `android`, or both fields are empty.
- **user_profiles:** text is the username, with underscores as spaces. Skips if null.
- Calls `POST https://api.openai.com/v1/moderations` with `model: "omni-moderation-latest"` and the text as `input`. Check the request and response shape against OpenAI's current docs before writing it.
- **workouts result:** sets `moderated_at = now()`. If flagged, sets `moderation_flagged_at` (keeps the earlier value if already set); if not flagged, clears it. When it goes from unflagged to flagged and no open `auto_flag` report exists for that workout, inserts a report: `reporter_id` null, `target_user_id` the owner, `target_workout_id`, `reason 'auto_flag'`, `detail { field: 'workout', categories: [names of flagged categories] }`.
- **user_profiles result:** if flagged and no open `auto_flag` report exists for that user with the same `detail->>'username'`, inserts a report with `detail { field: 'username', username, categories }`. Usernames are never masked by the function; the admin decides.
- No `OPENAI_API_KEY`: logs once and returns 200 `{ skipped: 'no key' }`. OpenAI error: logs and returns 502. pg_net doesn't retry, and the blocklist still applies.
- Header comment in the style of `delete-account/index.ts`: what it does, the secrets (`OPENAI_API_KEY`, `MODERATION_HOOK_SECRET`; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` come from the platform), and how it's deployed.

## Mobile

### Branch 1: social-feed-v1 (port the feed)

Cherry-pick f541829e onto a fresh branch from main and bring it up to date. Keep its decisions (card layout, kudos, person screen, read-only workout, bell inbox, `finishStats`) unless main has since replaced the same thing:

- **Workout notes:** main already has `components/workout/workout-note.tsx` (`WorkoutNoteRow`, `WorkoutNoteSheet`) on the summary and detail. Keep main's and drop the commit's `workout-note-field.tsx`.
- **Home header:** put the bell where it fits the current Home header (the onboarding and Workout tab redesigns changed it), left of the pill as before.
- **The migration file:** `20261010120000_social_feed.sql` already ran. Keep it, but add a header comment saying it ran in October and that `docs/pro-warmup-social-counts.sql` and `docs/social-safety.sql` have since replaced `social_feed`, `social_workout`, `social_profile` and `workout_visible`. Running it again would undo both.
- **Types:** `packages/shared/src/database.types.ts` matches the live database after `docs/social-safety.sql` (new columns, `text_allowed`, new `admin_list_reports` return, `admin_set_workout_hidden`).
- **Volume:** the read-only friend workout and the card show Time and Volume, as the commit decided on 10 Oct.
- **Card summary:** one row per exercise, "4 sets" then the exercise name, from `exercises[].sets` on the feed row. PR rows keep the PR badge. Board Feed2 in the "LiftCamp feed options" canvas is the reference.
- **Mutual gating:** when `can_interact` is false, the kudos button is hidden and the card footer reads "You can like and comment once you follow each other." in muted text. The read-only friend workout does the same. A `42501` from `toggle_kudos` (the other person unfollowed meanwhile) rolls back the optimistic kudos and refreshes the row.
- **Copy workout:** in the card ⋯ menu ("Copy workout") and as a button on the read-only friend workout. Opens a sheet with two choices:
  - **Start now:** starts an active workout with the friend's exercises in order, the same set count per exercise, and their reps as targets. Weights come from the copier's own last session of that exercise (the same lookup routines use); blank if they've never done it. Warmup sets copy as warmups.
  - **Save as routine:** creates a routine named "<workout name> from @username" (editable before saving), same exercises, sets and reps, no weights.
  - Custom exercises (`is_custom`) are skipped, with a note in the sheet: "1 custom exercise won't copy." If every exercise is custom, the sheet says so and disables both buttons.
  - Client only. It reads `social_workout` and writes through the existing routine and active-workout code. Guests can't copy (social is signed-up only).
  - Board Copy is the reference.

OTA-eligible: no native dependency, no change to `eas.json`.

### Branch 1b: home-v2 (from main, OTA, independent of social)

Ships to everyone, flag or not. Board HomeW2 is the reference.

- Remove the Last workout card from Home.
- Remove the "Your first medal" row from the This week card.
- Next up moves into the This week card as its last row, under a divider: a small "NEXT UP" label, the routine name, and its meta line on the left; an outlined Skip pill and a solid Start pill side by side on the right. Same actions as today's Next up card.
- The "+ Workout" header button becomes a light blue tint: background `#E3ECF7`, text and icon `#24508F`. Add both as tokens if the palette doesn't have them.
- The week streak ("0 weeks" with the flame) sits plain on the white card, with no gray pill behind it.
- New users with no routine yet keep today's Home top (no Next up row).

OTA-eligible: no native dependency, no change to `eas.json`.

### Branch 2: social-safety (on top of social-feed-v1)

**Report sheet** (`components/social/report-sheet.tsx`)

- Opens from: the ⋯ menu on a feed card, the person screen, a Following or Followers row (replacing the "Report joins the ⋯ menu" placeholder in `follow-actions.tsx`), and the read-only friend workout.
- Title "Report @username". Four rows: Inappropriate, Harassment, Spam, Other. A list sheet, so left-aligned per apps/mobile/CLAUDE.md.
- A report from a feed card or friend workout sends `p_target_workout`; from a person or row it sends null.
- After `file_report` succeeds, the sheet shows "Thanks. We review every report within 24 hours." and a "Block @username too" button that calls `block_user`. Done closes it.
- Errors: `54000` shows "You've sent a lot of reports today. Try again tomorrow." Others show the server's message.

**Community rules sheet** (`components/social/community-rules-sheet.tsx`)

- Shown once, before the user's first social action: sending an invite, sending or accepting a follow request, or giving kudos. Not before reading the feed.
- Content-only sheet, so centred. Copy:
  - Title: "Before you train with friends"
  - "Keep it friendly. No harassment, hate or sexual content in your username, workout names or notes."
  - "You can report or block anyone from the ⋯ menu. We review reports within 24 hours and remove what breaks the rules."
  - "Questions? hello@liftcamp.app"
  - Link: "Read the full terms" to https://liftcamp.app/terms#community
  - Button: "I agree"
- "I agree" writes `user_profiles.community_rules_accepted_at = now()` (owner RLS allows it), then runs the action that opened the sheet. Accepted state is cached on the device per user, like the social flag.
- Closing without agreeing cancels the action.

**Usernames**

- `UsernameSheet`: on save, call `text_allowed` first. If false, show "That username isn't allowed. Pick another." in the existing error line and don't save. Also map a `23514` error from the update to the same message, in case the check was skipped offline.
- `settleUsername` (automatic usernames at sign-in): a `23514` on a candidate moves on to the next candidate, then `fallbackUsername`, the same way a collision does today.

**Notes and workout names**

- Never block saving. Notes save through the queue on every change, and they're the person's own log.
- When the user has social on and the note sheet closes, call `text_allowed` once (skip it offline or for guests). If false, show a gold `TipNote` under the note row: "Friends won't see this note. It has words we don't allow in shared posts." Clear it when the note changes and passes.

**Settings**

- New "Contact us" row (mailto hello@liftcamp.app through plain `Linking.openURL` in try/catch, the OTA-safe pattern from the Workout tab's request-a-routine row) and a "Community rules" row opening https://liftcamp.app/terms#community. Both always shown. Contact us is not a social-only feature.

OTA-eligible: no native dependency, no change to `eas.json`.

## Web

**/admin, Reports section** (`ReportsSection` in `routes/admin.tsx`, same patterns as `ProAccessSection` and `PeopleSection`)

- Pills: Open (default), Resolved (`p_status` null, filtered to dismissed and actioned in the client), All.
- One row per report: filed date, reason (`auto_flag` shown as "Auto-flag" plus the categories from `detail`), reporter (username and email, or "Moderation check"), target (username and email), and, when there's a workout, its raw name and note with Hidden and Flagged badges.
- Actions on open reports: Dismiss, Hide workout (only with a workout), Reset username, Remove follow (only when there's a reporter), Disable social. A confirm step on every action except Dismiss.
- On any report with a hidden workout: Unhide, which calls `admin_set_workout_hidden(id, false)`.
- An open-count badge in the section heading. Sort oldest first so the 24-hour clock is obvious; show "Over 24h" in the danger colour on open reports older than a day.

**Terms** (`routes/terms.tsx`)

- Move the content rule out of "Fair use" into a new `Section` titled "Community rules" with the anchor `id="community"` (`Section` takes no id today; add an optional one), covering: what's not allowed (harassment, hate, sexual content, spam) in usernames, workout names and notes; that friends won't see names or notes with blocked words; reporting and blocking from the ⋯ menu; review within 24 hours; removal and loss of social access; contact at hello@liftcamp.app.

**Privacy** (`routes/privacy.tsx`)

- Add OpenAI to the processors list: when social is on, the names and notes of finished workouts and usernames are sent to OpenAI's moderation service to check them against the community rules. OpenAI's API terms say API data isn't used to train their models; check the current wording before quoting it.
- Under what others can see: your username, finished workouts (name, time, volume, exercises, set counts, PRs, notes) to people you approve, and kudos you give.

## Ship steps (Alan)

1. **SUPABASE (SQL editor):** `docs/social-safety.sql` Sections 0 to 8, then Section 10. Section 9 waits.
2. **OPENAI:** create an API key at platform.openai.com for LiftCamp. The moderation endpoint is free.
3. **TERMINAL:** `cd ~/code/liftcamp && supabase secrets set OPENAI_API_KEY=<key> --project-ref mnsigwjyskxfuszeegtp`
4. Merge `social-feed-v1`, then `social-safety`, after your Simulator passes.
5. **TERMINAL:** `supabase functions deploy moderate-text --no-verify-jwt --project-ref mnsigwjyskxfuszeegtp`
6. **SUPABASE (SQL editor):** Section 9. Copy the secret it shows.
7. **TERMINAL:** `supabase secrets set MODERATION_HOOK_SECRET=<value> --project-ref mnsigwjyskxfuszeegtp`
8. **VERCEL:** the /admin, terms and privacy changes deploy with the merge.
9. **TERMINAL:** fingerprint check and OTA from apps/mobile, as usual.

## Launch to everyone (later)

Decided 19 Nov 2026: v1, comments and photos launch together in one store submission. docs/social-v2-spec.md has the combined launch list and replaces this section where they differ. Testers can get v1 and comments by OTA before then.

Social goes to everyone with a store submission, even though the code ships OTA, so App Review sees it with the new answers:

- **App Store Connect, App Privacy:** add Other User Content (linked, not tracking) and check Fitness.
- **App Store Connect, age rating:** answer the user-generated content questions. Age rating changes go out with a new version.
- **App Review notes:** two demo accounts that already follow each other with workouts in the feed, and where Report (⋯ on any card, profile or row) and Block are.
- Then `admin_set_global_flag` for `social` on.
- iOS App Store link on the /i page (still on the v0 launch list).

## Out of v1

Comments, photos (DMCA agent, TAKE IT DOWN request process, CSAM and image checks come with them), push, per-workout visibility, public profiles, search.
