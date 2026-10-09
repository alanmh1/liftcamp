import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  accountEmails,
  accountName,
  ACCENTS_FROM,
  ACCENTS_TO,
  fallbackUsername,
  isGeneratedUsername,
  isRelayEmail,
  isRelayUsername,
  isValidUsername,
  LIGATURES,
  relayStem,
  replaceUsernameOnLink,
  usernameBase,
  usernameCandidates,
} from "./username";

const RELAY = "x7k2q9abcd@privaterelay.appleid.com";

/** A fixed "random" so the digit suffixes are known: 0.5 gives 550, 5500, 55000. */
const half = () => 0.5;

describe("fallbackUsername", () => {
  it("is lifter plus 5 digits, and passes the database's shape check", () => {
    for (let i = 0; i < 200; i++) {
      const name = fallbackUsername();
      expect(name).toMatch(/^lifter[1-9][0-9]{4}$/);
      expect(isValidUsername(name)).toBe(true);
      expect(isGeneratedUsername(name)).toBe(true);
    }
  });
});

describe("accountName", () => {
  it("takes full_name, then name, then given and family", () => {
    expect(accountName({ full_name: " Alan Harris ", name: "Other" })).toBe("Alan Harris");
    expect(accountName({ name: "Alan Harris" })).toBe("Alan Harris");
    expect(accountName({ given_name: "Alan", family_name: "Harris" })).toBe("Alan Harris");
    expect(accountName({ given_name: "Alan" })).toBe("Alan");
    expect(accountName({})).toBe("");
    expect(accountName(null)).toBe("");
  });
});

describe("usernameBase", () => {
  it("lowercases and keeps letters and digits only", () => {
    expect(usernameBase("Alan Harris")).toBe("alanharris");
    expect(usernameBase("Mary-Jane O'Neil")).toBe("maryjaneoneil");
    expect(usernameBase("Agent 47")).toBe("agent47");
  });

  it("maps accents and spells out ligatures", () => {
    expect(usernameBase("José Núñez")).toBe("josenunez");
    expect(usernameBase("Zoë Łukasz")).toBe("zoelukasz");
    expect(usernameBase("Weiß Æsir Þór")).toBe("weissaesirthor");
  });

  it("drops leading digits, cuts at 20, and is empty with nothing usable", () => {
    expect(usernameBase("3 Doors")).toBe("doors");
    expect(usernameBase("Bartholomew Montgomery-Smythe")).toBe("bartholomewmontgomer");
    expect(usernameBase("Bartholomew Montgomery-Smythe")).toHaveLength(20);
    expect(usernameBase("李小龍")).toBe("");
    expect(usernameBase("")).toBe("");
  });

  it("keeps the two accent strings the same length", () => {
    expect([...ACCENTS_FROM]).toHaveLength([...ACCENTS_TO].length);
    expect(ACCENTS_TO).toMatch(/^[a-z]+$/);
  });
});

describe("usernameCandidates", () => {
  const named = (meta: Record<string, unknown>, emails: string[] = []) =>
    usernameCandidates({ meta, emails, isAnonymous: false }, half);

  it("tries the name, then numeric suffixes, then lifter", () => {
    expect(named({ full_name: "Alan Harris" })).toEqual([
      "alanharris",
      "alanharris2",
      "alanharris3",
      "alanharris550",
      "alanharris5500",
      "lifter55000",
    ]);
  });

  it("cuts a long name so the suffix fits in 20", () => {
    const c = named({ full_name: "Bartholomew Montgomery-Smythe" });
    expect(c[0]).toBe("bartholomewmontgomer");
    expect(c[1]).toBe("bartholomewmontgome2");
    expect(c[4]).toBe("bartholomewmontg5500");
    for (const n of c) expect(isValidUsername(n)).toBe(true);
  });

  it("gives a short name a suffix rather than refusing it", () => {
    expect(named({ full_name: "Al" })).toEqual(["al2", "al3", "al550", "al5500", "lifter55000"]);
  });

  it("is lifter only for a guest, or with no usable name", () => {
    expect(usernameCandidates({ meta: { full_name: "Alan" }, emails: [], isAnonymous: true }, half)).toEqual([
      "lifter55000",
    ]);
    expect(named({})).toEqual(["lifter55000"]);
    expect(named({ full_name: "李小龍" })).toEqual(["lifter55000"]);
  });

  it("never offers a name built from a relay address", () => {
    // Apple with a hidden email and no name: the relay address is all there is.
    expect(named({}, [RELAY])).toEqual(["lifter55000"]);
    // A name that happens to be the relay stem is still refused.
    expect(named({ full_name: "x7k2q9abcd" }, [RELAY])).toEqual(["lifter55000"]);
    // A real name next to a relay address is fine.
    expect(named({ full_name: "Alan Harris" }, [RELAY])[0]).toBe("alanharris");
  });
});

describe("relay addresses", () => {
  it("recognises Apple's relay domain in any case", () => {
    expect(isRelayEmail(RELAY)).toBe(true);
    expect(isRelayEmail("X7K2Q9ABCD@PrivateRelay.AppleID.com")).toBe(true);
    expect(isRelayEmail("alan@icloud.com")).toBe(false);
    expect(isRelayEmail(null)).toBe(false);
  });

  it("stems the local part the way the old email-prefix names were made", () => {
    expect(relayStem(RELAY)).toBe("x7k2q9abcd");
    expect(relayStem("ab.cd-ef_gh@privaterelay.appleid.com")).toBe("abcdef_gh");
  });

  it("flags names that contain the stem or start it", () => {
    expect(isRelayUsername("x7k2q9abcd", [RELAY])).toBe(true);
    expect(isRelayUsername("x7k2q9abcd2", [RELAY])).toBe(true);
    expect(isRelayUsername("my_x7k2q9abcd", [RELAY])).toBe(true);
    // Cut to fit a suffix, as the old prefix names were.
    expect(isRelayUsername("x7k2q9ab12", [RELAY])).toBe(true);
    expect(isRelayUsername("X7K2Q9ABCD", [RELAY])).toBe(true);
  });

  it("leaves other names alone", () => {
    expect(isRelayUsername("alanharris", [RELAY])).toBe(false);
    expect(isRelayUsername("x7k2", [RELAY])).toBe(false);
    expect(isRelayUsername("x7k2q9abcd", ["x7k2q9abcd@gmail.com"])).toBe(false);
    expect(isRelayUsername("x7k2q9abcd", [])).toBe(false);
    // A relay stem under 6 characters is too short to match on.
    expect(isRelayUsername("abcde", ["abcde@privaterelay.appleid.com"])).toBe(false);
  });

  it("collects the account's email and every identity's", () => {
    expect(
      accountEmails({
        email: "alan@gmail.com",
        identities: [{ identity_data: { email: RELAY } }, { identity_data: {} }, { identity_data: null }],
      }),
    ).toEqual(["alan@gmail.com", RELAY]);
    expect(accountEmails({ email: null, identities: null })).toEqual([]);
  });
});

describe("replaceUsernameOnLink", () => {
  it("replaces only a generated name or none", () => {
    expect(replaceUsernameOnLink(null)).toBe(true);
    expect(replaceUsernameOnLink("lifter12345")).toBe(true);
    expect(replaceUsernameOnLink("lifter123")).toBe(false);
    expect(replaceUsernameOnLink("alan")).toBe(false);
  });
});

describe("the rename SQL", () => {
  const sql = readFileSync(resolve(__dirname, "../../../docs/username-relay-rename.sql"), "utf8");

  it("uses the same accent table", () => {
    expect(sql).toContain(`'${ACCENTS_FROM}'`);
    expect(sql).toContain(`'${ACCENTS_TO}'`);
  });

  it("spells out the same ligatures", () => {
    for (const [from, to] of LIGATURES) expect(sql).toContain(`replace(v_base, '${from}', '${to}')`);
  });

  it("checks the same shape and relay domain", () => {
    expect(sql).toContain("^[a-z][a-z0-9_]{2,19}$");
    expect(sql).toContain("@privaterelay.appleid.com");
  });
});
