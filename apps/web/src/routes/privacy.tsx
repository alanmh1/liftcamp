import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | LiftCamp" },
      {
        name: "description",
        content:
          "What LiftCamp collects on the web and in the iOS app, who processes it, and how to delete it.",
      },
      { property: "og:title", content: "Privacy Policy | LiftCamp" },
    ],
    links: [{ rel: "canonical", href: "https://liftcamp.app/privacy" }],
  }),
  component: PrivacyPage,
});

const UPDATED = "25 September 2026";
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
            LiftCamp is a strength training tracker, on the web at liftcamp.app and as an iOS app.
            This page explains what we collect, why, who else handles it, and how to delete it. It
            is written to be read.
          </p>
          <p>
            LiftCamp is run by Alan Harris in Oakland, California, USA, who is responsible for your
            data. You can reach us at <ContactLink />.
          </p>

          <Section title="The short version">
            <ul className="list-disc space-y-1 pl-5">
              <li>Your training data is private to your account.</li>
              <li>We do not sell your data, and we do not run ads.</li>
              <li>We use no third-party analytics, advertising or tracking tools.</li>
              <li>You can ask us to delete your account and everything in it at any time.</li>
            </ul>
          </Section>

          <Section title="What we collect">
            <p className="font-medium">Your account</p>
            <p>How you sign in decides what we receive.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Guest. The iOS app can create an account with no email or name. It is tied to the
                app on your phone, so if you delete the app before saving your workouts to an
                account, you lose access to them.
              </li>
              <li>
                Google. Your email address, name and profile photo. We never see your Google
                password.
              </li>
              <li>
                Apple. Your email address, or a private relay address if you choose to hide it, and
                your name the first time you sign in. Apple does not share a photo.
              </li>
              <li>
                Email code. Your email address. We send a 6-digit code instead of using a password.
              </li>
              <li>
                Email and password (website only). Your email address and a securely hashed
                password.
              </li>
            </ul>
            <p>We also create a username for your account. You can change it in Settings.</p>

            <p className="mt-4 font-medium">Your training</p>
            <p>
              The workouts, exercises, sets, weights, reps, routines, notes and goals you enter.
              This is the app. Without it there is nothing to show you.
            </p>

            <p className="mt-4 font-medium">Your profile settings</p>
            <p>
              Your weight unit, weekly training target, training level, the equipment you have
              access to, and your bar and plate setup.
            </p>
            <p>
              If you choose to add them, your sex, birthday and body weight. These are used to show
              strength levels and to calculate load for bodyweight exercises. They are optional, and
              the rest of the app works without them.
            </p>

            <p className="mt-4 font-medium">How the website is used</p>
            <p>
              When you use the website, we record which pages are viewed, the site you came from,
              whether you are on a phone or a computer, your browser type, any campaign tag in the
              link, and a random session ID. We do this for all visitors, signed in or not, to
              understand which pages help people. It is stored in our own database, and no third
              party receives it.
            </p>
            <p>
              When you are signed in on the website, we also record a small number of in-app
              events, such as starting a workout, logging a set or choosing a routine, plus
              technical details when something fails.
            </p>

            <p className="mt-4 font-medium">On your device</p>
            <p>
              The website stores your sign-in session, a copy of your recent data so it loads
              quickly and works offline, changes waiting to be sent when you are offline, your theme
              and a few reminder and timer preferences. If you build a routine or log sets before
              signing up, those are kept on your device and uploaded to your account when you sign
              up. The iOS app stores your sign-in session, your theme and cached images. Clearing
              your browser data or deleting the app removes these.
            </p>
          </Section>

          <Section title="What we don't collect">
            <p>
              No location, contacts, camera or photo library access, no data from Apple Health or
              HealthKit, no advertising identifiers and no payment details. LiftCamp is free and we
              do not process payments.
            </p>
          </Section>

          <Section title="Who can see your data">
            <p>
              Your account's data is protected by row-level security, so the database refuses to
              return one account's rows to another account.
            </p>
            <p>Two things are visible to others only when you choose to share them.</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Routine links. If you share a routine, anyone with the link can see the routine's
                name and its exercises. They cannot see your name, username or workouts.
              </li>
              <li>
                Share cards. After a workout, you can share an image of it. The image shows your
                username and that workout's details.
              </li>
            </ul>
            <p>LiftCamp has no social feed, leaderboards or public profiles.</p>
          </Section>

          <Section title="Companies that process data for us">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Supabase runs our database and sign-in, on servers in the United States. Your
                account and training data live there, and it serves exercise images.
              </li>
              <li>
                Vercel hosts the website. Like any web host, it records request logs, including IP
                addresses.
              </li>
              <li>
                Resend sends our sign-in and account emails. It receives your email address and the
                content of those emails.
              </li>
              <li>
                Google provides Google sign-in. If you sign in with Google, your profile photo is
                loaded from Google's servers. The website also loads its fonts from Google Fonts,
                which sends your IP address to Google.
              </li>
              <li>
                Apple provides Sign in with Apple and distributes the iOS app. If you install a test
                version through TestFlight, Apple may share crash reports and usage information with
                us under its own privacy policy.
              </li>
            </ul>
            <p>
              Each of these companies may keep system logs such as IP addresses and request times to
              run and secure their service.
            </p>
          </Section>

          <Section title="Why we use your data">
            <p>
              We use your data to run LiftCamp for you, which is the basis for most of what we
              collect. We rely on our legitimate interest in understanding and improving the product
              for usage and page-view data, and on your consent for optional details like sex,
              birthday and body weight, which you can remove at any time. Where the law requires it,
              we also process data to meet legal obligations.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              We keep your data while your account exists. When we delete your account, we delete
              your profile, workouts, sets, routines, shared routine links, usage events and page
              views tied to your account. Backups and the system logs held by the companies above
              may keep copies for a short period before they rotate out. We may keep some data
              longer if the law requires it or to resolve a legal claim.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can ask us for a copy of your data, to correct it, to delete it, or to stop
              processing it. If you are in the EU, the UK, or a US state with a privacy law such as
              California, you have these rights by law, and you can complain to your local data
              protection authority. We do not sell or share personal data for advertising.
            </p>
            <p>
              Email <ContactLink /> from the address on your account and we will respond within 30
              days. For a guest account, include your username. An in-app delete button is coming.
              Until it ships, email is the way to delete your account.
            </p>
          </Section>

          <Section title="Legal requests">
            <p>
              We may use or disclose your data if the law requires it, to respond to a valid request
              from a public authority, or to protect LiftCamp or its users in a legal claim.
            </p>
          </Section>

          <Section title="Data about other people">
            <p>
              If you add information about someone else, for example in a note or a shared routine,
              you are responsible for having their permission.
            </p>
          </Section>

          <Section title="Children">
            <p>
              LiftCamp is not for children under 13, or under 16 where local law sets a higher age.
              We do not knowingly collect their data. If you believe a child has an account, contact
              us and we will delete it.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If this policy changes in a way that affects you, we will update the date at the top.
              If the change is significant, we will tell you in the app.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions, requests or concerns go to <ContactLink />.
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
