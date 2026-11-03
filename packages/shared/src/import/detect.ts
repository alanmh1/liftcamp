import { detectDelimiter, parseCsv } from "./csv";
import { FITBOD_HEADER, parseFitbod } from "./fitbod";
import { parseHevy } from "./hevy";
import type { ImportSource } from "./plan";
import type { ImportParse } from "./row";
import { parseStrong } from "./strong";

/** The header row alone, trimmed and lower-cased. */
function headerOf(text: string): string[] {
  const end = text.search(/\r|\n/);
  const first = end === -1 ? text : text.slice(0, end);
  const [row] = parseCsv(first, detectDelimiter(first));
  return (row ?? []).map((h) => h.trim().toLowerCase());
}

/** Which app wrote a file, from its header alone. Null when it is none of the three. */
export function detectSource(text: string): ImportSource | null {
  const header = headerOf(text);
  const has = (name: string) => header.includes(name);
  if (header.length === FITBOD_HEADER.length && FITBOD_HEADER.every((h, i) => header[i] === h.toLowerCase())) {
    return "fitbod";
  }
  if (has("title") && has("start_time") && has("exercise_title")) return "hevy";
  if (has("date") && has("exercise name") && has("set order")) return "strong";
  return null;
}

/** A file detected and parsed by its own parser. */
export type DetectedImport = { source: ImportSource } & Extract<ImportParse, { ok: true }>;

/**
 * Detects the source and runs its parser. Null when no parser accepts the
 * file. Fitbod has one variant and always knows its unit.
 */
export function parseImportFile(text: string): DetectedImport | null {
  const source = detectSource(text);
  if (source === "fitbod") {
    const p = parseFitbod(text);
    return p.ok ? { source, ok: true, rows: p.rows, variant: "fitbod", unitKnown: true } : null;
  }
  if (source === "strong") {
    const p = parseStrong(text);
    return p.ok ? { source, ...p } : null;
  }
  if (source === "hevy") {
    const p = parseHevy(text);
    return p.ok ? { source, ...p } : null;
  }
  return null;
}
