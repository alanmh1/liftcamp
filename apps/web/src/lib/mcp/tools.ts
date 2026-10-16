import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  canonMuscleList,
  convertWeight,
  EQUIPMENT_ACCESS,
  formatEquipmentLabel,
  formatSetTarget,
  muscleLabel,
  oneRepMaxNumeric,
  programMatches,
  rankPrograms,
  roundForDisplay,
  roundLoadNearest,
  roundLoadUp,
  STRENGTH_LEVELS,
  STRENGTH_STANDARDS,
  strengthLevel,
  strengthThresholds,
  templateLevelLabel,
  TRAINING_LEVELS,
  type EquipmentAccess,
  type ProgramGroup,
  type TemplateRow,
  type TrainingLevel,
  type WeightUnit,
} from "@liftcamp/shared";
import { resolveDifficulty } from "@/lib/routine-prescription";
import { routineAnswer } from "@/lib/routine-copy";
import type { Catalog, IndexExercise } from "./catalog";
import { siteLink, startLine, type McpSource } from "./links";
import {
  resolveExercise,
  resolveLift,
  supportedLiftNames,
  type ExerciseResolution,
} from "./resolve";

const DISCLAIMER =
  "Answers are general fitness information from LiftCamp's public catalog. This tool does not give medical or injury advice.";

const ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

/** How many routines find_routine returns. */
export const ROUTINE_RESULTS = 3;
/** How many catalog swaps follow the authored ones. */
export const EXTRA_SWAPS = 5;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function text(body: string): ToolResult {
  return { content: [{ type: "text", text: body }] };
}

function equipmentLabel(raw: string | null | undefined): string {
  return formatEquipmentLabel(raw) || "No equipment listed";
}

function musclesLabel(raw: string | null | undefined, except: string[] = []): string {
  return canonMuscleList(raw)
    .filter((m) => !except.includes(m))
    .map(muscleLabel)
    .join(", ");
}

/** Lowercase words of a name, for ranking swaps that look like the lift. */
function nameWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
}

// ---------------------------------------------------------------------------
// find_routine
// ---------------------------------------------------------------------------

export type RoutineAnswers = {
  days_per_week?: number;
  equipment?: EquipmentAccess;
  level?: TrainingLevel;
};

function routineBlock(group: ProgramGroup, rank: number, source: McpSource): string {
  const first = group.templates[0]!;
  const slug = group.templates.find((t) => t.program_slug)?.program_slug ?? "";
  const days = first.days_per_week ?? group.templates.length;
  const level = resolveDifficulty(first.level, slug, days);
  const kit = first.equipment ? equipmentLabel(first.equipment) : null;

  const lines = [
    `## ${rank}. ${group.program}${rank === 1 ? " (Recommended)" : ""}`,
    [level, `${days} day${days === 1 ? "" : "s"} a week`, kit].filter(Boolean).join(" · "),
  ];
  if (group.blurb) lines.push("", group.blurb);
  const answer = routineAnswer(slug);
  if (answer) lines.push("", answer);

  for (const day of group.templates) {
    lines.push("", `**${day.name}**`);
    for (const te of [...day.template_exercises].sort((a, b) => a.position - b.position)) {
      const name = te.exercises?.name;
      if (!name) continue;
      const target = formatSetTarget({
        sets: te.target_sets ?? null,
        reps: te.target_reps ?? null,
      });
      lines.push(`- ${target ? `${name}, ${target}` : name}`);
    }
  }
  lines.push("", `[Full routine on LiftCamp](${siteLink(`/routines/${slug}`, source)})`);
  return lines.join("\n");
}

/** The top three routines for the answers, as the tool's markdown. */
export function findRoutineText(
  rows: TemplateRow[],
  answers: RoutineAnswers,
  source: McpSource,
): string {
  const ranked = rankPrograms(rows, {
    level: answers.level ?? null,
    equipment: answers.equipment ?? null,
    days: answers.days_per_week ?? null,
  })
    // A program with no slug has no page to link, the same rule as /routines.
    .filter((g) => g.templates.some((t) => t.program_slug))
    .slice(0, ROUTINE_RESULTS);

  if (ranked.length === 0) {
    return ["No routines are available right now.", "", startLine("/routines", source)].join("\n");
  }

  const top = ranked[0]!;
  const topDays = top.templates[0]?.days_per_week ?? top.templates.length;
  const exact =
    programMatches(top, { level: answers.level ?? null, equipment: answers.equipment ?? null }) &&
    (answers.days_per_week == null || topDays === answers.days_per_week);

  const parts: string[] = [];
  if (!exact) parts.push("No routine matches every answer, so these are the nearest fits.");
  parts.push(...ranked.map((g, i) => routineBlock(g, i + 1, source)));
  const slug = top.templates.find((t) => t.program_slug)?.program_slug ?? "";
  parts.push(startLine(`/routines/${slug}`, source));
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// exercise_guide and exercise_swaps
// ---------------------------------------------------------------------------

function unresolvedText(
  query: string,
  res: Exclude<ExerciseResolution, { kind: "match" }>,
  source: McpSource,
): string {
  if (res.kind === "none") {
    return [
      `No exercise in the LiftCamp catalog matches "${query}". Try a shorter name, such as "squat" or "row".`,
      "",
      startLine("/exercises", source),
    ].join("\n");
  }
  return [
    `Several exercises match "${query}". Which one do you mean?`,
    "",
    ...res.candidates.map(
      (e) => `- ${e.name} (slug \`${e.slug}\`, ${equipmentLabel(e.equipment)})`,
    ),
    "",
    startLine("/exercises", source),
  ].join("\n");
}

export async function exerciseGuideText(
  catalog: Catalog,
  query: string,
  source: McpSource,
): Promise<string> {
  const res = resolveExercise(await catalog.exerciseIndex(), query);
  if (res.kind !== "match") return unresolvedText(query, res, source);

  const [detail, note] = await Promise.all([
    catalog.exerciseDetail(res.exercise.id),
    catalog.beginnerNote(res.exercise.id),
  ]);
  if (!detail) return unresolvedText(query, { kind: "none" }, source);

  const path = `/exercises/${detail.slug}`;
  const primary = detail.all_primary_muscles || detail.primary_muscle;
  // The dataset often lists a primary muscle again as secondary.
  const secondary = musclesLabel(detail.secondary_muscles, canonMuscleList(primary));
  const facts = [
    `Primary muscles: ${musclesLabel(primary) || "not listed"}`,
    secondary ? `Secondary: ${secondary}` : null,
    `Equipment: ${equipmentLabel(detail.equipment)}`,
    detail.level ? `Level: ${templateLevelLabel(detail.level)}` : null,
  ].filter(Boolean);

  const lines = [`# ${detail.name}`, facts.join(" · ")];
  if (detail.image_url) lines.push("", `![${detail.name}](${detail.image_url})`);
  if (detail.description) lines.push("", "## How to do it", detail.description.trim());

  if (note) {
    lines.push("", "## Starting weight", note.starting_weight_md.trim());
    lines.push("", "## Form", note.form_breakdown_md.trim());
    lines.push("", "## Swaps", note.substitution_md.trim());
    const index = await catalog.exerciseIndex();
    const byId = new Map(index.map((e) => [e.id, e]));
    for (const id of note.substitute_exercise_ids) {
      const sub = byId.get(id);
      if (sub) {
        lines.push(
          `- [${sub.name}](${siteLink(`/exercises/${sub.slug}`, source)}), ${equipmentLabel(sub.equipment)}`,
        );
      }
    }
  }

  lines.push(
    "",
    `[${detail.name} on LiftCamp](${siteLink(path, source)})`,
    "",
    startLine(path, source),
  );
  return lines.join("\n");
}

/** `exercises.equipment` values each swap filter accepts. Gym is everything. */
export const SWAP_EQUIPMENT = {
  gym: null,
  dumbbells: ["dumbbell"],
  bodyweight: ["body only"],
  bands: ["bands"],
  cables: ["cable"],
  machines: ["machine", "smith machine"],
} as const satisfies Record<string, readonly string[] | null>;
export type SwapEquipment = keyof typeof SWAP_EQUIPMENT;

/** Explosive and conditioning lifts share a primary muscle with strength
 *  lifts but are no swap for one: a Romanian deadlift is not a swing. */
const NOT_A_SWAP = /\b(swings?|cleans?|snatch(es)?|jerks?|thrusters?|burpees?)\b/i;

function fitsEquipment(e: IndexExercise, equipment: SwapEquipment | undefined): boolean {
  const allowed = equipment ? SWAP_EQUIPMENT[equipment] : null;
  return !allowed || (allowed as readonly string[]).includes(e.equipment ?? "");
}

export async function exerciseSwapsText(
  catalog: Catalog,
  query: string,
  equipment: SwapEquipment | undefined,
  source: McpSource,
): Promise<string> {
  const index = await catalog.exerciseIndex();
  const res = resolveExercise(index, query);
  if (res.kind !== "match") return unresolvedText(query, res, source);
  const target = res.exercise;
  const note = await catalog.beginnerNote(target.id);
  const byId = new Map(index.map((e) => [e.id, e]));

  const authored = (note?.substitute_exercise_ids ?? [])
    .map((id) => byId.get(id))
    .filter((e): e is IndexExercise => !!e && e.id !== target.id && fitsEquipment(e, equipment));
  const taken = new Set([target.id, ...authored.map((e) => e.id)]);
  // Same muscle first by how much the name shares with the lift, so a
  // Romanian deadlift lists other deadlifts before kettlebell swings.
  const words = nameWords(target.name);
  const shared = (e: IndexExercise) => [...nameWords(e.name)].filter((w) => words.has(w)).length;
  const extra = target.primary_muscle
    ? index
        .filter(
          (e) =>
            !taken.has(e.id) &&
            e.primary_muscle === target.primary_muscle &&
            (!target.mechanic || e.mechanic === target.mechanic) &&
            !NOT_A_SWAP.test(e.name) &&
            fitsEquipment(e, equipment),
        )
        .sort(
          (a, b) =>
            shared(b) - shared(a) ||
            Number(b.has_notes) - Number(a.has_notes) ||
            Number(b.level === "beginner") - Number(a.level === "beginner") ||
            a.name.localeCompare(b.name),
        )
        .slice(0, EXTRA_SWAPS)
    : [];

  const muscle = muscleLabel(target.primary_muscle);
  const line = (e: IndexExercise, reason: string) =>
    `- [${e.name}](${siteLink(`/exercises/${e.slug}`, source)}), ${equipmentLabel(e.equipment)}. ${reason}`;

  const kit = equipment ? ` using ${equipment}` : "";
  const lines = [`# Swaps for ${target.name}${kit}`];
  if (authored.length + extra.length === 0) {
    lines.push(
      "",
      `The catalog has no other ${muscle.toLowerCase() || "matching"} exercise${kit}.`,
    );
  } else {
    lines.push("");
    for (const e of authored)
      lines.push(line(e, `From LiftCamp's beginner note for ${target.name}.`));
    for (const e of extra) lines.push(line(e, `Same primary muscle (${muscle}).`));
  }
  lines.push("", startLine(`/exercises/${target.slug}`, source));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// strength_level
// ---------------------------------------------------------------------------

export type StrengthInput = {
  lift: string;
  weight: number;
  reps: number;
  unit: WeightUnit;
  sex: "male" | "female";
  bodyweight: number;
  age?: number;
};

const LOAD_NOTE = {
  bar: "The weight is the whole bar, plates included.",
  stack: "The weight is the number on the stack.",
  "one dumbbell": "The weight is one dumbbell.",
} as const;

/** The seven lifts' slugs, for the closing link. Matches STRENGTH_EXERCISES. */
const LIFT_SLUGS: Record<string, string> = {
  "85495e85-bd72-445d-a6c8-5961f17ec2e5": "barbell-squat",
  "d5f93fa3-b43b-4306-8081-ee5bff0d4ca6": "barbell-bench-press",
  "034ebb98-56b3-4073-a726-1709d14b4455": "barbell-deadlift",
  "83e390eb-2f53-427e-8870-2997eb172279": "standing-military-press",
  "7492d613-b2ff-41c0-9131-af0bb9832438": "bent-over-barbell-row",
  "21e9e394-1151-4a07-bb3a-2fd487e461dd": "romanian-deadlift",
  "653288a1-8c39-4840-a2bc-c6eb64790c82": "wide-grip-lat-pulldown",
};

export function strengthLevelText(input: StrengthInput, source: McpSource): string {
  const id = resolveLift(input.lift);
  const standard = id ? STRENGTH_STANDARDS[id] : undefined;
  if (!id || !standard) {
    return [
      `LiftCamp has strength levels for seven lifts, and "${input.lift}" is not one of them:`,
      "",
      ...supportedLiftNames().map((n) => `- ${n}`),
      "",
      startLine("/exercises", source),
    ].join("\n");
  }

  const { unit } = input;
  const bodyweightKg = convertWeight(input.bodyweight, unit, "kg");
  // A single is the max itself; Epley would add 3.3% to it.
  const weightKg = convertWeight(input.weight, unit, "kg");
  const maxKg = input.reps === 1 ? weightKg : oneRepMaxNumeric(weightKg, input.reps);
  const thresholds = strengthThresholds(id, input.sex, bodyweightKg, input.age ?? null);
  const path = `/exercises/${LIFT_SLUGS[id] ?? ""}`;
  if (maxKg == null || !thresholds) {
    return [
      "That weight and bodyweight do not give a level. Check both are above zero.",
      "",
      startLine(path, source),
    ].join("\n");
  }

  const u = unit === "lb" ? "lb" : "kg";
  const show = (kg: number) => roundLoadNearest(convertWeight(kg, "kg", unit), unit);
  const level = strengthLevel(maxKg, thresholds);
  const max = roundForDisplay(convertWeight(maxKg, "kg", unit), unit);

  const lines = [
    `# ${standard.name}: ${level.level}`,
    "",
    input.reps === 1
      ? `Max: your 1-rep max of ${input.weight} ${u}.`
      : `Estimated max: ${max} ${u} (from ${input.weight} ${u} × ${input.reps}, Epley formula).`,
  ];
  if (level.next && level.toNext != null) {
    const gap = roundLoadUp(convertWeight(level.toNext, "kg", unit), unit);
    lines.push(
      `Next level: ${level.next} at ${show(thresholds[level.index]!)} ${u}, ${gap} ${u} above your ${input.reps === 1 ? "" : "estimated "}max.`,
    );
  } else {
    lines.push("This is the top level.");
  }

  lines.push("", "| Level | Estimated max |", "| --- | --- |");
  STRENGTH_LEVELS.forEach((name, i) => {
    const range =
      i === 0
        ? `under ${show(thresholds[0])} ${u}`
        : i === STRENGTH_LEVELS.length - 1
          ? `${show(thresholds[i - 1]!)} ${u} and up`
          : `${show(thresholds[i - 1]!)} to ${show(thresholds[i]!)} ${u}`;
    lines.push(
      i === level.index ? `| **${name}** (you) | **${range}** |` : `| ${name} | ${range} |`,
    );
  });

  const who = `a ${input.sex} lifter at ${input.bodyweight} ${u} bodyweight${input.age != null ? `, age ${input.age}` : ""}`;
  lines.push(
    "",
    LOAD_NOTE[standard.load],
    `These are LiftCamp's own standards, scaled for ${who}. The LiftCamp app shows your progress toward the next level as you log sets.`,
    "",
    `[${standard.name} on LiftCamp](${siteLink(path, source)})`,
    "",
    startLine(path, source),
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

async function run(fn: () => Promise<string> | string): Promise<ToolResult> {
  try {
    return text(await fn());
  } catch (err) {
    console.error("mcp tool failed", err);
    return {
      ...text("The LiftCamp catalog could not be read just now. Try again in a minute."),
      isError: true,
    };
  }
}

export function registerTools(server: McpServer, source: McpSource, catalog: Catalog): void {
  server.registerTool(
    "find_routine",
    {
      title: "Find a workout routine",
      description: `Recommends up to three free LiftCamp workout routines for a days-per-week, equipment and experience level, with every day's exercises, sets and reps. The first is the best fit. ${DISCLAIMER}`,
      inputSchema: {
        days_per_week: z
          .number()
          .int()
          .min(2)
          .max(6)
          .optional()
          .describe("Training days a week, 2 to 6."),
        equipment: z
          .enum(EQUIPMENT_ACCESS)
          .optional()
          .describe("What the person has: a full gym, dumbbells, bodyweight only, or bands."),
        level: z
          .enum(TRAINING_LEVELS)
          .optional()
          .describe("Beginner is new or under 6 months of training."),
      },
      annotations: { title: "Find a workout routine", ...ANNOTATIONS },
    },
    (args) => run(async () => findRoutineText(await catalog.routineRows(), args, source)),
  );

  server.registerTool(
    "exercise_guide",
    {
      title: "Exercise guide",
      description: `How to do one exercise from LiftCamp's library: muscles, equipment, steps, and for authored exercises a beginner starting weight, form cues and swaps. If several exercises match, it lists them and asks which. ${DISCLAIMER}`,
      inputSchema: {
        query: z
          .string()
          .min(2)
          .max(80)
          .describe('Exercise name or slug, such as "Romanian deadlift".'),
      },
      annotations: { title: "Exercise guide", ...ANNOTATIONS },
    },
    ({ query }) => run(() => exerciseGuideText(catalog, query, source)),
  );

  server.registerTool(
    "exercise_swaps",
    {
      title: "Exercise swaps",
      description: `Alternatives to an exercise that train the same primary muscle, optionally limited to one kind of equipment (for example, no barbell, dumbbells only). Authored swaps come first. ${DISCLAIMER}`,
      inputSchema: {
        query: z.string().min(2).max(80).describe("The exercise to replace."),
        equipment: z
          .enum(Object.keys(SWAP_EQUIPMENT) as [SwapEquipment, ...SwapEquipment[]])
          .optional()
          .describe("Only list swaps using this equipment. Gym means any."),
      },
      annotations: { title: "Exercise swaps", ...ANNOTATIONS },
    },
    ({ query, equipment }) => run(() => exerciseSwapsText(catalog, query, equipment, source)),
  );

  server.registerTool(
    "strength_level",
    {
      title: "Strength level",
      description: `Estimates a one-rep max from a set and places it on LiftCamp's five strength levels (Beginner to Elite) for the lifter's sex, bodyweight and age. Supports squat, bench press, deadlift, overhead press, barbell row, Romanian deadlift and lat pulldown. ${DISCLAIMER}`,
      inputSchema: {
        lift: z
          .string()
          .min(2)
          .max(80)
          .describe('The lift, such as "bench" or "Romanian deadlift".'),
        weight: z.number().positive().max(2000).describe("Weight lifted, in `unit`."),
        reps: z.number().int().min(1).max(12).default(1).describe("Reps in the set, 1 to 12."),
        unit: z.enum(["lb", "kg"]).default("lb"),
        sex: z.enum(["male", "female"]),
        bodyweight: z
          .number()
          .positive()
          .max(1000)
          .describe("Bodyweight, in the same unit as the weight."),
        age: z.number().int().min(10).max(100).optional(),
      },
      annotations: { title: "Strength level", ...ANNOTATIONS },
    },
    (args) => run(() => strengthLevelText(args, source)),
  );
}
