// Numbers in prose, AP style: one through nine and first through ninth are
// spelled out, 10 and up are digits. Prose only, meaning sentences, titles
// and headlines ("Your first workout", "Save your three workouts").
// Weights, reps, stats, meta lines and dates stay as digits everywhere.

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const ORDINAL_WORDS = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];

/** "three", "10", "250". Integers; anything else prints as given. */
export function proseNumber(n: number): string {
  return Number.isInteger(n) && n >= 0 && n <= 9 ? WORDS[n] : String(n);
}

/** "first", "ninth", "10th", "21st", "112th". */
export function proseOrdinal(n: number): string {
  if (Number.isInteger(n) && n >= 1 && n <= 9) return ORDINAL_WORDS[n];
  const rem100 = Math.abs(n) % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = Math.abs(n) % 10;
  return `${n}${rem10 === 1 ? "st" : rem10 === 2 ? "nd" : rem10 === 3 ? "rd" : "th"}`;
}

/** "one workout", "three workouts", "12 workouts". Plural is `${singular}s` unless given. */
export function proseCount(n: number, singular: string, plural = `${singular}s`): string {
  return `${proseNumber(n)} ${n === 1 ? singular : plural}`;
}
