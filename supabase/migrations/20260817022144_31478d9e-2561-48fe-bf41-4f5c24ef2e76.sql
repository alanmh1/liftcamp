UPDATE public.exercises
SET description = 'Set the chest pad so your sternum rests against it with your arms fully extended. Grab the handles and let your shoulder blades stretch forward at the start. Pull the handles to your ribs with your elbows close to your sides, pause with the shoulder blades pinched together, then let the weight travel forward slowly under control.'
WHERE slug = 'seated-machine-row'
  AND coalesce(length(btrim(description)), 0) = 0;

WITH data(slug, sw, fb, sh, sm, subs) AS (
  VALUES
  ('incline-dumbbell-press',
   $t$Most untrained men should start with 15 to 20 lb dumbbells, most untrained women with 8 to 12 lb. The incline is harder than it looks, so go lighter than whatever you would flat press.

You have got it right if you can do 10 reps and stop with 2 left in you, and the last rep looks the same as the first.$t$,
   $t$Set the bench to 30 degrees. Higher than that turns it into a shoulder press.

Sit down with the dumbbells on your thighs, then kick them up one at a time as you lie back. Start with the dumbbells at chest level, elbows about 45 degrees out from your ribs.

Press up and slightly in, stopping just short of locking your elbows. Lower for a count of 2 until you feel a stretch across the upper chest.

Most common mistake: setting the bench too steep. At 45 degrees or above the front delts take over and the chest barely works. Drop the pin one or two notches.$t$,
   'If the incline bench is taken',
   $t$The machine press is the closest swap when you want the same pressing pattern with no setup; sit slightly lower in the seat than you think to hit the upper chest. Chest dips are good if you already handle bodyweight work, though they train the lower chest instead of the upper. The incline barbell version is the same angle with one bar instead of two dumbbells: easier to load, less range of motion.$t$,
   ARRAY['machine-bench-press','dips-chest-version','incline-barbell-bench-press']::text[]),

  ('dumbbell-flyes',
   $t$Take about half of what you would press. If you press 20 lb dumbbells, fly with 10. Beginners almost always grab too much here and turn it into a sloppy press.

You have got it right if you can hold the bottom position for a full second without your elbows collapsing.$t$,
   $t$Lie flat with the dumbbells over your chest, palms facing each other. Bend your elbows to about 15 degrees and keep them locked there for the whole set. The angle never changes.

Open your arms in a wide arc until your upper arms are roughly level with the bench, then bring them back up along the same arc and stop before the dumbbells touch.

Most common mistake: bending and straightening the elbows, which quietly turns the movement into a bad press. Set the elbow angle before the first rep and hold it.$t$,
   'If both flat benches are busy',
   $t$The pec deck is the same movement with the path fixed for you, which makes it the safer option while you are learning; use it first if flyes feel awkward. The cable crossover gives constant tension through the whole range, so pick it when the machine is taken but the cable station is open.$t$,
   ARRAY['butterfly','cable-crossover']::text[]),

  ('butterfly',
   $t$Start at 20 to 30 lb on the stack. The seat height matters more than the weight here, so spend the first set finding the right pin.

You have got it right when the handles sit level with your mid chest and your shoulders stay down.$t$,
   $t$Set the seat so the handles are at chest height when you sit with your back flat against the pad. Grip the handles with a slight bend in the elbows.

Bring the handles together in front of your chest and pause for a beat. Let them travel back until you feel a stretch, then stop; going further past the shoulder line strains the front of the joint for no extra benefit.

Most common mistake: shrugging on every rep. If your shoulders climb toward your ears, drop the weight by a plate and pull your shoulder blades down before you start.$t$,
   'If the pec deck is occupied',
   $t$Dumbbell flyes are the free-weight version of the same movement: harder to balance, more work for the stabilizers. The cable crossover has a similar tension curve with more room to change the angle.$t$,
   ARRAY['dumbbell-flyes','cable-crossover']::text[]),

  ('machine-bench-press',
   $t$Start at 30 to 40 lb on the stack, or the empty carriage plus one 10 lb plate if it is a plate-loaded machine. Machines vary a lot, so treat your first set as a test and adjust from there.

You have got it right if 10 reps feel steady and you are not fighting the seat.$t$,
   $t$Set the seat so the handles line up with the middle of your chest, not your collarbone. Sit back with your shoulder blades flat against the pad and both feet on the floor.

Press out until your elbows are almost straight, then return under control until your hands are back level with your chest.

Most common mistake: letting the seat sit too low, which pushes the press angle up into the shoulders. Check the handle height every time, since the last person probably changed it.$t$,
   'If the press machine is in use',
   $t$The incline dumbbell press is more demanding on balance, which is a fair trade once you have a few weeks in. The barbell bench press is the standard free-weight version, worth swapping to only if someone can spot you.$t$,
   ARRAY['incline-dumbbell-press','barbell-bench-press']::text[]),

  ('dips-chest-version',
   $t$Your bodyweight is the load, so the question is how much help you need. Use the assisted dip machine and set the counterweight at about 40 percent of your bodyweight to start, then take 10 lb off as it gets easier.

You are ready for unassisted dips when you can do 12 clean reps with the counterweight under 20 lb.$t$,
   $t$Grip the bars and press up to a straight-arm hold. Get stable before you move.

Lean your torso forward about 30 degrees and hold that lean. The forward angle is what makes this the chest version.

Lower until your upper arms are parallel with the floor, elbows tracking back and slightly out, then press back up without letting the torso come upright.

Most common mistake: dropping too deep. If your shoulders sink below your elbows the load moves onto the joint capsule. Stop at parallel.$t$,
   'If there is no dip station',
   $t$The machine press lets you train the same push with a load you control precisely. The decline dumbbell bench press hits the lower chest the way dips do, with less shoulder strain.$t$,
   ARRAY['machine-bench-press','decline-dumbbell-bench-press']::text[]),

  ('bent-over-barbell-row',
   $t$Start with the empty 45 lb bar. If holding a flat back at that weight is hard, use a 33 lb bar or a fixed 30 lb barbell instead.

You have got it right when you can do all 10 reps without your back rounding on the last two.$t$,
   $t$Stand with feet hip-width, bar over your mid foot, hands just outside your knees. Push your hips back and bend forward until your torso is about 45 degrees from the floor, keeping a small arch in the lower back.

Pull the bar to your belly button, driving your elbows back past your ribs, and squeeze your shoulder blades together at the top for one count. Lower the bar all the way down under control.

Most common mistake: standing up a little on each rep to help the bar move. Lock the torso angle in place and let only your arms move. If you cannot, the bar is too heavy.$t$,
   'If the barbell area is crowded',
   $t$The machine row is the same pulling direction with the lower back taken out of it, which is the better choice on days when your back is already tired. The one-arm dumbbell row works one side at a time with your chest supported, so it shows up any imbalance. The T-bar row keeps a similar hinge position with a more stable, fixed path.$t$,
   ARRAY['seated-machine-row','one-arm-dumbbell-row','t-bar-row-with-handle']::text[]),

  ('seated-machine-row',
   $t$Start at 30 to 40 lb. Machine rows let you go heavier than free-weight rows because you are not holding your own torso up, so expect to add weight faster here.

You have got it right if your shoulder blades move at the end of every rep instead of only your arms.$t$,
   $t$Set the chest pad so your sternum rests against it with your arms fully extended. Grab the handles and let your shoulder blades stretch forward at the start.

Pull the handles to your ribs with your elbows close to your sides, and pause for a count with your shoulder blades pinched together. Let the weight travel forward slowly; that stretch at the front is half the exercise.

Most common mistake: pulling with the arms only. Think about starting the movement from the shoulder blades and letting the hands follow.$t$,
   'If the row machine is taken',
   $t$The bent over barbell row is more work overall, since your back holds the position too. The seated cable row is a nearly identical movement at the cable stack.$t$,
   ARRAY['bent-over-barbell-row','seated-cable-rows']::text[]),

  ('close-grip-front-lat-pulldown',
   $t$Start around 40 to 50 lb, or roughly a third of your bodyweight. The close grip lets you use more weight than a wide grip, so do not copy your wide-grip number down.

You have got it right if you can pull the handle to your collarbone without the bench rising off the pad.$t$,
   $t$Set the thigh pad snug so your legs stay pinned when you pull. Take the V-handle with palms facing each other and sit tall.

Lean back about 15 degrees and hold it. Pull the handle to the top of your chest with your elbows driving down toward your hips, then let the handle rise until your arms are straight and you feel your lats stretch.

Most common mistake: leaning back further and further as the set goes on, which turns the pulldown into a row. Pick your torso angle on rep one and keep it.$t$,
   'If the pulldown station has a line',
   $t$The wide-grip pulldown is the same station with a different handle and slightly more upper-back involvement. Band assisted pull-ups train the same pattern with your bodyweight, which carries over better to real pull-ups. The machine row is a different pull direction, but a reasonable stand-in when nothing overhead is free.$t$,
   ARRAY['wide-grip-lat-pulldown','band-assisted-pull-up','seated-machine-row']::text[]),

  ('hyperextensions-back-extensions',
   $t$Bodyweight, arms crossed over your chest. Add a 10 lb plate held to your chest only after you can do 15 reps with no bounce at the bottom.

You have got it right when your lower back does the work and your hamstrings feel it too.$t$,
   $t$Set the pad just below your hip bones so your hips can bend freely. Cross your arms over your chest and hold your body in one straight line.

Bend at the hips and lower your torso until you feel a stretch in the hamstrings, then raise back up until your body is straight again and stop there.

Most common mistake: swinging up past straight into an arch. The extra range does nothing for the muscle and compresses the lower back. Stop when your body forms a line.$t$,
   'If the hyperextension bench is taken',
   $t$The stiff-legged dumbbell deadlift trains the same hip hinge standing up, with a load you can adjust. The glute-ham raise is a harder version of the same idea, worth it only once you can do 20 bodyweight extensions.$t$,
   ARRAY['stiff-legged-dumbbell-deadlift','glute-ham-raise']::text[]),

  ('dumbbell-shrug',
   $t$Start with 20 to 25 lb in each hand. The range of motion is short, so you can handle more than you would expect, but grip usually gives out before the traps do.

You have got it right if your shoulders move a couple of inches straight up and your elbows stay locked.$t$,
   $t$Stand with a dumbbell in each hand, arms hanging straight, feet hip-width. Raise your shoulders straight up toward your ears.

Hold at the top for a full second, then lower slowly and let the traps stretch at the bottom.

Most common mistake: rolling the shoulders in circles. Shrugs go up and down. Rolling adds wear on the shoulder joint and does not add anything.$t$,
   'If you do not have heavy enough dumbbells',
   $t$The barbell shrug is easier to load past 50 lb per side, and holding the bar in front of or behind the thighs both work. The cable shrug keeps tension on the traps at the bottom and the handle never scrapes your legs.$t$,
   ARRAY['barbell-shrug','cable-shrugs']::text[]),

  ('dumbbell-shoulder-press',
   $t$Most untrained men should start with 12 to 15 lb dumbbells, most untrained women with 5 to 8 lb. Shoulders are usually the weakest pressing muscle, so this number will be well under your bench press.

You have got it right if you can press 10 reps without your lower back arching off the seat.$t$,
   $t$Sit on a bench with the back pad set upright, dumbbells at shoulder height, palms forward. Brace your abs so your ribs stay down.

Press straight up and slightly together, stopping just short of lockout, then lower until your elbows are level with your shoulders.

Most common mistake: arching the lower back to get the weight up, which turns it into an incline press. If your back leaves the pad, drop 5 lb per hand.$t$,
   'If the shoulder press bench is taken',
   $t$Standing removes the back support, so the military press makes your core work harder and you will use less weight. The machine press has a fixed path and is easy to load, which makes it the right pick on a heavy day with no spotter. The Arnold press adds rotation on the way up; save it for when the basic press feels routine.$t$,
   ARRAY['standing-military-press','machine-shoulder-military-press','kettlebell-arnold-press']::text[]),

  ('standing-military-press',
   $t$Start with the empty 45 lb bar. If that is a grind, use a 33 lb bar or a 15 lb training bar. This is one of the few lifts where the empty bar is a real workout for a beginner, so there is no rush to load plates.

You have got it right when the bar travels straight up and your feet do not shift.$t$,
   $t$Set the bar on your front delts, hands just outside shoulder width, elbows under the bar. Stand with feet hip-width, squeeze your glutes and brace your abs.

Pull your head back slightly so the bar clears your chin. Press straight up and move your head back through as the bar passes your forehead, finishing with the bar over the middle of your feet and arms locked.

Most common mistake: pressing the bar forward in an arc around the face. The bar should travel in a straight vertical line. Move your head, not the bar.$t$,
   'If the barbell or rack is in use',
   $t$With dumbbells each arm works alone, which shows up any imbalance. The machine press is the easiest version to learn on, since balance is not part of the job.$t$,
   ARRAY['dumbbell-shoulder-press','machine-shoulder-military-press']::text[]),

  ('face-pull',
   $t$Start at 20 to 30 lb. This is a small-muscle exercise and going heavy defeats the purpose, since the load just shifts to the lats.

You have got it right when you can pause at the end of the rep with your hands beside your ears.$t$,
   $t$Set the cable pulley at about eye height with a rope attachment. Take one end of the rope in each hand, palms facing in, and step back until the cable is tight.

Pull the rope toward your face, splitting your hands apart as it comes, and finish with your hands beside your ears and your elbows level with your shoulders. Return slowly and let your shoulder blades travel forward.

Most common mistake: pulling to the chest instead of the face and dragging the elbows down. Keep the elbows high through the whole rep.$t$,
   'If the cable station is occupied',
   $t$Reverse machine flyes train the same rear delts and upper back with the path set for you. The bent-over dumbbell rear delt raise needs nothing beyond a pair of light dumbbells, 5 to 10 lb.$t$,
   ARRAY['reverse-machine-flyes','seated-bent-over-rear-delt-raise']::text[]),

  ('reverse-machine-flyes',
   $t$Start with the lightest 2 plates on the stack, usually 15 to 25 lb. Rear delts are small and most beginners have never trained them directly.

You have got it right if you feel it across the back of the shoulders and not in your traps.$t$,
   $t$Turn the pec deck seat around so your chest faces the pad. Set the handles so they are at shoulder height when you reach forward.

Pull your arms out and back in a wide arc with the elbows slightly bent. Stop when your arms are level with your torso and hold for a count, then let the handles come back forward slowly.

Most common mistake: pulling with the elbows bent hard, which turns the movement into a row and gives the work to the mid back. Keep the arms long.$t$,
   'If the machine is set up for chest',
   $t$Face pulls hit the same target muscles with more work for the rotator cuff. The bent-over dumbbell rear delt raise needs nothing but light dumbbells and a bench to lean on.$t$,
   ARRAY['face-pull','seated-bent-over-rear-delt-raise']::text[]),

  ('hammer-curls',
   $t$Start with 15 lb dumbbells if you are a man, 8 lb if you are a woman. The neutral grip is stronger than a regular curl grip, so you can usually go about 5 lb heavier per hand than a standard dumbbell curl.

You have got it right if your elbows stay pinned to your sides for all 10 reps.$t$,
   $t$Stand with a dumbbell in each hand, palms facing your thighs, and keep your elbows tight against your ribs.

Curl one or both dumbbells up to shoulder height without turning the wrist, then lower for a count of 2 all the way to straight arms.

Most common mistake: swinging the torso to start each rep. Stand with your back against a wall for one set and you will feel exactly how much you were cheating.$t$,
   'If the dumbbell rack is picked over',
   $t$The EZ-bar curl puts both arms on one bar and is easier to load in small jumps. A standing cable curl with a rope gives you the same neutral grip with constant tension.$t$,
   ARRAY['ez-bar-curl','standing-biceps-cable-curl']::text[]),

  ('ez-bar-curl',
   $t$The empty EZ bar weighs 15 to 25 lb depending on the gym, which is enough for most people on day one. Add a 5 lb plate per side once you can do 12 clean reps.

You have got it right when you can lower the bar slowly instead of letting it drop.$t$,
   $t$Grip the bar on the angled sections, palms up, hands about shoulder-width. Stand tall with elbows at your sides and a slight bend in the knees.

Curl the bar up to chest height, keeping your elbows still, then lower under control until your arms are straight.

Most common mistake: letting the elbows drift forward at the top, which parks the weight on your shoulders and takes the tension off the biceps. Keep the upper arms vertical.$t$,
   'If the EZ bar is in use',
   $t$Hammer curls use a different grip with more forearm work, and dumbbells are usually available. The straight-bar barbell curl is harder on the wrists for some people, which is exactly why the EZ bar exists.$t$,
   ARRAY['hammer-curls','barbell-curl']::text[]),

  ('triceps-pushdown-rope-attachment',
   $t$Start at 20 to 30 lb. Beginners tend to load this one up and then lean their whole bodyweight into it, which trains almost nothing.

You have got it right if you can do 12 reps standing upright with your elbows locked at your sides.$t$,
   $t$Clip a rope to the high pulley and take one end in each hand. Stand about a foot back from the stack with a small forward lean and your elbows tucked in.

Push the rope down until your arms are straight, pulling the two ends apart at the bottom, then let your hands rise until your forearms are just past parallel with the floor.

Most common mistake: the elbows flaring out and drifting forward, which turns it into a chest press. If they move, the weight comes down.$t$,
   'If the cable stack is busy',
   $t$Triceps dips are the heavier compound version of the same push and train more muscle at once. The lying triceps press needs only a bench and an EZ bar. The overhead rope extension hits the long head of the triceps, which the pushdown mostly misses.$t$,
   ARRAY['dips-triceps-version','lying-triceps-press','cable-rope-overhead-triceps-extension']::text[]),

  ('dips-triceps-version',
   $t$Bodyweight. On the assisted machine, set the counterweight at about 40 percent of your bodyweight and work down from there.

If there is no assisted machine, use a bench dip with your feet on the floor until you can hold a straight-arm support for 30 seconds.$t$,
   $t$Press up to a straight-arm hold on the parallel bars. Keep your torso as upright as you can; the vertical torso is what shifts the work to the triceps.

Lower until your elbows hit 90 degrees, keeping them tucked close to your sides, then press back up and stop just short of locking out.

Most common mistake: letting the elbows flare wide, which moves the load to the chest and shoulders. Elbows point backward, not out.$t$,
   'If the dip bars are taken',
   $t$The rope pushdown is the same push pattern with a precise load and no balance required. Bench dips need nothing but a bench, and the close-grip bench press is the barbell version of the same job: set your hands shoulder-width, no closer.$t$,
   ARRAY['triceps-pushdown-rope-attachment','bench-dips','smith-machine-close-grip-bench-press']::text[]),

  ('leg-extensions',
   $t$Start at 30 to 40 lb. This one isolates a single joint, so the number will be well below anything you use on squats or the leg press.

You have got it right if you can pause at the top for a count without your hips lifting off the seat.$t$,
   $t$Set the seat back so your knees line up with the pivot point of the machine, and set the ankle pad to sit just above your shoe, on the lower shin.

Straighten your legs until they are level with the floor and hold for a beat, then lower slowly and stop just before the weight touches down.

Most common mistake: swinging the weight up with a kick and letting it crash back. Slow the lowering to a 3-count and the exercise starts working immediately.$t$,
   'If the extension machine is taken',
   $t$The Bulgarian split squat trains the quads with the whole leg working, and it is much harder. The dumbbell squat is the compound alternative if you would rather train the pattern than the single muscle.$t$,
   ARRAY['bulgarian-split-squat','dumbbell-squat']::text[]),

  ('seated-hamstring-curl',
   $t$Start at 30 to 40 lb. Hamstrings are usually undertrained compared to quads, so expect this number to be lower than your leg extension weight at first.

You have got it right when you can complete 10 reps without your hips sliding forward in the seat.$t$,
   $t$Set the back pad so your knees line up with the pivot of the machine, set the ankle pad across your lower calves just above the heel, and pull the thigh pad down snug so your legs stay put.

Curl your heels down and back as far as the machine allows, hold for a count, then return slowly until your legs are almost straight.

Most common mistake: cutting the range short at both ends. Most people move through about half of what the machine offers. Drop the weight and take the full path.$t$,
   'If the curl machine is in use',
   $t$The stiff-legged dumbbell deadlift trains the hamstrings by stretching them under load instead of bending the knee. The standing leg curl is the same knee-bend movement one leg at a time, so the numbers will not match between the two.$t$,
   ARRAY['stiff-legged-dumbbell-deadlift','standing-leg-curl']::text[]),

  ('bulgarian-split-squat',
   $t$Bodyweight only for the first two weeks. Balance is the limiting factor here and adding dumbbells before you have it just makes the balance worse.

Once you can do 10 reps per leg without touching the floor with your hands, add 15 lb dumbbells.$t$,
   $t$Stand about 2 feet in front of a bench, facing away, and put the top of your rear foot on the bench. The rear leg is a kickstand, not a working leg.

Lower straight down until your front thigh is level with the floor and your rear knee is close to the ground, then press through your front heel to stand back up. Do all the reps on one leg before switching.

Most common mistake: standing too close to the bench, which jams the front knee forward and puts everything on the kneecap. If your knee hurts, step further forward.$t$,
   'If both benches are taken',
   $t$The dumbbell squat works both legs at once: easier to balance, less demanding per leg. Walking lunges give similar single-leg work with no bench, though you need about 30 feet of clear floor. Leg extensions are quad work with no balance component at all, which is fine as a fallback on a crowded night.$t$,
   ARRAY['dumbbell-squat','bodyweight-walking-lunge','leg-extensions']::text[]),

  ('stiff-legged-dumbbell-deadlift',
   $t$Start with 20 to 25 lb dumbbells. The weight matters less than the hinge here, and going heavy early is the fastest way to round your back.

You have got it right if you feel a strong stretch in the hamstrings at the bottom and nothing in your lower back.$t$,
   $t$Stand with feet hip-width, dumbbells in front of your thighs, knees slightly bent. Push your hips back and let the dumbbells travel down along your legs.

Keep the knees at that same slight bend the whole time: they do not straighten and they do not bend further. Stop when you feel the hamstrings stretch, usually around mid shin, then drive your hips forward to stand up and squeeze your glutes at the top.

Most common mistake: bending at the waist with a rounded back instead of pushing the hips back. Set up 6 inches from a wall with your back to it and practice touching the wall with your hips.$t$,
   'If the dumbbells you need are gone',
   $t$Back extensions train the same hip hinge with bodyweight and a supported torso, which makes a flat back easier to keep. The Romanian deadlift is the barbell version and loads heavier once your form holds up. The seated hamstring curl is a different way into the same muscle, useful when your lower back is already worked.$t$,
   ARRAY['hyperextensions-back-extensions','romanian-deadlift','seated-hamstring-curl']::text[]),

  ('dumbbell-squat',
   $t$Start with 20 to 25 lb in each hand, or a single 25 lb dumbbell held at your chest if the grip is the problem. Depth is worth more than load at this stage.

You have got it right if you can sit to just below parallel with your heels flat on the floor.$t$,
   $t$Stand with feet shoulder-width, toes pointed out about 15 degrees, a dumbbell hanging at each side. Brace your abs and push your hips back and down together.

Lower until your thighs pass parallel with the floor, chest up the whole way, then drive through your mid foot to stand back up.

Most common mistake: the heels lifting at the bottom, which usually means tight ankles. Put a 5 lb plate under each heel while you work on ankle mobility.$t$,
   'If the dumbbell rack is cleaned out',
   $t$The Bulgarian split squat works one leg at a time, so you need much less weight to make it hard. The goblet squat puts one dumbbell or kettlebell at the chest, and the front load makes it easier to stay upright. The leg press is the machine option when you want to train legs heavy without balancing anything.$t$,
   ARRAY['bulgarian-split-squat','goblet-squat','leg-press']::text[]),

  ('hanging-leg-raise',
   $t$Bodyweight, and start with knees tucked rather than legs straight. Straight legs roughly double the difficulty and almost nobody can do them clean on day one.

Move to straight legs once you can do 12 knee raises without swinging.$t$,
   $t$Hang from a pull-up bar with an overhand grip, arms straight, body still. Pull your shoulder blades down so you are not hanging dead from the joints.

Raise your knees toward your chest, curling your hips up at the top, then lower slowly until your legs hang straight again and stop the swing before the next rep.

Most common mistake: swinging from the shoulders and using momentum on every rep. Pause for a full second at the bottom of each one. Your rep count will drop and the exercise will start working.$t$,
   'If your grip gives out before your abs do',
   $t$The flat bench lying leg raise is the supported version, so grip stops being the limit; keep your hands under your hips to protect the lower back. The plank is a different job, since it trains bracing instead of hip flexion, but it is worth having in the rotation anyway.$t$,
   ARRAY['flat-bench-lying-leg-raise','plank']::text[])
)
INSERT INTO public.beginner_notes
  (exercise_id, block_heading, starting_weight_md, form_breakdown_md,
   substitution_heading, substitution_md, substitute_exercise_ids)
SELECT e.id, NULL, d.sw, d.fb, d.sh, d.sm,
  COALESCE((SELECT array_agg(s.id ORDER BY w.ord)
            FROM unnest(d.subs) WITH ORDINALITY AS w(slug, ord)
            JOIN public.exercises s ON s.slug = w.slug), '{}'::uuid[])
FROM data d
JOIN public.exercises e ON e.slug = d.slug
ON CONFLICT (exercise_id) DO UPDATE SET
  block_heading           = EXCLUDED.block_heading,
  starting_weight_md      = EXCLUDED.starting_weight_md,
  form_breakdown_md       = EXCLUDED.form_breakdown_md,
  substitution_heading    = EXCLUDED.substitution_heading,
  substitution_md         = EXCLUDED.substitution_md,
  substitute_exercise_ids = EXCLUDED.substitute_exercise_ids;