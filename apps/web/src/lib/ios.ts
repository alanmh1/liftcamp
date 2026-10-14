/**
 * iPhone, iPad or iPod, in any browser. Every browser on iOS can open an App
 * Store link, so this is the test for showing the App Store badge in place of
 * the Add to Home Screen prompts. Call it in an effect: it reads navigator.
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports a Macintosh UA; touch points tell it from a desktop Mac.
  return (
    /iPhone|iPod|iPad/.test(ua) ||
    (/Macintosh|MacIntel/.test(ua + navigator.platform) && navigator.maxTouchPoints > 1)
  );
}
