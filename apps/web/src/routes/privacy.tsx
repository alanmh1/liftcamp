import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | LiftCamp" },
      { name: "description", content: "What data LiftCamp collects, why, and how to delete it." },
      { property: "og:title", content: "Privacy Policy | LiftCamp" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.app/privacy" }],
  }),
  component: PrivacyPage,
});

const UPDATED = "12 August 2026";
const CONTACT = "hello@liftcamp.app";

function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-[680px] px-5 py-10">
        <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← LiftCamp
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Last updated {UPDATED}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <p>
            LiftCamp is a workout tracker. This page explains exactly what it stores, who else
            can see it, and how to get rid of it. It is written to be read, not to be skipped.
          </p>

          <Section title="The short version">
            <ul className="list-disc space-y-1 pl-5">
              <li>Your training data is yours. Nobody else can read it.</li>
              <li>We do not sell your data, and we do not run ads.</li>
              <li>There are no third-party advertising or tracking scripts on this site.</li>
              <li>You can delete your account and everything in it at any time.</li>
            </ul>
          </Section>

          <Section title="What we store">
            <p className="font-medium">Account details</p>
            <p>
              Your email address, and a securely hashed password if you sign up with one. If you
              sign in with Google, we receive your email address and basic profile information
              from Google, never your Google password.
            </p>

            <p className="mt-4 font-medium">Training data</p>
            <p>
              The workouts, exercises, sets, reps, weights, routines and notes you enter. This is
              the app; without it there is nothing to show you.
            </p>

            <p className="mt-4 font-medium">Profile settings</p>
            <p>
              Your preferred weight unit, your weekly training target, and, only if you choose to
              enter it, your body weight. Body weight is used to calculate load for bodyweight and
              assisted exercises. You can leave it blank and the rest of the app works.
            </p>

            <p className="mt-4 font-medium">Usage events</p>
            <p>
              A small number of first-party events recorded in our own database, for example that a workout was
              started, a set logged, a workout finished. We use these to understand whether the app
              is actually helping people train, and nothing else. They are stored against your
              account and are covered by the same access rules as your training data.
            </p>

            <p className="mt-4 font-medium">On your device</p>
            <p>
              Your rest-timer preferences and any running rest timer are stored locally in your
              browser so they survive closing the app. They are never sent to us. Clearing your
              browser data removes them.
            </p>
          </Section>

          <Section title="What we don't store">
            <p>
              No advertising identifiers, no location data, no contacts, no photos, no health data
              from Apple Health or Google Fit, and no payment details. LiftCamp is free while in
              beta and we do not process payments.
            </p>
          </Section>

          <Section title="Who can see your data">
            <p>
              Only you. Every table is protected by row-level security, meaning the database itself
              refuses to return one account's rows to another account. This is enforced at the data
              layer, not just in the app.
            </p>
            <p className="mt-3">
              LiftCamp has no social feed, no leaderboards, and no public profiles. Nothing you log
              is visible to other users.
            </p>
          </Section>

          <Section title="Companies that process data for us">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium">Supabase</span> hosts our database and handles sign-in.
                Your account and training data live here.
              </li>
              <li>
                <span className="font-medium">Lovable</span> hosts the application, handles the
                Google sign-in flow, and receives automatic error reports when something crashes.
                Error reports can include the page you were on and technical details of the failure.
              </li>
              <li>
                <span className="font-medium">Google Fonts</span> serves the typefaces used on this
                site. Loading a font sends your IP address to Google. We are working to self-host
                these to remove that.
              </li>
            </ul>
            <p className="mt-3">
              We do not use Google Analytics, advertising pixels, or any third-party behavioural
              tracking.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              LiftCamp uses a single category of storage: the token that keeps you signed in. It is
              strictly necessary for the app to function, so there is no consent banner to dismiss.
              We set no advertising or analytics cookies.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              For as long as your account exists. When you delete your account, your profile,
              workouts, sets, routines and usage events are deleted with it. Backups may retain
              copies for a short period before they rotate out.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can export your training data, correct anything that is wrong, and delete your
              account at any time. If you are in the UK, EU, or a US state with a privacy statute,
              you also have the right to request a copy of your data and to object to certain
              processing. Email us and we will action it.
            </p>
            <p className="mt-3">
              To delete your account, email <ContactLink /> from the address on the account. We are
              building an in-app delete button; until it ships, email is the route.
            </p>
          </Section>

          <Section title="Children">
            <p>
              LiftCamp is not intended for children under 13, and we do not knowingly collect their
              data. If you believe a child has created an account, contact us and we will remove it.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If this policy changes in a way that materially affects you, we will update the date
              at the top and, where the change is significant, tell you in the app.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions, requests, or concerns: <ContactLink />
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

function ContactLink() {
  return (
    <a href={`mailto:${CONTACT}`} className="text-primary underline-offset-4 hover:underline">
      {CONTACT}
    </a>
  );
}
