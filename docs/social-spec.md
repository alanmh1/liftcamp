# Social v0 and 3-tab navigation

Status: draft v3. Decisions from Claude Code's report are folded in (4 Oct 2026), and the social-feed decisions of 10 Oct 2026: the feed card, the profile screen, the read-only workout, kudos and the notifications inbox. Schema, follows and the three tabs are built; social-feed is on its branch.

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
- Streak comparison on a person's profile screen
- A notifications inbox behind a bell on Home, built from existing data
- Block, remove follower, unfollow, report, an admin queue

Out of v0:

- Public profiles and the Private profile toggle
- Search, suggested follows, an Explore feed
- Photos (profile photos included) and comments. The feed card is laid out so both go in without rework (see Feed)
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
- **Known before Home first draws.** The app reads the flag from the device cache (`liftcamp:social:<userId>`) once per user per run and latches it (`lib/social-access.ts`, `socialAtMount` in shared), so it never waits on supabase-js and a social surface never appears or vanishes mid-session. A fresh read updates the cache and shows on the next launch.
- The flag gates every social surface: Home's feed slot, and the follows and feed screens. It does not touch navigation: every user has the three tabs below (8 Oct 2026).
- **Both sides need the flag.** A follow request can only be sent to, or received from, a user who has social on.

## Navigation

Three tabs: **Home, Workout, Profile.**

| Tab | Holds |
|---|---|
| Home | Next up, week card, last workout, following feed |
| Workout | Start new workout, saved routines, a programs row, an Exercises row |
| Profile | Header and stats, medals, a History row, followers and following, settings |

- **Workout** has three sections on one screen, with its own stack for the program browser, the exercise library, an exercise, and a workout opened from an exercise. Start new workout stays as the header pill.
  - **Saved routines** at the top: every day of each, with Start, the long-press menu and the trash.
  - **Programs**: one horizontal row of up to 6 starter programs matched to the profile's level and equipment (`starterPrograms`), ending in a See all tile. The heading's See all and the tile both push the program browser (`train/routines`). The sub-line says why these programs ("For beginners with dumbbells"); with no level answer it reads "Beginner routines". Home shows the same row (`components/home/program-row.tsx`) until a routine is saved.
  - **Exercises**: one row with the library's count, which pushes the library (`train/exercises`): search and the Muscle, Equipment, Level and Yours filters. It opens with the keyboard down.
- **History is a row on Profile** that pushes today's History screen, unchanged: the month calendar on top, the workout list below, tap-to-scroll working as it does now. Profile becomes a stack (`(tabs)/profile/`) so it can push History, a workout's detail, Followers and Following.
- The header "+ Workout" or "Resume" pill stays on Home and Workout.
- With the social flag, Home shows a bell left of the pill (see Notifications). No tab shows a badge (10 Oct 2026).

### Links

`navHref` in shared (`nav-targets.ts`) decides each target from the stack the link is in, so no screen hard-codes a tab path:

| Link | Goes to |
|---|---|
| Week card tap (`(home)/index.tsx`) | Profile's History |
| Last workout card (`(home)/index.tsx`) | Profile's workout detail |
| History rows (`components/history/workout-row.tsx`) | the detail in the stack the row is in |
| Profile's exercise links (`(tabs)/profile/index.tsx`) | Profile's own exercise route; elsewhere, Workout's |
| Routines (from Home, Workout and Profile) | Workout's program browser |
| Exercises row (`(tabs)/train/index.tsx`) | Workout's exercise library |
| Feed card, inbox (`person`, `friendWorkout`, `inbox`) | Home's own stack; from Followers and Following, Profile's |

## Home

Every user gets this Home; the feed is the only part behind the flag.

- **Until a routine is saved**, Home keeps today's top: Start new workout, the setup checklist and the starter routines. Then the week card, last workout card and feed.
- **Once a routine exists**, top to bottom:
  1. Next up
  2. Workouts this week card (unchanged)
  3. Last workout card
  4. Following feed
- Saved routines and the program browser live in the Workout tab, not on Home.
- With nobody followed yet, the feed area is one card: "Train with friends" and an Invite button. Waiting follow requests are in the bell's inbox, not on Home.

## Invites and follow requests

- Each user has one invite code, created on first use. Regenerating it invalidates the old link.
- Invite opens the share sheet with a link to `https://liftcamp.app/i/<code>`.
- That page shows the inviter's username (from `invite_landing`, the one social function anon may call; "You've been invited" when the inviter does not have social on), the **invite code in large type** (for the Enter invite code fallback after an App Store install, which loses the link), an Open in LiftCamp button using `liftcamp://invite/<code>`, and an **iOS App Store link** (a placeholder until approval). No Play Store link in v0. Universal links need associated domains, a native change, so they wait for the next store build.
- Opening an invite in the app:
  - **Without the flag:** a short "Friends are coming soon" screen. Nothing is sent. The invite screen asks the server (`social_access`) when it opens, not the launch latch, because a guest who links on the way there keeps the same user id with nothing latched for this run (9 Oct 2026).
  - **As a guest:** the create-account sheet first.
  - **With the flag:** the inviter's username, one Follow button, and a "Let them follow you too" checkbox under it, checked by default. Checked, one tap sends both requests below; unchecked, only Follow. A Close button at the top on every state (9 Oct 2026).
    - **Follow** sends a request to the inviter, who approves it.
    - **Let them follow you** sends the inviter a request in the other direction: the inviter follows you once they accept. You started it, so it is the inviter who approves. In practice most people tap both.
    - A tap that meets a pending request the inviter already sent in the same direction approves it on the spot (`open_follow`, 9 Oct 2026).
- **The code survives the trip.** A deep link that lands during onboarding, sign-in or guest linking is saved on the device (`liftcamp:pending-invite`) and opened once the user reaches Home signed in. It expires after 7 days and is cleared once acted on.
- The person receiving a request approves or declines it in the inbox behind Home's bell, or in Profile, Followers, under Requests. The bell's dot shows while anything in the inbox is new.
- Approving shows a **Follow back** button when you don't already follow or have requested them.
- Decline is silent. The request stays pending on the sender's side, then disappears after 30 days.
- A sender can withdraw a request. The follow button reads Follow, Requested or Following.
- Fallback: Profile, Following, Enter invite code. Following also has Invite a friend and Reset invite link (with a confirm).
- The share sheet's message carries the link in its text, because Android drops `url`. iOS also gets the link as `url`, for a link preview.
- Guests cannot follow or be followed.
- An invite link can be forwarded or posted, which is why every follow needs approval even when it came from your own link.

## Followers and following

- Profile shows Followers and Following counts. Each opens a list.
- Following rows have a ⋯ menu with Unfollow, Block and Report. Report arrives with social-safety; until then the menus hold Unfollow or Remove follower, and Block.
- Settings, Blocked lists blocked people with Unblock. The row shows with the social flag only.
- Follower rows have a ⋯ menu with Remove follower, Block and Report. Removing a follower is silent and doesn't block a new request.

## Feed

- Finished workouts from people you follow, last 14 days, newest first, on Home under the last workout card. Your own workouts are not in the feed.
- Paged with `social_feed`, 20 at a time, on `(finished_at, id)`. A Show more button at the end loads the next page.
- Read on each focus of Home and each return to the foreground. A failed read keeps what is held; with nothing held, nothing draws.
- Discarded workouts and workouts with zero completed sets never appear.

### The card

Three parts, top to bottom (`components/social/feed-card.tsx`):

1. **Header**, which never scrolls sideways: initials avatar, username, time ago ("5m", "3h", "Yesterday", "Tue", "Oct 2"), the workout name, the workout note as subcopy cut at two lines with an ellipsis (left out when empty), then Time and Volume.
2. **Body**: the workout summary, the first 5 exercises with their completed set counts and "and 3 more" past that. A gold PR ribbon marks each exercise that held a PR, by the same rule as the summary screen.
3. **Action row**: a thumbs up and the kudos count, no label, no outline.

Taps: the avatar or username opens the person, the thumb gives or takes back kudos and nothing else, anywhere else opens the workout.

Built later, with no change to the layout:

- **Photos**: the body becomes a swipeable carousel, photos then the summary, with dots under it. The 5-exercise cap keeps the summary's height bounded for a carousel page.
- **Comments**: a comment button joins the thumb in the action row, and comments go under the row.

### Volume and PRs

**Volume is shown to people who follow you** (10 Oct 2026). Volume and PRs both depend on what only the owner has: volume scores a bodyweight exercise with the owner's bodyweight, and a PR is measured against the owner's prior bests. So the owner's phone works them out at finish (`finishStats` in shared) and writes them to the workout:

- `workouts.volume` and `volume_unit`: the summary's volume, bodyweight included, in the owner's unit. Each viewer sees it converted to their own unit.
- `workouts.pr_count` (PR sets) and `pr_exercise_ids` (the `workout_exercises` rows with a PR set).
- A queued write of its own after the finish, so a server without the columns refuses only that write, never the finish.
- PRs are written as unknown (null) when any exercise's prior best never arrived (a start with no signal that stayed offline). The card then shows no ribbons.
- No backfill. Workouts finished before this show no Volume and no ribbons.

### The workout note

- Written from the note row on the workout screen and the summary (`components/workout/workout-note.tsx`, main's since the feed commit), capped at 500 characters, saved through the offline queue.
- Friends see a note only on workouts made in the app (`platform` `ios` or `android`). Notes from the web era were written as private and stay private.

## Read-only workout

Tapping a card opens their workout read-only: the same screen as your own without Repeat and Save routine. It shows who and when, the note in full, Time, Volume and Sets, the kudos thumb, and each exercise with its sets in your unit, weight left and reps right. The PR ribbon sits on the exercise, from `pr_exercise_ids`; there are no per-set ribbons, since a friend cannot see the history a set is measured against.

## Avatars

Other people are shown with initials from their username only. Profile photos are out of v0, and nothing of another person's `auth.users` metadata is read. Your own avatar is unchanged (Google photo when there is one).

## Kudos

- Any approved follower can give kudos on a workout they can see. One per person per workout. Tapping again removes it (decided 10 Oct 2026), and it leaves the owner's inbox.
- You cannot give kudos to your own workout.
- Your last workout card shows the kudos count; your workout detail shows who gave them.
- New kudos show in the notifications inbox. The unseen-kudos dot on the last workout card was dropped for the bell (10 Oct 2026).

## Profile screen and streak comparison

- Tapping a person (a feed card's avatar or username, an inbox row, a Followers or Following row) pushes their profile screen in the stack the tap was in: Home or Profile (10 Oct 2026; it was a sheet in the draft, but it pushes their workouts and comes back).
- With an accepted follow: their username, where the two of you stand, your week streak beside theirs (this week against each target, current and longest, from `weekCardState` in shared, theirs from `social_streak`: dates and weekly target only), then their finished workouts, any age, 10 at a time, as feed cards.
- Anyone you are connected to but cannot view (a pending request, or they follow you and you do not follow them) shows the username, Follow back where it applies, and the ⋯ menu. Anyone else, or a block either way, shows only "This profile is not available."
- No challenge setup, invites or winners in v0. The comparison is the challenge.

## Notifications

A bell on Home, a plain icon left of the "+ Workout" or "Resume" pill, for social users only. It opens an inbox (`(home)/inbox`):

- **Requests** at the top, newest first: follow requests waiting on you, with Approve and Decline inline. Decline is silent. An approved request stays in place with Follow back while that applies.
- **Activity**, newest first, last 30 days: kudos on your workouts, one row per workout timed by its newest kudos ("@will and 2 others gave kudos on Push Day"), and requests you started that were accepted, timed by `follows.accepted_at`, which `respond_follow` and `open_follow` set at approval.
- Built from existing data: `list_follows` (already held for Profile) and `social_kudos_inbox`. No notifications table, no push.
- **The dot** shows while anything in the inbox is newer than this device last saw. Opening or leaving the inbox marks it seen. A request stays at the top until answered but does not keep the dot lit. Last seen is stored on the device (`liftcamp:inbox-seen:<userId>`), so a second phone shows the dot again.
- The bell replaces the Profile tab badge and Home's requests line. Profile, Followers keeps its Requests section.

## Safety

Required for Apple guideline 1.2 once other users can see your content.

- **Report:** in the ⋯ menu on a profile screen, a list row and a feed workout. Reasons: Inappropriate, Harassment, Spam, Other.
- **Reports cover workout notes.** A report on a feed workout covers its note as well as its name, and the admin queue shows the note with the report so it can be judged without opening the account.
- **Block:** removes follows in both directions, cancels pending requests, hides both users from each other everywhere, and stops future requests between them. Unblock from Profile, Settings, Blocked.
- **Admin queue** in /admin: open reports with reporter, target, reason and date. Actions: dismiss, remove the follow, disable the target's social access (a per-user revoke).
- **Email to Alan** on each new report, so reports are handled within 24 hours: a database trigger on `reports` calls an Edge Function through `pg_net`, which sends through Resend.
- **Content rule** added to the terms: no harassment, hate or sexual content. Workouts and usernames that break it are removed and the account can lose social access. It goes on its own small branch off main (the held `terms-subscriptions` branch also edits the terms).
- Usernames, workout names and workout notes are the user text other people see in v0. A workout note is returned to approved followers only on workouts made in the app (10 Oct 2026); set notes are never returned to anyone but their owner.

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

New columns on `workouts`, all nullable, written by the owner's phone at finish: `pr_count` (4 Oct 2026), and `volume`, `volume_unit` and `pr_exercise_ids` (`supabase/migrations/20261010120000_social_feed.sql`, 10 Oct 2026).

social-feed replaces `social_feed` (adds the note, volume, the per-exercise list, a `(finished_at, id)` cursor and `p_user` for one person's workouts), adds the note, volume and per-exercise PR flags to `social_workout`, and adds `social_kudos_inbox` for the inbox.

Rules for every new table:

- **Foreign keys** to `auth.users` with `ON DELETE CASCADE`, so account deletion needs no change to the `delete-account` function. The exception is `reports`: `reporter_id` and `target_user_id` are `ON DELETE SET NULL`, so a report stays in the queue when either side deletes their account. `kudos.workout_id` cascades from `workouts`; `reports.target_workout_id` is set null.
- **Guest merge:** `merge_guest_account` refuses a guest holding a row in any of them. Its leftover check reads the foreign keys to `auth.users` live, so each new table is covered without a change to the function, and guests can never hold a row anyway.
- **RLS on, anonymous users refused.** No client writes any of these tables directly; every write goes through a `SECURITY DEFINER` function that checks the caller is signed up, has social on, and is not blocked.
- **Reads of another person's data** go through `SECURITY DEFINER` functions gated on an accepted follow with no block either way: the feed, a workout's read-only detail, the profile screen, the streak read (dates and weekly target only), and kudos givers. The `workouts`, `sets` and `user_profiles` RLS stays owner-only.
- Grants are explicit. No `GRANT ALL`. Every new function revokes EXECUTE from `PUBLIC` and `anon`.

## Launch checklist

- App Store Connect privacy labels: review once other people can see your workouts and username (likely "Other User Content" and "Fitness" as linked, not tracking). The privacy manifest in `app.json` is not expected to change.
- iOS App Store link on the /i page, replacing the placeholder.
- The global switch on (`app_flags`), and the per-user grants left as they are.
- Decide whether onboarding offers Enter invite code. Today it is only on Profile, Following, so someone who installs from the App Store and loses the link has to find it there (deferred 9 Oct 2026).
- The content rule live in the terms.

## Build order

Each its own branch and worktree, commit and push, Alan merges.

0. **The username-fix branch merges before any social branch**: name-based default usernames, no relay-address usernames. Other people will see usernames. The content-rule branch can go any time before launch.
1. `social-schema`: SQL for review, then the shared logic with vitest (flag state and cache, follow states, block effects, kudos toggling, feed filtering, invite codes).
2. `nav-three-tabs`: the three-tab navigation for every user, the flag cache and launch latch, and the feed slot on Home behind the flag.
3. `social-follows`: invites, the pending-invite handoff, the /i page on web, requests, followers and following lists, block, remove and unfollow.
4. `social-feed`: volume and PRs at finish, the workout note, the feed on Home, the profile screen, read-only workout detail, kudos, the notifications inbox.
5. `social-safety`: report, admin queue, the report trigger and its Edge Function.

The schema and follows branches must exist before the flag goes to Will.
