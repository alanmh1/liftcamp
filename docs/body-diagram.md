# Body diagram

The clay figure on the exercise info views, mobile and web, with the worked
muscles highlighted. Replaced `react-body-highlighter` on 16 Sep 2026.

Since 29 Sep 2026 the two apps draw it differently:

- **Mobile** stacks pre-rendered layers, with the blue painted into the
  clay's own shading. Mapping and zoom math in
  `packages/shared/src/body-layers.ts`, component in
  `apps/mobile/src/components/body-diagram.tsx`.
- **Web** still tints flat masks. Mapping in
  `packages/shared/src/body-diagram.ts`, component in
  `apps/web/src/components/BodyDiagram.tsx`. The authed web app is frozen,
  so it stays on the masks until someone decides to port the layers.

## Mobile

### Assets

`apps/mobile/assets/images/muscles/`, all 1024 by 1024 PNG with alpha, on
one canvas so every file is registered to its base:

- `base_front`, `base_back`: the clay figure, transparent background.
- `<view>_<region>_primary` and `<view>_<region>_secondary` for 16 regions:
  the region painted blue, transparent everywhere else. Secondary is the
  lighter, partly transparent version.
- `back_rear_delts_mask`: there is no painted rear delts layer yet, so rear
  delts keep the old white mask and are tinted in code (`#1B5FA8` primary,
  `#A8C6E4` secondary).
- `bounds.json`: each layer's alpha bounding box, `[x0, y0, x1, y1]` with
  the ends exclusive. Regenerate it with
  `python3 apps/mobile/scripts/muscle-layer-bounds.py` (needs Pillow)
  whenever a layer changes.

### Mapping

Canonical muscle (`exercises.primary_muscle`, `secondary_muscles`) to
region. There is no upper back region: "upper back", which "middle back"
canonicalizes to, lights traps and lats. Neck lights nothing.

| Muscle | Regions |
|---|---|
| chest | front_chest |
| shoulders | front_delts, back_rear_delts |
| biceps | front_biceps |
| forearms | front_forearms, back_forearms |
| abs | front_abs |
| quads | front_quads |
| adductors | front_adductors |
| traps | back_traps |
| upper back | back_traps, back_lats |
| lats | back_lats |
| lower back | back_lower_back |
| triceps | back_triceps |
| glutes | back_glutes |
| abductors | back_abductors |
| hamstrings | back_hamstrings |
| calves | back_calves |
| neck | none |

Tokens pass through `canonMuscle`, so a stale spelling still lights the
right region and an unknown value lights nothing. A region in both lists
lights as primary only.

### Layers

Each view stacks, bottom to top: the base, every secondary layer, every
primary layer. All of them are core `Image` elements at full size inside one
inner box, so a single transform places the whole stack and nothing drifts
out of registration.

### Where it shows

- **Exercises tab, exercise screen**: the whole figure, front and back side
  by side, cropped to x 236 to 788 and y 18 to 1010 (`BODY_CROP`).
- **Exercise info sheet** (picker info button, workout card menu): one
  130pt circle per view that has a lit region, zoomed to those regions. Two
  circles side by side with small "Front" and "Back" labels when both views
  are lit; one circle and no label otherwise; nothing for neck.

### Circle zoom

`circleCrop` in `body-layers.ts`. Take the union of the lit layers' boxes
from `bounds.json`. The crop circle is centred on the union, and its
diameter is the union's diagonal (so the corners fit inside the circle)
plus 40 source pixels of padding on each side. The diameter is at least
360 source pixels, which caps the zoom at about 2.8 times the full-figure
scale and keeps a calf or an abductor shown with the leg or hips around it.
The centre is clamped so the circle stays on the canvas.

## Web

`apps/web/public/muscles/`: the two bases lossy WebP at quality 88 and 18
masks, `<name>_mask`, lossless WebP, white with the muscle shape in the
alpha channel. Each mask is a `div` with `background-color` set to the tint
and the image as its `mask-image` (with the `-webkit-` prefix),
`mask-size: 100% 100%`, no repeat. Secondary masks `#A8C6E4` under primary
masks `#1B5FA8`. The web keeps a separate upper back region
(`back_upper_back`) that mobile no longer has.

The crop is the same `BODY_CROP` box: each view is a container at aspect
ratio 552/992 with overflow hidden, and one inner layer sized to 1024/552
of the container width and offset by (-236, -18) at the same scale.

## Accessibility

One label per figure, primary then secondary muscles in words ("Body
diagram. Primary chest, shoulders. Secondary triceps"). On mobile the label
lists the muscles lit in that view. The layers underneath are hidden from
screen readers.

## How the web masks were made

One Gemini render per muscle, the target muscle in magenta on a green
figure, from the same pose as the base. The magenta was extracted to an
alpha channel, clipped to the base figure's alpha so nothing spills past the
silhouette, and overlaps between neighbouring muscles removed by
subtraction so each pixel belongs to one region.
