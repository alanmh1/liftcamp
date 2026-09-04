-- Licensed ExerciseDB animated demonstrations.
--
-- Stored in their own columns rather than overwriting image_url/image_url_2,
-- for three reasons:
--
--   1. ExerciseDB covers 458 of our 898 exercises. Their library has no ab
--      wheel rollout, no band pull-apart, no atlas stones, and the only hip
--      thrust in the whole set is a resistance-band one. The other 440 rows
--      keep the two-frame cross-fade in ExerciseAnimation.tsx, so both media
--      paths stay live indefinitely rather than one replacing the other.
--   2. og:image, twitter:image and the HowTo JSON-LD on every exercise page
--      read image_url directly. Social crawlers handle animated GIFs badly, so
--      those meta tags need to keep resolving to a static frame.
--   3. /exercises list rows stay on the 850x567 jpgs on purpose. Fifty 180px
--      GIFs is ~4.8MB and fifty concurrent animations per page view.
--
-- Licence note: ExerciseDB's terms permit display only in conjunction with the
-- exercise data, not as standalone content. Fine on exercise pages and in the
-- logger; not for decorative use on marketing pages.

alter table public.exercises
  add column if not exists gif_url text,
  add column if not exists gif_url_sm text;

comment on column public.exercises.gif_url is
  'ExerciseDB 360px animated GIF. Licensed: display only alongside exercise data.';
comment on column public.exercises.gif_url_sm is
  'ExerciseDB 180px animated GIF. Reserved for hover/preview use.';

-- Public bucket: the exercise pages are server-rendered and crawled, so signed
-- URLs would cost an edge function per image and hide them from search.
-- Mirrors how exercise-images is configured.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-gifs', 'exercise-gifs', true, 5242880, array['image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
