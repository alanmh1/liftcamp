import { describe, expect, it } from "vitest";

import {
  cardioRecords,
  cardioSeconds,
  cardioSessionSeconds,
  cleanIncline,
  distanceToMeters,
  distanceUnitFor,
  formatCardioSet,
  formatCardioTime,
  formatDistance,
  formatIncline,
  formatTimerDigits,
  hasIncline,
  isCardio,
  metersToDistance,
  secondsToTimerDigits,
  tidyDistance,
  tidyIncline,
  timerDigits,
  timerSeconds,
  workStat,
} from "./cardio";
import { cleanDecimal, parseDecimal } from "./decimal-input";
import { loadRuleFor, suggestProgression } from "./progression";
import { routineFromWorkout } from "./routine-from-workout";
import { formatLastLine, formatSetLine } from "./set-focus";
import { setPlaceholder } from "./set-placeholder";
import { effectiveLoad, setVolume } from "./set-weight";

const cardio = {
  id: "32f1f643-4920-4fb2-ad30-5cccbe2211d6",
  equipment: "machine",
  weight_type: "standard",
  mechanic: null,
  primary_muscle: null,
  set_type: "cardio",
};

/** What a time box holds after these keystrokes, one at a time, from empty. */
function typeKeys(keys: string): string {
  let digits = "";
  for (const k of keys) digits = timerDigits(formatTimerDigits(digits) + k);
  return digits;
}

describe("isCardio", () => {
  it("is true only for set_type cardio", () => {
    expect(isCardio({ set_type: "cardio" })).toBe(true);
    expect(isCardio({ set_type: null })).toBe(false);
    expect(isCardio({})).toBe(false);
    expect(isCardio(null)).toBe(false);
  });
});

describe("timer-style time entry", () => {
  it("fills from the right: 2, 5, 0, 0 shows 25:00", () => {
    expect(formatTimerDigits(typeKeys("2"))).toBe("00:02");
    expect(formatTimerDigits(typeKeys("25"))).toBe("00:25");
    expect(formatTimerDigits(typeKeys("250"))).toBe("02:50");
    expect(formatTimerDigits(typeKeys("2500"))).toBe("25:00");
    expect(timerSeconds(typeKeys("2500"))).toBe(1500);
  });

  it("lets minutes go past 59: 7500 is 75:00", () => {
    expect(formatTimerDigits("7500")).toBe("75:00");
    expect(timerSeconds("7500")).toBe(4500);
    expect(formatTimerDigits("12000")).toBe("120:00");
    expect(timerSeconds("12000")).toBe(7200);
  });

  it("deletes from the right", () => {
    expect(timerDigits("25:0")).toBe("250");
    expect(timerDigits("00:0")).toBe("");
    expect(timerSeconds(timerDigits("00:0"))).toBeNull();
  });

  it("drops leading zeros and anything that is not a digit", () => {
    expect(timerDigits("00:025")).toBe("25");
    expect(timerDigits("1:15:00")).toBe("11500");
    expect(timerDigits("")).toBe("");
  });

  it("drops keystrokes past five digits", () => {
    expect(timerDigits("999:991")).toBe("99999");
    expect(typeKeys("1234567")).toBe("12345");
  });

  it("reads seconds over 59 as seconds: 99 is 99", () => {
    expect(timerSeconds("99")).toBe(99);
    expect(formatCardioTime(99)).toBe("01:39");
  });

  it("is null for no time", () => {
    expect(timerSeconds("")).toBeNull();
    expect(timerSeconds("0")).toBeNull();
  });

  it("turns a saved time back into digits for a box taking focus", () => {
    expect(secondsToTimerDigits(1500)).toBe("2500");
    expect(secondsToTimerDigits(4500)).toBe("7500");
    expect(secondsToTimerDigits(99)).toBe("139");
    expect(secondsToTimerDigits(null)).toBe("");
    expect(timerSeconds(secondsToTimerDigits(4321))).toBe(4321);
  });
});

describe("formatCardioTime", () => {
  it("prints mm:ss under an hour", () => {
    expect(formatCardioTime(1500)).toBe("25:00");
    expect(formatCardioTime(330)).toBe("05:30");
    expect(formatCardioTime(3599)).toBe("59:59");
  });

  it("prints h:mm:ss at 60 minutes and over", () => {
    expect(formatCardioTime(3600)).toBe("1:00:00");
    expect(formatCardioTime(4500)).toBe("1:15:00");
    expect(formatCardioTime(36125)).toBe("10:02:05");
  });

  it("is empty for no time", () => {
    expect(formatCardioTime(null)).toBe("");
    expect(formatCardioTime(0)).toBe("");
  });
});

describe("distance in meters", () => {
  it("follows the weight unit: kg is km, lb is mi", () => {
    expect(distanceUnitFor("kg")).toBe("km");
    expect(distanceUnitFor("lb")).toBe("mi");
  });

  it("converts typed km and mi to meters", () => {
    expect(distanceToMeters(3.2, "kg")).toBe(3200);
    expect(distanceToMeters(1, "lb")).toBe(1609.34);
    expect(distanceToMeters(3.2, "lb")).toBe(5149.9);
    expect(distanceToMeters(null, "kg")).toBeNull();
  });

  it("converts meters back for display", () => {
    expect(metersToDistance(3200, "kg")).toBe(3.2);
    expect(metersToDistance(1609.344, "lb")).toBe(1);
    expect(metersToDistance(null, "lb")).toBeNull();
  });

  it("round trips a typed distance to what was typed", () => {
    for (const v of [0.5, 1, 3.2, 5, 10.25, 26.22, 42.2]) {
      expect(tidyDistance(distanceToMeters(v, "lb"), "lb")).toBe(String(v));
      expect(tidyDistance(distanceToMeters(v, "kg"), "kg")).toBe(String(v));
    }
  });

  it("takes a comma typed on a comma-locale pad", () => {
    expect(distanceToMeters(parseDecimal(cleanDecimal("3,2", 2)), "kg")).toBe(3200);
  });

  it("prints with the unit, rounded to 0.01", () => {
    expect(formatDistance(3200, "kg")).toBe("3.2 km");
    expect(formatDistance(5000, "lb")).toBe("3.11 mi");
    expect(formatDistance(3200, "lb")).toBe("1.99 mi");
    expect(formatDistance(null, "kg")).toBe("");
  });
});

describe("formatCardioSet", () => {
  it("joins time and distance, or prints the part that exists", () => {
    expect(formatCardioSet({ duration_seconds: 1500, distance_meters: 3200 }, "kg")).toBe("25:00 · 3.2 km");
    expect(formatCardioSet({ duration_seconds: 1500, distance_meters: null }, "kg")).toBe("25:00");
    expect(formatCardioSet({ duration_seconds: null, distance_meters: 3200 }, "kg")).toBe("3.2 km");
    expect(formatCardioSet({ duration_seconds: null, distance_meters: null }, "kg")).toBeNull();
    expect(formatCardioSet(null, "kg")).toBeNull();
  });

  it("adds the incline as a third part", () => {
    expect(formatCardioSet({ duration_seconds: 1500, distance_meters: 2414.02, incline_percent: 4 }, "lb")).toBe(
      "25:00 · 1.5 mi · 4%",
    );
    expect(formatCardioSet({ duration_seconds: 1500, distance_meters: null, incline_percent: 12.5 }, "kg")).toBe(
      "25:00 · 12.5%",
    );
    expect(formatCardioSet({ duration_seconds: null, distance_meters: null, incline_percent: 3 }, "kg")).toBe("3%");
    expect(formatCardioSet({ duration_seconds: 1500, distance_meters: 3200, incline_percent: null }, "kg")).toBe(
      "25:00 · 3.2 km",
    );
  });

  it("prints 0% for a flat incline that was typed", () => {
    expect(formatCardioSet({ duration_seconds: 600, incline_percent: 0 }, "kg")).toBe("10:00 · 0%");
  });
});

describe("incline", () => {
  it("is on only for exercises marked has_incline", () => {
    expect(hasIncline({ has_incline: true })).toBe(true);
    expect(hasIncline({ has_incline: false })).toBe(false);
    expect(hasIncline({ has_incline: null })).toBe(false);
    expect(hasIncline({})).toBe(false);
    expect(hasIncline(null)).toBe(false);
  });

  it("tidies to 0.1 with trailing zeros dropped", () => {
    expect(tidyIncline(4)).toBe("4");
    expect(tidyIncline(4.0)).toBe("4");
    expect(tidyIncline(12.5)).toBe("12.5");
    expect(tidyIncline(12.54)).toBe("12.5");
    expect(tidyIncline(12.56)).toBe("12.6");
    expect(tidyIncline(0)).toBe("0");
    expect(tidyIncline(null)).toBe("");
    expect(tidyIncline(undefined)).toBe("");
  });

  it("formats with a percent sign", () => {
    expect(formatIncline(4)).toBe("4%");
    expect(formatIncline(12.5)).toBe("12.5%");
    expect(formatIncline(null)).toBe("");
  });

  it("is the same number in both unit systems", () => {
    const set = { duration_seconds: 1500, incline_percent: 6 };
    expect(formatCardioSet(set, "kg")).toBe("25:00 · 6%");
    expect(formatCardioSet(set, "lb")).toBe("25:00 · 6%");
  });

  it("types on the decimal pad with one decimal, up to 50", () => {
    expect(cleanIncline("12.55", "12.5")).toBe("12.5");
    expect(cleanIncline("12,5", "12,")).toBe("12,5");
    expect(cleanIncline("50", "5")).toBe("50");
    expect(cleanIncline("51", "5")).toBe("5");
    expect(cleanIncline("50.5", "50.")).toBe("50.");
    expect(cleanIncline("", "4")).toBe("");
    expect(parseDecimal(cleanIncline("12.5", "12."))).toBe(12.5);
  });
});

describe("cardio is left out of strength math", () => {
  const set = { weight: null, weight_value: 100, reps: 10 };

  it("adds no volume", () => {
    expect(setVolume(set, cardio, 80)).toBe(0);
    expect(setVolume(set, { ...cardio, set_type: null }, 80)).toBe(1000);
  });

  it("has no load, so no PR or estimated max", () => {
    expect(effectiveLoad(set, cardio, 80)).toBeNull();
  });

  it("gets no progression", () => {
    expect(loadRuleFor(cardio, "lb")).toEqual({ kind: "none" });
    const p = suggestProgression({
      exercise: cardio,
      history: [{ workoutId: "w", date: "2026-10-01", sets: [{ weight_value: null, weight_unit: "lb", reps: null }], plannedSets: 1 }],
      unit: "lb",
      target: null,
      setCount: 1,
      today: "2026-10-19",
    });
    expect(p.outcome).toBe("unsupported");
  });
});

describe("cardio placeholders", () => {
  const empty = { weight_value: null, reps: null, duration_seconds: null, distance_meters: null, incline_percent: null };

  it("take the prior session's time and distance for that position", () => {
    const prior = [
      { weight_value: null, reps: null, duration_seconds: 1500, distance_meters: 3200 },
      { weight_value: null, reps: null, duration_seconds: 600, distance_meters: null },
    ];
    const input = { sets: [empty, empty, empty], prior, cardio: true };
    expect(setPlaceholder(input, 0)).toEqual({
      weight: null,
      reps: null,
      duration_seconds: 1500,
      distance_meters: 3200,
      incline_percent: null,
    });
    expect(setPlaceholder(input, 1)).toEqual({
      weight: null,
      reps: null,
      duration_seconds: 600,
      distance_meters: null,
      incline_percent: null,
    });
    // Past the end, the last prior set repeats.
    expect(setPlaceholder(input, 2).duration_seconds).toBe(600);
  });

  it("follow a value typed in a set above", () => {
    const typed = { ...empty, duration_seconds: 1200 };
    const input = { sets: [typed, empty], prior: [], cardio: true };
    expect(setPlaceholder(input, 1)).toEqual({
      weight: null,
      reps: null,
      duration_seconds: 1200,
      distance_meters: null,
      incline_percent: null,
    });
  });

  it("ignore cold-start and target reps", () => {
    const input = { sets: [empty], prior: [], cardio: true, coldReps: 10, targetReps: "8-10" };
    expect(setPlaceholder(input, 0)).toEqual({
      weight: null,
      reps: null,
      duration_seconds: null,
      distance_meters: null,
      incline_percent: null,
    });
  });

  it("resolve the incline like time and distance", () => {
    const prior = [
      { weight_value: null, reps: null, duration_seconds: 1500, distance_meters: null, incline_percent: 4 },
      { weight_value: null, reps: null, duration_seconds: 600, distance_meters: null, incline_percent: 12.5 },
    ];
    // From the prior session at the same position.
    const fromPrior = { sets: [empty, empty, empty], prior, cardio: true };
    expect(setPlaceholder(fromPrior, 0).incline_percent).toBe(4);
    expect(setPlaceholder(fromPrior, 1).incline_percent).toBe(12.5);
    expect(setPlaceholder(fromPrior, 2).incline_percent).toBe(12.5);
    // A value typed above wins over the prior session.
    const typed = { ...empty, incline_percent: 8 };
    const fromAbove = { sets: [typed, empty], prior, cardio: true };
    expect(setPlaceholder(fromAbove, 1).incline_percent).toBe(8);
    // A set above with only a time passes the incline through from further up.
    const timeOnly = { ...empty, duration_seconds: 900 };
    const skip = { sets: [typed, timeOnly, empty], prior: [], cardio: true };
    expect(setPlaceholder(skip, 2).incline_percent).toBe(8);
  });
});

describe("cardio lines for the Live Activity", () => {
  it("prints a set, filling empty boxes from the prior set", () => {
    const set = { weight_value: null, reps: null, duration_seconds: null, distance_meters: 3200 };
    const prior = { weight_value: null, reps: null, duration_seconds: 1500, distance_meters: 3000 };
    expect(formatSetLine(set, prior, "kg", cardio)).toBe("25:00 · 3.2 km");
    expect(formatSetLine(set, null, "kg", cardio)).toBe("3.2 km");
  });

  it("prints last time", () => {
    const prior = [{ weight_value: null, reps: null, duration_seconds: 1500, distance_meters: 5149.9 }];
    expect(formatLastLine(prior, 0, "lb", cardio)).toBe("Last time 25:00 · 3.2 mi");
  });

  it("carries the incline, filling an empty box from the prior set", () => {
    const set = { weight_value: null, reps: null, duration_seconds: 1500, distance_meters: null, incline_percent: null };
    const prior = { weight_value: null, reps: null, duration_seconds: 1200, distance_meters: null, incline_percent: 6 };
    expect(formatSetLine(set, prior, "kg", cardio)).toBe("25:00 · 6%");
    expect(formatLastLine([prior], 0, "kg", cardio)).toBe("Last time 20:00 · 6%");
  });
});

describe("cardio totals and records", () => {
  it("totals the time of completed cardio sets only", () => {
    expect(
      cardioSeconds([
        { exercise: cardio, sets: [{ completed: true, duration_seconds: 1500 }, { completed: false, duration_seconds: 600 }] },
        { exercise: { set_type: null }, sets: [{ completed: true, duration_seconds: 900 }] },
        { exercise: cardio, sets: null },
      ]),
    ).toBe(1500);
  });

  it("totals a session for the chart", () => {
    expect(cardioSessionSeconds([{ duration_seconds: 600 }, { duration_seconds: null }, { duration_seconds: 300 }])).toBe(900);
  });

  it("keeps the longest single set of each, the earlier session on a tie", () => {
    const records = cardioRecords([
      { workoutId: "b", workoutDate: "2026-10-05", sets: [{ duration_seconds: 1800, distance_meters: 5000 }] },
      { workoutId: "a", workoutDate: "2026-10-01", sets: [{ duration_seconds: 1800, distance_meters: 4000 }] },
      { workoutId: "c", workoutDate: "2026-10-09", sets: [{ duration_seconds: 900, distance_meters: null }] },
    ]);
    expect(records.longestTime).toEqual({ value: 1800, workoutId: "a", workoutDate: "2026-10-01" });
    expect(records.longestDistance).toEqual({ value: 5000, workoutId: "b", workoutDate: "2026-10-05" });
  });

  it("is empty with nothing logged", () => {
    expect(cardioRecords([])).toEqual({ longestTime: null, longestDistance: null });
  });
});

describe("workStat", () => {
  it("shows volume when there is any, cardio or not", () => {
    expect(workStat(18140, 1500, "lbs")).toEqual({ label: "Volume", value: "18,140 lbs" });
    expect(workStat(0, 0, "kg")).toEqual({ label: "Volume", value: "0 kg" });
  });

  it("shows the cardio time where volume would go when there is no volume", () => {
    expect(workStat(0, 1500, "lbs")).toEqual({ label: "Cardio", value: "25:00" });
    expect(workStat(0, 4500, "kg")).toEqual({ label: "Cardio", value: "1:15:00" });
  });
});

describe("routineFromWorkout with cardio", () => {
  it("keeps the set count and leaves target reps null", () => {
    const sets = [
      { position: 0, reps: null, completed: true },
      { position: 1, reps: 12, completed: true },
      { position: 2, reps: null, completed: false },
    ];
    expect(routineFromWorkout([{ exerciseId: "run", sets, cardio: true }])).toEqual([
      { exerciseId: "run", targetSets: 2, targetReps: null },
    ]);
  });
});
