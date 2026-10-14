import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeftRight, ArrowRight, Weight } from "lucide-react";
import { formatEquipmentLabel } from "@liftcamp/shared";
import { exerciseFaq } from "@/lib/exercise-meta";
import type { BeginnerNotes } from "@/lib/public-catalog.functions";

/**
 * The "New to this" block. Renders only when a beginner_notes row exists; the
 * other pages show nothing here, and that absence has to look deliberate, so
 * there is no empty state and no "coming soon".
 *
 * The first two column titles are the exerciseFaq() questions, the same
 * strings the route emits as FAQPage JSON-LD, so the markup matches what a
 * reader sees. The third is stored per exercise, never derived from the
 * equipment column: a pull-up would get the wrong one.
 */
export function NewToThisCard({ notes, name }: { notes: BeginnerNotes; name: string }) {
  const faq = exerciseFaq(name, notes);
  return (
    <section aria-labelledby="beginner-block" className="mx-auto max-w-7xl px-ds-lg pb-ds-2xl">
      <div className="relative overflow-hidden rounded-xl border border-border shadow-xl shadow-primary/5">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-pr/40 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-ds-md border-b border-border px-ds-lg py-ds-lg md:px-ds-xl">
          <div>
            <p className="font-label text-label uppercase tracking-widest text-primary">
              New to this
            </p>
            <h2
              id="beginner-block"
              className="mt-ds-sm font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
            >
              {notes.block_heading ?? `Your first ${name.toLowerCase()}`}
            </h2>
          </div>
          <p className="max-w-sm font-body text-body text-muted-foreground">
            Three things to know before your first set of the {name.toLowerCase()}.
          </p>
        </div>

        <div className="relative grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div className="px-ds-lg py-ds-lg md:px-ds-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Weight className="h-5 w-5" />
            </span>
            <Part title={faq[0]!.q} body={notes.starting_weight_md} />
          </div>

          <div className="px-ds-lg py-ds-lg md:px-ds-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-warning/20 text-foreground">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <Part title={faq[1]!.q} body={notes.form_breakdown_md} />
          </div>

          <div className="bg-muted/50 px-ds-lg py-ds-lg md:px-ds-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ArrowLeftRight className="h-5 w-5" />
            </span>
            <Part title={notes.substitution_heading} body={notes.substitution_md} />
            {notes.substitutes.length > 0 && (
              <ul className="mt-ds-md space-y-ds-xs p-0">
                {notes.substitutes.map((sub) => (
                  <li key={sub.slug}>
                    <Link
                      to="/exercises/$slug"
                      params={{ slug: sub.slug }}
                      className="group flex items-center justify-between gap-ds-sm rounded-md border border-border bg-background px-ds-md py-ds-sm font-label text-label text-foreground hover:border-primary hover:text-primary"
                    >
                      <span>
                        {sub.name}
                        {sub.equipment && (
                          <span className="ml-ds-sm font-caption text-caption text-muted-foreground">
                            {formatEquipmentLabel(sub.equipment)}
                          </span>
                        )}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Authored prose, split into paragraphs on blank lines. No markdown
 *  renderer: the copy is prose. */
function Part({ title, body }: { title: string; body: string }) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      <h3 className="mt-ds-md font-heading text-xl font-bold text-foreground">{title}</h3>
      {paragraphs.map((p, i) => (
        <p key={i} className="mt-ds-sm font-body text-body text-muted-foreground">
          {p}
        </p>
      ))}
    </>
  );
}
