import { describe, expect, it } from "vitest";
import { APP_STORE_URL } from "@liftcamp/shared";
import { isMcpSource, siteLink, startLine, storeLink } from "./links";

describe("siteLink", () => {
  it("tags the path with the source and the mcp medium", () => {
    expect(siteLink("/routines/full-body-3-day", "claude")).toBe(
      "https://liftcamp.app/routines/full-body-3-day?utm_source=claude&utm_medium=mcp",
    );
  });

  it("keeps a query the path already has", () => {
    const url = new URL(siteLink("/exercises?q=row", "chatgpt"));
    expect(url.searchParams.get("q")).toBe("row");
    expect(url.searchParams.get("utm_source")).toBe("chatgpt");
  });
});

describe("storeLink", () => {
  it("is the App Store page with an mcp_<source> campaign", () => {
    const url = new URL(storeLink("chatgpt"));
    expect(`${url.origin}${url.pathname}`).toBe(APP_STORE_URL);
    expect(url.searchParams.get("ct")).toBe("mcp_chatgpt");
    expect(new URL(storeLink("claude")).searchParams.get("ct")).toBe("mcp_claude");
  });
});

describe("startLine", () => {
  it("carries both links", () => {
    const line = startLine("/exercises/barbell-squat", "claude");
    expect(line).toMatch(/^Start this in LiftCamp: /);
    expect(line).toContain(siteLink("/exercises/barbell-squat", "claude"));
    expect(line).toContain(storeLink("claude"));
  });
});

describe("isMcpSource", () => {
  it("accepts only the two directories", () => {
    expect(isMcpSource("chatgpt")).toBe(true);
    expect(isMcpSource("claude")).toBe(true);
    expect(isMcpSource("other")).toBe(false);
    expect(isMcpSource("")).toBe(false);
  });
});
