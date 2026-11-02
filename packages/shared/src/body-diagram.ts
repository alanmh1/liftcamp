/**
 * The numbers both apps draw the clay body diagram with. Which region lights
 * for which muscle is in body-layers.ts. The layers themselves live in each
 * app: the PNG source in apps/mobile/assets/images/muscles, and WebP copies
 * made from it in apps/web/public/muscles. See docs/body-diagram.md.
 */

export type BodyView = "anterior" | "posterior";

/**
 * The web legend's swatches for a main muscle and a working muscle. The
 * layers carry their own painted blue; these are flat colours near it.
 */
export const PRIMARY_TINT = "#1B5FA8";
export const SECONDARY_TINT = "#A8C6E4";

/**
 * The figure inside the 1024 square, in source pixels. Both apps crop to
 * this box: a container at the box's aspect ratio, and every layer scaled
 * by 1024 over the box width and offset by the box origin, so the base and
 * the layers share one transform and stay registered.
 */
export const BODY_SOURCE = 1024;
export const BODY_CROP = { x: 236, y: 18, width: 552, height: 992 } as const;
