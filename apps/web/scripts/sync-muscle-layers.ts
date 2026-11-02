// Writes the web copies of the body diagram layers from the mobile PNGs, the
// single source (apps/mobile/assets/images/muscles, see docs/body-diagram.md).
//
//   apps/mobile/assets/images/muscles/<name>.png -> public/muscles/<name>.webp
//
// Lossy WebP with alpha at quality 85, so the painted edges stay soft. The
// canvas is kept at 1024 by 1024 so every layer stays registered to its base.
// Any other .webp in public/muscles is deleted, so a layer removed on mobile
// goes from the web too. Run it whenever a mobile layer changes, and commit
// the output:
//
//   pnpm --filter @liftcamp/web exec tsx scripts/sync-muscle-layers.ts

import { readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(here, "../../mobile/assets/images/muscles");
const OUT = path.resolve(here, "../public/muscles");
const QUALITY = 85;

const sources = readdirSync(SOURCE).filter((f) => f.endsWith(".png")).sort();
const keep = new Set(sources.map((f) => f.replace(/\.png$/, ".webp")));

let before = 0;
let after = 0;
for (const file of sources) {
  const src = path.join(SOURCE, file);
  const dest = path.join(OUT, file.replace(/\.png$/, ".webp"));
  const meta = await sharp(src).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    throw new Error(`${file} is ${meta.width}x${meta.height}, expected 1024x1024`);
  }
  await sharp(src)
    .webp({ quality: QUALITY, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(dest);
  before += statSync(src).size;
  after += statSync(dest).size;
}

for (const file of readdirSync(OUT)) {
  if (file.endsWith(".webp") && !keep.has(file)) {
    rmSync(path.join(OUT, file));
    console.log(`removed ${file}`);
  }
}

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
console.log(`${sources.length} layers, ${kb(before)} PNG -> ${kb(after)} WebP`);
