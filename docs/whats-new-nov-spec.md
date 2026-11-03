# What's new card, November

Branch `whats-new-nov`, worktree `~/code/liftcamp-whats-new-nov`. Branch, commit, push. No merging, no Metro, no Simulator runs, database read-only. JS only, ships OTA. No SQL.

This replaces the 1.1 card on Home with a new one covering what's shipped since 19 Oct. Alan approved the copy and layout from a mockup on 3 Nov 2026.

Read before starting: `components/home/whats-new-card.tsx`, `data/whats-new.ts`, where Home renders `WhatsNewSlot` in `app/(tabs)/(home)/index.tsx`, `lib/analytics.ts`, `app/import.tsx` (the `entry` param), the Developer section of `app/settings.tsx`, and `app/dev/week-card.tsx`.

## Who sees it

- Any platform, iOS and Android.
- The account has at least one finished workout logged in the app before the cutoff: `finished_at` not null, `platform` in (`ios`, `android`), and `created_at` before `2026-11-04T08:00:00Z` (midnight Pacific, 4 Nov). Imported workouts (`platform = 'import'`) don't count, and brand-new users never see it.
- It hasn't been dismissed on this phone. The new key is `liftcamp:whats-new:2026-11`.
- The hold rules stay exactly as they are: never while a workout is in progress, never on a launch the week card celebrates, and either one holds it until the next launch.

The 1.1 card retires. Its offer, its key check and its notification permission logic go, so no one sees both cards. Keep `Row` and the icon style.

## The card

Same frame as the 1.1 card: card surface, the header with eyebrow and title, the dismiss X in the corner, rows with a 40 pt icon well, and one full-width outline button.

- Eyebrow, `type.label`, `text3`: "New this month"
- Title: "What's new in LiftCamp"
- Rows, in this order, title then body:
  1. "Bring your history". "Coming from Fitbod, Strong or Hevy? Your workouts and PRs come with you." Under the body, a text link in `accentText`, weight 600, with a small chevron: "Import workouts".
  2. "Fix a past workout". "Open a finished workout and choose Edit to change a weight, the reps or the exercise."
  3. "Add your own exercises". "Can't find one in the library? Tap New and make it yourself."
  4. "Keep your routine current". "Swapped an exercise mid-workout? Save the change to your routine when you finish."
- Button, outline in accent: "Got it". It dismisses the card.

Icons are hand-drawn SVG in the existing style (24 pt, stroke 1.75, round caps and joins, `text` colour): a tray with an arrow coming down into it, a pencil, a plus in a circle, and two curved arrows chasing each other. Draw them the way `TabBarIcon` and `PhoneIcon` are drawn.

"Import workouts" marks the card seen, then pushes `/import?entry=whats_new`. Add `whats_new` to the `entry` values the import screen and its analytics accept. The X and Got it both mark it seen and run the existing fade-out.

## Analytics

Add `whatsNew: 'whats_new'` to `EVENTS`, with prop `action`: `shown` (once, when the card appears), `dismissed` (X or Got it) or `import` (the link). Also add `card: '2026-11'`, so a later card can be told apart.

## Developer preview

In Settings, Developer, add a "What's new card" button next to "Week card gallery". It pushes a dev screen showing the card on its own, whatever the eligibility. Tapping its buttons there doesn't write the seen key. That's how Alan checks it in the Simulator, where his account may not qualify.

## Order of work

1. `data/whats-new.ts`: the new rule and key, with the 1.1 logic removed.
2. The card content, icons and actions.
3. Analytics, and the `whats_new` entry value.
4. The developer preview.
5. Typecheck mobile and shared, run the shared tests, commit and push.

Stop and ask before any decision this spec leaves open.

## Copy

Exactly as written above. No em dashes, no colons.
