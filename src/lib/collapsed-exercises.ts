// Which exercises are collapsed ("done") in a given workout. Kept in
// localStorage so a refresh mid-session doesn't re-expand everything you've
// already finished.

const key = (workoutId: string) => `liftcamp:collapsed:${workoutId}`;

function read(workoutId: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key(workoutId));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function isCollapsed(workoutId: string, weId: string): boolean {
  return read(workoutId).has(weId);
}

export function setCollapsed(workoutId: string, weId: string, collapsed: boolean) {
  if (typeof localStorage === "undefined") return;
  const set = read(workoutId);
  if (collapsed) set.add(weId);
  else set.delete(weId);
  try {
    localStorage.setItem(key(workoutId), JSON.stringify([...set]));
  } catch {
    /* storage full or blocked; collapse just won't persist */
  }
}
