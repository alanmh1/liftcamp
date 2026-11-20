# Profile photos from Google sign-in

Branch `profile-photos`, worktree `~/code/liftcamp-profile-photos`. Mobile, web and the `moderate-text` Edge Function. Mobile stays OTA-eligible. Decided 20 Nov 2026.

Today everyone in social shows as initials. Google sign-ups already hand us a profile photo; this shows it to the people they're connected with. Custom photo uploads come later, on the Phase 3 photo pipeline.

## Decisions

- **On by default.** A Google photo shows automatically. Settings gets a switch to hide it.
- **Apple and email-only accounts keep initials.** Apple never shares a photo. An email account with Google linked does carry one and gets it.
- **Checked before anyone sees it.** Each photo goes through OpenAI's moderation model (image input, same `omni-moderation-latest`, free) and only shows once it passes. A flagged photo stays hidden and files an Auto-flag report.
- **Only your connections see it:** people you follow, who follow you, or with a pending request either way, minus blocks. Both sides need social on.
- **Admins can remove one** from the Reports queue. A later sign-in doesn't bring it back.

## Database (`docs/profile-photos.sql`, run by Alan)

Already written. What the app and web code can rely on:

- `user_profiles` gains `avatar_url`, `avatar_status` (`pending` / `ok` / `flagged`), `avatar_hidden` (boolean, default false) and `avatar_removed_at`.
- The app can write `avatar_hidden` on its own row (owner RLS). A trigger keeps app writes from changing `avatar_url`, `avatar_status` or `avatar_removed_at`.
- A trigger on `auth.users` copies the sign-in photo into `avatar_url` on every sign-in, sets it `pending`, and calls `private.post_moderation('avatars', user_id)` when it changed. New `user_profiles` rows get the same.
- `public.social_avatars(p_ids uuid[]) returns table(user_id uuid, avatar_url text)`: the photos the caller may see, up to 200 ids per call. Missing id = show initials.
- `public.admin_user_avatar(p_user uuid)`: admin only; the photo, its status, hidden and removed.
- `admin_resolve_report(p_id, p_action)` accepts `remove_photo`. Dismissing an auto-flag report whose `detail.field` is `avatar` marks that photo `ok`.
- One open auto-flag report per photo (unique index on `target_user_id`, `detail->>'avatar_url'` where `detail->>'field' = 'avatar'`).

## Edge Function `moderate-text`

`supabase/functions/moderate-text/index.ts` today takes `{ table: 'workouts' | 'user_profiles', id }`. Add `table: 'avatars'`, with `id` = the user id:

1. Read `user_profiles.user_id, avatar_url, avatar_status` with the service role. Skip (200) when there's no `avatar_url` or the status isn't `pending`.
2. Call `https://api.openai.com/v1/moderations` with `model: "omni-moderation-latest"` and `input: [{ "type": "image_url", "image_url": { "url": avatar_url } }]`. Reuse the existing verdict parsing (flagged plus category names).
3. On an OpenAI error, log `openai_failed` and return 502. The photo stays `pending` (hidden) and is re-checked on the next sign-in, or by the re-check line in Section 7 of the SQL.
4. Not flagged: set `avatar_status = 'ok'`, but only where `avatar_url` still equals the URL that was checked and the status is still `pending`, so a newer photo isn't marked by an old check.
5. Flagged: set `avatar_status = 'flagged'` the same way, then file a report unless an open one exists for this photo: `reporter_id` null, `target_user_id` the user, `reason` `auto_flag`, `detail { field: 'avatar', avatar_url, categories }`. Treat 23505 on insert as already reported, as the other two tables do.
6. Log `checked` with table, id, flagged, categories and reported, like the others.
7. Not gated on social: every Google photo is checked, since it's free and someone may turn social on later.

Update the header comment's numbered steps to cover avatars. The function is deployed through the Supabase MCP connector after the branch is pushed (the Supabase CLI isn't installed on Alan's Mac), so don't try to deploy it.

## Mobile

### Data
- `data/social.ts`: `getAvatars(ids: string[])` calls `social_avatars` and returns a `Map<userId, url>`. Keep a session cache (about 10 minutes) keyed by user id, including misses, so scrolling the feed doesn't refetch. Batch the ids a screen needs into one call. Dedupe in-flight requests.
- A hook, e.g. `useAvatars(ids)`, that returns the map and re-renders when it fills in.
- Google URLs end with a size suffix like `=s96-c`. Ask for `=s200-c` so the 36 to 80px circles stay sharp on 3x screens. Leave any other URL alone.

### Where photos show
Everywhere social shows another person's initials today. Find every `InitialsAvatar` and every place a username sits in a circle; at least:
- feed cards
- the friend workout header
- the social profile screen header
- Following and Followers rows
- the bell inbox (requests and kudos)
- the invite and request screens where a person is shown

Use one component for all of them (extend `components/avatar.tsx` or `InitialsAvatar` to take an optional `url`), with initials while loading, when there's no photo, and if the image fails to load. `expo-image` with a short fade, the same as the existing `Avatar`. No layout shift between initials and photo.

Your own photo on your Profile tab keeps coming from your sign-in data, as today.

### Settings
In the social section of Settings (shown only with the social flag), when the account has a Google photo (`avatarUrl(user_metadata)` is non-null):
- Row: "Show my Google photo" with a switch, on by default (`avatar_hidden = false`).
- Under it, muted: "Friends see your Google profile photo. Turn this off to show your initials."
- Writes `user_profiles.avatar_hidden`. Optimistic, with an alert and revert if the write fails.
- Flipping it clears the avatar cache for your own id.

No row for Apple or email-only accounts.

## Web

### /admin Reports queue
- For any report with a `target_user_id`, show the person's photo (from `admin_user_avatar`) as a 48px circle next to their name, with its status in small text when it isn't `ok` ("pending", "flagged", "hidden by user", "removed").
- An auto-flag report with `detail.field = 'avatar'` shows the flagged photo (`detail.avatar_url`) larger (120px), with its categories, labelled "Auto-flag: profile photo".
- Add a **Remove photo** action next to the existing ones, calling `admin_resolve_report(id, 'remove_photo')`. Show it only when the target has a photo.

### /privacy
In the Friends section, add a short paragraph: if you sign in with Google, your Google profile photo is shown to people you follow and people who follow you. You can turn it off in Settings. Photos are checked by OpenAI's moderation service before they're shown (OpenAI is already listed as a processor). No colons in the copy; no em dashes.

## Order
1. Alan runs Sections 1 to 6 of `docs/profile-photos.sql`.
2. Claude Code builds the branch (mobile, web, Edge Function code) and pushes.
3. The Edge Function is deployed through the connector.
4. Alan runs Section 7 (backfill and check).
5. Simulator test, merge, OTA (two-step: Android, then iOS with the old eas.json), Vercel deploys web on merge.

## Out of scope
- Custom photo uploads (Phase 3 pipeline).
- Photos on the invite landing page before you're connected.
- Showing photos on the summary share cards.
