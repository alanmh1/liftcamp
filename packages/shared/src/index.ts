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
