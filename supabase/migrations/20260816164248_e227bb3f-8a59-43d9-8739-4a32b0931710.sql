BEGIN;

CREATE OR REPLACE FUNCTION public.beginner_notes_require_instructions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.exercises e
    WHERE e.id = NEW.exercise_id
      AND e.description IS NOT NULL
      AND length(btrim(e.description)) > 0
  ) THEN
    RAISE EXCEPTION 'beginner_notes: exercise % has no instruction text; authoring it would publish an empty page', NEW.exercise_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.beginner_notes_require_instructions() FROM PUBLIC;

DROP TRIGGER IF EXISTS beginner_notes_require_instructions_trg ON public.beginner_notes;
CREATE TRIGGER beginner_notes_require_instructions_trg
  BEFORE INSERT OR UPDATE ON public.beginner_notes
  FOR EACH ROW EXECUTE FUNCTION public.beginner_notes_require_instructions();

-- barbell-squat
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Start with the empty bar. On most racks that''s 45 lb, and it is a real weight for a first session. Do 2 sets of 5 before you add anything.

If those 5 reps feel steady and you can pause at the bottom without wobbling, add 10 lb and go again. Most people finish week one somewhere between the bare bar and 95 lb. Where you land matters far less than adding a little each week.', 'Your heels lift off the floor. That''s usually tight ankles rather than bad technique. Put a 2.5 lb plate under each heel and it often disappears.

Your knees cave inward as you stand up. Push them out toward your little toes on the way up. Saying it out loud for the first few reps helps more than you''d think.

You round forward at the bottom. Stop going that deep. Squat to the depth you can hold with a flat back, and let the depth come as your hips loosen over a few weeks.',
       'If the squat rack is taken', 'Most gyms have one rack and four people circling it. These load your quads and glutes the same way and you can start any of them in under a minute.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['goblet-squat', 'hack-squat', 'dumbbell-squat']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'barbell-squat'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- barbell-bench-press
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'The empty bar, 45 lb, for 2 sets of 5. Nearly everyone can press it, and starting there means your first session is about learning the groove rather than surviving it.

Add 5 lb at a time, not 10. Bench progresses slower than squat and deadlift for almost everyone, and the smaller jumps keep you moving for longer before you stall.

Always use a spotter or the safety pins when you go heavy enough that a missed rep is possible. This is the one lift where getting stuck under the bar is a real risk.', 'Your elbows flare straight out to the sides. Tuck them to roughly 45 degrees from your body. Your shoulders will thank you in about six months.

The bar drifts toward your face. Aim for the bottom of your sternum, not your collarbone. If it keeps drifting, the weight is too heavy.

Your lower back arches off the bench hard enough that your hips lift. Plant both feet and press them into the floor. A small arch is normal; your hips leaving the bench is not.',
       'If the bench is taken', 'Flat bench is the busiest station in most gyms. Any of these press the same muscles, and the dumbbell version is arguably the better place to start anyway because each arm has to do its own work.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['dumbbell-bench-press', 'machine-bench-press', 'smith-machine-bench-press']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'barbell-bench-press'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- barbell-deadlift
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Load the bar with 45 lb plates even if that''s more than you need, because they set the bar at the right height off the floor. If 135 lb total is too heavy, stack plates or blocks under the bar instead of using smaller plates.

Do 1 set of 5, then decide. Deadlifts are tiring in a way that sneaks up on you, so 3 working sets is plenty for a first month.

Put the bar down between reps. Touch and go looks impressive and teaches you nothing about setting up correctly.', 'Your lower back rounds as the bar leaves the floor. Drop the weight. This is the one form problem worth stopping a set over.

The bar swings out away from your shins. Keep it dragging against your legs the whole way up. Wear long socks for the first few weeks.

You yank the bar off the floor and your hips shoot up first. Take the slack out of the bar before you pull, so you feel tension in your arms before anything moves.',
       'If the platform is busy', 'Deadlift platforms tend to be occupied for long stretches. The trap bar is the friendliest swap here and is easier on your lower back while you''re learning.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['trap-bar-deadlift', 'leverage-deadlift', 'romanian-deadlift']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'barbell-deadlift'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- romanian-deadlift
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, 'Your first Romanian deadlift', 'Go lighter than you expect. This is a hamstring exercise, not a test of what you can pull off the floor, and 95 lb done properly will make your hamstrings sore for two days.

Start with the bar plus 10 lb per side for 2 sets of 8. If you feel it in your lower back instead of the back of your legs, the weight is too heavy or your knees are too straight.

Sets of 8 to 12 work better here than sets of 5.', 'You bend your knees and it turns into a squat. Keep a soft knee bend and hold it. The movement comes from your hips travelling backward, not your knees bending.

You go too low. Stop when you feel the stretch in your hamstrings, usually just below the knee. Going lower only rounds your back.

Your shoulders round forward. Pull your shoulder blades together and hold them there for the whole set.',
       'If you only have dumbbells', 'This works with almost anything you can hold. Dumbbells actually make the stretch easier to feel because the weight can travel outside your knees.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['stiff-legged-dumbbell-deadlift', 'stiff-legged-barbell-deadlift', 'trap-bar-deadlift']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'romanian-deadlift'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- wide-grip-lat-pulldown
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Pick a weight you can pull for 10 reps with the last two feeling hard. For most beginners that''s somewhere around 50 to 70 lb, but the stack numbers vary so much between machines that the rep target is the better guide.

Set the thigh pad snug before you start. If your body lifts off the seat at the bottom of each pull, the pad is too high or the weight is too heavy.

Sets of 8 to 12 are the sweet spot.', 'You lean way back and turn it into a row. A small lean is fine. If your torso is at 45 degrees, drop the weight.

You pull the bar behind your neck. Pull to your collarbone instead. Behind the neck puts your shoulders in a position they don''t like and gives you nothing extra.

Your arms do all the work. Think about driving your elbows down toward your ribs rather than pulling with your hands.',
       'If the cable station is taken', 'Any pulldown variation trains the same muscles. Grip width changes the feel more than the result, so take whichever handle is free.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['close-grip-front-lat-pulldown', 'one-arm-lat-pulldown', 'full-range-of-motion-lat-pulldown']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'wide-grip-lat-pulldown'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- dumbbell-bench-press
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Start with 15 or 20 lb dumbbells for 2 sets of 8. Lighter than you''d guess, because each arm now has to stabilise its own weight and that is most of the difficulty at first.

Getting into position is its own skill. Sit on the end of the bench with the dumbbells on your thighs, then lie back and let your legs kick them up into place.

When you finish a set, don''t try to lower them slowly. Bring them to your chest, sit up with the movement, and set them down.', 'The dumbbells drift apart at the top. Press them up and slightly toward each other so they finish above your chest, not out beside your shoulders.

One arm lags behind the other. Slow the whole set down until they move together. This is normal and it evens out within a few weeks.

Your elbows go straight out to the sides at the bottom. Keep them at roughly 45 degrees from your body, same as the barbell version.',
       'If the heavy dumbbells are gone', 'Someone always has the 40s. A machine press gets you the same work with no setup, and the single-arm version lets you use a lighter weight for longer.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['machine-bench-press', 'one-arm-dumbbell-bench-press', 'dumbbell-bench-press-with-neutral-grip']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'dumbbell-bench-press'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- goblet-squat
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'A 20 or 25 lb dumbbell held against your chest is a good first weight. Do 2 sets of 8 and see how the last two reps feel.

Holding the weight in front is what makes this easier than a barbell squat, not harder. It acts as a counterbalance, so most people squat deeper on their first goblet squat than they can on their first barbell squat.

This is the squat to learn first if you''re new. There''s no rack to set up and nothing to fail under.', 'The weight drifts away from your chest. Hold it tight against your sternum with both hands cupped under the top end.

Your heels lift. Same fix as the barbell squat: a small plate under each heel while your ankles loosen up.

You stop halfway down. Try to bring your elbows to the inside of your knees at the bottom. That gives you a target instead of guessing at depth.',
       'If the kettlebells are taken', 'Any weight you can hold against your chest works. Start with none at all if you''re on your first session; bodyweight squats for 3 sets of 10 is a real starting point, not a warm-up.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['bodyweight-squat', 'dumbbell-squat', 'barbell-squat']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'goblet-squat'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- leg-press
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Machines vary wildly, so ignore the number on the stack for now. Load two 45 lb plates per side, do 8 reps, and judge from there. If the last rep is easy, add a plate.

Set the seat so your knees bend to about 90 degrees at the start. Deeper than that and your lower back rounds off the pad, which is the one thing worth avoiding here.

This is the friendliest heavy leg exercise in the gym. Nothing to balance, nothing to unrack, and if you fail a rep the machine catches it.', 'Your lower back lifts off the pad at the bottom. Don''t go as deep. The pad should stay against you the whole set.

You lock your knees hard at the top. Stop just short of straight and keep tension on your quads.

Your knees cave inward as you push. Push through the outside of your feet and think about spreading the platform apart.

You put your hands on your knees to help. Hold the handles instead.',
       'If both leg presses are taken', 'Leg press machines get camped on. A hack squat loads your quads almost identically, and a goblet squat needs nothing but a dumbbell and floor space.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['hack-squat', 'goblet-squat', 'dumbbell-squat']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'leg-press'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- barbell-shoulder-press
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Start with the empty bar for 2 sets of 5. Overhead pressing is the weakest of the big barbell lifts for almost everyone, and 45 lb overhead is harder than 45 lb on your back.

Add 5 lb at a time. Overhead press progresses slower than any other lift, and trying to add 10 lb a week stalls you inside a month.

Set the rack so the bar sits at collarbone height. Unracking from too low turns the setup into a front squat.', 'The bar hits your chin on the way up. Pull your head back slightly as the bar passes your face, then push it forward again once the bar clears.

You lean back and it turns into an incline press. Squeeze your glutes and brace your abs. If you still lean, the weight is too heavy.

The bar drifts forward in front of your face at the top. Finish with the bar over the middle of your feet, not out in front of you.',
       'If the rack is taken', 'Any overhead press trains the same thing. Dumbbells are the better first version for a lot of people because each arm finds its own path.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['dumbbell-shoulder-press', 'leverage-shoulder-press', 'seated-cable-shoulder-press']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'barbell-shoulder-press'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- side-lateral-raise
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Go lighter than feels reasonable. A pair of 5 or 10 lb dumbbells is the right starting point for most people, and that is not a typo.

Sets of 12 to 15 work far better here than sets of 5. This is a small muscle working through a long lever, so weight goes up slowly and that''s normal.

If you can only do it by swinging, halve the weight. A clean 8 lb raise builds more shoulder than a sloppy 25 lb one.', 'You swing the weight up with your lower back. Stand still and lift with your shoulders only. If you can''t, the weight is too heavy.

You raise your arms above shoulder height. Stop level with your shoulders. Higher brings your traps in and takes the work off the muscle you''re trying to train.

Your palms face upward at the top. Keep your thumbs slightly lower than your little fingers, like pouring water out of a jug.',
       'If the light dumbbells are all in use', 'Cables and bands give you the same movement with more even tension through the range, and there''s usually a free cable station when the dumbbell rack is packed.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['cable-seated-lateral-raise', 'one-arm-incline-lateral-raise', 'lateral-raise-with-bands']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'side-lateral-raise'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- barbell-curl
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'The bar plus 5 lb per side is a fine start. Do 3 sets of 10 and see how the last two reps feel.

Curls are one of the few places where chasing weight actively works against you. A weight you can lift for 10 controlled reps builds more arm than a weight you have to heave for 5.

If the straight bar bothers your wrists, use the EZ bar instead. That''s a wrist anatomy thing, not a technique problem.', 'You swing your torso back to start each rep. Stand with your back against a wall for a set. Whatever weight you can lift that way is your actual working weight.

Your elbows drift forward as you curl. Keep them pinned at your sides. Your elbows should be the only thing that doesn''t move.

You stop halfway down. Lower until your arms are almost straight every rep. The bottom half is where most of the growth happens.',
       'If the barbells are all taken', 'Every curl variation trains the same muscle. Dumbbells let each arm work independently, which is useful if one side is clearly stronger.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['ez-bar-curl', 'dumbbell-bicep-curl', 'machine-bicep-curl']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'barbell-curl'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- triceps-pushdown
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Pick a weight you can push for 12 clean reps. On most cable stacks that''s somewhere around 30 to 50 lb to start, but stacks differ enough that the rep count is the better guide.

Sets of 10 to 15 suit triceps well. Three sets at the end of a pressing day is plenty.

Stand about a foot back from the machine and lean forward slightly. Standing directly under the cable makes the bottom of every rep awkward.', 'Your elbows travel forward and back. Keep them at your sides and let only your forearms move.

You lean your whole bodyweight into the bar. If your heels lift, drop the weight.

You stop short at the bottom. Push until your arms are fully straight and pause for a beat. That lockout is the part that trains the triceps hardest.',
       'If the cable station is busy', 'Bench dips need nothing but a bench, and the dip machine loads the same muscles with a fixed path if you''re not confident holding your own bodyweight yet.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['triceps-pushdown-rope-attachment', 'bench-dips', 'dip-machine']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'triceps-pushdown'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- pullups
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Most beginners can''t do one yet, and that''s the normal starting point rather than a problem to be embarrassed about.

If you can do zero to two, do 5 sets of 1 to 3 reps with long rests, or use the assisted machine. If you can do 5 or more, work in sets of 5 and add reps before you add weight.

Negatives work well early on. Jump to the top, then lower yourself as slowly as you can. Three sets of 3 negatives, twice a week, and most people get their first full rep inside two months.', 'You swing your legs to get up. Cross your ankles and squeeze them together.

Your chin barely clears the bar and your shoulders shrug up. Pull your shoulder blades down first, then bend your arms.

You stop halfway down between reps. Straighten your arms at the bottom of every rep. Half reps feel productive and build very little.',
       'If you can''t do one yet', 'Chin-ups, palms toward you, are noticeably easier and most people get one of those first. Pulldowns train the same muscles at any weight you like, so they''re the place to build the strength.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['chin-up', 'wide-grip-lat-pulldown', 'one-arm-lat-pulldown']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'pullups'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- one-arm-dumbbell-row
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'A 25 or 30 lb dumbbell for 3 sets of 10 per arm is a reasonable opening. Rows tolerate more weight than most people expect, so don''t be shy about going up.

Put one knee and the same-side hand on a bench, with the other foot on the floor. Your back should be roughly parallel to the ground.

Do both arms before you rest. Whatever your weaker side manages sets the reps for both.', 'You twist your torso to get the weight up. Keep your shoulders square to the floor. A little rotation at the top is fine; turning your chest toward the ceiling is not.

You pull with your arm and your elbow flares out. Drive your elbow back toward your hip instead, and think of your hand as a hook.

Your back rounds. Set your chest before the first rep and hold that position for the whole set.',
       'If you only have a barbell', 'Any horizontal row does the same job. The barbell version works both sides at once and is faster; the cable version keeps tension on through the whole range.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['bent-over-barbell-row', 'seated-cable-rows', 'bent-over-two-dumbbell-row']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'one-arm-dumbbell-row'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- seated-cable-rows
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Start somewhere around 60 to 80 lb for 3 sets of 10, then adjust. Cable stacks are consistent enough between machines that the number will transfer.

Set your feet on the platform with a slight knee bend. Locked-out knees make the whole movement come from your lower back.

This is the easiest row to learn because the machine holds you in position. If you''re new to back training, start here before the barbell version.', 'You rock forward and backward to move the weight. Your torso should stay upright. If you''re rowing with your whole body, drop the weight.

Your shoulders round forward at the front of each rep. Let the weight stretch your lats, but keep your chest up rather than collapsing toward your knees.

You pull the handle to your chest. Aim for your belly button instead, and drive your elbows past your ribs.',
       'If the row station is taken', 'Any horizontal pull substitutes cleanly. The dumbbell version also fixes side to side imbalances, which the cable version can hide.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['one-arm-dumbbell-row', 'bent-over-barbell-row', 'leverage-high-row']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'seated-cable-rows'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

-- plank
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, 'Aim for 20 to 30 seconds on your first attempt, not the two minutes you''ve seen people post about. Three sets of 20 clean seconds beats one shaky minute.

Elbows under your shoulders, forearms flat, feet together. Your body should make one straight line from your heels to the back of your head.

Add 5 seconds a session. When you can hold 60 seconds with good position, stop adding time and start adding difficulty instead.', 'Your hips sag toward the floor. This is the one that matters. Squeeze your glutes and tuck your hips slightly under. If they sag again, end the set.

Your hips ride up into a peak. You''re resting rather than working. Lower them until your body is flat.

You hold your breath. Breathe normally the whole way through. If you can''t, you''re past the point where the set is doing anything useful.',
       'When 60 seconds gets easy', 'Holding longer stops paying off past a minute or so. Move to loaded ab work instead, where you can add weight the way you would on any other exercise.',
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(ARRAY['cable-crunch', 'flat-bench-lying-leg-raise', 'ab-crunch-machine']) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM public.exercises e
WHERE e.slug = 'plank'
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;

COMMIT;