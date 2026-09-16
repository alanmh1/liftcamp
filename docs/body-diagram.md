# Body diagram

The clay figure on the exercise info views, mobile and web, with the worked
muscles tinted. Replaced `react-body-highlighter` on 16 Sep 2026. Both apps
draw from one mapping and one set of numbers in
`packages/shared/src/body-diagram.ts`; the assets are copied into each app.

## Assets

`apps/mobile/assets/images/muscles/` and `apps/web/public/muscles/`, the same
20 images each, all 1024 by 1024 with alpha:

- `base_front`, `base_back`: the clay figure, transparent background.
- 18 masks, `<name>_mask`: white RGB with the muscle shape in the alpha
  channel, registered pixel for pixel to the matching base.

Mobile holds them as PNG, bundled by Metro. The web serves WebP from
`/muscles/`: the two bases lossy at quality 88, the masks lossless, since a
mask's alpha edge is the highlight's edge and must not pick up artefacts.

## Mapping

Canonical muscle (`exercises.primary_muscle`, `secondary_muscles`,
`all_primary_muscles`) to mask. Lats and upper back are separate regions.
Neck lights nothing.

| Muscle | Masks |
|---|---|
| chest | front_chest |
| shoulders | front_delts, back_rear_delts |
| biceps | front_biceps |
| forearms | front_forearms, back_forearms |
| abs | front_abs |
| quads | front_quads |
| adductors | front_adductors |
| traps | back_traps |
| upper back | back_upper_back |
| lats | back_lats |
| lower back | back_lower_back |
| triceps | back_triceps |
| glutes | back_glutes |
| abductors | back_abductors |
| hamstrings | back_hamstrings |
| calves | back_calves |
| neck | none |

All 17 canonical values are covered, and the 17 are the only values in the
data (checked 16 Sep 2026 against every distinct primary and secondary
value). Tokens pass through `canonMuscle`, so a stale spelling still lights
the right region and an unknown value lights nothing.

## Layers

Front and back sit side by side. Each view stacks, bottom to top:

1. the base image
2. every secondary mask, tinted `#A8C6E4`
3. every primary mask, tinted `#1B5FA8`

A muscle in both lists renders as primary only.

On mobile the masks are core `Image` elements with `tintColor`, which
recolours the white pixels and keeps the alpha, so no native module is
needed. On the web each mask is a `div` with `background-color` set to the
tint and the PNG as its `mask-image` (with the `-webkit-` prefix),
`mask-size: 100% 100%`, no repeat.

## Crop

The figure occupies x 236 to 788 and y 18 to 1010 of the 1024 square, a box
of 552 by 992. Each view is a container at aspect ratio 552/992 with
overflow hidden, and one inner layer sized to 1024/552 of the container
width and offset by (-236, -18) at the same scale. Every image sits in that
inner layer at full size, so the base and the masks share one transform and
stay registered.

## Accessibility

One label on the whole diagram, primary then secondary muscles in words
("Body diagram. Primary chest, shoulders. Secondary triceps"). The layers
underneath are hidden from screen readers.

## How the masks were made

One Gemini render per muscle, the target muscle in magenta on a green
figure, from the same pose as the base. The magenta was extracted to an
alpha channel, clipped to the base figure's alpha so nothing spills past the
silhouette, and overlaps between neighbouring muscles removed by
subtraction so each pixel belongs to one region.
