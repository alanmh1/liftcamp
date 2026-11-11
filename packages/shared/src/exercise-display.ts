/**
 * Display helpers for an exercise's equipment and instructions, shared so the
 * web exercise pages and the mobile info sheet cannot drift apart.
 *
 * Nothing here renders. The web maps `EquipmentIconKind` to Lucide and its two
 * hand-drawn SVGs; mobile maps the same kinds to react-native-svg paths.
 */

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

/**
 * The `exercises.equipment` column holds lowercase source values ("barbell",
 * "body only"). Title-casing "e-z curl bar" word by word yields "E-z Curl Bar",
 * which reads as a typo, so values that do not survive naive title case get an
 * explicit label.
 */
const EQUIPMENT_LABEL_OVERRIDES: Record<string, string> = {
  "e-z curl bar": "EZ Bar",
  "body only": "Bodyweight",
  "foam roll": "Foam Roller",
};

export function formatEquipmentLabel(eq: string | null | undefined): string {
  if (!eq) return "";
  const k = eq.toLowerCase().trim();
  if (EQUIPMENT_LABEL_OVERRIDES[k]) return EQUIPMENT_LABEL_OVERRIDES[k];
  return k
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Equipment values in list order: A to Z by their display label, with
 * "other" last. The library's Equipment filter and the custom exercise
 * form both list equipment this way.
 */
export function sortEquipment<T extends string>(values: readonly T[]): T[] {
  const isOther = (v: string) => v.toLowerCase().trim() === "other";
  return [...values].sort((a, b) => {
    if (isOther(a) !== isOther(b)) return isOther(a) ? 1 : -1;
    return formatEquipmentLabel(a).localeCompare(formatEquipmentLabel(b));
  });
}

/**
 * True when an exercise passes a multi-select equipment filter: nothing
 * selected is no filter, otherwise its equipment is any selected value.
 */
export function matchesEquipment(equipment: string | null | undefined, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return equipment != null && selected.includes(equipment);
}

/**
 * The Equipment chip's value: null with nothing selected, the label for
 * one, the first label plus a count for several ("Bands +2"). The first is
 * the first in list order, so the chip reads the same whatever was tapped
 * first.
 */
export function equipmentChipLabel(selected: readonly string[]): string | null {
  if (selected.length === 0) return null;
  const [first] = sortEquipment(selected);
  const label = formatEquipmentLabel(first);
  return selected.length === 1 ? label : `${label} +${selected.length - 1}`;
}

export type EquipmentIconKind =
  | "smith"
  | "ezbar"
  | "dumbbell"
  | "barbell"
  | "kettlebell"
  | "cable"
  | "machine"
  | "body"
  | "band"
  | "other";

/**
 * Which glyph an equipment value gets.
 *
 * Order matters. "smith" precedes barbell because a Smith machine is a
 * fixed-path machine, not a free weight. The EZ bar precedes barbell for the
 * same reason it needs its own glyph at all: it is a distinct bar, and
 * matching "bar" first would swallow it.
 */
export function equipmentIconKind(equipment: string | null | undefined): EquipmentIconKind {
  if (!equipment) return "other";
  const k = equipment.toLowerCase();
  if (k.includes("smith")) return "smith";
  if (k.includes("e-z curl bar") || k.includes("ez bar") || k.includes("curl bar")) return "ezbar";
  if (k.includes("dumbbell")) return "dumbbell";
  if (k.includes("barbell")) return "barbell";
  if (k.includes("kettlebell")) return "kettlebell";
  if (k.includes("cable")) return "cable";
  if (k.includes("machine")) return "machine";
  if (k.includes("body")) return "body";
  if (k.includes("band")) return "band";
  return "other";
}

// ---------------------------------------------------------------------------
// Instructions
// ---------------------------------------------------------------------------

/**
 * The free-exercise-db descriptions bury "Tip:", "Note:" and "Caution:" asides
 * inside long step paragraphs, which is most of why the instructions read as a
 * wall of text. Splitting them out lets the UI give each one its own line with
 * a bold label.
 */
export type StepPart = { label: string | null; text: string };

const STEP_LABELS = /(?:^|\s)(Tip|Note|Caution|Variation|Variations|Warning)\s*:\s*/gi;

export function splitStepParts(step: string): StepPart[] {
  const src = step.trim();
  if (!src) return [];

  const parts: StepPart[] = [];
  let cursor = 0;
  let current: string | null = null;

  STEP_LABELS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STEP_LABELS.exec(src)) !== null) {
    const chunk = src.slice(cursor, m.index).trim();
    if (chunk) parts.push({ label: current, text: chunk });
    current = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    cursor = STEP_LABELS.lastIndex;
  }

  const tail = src.slice(cursor).trim();
  if (tail) parts.push({ label: current, text: tail });

  return parts.length > 0 ? parts : [{ label: null, text: src }];
}

/**
 * Splits a description column into trimmed, non-empty steps, one per line.
 * A description with no newlines is one step. Sentence boundaries are never
 * guessed at.
 */
export function parseSteps(description: string | null | undefined): string[] {
  if (!description) return [];
  return (
    description
      .split(/\r?\n/)
      .map((s) => s.trim())
      // Strip a leading "3." if the source already numbered the step, since the
      // UI supplies its own numbers.
      .map((s) => s.replace(/^\d+\s*[.)]\s*/, ""))
      .filter(Boolean)
  );
}
