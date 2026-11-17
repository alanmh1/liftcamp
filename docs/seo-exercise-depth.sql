-- SEO depth for two exercise pages that Google already shows on page 7 or
-- deeper (17 Nov 2026):
--   /exercises/hyperextensions-back-extensions  "back hyperextension" 60,500/mo, KD 0, position 62
--   /exercises/band-assisted-pull-up            "assisted pull up"     9,900/mo, KD 10, position 76
--
-- 1. Renames "Hyperextensions (Back Extensions)" to "Back Hyperextension" so
--    the page title reads "How to Do Back Hyperextension Correctly: Muscles
--    Worked". The slug, and so the URL, stays the same. The old name goes
--    into alias_text so search in the app and history import still match it.
-- 2. Adds sets and reps, the 45 vs 90 degree bench, and a first pull-up path
--    to the beginner notes.
--
-- Safe to run more than once. Run in the Supabase SQL editor.

begin;

do $$
begin
  if not exists (select 1 from exercises where slug = 'hyperextensions-back-extensions' and owner_id is null) then
    raise exception 'missing exercise hyperextensions-back-extensions';
  end if;
  if not exists (select 1 from exercises where slug = 'band-assisted-pull-up' and owner_id is null) then
    raise exception 'missing exercise band-assisted-pull-up';
  end if;
end $$;

-- 1. Rename, keeping the old name searchable.
update exercises
set name = 'Back Hyperextension',
    alias_text = case
      when coalesce(alias_text, '') like '%hyperextensionsbackextensions%' then alias_text
      else concat_ws('|', nullif(alias_text, ''), 'hyperextensionsbackextensions', 'backhyperextension')
    end
where slug = 'hyperextensions-back-extensions'
  and owner_id is null;

-- 2a. Back hyperextension notes.
update beginner_notes b
set starting_weight_md = $md$Bodyweight, arms crossed over your chest, for 3 sets of 12 to 15.

Add a 10 lb plate held to your chest only after you can do 3 sets of 15 with no bounce at the bottom. Moving your hands from your chest to behind your head makes it harder again without adding weight.

You have got it right when your lower back does the work and your hamstrings and glutes feel it too.$md$,
    form_breakdown_md = $md$Set the pad just below your hip bones so your hips can bend freely. Cross your arms over your chest and hold your body in one straight line.

Bend at the hips and lower your torso until you feel a stretch in the hamstrings, then raise back up until your body is straight again and stop there.

Most common mistake: swinging up past straight into an arch. The extra range does nothing for the muscle and compresses the lower back. Stop when your body forms a line.

Most gyms have a 45 degree bench, where you start already leaning forward. Some have a flat 90 degree bench, where your body starts level with the floor and the top of each rep is harder. The setup and the stopping point are the same on both, so start on the 45 degree one if you have the choice.

To put more of the work on your glutes, turn your toes out slightly and squeeze your glutes to come up. Take about two seconds on the way down and pause for a second at the top, so the movement never turns into a swing.$md$
from exercises e
where e.id = b.exercise_id
  and e.slug = 'hyperextensions-back-extensions'
  and e.owner_id is null;

-- 2b. Band assisted pull-up notes.
update beginner_notes b
set starting_weight_md = $md$Start with the thickest band available, usually green or black. It takes 40 to 80 lb off your bodyweight at the bottom, which is exactly where you need it.

Do 3 sets of 5. When you can do 3 sets of 8 with clean form, move to the next band down.

Loop the band over the bar, put one knee or foot in the bottom, and step in while holding the bar. The band pulls hardest at the bottom of the rep and gives you almost nothing at the top, which matches where a pull-up is hard.

To get your first unassisted pull-up, train them two or three times a week. Most people move down a band every two to four weeks. Once the thinnest band is easy for 3 sets of 8, try one rep with no band, and add slow negatives in the meantime: jump or step up to the top and lower yourself over three to five seconds.$md$,
    form_breakdown_md = $md$Grip the bar just outside shoulder width with your palms facing away. Palms facing you makes it a chin-up, which is a little easier and a fine place to start.

You bounce out of the bottom off the band's stretch. Pause for a beat with your arms straight before you pull.

Your chin barely clears the bar with your neck craned. Pull until your collarbone is near the bar and keep your chin tucked.

You go straight to a thin band because the thick one feels like cheating. Assistance you can control beats a rep you have to thrash through. Drop a band size only when the reps look identical to a real pull-up.

If your gym has an assisted pull-up machine, it works the same way with a counterweight, and the number tells you exactly how much help you're getting.$md$
from exercises e
where e.id = b.exercise_id
  and e.slug = 'band-assisted-pull-up'
  and e.owner_id is null;

-- Check: one row each, the new name, and fresh updated_at stamps.
select e.slug, e.name, e.alias_text, b.updated_at
from exercises e
join beginner_notes b on b.exercise_id = e.id
where e.slug in ('hyperextensions-back-extensions', 'band-assisted-pull-up');

commit;
