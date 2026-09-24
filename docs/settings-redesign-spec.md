# LiftCamp mobile: Settings redesign, birthday, "Other", profile photo

Branch `settings-redesign`, off `strength-level` (not yet merged). Never
merged by the session that built it.

DATABASE RULE: read-only queries only. Alan runs
`docs/settings-redesign.sql` himself before this is built. It adds
`user_profiles.birthday` (date) and changes the sex options to `male`,
`female`, `other`. `birth_year` stays in the table for now; stop reading
and writing it on this branch.

Stage files by explicit path. Never `git add -A` or `git add .`.

## Read first

- `apps/mobile/src/app/settings.tsx`
- `apps/mobile/src/app/(tabs)/profile.tsx`
- `apps/mobile/src/components/settings-ui.tsx`
- `apps/mobile/src/components/username-sheet.tsx`
- `apps/mobile/src/components/exercises/strength-level-section.tsx`
- `packages/shared/src/strength-standards.ts`
- `apps/mobile/src/data/home.ts` (`getBodyProfile` and the setters)
- `apps/web/src/routes/profile.tsx` lines 195 to 215 (how the web app
  finds the avatar and initials)
- `apps/mobile/package.json`

## REPORT FIRST

Stop and report before building if:

1. The date wheel below needs a native module that is not in the current
   dev build. `@expo/ui` is in package.json but nothing imports it yet, so
   check whether it was installed before the last EAS dev build. If it
   was not, say so and propose the smallest option (a rebuild, or a JS
   wheel) instead of guessing.
2. A natively signed-in Google user on mobile has no `avatar_url` or
   `picture` in `user_metadata`. Check Alan's own account read-only.

## Why

The first Settings build is correct but busy: every field shows all its
options at once. Alan wants the pattern Hevy uses. Each field is one row
with its label on the left and its current value on the right in the
accent colour. Tapping the value opens a picker. No visible "Edit"
buttons, no rows of chips.

## Layout

Grouped list rows, full width, flat list rows per the elevation rule (no
shadow), hairline separators between rows in a group, section labels in
the existing `type.label` style. Each row is 52 pt tall with the label in
`c.text` on the left and the value in `c.accentText` on the right. An
empty value reads "Add" in the accent colour. The whole row is the tap
target.

### Top: photo and name

A 72 pt circular photo centred at the top of Settings, with the display
name under it (the username, "@lifter86101"). Photo source, in order:

1. `user_metadata.avatar_url`, then `user_metadata.picture` (Google).
2. Initials in a tinted circle, from `full_name` or `name`, else the
   username's first letter. Apple and email accounts land here: Sign in
   with Apple does not share a photo.

Use `expo-image`. Uploading a photo is out of scope.

The Profile tab shows the same photo at 40 pt next to the "Profile" title,
left of the gear.

### About you

| Row | Value shown | Tap opens |
|---|---|---|
| Sex | Male, Female, Other, or Add | Native action sheet with Male, Female, Other, Cancel |
| Birthday | "Nov 10, 1983" or Add | Bottom sheet titled "Birthday" with an iOS wheel date picker and a Done button |
| Bodyweight | "200 lbs" or Add | The existing bodyweight sheet |

Birthday picker: month, day, year wheels. Latest selectable date is
today minus 13 years; earliest 1920-01-01. Opens on the saved date, or on
Jan 1 of (current year minus 30) when empty. Saves on Done.

One footer line under the group, muted meta style: "Private. Used for
your strength level."

### Preferences

| Row | Value shown | Tap opens |
|---|---|---|
| Weight unit | lbs or kg | Action sheet: lbs, kg, Cancel |
| Appearance | Light, Dark or Auto | Action sheet: Light, Dark, Auto, Cancel |

### Account

| Row | Value shown | Tap opens |
|---|---|---|
| Username | @handle | The existing username sheet |
| Signed in with | Apple, Google or the email | Nothing (not tappable, value in `c.text2`) |

Anonymous users get, in place of "Signed in with", the existing
one-sentence explanation and the "Save your workouts" button.

Then a single centred row "Sign out" in `c.danger`, not inside a bordered
button.

### Developer

Unchanged, dev builds only, at the bottom.

## Data

- `getBodyProfile` returns `birthday` (ISO date string or null) instead
  of `birthYear`. `setBirthday(userId, isoDate)` replaces `setBirthYear`.
- Sex type becomes `'male' | 'female' | 'other' | null`.
- Age for the strength level is whole years from `birthday` to today.
  No birthday means the 18 to 39 factor, as before.

## Strength level

- `strengthThresholds` returns null for `other`, the same as it did for
  `unspecified`.
- The muted line for that state becomes: "Strength levels use male and
  female lifting data, so they don't show for Other." with the
  "Change in Settings" text button.
- Update the tests that used `unspecified`.

## Copy

No em dashes and no colons in app copy.

## Verify

1. Settings shows the photo (Google account) or initials (Apple, email,
   guest), then About you, Preferences, Account.
2. Every row shows its value in the accent colour, or "Add".
3. Sex: pick Other; Barbell Squat shows the "don't show for Other" line.
   Pick Male; the level returns.
4. Birthday: the wheel cannot go later than 13 years ago. Save, force
   quit, reopen: it persists and reads like "Nov 10, 1983".
5. Weight unit and Appearance switch through their action sheets, with
   the same behaviour as before.
6. Profile tab shows the small photo next to the title.
7. Shared tests pass; mobile typechecks.
