/**
 * The free-exercise-db descriptions bury "Tip:", "Note:" and "Caution:" asides
 * inside long step paragraphs, which is most of why the instructions read as a
 * wall of text. Splitting them out lets the UI give each one its own line with
 * a bold label.
 */

export type StepPart = { label: string | null; text: string };

const LABELS = /(?:^|\s)(Tip|Note|Caution|Variation|Variations|Warning)\s*:\s*/gi;

export function splitStepParts(step: string): StepPart[] {
  const src = step.trim();
  if (!src) return [];

  const parts: StepPart[] = [];
  let cursor = 0;
  let current: string | null = null;

  LABELS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LABELS.exec(src)) !== null) {
    const chunk = src.slice(cursor, m.index).trim();
    if (chunk) parts.push({ label: current, text: chunk });
    current = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    cursor = LABELS.lastIndex;
  }

  const tail = src.slice(cursor).trim();
  if (tail) parts.push({ label: current, text: tail });

  return parts.length > 0 ? parts : [{ label: null, text: src }];
}

/** Splits a description column into trimmed, non-empty steps. */
export function parseSteps(description: string | null | undefined): string[] {
  if (!description) return [];
  return description
    .split(/\r?\n/)
    .map((s) => s.trim())
    // Strip a leading "3." if the source already numbered the step, since the
    // UI supplies its own numbers.
    .map((s) => s.replace(/^\d+\s*[.)]\s*/, ""))
    .filter(Boolean);
}
