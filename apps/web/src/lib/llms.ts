// /llms.txt, built from the same feed as the sitemap (getSeoCatalog) plus the
// guide registry, so the lists cannot go stale. The prose lives here; the
// per-item lines come from llms-notes.ts when a note exists, otherwise from
// the data.

import { appStoreUrl, canonMuscleList } from "@liftcamp/shared";
import type { SeoCatalog, SeoRoutine } from "./public-catalog.functions";
import { indexedExercises } from "./sitemap";
import { REGIONS, REGION_MUSCLES } from "./muscle-regions";
import { submusclePageFor } from "./submuscle-pages";
import { EQUIPMENT_PAGES } from "./equipment-pages";
import { firstSentence } from "./exercise-meta";
import { EXERCISE_NOTES, GUIDE_NOTES, ROUTINE_NOTES } from "./llms-notes";

const SITE = "https://liftcamp.app";

export type LlmsGuide = { slug: string; title: string; dek: string; category: string };

const HEADER = `# LiftCamp

> Free iPhone app and website for people in their first six months of lifting. Pick a routine, log sets in a tap, learn 900+ exercises with a starting weight for each, and keep a weekly streak. Written by one person who lifts.

LiftCamp is a free workout tracker and exercise library. The app is on the App Store for iPhone (Android is coming; the website works on any phone). It gives you a routine matched to your training days, experience and equipment, shows last session's numbers next to today's sets, starts the rest timer when you tick a set, marks personal records, and turns hitting your weekly target into a streak with medals at milestones. Logging, history, PRs, routines, the exercise library, the body diagram and share cards are free and stay free.

The exercise pages, routines and guides below are public and need no account. Each "explained" exercise page answers three questions a beginner has: what weight to start with, what usually goes wrong, and what to do instead when the equipment is taken. Guides answer the question at the top and explain the reasoning underneath. Everything is general fitness information, not medical advice.

App Store: ${appStoreUrl()}
Contact: hello@liftcamp.app`;

const PAGES = `## Pages

- [Home](${SITE}/): What LiftCamp does, screenshots, and the FAQ (free, no account needed to start, works offline, lbs or kg).
- [About](${SITE}/about): Who writes LiftCamp, how the library is built, and what it is not qualified to advise on.
- [LiftCamp in ChatGPT and Claude](${SITE}/mcp): The LiftCamp MCP server. Four read-only tools: find a routine, exercise guide, exercise swaps, strength level. How to connect, example prompts, privacy.`;

const routinesIntro = (n: number) =>
  `${n} free routines, each with every day's exercises, sets and reps on the page. Beginner routines run two or three days a week; the rest are for lifters who have outgrown a starter plan.`;

const libraryIntro = (total: number, explained: number) =>
  `${total} exercises with step-by-step instructions, equipment, difficulty and the muscles worked. The ${explained} pages listed below also carry a hand-written beginner block: a starting weight, the mistake that usually happens, and what to swap in when the station is busy. The one-line note after each link is that page's starting weight.`;

const GUIDES_INTRO =
  "Written for someone in their first few months. Each one answers the question at the top, then explains why.";

const OTHER = `## Other

- [Sitemap](${SITE}/sitemap.xml)
- [Privacy](${SITE}/privacy)
- [Terms](${SITE}/terms)`;

/** The note after a hub link, where one helps. */
const REGION_NOTES: Partial<Record<(typeof REGIONS)[number], string>> = {
  back: "Lats, upper back, lower back and traps.",
  arms: "Biceps, triceps and forearms.",
  legs: "Quads, hamstrings, glutes, calves, adductors and abductors.",
};

/** Routine groups, in output order. Equipment decides first; only full-gym
 *  routines split by level. */
const ROUTINE_GROUPS = [
  "Beginner, full gym",
  "Dumbbells only",
  "No equipment",
  "Resistance bands",
  "Intermediate and advanced",
] as const;

function routineGroup(r: SeoRoutine): (typeof ROUTINE_GROUPS)[number] {
  switch (r.equipment?.toLowerCase()) {
    case "dumbbells":
      return "Dumbbells only";
    case "bodyweight":
      return "No equipment";
    case "bands":
      return "Resistance bands";
    default:
      return r.level?.toLowerCase() === "beginner"
        ? "Beginner, full gym"
        : "Intermediate and advanced";
  }
}

/** Exercise groups by first primary muscle, in output order. Forearms means
 *  grip, which in this list is carries. */
const EXERCISE_GROUPS: readonly [string, readonly string[]][] = [
  ["Chest", ["chest"]],
  ["Shoulders", ["shoulders", "neck"]],
  ["Back", ["lats", "upper back", "lower back", "traps"]],
  ["Arms", ["biceps", "triceps"]],
  ["Legs", ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"]],
  ["Core and carries", ["abs", "forearms"]],
];

const GUIDE_CATEGORIES = ["Getting started", "Programming", "Technique"] as const;

/** Catalog names use " - " as a separator ("Dips - Chest Version"); a comma
 *  reads better in prose. */
function displayName(name: string): string {
  return name.replace(/\s+-\s+/g, ", ");
}

function sentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

function link(name: string, path: string, note?: string | null): string {
  return `- [${name}](${SITE}${path})${note ? `: ${note}` : ""}`;
}

/** "  - Back: [Lats](…), [Upper back](…), …" under a hub that has sub-muscle
 *  pages, in the hub's section order. Core lists lower back too, since its
 *  hub has that section. */
function submuscleLine(region: (typeof REGIONS)[number]): string[] {
  const pages = REGION_MUSCLES[region].map(submusclePageFor).filter((p) => p !== undefined);
  if (pages.length === 0) return [];
  return [
    `  - ${sentenceCase(region)}: ${pages
      .map((p) => `[${p.label}](${SITE}/exercises/${p.slug})`)
      .join(", ")}`,
  ];
}

function section(title: string, lines: string[]): string[] {
  return lines.length === 0 ? [] : [title, "", ...lines, ""];
}

export function llmsTxt(catalog: SeoCatalog, guides: LlmsGuide[]): string {
  const out: string[] = [HEADER, "", PAGES, ""];

  out.push("## Routines", "", routinesIntro(catalog.routines.length), "");
  out.push(
    link("All routines", "/routines", "Filter by days per week, experience and equipment."),
    "",
  );
  for (const group of ROUTINE_GROUPS) {
    const lines = catalog.routines
      .filter((r) => routineGroup(r) === group)
      .map((r) =>
        link(
          r.program,
          `/routines/${r.slug}`,
          ROUTINE_NOTES[r.slug] ?? (r.blurb ? firstSentence(r.blurb) : null),
        ),
      );
    out.push(...section(group, lines));
  }

  const explained = indexedExercises(catalog.exercises);
  out.push("## Exercise library", "", libraryIntro(catalog.exercises.length, explained.length), "");
  out.push(
    "Browse",
    "",
    link("All exercises", "/exercises", "Search, or browse by muscle or equipment."),
    ...REGIONS.flatMap((r) => [
      link(sentenceCase(r), `/exercises/${r}`, REGION_NOTES[r]),
      ...submuscleLine(r),
    ]),
    `- By equipment: ${Object.values(EQUIPMENT_PAGES)
      .map((p) => `[${sentenceCase(p.label)}](${SITE}/exercises/${p.slug})`)
      .join(", ")}`,
    "",
  );
  for (const [title, muscles] of EXERCISE_GROUPS) {
    const lines = explained
      .filter((e) => {
        const first = canonMuscleList(e.all_primary_muscles || e.primary_muscle)[0];
        return !!first && muscles.includes(first);
      })
      .map((e) =>
        link(
          displayName(e.name),
          `/exercises/${e.slug}`,
          EXERCISE_NOTES[e.slug] ?? firstSentence(e.starting_weight_md ?? ""),
        ),
      );
    out.push(...section(title, lines));
  }

  out.push("## Guides", "", GUIDES_INTRO, "", link("All guides", "/guides"), "");
  for (const category of GUIDE_CATEGORIES) {
    const lines = guides
      .filter((g) => g.category === category)
      .map((g) => link(g.title, `/guides/${g.slug}`, GUIDE_NOTES[g.slug] ?? g.dek));
    out.push(...section(category, lines));
  }

  out.push(OTHER, "");
  return out.join("\n");
}
