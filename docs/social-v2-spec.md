# Social v2: comments and photos

Status: draft, 19 Nov 2026. Follows docs/social-v1-spec.md (feed and safety). v1, comments and photos ship together in one store submission, so App Review sees all of social at once (guideline 2.5.19 forbids dormant, undocumented features). Testers can get each piece earlier by OTA behind the `social` flag, except photos, which need the store build.

## Decisions (19 Nov 2026)

- **Comments:** approved followers and the workout's owner can comment. Delete only, no edit. The author or the workout's owner can delete a comment. 500 characters, 30 an hour.
- **Photos:** one per workout. Every photo is hidden until moderation approves it. Shown to the same audience as the workout.
- **Storage:** Supabase Storage, a private bucket. Stay on the free plan until usage nears the limit (about 700 MB of headroom).
- **Moderation:** OpenAI's moderation endpoint checks comments the same way it checks names and notes, and photos for sexual, violent and self-harm content. The OpenAI CSAM classifier is gated, so apply now. Until it's approved, the function runs without it and the rest of the checks still apply.

## Database

Run after docs/social-safety.sql, in this order. Both files were applied to the live database in one transaction on 19 Nov 2026, tested as three fake users, then rolled back.

### docs/social-comments.sql

- `workout_comments`. No client grants; everything goes through functions.
- `add_comment(p_workout, p_body)` returns the id. Refuses blocklisted text with `23514` ("Keep it friendly. That comment has words we don't allow."), the rate limit with `54000`, and a workout the caller can't see with `42501`.
- `delete_comment(p_comment)` returns true when it deleted. Works for the author or the workout's owner, even with social revoked.
- `workout_comments(p_workout)`: `id, user_id, username, body, created_at, mine, can_delete`. Oldest first, up to 200. Hidden comments, flagged comments (except to their author), and comments by anyone blocked by the viewer or the owner are left out.
- `social_comment_inbox(p_limit)`: comments others left on your workouts in the last 30 days, for the bell.
- `comment_count` on `social_feed` rows and in `social_workout`.
- `file_comment_report(p_comment, p_reason)`, the same four reasons, sharing `file_report`'s 10-a-day limit.
- The moderation hook posts new comments to `moderate-text`.
- Admin: the queue shows `comment_id`, `comment_body`, `comment_hidden`. New action `hide_comment`. Dismissing an `auto_flag` on a comment clears its flag.

### docs/social-photos.sql

- Bucket `workout-photos`: private, `image/jpeg` only, 3 MB max. Paths are `<user_id>/<workout_id>/<random>.jpg`.
- `workout_photos`, one row per workout: `storage_path, width, height, status (pending | approved | rejected | quarantined), sha256, moderation_detail, moderated_at, hidden_at`.
- **Upload flow:**
  1. `begin_workout_photo(p_workout)` returns a path. Own finished workout only, 20 a day.
  2. The app uploads the JPEG to that path (`upsert: false`).
  3. `commit_workout_photo(p_workout, p_path, p_width, p_height)` records it as `pending` and returns the replaced photo's path (or null). The app deletes that old file.
  4. `remove_workout_photo(p_workout)` deletes the row and returns the path. The app deletes the file.
  5. `my_workout_photo(p_workout)`: `path, width, height, status` for the owner. Quarantined photos come back as `rejected` with no path.
- **Storage policies:** upload only to a path from `begin_workout_photo` within the hour. Read your own photos, approved photos of workouts you can see, or anything if admin. Delete only your own files that no row points at and that aren't evidence.
- **Moderation:** a trigger posts pending photos to `moderate-text`. `photo_hash_blocked(sha)` (service role) says whether an image is a copy of one already removed.
- **Evidence:** a photo that goes `quarantined` is copied to `private.photo_evidence` and is never deleted by the app, the sweep or account deletion.
- **Feed:** `photo_path, photo_width, photo_height` on `social_feed` (approved, unhidden only), and `photo` in `social_workout`.
- **Reports:** new reason `intimate_image` on `file_report`. Its email subject is URGENT with the 48-hour deadline. The queue sorts these first and shows `photo_path` and `photo_status`. New action `remove_photo` hides the photo and blocks identical copies by hash. Dismissing an `auto_flag` on a photo approves it.
- **Takedown requests** (web form, no account): `submit_takedown_request(p_kind, p_name, p_email, p_target, p_details, p_signature, p_statements)` callable by anon. `kind` is `intimate_image`, `copyright` or `other`. `p_statements` is a JSON object of checkbox keys, each kind with its required set:
  - `intimate_image`: `depicted_or_authorized`, `not_consented`, `good_faith`
  - `copyright`: `good_faith`, `accurate_under_penalty`, `owner_or_authorized`
  - `other`: `good_faith`
  - Five per email a day, 30 in all an hour. `intimate_image` gets `due_at` 48 hours out. Each request emails hello@liftcamp.app at once, with Reply-To set to the requester.
- **Admin:** `admin_list_takedowns(p_status)`, `admin_resolve_takedown(p_id, p_status, p_note)`, `admin_user_content(p_username)` (everything a user shares, for acting on a takedown), `admin_remove_photo(p_workout, p_reason)`, `admin_set_comment_hidden(p_comment, p_hidden)`.
- **Sweep:** `photo_orphans(p_limit)` (service role) lists files older than a day that nothing keeps. A pg_cron job posts to the `sweep-photos` function every Sunday at 03:23 PT.

## Edge Functions

### moderate-text (extend)

Rename nothing; the triggers already call it. Add two tables to what v1 handles:

- **workout_comments:** read the comment with the service role. Moderate the body. Flagged: set `moderation_flagged_at` (keep an earlier value), set `moderated_at`, and file an `auto_flag` report with `target_comment_id`, `target_workout_id`, `target_user_id` and `detail { field: 'comment', categories }`, unless an open one already exists for that comment. Not flagged: set `moderated_at`.
- **workout_photos** (the body's `id` is the workout id):
  1. Read the row. Stop if it's gone or no longer `pending`. Remember `storage_path`.
  2. Download the file with the service role. Compute SHA-256 (hex, lowercase).
  3. `photo_hash_blocked(sha)` true: set `status 'rejected'`, `sha256`, `moderated_at`, `moderation_detail { blocked_copy: true }`, and file an `auto_flag` report with `detail { field: 'photo', blocked_copy: true }`.
  4. Otherwise call `omni-moderation-latest` with the image as a base64 `data:image/jpeg` URL. Flagged: `status 'rejected'` and an `auto_flag` report with `detail { field: 'photo', categories }`.
  5. If `OPENAI_CSAM_ENABLED` is `true`, also call `omni-moderation-csam-latest` (check OpenAI's CSAM classifier docs for the request and result shape). A positive result: `status 'quarantined'`, and an `auto_flag` report with `detail { field: 'photo', csam: true }`, which sends the URGENT email. Never delete or move the file.
  6. Nothing flagged: `status 'approved'`.
  7. Every write is conditional on `storage_path` still matching the one read in step 1, so a photo replaced mid-check is left for its own check.
- New secret `OPENAI_CSAM_ENABLED` (unset until OpenAI approves the application).

### sweep-photos (new)

`supabase/functions/sweep-photos/index.ts`, `verify_jwt = false`, same `x-moderation-secret` check. Calls `photo_orphans(500)` and deletes those paths from `workout-photos` with the service role, in batches of 100. Logs the count. Never deletes anything else.

### delete-account (extend)

After `auth.admin.deleteUser` (the cascade removes the user's photo rows, and evidence paths stay in `private.photo_evidence`), list every file under `workout-photos/<user_id>/` and delete the ones not in `photo_paths_to_keep()`. A failure is logged and the delete still succeeds; the weekly sweep picks up anything left.

## Mobile

### Branch 3: social-comments (on social-safety, OTA-eligible)

- **Card and detail:** a speech bubble with the count next to kudos on feed cards and the read-only friend workout. On your own workout detail and last workout card, the count and a Comments row.
- **Comments screen:** a pushed route in the Home and Profile stacks, like `friend-workout/[id]`. The workout name at the top, comments oldest first (avatar initials, @username, time ago, body), and a composer pinned above the keyboard with a 500-character limit and a send button. Uses the existing keyboard helper (`lib/use-keyboard.ts`).
- **Errors:** `23514` shows "Keep it friendly. That comment has words we don't allow." inline and keeps the text. `54000` shows "You're commenting a lot. Try again in a bit."
- **⋯ on a comment:** someone else's comment gets Report (the report sheet with `file_comment_report`) and Block. Your own, or any comment on your workout, gets Delete with a confirm.
- **Community rules gate:** the first comment counts as a first social action.
- **Bell:** comments join the inbox from `social_comment_inbox`, as "@will commented: Nice PR" with the workout name, opening the comments screen.

### Branch 4: social-photos (on social-comments, native, store build)

- **Dependencies:** `expo-image-picker` and `expo-image-manipulator`. `app.json` adds `NSPhotoLibraryUsageDescription` ("Add a photo to a workout you share with friends.") and `NSCameraUsageDescription` ("Take a photo for a workout you share with friends."). The existing `NSPhotoLibraryAddUsageDescription` stays. This changes the native runtime, so it ships only in the store build.
- **Who can add one:** signed-up users with social on, to their own finished workouts. Guests and users without social never see the option.
- **Adding:** an "Add photo" row on the post-workout summary and in the workout detail ⋯ menu (Add photo, Replace photo, Remove photo). An action sheet offers Take photo or Choose from library. The picker uses `exif: false` and no editing.
- **Before upload:** resize so the long edge is at most 1600 px and re-encode as JPEG at quality 0.8 with `expo-image-manipulator`. Re-encoding drops EXIF, including location. If the result is still over 3 MB, retry at 0.6, then fail with "That photo is too big."
- **Upload:** `begin_workout_photo`, upload with `supabase.storage.from('workout-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: false })`, then `commit_workout_photo`. Delete the returned old path. On any failure after the upload, delete the uploaded file. Online only, not through the offline queue: a photo waits for signal with a clear "Try again when you're online."
- **Status on your own workout:** pending shows the photo with a "Checking photo…" label. Rejected shows "This photo can't be shared" and a Remove button. Approved shows nothing extra. Poll `my_workout_photo` every 3 seconds for up to 30 seconds after upload, then on focus.
- **Showing photos:** the feed card becomes the 9 Oct carousel when there's a photo: the photo first, the summary second, dots below. A 4:5 crop on the card, full image on tap. The read-only friend workout shows the photo at the top. Get signed URLs in one batch per feed page with `createSignedUrls(paths, 3600)` and render with `expo-image` using the storage path as the `cacheKey`, so a refreshed URL doesn't re-download.
- **Report sheet:** on a workout with a photo, a fifth reason, "Intimate photo of me shared without consent", sends `intimate_image`. The thank-you text for it reads "We'll review this right away and remove it within 48 hours."
- **Deleting a workout:** call `remove_workout_photo` and delete the file before deleting the workout. The sweep catches anything missed.

## Web

**/report-content** (Highland styling, the shared page glow, linked from the footer, the terms and the privacy policy)

- A form for anyone, with no account needed. Kind as radio buttons: "An intimate image of me shared without my consent", "Content that uses my copyrighted work", "Something else".
- Fields: your name, your email, where the content is (a username or a description), details, and a typed signature.
- The checkboxes per kind match the `p_statements` keys above, worded in plain English. Copyright uses the DMCA language (good faith belief that use isn't authorized; the information is accurate and, under penalty of perjury, I'm the owner or authorized to act for them).
- Calls `submit_takedown_request` with the anon key. Success: "We got your request. Intimate images are removed within 48 hours. We'll reply to you by email."
- Turnstile is optional. The SQL rate limits already apply.

**/copyright**

- The copyright policy: how to send a DMCA notice (the form, or email to the designated agent), what a notice must contain, the counter-notice process, and that repeat infringers lose their accounts. Shows the designated agent's name, address, phone and email exactly as registered with the Copyright Office.

**Terms** (`routes/terms.tsx`)

- Community rules (from v1) gains photos and comments: no nudity or sexual images, no images of other people without their consent, nothing you don't have the rights to.
- A content license: you keep ownership; you give LiftCamp permission to store and show what you share to the people you share it with.
- A repeat-infringer clause and a link to /copyright. Age stays at 13 or older.

**Privacy** (`routes/privacy.tsx`)

- Photos: stored privately, shown only to approved followers, location data removed before upload, checked by OpenAI's moderation service, deleted with the workout or account (except material the law requires us to keep).
- Comments: who sees them.

**/admin**

- Reports section: photo thumbnails through a signed URL (admins can read any photo), comment bodies, the `remove_photo` and `hide_comment` actions, and `intimate_image` reports pinned first with a countdown to 48 hours.
- **Takedowns section:** open requests with a countdown on `due_at`, all fields, and actions Mark actioned or Reject with a note. Includes a "Find content" box that calls `admin_user_content` and lists that user's workouts with photo thumbnails, names, notes and comments, each with Hide, Remove photo or Hide comment.

## Legal and operations (Alan)

I'm not a lawyer. Check these with one before launch.

- **DMCA designated agent:** register at dmca.copyright.gov ($6, renew every 3 years; a lapse loses safe harbor). Put the same details on /copyright.
- **TAKE IT DOWN Act:** the /report-content form plus the 48-hour emails and the admin countdown are the process. It must be clearly linked: footer, terms, privacy, and the in-app report sheet. Removal includes known identical copies; the hash block covers exact copies.
- **CSAM:** apply for OpenAI's CSAM classifier now (openai.com/form/csam-classifier-intake). If a photo is quarantined, don't open or download it beyond what's needed to confirm it, and report it to NCMEC's CyberTipline. US providers must report apparent CSAM they become aware of. Set up the NCMEC reporting account before launch, and keep quarantined material untouched (the database already keeps it out of every delete path).
- **Response times:** reports within 24 hours, intimate-image requests within 48. The emails go to hello@liftcamp.app; make sure that inbox notifies your phone.

## Launch (one store submission)

- Run, in order: `social-safety.sql`, `social-comments.sql`, `social-photos.sql` (each with Section 0 first). Set `OPENAI_API_KEY` and `MODERATION_HOOK_SECRET`. Deploy `moderate-text`, `sweep-photos` and the updated `delete-account`.
- **App Store Connect, App Privacy:** add Photos or Videos and Other User Content (both linked to the user, used for app functionality, not tracking).
- **Age rating:** answer the user-generated content questions honestly.
- **Notes for Review:** describe social specifically (follows by approved request, feed, kudos, comments, one photo per workout, the bell). Say where Report and Block are (⋯ on any card, comment, profile or row) and that every photo is checked before anyone else can see it. Two demo accounts that follow each other, with workouts, a comment and an approved photo.
- After approval: release, then `admin_set_global_flag('social', true)`.
