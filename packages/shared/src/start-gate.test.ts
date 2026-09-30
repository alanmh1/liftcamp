import { describe, expect, it } from "vitest";

import { signUpDueKey, signUpDueOnHome, startGate, type StartGate } from "./start-gate";

describe("startGate", () => {
  const gate = (isAnonymous: boolean, finishedCount: number | null, online: boolean, resuming = false) =>
    startGate({ isAnonymous, finishedCount, online, resuming });

  it("covers guest and signed-in, 0, 1 and 2 finished, online and offline", () => {
    const expected: [boolean, number, boolean, StartGate][] = [
      [true, 0, true, "start"],
      [true, 0, false, "start"],
      [true, 1, true, "sign-up"],
      [true, 1, false, "start-offline"],
      [true, 2, true, "sign-up"],
      [true, 2, false, "start-offline"],
      [false, 0, true, "start"],
      [false, 0, false, "start"],
      [false, 1, true, "start"],
      [false, 1, false, "start"],
      [false, 2, true, "start"],
      [false, 2, false, "start"],
    ];
    for (const [anon, count, online, result] of expected) expect(gate(anon, count, online)).toBe(result);
  });

  it("never gates a resume", () => {
    for (const anon of [true, false])
      for (const count of [0, 1, 2, null])
        for (const online of [true, false]) expect(gate(anon, count, online, true)).toBe("start");
  });

  it("lets a guest with an unknown count start offline, flagged", () => {
    expect(gate(true, null, false)).toBe("start-offline");
    expect(gate(false, null, false)).toBe("start");
  });
});

describe("signUpDueOnHome", () => {
  const due = { flagged: true, isAnonymous: true, online: true, inProgress: false, finishedCount: 2 };

  it("shows once the offline second workout is finished and there is signal", () => {
    expect(signUpDueOnHome(due)).toBe(true);
  });

  it("waits for signal, and for the workout to finish", () => {
    expect(signUpDueOnHome({ ...due, online: false })).toBe(false);
    expect(signUpDueOnHome({ ...due, inProgress: true })).toBe(false);
  });

  it("does not ask when the offline workout was the first, without the flag, or once linked", () => {
    expect(signUpDueOnHome({ ...due, finishedCount: 1 })).toBe(false);
    expect(signUpDueOnHome({ ...due, flagged: false })).toBe(false);
    expect(signUpDueOnHome({ ...due, isAnonymous: false })).toBe(false);
  });

  it("keys the flag per user under the app prefix", () => {
    expect(signUpDueKey("u1")).toBe("liftcamp:signup-due:u1");
  });
});
