import { Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { AppStoreBadge } from "@/components/AppStoreBadge";

/**
 * App Store screenshots (iPhone 17 Pro Max, 1320x2868), resized to WebP at
 * 360, 540 and 720 wide in public/screenshots. Regenerate those from
 * ~/Desktop/LiftCamp App Store screenshots/ when the listing's change.
 */
const SHOT_W = 1320;
const SHOT_H = 2868;

function shotSrc(name: string) {
  return {
    src: `/screenshots/${name}-540.webp`,
    srcSet: [360, 540, 720].map((w) => `/screenshots/${name}-${w}.webp ${w}w`).join(", "),
  };
}

/** Captions quote the App Store description. Keep them identical to docs/app-store-listing.md. */
const LANDING_SHOTS: readonly { name: string; title: string; body: string; alt: string }[] = [
  {
    name: "01-home",
    title: "Build the habit",
    body: "Set a weekly target of 2 to 6 training days. Hit it and your week streak grows.",
    alt: "LiftCamp Home screen with the week's workouts, the next routine day and saved routines",
  },
  {
    name: "02-active-workout",
    title: "Logging that stays out of your way",
    body: "Tap to check off a set. Last session's numbers show in every row, so you always know what to beat.",
    alt: "LiftCamp workout screen logging bench press sets, with last session's numbers and a rest timer",
  },
  {
    name: "03-summary-trex",
    title: "Share your workout",
    body: "Finish a workout to see your summary, and share it with friends.",
    alt: "LiftCamp workout summary card comparing the weight lifted to a T. rex",
  },
  {
    name: "04-exercise-info",
    title: "Learn every move",
    body: "Over 850 exercises, each with step-by-step instructions and a body diagram showing the muscles it works.",
    alt: "LiftCamp exercise sheet for the barbell bench press with a demo image and a muscle diagram",
  },
  {
    name: "05-profile-prs",
    title: "See yourself get stronger",
    body: "Personal records are marked the moment you set them. Add your bodyweight to see your strength level on the squat, bench press, deadlift and overhead press.",
    alt: "LiftCamp profile with a weekly workouts chart, recent PRs and strength levels",
  },
];

type FeatureBlock = { p: string } | { ul: readonly string[] };

/** The App Store description, section by section, word for word. Source: docs/app-store-listing.md. */
const LANDING_FEATURES: readonly { title: string; blocks: readonly FeatureBlock[] }[] = [
  {
    title: "A plan that fits you",
    blocks: [
      {
        p: "New to lifting? Answer a few questions about how many days you can train, your experience and your equipment, and LiftCamp picks a starter program that fits: full body, upper/lower, dumbbell only, machines only, or bodyweight only.",
      },
      {
        p: "Already training? Browse intermediate and advanced splits like PHUL, Push/Pull/Legs and the Bro Split. Every day of every program lists the exercises, sets and rep targets, so you never walk in wondering what to do.",
      },
    ],
  },
  {
    title: "Logging that stays out of your way",
    blocks: [
      {
        ul: [
          "Tap to check off a set. Last session's numbers show in every row, so you always know what to beat.",
          "A rest timer runs between sets, with presets you can save per exercise.",
          "Start an empty workout with one tap, or pick up your next routine day from Home.",
          "Pounds or kilograms, your choice.",
        ],
      },
    ],
  },
  {
    title: "Learn every move",
    blocks: [
      {
        p: "Over 850 exercises, each with step-by-step instructions and a body diagram showing the muscles it works. Hundreds include a short demo animation, so you can check your form before your first set.",
      },
    ],
  },
  {
    title: "See yourself get stronger",
    blocks: [
      {
        ul: [
          "Personal records are marked the moment you set them.",
          "Every exercise has its own history and charts: estimated max, heaviest weight, most reps and volume over time.",
          "Add your bodyweight to see your strength level on the squat, bench press, deadlift and overhead press.",
          "History keeps every workout you've ever logged.",
        ],
      },
    ],
  },
  {
    title: "Build the habit",
    blocks: [
      {
        p: "Set a weekly target of 2 to 6 training days. Hit it and your week streak grows. After four weeks in a row you bank a rest week, so one missed week doesn't erase your streak. Finish a workout to see your summary, and share it with friends.",
      },
    ],
  },
  {
    title: "Works in the basement gym",
    blocks: [
      {
        p: "No signal? Start, log and finish workouts completely offline. Everything saves on your phone and syncs when you're back online.",
      },
    ],
  },
  {
    title: "Free to use",
    blocks: [
      {
        p: "Try your first workout right away, no sign-up needed. Then create a free account with Apple, Google or email to keep training, with every workout backed up to your account. You can delete your account and data any time from Settings.",
      },
    ],
  },
];

/* Chalk, from apps/mobile/src/theme/tokens.ts (light): paper #FDFCFB,
   graphite #221F1B, text2 #6B655D, text3 #9A948B, plate blue #1B5FA8,
   gold #F5D272 with goldDeep #D9B24C (PR marks only). */
const LANDING_CSS = `*{box-sizing:border-box}
.lc-landing{background:#FDFCFB;color:#221F1B;font-family:'Outfit',ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.lc-landing a{color:#1B5FA8;text-decoration:none}
.lc-landing a:hover{color:#164E8A}
.lc-landing input,.lc-landing button{font-family:inherit}
@keyframes lcfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@media (max-width:760px){.lc-navlinks{display:none !important}}
.lc-navlink:hover{color:#221F1B}
.lc-landing a.lc-btn:hover{background:#164E8A;color:#fff}
.lc-landing a.lc-web:hover{text-decoration:underline;text-underline-offset:4px}
.lc-shots{display:grid;gap:clamp(20px,2.4vw,32px);grid-template-columns:repeat(5,minmax(0,1fr))}
@media (max-width:1020px){
  .lc-shots{display:flex;grid-template-columns:none;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:16px;padding-bottom:8px;margin-inline:calc(-1 * clamp(18px,4vw,56px));padding-inline:clamp(18px,4vw,56px);scroll-padding-inline:clamp(18px,4vw,56px)}
  .lc-shots::-webkit-scrollbar{display:none}
  .lc-shots > figure{flex:0 0 min(64vw,240px);scroll-snap-align:start}
}
.lc-features{display:grid;gap:clamp(14px,2vw,20px);grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.lc-features ul{margin:10px 0 0;padding-left:1.1em}
.lc-features li{margin-top:6px}
.lc-features li::marker{color:#1B5FA8}
@media (prefers-reduced-motion:reduce){.lc-landing *{animation:none!important}}`;

/** Objection-shaped, not keyword-shaped: the things a stranger needs answered
 *  before signing up. Visible copy only, no FAQPage markup. */
const LANDING_FAQ: readonly { q: string; a: string }[] = [
  {
    q: "Is LiftCamp free?",
    a: "Yes. The tracker, the exercise library and the guides are all free, with no trial and no card required.",
  },
  {
    q: "Do I need to install an app?",
    a: "On iPhone, yes: download LiftCamp free from the App Store. On Android, use LiftCamp on the web at liftcamp.app in your browser.",
  },
  {
    q: "Does it work on iPhone?",
    a: "Yes. LiftCamp is an iPhone app on the App Store. Try your first workout right away, no sign-up needed.",
  },
  {
    q: "I'm brand new. Where do I start?",
    a: "Pick one of the starter routines, or read the beginner full-body guide. LiftCamp remembers what you lifted last time, so next week's weights pick themselves.",
  },
  {
    q: "Can I use my own routine?",
    a: "Yes. Build a template from any exercises in the library, or generate a push, pull, legs or full-body session and edit it as you go.",
  },
  {
    q: "What happens to my data?",
    a: "It's yours and it stays private: your workouts are never shown to anyone else, and LiftCamp doesn't sell data or run ads.",
  },
];

/** The app's PR mark (apps/mobile/src/components/workout/pr-ribbon.tsx): a gold rosette with two tails. */
function PrRibbon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={(size / 22) * 26} viewBox="0 0 22 26" role="img" aria-label="Personal record" style={{ display: "block", flex: "none" }}>
      <path d="M6.5 15.5 L3 25 L7.4 22.6 L9.6 25.6 L12 17.5 Z" fill="#D9B24C" />
      <path d="M15.5 15.5 L19 25 L14.6 22.6 L12.4 25.6 L10 17.5 Z" fill="#D9B24C" />
      <circle cx="11" cy="10" r="9" fill="#F5D272" stroke="#D9B24C" strokeWidth="1" />
      <text x="11" y="13.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#221F1B" fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif">PR</text>
    </svg>
  );
}

/**
 * An iPhone frame sized in em around one screenshot. Inner width x 2868/1320
 * gives the height, so the image is never stretched; the screen corner is
 * about 14% of the width, as on the 17 Pro Max, and the bezel adds its
 * thickness to the outer corner.
 */
function PhoneFrame({
  name,
  alt,
  widthEm,
  bezelEm,
  priority,
  shadow,
  background,
}: {
  name: string;
  alt: string;
  widthEm: number;
  bezelEm: number;
  priority?: boolean;
  shadow: string;
  background: string;
}) {
  const innerW = widthEm - bezelEm * 2;
  const innerH = (innerW * SHOT_H) / SHOT_W;
  const innerR = innerW * 0.141;
  const img = shotSrc(name);
  return (
    <div style={{ width: `${widthEm}em`, height: `${innerH + bezelEm * 2}em`, borderRadius: `${innerR + bezelEm}em`, background, padding: `${bezelEm}em`, boxShadow: shadow }}>
      <img
        src={img.src}
        srcSet={img.srcSet}
        sizes="(max-width: 760px) 80vw, 340px"
        alt={alt}
        width={SHOT_W}
        height={SHOT_H}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        decoding="async"
        style={{ display: "block", width: "100%", height: "100%", borderRadius: `${innerR}em`, background: "#FDFCFB" }}
      />
    </div>
  );
}

export function Landing() {

  return (
    <div
      className="lc-landing"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div style={{"minHeight": "100vh", "background": "radial-gradient(120% 80% at 82% 0%, rgba(27,95,168,.10) 0%, rgba(27,95,168,0) 60%), radial-gradient(70% 50% at 8% 12%, rgba(245,210,114,.22) 0%, rgba(245,210,114,0) 65%), #FDFCFB"}}>

        <header style={{"display": "flex", "alignItems": "center", "gap": "clamp(12px,3vw,28px)", "flexWrap": "wrap", "padding": "clamp(14px,2.5vw,20px) clamp(18px,4vw,56px)", "maxWidth": "1360px", "margin": "0 auto"}}>
          <a href="#top" style={{"display": "flex", "alignItems": "center", "gap": "11px", "marginRight": "auto"}}>
            <img src="/icons/apple-touch-icon.png" alt="" width={36} height={36} style={{"width": "36px", "height": "36px", "display": "block", "flex": "none", "borderRadius": "22.5%"}} />
            <span style={{"fontSize": "21px", "fontWeight": "700", "letterSpacing": "-.02em", "color": "#221F1B"}}>LiftCamp</span>
          </a>
          <nav className="lc-navlinks" style={{"display": "flex", "alignItems": "center", "gap": "clamp(14px,2vw,30px)", "flexWrap": "wrap", "fontSize": "15px", "fontWeight": "500", "color": "#6B655D"}}>
            <Link to="/exercises" className="lc-navlink" style={{"color": "#6B655D"}}>Exercises</Link>
            <Link to="/guides" className="lc-navlink" style={{"color": "#6B655D"}}>Guides</Link>
          </nav>
          <div style={{"display": "flex", "alignItems": "center", "gap": "14px"}}>
            <Link to="/login" style={{"fontSize": "15px", "fontWeight": "600", "color": "#1B5FA8"}}>Log in</Link>
            <Link to="/login" search={{ mode: "signup" }} style={{"fontSize": "15px", "fontWeight": "600", "color": "#fff", "background": "#1B5FA8", "padding": "10px 20px", "borderRadius": "10px"}} className="lc-btn">Sign up</Link>
          </div>
        </header>

        <section id="top" style={{"maxWidth": "1360px", "margin": "0 auto", "padding": "clamp(10px,4vw,64px) clamp(18px,4vw,56px) clamp(28px,7vw,110px)", "display": "flex", "flexWrap": "wrap", "alignItems": "center", "gap": "clamp(18px,4vw,64px)"}}>

          <div style={{"flex": "1 1 440px", "minWidth": "300px", "maxWidth": "640px"}}>

            <img src="/icons/apple-touch-icon.png" alt="" width={88} height={88} style={{"display": "block", "width": "clamp(64px,7vw,88px)", "height": "auto", "boxShadow": "0 10px 26px rgba(27,95,168,.25)", "borderRadius": "22.5%"}} />

            <h1 style={{"margin": "clamp(16px,2.4vw,26px) 0 0", "fontSize": "clamp(44px,6.8vw,84px)", "lineHeight": ".98", "letterSpacing": "-.035em", "fontWeight": "800"}}>
              LiftCamp
            </h1>
            <p style={{"margin": "clamp(8px,1.2vw,14px) 0 0", "fontSize": "clamp(24px,3vw,38px)", "lineHeight": "1.12", "letterSpacing": "-.025em", "fontWeight": "700", "color": "#1B5FA8", "textWrap": "balance"}}>
              Lifting programs &amp; workout log
            </p>

            <p style={{"margin": "clamp(14px,2vw,22px) 0 0", "fontSize": "clamp(17px,1.7vw,21px)", "lineHeight": "1.5", "color": "#6B655D", "maxWidth": "min(40ch,100%)", "textWrap": "pretty"}}>
              Built for beginners, with room to grow. Free to start.
            </p>

            {/* Clear space around the badge: at least a quarter of its height, per Apple. */}
            <div style={{"margin": "clamp(20px,3vw,32px) 0 0"}}>
              <AppStoreBadge tone="black" height={54} campaign="hero" />
            </div>
            <p style={{"margin": "14px 0 0", "fontSize": "14px", "color": "#9A948B"}}>Free to start. iPhone app on the App Store.</p>
            <p style={{"margin": "6px 0 0", "fontSize": "15px", "fontWeight": "500"}}>
              <Link to="/login" className="lc-web" style={{"color": "#1B5FA8"}}>On Android? Use LiftCamp on the web</Link>
            </p>
          </div>

          <div style={{"flex": "1 1 380px", "minWidth": "280px", "display": "flex", "justifyContent": "center", "position": "relative"}}>

            <div style={{"position": "relative", "display": "flex", "justifyContent": "center", "padding": "clamp(4px,1.5vw,14px) 0 clamp(10px,2.5vw,26px)"}}>

              <div style={{"position": "absolute", "left": "50%", "top": "6%", "width": "clamp(230px,30vw,340px)", "aspectRatio": "1/1", "borderRadius": "99px", "background": "radial-gradient(circle,rgba(27,95,168,.14),rgba(27,95,168,0) 70%)", "transform": "translateX(-40%)", "pointerEvents": "none"}}></div>

              <div style={{"position": "absolute", "right": "-4%", "top": "9%", "fontSize": "clamp(8.5px,2.4vw,11px)", "transform": "rotate(7deg)", "transformOrigin": "bottom left", "zIndex": "1"}}>
                <PhoneFrame
                  name="02-active-workout"
                  alt="LiftCamp workout screen logging bench press sets"
                  widthEm={23}
                  bezelEm={0.55}
                  background="#15181C"
                  shadow="0 26px 60px rgba(34,31,27,.28)"
                />
              </div>

              <div style={{"position": "relative", "zIndex": "2", "fontSize": "clamp(10.5px,3vw,13.4px)"}}>
                <PhoneFrame
                  name="01-home"
                  alt="LiftCamp Home screen with the week's workouts and the next routine day"
                  widthEm={24}
                  bezelEm={0.6}
                  priority
                  background="linear-gradient(160deg,#2B3037,#101317)"
                  shadow="0 34px 70px rgba(34,31,27,.34),0 4px 14px rgba(34,31,27,.16)"
                />

                <div style={{"position": "absolute", "left": "-2.2em", "bottom": "7em", "zIndex": "3", "animation": "lcfloat 5.5s ease-in-out infinite", "background": "#fff", "border": "1px solid #DCD6CD", "borderRadius": "1.1em", "padding": ".85em 1.15em .85em .95em", "boxShadow": "0 1.2em 2.4em rgba(34,31,27,.18)", "display": "flex", "alignItems": "center", "gap": ".75em"}}>
                  <PrRibbon size={26} />
                  <span>
                    <span style={{"display": "block", "fontSize": "1.02em", "fontWeight": "600", "color": "#221F1B", "whiteSpace": "nowrap"}}>New PR · Barbell Bench Press</span>
                    <span style={{"display": "block", "fontSize": ".9em", "color": "#6B655D", "fontVariantNumeric": "tabular-nums", "whiteSpace": "nowrap"}}>190 lbs × 8 · +30 lbs</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="screens" style={{"maxWidth": "1360px", "margin": "0 auto", "padding": "0 clamp(18px,4vw,56px) clamp(40px,7vw,96px)"}}>
          <h2 style={{"margin": "0", "fontSize": "clamp(26px,3.4vw,38px)", "letterSpacing": "-.03em", "fontWeight": "800"}}>A look inside</h2>
          <p style={{"margin": "10px 0 0", "fontSize": "17px", "lineHeight": "1.6", "color": "#6B655D", "maxWidth": "62ch"}}>Real screens from the iPhone app.</p>
          <div className="lc-shots" style={{"marginTop": "clamp(20px,3vw,34px)"}}>
            {LANDING_SHOTS.map((shot) => {
              const img = shotSrc(shot.name);
              return (
                <figure key={shot.name} style={{"margin": "0"}}>
                  {/* Padding is a % of the figure's width; the radii are
                      "width% / height%" so the corners stay circular. */}
                  <div style={{"borderRadius": "16.6% / 7.94%", "padding": "3.5%", "background": "#15181C", "boxShadow": "0 22px 44px rgba(34,31,27,.18)"}}>
                    <img
                      src={img.src}
                      srcSet={img.srcSet}
                      sizes="(max-width: 1020px) min(64vw, 240px), 240px"
                      alt={shot.alt}
                      loading="lazy"
                      decoding="async"
                      width={SHOT_W}
                      height={SHOT_H}
                      style={{"display": "block", "width": "100%", "height": "auto", "borderRadius": "14.1% / 6.49%", "background": "#FDFCFB"}}
                    />
                  </div>
                  <figcaption style={{"marginTop": "14px"}}>
                    <p style={{"margin": "0", "fontSize": "17px", "fontWeight": "700", "letterSpacing": "-.01em"}}>{shot.title}</p>
                    <p style={{"margin": "6px 0 0", "fontSize": "15.5px", "lineHeight": "1.6", "color": "#6B655D"}}>{shot.body}</p>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>

        <section id="features" style={{"maxWidth": "1360px", "margin": "0 auto", "padding": "0 clamp(18px,4vw,56px) clamp(40px,7vw,96px)"}}>
          <h2 style={{"margin": "0", "fontSize": "clamp(26px,3.4vw,38px)", "letterSpacing": "-.03em", "fontWeight": "800"}}>What's in the app</h2>
          <p style={{"margin": "10px 0 0", "fontSize": "17px", "lineHeight": "1.6", "color": "#6B655D", "maxWidth": "62ch"}}>
            LiftCamp is a workout tracker for new and experienced lifters. It tells you what to do in the gym, makes logging fast, and turns showing up every week into a streak worth protecting.
          </p>
          <div className="lc-features" style={{"marginTop": "clamp(16px,2vw,24px)"}}>
            {LANDING_FEATURES.map((f) => (
              <div key={f.title} style={{"background": "#fff", "border": "1px solid rgba(34,31,27,.09)", "borderRadius": "16px", "padding": "clamp(16px,2vw,22px)"}}>
                <h3 style={{"margin": "0", "fontSize": "18px", "fontWeight": "700", "letterSpacing": "-.01em"}}>{f.title}</h3>
                {f.blocks.map((b, i) =>
                  "p" in b ? (
                    <p key={i} style={{"margin": "10px 0 0", "fontSize": "16px", "lineHeight": "1.6", "color": "#6B655D"}}>{b.p}</p>
                  ) : (
                    <ul key={i} style={{"fontSize": "16px", "lineHeight": "1.6", "color": "#6B655D"}}>
                      {b.ul.map((li) => <li key={li}>{li}</li>)}
                    </ul>
                  ),
                )}
              </div>
            ))}
          </div>
          <div style={{"marginTop": "clamp(22px,3vw,32px)", "display": "flex", "flexWrap": "wrap", "alignItems": "center", "gap": "14px 22px"}}>
            <AppStoreBadge tone="black" height={48} campaign="landing-cta" />
            <p style={{"margin": "0", "fontSize": "15px", "color": "#6B655D"}}>
              Questions or ideas? Email <a href="mailto:hello@liftcamp.app">hello@liftcamp.app</a>. We read everything.
            </p>
          </div>
        </section>

        <section style={{"maxWidth": "1360px", "margin": "0 auto", "padding": "0 clamp(18px,4vw,56px) clamp(40px,7vw,96px)"}}>
          <h2 style={{"margin": "0", "fontSize": "clamp(26px,3.4vw,38px)", "letterSpacing": "-.03em", "fontWeight": "800"}}>Questions people ask</h2>
          <div style={{"marginTop": "clamp(16px,2vw,24px)", "display": "grid", "gap": "clamp(14px,2vw,20px)", "gridTemplateColumns": "repeat(auto-fit,minmax(300px,1fr))", "maxWidth": "1100px"}}>
            {LANDING_FAQ.map((item) => (
              <div key={item.q} style={{"background": "#fff", "border": "1px solid rgba(34,31,27,.09)", "borderRadius": "16px", "padding": "clamp(16px,2vw,22px)"}}>
                <p style={{"margin": "0", "fontSize": "17px", "fontWeight": "700", "letterSpacing": "-.01em"}}>{item.q}</p>
                <p style={{"margin": "8px 0 0", "fontSize": "16px", "lineHeight": "1.6", "color": "#6B655D"}}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <SiteFooter />

      </div>

    </div>
  );
}
