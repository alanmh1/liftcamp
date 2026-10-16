import { beforeEach, describe, expect, it } from "vitest";
import { findRoutineText, exerciseSwapsText, strengthLevelText } from "./tools";
import { handleMcpRequest, resetRateLimit } from "./server";
import { day, ex, fakeCatalog } from "./fixtures.test-helpers";

const beginnerDb = { level: "beginner", equipment: "dumbbells", order: 1 };
const routines = [
  day(
    "Dumbbell Full Body",
    "dumbbell-full-body",
    "Day A",
    { ...beginnerDb, days: 3, position: 1 },
    [
      ["Goblet Squat", 3, "8-10"],
      ["Dumbbell Bench Press", 3, "8-10"],
    ],
  ),
  day(
    "Dumbbell Full Body",
    "dumbbell-full-body",
    "Day B",
    { ...beginnerDb, days: 3, position: 2 },
    [["Dumbbell Romanian Deadlift", null, "10"]],
  ),
  day(
    "Two-Day Dumbbell",
    "two-day-dumbbell-full-body",
    "Day 1",
    { ...beginnerDb, days: 2, order: 2, position: 1 },
    [["Dumbbell Row", 3, null]],
  ),
  day(
    "Dumbbell Upper Lower",
    "dumbbell-upper-lower",
    "Upper",
    { ...beginnerDb, days: 4, order: 3, position: 1 },
    [["Dumbbell Shoulder Press", 3, "8-12"]],
  ),
  day(
    "Full Body 3-Day",
    "full-body-3-day",
    "Full Body A",
    { level: "beginner", equipment: "gym", days: 3, order: 4, position: 1 },
    [["Barbell Squat", 3, "5"]],
  ),
  day(
    "PPL",
    "push-pull-legs",
    "Push",
    { level: "intermediate", equipment: "gym", days: 6, order: 5, position: 1 },
    [["Barbell Bench Press", 4, "6-8"]],
  ),
];

describe("findRoutineText", () => {
  it("returns the top three, best first and marked Recommended", () => {
    const out = findRoutineText(
      routines,
      { days_per_week: 3, equipment: "dumbbells", level: "beginner" },
      "claude",
    );
    const headings = out.split("\n").filter((l) => l.startsWith("## "));
    expect(headings).toEqual([
      "## 1. Dumbbell Full Body (Recommended)",
      "## 2. Two-Day Dumbbell",
      "## 3. Dumbbell Upper Lower",
    ]);
    expect(out).not.toContain("nearest fits");
  });

  it("lists each day's exercises in position order with set targets", () => {
    const out = findRoutineText(
      routines,
      { days_per_week: 3, equipment: "dumbbells", level: "beginner" },
      "claude",
    );
    expect(out).toContain("Beginner · 3 days a week · Dumbbells");
    expect(out).toContain("**Day A**\n- Dumbbell Bench Press, 3 × 8-10\n- Goblet Squat, 3 × 8-10");
    expect(out).toContain("**Day B**\n- Dumbbell Romanian Deadlift, 10");
    expect(out).toContain("- Dumbbell Row, 3 sets");
  });

  it("links each routine and ends with the start line for the first", () => {
    const out = findRoutineText(routines, { equipment: "dumbbells" }, "chatgpt");
    expect(out).toContain(
      "https://liftcamp.app/routines/dumbbell-full-body?utm_source=chatgpt&utm_medium=mcp",
    );
    expect(out).toContain(
      "https://liftcamp.app/routines/dumbbell-upper-lower?utm_source=chatgpt&utm_medium=mcp",
    );
    const last = out.trim().split("\n").at(-1)!;
    expect(last).toMatch(
      /^Start this in LiftCamp: \[liftcamp\.app\/routines\/dumbbell-full-body\]/,
    );
    expect(last).toContain("ct=mcp_chatgpt");
  });

  it("includes the authored answer paragraph when the routine has one", () => {
    const out = findRoutineText(routines, { equipment: "gym", level: "beginner" }, "claude");
    expect(out).toContain("A full body routine trains every major muscle group");
  });

  it("says so when nothing matches every answer", () => {
    const out = findRoutineText(routines, { equipment: "bands", level: "advanced" }, "claude");
    expect(out.startsWith("No routine matches every answer")).toBe(true);
    expect(out.split("\n").filter((l) => l.startsWith("## "))).toHaveLength(3);
  });

  it("leaves out routines with no slug", () => {
    const noSlug = {
      ...routines[0]!,
      id: "x",
      program: "Unlinked",
      program_slug: null,
      program_order: 0,
    };
    const out = findRoutineText([noSlug, ...routines], { equipment: "dumbbells" }, "claude");
    expect(out).not.toContain("Unlinked");
  });
});

describe("exerciseSwapsText", () => {
  const rdl = ex("Romanian Deadlift", { primary_muscle: "hamstrings", has_notes: true });
  const dbRdl = ex("Dumbbell Romanian Deadlift", {
    primary_muscle: "hamstrings",
    equipment: "dumbbell",
  });
  const curl = ex("Lying Leg Curls", { primary_muscle: "hamstrings", equipment: "machine" });
  const bandRdl = ex("Banded Romanian Deadlift", {
    primary_muscle: "hamstrings",
    equipment: "bands",
  });
  const bench = ex("Barbell Bench Press");
  const index = [rdl, dbRdl, curl, bandRdl, bench];
  const catalog = fakeCatalog(index, {
    notes: {
      [rdl.id]: {
        starting_weight_md: "",
        form_breakdown_md: "",
        substitution_md: "",
        substitute_exercise_ids: [curl.id],
      },
    },
  });

  it("puts the authored swap first, then same-muscle rows, never the lift itself", async () => {
    const out = await exerciseSwapsText(catalog, "romanian deadlift", undefined, "claude");
    const items = out.split("\n").filter((l) => l.startsWith("- "));
    expect(items[0]).toContain("Lying Leg Curls");
    expect(items[0]).toContain("From LiftCamp's beginner note");
    expect(items.slice(1).every((l) => l.includes("Same primary muscle (Hamstrings)"))).toBe(true);
    expect(out).not.toContain("[Romanian Deadlift]");
    expect(out).not.toContain("Bench");
  });

  it("filters to the requested equipment", async () => {
    const out = await exerciseSwapsText(catalog, "romanian deadlift", "dumbbells", "claude");
    const items = out.split("\n").filter((l) => l.startsWith("- "));
    expect(items).toHaveLength(1);
    expect(items[0]).toContain("Dumbbell Romanian Deadlift");
  });
});

describe("strengthLevelText", () => {
  it("places 135 x 5 at 180 lb male and shows five bands", () => {
    const out = strengthLevelText(
      { lift: "bench", weight: 135, reps: 5, unit: "lb", sex: "male", bodyweight: 180 },
      "claude",
    );
    expect(out).toContain("Estimated max: 157.5 lb");
    expect(out).toContain("whole bar");
    expect(
      out
        .split("\n")
        .filter((l) => l.startsWith("| ") && !l.startsWith("| Level") && !l.startsWith("| ---")),
    ).toHaveLength(5);
    expect(out).toContain("/exercises/barbell-bench-press?utm_source=claude");
  });

  it("names the seven lifts when the lift has no level", () => {
    const out = strengthLevelText(
      { lift: "dumbbell curl", weight: 30, reps: 8, unit: "lb", sex: "female", bodyweight: 140 },
      "claude",
    );
    expect(out).toContain("seven lifts");
    expect(out).toContain("- Wide-Grip Lat Pulldown");
  });
});

describe("handleMcpRequest", () => {
  beforeEach(() => resetRateLimit());
  const catalog = fakeCatalog([ex("Barbell Squat")], { routines });

  const post = (body: unknown, ip = "1.1.1.1") =>
    new Request("http://localhost/mcp/claude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "x-forwarded-for": `${ip}, 10.0.0.1`,
      },
      body: JSON.stringify(body),
    });

  it("lists the four tools with read-only annotations", async () => {
    const res = await handleMcpRequest(
      post({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      "claude",
      catalog,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const json = (await res.json()) as {
      result: { tools: { name: string; annotations: Record<string, unknown> }[] };
    };
    expect(json.result.tools.map((t) => t.name).sort()).toEqual([
      "exercise_guide",
      "exercise_swaps",
      "find_routine",
      "strength_level",
    ]);
    for (const t of json.result.tools) {
      expect(t.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
    }
  });

  it("refuses bodies over 64 KB", async () => {
    const res = await handleMcpRequest(
      post({ jsonrpc: "2.0", id: 1, method: "ping", pad: "x".repeat(70_000) }),
      "claude",
      catalog,
    );
    expect(res.status).toBe(413);
  });

  it("answers GET with 405 and OPTIONS with CORS headers", async () => {
    const get = await handleMcpRequest(
      new Request("http://localhost/mcp/claude"),
      "claude",
      catalog,
    );
    expect(get.status).toBe(405);
    const opt = await handleMcpRequest(
      new Request("http://localhost/mcp/claude", { method: "OPTIONS" }),
      "claude",
      catalog,
    );
    expect(opt.status).toBe(204);
    expect(opt.headers.get("access-control-allow-headers")).toContain("Mcp-Protocol-Version");
  });

  it("rate limits one IP after 60 requests a minute", async () => {
    const ping = () =>
      handleMcpRequest(
        post({ jsonrpc: "2.0", id: 1, method: "ping" }, "9.9.9.9"),
        "claude",
        catalog,
      );
    for (let i = 0; i < 60; i++) expect((await ping()).status).toBe(200);
    const limited = await ping();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
