# Body diagram

The clay figure on the exercise info views, mobile and web, with the worked
muscles highlighted. Replaced `react-body-highlighter` on 16 Sep 2026.

Both apps stack the same pre-rendered layers, with the blue painted into
the clay's own shading (mobile since 29 Sep 2026, web since 1 Nov 2026,
which until then tinted flat masks). Mapping and zoom math in
`packages/shared/src/body-layers.ts`, crop box in
`packages/shared/src/body-diagram.ts`. Components:
`apps/mobile/src/components/body-diagram.tsx` and
`apps/web/src/components/BodyDiagram.tsx`.

## Mobile

### Assets

`apps/mobile/assets/images/muscles/`, all 1024 by 1024 PNG with alpha, on
one canvas so every file is registered to its base:

- `base_front`, `base_back`: the clay figure, transparent background.
- `<view>_<region>_primary` and `<view>_<region>_secondary` for all 17
  regions: the region painted blue, transparent everywhere else. Secondary
  is the lighter, partly transparent version. Every region is painted;
  nothing on mobile is tinted in code.
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
plus 60 source pixels of padding on each side (raised from 40 on 30 Sep
2026, when the calves looked clipped at the bottom of the circle). The diameter is at least
360 source pixels, which caps the zoom at about 2.8 times the full-figure
scale and keeps a calf or an abductor shown with the leg or hips around it.
The centre is clamped so the circle stays on the canvas.

## Web

`apps/web/public/muscles/`: WebP copies of the 36 mobile PNGs, same names
(`base_front.webp`, `front_quads_primary.webp` and so on), lossy at
quality 85 with lossless alpha, 1024 square, so they register to the base
exactly as the PNGs do. The mobile PNGs are the single source. After a
layer changes, regenerate the copies and commit them:

```
pnpm --filter @liftcamp/web exec tsx scripts/sync-muscle-layers.ts
```

The script also deletes any WebP in that folder with no PNG behind it.

Input: primary from `all_primary_muscles`, falling back to
`primary_muscle` when that has no known muscle, and secondary from
`secondary_muscles`, through `bodyHighlights([all, primary], secondary)`.
The app passes `primary_muscle` alone.

Each view is a container at aspect ratio 552/992 with overflow hidden, and
one inner box sized to 1024/552 of the container width and offset by
(-236, -18) at the same scale (`BODY_CROP`). The layers are `img` elements
filling that box: base, secondary layers, primary layers. Layers load
lazily, except in the exercise page header (`eager`). The legend there uses
the flat `PRIMARY_TINT` and `SECONDARY_TINT` swatches.

## Accessibility

One label per figure, primary then secondary muscles in words ("Body
diagram. Primary chest, shoulders. Secondary triceps"). On mobile the label
lists the muscles lit in that view. The layers underneath are hidden from
screen readers.
