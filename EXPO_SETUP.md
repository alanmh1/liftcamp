# LiftCamp mobile: bootstrap plan

Written to be worked through with Claude Code, one phase at a time. Do not run
phases ahead of each other. Each one ends with something you can verify.

Target: Expo SDK 57, package `expo` at 57.0.17 or later. The initial 57.0.0
release inherited SDK 56's Hermes V1 memory regression (react-native-worklets and
reanimated); 57.0.9 fixed it and 57.0.17 fixed a dev startup regression. SDK 58 is
in pre-release; stay on 57 until the mobile app has shipped once.

Status, 8 Sep 2026: Phases 0 and 1 are complete. Autofill (prior-session seeding)
merged to main. DNS moved to Cloudflare. Phase 2 is next.

---

## Phase 0. Local setup (done)

Node 22.23 via nvm, pnpm 12.3.4, Homebrew, gh, Claude Code. Repo cloned to
`~/code/liftcamp`. `.env` removed from tracking and ignored. Vercel builds from
its own environment variables, all six scoped to All Environments.

Two things learned here that Phase 1 depends on:

- Vercel installs with npm today, ignoring `bun.lock`. `package-lock.json` is out
  of sync with `package.json`, so `npm ci` fails and only `npm install` works.
- `src/lib/persist-query-cache.ts` has a pre-existing type error from a duplicated
  `@tanstack/query-core`. A fresh pnpm lockfile should resolve it. If it does not,
  it is a Phase 1 fix, not a Phase 2 one.

---

## Phase 1. Monorepo restructure (done)

Merged to main on 8 Sep 2026. The layout:

- `apps/web` holds the TanStack Start app, named `@liftcamp/web` in its
  `package.json`.
- `packages/` exists and is empty until Phase 2 creates `packages/shared`.
- `supabase/` and the four markdown files (`CLAUDE.md`, `EXPO_SETUP.md`,
  `README.md`, `roadmap.md`) stay at the root.
- One lockfile at the root, `pnpm-lock.yaml`. `bun.lock`, `bunfig.toml`,
  `package-lock.json`, and `.lovable` are deleted.

**VERCEL (Settings → Build and Deployment)**, already set and deploying green:

- Root Directory: `apps/web`
- "Include source files outside of the Root Directory in the Build Step": on.
  Phase 2 needs it, because `packages/shared` sits above the root directory.
- Node.js Version: 22

### pnpm config facts, learned the hard way

The whole pnpm configuration is one file. Current `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"

# pnpm 12 reads its settings from this file. The "pnpm" field in package.json is
# ignored outright, and .npmrc is not consulted for these keys, so everything
# pnpm-specific lives here.

# Required. pnpm's default symlinked layout breaks React Native's native module
# resolution in apps/mobile.
nodeLinker: hoisted

overrides:
  entities: 4.5.0

# 24h supply-chain guard: reject package versions published less than a day ago.
minimumReleaseAge: 1440
# Each entry bypasses the guard for one package. Confirm before adding any.
minimumReleaseAgeExclude:
  - "@lovable.dev/vite-tanstack-config"
# Without this, pnpm silently appends its own entries above on any install that
# trips the guard.
minimumReleaseAgeStrict: true

# esbuild's postinstall fetches its platform binary, so it has to run.
allowBuilds:
  esbuild: true
```

Seven things about that file cost time to work out.

**Settings only take effect here.** pnpm 12 ignores the `pnpm` field in
`package.json` entirely. The root `.npmrc` still contains `node-linker=hoisted`
and pnpm 12 did not apply it either. Both are silent about it. If a pnpm setting
appears to do nothing, the first thing to check is whether it is in
`pnpm-workspace.yaml`.

**`nodeLinker: hoisted` is required for React Native.** Metro cannot follow
pnpm's default symlinked store, which is the Phase 3 failure mode where
`@liftcamp/shared` will not resolve. It applies to `apps/web` as well, which is
fine. Verify it after any install:

```bash
grep nodeLinker node_modules/.modules.yaml
```

That must print `"nodeLinker": "hoisted"`. `.modules.yaml` records what pnpm
actually did on the last install, so check it rather than `pnpm-workspace.yaml`.

**The `entities` override is load-bearing.** The web build fails without it.
Several dependents pull `entities` (`@react-email/render`, `domutils`,
`htmlparser2`), and pinning 4.5.0 keeps them on one copy. Leave it in place.

**`allowBuilds` is pnpm 12's spelling of `onlyBuiltDependencies`.** Same purpose,
different shape: a map of package name to boolean rather than a list, and in
`pnpm-workspace.yaml` rather than under the `pnpm` field. esbuild is on it
because its postinstall fetches a platform binary.

**`minimumReleaseAge: 1440` rejects any version published in the last 24 hours,**
and `minimumReleaseAgeStrict: true` stops pnpm from writing its own bypass
entries into `minimumReleaseAgeExclude` when an install trips the guard.

**Phase 3 will hit that guard.** If the Expo SDK 57 patch you need was published
today, `npx expo install` fails on the release age. Wait a day and run it again.
Resist adding an exclude entry to get past it. One day of delay is cheaper than
the guard it turns off.

**`packageManager` is the range `pnpm@12`.** An exact pin makes pnpm write a
self-management block into the lockfile, listing pnpm's own binaries as packages,
and Vercel cannot install that. The range keeps the block out, so Vercel builds
with pnpm 10 off the frozen lockfile and succeeds while local work stays on
pnpm 12. Setting `ENABLE_EXPERIMENTAL_COREPACK=1` in the Vercel environment
variables and restoring the exact pin would put both on pnpm 12. That is
optional, and the range works today.

---

## Phase 2. The shared package

**TERMINAL**

```bash
mkdir -p packages/shared/src
```

`packages/shared/package.json`:

```json
{
  "name": "@liftcamp/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

Generate database types from the live project rather than hand-writing them:

```bash
npx supabase login
npx supabase gen types typescript --project-id mnsigwjyskxfuszeegtp \
  > packages/shared/src/database.types.ts
```

Then move the platform-independent logic out of `apps/web` and into
`packages/shared/src`. Candidates, in rough order of value:

- `prior-session.ts` (getPriorSets, priorSetForPosition), already isolated
- `set-weight.ts` (numericWeight)
- estimated 1RM calculation
- progression and starting-weight defaults, cold-start suggestion
- PR detection
- exercise search, alias resolution, the 17-muscle vocabulary constants
- volume and set-count aggregation for the summary screen

Anything that touches `window`, `document`, TanStack Query hooks, or a TanStack
server function stays in `apps/web`. Move pure functions only; the web app keeps
its own hooks that call them.

### Offline logging: decide it here, not in Phase 6

A gym app that fails to log a set with no signal is a one-star review. The active
workout screen in Phase 6 needs write-first local storage with sync on reconnect.
That shapes the shared package, so the rules go here:

- Every `sets` row gets a client-generated UUID. Already true on web (`addSet`).
- Inserts are idempotent: `ON CONFLICT (id) DO NOTHING` for sets, `DO UPDATE` for
  edits keyed on `updated_at`. Verify the live schema has `updated_at` on `sets`;
  add it with `ADD COLUMN IF NOT EXISTS` if not.
- The shared package exports the row shapes and the pure merge logic. The mobile
  app owns the queue (expo-sqlite or MMKV) and the replay loop. Do not put storage
  in the shared package.
- Reads on mobile come from the local store first, then reconcile. The web app is
  unchanged.

**Verify:** `apps/web` still builds after importing from `@liftcamp/shared`, and
the production deploy is still green.

---

## Phase 3. Expo app

**TERMINAL**

```bash
cd apps
npx create-expo-app@latest mobile --template default
cd mobile
npx expo install expo-router
```

Confirm `expo` in `apps/mobile/package.json` is 57.0.17 or later. If not:

```bash
npx expo install expo@latest --fix
```

Do not accept an SDK 58 pre-release if the template offers one.

`apps/mobile/metro.config.js`, replacing whatever the template generated:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

This is the one part of the monorepo setup that reliably needs a second attempt.
If Metro cannot resolve `@liftcamp/shared`, the problem is almost always here or
in `.npmrc`.

Set the bundle identifier now, in `app.json`, because the auth redirect scheme
depends on it:

```json
{
  "expo": {
    "name": "LiftCamp",
    "slug": "liftcamp",
    "scheme": "liftcamp",
    "ios": { "bundleIdentifier": "app.liftcamp.mobile" },
    "android": { "package": "app.liftcamp.mobile" }
  }
}
```

**Verify:** `npx expo start` runs, the app opens in the simulator or in Expo Go
on your phone, and a test import from `@liftcamp/shared` resolves.

---

## Phase 4. EAS

Buy the Apple Developer account ($99/yr) at the start of this phase. Approval can
take a day or two.

**TERMINAL**

```bash
npm install -g eas-cli
eas login
eas init
eas build:configure
```

EAS builds in the cloud, so you never install Xcode. Anything uploaded to App
Store Connect since 28 April 2026 must be built with Xcode 26; the default EAS
image for SDK 54 and above already uses it.

Run one build early, before there is anything worth shipping:

```bash
eas build --platform ios --profile development
```

Certificates, provisioning, and the Apple account all surface here, and finding
out about them during a real release is worse.

**Verify:** a development build installs on your phone and opens.

---

## Phase 5. Supabase client and auth

Do not test auth in Expo Go. Expo Go uses an `exp://` scheme, so the
`liftcamp://` redirect below will look broken when it is not. Auth testing needs
the Phase 4 development build on your phone.

`packages/shared/src/supabase.ts` exports a factory, not a client, so each app
supplies its own storage adapter.

`apps/mobile/lib/supabase.ts`:

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '@liftcamp/shared';

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

Three things in there matter. `detectSessionInUrl` must be false; it is a browser
behaviour and misfires in a native app. The `AppState` listener keeps tokens
refreshing while the app is foregrounded; without it sessions expire in the
background. AsyncStorage rather than SecureStore, because SecureStore has a
2048-byte item limit that a Supabase session can exceed.

### Auth providers

The GIS popup flow in `apps/web/src/routes/login.tsx` does not port. It needs a
real https origin registered with Google, and a native app has none.

Native path:

```bash
npx expo install @react-native-google-signin/google-signin expo-apple-authentication
```

Google returns an ID token, which goes to `supabase.auth.signInWithIdToken`. Same
Supabase side as the web flow, different way of obtaining the token. This needs
an iOS OAuth client in the same Google Cloud project as the web client.

Sign in with Apple is required by App Store guideline 4.8 because Google sign-in
exists. Configure the Apple provider in the Supabase dashboard and use
`expo-apple-authentication` on the client.

**SUPABASE (Authentication → URL Configuration → Redirect URLs)**. The project
has three https entries. Add:

```
liftcamp://auth/callback
```

**Verify:** on the development build, Google sign-in and Apple sign-in both land
on an authenticated session, and `auth.users` does not gain duplicate rows for
an existing account.

---

## Phase 6. First screens

Build in this order. Each one is shippable on its own.

1. **Active workout.** Weight left, reps right, DM Mono numbers. Prior-session
   seeding position by position via `getPriorSets`, same rules as web. Local
   write-first, per the Phase 2 offline rules. This is the screen the product
   lives or dies on.
2. **Exercise picker.** Compounds first, not alphabetical. Equipment and muscle
   filters. Search against `search_all`.
3. **Workout summary.** Duration, volume, sets, exercises, and the muscle heatmap.
4. **History.** Full history, free, no paywall.
5. **Progress.** Estimated 1RM per exercise, volume over time.

The muscle heatmap is the highest-value visual you can build, because the
17-muscle vocabulary with primary and secondary tagging on all 898 exercises
already exists. It is an SVG with 17 fill targets driven by a normalized
per-muscle score.

---

## Phase 7. Native layer

In order of how much they matter:

1. **Local notifications for the rest timer** (`expo-notifications`). A JS timer
   dies when the phone locks, so the current web rest timer is already broken on
   a locked screen. Fix this first.
2. **Haptics** (`expo-haptics`) on set completion and on a PR.
3. **HealthKit write** for finished workouts.
4. **Native share** for PR cards.
5. **Live Activity** for the current set and rest countdown. iOS widgets went
   stable in Expo SDK 56, so this is reachable, but it needs a config plugin and
   some Swift. Leave it until after the first release.

Items 1 through 4 are also what clears App Store guideline 4.2, which is where a
thin app gets rejected as a website wrapper.

---

## Phase 8. Store submission

- In-app account deletion. An Edge Function using the service role key, deleting
  the auth user and all owned rows in FK order. Guideline 5.1.1(v), and reviewers
  check it. `SUPABASE_SERVICE_ROLE_KEY` is referenced by
  `apps/web/src/integrations/supabase/client.server.ts` but is not set anywhere
  yet; it lives in the Edge Function's secrets, never in Vercel or the app.
- `PrivacyInfo.xcprivacy` and privacy nutrition labels.
- A demo account in the App Store Connect review notes.
- App icon, splash, screenshots.
- No medical claims in any copy.

---

## Housekeeping, any time after Phase 1

- **LOVABLE**: turn off the GitHub sync for the project. Then the `.lovable`
  folder deletion in Phase 1 is safe to keep.
- **CLOUDFLARE (DNS)**: delete `_lovable-email` TXT and both `notify` NS records
  once a week has passed with email and Resend working.
- **LOVABLE (Workspace domains → Configure → ⋯ → Transfer out)**: from 11 Oct
  2026, transfer the registration to Cloudflare Registrar. The zone is already
  there, so it is an EPP code and a payment. After that, cancel the Lovable plan.

---

## What is out of scope

Apple Watch. It is a separate Swift target and cannot be built from Expo. Musklr
has one and it is genuinely good, and matching it means a native rewrite. Not
worth it at 12 users.
