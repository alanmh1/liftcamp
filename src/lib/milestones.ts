// Lightweight milestone detection for finished workouts. Purely
// presentational: we celebrate round numbers so regular logging feels
// rewarding without adding any new state to the database.

export type Milestone = { title: string; description: string };

const WORKOUT_MILESTONES = [1, 5, 10, 25, 50, 100, 150, 200, 250, 300, 365, 500];
const VOLUME_MILESTONES = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

export function workoutMilestone(count: number): Milestone | null {
  if (!WORKOUT_MILESTONES.includes(count)) return null;
  if (count === 1) {
    return { title: "First workout logged", description: "Nice start — consistency is the whole game." };
  }
  return {
    title: `${count} workouts logged`,
    description: "That's real mileage. Keep stacking sessions.",
  };
}

export function volumeMilestone(
  totalBefore: number,
  totalAfter: number,
  unit: string,
): Milestone | null {
  const crossed = VOLUME_MILESTONES.filter((m) => totalBefore < m && totalAfter >= m);
  if (crossed.length === 0) return null;
  const m = crossed[crossed.length - 1];
  return {
    title: `${m.toLocaleString()} ${unit} lifted`,
    description: "Total volume across every set you've logged.",
  };
}
