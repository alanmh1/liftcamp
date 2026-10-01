import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use | LiftCamp" },
      { name: "description", content: "The terms you agree to when using LiftCamp." },
      { property: "og:title", content: "Terms of Use | LiftCamp" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.app/terms" }],
  }),
  component: TermsPage,
});

const UPDATED = "October 9, 2026";
const CONTACT = "hello@liftcamp.app";

function TermsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-[680px] px-5 py-10">
        <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← LiftCamp
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">Terms of Use</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Last updated {UPDATED}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <p>By using LiftCamp you agree to these terms. They are deliberately short.</p>

          <Section title="What LiftCamp is">
            <p>
              A tool for recording your own strength training. It is currently in beta: free to use,
              with an optional paid upgrade (LiftCamp Pro, below), actively changing, and
              occasionally broken. Features may change or be removed.
            </p>
          </Section>

          <Section title="Training is your responsibility">
            <p>
              LiftCamp is not a coach, a trainer, or a medical service. The exercise descriptions,
              starter routines and generated workouts are general information, not personalized
              advice, and nobody has assessed your health, injuries, or technique.
            </p>
            <p className="mt-3">
              Lifting weights carries a risk of injury. Talk to a doctor before starting a training
              program, especially if you have an existing condition or are returning from injury.
              Train within your ability, use a weight you control, and stop if something hurts. You
              are responsible for your own safety and for anyone you train with.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              Keep your login details to yourself. Anything done through your account is treated as
              done by you. Tell us promptly if you think someone else has access. One account per
              person, and you must be at least 13 to create one.
            </p>
          </Section>

          <Section title="LiftCamp Pro">
            <p>
              LiftCamp is free. LiftCamp Pro is an optional upgrade that suggests the weight and
              reps to try next for every lift. Logging, your full workout history and the exercise
              library stay free.
            </p>
            <p className="mt-3">
              <span className="font-medium text-foreground">Plans.</span> Pro Monthly is $1.99 a
              month. Pro Yearly is $9.99 a year. Pro Lifetime is $29.99, paid once. These are US
              prices; the app shows the price in your currency before you buy.
            </p>
            <p className="mt-3">
              <span className="font-medium text-foreground">Free trial.</span> Pro Yearly starts
              with a 7-day free trial if your Apple ID has not had one. Unless you cancel at least
              24 hours before the trial ends, the yearly price is charged when it ends.
            </p>
            <p className="mt-3">
              <span className="font-medium text-foreground">Billing and renewal.</span> Purchases
              are made with your Apple ID and billed by Apple. Monthly and yearly plans renew
              automatically at the current price unless you cancel at least 24 hours before the end
              of the period. Apple charges the renewal within the 24 hours before the period ends.
            </p>
            <p className="mt-3">
              <span className="font-medium text-foreground">Cancelling.</span> On iPhone, go to
              Settings, tap your name, then Subscriptions; or in LiftCamp, Settings, then Manage
              subscription. Pro stays on until the end of the period you paid for. Deleting your
              LiftCamp account does not cancel a subscription.
            </p>
            <p className="mt-3">
              <span className="font-medium text-foreground">Refunds.</span> Apple handles refunds
              for App Store purchases. Request one at{" "}
              <a
                href="https://reportaproblem.apple.com"
                className="text-primary underline-offset-4 hover:underline"
              >
                reportaproblem.apple.com
              </a>
              .
            </p>
            <p className="mt-3">
              <span className="font-medium text-foreground">Restoring.</span> Pro belongs to the
              Apple ID that bought it. After reinstalling, or on a new iPhone with the same Apple
              ID, use Restore purchases in Settings.
            </p>
            <p className="mt-3">
              <span className="font-medium text-foreground">Lifetime.</span> One payment, no
              renewals. Pro stays on for as long as LiftCamp is available.
            </p>
            <p className="mt-3">
              If you downloaded LiftCamp from the App Store, Apple&apos;s standard{" "}
              <a
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                className="text-primary underline-offset-4 hover:underline"
              >
                Licensed Application End User License Agreement
              </a>{" "}
              also applies.
            </p>
          </Section>

          <Section title="Your data belongs to you">
            <p>
              The workouts, notes and routines you enter are yours. You grant us only the permission
              needed to store them, sync them across your devices, and show them back to you. We do
              not claim ownership, and we do not sell them.
            </p>
            <p className="mt-3">
              What we do with your data is set out in our{" "}
              <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="Fair use">
            <p>
              Don't attempt to break into other accounts, scrape the exercise catalog wholesale,
              overload the service, or use LiftCamp to do anything illegal. We can suspend accounts
              that do.
            </p>
            <p className="mt-3">
              No harassment, hate or sexual content in anything other people can see, such as your
              username or workout names. We remove content that breaks this rule, and the account
              can lose access to social features.
            </p>
          </Section>

          <Section title="The exercise catalog">
            <p>
              The exercise database is derived from the public-domain{" "}
              <span className="font-medium">free-exercise-db</span> dataset, with our own additions
              and corrections. The app itself, its design and its code are ours.
            </p>
          </Section>

          <Section title="No guarantees">
            <p>
              LiftCamp is provided as-is. We don't promise it will be available, that it will be
              free of bugs, or that your data will never be lost. Export anything you would be upset
              to lose. To the extent the law allows, we are not liable for loss arising from your
              use of the app, including lost training data or injury sustained while training.
            </p>
            <p className="mt-3">Nothing here limits liability that cannot legally be limited.</p>
          </Section>

          <Section title="Ending it">
            <p>
              You can stop using LiftCamp whenever you like and ask us to delete your account. We
              may suspend or close accounts that breach these terms, or discontinue the service. If
              we shut it down, we will give you reasonable notice and a way to export your data.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update these terms. The date at the top will change, and continued use after an
              update means you accept the new version.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              <a
                href={`mailto:${CONTACT}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {CONTACT}
              </a>
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}
