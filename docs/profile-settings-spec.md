# LiftCamp mobile: Settings screen, body fields and units

Branch `profile-settings`, off main. Never merged by the session that built it.

DATABASE RULE: read-only queries only. The schema change is
`docs/profile-settings.sql`, which Alan runs in the SQL editor himself
before this branch is built. It is safe for the current app: the trigger
fills `sets.weight_unit` for clients that do not send it. Build against the
columns it adds
(`user_profiles.sex`, `user_profiles.birth_year`, `sets.weight_unit`) and
add them to `packages/shared/src/database.types.ts` by hand, matching the
generated style.

No new native dependencies; runs in the current dev build.

Stage files by explicit path. Never `git add -A` or `git add .`.

## Read first

Before writing code, read these in full:

- `apps/mobile/src/app/(tabs)/profile.tsx`
- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/components/unit-provider.tsx`
- `apps/mobile/src/components/username-sheet.tsx`
- `apps/mobile/src/data/home.ts` (profile getters and setters)
- `apps/mobile/src/data/workouts.ts` (every set read and write)
- `apps/mobile/src/data/history.ts`
- `apps/mobile/src/data/exercise-progress.ts`
- `packages/shared/src/set-weight.ts`
- `packages/shared/src/prior-session.ts`
- `packages/shared/src/pr.ts`
- `docs/profile-settings.sql`

## REPORT FIRST

Stop and report before building if any of these is true:

1. A set read path exists that the "Units" section below does not cover
   (list every function that selects `weight_value` or `weight`).
2. Any code writes `weight_value` without going through `data/workouts.ts`.
3. `getBodyweight` or `user_profiles.bodyweight` is read somewhere that
   assumes pounds.

## Decisions (Alan, 24 Sep 2026)

- Settings lives behind a gear icon on Profile, not as more Profile sections.
- Sex offers Male, Female, Prefer not to say.
- Switching units converts for display. Stored weights are never rewritten.

## Screen changes

### Profile (`(tabs)/profile.tsx`)

Keeps Weekly target, Experience, Equipment. Add a gear button at the right
end of the "Profile" title row: SF Symbol `gearshape` via the icon approach
the app already uses, 44 pt hit target, `accessibilityLabel="Settings"`.
Tapping pushes `/settings`.

Theme, Username, Account and the dev-only Developer section move to
Settings unchanged, with their state and handlers.

### Settings (`app/settings.tsx`, new)

Registered in the root stack in `_layout.tsx` as a normal push with a
native header titled "Settings" and a back button. Same `Section` and
`Chip` components as Profile (move them to `components/settings-ui.tsx`
and import from both screens).

Section order:

1. **Body**
   - Sex: chips Male, Female, Prefer not to say. Stored `male`, `female`,
     `unspecified`. None selected when null.
   - Birth year: a row showing the year or "Add", opening a sheet with a
     wheel or list of years from (current year minus 13) back to 1920,
     newest first. Stored as an integer.
   - Bodyweight: a row showing "182 lbs" or "Add", opening a sheet with a
     decimal keypad input in the current unit, one decimal allowed,
     valid range 30 to 700 lbs or 14 to 320 kg. Empty clears it (null).
   - Helper text under the section: "Used to estimate your strength level.
     Only you can see this."
2. **Units**: chips `lbs` and `kg`.
3. **Theme** (moved).
4. **Username** (moved).
5. **Account** (moved).
6. **Developer**, dev builds only (moved).

Every field saves on change, the way Profile's chips already do. No save
button.

## Units

### The rule

In memory, every set weight is in the user's current unit. Conversion
happens once, in the data layer, on read. Every write carries the current
unit.

### Shared helpers (`packages/shared/src/units.ts`, new, with tests)

- `type WeightUnit = 'lb' | 'kg'`
- `convertWeight(value: number, from: WeightUnit, to: WeightUnit): number`
  using 1 lb = 0.45359237 kg. Returns the input unchanged when units match.
- `roundForDisplay(value: number, unit: WeightUnit): number` rounds to 0.1.
  Use it only where numbers are printed, never before math.
- Tests: identity, lb to kg to lb round trip within 0.001, 225 lb shows as
  102.1 kg, 100 kg shows as 220.5 lbs, negative values (assist) convert.

### Reads

Every function in the mobile data layer that returns sets selects
`weight_unit` too and passes each set through a single helper,
`toUserUnit(set, unit)`, before returning. `weight_value` is converted. The
legacy free-text `weight` column is left as text; `numericWeight` falls
back to it only when `weight_value` is null, and those sets are all `lb`
(checked 24 Sep 2026: every weighted set is on an lb profile).

After this, PR detection, estimated max, volume, charts, records, prior
session autofill and share cards need no changes: they already work in
"the user's unit", which is now true for every set.

`useWeightUnit` exposes the stored unit (`lb` or `kg`) alongside the label,
and data functions take the unit as a parameter instead of reading the
profile again.

### Writes

- `insertOnce('sets', ...)` and every set patch that includes
  `weight_value` also send `weight_unit` set to the current unit.
- Prior session autofill copies the converted value, so a set seeded from
  a 225 lb set on a kg account is written as 102.1 kg with unit `kg`.
- A patch that changes only `reps`, `completed`, `note` or `position` does
  not touch `weight_unit`.
- The database trigger fills `weight_unit` from the profile when a client
  sends none. The mobile app always sends it.

### Switching

`setWeightUnit(userId, unit, bodyweight)` updates the profile in one
UPDATE: `weight_unit`, and `bodyweight` converted and rounded to 0.1 when
it is set. `UnitProvider` gets a setter that calls it and updates context,
so every mounted screen re-renders in the new unit. Screens holding sets in
state refetch on focus as they already do.

Switching during an active workout is allowed. The workout screen refetches
its sets when the unit changes, so logged sets show converted and new sets
are typed in the new unit.

### Bodyweight

`user_profiles.bodyweight` stays in the profile's unit, kept in step by
`setWeightUnit`. `setBodyweight(userId, value)` is new in `data/home.ts`.

## Data functions (`data/home.ts`)

- `getBodyProfile(userId)`: `{ sex, birthYear, bodyweight, weightUnit }`
  in one select.
- `setSex(userId, sex)`, `setBirthYear(userId, year)`,
  `setBodyweight(userId, value)`, `setWeightUnit(userId, unit, bodyweight)`.

## Out of scope

- The strength level itself. Separate spec; it reads `getBodyProfile`.
- The web app. It is frozen. It keeps reading `weight_value` raw and
  labelling with the profile unit, which stays correct for every lb user.
  A user who switches to kg on mobile will see raw numbers on web.

## Before App Store submission

The App Store privacy label needs to list sex, birth year and bodyweight
under Health and Fitness, linked to the user, not used for tracking.

## Copy

No em dashes and no colons in app copy.

## Verify

1. Profile shows the gear; Settings opens with all six sections.
2. Set sex, birth year and bodyweight, kill the app, reopen: values persist.
3. On an lb account with logged sets, switch to kg. History, workout
   detail, the exercise screen chart and records show kg values (225 lb
   reads 102.1 kg). Bodyweight shows converted. Switch back: the original
   numbers return exactly.
4. Start a workout on kg; prior-session placeholders show kg values; log a
   set; `sets.weight_unit` for the new row is `kg` (read-only query).
5. PR ribbons and PR counts are unchanged by switching units.
6. `pnpm -F @liftcamp/shared test` passes, including the new unit tests.
