import { describe, expect, it } from "vitest";

import { isMilestoneWorkout, workoutEmoji, workoutSubtitle, WORKOUT_EMOJI } from "./workout-subtitle";

describe("workoutSubtitle", () => {
  it("has a line for each milestone", () => {
    expect(workoutSubtitle(1)).toBe("You finished your first workout 💪");
    expect(workoutSubtitle(5)).toBe("Your fifth workout 🙌");
    expect(workoutSubtitle(10)).toBe("Your 10th workout. Double digits 🔥");
    expect(workoutSubtitle(25)).toBe("Your 25th workout 🏅");
    expect(workoutSubtitle(50)).toBe("Your 50th workout. Halfway to 100 🎉");
    expect(workoutSubtitle(100)).toBe("Your 100th workout 💯");
    expect(workoutSubtitle(200)).toBe("Your 200th workout 🏆");
    expect(workoutSubtitle(1300)).toBe("Your 1300th workout 🏆");
  });

  it("numbers the rest in AP style with one emoji from the rotation", () => {
    expect(workoutSubtitle(2)).toMatch(/^Your second workout (\S+)$/);
    expect(workoutSubtitle(17)).toMatch(/^Your 17th workout (\S+)$/);
    const emoji = workoutSubtitle(17).split(" ").pop();
    expect(WORKOUT_EMOJI as readonly string[]).toContain(emoji);
  });

  it("treats a count below one as the first workout", () => {
    expect(workoutSubtitle(0)).toBe(workoutSubtitle(1));
  });

  it("is the same every time for the same workout", () => {
    for (const n of [3, 17, 42, 101, 999]) expect(workoutSubtitle(n)).toBe(workoutSubtitle(n));
  });
});

describe("workoutEmoji", () => {
  it("never repeats back to back, milestones included", () => {
    for (let n = 1; n < 5000; n++) {
      expect(workoutEmoji(n + 1), `workouts ${n} and ${n + 1}`).not.toBe(workoutEmoji(n));
    }
  });

  it("follows the rotation by workout number away from milestones", () => {
    expect(workoutEmoji(17)).toBe(WORKOUT_EMOJI[17 % WORKOUT_EMOJI.length]);
    expect(workoutEmoji(33)).toBe(WORKOUT_EMOJI[3]);
  });
});

describe("isMilestoneWorkout", () => {
  it("is true only for milestones", () => {
    expect([1, 5, 10, 25, 50, 100, 200, 300].every(isMilestoneWorkout)).toBe(true);
    expect([2, 11, 99, 150, 250].some(isMilestoneWorkout)).toBe(false);
  });
});
