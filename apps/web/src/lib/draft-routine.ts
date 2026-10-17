/**
 * The routine builder's draft, held only in localStorage: no account, no
 * network. It survives a reload so a visitor can come back to what they built.
 */

const KEY = "liftcamp:draft-routine";

export type DraftExercise = {
  id: string;
  name: string;
  equipment: string | null;
};

export type DraftRoutine = {
  name: string;
  exercises: DraftExercise[];
  updatedAt: number;
};

export function readDraftRoutine(): DraftRoutine | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftRoutine;
    if (!Array.isArray(parsed?.exercises)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraftRoutine(draft: DraftRoutine) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* private mode, quota — the builder still works for the session */
  }
}

export function clearDraftRoutine() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
