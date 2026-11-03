import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { PageGlow } from "@/components/PageGlow";

/**
 * /mcp: how to connect LiftCamp's MCP server to ChatGPT or Claude. The
 * directory listings link here as the server's documentation and support
 * page, so the privacy and support sections are required, not decoration.
 */

const EMAIL = "hello@liftcamp.app";
const TITLE = "LiftCamp in ChatGPT and Claude";
const DESCRIPTION =
  "Connect LiftCamp to ChatGPT or Claude to get beginner routines, exercise guides, swaps and strength levels from LiftCamp's free catalog. No account needed.";

const CONNECTIONS = [
  {
    name: "Claude",
    url: "https://liftcamp.app/mcp/claude",
    how: "In Claude, open Settings, then Connectors, choose Add custom connector, and paste this URL.",
  },
  {
    name: "ChatGPT",
    url: "https://liftcamp.app/mcp/chatgpt",
    how: "In ChatGPT, turn on developer mode in Settings, then create a connector with this URL and no authentication.",
  },
];

const TOOLS = [
  {
    name: "find_routine",
    line: "Recommends three free routines for your days a week, equipment and experience, with every day's exercises, sets and reps.",
  },
  {
    name: "exercise_guide",
    line: "How to do an exercise: muscles, equipment, steps, and for authored exercises a starting weight, form cues and swaps.",
  },
  {
    name: "exercise_swaps",
    line: "Alternatives that train the same muscle, limited to the equipment you have when you say so.",
  },
  {
    name: "strength_level",
    line: "Estimates your one-rep max from a set and places it on LiftCamp's five levels, Beginner to Elite.",
  },
];

const EXAMPLES = [
  {
    prompt: "Give me a 3 day dumbbell routine for a beginner",
    result:
      "find_routine returns the three best-fitting dumbbell routines for beginners, the first marked Recommended, each with its days, exercises and set targets and a link to the routine page.",
  },
  {
    prompt: "How do I do a Romanian deadlift and what can I swap it for if there's no barbell",
    result:
      "exercise_guide returns the steps, the muscles it trains, a starting weight and form cues. exercise_swaps, asked for dumbbells, then lists exercises for the same muscle that need only dumbbells.",
  },
  {
    prompt: "I bench 135 for 5 at 180 lb bodyweight, male, what's my strength level",
    result:
      "strength_level estimates a 157.5 lb max, names the level, gives the weight where the next level starts, and shows all five levels as a table.",
  },
];

export const Route = createFileRoute("/mcp")({
  head: () => ({
    meta: [
      { title: `${TITLE} | LiftCamp` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://liftcamp.app/mcp" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.app/mcp" }],
  }),
  component: McpPage,
});

function McpPage() {
  return (
    <div
      className="min-h-dvh bg-background text-foreground"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <article className="relative overflow-hidden">
        <PageGlow />
        <div className="relative mx-auto max-w-[68ch] px-ds-lg pb-ds-3xl pt-ds-xl md:pt-ds-2xl">
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
            {TITLE}
          </h1>

          <Body>
            LiftCamp has an MCP server, which lets ChatGPT and Claude answer training questions from
            LiftCamp's free catalog: the routines, the exercise library with its beginner notes, and
            the strength levels the app uses. It needs no account. Every answer links to the page it
            came from and to the app, so you can start the routine and log it.
          </Body>

          <H2>Connect it</H2>
          <div className="mt-ds-md space-y-ds-md">
            {CONNECTIONS.map((c) => (
              <div
                key={c.name}
                className="rounded-lg border border-border bg-muted/40 px-ds-lg py-ds-md"
              >
                <p className="font-label text-sm text-muted-foreground">{c.name}</p>
                <code className="mt-1 block break-all font-mono text-base text-foreground">
                  {c.url}
                </code>
                <p className="mt-ds-sm font-body text-base leading-7 text-foreground">{c.how}</p>
              </div>
            ))}
          </div>

          <H2>Tools</H2>
          <ul className="mt-ds-md space-y-ds-sm">
            {TOOLS.map((t) => (
              <li key={t.name} className="font-body text-lg leading-8 text-foreground">
                <code className="font-mono text-base text-primary">{t.name}</code>. {t.line}
              </li>
            ))}
          </ul>
          <Body>
            Every tool is read-only. Answers are general fitness information and do not give medical
            or injury advice.
          </Body>

          <H2>Things to ask</H2>
          <div className="mt-ds-md space-y-ds-lg">
            {EXAMPLES.map((e) => (
              <div key={e.prompt}>
                <p className="font-body text-lg font-semibold leading-8 text-foreground">
                  "{e.prompt}"
                </p>
                <p className="mt-1 font-body text-base leading-7 text-muted-foreground">{e.result}</p>
              </div>
            ))}
          </div>

          <H2>Privacy</H2>
          <Body>
            The server reads LiftCamp's public catalog and nothing else. It has no sign-in, cannot see
            anyone's LiftCamp workouts, and stores nothing you send it. Your IP address is held in
            memory for about a minute to limit request rates, and our host keeps its standard request
            logs. The assistant you use has its own privacy terms. The full policy is on the{" "}
            <Link to="/privacy" className="font-label text-primary underline underline-offset-4">
              privacy page
            </Link>
            .
          </Body>

          <H2>Support</H2>
          <Body>
            Questions, or an answer that looks wrong:{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="font-label text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            >
              {EMAIL}
            </a>
            .
          </Body>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-ds-2xl font-heading text-heading font-bold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-ds-md font-body text-lg leading-8 text-foreground">{children}</p>;
}
