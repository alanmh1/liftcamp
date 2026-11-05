# Pro billing

RevenueCat on iOS, built on branch `revenuecat`. The old `pro-billing` branch is
superseded and should not be merged. `docs/revenuecat.sql` replaces its SQL.

## How it fits

- `apps/mobile/src/lib/purchases.ts`: the SDK, behind a Platform check and a lazy
  require. Android never loads it. `PurchasesSync` keeps it on the signed-in user.
- `apps/mobile/src/lib/pro.ts`: `usePro` (`resolvePro` in shared, RevenueCat or a
  `user_entitlements` row), `useProPlan`, `useProUpsell`, `useRoutineCapCheck`.
- `apps/mobile/src/lib/pro-launched.ts`: `pro_launched()`, the flag from /admin
  Feature flags. It decides whether the app sells. It never decides who has Pro.
- `apps/mobile/src/app/paywall.tsx`: the paywall. Words in `packages/shared/src/paywall.ts`.
- `supabase/functions/revenuecat-webhook`: writes `user_entitlements`. It leaves rows
  with `source = 'tester'` alone. `private.is_pro` reads this table, so the server's
  custom exercise cap only lifts for a buyer once the webhook has written their row.

## Custom routine cap

A routine is a `templates` row. `is_system` rows have no owner. The cap counts the
user's own rows with `program_slug` null: routines saved from a workout and duplicates.
Copies of built-in programs keep their `program_slug` and do not count, because
onboarding writes them and every routine LiftCamp ships stays free. There is no archive
state on `templates`; a routine is deleted or it exists. Routines waiting in the write
queue to be deleted are left out of the count.

The cap is in the app only, and only where Pro can be bought (iOS, flag on).

## Setup, in order

1. **SUPABASE (SQL editor)**: `docs/revenuecat.sql`, Section 0 first.
2. **TERMINAL**: set `REVENUECAT_WEBHOOK_AUTH` (any long random string) and
   `REVENUECAT_SECRET_KEY` (v1 secret key, `sk_...`) with
   `npx supabase secrets set --project-ref mnsigwjyskxfuszeegtp`, then
   `npx supabase functions deploy revenuecat-webhook --no-verify-jwt --project-ref mnsigwjyskxfuszeegtp`
   and deploy `delete-account` the same way.
3. **REVENUECAT (Project settings → Integrations → Webhooks)**: URL
   `https://mnsigwjyskxfuszeegtp.supabase.co/functions/v1/revenuecat-webhook`,
   Authorization header `Bearer <REVENUECAT_WEBHOOK_AUTH>`.
4. **REVENUECAT (Project settings → General)**: restore behavior "Transfer to new App
   User ID". A guest's purchase moves to the account they merge into through this.
5. **EAS (Environment variables)**: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` for `production`
   and `preview`.
6. **ADMIN (Feature flags → Pro launched)**: grant the App Review demo account and your
   own, or turn the switch on. Reviewers have to reach the paywall to approve the
   products.
