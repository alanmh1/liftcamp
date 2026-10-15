// Platform-independent logic shared by apps/web and apps/mobile.
//
// Everything here must run unchanged in a browser and in React Native. No
// React, no TanStack Query, no TanStack Start server functions, no `window`,
// no `document`, and no Supabase client instance. Pure functions and types
// only; each app owns its own data fetching and storage.
export * from "./prior-session";
export * from "./set-weight";
export * from "./one-rep-max";
export * from "./one-rep-max-model";
export * from "./pr";
export * from "./muscle-vocab";
export * from "./suggestions";
export * from "./supabase";
export * from "./generate-workout";
export * from "./templates";
export * from "./exercise-display";
export * from "./format-duration";
export * from "./username";
export * from "./volume-comparisons";
export * from "./body-diagram";
export * from "./body-layers";
export * from "./exercise-progress";
export * from "./routine-art";
export * from "./units";
export * from "./strength-standards";
export * from "./dumbbell-load";
export * from "./birthday";
export * from "./setup-checklist";
export * from "./links";
export * from "./start-gate";
export * from "./tester-entitlement";
export * from "./set-placeholder";
export * from "./profile-stats";
export * from "./onboarding-state";
export * from "./generation-cache";
export * from "./account-deletion";
export * from "./sign-in-lines";
export * from "./copy-numbers";
export * from "./medals";
export * from "./streak-walk";
export * from "./week-card";
export * from "./workout-progress";
export * from "./weeks";
export * from "./month-calendar";
export * from "./workout-subtitle";
export * from "./write-queue";
export * from "./write-queue-runner";
export * from "./guest-merge";
export * from "./pending-overlay";
export * from "./start-plan";
export * from "./repeat-start";
export * from "./home-pending";
export * from "./auth-session";
export * from "./progression";
export * from "./progression-guide";
export * from "./keypad-step";
export * from "./social";
export * from "./nav-targets";
export * from "./routine-from-workout";
export * from "./set-focus";
export * from "./bodyweight-label";
export * from "./workout-notes";

// Generated from the live Supabase project (ref mnsigwjyskxfuszeegtp).
// Regenerate with:
//   npx supabase gen types typescript --project-id mnsigwjyskxfuszeegtp \
//     > packages/shared/src/database.types.ts
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "./database.types";
export { Constants } from "./database.types";
