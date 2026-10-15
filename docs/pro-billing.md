# Pro billing

The billing work itself lives on the `pro-billing` branch (`docs/pro-billing-plan.md`
and `docs/pro-billing.sql` there). This file records what main has done since that
branch was written, which the branch has to absorb before it merges.

## Before merging pro-billing

Main now has `public.user_entitlements` from
`supabase/migrations/20261003120000_tester_entitlements.sql` (branch
`tester-entitlements`): pro-billing's table, policy and grants, with `'tester'` added
to `user_entitlements_source_check`, plus `admin_list_entitlements()` and
`admin_set_entitlement()`. Each item below is a change to make on `pro-billing`.

1. **merge_guest_account (Section 4 of `docs/pro-billing.sql`).** The hash guard
   expects `6a0830bdb16ffd59ddea701b8c864d63`. The live body changed on 2 Oct 2026,
   when `20261002140000_guest_merged_first_open.sql` added `guest_created_at` to the
   `guest_merged` event; the live `md5(prosrc)` was `721febf422865c21e12537a89c6e53d2`
   on 3 Oct 2026. Rebuild the replacement from the current body in
   `docs/guest-merge.sql`, set the guard to the live hash at that time, and keep the
   one addition: `DELETE FROM public.user_entitlements WHERE user_id = p_guest;`
   before the leftover-rows check. main has not added that line.

2. **private.purge_empty_guests (Section 3).** The replacement says
   `max_age interval DEFAULT '30 days'::interval`. Main moved it to 90 days in
   `20261002141000_purge_guests_90_days.sql`, and the privacy page says 90. Use
   `'90 days'`. The hash guard (`901e91d1b8c3b76e8d8da6f303b736db`) still matches,
   because a default is not part of `prosrc`, so the guard will not catch this.

3. **revenuecat-webhook.** Rows with `source = 'tester'` belong to
   `admin_set_entitlement`. The webhook must leave them alone: skip the write, or
   upsert with `WHERE user_entitlements.source <> 'tester'`, so a RevenueCat event for
   a tester never clears or rewrites their grant. The table's check constraint
   already allows `'tester'`; keep it in the list if the constraint is ever rewritten.

4. **useProgressionGate (`apps/mobile/src/lib/pro.ts`).** Both branches rewrite it.
   Resolve the conflict to

   ```ts
   dev || testerGrant || (PRO_LAUNCHED && rcPro)
   ```

   where `dev` is `__DEV__` and the Developer switch, `testerGrant` is `useTesterPro()`
   (`apps/mobile/src/lib/tester-pro.ts`), and `rcPro` is `useProState().isPro`. The
   tester grant stays outside `PRO_LAUNCHED`, so testers keep Pro before launch.
