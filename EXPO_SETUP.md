# LiftCamp mobile: bootstrap plan

Written to be worked through with Claude Code, one phase at a time. Do not run
phases ahead of each other. Each one ends with something you can verify.

Target: Expo SDK 57, package `expo` at 57.0.17 or later. The initial 57.0.0
release inherited SDK 56's Hermes V1 memory regression (react-native-worklets and
reanimated); 57.0.9 fixed it and 57.0.17 fixed a dev startup regression. SDK 58 is
in pre-release; stay on 57 until the mobile app has shipped once.

Status, 8 Sep 2026: Phase 0 complete. Autofill (prior-session seeding) merged to
main. DNS moved to Cloudflare. Phase 1 is next.

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

## Phase 1. Monorepo restructure

This moves the existing app and breaks the Vercel deploy until two settings
change. Do it on a branch, merge once, so a revert is one commit.

**TERMINAL**

```bash
cd ~/code/liftcamp
git checkout -b monorepo
mkdir -p apps/web packages
```

Move the web app into `apps/web`. Explicit list, no glob, because `git mv` on a
glob is where filenames with spaces and untracked files cause trouble:

```bash
git mv src public package.json tsconfig.json vite.config.ts eslint.config.js \
  components.json .prettierrc .prettierignore README.md apps/web/
mv .env apps/web/.env    # untracked, moves with the app
```

Stays at the root: `supabase/`, `CLAUDE.md`, `roadmap.md`, `.gitignore`.

Delete, all three:

```bash
git rm bun.lock bunfig.toml package-lock.json
git rm -r .lovable
```

pnpm generates one lockfile at the root. The Lovable folder is dead once the
GitHub sync is off.

Root `package.json`:

```json
{
  "name": "liftcamp",
  "private": true,
  "packageManager": "pnpm@12.3.4",
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

`onlyBuiltDependencies` is pnpm's equivalent of the npm allow-scripts prompt seen
in the Vercel logs. esbuild needs its postinstall to fetch a binary.

Root `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Root `.npmrc`:

```
node-linker=hoisted
```

Required. pnpm's default symlinked layout breaks React Native's native module
resolution. It also applies to `apps/web`, which is fine.

Update `apps/web/package.json`: set `"name": "@liftcamp/web"`. Leave scripts
alone.

Root `.gitignore` needs `node_modules` and the `.env` rules already there; add
`apps/*/.env` and `apps/*/.env.*` if the existing rules do not match subfolders.

Install and verify locally before touching Vercel:

```bash
pnpm install
pnpm --filter @liftcamp/web build
pnpm --filter @liftcamp/web exec tsc --noEmit
```

Build must pass. If `tsc` still reports `persist-query-cache.ts`, fix it now.

Commit, push the branch.

**VERCEL (Settings → Build and Deployment)**, three changes:

1. Root Directory: `apps/web`
2. Enable "Include source files outside of the Root Directory in the Build Step".
   Without it, `packages/shared` is invisible to the build in Phase 2.
3. Install Command: leave on auto. Vercel detects `pnpm-lock.yaml` and the
   `packageManager` field. If the log still shows npm, set it to `pnpm install`.

Vercel builds the `monorepo` branch as a preview. Google sign-in will not work on
the preview URL (not in the OAuth client's origins), so check the public pages:
`/exercises` renders with images, one exercise detail page loads.

**TERMINAL**

```bash
git checkout main
git merge monorepo
git push
```

**Verify:** production deploy green, liftcamp.app loads, sign-in works, start a
workout and log one set. Do not proceed until the web app is healthy.

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
