/**
 * Cleans what a decimal keypad box holds as the user types. A comma counts
 * as the decimal separator, since an iOS decimal pad in a comma locale
 * (Portuguese, German) types one. Keeps the digits and the first separator
 * as typed, drops any later separator, and keeps at most `maxDecimals`
 * digits after it. A leading separator stays, so ".5" is kept as ".5".
 */
export function cleanDecimal(raw: string, maxDecimals: number): string {
  let out = "";
  let separator = false;
  let decimals = 0;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (!separator) out += ch;
      else if (decimals < maxDecimals) {
        out += ch;
        decimals += 1;
      }
    } else if ((ch === "." || ch === ",") && !separator && maxDecimals > 0) {
      out += ch;
      separator = true;
    }
  }
  return out;
}

/**
 * The number a decimal box holds, or null when it holds none ("" or a
 * lone separator). A comma reads as the decimal point: "68." is 68, ".5"
 * is 0.5, "68,25" is 68.25.
 */
export function parseDecimal(text: string): number | null {
  const s = text.trim().replace(",", ".");
  if (s === "" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
