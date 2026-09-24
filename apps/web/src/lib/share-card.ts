/**
 * Client-side share card. Draws a square PNG on a canvas — no server render, no
 * stored image, nothing public created — so sharing a milestone is a one-tap
 * action that leaves no footprint. Every card carries the liftcamp.app mark,
 * which is the only thing the image needs to do for reach.
 */

const BLUE = "#1B5FA8";
const GOLD = "#F5D272";
const SIZE = 1080;

export type ShareCard = {
  headline: string;
  subline: string;
  stats: { value: string; label: string }[];
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wraps `text` to at most `maxLines` lines that fit `maxWidth`. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) return lines;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

export async function renderShareCard(card: ShareCard): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Soft gold wash bottom-right so the card is not a flat block of blue.
  const grad = ctx.createRadialGradient(SIZE, SIZE, 60, SIZE, SIZE, SIZE * 0.9);
  grad.addColorStop(0, "rgba(245,210,114,0.30)");
  grad.addColorStop(1, "rgba(245,210,114,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const pad = 90;

  ctx.fillStyle = GOLD;
  ctx.font = "600 34px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(card.subline.toUpperCase(), pad, pad + 34);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 92px ui-sans-serif, system-ui, sans-serif";
  const lines = wrap(ctx, card.headline, SIZE - pad * 2, 3);
  lines.forEach((l, i) => ctx.fillText(l, pad, 320 + i * 108));

  // Stat row
  const boxW = (SIZE - pad * 2 - 32 * (card.stats.length - 1)) / card.stats.length;
  const boxY = 700;
  card.stats.forEach((s, i) => {
    const x = pad + i * (boxW + 32);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, x, boxY, boxW, 170, 28);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 56px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.value, x + boxW / 2, boxY + 82);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 30px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(s.label, x + boxW / 2, boxY + 130);
    ctx.textAlign = "left";
  });

  // Wordmark — the whole point of the image.
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(pad + 20, SIZE - pad - 10, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 42px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("liftcamp.app", pad + 56, SIZE - pad + 5);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/**
 * Shares the card through the native sheet when the platform supports files,
 * otherwise falls back to a plain text+link share, otherwise downloads the PNG.
 */
export async function shareCard(card: ShareCard): Promise<boolean> {
  const blob = await renderShareCard(card);
  const text = `${card.headline} · logged on liftcamp.app`;
  const url = "https://liftcamp.app";

  try {
    if (blob && typeof navigator !== "undefined" && navigator.canShare) {
      const file = new File([blob], "liftcamp.png", { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return true;
      }
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text, url });
      return true;
    }
  } catch {
    return false;
  }

  if (!blob) return false;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "liftcamp.png";
  a.click();
  URL.revokeObjectURL(href);
  return true;
}
