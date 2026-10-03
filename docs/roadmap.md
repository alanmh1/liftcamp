# LiftCamp product roadmap

Last updated 29 Sep 2026. Six phases. Each phase has an exit condition. Monetization sits behind a retention gate on purpose.

## Context

- Audience is beginners in their first 6 months of lifting.
- Positioning for paid is a budget option. Target pricing is $9.99 a year (preselected), $1.99 a month, $29.99 lifetime.
- Category norm from the Hevy and Strong audit is to never gate logging or history. LiftCamp keeps logging, full history, PRs, the exercise library, all starter programs, the body diagram and share cards free forever.
- Paid features are things a beginner would otherwise pay a coach for. Progression guidance is the anchor.
- Retention is built on gamification that the category under-uses. The week streak is the primitive; encouragement copy, the celebration, milestone share cards and the friend challenge all hang off it.

## Phase 1. Finish the profile (now to mid October)

Done as of 29 Sep 2026, all shipped in TestFlight build 6. Order mattered because Phase 4 needs body details.

- Settings screen with Body (sex, birthday, bodyweight), Units, Theme, Username, Account and a Training group (weekly target, experience, equipment).
- Profile tab redesign showing progress (header, stats, workouts per week chart, recent PRs, strength levels).
- Strength level on the exercise screen, current level only, shown once body details exist. Free.
- Home setup checklist with weighted tasks. Body details framed as "see your strength level". Invite a friend last and not required for 100%.
- Launch animation after the splash.

Exit: a user can enter sex, birthday and bodyweight and see a strength level on squat, bench, deadlift and overhead press.

## Phase 2. Launch gates (October)

One new feature, pulled forward from Phase 5 on 29 Sep 2026, then the open list.

- Workouts this week card, redesigned. Spec in docs/week-card-spec.md. Pulled forward because a streak only works if it starts on day one for the early users Phase 3 counts. Shipped 29 Sep 2026 in TestFlight build 6, haptics included.
  - Counter as weight-plate tokens that fill, big "2 of 3" in Outfit tabular figures, the day dots kept.
  - Encouragement line keyed to phase (first, zero early, zero late, going, one left, hit, over) with 3 to 8 lines per pool, rotating by week so it never repeats within a week or across neighboring weeks. At-risk override when every remaining day must be a training day and a streak is on the line; days left count from tomorrow when today already has a workout. Reset line shows once. Copy pools live in the spec; "Done and dusted" and "Get in!" are out.
  - Week streak in packages/shared with vitest. Consecutive weeks at target, distinct training days not workout rows, current week joins once hit. One rest week banked after four hits in a row, auto-applied to a miss, at most one banked. Computed on read, no schema; changing the target rewrites history (known wart, fix by snapshotting week results later). Streak chip on the card, current and longest streak on Profile. Milestones at 2, 4, 8, 12, 26 and 52 weeks swap the week's hit line for a milestone line; no extra animation.
  - Celebration on the first Home open after a launch or return from background following the week being hit, once per week. Plates pulse, count pops, chip lands, card border turns accent, soft glow. No confetti (that is the summary's) and no gold (that is PRs').
  - Haptics via expo-haptics. Exactly five call sites: set done (light), rest timer end (success), Finish (medium), PR (success), week celebration (three light impacts then success). No app toggle in v1; iOS System Haptics governs.
- Account deletion. Done, shipped 28 Sep 2026, including the confirmation email and the privacy manifest.
- Captcha on anonymous sign-ins. Deferred until there is evidence of abuse. The anonymous rate limit stays at 30 per hour, and a nightly job removes empty guest accounts after 30 days without activity.
- Offline write queue. An app that drops sets in a basement gym gets 1-star reviews whether it is paid or free. The queue itself shipped 29 Sep 2026 and passed an airplane-mode test on a phone; it also fixed out-of-order weight edits and sets silently lost with no signal. Still to do: instant workout start from a device copy, then pending-sync UI (Home and the week card showing unsynced finishes, Home refreshing on reconnect).
- EAS Update. Added in build 6, so JavaScript-only fixes ship over the air. Publish with --platform ios until Android is ready.
- Guest flow. Account prompt waits for the first finished workout, then appears on the post-workout summary and Home. Keep guest data when a guest signs into an existing account.
- Local notifications via expo-notifications, installed in build 6 but unused so both can ship as EAS Updates. One permission prompt, asked when the value is obvious (first week hit, or first backgrounding during a rest timer), never at launch.
  - Background rest alert. The rest-end haptic only fires in the foreground because the ticker stops in the background.
  - At-risk streak reminder. At most one a week, only when every remaining day must be a training day and the streak is 2 weeks or more, timed to the user's usual logging time and never after about 8pm, skipped if they already trained today. Encouraging copy, never guilt. Settings toggle to turn it off.
- Band exercise images, the "Needs new media" list in docs/gif-audit.md.
- Expo 57.0.22 to 57.0.25 plus the Reanimated upgrade with the layout animation fix, together in the next native build.
- Android internal build for one tester (Will), via EAS internal distribution, no Play Store. Branches android-preview, android-back-and-sheets and android-keypad are pushed; they need the Android emulator, the Android OAuth client and the new env var before testing. Not a launch gate.
- New TestFlight build, then App Store submission. Launch free with no paywall and no mention of Pro.

Exit: LiftCamp is live on the App Store. Record the launch date in the repo. Anyone who signs up before Pro ships counts as an early user.

## Phase 3. Watch, and build quietly (4 to 6 weeks after launch)

Two tracks in parallel.

### Measure

- Instrument signup to first workout, first to second, second to third, and week 2 return.
- Add streak metrics: share of active users with a streak of 2 or more, rest-week usage, and whether the at-risk line moves Sunday workouts.
- Drive strangers in from r/beginnerfitness, r/GYM, gym fliers with UTM tags, and personal trainer outreach.
- Bar to clear before Phase 4 ships: about 30 signups Alan does not know, with a quarter of them logging a third workout. Set the exact number before looking at the data.

### Build

- Progression rules engine in packages/shared, tested with vitest, behind a flag. Never shipped free.
  - Rule table keyed by equipment. Barbell +5 or +10 lb, dumbbell next increment, machine next plate, bodyweight add reps.
  - Double progression for rep ranges.
  - Deload after 2 or 3 misses on the same lift.
- RevenueCat Expo SDK on a branch. Entitlements readable from Supabase so web and mobile agree. Restore purchases.
- Paid Apps Agreement, tax and banking details, and Small Business Program enrollment. The paperwork takes days.

Exit: retention bar met, engine passing tests, billing branch working in sandbox.

## Phase 4. Pro v1 (target early December)

One app update that adds the paywall and something new at the same time.

- Progression guidance on every set row ("70 × 8, up 5 from last time") and a "next time" block on the post-workout summary.
- Strength level next-level path ("about 3 sessions from Intermediate on squat"). Current level stays free.
- Onboarding adds a skippable bodyweight question framed as "so we can suggest starting weights", with sex as a second optional question. Answering leads to a week 1 preview with real numbers and the paywall on the save step. Skipping leads to the plain free program. Design the preview screen before wiring the numbers. Birthday stays in Settings.
- Custom routine cap. 3 free, unlimited on Pro. Open question: this conflicts with "nothing already free moves behind the wall" for existing users; decide between new accounts only, grandfathering existing routines, or dropping the cap.
- Paywall copy and prices behind remote config so they can change without a store review.
- Early users get a free year or lifetime at a discount.
- Submission checklist. Price and renewal terms visible on the paywall, links to terms and privacy, a working restore purchases button.

Exit: Pro is live. First metric is trial-to-paid on the onboarding path versus the exercise screen path.

## Phase 5. The six-month cliff (Q1 2027)

Beginners outgrow linear progression around month 4 to 6.

- Stall detection (missed target on the same lift 3 sessions running) with an offer to switch to an intermediate program. The 27 system programs already cover this. The work is detection and the switch.
- Milestone share cards, triggered by the streak milestones shipped in Phase 2, and a first-three-months recap. Retention features, all free. Streak medals (3 Oct 2026, branch streak-medals) put the medal on the share card and add a stored medal cabinet on Profile; ladder 2, 4, 8, 12, 26, 52, 78, 104 weeks, then every 52. Clay medal art in place (bronze, silver, gold).
- Snapshot week results so a target change stops rewriting streak history.
- Deeper analytics (sets per muscle per week, volume trends) as Pro filler.
- Web billing through RevenueCat plus Stripe so a web subscriber unlocks mobile. Recheck Apple's external-link rules first.

Exit: users hitting a stall get moved to a new program instead of quitting.

## Phase 6. Later, on evidence

Each of these waits for a signal from Phase 4 or 5.

- Android.
- Apple Watch and Live Activities.
- Friend consistency challenge and per-exercise leaderboards. The challenge is "who holds the longer streak", so the streak data from Phase 2 already covers it; what is missing is account relationships, which bring Apple guideline 1.2 moderation obligations. Server push notifications arrive here, since they depend on other people's activity.
- Instagram Stories share (parked on Meta verification).
- Camera-based form checker with on-device pose detection.
- Photo upload on a finished workout.
- Editing a finished workout.
- In-app haptics toggle, if anyone asks.
- Body diagram repaint. Mobile done 29 Sep: the diagram stacks pre-rendered layers with the blue painted into the clay (docs/body-diagram.md). Rear delts painted 30 Sep, so every mobile region is a painted layer. Still open: porting the layers to the web, which still tints 18 masks.

## Payment infrastructure

Built on a branch in Phase 3, shipped in Phase 4. About a week of work once the products exist.

### Merchant of record

- iOS uses Apple in-app purchase. Apple handles cards, VAT and sales tax.
- Android uses Google Play Billing when it arrives.
- Web uses Stripe later, through RevenueCat web billing, so all three feed one entitlement.

### RevenueCat

- react-native-purchases in the dev build. Expo Go cannot load it. TestFlight builds already can.
- One entitlement named pro.
- RevenueCat app user ID is the Supabase auth user ID. Guests buy under RevenueCat's anonymous ID and are aliased on sign-in, so no account is required before purchase.
- Free until roughly $2.5k in monthly tracked revenue.

### Products in App Store Connect

- Subscription group LiftCamp Pro with pro_yearly ($9.99) and pro_monthly ($1.99).
- pro_lifetime ($29.99) as a non-consumable.
- Optional 7-day free trial on yearly only.
- All products attach to the first Pro build's submission. Later products can be added without a build.

### Supabase

- Table user_entitlements (user_id, is_pro, source, product_id, expires_at, updated_at).
- Edge Function receives RevenueCat webhooks and writes the table.
- Mobile reads the SDK directly for instant state. Server code and RLS read the table. This is what lets a web purchase unlock mobile later without touching the mobile side.

### Paywall

- Custom screen in the clay style that reads Offerings from RevenueCat. Prices arrive localized from StoreKit. Products, copy and the preselected plan change without a store review.
- Apple checklist. Price and renewal terms visible, terms of use and privacy policy links, restore purchases button, manage subscription link.

### Grandfathering

- RevenueCat promotional entitlements granted by API to every user created before the Pro launch date. A free year is one API call per user. No app code.

### Paperwork (do in Phase 3)

- Paid Apps Agreement, banking and tax forms in App Store Connect.
- Apply to the App Store Small Business Program. It is an application, not automatic. 15% commission under $1M a year.
- Sandbox tester account for purchase testing. TestFlight uses sandbox on its own.

## Standing rules

- Progression guidance and generated starting weights never ship free, not even as a preview.
- Nothing already free moves behind the wall.
- Anything that needs a native module lands in a store build, not an OTA update. Install native modules ahead of need when a build is happening anyway, so the features that use them can ship over the air.
- Every paid feature is something a beginner would otherwise pay a coach for. Cosmetics and limits are filler, not the pitch.
- The authed web app stays frozen. Mobile is the product. Web is marketing, SEO and later billing. Web code is an outdated build and is never a reference for mobile behavior.
- Haptics confirm an action or mark a reward, never decorate. Five call sites and no more without a decision.
- Gold is for PRs only. Accent means tappable; green marks a done set. Confetti belongs to the workout summary and nowhere else.
- Exception to the gold rule: share cards are images for social and use the app icon's palette (plate blue background, gold headline number, everything else white), the same in light and dark. The rule above covers in-app UI.
