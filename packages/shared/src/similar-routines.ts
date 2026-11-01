/**
 * "Other routines" on a routine page: the three siblings most like the
 * current one, picked the same way on every request so the internal links
 * between routine pages are stable.
 *
 * Ranking, for each candidate other than the current routine:
 *   1. the same days per week first
 *   2. then more equipment in common
 *   3. then the nearest program_order
 *   4. then the lower program_order, then the slug, so ties never depend on
 *      input order
 *
 * The plain ranking can leave a routine that no page links to (on the live
 * catalog in Nov 2026, Dumbbell Upper / Lower and Full Body with Bands). So
 * picks are made for the whole catalog at once, and a repair pass gives every
 * such routine one inbound link: it takes the last slot of the page that
 * ranks it highest, from a routine that still has another inbound link.
 */
export type SimilarRoutineInput = {
  slug: string;
  daysPerWeek: number;
  /** Equipment labels; compared as exact strings. */
  equipment: readonly string[];
  /** templates.program_order. */
  order: number;
};

function compareCandidates(current: SimilarRoutineInput) {
  const shared = (r: SimilarRoutineInput) =>
    r.equipment.filter((e) => current.equipment.includes(e)).length;
  return (a: SimilarRoutineInput, b: SimilarRoutineInput): number => {
    const days =
      Number(a.daysPerWeek !== current.daysPerWeek) -
      Number(b.daysPerWeek !== current.daysPerWeek);
    if (days !== 0) return days;
    const equipment = shared(b) - shared(a);
    if (equipment !== 0) return equipment;
    const distance =
      Math.abs(a.order - current.order) - Math.abs(b.order - current.order);
    if (distance !== 0) return distance;
    if (a.order !== b.order) return a.order - b.order;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  };
}

/** Every other routine, most similar first. */
export function rankSimilarRoutines<T extends SimilarRoutineInput>(
  current: T,
  all: readonly T[],
): T[] {
  return all
    .filter((r) => r.slug !== current.slug)
    .sort(compareCandidates(current));
}

/** Picks for every routine, keyed by slug, with the coverage repair applied.
 *  Each list holds up to `count` slugs, most similar first. */
export function similarRoutinePicks(
  all: readonly SimilarRoutineInput[],
  count = 3,
): Map<string, string[]> {
  const rankings = new Map(
    all.map((r) => [r.slug, rankSimilarRoutines(r, all).map((o) => o.slug)]),
  );
  const picks = new Map(
    [...rankings].map(([slug, ranked]) => [slug, ranked.slice(0, count)]),
  );
  if (count === 0) return picks;

  const inbound = new Map(all.map((r) => [r.slug, 0]));
  for (const list of picks.values())
    for (const s of list) inbound.set(s, (inbound.get(s) ?? 0) + 1);

  // Orphans in catalog order, so the result does not depend on input order.
  const orphans = [...all]
    .sort((a, b) => a.order - b.order || (a.slug < b.slug ? -1 : 1))
    .filter((r) => inbound.get(r.slug) === 0);

  for (const orphan of orphans) {
    let best: { host: string; rank: number; order: number } | null = null;
    for (const host of all) {
      if (host.slug === orphan.slug) continue;
      const list = picks.get(host.slug)!;
      if (list.length < count) continue;
      const last = list[list.length - 1]!;
      // Never orphan the routine being displaced, and never displace a
      // routine that a previous repair put there.
      if ((inbound.get(last) ?? 0) < 2) continue;
      if (orphans.some((o) => o.slug === last)) continue;
      const rank = rankings.get(host.slug)!.indexOf(orphan.slug);
      if (
        !best ||
        rank < best.rank ||
        (rank === best.rank && host.order < best.order) ||
        (rank === best.rank &&
          host.order === best.order &&
          host.slug < best.host)
      ) {
        best = { host: host.slug, rank, order: host.order };
      }
    }
    if (!best) continue;
    const list = picks.get(best.host)!;
    const displaced = list[list.length - 1]!;
    list[list.length - 1] = orphan.slug;
    inbound.set(displaced, inbound.get(displaced)! - 1);
    inbound.set(orphan.slug, 1);
  }
  return picks;
}

/** How many routine pages link to each routine through its picks. */
export function similarRoutineInbound(
  picks: Map<string, string[]>,
): Map<string, number> {
  const inbound = new Map([...picks.keys()].map((s) => [s, 0]));
  for (const list of picks.values())
    for (const s of list) inbound.set(s, (inbound.get(s) ?? 0) + 1);
  return inbound;
}
