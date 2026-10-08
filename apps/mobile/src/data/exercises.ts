import { supabase } from '../../lib/supabase';

/** Reads for the exercise library and screen that are about the catalogue rather than the user. */

export type BeginnerNotes = {
  starting_weight_md: string;
  form_breakdown_md: string;
  substitution_heading: string;
  substitution_md: string;
  substitute_exercise_ids: string[];
};

/** The beginner note for an exercise, or null for the 826 that have none. */
export async function getBeginnerNotes(exerciseId: string): Promise<BeginnerNotes | null> {
  const { data } = await supabase
    .from('beginner_notes')
    .select('starting_weight_md, form_breakdown_md, substitution_heading, substitution_md, substitute_exercise_ids')
    .eq('exercise_id', exerciseId)
    .maybeSingle();
  return (data as BeginnerNotes | null) ?? null;
}
