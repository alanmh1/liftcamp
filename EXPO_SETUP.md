# LiftCamp mobile: bootstrap plan

Written to be worked through with Claude Code, one phase at a time. Do not run
phases ahead of each other. Each one ends with something you can verify.

Target: Expo SDK 57. Not 56, which shipped a Hermes memory regression affecting
reanimated and worklets. 57 is the fix and Expo describes the upgrade as minor.

---

## Phase 0. Local setup

**TERMINAL**

You need a real clone. GitHub's web editor cannot do this work.

```bash
git clone https://github.com/alanmh1/liftcamp.git
cd liftcamp
node -v      # need 20 or newer
```

Install pnpm if it isn't there:

```bash
npm install -g pnpm
```

**Before anything else**, confirm `.env` is gone from the repo and listed in
`.gitignore`. A committed `.env` will bake the wrong Supabase project into every
build, web and native.

```bash
git ls-files | grep -E '^\.env'   # must return nothing
```

If it returns something, remove it from tracking, add it to `.gitignore`, commit,
and re-verify. The values are already in Vercel.

**Verify:** `pnpm -v` prints a version, `git ls-files | grep .env` prints nothing.

---

## Phase 1. Monorepo restructure

This moves the existing app and will break the Vercel deploy until you update one
setting. Do it in a single commit so a revert is clean.

**TERMINAL**

```bash
mkdir -p apps packages
git mv $(ls -A | grep -vE '^(apps|packages|\.git)$') apps/web/
```

Check what moved before committing. `.github`, `supabase`, and any repo-level
config may belong at the root rather than inside `apps/web`. Move those back.

Root `package.json`:

```json
{
  "name": "liftcamp",
  "private": true,
  "packageManager": "pnpm@9.0.0"
}
```

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

The `node-linker=hoisted` line is required. pnpm's default symlinked layout breaks
React Native's native module resolution.

**VERCEL** → Settings → Build and Deployment → Root Directory → `apps/web`.

**Verify:** push, and the Vercel deploy goes green. Load liftcamp.app and check
`/exercises` renders with images. Do not proceed until the web app is healthy.

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
npx supabase gen types typescript --project-id mnsigwjyskxfuszeegtp \
  > packages/shared/src/database.types.ts
```

Then move the platform-independent logic out of `apps/web` and into
`packages/shared/src`. Candidates, in rough order of value:

- estimated 1RM calculation
- progression and starting-weight defaults
- PR detection
- exercise search, alias resolution, and the 17-muscle vocabulary constants
- volume and set-count aggregation for the summary screen

Anything that touches `window`, `document`, or a TanStack server function stays in
`apps/web`.

**Verify:** `apps/web` still builds after importing from `@liftcamp/shared`, and
the Vercel deploy is still green.

---

## Phase 3. Expo app

**TERMINAL**

```bash
cd apps
npx create-expo-app@latest mobile --template default
cd mobile
npx expo install expo-router
```

Confirm the SDK version in `apps/mobile/package.json` is 57.x. If the template
scaffolds something older, upgrade before writing any screens.

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

**Verify:** `npx expo start` runs, the app opens in the simulator, and a test
import from `@liftcamp/shared` resolves.

---

## Phase 4. EAS

**TERMINAL**

```bash
npm install -g eas-cli
eas login
eas init
eas build:configure
```

EAS builds in the cloud, so you never install Xcode. This also handles Apple's
requirement that anything uploaded to App Store Connect since 28 April 2026 be
built with Xcode 26. The default EAS image for SDK 54 and above already uses it.

Run one build early, before there is anything worth shipping:

```bash
eas build --platform ios --profile development
```

Do this now rather than later. Certificates, provisioning, and the Apple Developer
account ($99/yr) all surface here, and finding out about them during a real
release is worse.

**Verify:** a development build installs on your phone.

---

## Phase 5. Supabase client and auth

`packages/shared/src/supabase.ts` should export a factory, not a client, so each
app supplies its own storage adapter.

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
behaviour and will misfire in a native app. The `AppState` listener is what keeps
tokens refreshing while the app is foregrounded, and without it sessions expire in
the background. Use AsyncStorage rather than SecureStore, because SecureStore has a
2048-byte item limit that a Supabase session can exceed.

### Auth providers

The GIS popup flow in `apps/web/login.tsx` does not port. It needs a real https
origin registered with Google, and a native app has none.

Native path:

```bash
npx expo install @react-native-google-signin/google-signin expo-apple-authentication
```

Google returns an ID token, which goes to `supabase.auth.signInWithIdToken`. Same
Supabase side as the web flow, different way of obtaining the token.

Sign in with Apple is required by App Store guideline 4.8 because Google sign-in
exists. Configure the Apple provider in the Supabase dashboard and use
`expo-apple-authentication` on the client.

**SUPABASE** → Authentication → URL Configuration → Redirect URLs. The project
currently has three entries, all https. Add:

```
liftcamp://auth/callback
```

**Verify:** Google sign-in and Apple sign-in both land on an authenticated session,
and `auth.users` does not gain duplicate rows for an existing account.

---

## Phase 6. First screens

Build in this order. Each one is shippable on its own.

1. **Active workout.** Weight left, reps right, DM Mono numbers, auto-fill from the
   last session for that exercise. This is the screen the product lives or dies on.
2. **Exercise picker.** Compounds first, not alphabetical. Equipment and muscle
   filters. Search against `search_all`.
3. **Workout summary.** Duration, volume, sets, exercises, and the muscle heatmap.
4. **History.** Full history, free, no paywall.
5. **Progress.** Estimated 1RM per exercise, volume over time.

The muscle heatmap is the highest-value visual you can build, because the 17-muscle
vocabulary with primary and secondary tagging on all 898 exercises already exists.
It is an SVG with 17 fill targets driven by a normalized per-muscle score.

---

## Phase 7. Native layer

In order of how much they matter:

1. **Local notifications for the rest timer** (`expo-notifications`). A JS timer
   dies when the phone locks, so the current web rest timer is already broken on a
   locked screen. Fix this first.
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
  check it.
- `PrivacyInfo.xcprivacy` and privacy nutrition labels.
- A demo account in the App Store Connect review notes.
- App icon, splash, screenshots.
- No medical claims in any copy.

---

## What is out of scope

Apple Watch. It is a separate Swift target and cannot be built from Expo. Musklr
has one and it is genuinely good, and matching it means a native rewrite. Not worth
it at 12 users.
