CREATE TABLE public.beginner_notes (
  exercise_id uuid PRIMARY KEY REFERENCES public.exercises(id) ON DELETE CASCADE,
  block_heading text,
  starting_weight_md text NOT NULL,
  form_breakdown_md text NOT NULL,
  substitution_heading text NOT NULL,
  substitution_md text NOT NULL,
  substitute_exercise_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT beginner_notes_subs_max_three CHECK (array_length(substitute_exercise_ids, 1) IS NULL OR array_length(substitute_exercise_ids, 1) <= 3),
  CONSTRAINT beginner_notes_subs_no_self CHECK (NOT (exercise_id = ANY (substitute_exercise_ids))),
  CONSTRAINT beginner_notes_heading_nonempty CHECK (length(btrim(substitution_heading)) > 0)
);

COMMENT ON TABLE public.beginner_notes IS 'Hand-authored beginner block for an exercise detail page. Absence is the common case: ~40 rows at launch, the rest render nothing.';
COMMENT ON COLUMN public.beginner_notes.substitution_heading IS 'Authored per exercise, never derived from the equipment column. Three variants: "If the <object> is taken", "If you can''t do one yet", "If you only have dumbbells".';
COMMENT ON COLUMN public.beginner_notes.substitute_exercise_ids IS 'Authored and ordered, best swap first. Never backfilled by a similarity query.';

-- Public catalog content: readable by anyone, writable only out of band.
GRANT SELECT ON public.beginner_notes TO anon;
GRANT SELECT ON public.beginner_notes TO authenticated;
GRANT ALL ON public.beginner_notes TO service_role;

ALTER TABLE public.beginner_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beginner notes readable by anyone"
  ON public.beginner_notes FOR SELECT TO anon USING (true);

CREATE POLICY "Beginner notes readable by authenticated users"
  ON public.beginner_notes FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.beginner_notes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.beginner_notes_touch_updated_at() FROM PUBLIC;

CREATE TRIGGER beginner_notes_set_updated_at
  BEFORE UPDATE ON public.beginner_notes
  FOR EACH ROW EXECUTE FUNCTION public.beginner_notes_touch_updated_at();