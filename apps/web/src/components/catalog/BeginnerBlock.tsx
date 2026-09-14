import { Link } from "@tanstack/react-router";
import { formatEquipmentLabel } from "@liftcamp/shared";
import { exerciseFaq } from "@/lib/exercise-meta";
import type { BeginnerNotes } from "@/lib/public-catalog.functions";

// The "New to this" block from frames 3f/3g. Renders only when a row exists —
// 843 of 883 pages show nothing here, and per 2b that absence has to look
// deliberate rather than like a section that failed to load. So there is no
// empty state, no placeholder, and no "coming soon".
//
// Copy is authored at 140–250 words across the three parts. Paragraphs split
// on blank lines; no markdown renderer, because the authored copy is prose.
export function BeginnerBlock({ notes, exerciseName }: { notes: BeginnerNotes; exerciseName: string }) {
  const faq = exerciseFaq(exerciseName, notes);
  return (
    <section
      aria-labelledby="beginner-block"
      className="mt-10 rounded-xl border border-border bg-secondary/40 p-5 sm:p-6"
    >
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        New to this
      </p>
      <h2 id="beginner-block" className="mt-1 text-xl font-bold tracking-tight">
        {notes.block_heading ?? `Your first ${exerciseName.toLowerCase()}`}
      </h2>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <Part title={faq[0]!.q} body={notes.starting_weight_md} />
        <Part title={faq[1]!.q} body={notes.form_breakdown_md} />
        <div className="sm:col-span-2">
          {/* Heading is stored per exercise, never derived from the equipment
              column — a pull-up would get the wrong one. */}
          <Part title={notes.substitution_heading} body={notes.substitution_md} />
          {notes.substitutes.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2 p-0">
              {notes.substitutes.map((sub) => (
                <li key={sub.slug}>
                  <Link
                    to="/exercises/$slug"
                    params={{ slug: sub.slug }}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-[13px] font-semibold transition-colors hover:border-primary"
                  >
                    {sub.name}
                    {sub.equipment && (
                      <span className="font-normal text-muted-foreground">
                        {formatEquipmentLabel(sub.equipment)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Part({ title, body }: { title: string; body: string }) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {paragraphs.map((p, i) => (
        <p key={i} className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {p}
        </p>
      ))}
    </div>
  );
}
