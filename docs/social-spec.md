# Social v0 and 3-tab navigation

Status: draft v2, 4 Oct 2026. Decisions from Claude Code's report are folded in. Nothing here is built.

## Goal

Let people follow each other's workouts, give kudos, and compare streaks. First users are Alan and Will. Everything sits behind a flag until it ships to everyone after launch.

Social is free for everyone when it ships. It is never a Pro feature.

## Model

- **One-way follows.** Following someone lets you see their workouts. They don't see yours unless they follow you back.
- **Every account is private in v0.** A follow is a request the other person approves. There is no public option yet.
- A later version adds a Private profile toggle in Settings (on by default) plus suggested follows. That's a setting and a screen, not a data change.

## Scope

In v0:

- 3-tab navigation (Home, Workout, Profile)
- Follow requests through an invite link, approved by the person being followed
- Feed of finished workouts from people you follow, on Home
- Kudos, one tap per workout
- Streak comparison on a person's profile sheet
- Block, remove follower, unfollow, report, an admin queue

Out of v0:

- Public profiles and the Private profile toggle
- Search, suggested follows, an Explore feed
- Photos (profile photos included), comments, captions
- Push notifications
- Social medals (kudos given, routine saves)
- Sending a routine to someone
- Universal links (needs a native build; see Invites)

Everything in v0 is JS only. The `liftcamp` scheme has been in `app.json` since 9 Sep 2026, native tabs are already in builds 10 and 13, and the share sheet is React Native's own. With no native dependency added, v0 ships as an update to build 13.

## Flag

- Key `social`, separate from Pro. A Pro or tester grant never turns social on.
- Stored in `user_flags`, with the same lockdown, admin functions and device cache pattern as tester Pro (`user_entitlements`, `admin_set_entitlement`, `lib/tester-pro.ts`):
  - **Per-user grant** for the beta, from /admin by email.
  - **One global switch** (`app_flags`) that turns social on for everyone at launch.
  - **Per-user revoke** that wins over both. The admin queue's "disable social access" writes it.
  - Social is on for a user when they are not revoked and either the switch is on or they hold a grant. The server decides; the app never computes it from parts.
- Clients read their own state and write nothing. Admin functions check `has_role(auth.uid(), 'admin')`.
- **Known before the tabs first draw.** Hiding a native tab while the app runs remounts the navigator and resets its state, so the tab layout reads the flag from the device cache (`liftcamp:social:<userId>`) and never waits on supabase-js. A fresh read updates the cache; it changes the tabs only on the next launch, or immediately when the cache was empty and the answer is off (no change to draw).
- The flag gates both the new navigation and every social surface. Users without it see today's 4-tab app, unchanged.
- **Both sides need the flag.** A follow request can only be sent to, or received from, a user who has social on.

## Navigation

Three tabs: **Home, Workout, Profile.**

| Tab | Holds |
|---|---|
| Home | Next up, week card, last workout, following feed |
| Workout | Start new workout, saved routines, programs, exercise library |
| Profile | Header and stats, medals, a History row, followers and following, settings |

- **Workout** is the current saved routines list plus the program browser plus the Exercises tab's library, as sections on one screen, with its own stack for an exercise and a workout opened from an exercise. Start new workout stays as the header pill.
- **History is a row on Profile** that pushes today's History screen, unchanged: the month calendar on top, the workout list below, tap-to-scroll working as it does now. Profile becomes a stack (`(tabs)/profile/`) so it can push History, a workout's detail, Followers and Following.
- The header "+ Workout" or "Resume" pill stays on Home and Workout.
- The tab layout uses each trigger's `hidden` prop: with the flag, History and Exercises are hidden and Workout shows; without it, the reverse. The Profile tab shows a badge while follow requests wait.

### Links into hidden tabs

A hidden tab cannot be navigated to at all, so every link into History or Exercises resolves by flag:

| Link | Today | With the flag |
|---|---|---|
| Week card tap (`(home)/index.tsx`) | `/history` | Profile's History |
| Last workout card (`(home)/index.tsx`) | `/history/[id]` | Profile's workout detail |
| History rows (`components/history/workout-row.tsx`) | `/history/[id]` | the detail in the stack the row is in |
| Profile's exercise links (`(tabs)/profile.tsx`) | `/exercises/[id]` | Profile's own exercise route, or Workout's |
| Routines (`/routines` from Home and Profile) | Home stack | Workout's program browser |

One helper decides each target from the flag, so no screen hard-codes a tab path.

## Home

Without the flag, Home is unchanged.

With the flag:

- **Until a routine is saved**, Home keeps today's top: Start new workout, the setup checklist and the starter routines. Then the week card, last workout card and feed.
- **Once a routine exists**, top to bottom:
  1. Next up
  2. Workouts this week card (unchanged)
  3. Last workout card
  4. Following feed
- Saved routines and the program browser live in the Workout tab, not on Home.
- With nobody followed yet, the feed area is one card: "Train with friends" and an Invite button. Waiting follow requests show as a line above it ("Will wants to follow you").

## Invites and follow requests

- Each user has one invite code, created on first use. Regenerating it invalidates the old link.
- Invite opens the share sheet with a link to `https://liftcamp.app/i/<code>`.
- That page shows the inviter's username, the **invite code in large type** (for the Enter invite code fallback after an App Store install, which loses the link), an Open in LiftCamp button using `liftcamp://invite/<code>`, and an **iOS App Store link** (a placeholder until approval). No Play Store link in v0. Universal links need associated domains, a native change, so they wait for the next store build.
- Opening an invite in the app:
  - **Without the flag:** a short "Friends are coming soon" screen. Nothing is sent.
  - **As a guest:** the create-account sheet first.
  - **With the flag:** the inviter's username with two buttons.
    - **Follow** sends a request to the inviter, who approves it.
    - **Let them follow you** sends the inviter a request in the other direction: the inviter follows you once they accept. You started it, so it is the inviter who approves. In practice most people tap both.
- **The code survives the trip.** A deep link that lands during onboarding, sign-in or guest linking is saved on the device (`liftcamp:pending-invite`) and opened once the user reaches Home signed in. It expires after 7 days and is cleared once acted on.
- The person receiving a request approves or declines it in Profile, Followers, under Requests. A badge on the Profile tab and the line on Home show while any are waiting.
- Approving shows a **Follow back** button when you don't already follow or have requested them.
- Decline is silent. The request stays pending on the sender's side, then disappears after 30 days.
- A sender can withdraw a request. The follow button reads Follow, Requested or Following.
- Fallback: Profile, Following, Enter invite code.
- Guests cannot follow or be followed.
- An invite link can be forwarded or posted, which is why every follow needs approval even when it came from your own link.

## Followers and following

- Profile shows Followers and Following counts. Each opens a list.
- Following rows have a ⋯ menu with Unfollow, Block and Report.
- Follower rows have a ⋯ menu with Remove follower, Block and Report. Removing a follower is silent and doesn't block a new request.

## Feed

- Finished workouts from people you follow, last 14 days, newest first. Your own workouts are not in the feed.
- Each item: initials avatar, username, workout name, day and time, duration, completed sets, PR count, kudos count, kudos button.
- **PR count** comes from a new nullable `workouts.pr_count`, written by the phone at finish from the same PR logic as the summary. No backfill. The feed hides the stat when it is null.
- Tapping an item opens a read-only detail of their workout: the same screen as your own without Repeat, Save routine, **Volume** or **PR ribbons**.
- Discarded workouts and workouts with zero completed sets never appear.
- Paged, 20 items at a time.

## Avatars

Other people are shown with initials from their username only. Profile photos are out of v0, and nothing of another person's `auth.users` metadata is read. Your own avatar is unchanged (Google photo when there is one).

## Kudos

- Any approved follower can give kudos on a workout they can see. One per person per workout. Tapping again removes it.
- You cannot give kudos to your own workout.
- Your own workout detail and last workout card show the kudos count and who gave them.
- No notification in v0. An unseen-kudos dot on Home's last workout card is enough. Last-seen is stored on the device (`liftcamp:kudos-seen:<userId>`), so a second phone shows the dot again.

## Profile sheet and streak comparison

- Tapping a person (feed avatar or a list row) opens their profile sheet: username, current week streak, longest streak, this week's progress against their target, latest workout, and the ⋯ menu.
- You see this only for people you follow. Anyone else shows username and the Follow button only.
- Your streak and theirs side by side, using the existing streak logic in `packages/shared`. Their side comes from a read that returns finished workout dates and their weekly target only.
- No challenge setup, invites or winners in v0. The comparison is the challenge.

## Safety

Required for Apple guideline 1.2 once other users can see your content.

- **Report:** in the ⋯ menu on a profile sheet, a list row and a feed workout. Reasons: Inappropriate, Harassment, Spam, Other.
- **Block:** removes follows in both directions, cancels pending requests, hides both users from each other everywhere, and stops future requests between them. Unblock from Profile, Settings, Blocked.
- **Admin queue** in /admin: open reports with reporter, target, reason and date. Actions: dismiss, remove the follow, disable the target's social access (a per-user revoke).
- **Email to Alan** on each new report, so reports are handled within 24 hours: a database trigger on `reports` calls an Edge Function through `pg_net`, which sends through Resend.
- **Content rule** added to the terms: no harassment, hate or sexual content. Workouts and usernames that break it are removed and the account can lose social access. It goes on its own small branch off main (the held `terms-subscriptions` branch also edits the terms).
- Usernames and workout names are the only user text other people see in v0. Workout notes and set notes are never returned to anyone but their owner.

## Data

SQL in `supabase/migrations/20261004120000_social_schema.sql`, reviewed before Alan runs it in the Supabase editor.

New tables:

- `user_flags` (user_id, flag, state granted or revoked, granted_at, granted_by)
- `app_flags` (flag, enabled_for_all, updated_at, updated_by): the global switch
- `invite_codes` (user_id, code, created_at). One active code per user.
- `follows` (follower_id, followee_id, status pending or accepted, requested_by, invite_code, created_at, accepted_at, declined_at). One row per direction, unique on the pair. `requested_by` says who started it; the other person approves. Withdrawn, unfollowed and removed follows delete the row. A declined request keeps its row, hidden from the person who declined. Pending rows older than 30 days are deleted nightly.
- `blocks` (blocker_id, blocked_id, created_at)
- `kudos` (workout_id, user_id, created_at), unique on the pair
- `reports` (id, reporter_id, target_user_id, target_workout_id, reason, status, created_at, resolved_at, resolved_by)

New column: `workouts.pr_count`, nullable, written by the owner's phone at finish.

Rules for every new table:

- **Foreign keys** to `auth.users` with `ON DELETE CASCADE`, so account deletion needs no change to the `delete-account` function. The exception is `reports`: `reporter_id` and `target_user_id` are `ON DELETE SET NULL`, so a report stays in the queue when either side deletes their account. `kudos.workout_id` cascades from `workouts`; `reports.target_workout_id` is set null.
- **Guest merge:** `merge_guest_account` refuses a guest holding a row in any of them. Its leftover check reads the foreign keys to `auth.users` live, so each new table is covered without a change to the function, and guests can never hold a row anyway.
- **RLS on, anonymous users refused.** No client writes any of these tables directly; every write goes through a `SECURITY DEFINER` function that checks the caller is signed up, has social on, and is not blocked.
- **Reads of another person's data** go through `SECURITY DEFINER` functions gated on an accepted follow with no block either way: the feed, a workout's read-only detail, the profile sheet, the streak read (dates and weekly target only), and kudos givers. The `workouts`, `sets` and `user_profiles` RLS stays owner-only.
- Grants are explicit. No `GRANT ALL`. Every new function revokes EXECUTE from `PUBLIC` and `anon`.

## Launch checklist

- App Store Connect privacy labels: review once other people can see your workouts and username (likely "Other User Content" and "Fitness" as linked, not tracking). The privacy manifest in `app.json` is not expected to change.
- iOS App Store link on the /i page, replacing the placeholder.
- The global switch on (`app_flags`), and the per-user grants left as they are.
- The content rule live in the terms.

## Build order

Each its own branch and worktree, commit and push, Alan merges.

0. **The username-fix branch merges before any social branch**: name-based default usernames, no relay-address usernames. Other people will see usernames. The content-rule branch can go any time before launch.
1. `social-schema`: SQL for review, then the shared logic with vitest (flag state and cache, follow states, block effects, kudos toggling, feed filtering, invite codes).
2. `nav-three-tabs`: the new navigation behind the flag, the flag cache, and the links into hidden tabs.
3. `social-follows`: invites, the pending-invite handoff, the /i page on web, requests, followers and following lists, block, remove and unfollow.
4. `social-feed`: `pr_count` at finish, the feed on Home, the profile sheet, read-only workout detail, kudos.
5. `social-safety`: report, admin queue, the report trigger and its Edge Function.

The schema and follows branches must exist before the flag goes to Will.
