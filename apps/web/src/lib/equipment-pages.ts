// Equipment landing pages: /exercises/dumbbell, /exercises/barbell, …
//
// The region pages cover "by muscle"; these cover "by equipment", which is the
// other half of the high-volume queries ("dumbbell exercises", "cable
// exercises"). Slugs resolve in the /exercises/[slug] route BEFORE the
// database lookup, the same way region slugs do. The slugs were checked
// against the exercises table when added — no row claims any of them.
//
// `value` is the canonical equipment vocabulary (see the
// canonical_equipment_vocab migration): note 'body only' and the plural
// 'kettlebells'. Never match on the raw column anywhere else.

export type EquipmentPage = {
  /** URL slug, e.g. "smith-machine". */
  slug: string;
  /** Canonical equipment value in the exercises table, e.g. "smith machine". */
  value: string;
  /** Display label, e.g. "Smith Machine". */
  label: string;
  h1: string;
  /** ~100 words above the list, so the page is not a thin duplicate of
   *  /exercises. Written for a beginner standing in front of the thing. */
  intro: string;
};

export const EQUIPMENT_PAGES: Readonly<Record<string, EquipmentPage>> = {
  dumbbell: {
    slug: "dumbbell",
    value: "dumbbell",
    label: "Dumbbell",
    h1: "Dumbbell Exercises",
    intro:
      "Dumbbells are the most forgiving equipment in the gym: each arm works on its own, the path is free, and you can set them down whenever you need to. That makes them the usual answer when a barbell lift bothers a shoulder or when the rack is taken. The list below covers every dumbbell exercise in the library, presses, rows, curls, raises, lunges and carries, with the muscles each one trains, a difficulty label and step-by-step instructions. If you are picking a starting weight, the guide on that is linked from the guides page; the short version is to start embarrassingly light and add weight next session.",
  },
  barbell: {
    slug: "barbell",
    value: "barbell",
    label: "Barbell",
    h1: "Barbell Exercises",
    intro:
      "The barbell is where the big, trackable numbers live: squat, bench press, deadlift, overhead press and row. One bar takes plates in small steps, so progress is easy to measure and easy to log, which is why most strength routines are built around these lifts. An Olympic bar weighs 20 kg (45 lb) before you add anything; the Smith machine is different and has its own page. Every barbell exercise in the library is listed below with muscles worked, difficulty and step-by-step instructions. New to these? Learn the movement with the empty bar first, then add weight in small jumps.",
  },
  machine: {
    slug: "machine",
    value: "machine",
    label: "Machine",
    h1: "Machine Exercises",
    intro:
      "Machines guide the weight along a fixed path, so there is less to balance and less technique to learn before you can work hard. That makes them a practical place to spend your first month, and a useful fallback whenever the free-weight area is busy. The trade-off is that the fixed path has to fit your body, so take a minute on the seat and pad adjustments. The instructions on each page say which ones matter. Below is every machine exercise in the library: leg press, chest press, rows, curls and the rest, each with muscles worked, difficulty and step-by-step setup.",
  },
  cable: {
    slug: "cable",
    value: "cable",
    label: "Cable",
    h1: "Cable Exercises",
    intro:
      "A cable stack keeps tension on the muscle through the whole rep, including parts of the movement where a dumbbell would go slack. The height adjusts in seconds and the attachments swap, so one station covers press-downs, flyes, rows, curls, lateral raises, crunches and woodchoppers. Cables are also the quiet workaround when the machine you wanted is taken. Most machine movements have a cable cousin, and the substitution notes on the exercise pages point them out. Every cable exercise in the library is listed below, with muscles worked, difficulty and step-by-step instructions for each.",
  },
  bodyweight: {
    slug: "bodyweight",
    value: "body only",
    label: "Bodyweight",
    h1: "Bodyweight Exercises",
    intro:
      "Bodyweight exercises need no equipment at all, which makes them the whole gym when you are at home, travelling, or not ready for the weights room. Push-ups, squats, lunges, planks and their harder variations cover every major muscle group; progress comes from changing leverage and adding reps rather than adding plates. The list below is every bodyweight exercise in the library, tagged 'body only' in the data, each with the muscles it trains, a difficulty label and step-by-step instructions. If a movement is too hard as written, the instructions include the easier version to start from.",
  },
  kettlebell: {
    slug: "kettlebell",
    value: "kettlebells",
    label: "Kettlebell",
    h1: "Kettlebell Exercises",
    intro:
      "A kettlebell is a ball of weight with a handle, and the offset load is the point: swings, cleans, snatches and Turkish get-ups train the hips and grip in a way dumbbells do not quite replicate. For most beginners the useful shortlist is goblet squats, swings, rows and carries. The rest of this list is there when those are familiar. Every kettlebell exercise in the library is below, with muscles worked, difficulty and step-by-step instructions. Start lighter than your dumbbell weight for the same movement; the swing in particular is a technique lift, not a strength test.",
  },
  bands: {
    slug: "bands",
    value: "bands",
    label: "Resistance Band",
    h1: "Resistance Band Exercises",
    intro:
      "Resistance bands weigh nothing, pack into a bag, and get harder the further they stretch, which makes them the usual choice for warm-ups, shoulder prehab, assisted pull-ups and training in a hotel room. The tension curve is the opposite of a machine: lightest at the bottom, heaviest at the top, so control the return rather than letting the band snap back. Below is every band exercise in the library, pull-aparts, presses, rows, squats and rotations, with muscles worked, difficulty and step-by-step instructions. Anchor the band to something that cannot move, and check it for nicks before loading it.",
  },
  "smith-machine": {
    slug: "smith-machine",
    value: "smith machine",
    label: "Smith Machine",
    h1: "Smith Machine Exercises",
    intro:
      "The Smith machine is a barbell fixed to vertical rails, with hooks that re-rack the weight at any height by twisting your wrists. The fixed path means no balancing, which makes it a reasonable place to learn the shapes of the squat, bench and row, and a real option when you train without a spotter. One thing to know before you log anything: the bar does not weigh 45 lb, and the number varies by machine. The guide on Smith machine bar weight explains how to check yours. Every Smith machine exercise in the library is listed below with muscles worked, difficulty and step-by-step instructions.",
  },
};

export const EQUIPMENT_PAGE_SLUGS = Object.keys(EQUIPMENT_PAGES);

export function isEquipmentPageSlug(v: string | null | undefined): v is string {
  return !!v && v in EQUIPMENT_PAGES;
}

/** Title and description take the live count so the strings never go stale
 *  the way the hardcoded 883/886 did. */
export function equipmentTitle(page: EquipmentPage, count: number): string {
  return `${page.label} Exercises: ${count} Moves With Instructions | LiftCamp`;
}

export function equipmentDescription(page: EquipmentPage, count: number): string {
  return `Every ${page.label.toLowerCase()} exercise in the LiftCamp library, ${count} in total, with muscles worked, difficulty and step-by-step instructions.`;
}
