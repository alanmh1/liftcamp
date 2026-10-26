// Where a person found LiftCamp, and how far they got. The keys match the
// CHECK on public.user_sources (docs/funnel-people.sql); the stages match
// the ladder admin_people() computes. Read by /admin.

/** Offered in the app, in this order. */
export const USER_SOURCES = [
  { key: "app_store", label: "App Store" },
  { key: "reddit", label: "Reddit" },
  { key: "friend", label: "A friend" },
  { key: "web", label: "Google or the website" },
  { key: "chatbot", label: "ChatGPT or Claude" },
  { key: "social", label: "Instagram or TikTok" },
  { key: "other", label: "Somewhere else" },
] as const;

/** Admin only, on top of USER_SOURCES. */
export const ADMIN_SOURCES = [
  { key: "app_review", label: "App Review" },
  { key: "tester", label: "Tester" },
  { key: "flier", label: "Gym flier" },
  { key: "trainer", label: "Trainer" },
  { key: "unknown", label: "Unknown" },
] as const;

export type UserSourceKey = (typeof USER_SOURCES)[number]["key"];
export type SourceKey = UserSourceKey | (typeof ADMIN_SOURCES)[number]["key"];

export const STAGES = [
  { stage: 0, key: "started", label: "Got started" },
  { stage: 1, key: "routine", label: "Picked a routine" },
  { stage: 2, key: "workout", label: "Started a workout" },
  { stage: 3, key: "set", label: "Logged a set" },
  { stage: 4, key: "finished", label: "Finished a workout" },
  { stage: 5, key: "second", label: "Second workout" },
] as const;

const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  [...USER_SOURCES, ...ADMIN_SOURCES].map((s) => [s.key, s.label]),
);

/** The label for a source key; an unknown key shows as itself, none as null. */
export function sourceLabel(key: string | null): string | null {
  if (!key) return null;
  return SOURCE_LABELS[key] ?? key;
}
