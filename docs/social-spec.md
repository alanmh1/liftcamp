# Social v0 and 3-tab navigation

Status: draft, 3 Oct 2026. Nothing here is built.

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
- Photos, comments, captions
- Push notifications
- Social medals (kudos given, routine saves)
- Sending a routine to someone
- Universal links (needs a native build; see Invites)

## Flag

- Key `social`, separate from Pro. A Pro or tester grant never turns social on.
- Granted per user from /admin, same pattern as tester Pro access.
- The flag gates both the new navigation and every social surface. Users without it see today's 4-tab app, unchanged.
- At public launch the flag flips for everyone in one step.

Open: store it as a row in a new `user_flags` table (user_id, flag, granted_at, granted_by) or a column on an existing table. Claude Code to recommend after the report.

## Navigation

Three tabs: **Home, Workout, Profile.**

| Tab | Holds |
|---|---|
| Home | Next up, week card, last workout, following feed |
| Workout | Start new workout, saved routines, programs, exercise library |
| Profile | Header and stats, medals, month calendar, workout history, followers and following, settings |

- **Home keeps Next up.** Starting today's workout stays one tap from launch.
- **Workout** is the current saved routines list plus the program browser plus the Exercises tab's library, as sections on one screen. Start new workout stays as the header pill.
- **History moves into Profile.** The month calendar sits at the top of Profile's history section, with the workout list below it. Tap-to-scroll on the calendar keeps working.
- The header "+ Workout" or "Resume" pill stays on Home and Workout.
- Tab name "Workout". Alternative "Train" if Alan prefers.

Open: whether Profile shows history inline or as a "History" row that pushes the current History screen. Inline is simpler to find; a pushed screen keeps Profile short.

## Home

Top to bottom:

1. Next up
2. Workouts this week card (unchanged)
3. Last workout card
4. Following feed

Without the flag, Home ends after the last workout card.

With the flag and nobody followed yet, the feed area is one card: "Train with friends" and an Invite button. Waiting follow requests show as a line above it ("Will wants to follow you").

## Invites and follow requests

- Each user has one invite code, created on first use. Regenerating it invalidates the old link.
- Invite opens the share sheet with a link to `https://liftcamp.app/i/<code>`.
- That page shows the inviter's username and an Open in LiftCamp button using the app's custom scheme (`liftcamp://invite/<code>`), plus an App Store link. Universal links need associated domains, a native change, so they wait for the next store build.
- Opening an invite in the app shows the inviter's username with two buttons:
  - **Follow** sends a request to the inviter.
  - **Let them follow you** sends the inviter a request in the other direction, for the case where the inviter wants to see your workouts. In practice most people tap both.
- The person receiving a request approves or declines it in Profile, Followers, under Requests. A dot on the Profile tab and the line on Home show while any are waiting.
- Approving shows a **Follow back** button when you don't already follow or have requested them.
- Decline is silent. The request stays pending on the sender's side, then disappears after 30 days.
- A sender can withdraw a request. The follow button reads Follow, Requested or Following.
- Fallback: Profile, Following, Enter invite code.
- Guests cannot follow or be followed. Opening an invite as a guest prompts account creation first.
- An invite link can be forwarded or posted, which is why every follow needs approval even when it came from your own link.

## Followers and following

- Profile shows Followers and Following counts. Each opens a list.
- Following rows have a ⋯ menu with Unfollow, Block and Report.
- Follower rows have a ⋯ menu with Remove follower, Block and Report. Removing a follower is silent and doesn't block a new request.

## Feed

- Finished workouts from people you follow, last 14 days, newest first. Your own workouts are not in the feed.
- Each item: avatar, username, workout name, day and time, duration, completed sets, PR count, kudos count, kudos button.
- Tapping an item opens a read-only detail of their workout, the same screen as your own without Repeat or Save routine.
- Discarded workouts and workouts with zero completed sets never appear.
- Paged, 20 items at a time.

## Kudos

- Any approved follower can give kudos on a workout they can see. One per person per workout. Tapping again removes it.
- You cannot give kudos to your own workout.
- Your own workout detail and last workout card show the kudos count and who gave them.
- No notification in v0. An unseen-kudos dot on Home's last workout card is enough.

## Profile sheet and streak comparison

- Tapping a person (feed avatar or a list row) opens their profile sheet: username, current week streak, longest streak, this week's progress against their target, latest workout, and the ⋯ menu.
- You see this only for people you follow. Anyone else shows username and the Follow button only.
- Your streak and theirs side by side, using the existing streak logic in `packages/shared`.
- No challenge setup, invites or winners in v0. The comparison is the challenge.

## Safety

Required for Apple guideline 1.2 once other users can see your content.

- **Report:** in the ⋯ menu on a profile sheet, a list row and a feed workout. Reasons: Inappropriate, Harassment, Spam, Other.
- **Block:** removes follows in both directions, cancels pending requests, hides both users from each other everywhere, and stops future requests between them. Unblock from Profile, Settings, Blocked.
- **Admin queue** in /admin: open reports with reporter, target, reason and date. Actions: dismiss, remove the follow, disable the target's social access.
- **Email to Alan** on each new report, so reports are handled within 24 hours.
- **Content rule** added to the terms: no harassment, hate or sexual content. Workouts and usernames that break it are removed and the account can lose social access.
- Usernames are the only user text other people see in v0, so they get the same rule.

## Data

New tables, SQL written after Claude Code's report and run by Alan in the Supabase editor:

- `invite_codes` (user_id, code, created_at). One active code per user.
- `follows` (follower_id, followee_id, status pending or accepted, invite_code, created_at, accepted_at). One row per direction, unique on the pair. Declined, withdrawn and removed follows delete the row. Pending rows older than 30 days are deleted.
- `blocks` (blocker_id, blocked_id, created_at)
- `kudos` (workout_id, user_id, created_at), unique on the pair
- `reports` (id, reporter_id, target_user_id, target_workout_id, reason, status, created_at, resolved_at)
- The flag storage, per the open question above

Reads go through a function or view that returns only the feed fields, only for finished workouts, only where the reader has an accepted follow and there's no block either way. The `workouts` RLS stays owner-only.

Account deletion removes the user's rows in all of these tables.

## Build order

Each its own branch and worktree, commit and push, Alan merges.

1. `social-schema`: report first, then SQL for review, then the shared logic with vitest (follow states, block effects, kudos toggling, feed filtering).
2. `nav-three-tabs`: the new navigation behind the flag.
3. `social-follows`: invites, the /i page on web, requests, followers and following lists, block, remove and unfollow.
4. `social-feed`: feed on Home, the profile sheet, read-only workout detail, kudos.
5. `social-safety`: report, admin queue, email.

The schema and follows branches must exist before the flag goes to Will.

## Report first

Before any code, Claude Code reports:

- How Expo Router lays out the 4 tabs today, and what moving History into Profile and Exercises into Workout touches.
- Whether a `liftcamp://` custom scheme is already registered, and what it's used for.
- What /admin's tester Pro grant looks like, to reuse for the flag.
- How account deletion removes rows today.
- Whether usernames and profile photos are readable by other users today, or need a new read path.
- Which of the above changes need a native build. The goal is JS only for all of v0.
