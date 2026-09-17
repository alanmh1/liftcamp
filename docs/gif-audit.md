# GIF audit, 16 Sep 2026

Every `exercises.gif_url_sm` was downloaded (548 files, all valid GIFs), laid out on 4×4 contact sheets of the middle frame, and reviewed one by one. Rows that looked off were re-checked as six-frame strips of the full clip. The fix is `docs/fix-gif-mismatches.sql`, not yet run.

## Counts

| | Count |
|---|---|
| GIFs reviewed | 548 |
| Match | 537 |
| Mismatch | 5 |
| Unsure, left as is | 6 |
| System template exercises with a GIF | 78 |
| Template exercises affected by a mismatch | 2 (Barbell Squat, Bodyweight Squat) |
| Template exercises in the unsure list | 4 (Standing Military Press, Pike Push-Up, Band Assisted Pull-Up, Cable Incline Pushdown) |

## Mismatches

| id | Exercise | What the GIF shows | Proposed fix |
|---|---|---|---|
| `85495e85-bd72-445d-a6c8-5961f17ec2e5` | Barbell Squat | A barbell box squat, sitting to a flat bench each rep. Same idea as Barbell Squat To A Bench, which has its own clip. | Point at `barbell-full-squat.gif` (360 and 180), a free barbell back squat. Speed Squats and Narrow Stance Squats show the same movement; Barbell Full Squat is the cleanest of the three. |
| `5c81a81d-cee6-4be5-96fd-3ddb65eeea00` | Bodyweight Squat | A rear-foot-elevated split squat with the back foot on a bench. | Null both GIF columns. No clip in the bucket shows a plain bodyweight squat (every body-only quad row and every `*squat*` object was checked). The picker and the info sheet fall back to the row's photos, which are right. |
| `2f5bb0e9-8e46-4296-a3d7-8d41ce03c238` | Cable Crunch | A crunch lying on an exercise ball. No cable in frame. | Point at `cable-seated-crunch.gif`, a rope crunch seated at a cable stack. |
| `b974386a-dc66-4eec-a8bf-8ec25e4f1746` | Seated Bent-Over Rear Delt Raise | Standing upright, raising two dumbbells behind the hips. | Point at `bent-over-dumbbell-rear-delt-raise-with-head-on-bench.gif`, a bent-over rear delt raise. It is standing rather than seated; the movement is the one the name describes. |
| `6d3f2ccf-3a41-49ac-bb40-200704c35fbf` | One-Arm Side Deadlift | A two-hand conventional deadlift. | Null both GIF columns. No suitcase or one-arm deadlift clip exists. The photos remain. |

One extra row in the SQL that is not a mismatch: Bulgarian Split Squat (`c5d02e3a-8be2-47b4-bd77-dd5623e3e562`) has no GIF and no photo, and it sits in 11 system programs. The clip filed under `bodyweight-squat.gif` is a bodyweight Bulgarian split squat, so the SQL moves that pointer to the Bulgarian row instead of leaving the file orphaned. The row's equipment is dumbbell and the clip is unloaded; the movement is right. The file keeps its misleading name in the bucket.

## Unsure, left as is

| id | Exercise | What the GIF shows | Why it stays |
|---|---|---|---|
| `83e390eb-2f53-427e-8870-2997eb172279` | Standing Military Press | A standing overhead press inside a Smith machine. Equipment is barbell. Used in 10 system programs. | No standing free-bar overhead press clip exists. Barbell Shoulder Press has a seated barbell clip and Standing Bradford Press goes behind the neck. At 180px the Smith bar reads as a barbell and the press is the right movement, so keeping it beats showing a seated press for a standing lift. If you would rather show the free bar, add `update public.exercises set gif_url = (select gif_url from public.exercises where slug = 'barbell-shoulder-press'), gif_url_sm = (select gif_url_sm from public.exercises where slug = 'barbell-shoulder-press') where id = '83e390eb-2f53-427e-8870-2997eb172279';` to Section 1. |
| `0c97a268-f6b4-45e8-9a09-72803400ef74` | Pike Push-Up | A pike push-up with the feet on an exercise ball. Used in Bodyweight Only and Calisthenics Full Body. | The movement is right and there is no floor version in the bucket. The row's only photo is a frame of the same clip, so nulling the GIF would not help. Hanging Pike is the only other `*pike*` row and is an abs move. |
| `49cef10a-71ec-4752-83d9-e7efd2500d6a` | Push Press | A dumbbell push press. Equipment is barbell. | Right movement, wrong implement. The only other push press clips are kettlebell. Not in any system template. |
| `0b4f2a6f-5b8b-4874-928b-7f560f47b06c` | Band Assisted Pull-Up | A plain pull-up with no band drawn. Used in Push Pull Legs 6 Day. | The movement is right. The photo does show the band. |
| `6c63abfe-d7e8-4ae1-9d37-a144e3f40fdc` | Standing Bent-Over One-Arm Dumbbell Triceps Extension | Both arms kicking back at once, the same clip idea as the Two-Arm row. | Right movement, arm count off. Not in any system template. |
| `85449b67-8a33-41d7-a814-1b3f70497239` | Cable Incline Pushdown | An incline straight-arm pulldown, lying back on an incline bench. Matches the row (cable, lats). | Not a GIF problem. Push Pull Legs 6 Day lists it as a triceps move on its push day; the exercise in the catalogue is a lat move. Worth swapping that template row for a pushdown, which is a separate change. |

Two rows first flagged from the contact sheets turned out fine on the full clip: Bodyweight Walking Lunge (alternating forward lunges, the middle frame was the standing phase) and Lying Face Up Plate Neck Resistance (face up on an incline bench, only the middle frame looked prone).

## Photos for system template exercises

The 97 exercises used in system templates were checked on `image_url` the same way. 88 have a photo, 9 have none and show the letter tile.

| | Count |
|---|---|
| Template exercises | 97 |
| With a photo | 88 |
| Photo matches | 87 |
| Photo mismatch | 1 |
| No photo | 9 |

The mismatch is Plank (`c0f86c40-21ec-4135-bef6-908d2bc3154b`): `image_url` (`plank-0.jpg`) is a kneeling hip flexor stretch and `image_url_2` (`plank-1.jpg`) is the plank. Plank has no GIF, so that first photo is what the picker, the info sheet and the public exercise page show, across 8 system programs. The SQL swaps the two.

Four template rows have an illustration rather than a free-exercise-db photo, drawn in the same style as their clip, so the photo and the GIF agree by construction: Pike Push-Up (the ball version noted above), Bodyweight Calf Raise, Knee Push-Up and Seated Machine Row. Cable Incline Pushdown's photo is the same incline pulldown as its GIF.

No photo, so a letter tile today, with the programs that use them:

- Banded Bent Over Row (Bands Upper / Lower; Full Body with Bands)
- Banded Lat Pulldown (Bands Upper / Lower; Full Body with Bands)
- Banded Romanian Deadlift (Bands Upper / Lower; Full Body with Bands)
- Bird Dog (Bodyweight Only)
- Bulgarian Split Squat (11 programs; gets the split squat GIF in the SQL)
- Cable Hip Abduction (Glute Focus)
- Dumbbell Hip Thrust (7 programs)
- Hip Thrust Machine (Machines Only)
- Wall Sit (Bodyweight Only)

## How it was done

TERMINAL, throwaway venv under the session scratchpad with pillow. `rows.json` came from a read-only select of `id, name, slug, equipment, primary_muscle, gif_url_sm, image_url, image_url_2` plus a flag for membership in any `is_system` template. GIFs were fetched one at a time (16 parallel requests hit a storage 429). Sheets are the middle frame of each clip at 220px, 16 per sheet, 35 sheets. Flagged rows were re-rendered as six evenly spaced frames. Replacement URLs were confirmed with a HEAD request on both the 180 and 360 objects. Nothing was written to the database.
