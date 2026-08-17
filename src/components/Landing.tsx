import { SiteFooter } from "@/components/SiteFooter";

const LANDING_CSS = `*{box-sizing:border-box}
.lc-landing{background:#FBF9F6;color:#1F1D1A;font-family:'Work Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.lc-landing a{color:#1B5697;text-decoration:none}
.lc-landing a:hover{color:#123f70}
.lc-landing input,.lc-landing button{font-family:inherit}
@keyframes lcfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@media (max-width:760px){.lc-navlinks{display:none !important}}
.lc-navlink:hover{color:#1F1D1A}
.lc-btn:hover{background:#154678;color:#fff}
@media (prefers-reduced-motion:reduce){.lc-landing *{animation:none!important}}`;

/** Objection-shaped, not keyword-shaped: the things a stranger needs answered
 *  before signing up. Visible copy only — no FAQPage markup. */
const LANDING_FAQ: readonly { q: string; a: string }[] = [
  {
    q: "Is LiftCamp free?",
    a: "Yes. The tracker, the exercise library and the guides are all free, with no trial and no card required.",
  },
  {
    q: "Do I need to install an app?",
    a: "No. LiftCamp runs in your browser. On iPhone or Android you can add it to your home screen and it opens like a normal app, offline included.",
  },
  {
    q: "Does it work on iPhone?",
    a: "Yes — open it in Safari, tap Share, then Add to Home Screen. The rest timer keeps running and the screen stays awake between sets.",
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
    a: "It's yours and it stays private — your workouts are never shown to anyone else, and LiftCamp doesn't sell data or run ads.",
  },
];

export function Landing() {

  return (
    <div
      className="lc-landing"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div style={{"minHeight": "100vh", "background": "radial-gradient(120% 80% at 82% 0%, rgba(27,86,151,.10) 0%, rgba(27,86,151,0) 60%), radial-gradient(70% 50% at 8% 12%, rgba(245,200,96,.20) 0%, rgba(245,200,96,0) 65%), #FBF9F6"}}>

        <header style={{"display": "flex", "alignItems": "center", "gap": "clamp(12px,3vw,28px)", "flexWrap": "wrap", "padding": "clamp(14px,2.5vw,20px) clamp(18px,4vw,56px)", "maxWidth": "1360px", "margin": "0 auto"}}>
          <a href="#top" style={{"display": "flex", "alignItems": "center", "gap": "11px", "marginRight": "auto"}}>
            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201024%201024%22%20width%3D%221024%22%20height%3D%221024%22%3E%3Cg%20transform%3D%22scale(2%202)%22%3E%3Cpath%20fill%3D%22%231B5FA8%22%20d%3D%22M154.33%2063.8605C154.735%2063.8286%20155.221%2063.7839%20155.625%2063.787L334.96%2063.8631C346.512%2063.8626%20358.302%2063.1032%20369.538%2065.4435C412.342%2074.3585%20441.754%20110.631%20441.969%20154.538L442.007%20338.766C442.011%20351.632%20442.745%20365.236%20440.098%20377.848C432.091%20415.993%20397.028%20446.925%20357.438%20447.5C352.937%20447.703%20347.612%20447.506%20343.015%20447.504L176.886%20447.501C166.067%20447.507%20153.794%20448.189%20143.27%20446.337C104.089%20439.44%2073.0083%20404.626%2070.3225%20364.977C69.8948%20358.664%2069.9981%20352.265%2070.0021%20345.936L70.003%20179.365C70.0032%20165.657%2069.1366%20150.142%2071.6172%20136.77C79.158%2096.1199%20113.607%2066.612%20154.33%2063.8605Z%22%3E%3C%2Fpath%3E%3Cpath%20fill%3D%22%23F5D272%22%20d%3D%22M316.579%20164.404C315.533%20183.395%20307.048%20187.407%20289.126%20186.228C263.967%20184.642%20259.585%20180.977%20259.931%20155.786C260.062%20146.244%20259.198%20136.524%20267.403%20129.82C276.236%20122.603%20291.211%20126.035%20301.917%20127.184L327.8%20129.911C332.932%20130.441%20338.356%20130.668%20343.393%20131.423C367.21%20134.991%20373.826%20152.494%20377.865%20172.534L390.114%20231.533C393.545%20247.778%20395.334%20261.24%20393.313%20277.75C385.979%20338.198%20326.007%20376.487%20267.73%20368.039C253.996%20366.048%20241.158%20362.142%20228.428%20357.627C206.665%20349.907%20203.927%20342.75%20185.807%20360.778L173.942%20372.714C171.207%20375.502%20167.735%20379.356%20164.373%20381.318C156.923%20385.667%20146.907%20383.455%20143.728%20374.796C141.549%20369.589%20139.051%20364.635%20136.704%20359.506L126.446%20336.646C124.243%20331.79%20119.437%20321.947%20118.502%20317.455C112.091%20286.661%20139.186%20254.636%20168.616%20247.718C191.697%20242.293%20210.044%20251.652%20227.874%20265.032C235.171%20270.508%20244.529%20263.482%20252.035%20262.111C274.15%20258.074%20290.362%20270.577%20308.237%20281.418C315.783%20285.995%20324.159%20290.62%20331.547%20295.39C328.979%20292.255%20324.945%20288.568%20322.042%20285.458C307.09%20269.441%20309.66%20248.659%20320.144%20230.921C324.018%20224.368%20329.978%20217.084%20333.181%20210.357C337.353%20201.595%20341.557%20176.682%20334.235%20168.63C330.249%20164.247%20322.304%20164.696%20316.579%20164.404Z%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3C%2Fsvg%3E" alt="LiftCamp" style={{"width": "36px", "height": "36px", "display": "block", "flex": "none", "borderRadius": "9px"}} />
            <span style={{"fontSize": "21px", "fontWeight": "700", "letterSpacing": "-.02em", "color": "#1F1D1A"}}>LiftCamp</span>
          </a>
          <nav className="lc-navlinks" style={{"display": "flex", "alignItems": "center", "gap": "clamp(14px,2vw,30px)", "flexWrap": "wrap", "fontSize": "15px", "fontWeight": "500", "color": "#4A443C"}}>
            <a href="/exercises" className="lc-navlink" style={{"color": "#4A443C"}}>Exercises</a>
            <a href="/guides" className="lc-navlink" style={{"color": "#4A443C"}}>Guides</a>
          </nav>
          <div style={{"display": "flex", "alignItems": "center", "gap": "14px"}}>
            <a href="https://liftcamp.app/login" style={{"fontSize": "15px", "fontWeight": "600", "color": "#1B5697"}}>Log in</a>
            <a href="https://liftcamp.app/login?mode=signup" style={{"fontSize": "15px", "fontWeight": "600", "color": "#fff", "background": "#1B5697", "padding": "10px 20px", "borderRadius": "10px"}} className="lc-btn">Sign up</a>
          </div>
        </header>

        <section id="top" style={{"maxWidth": "1360px", "margin": "0 auto", "padding": "clamp(10px,4vw,64px) clamp(18px,4vw,56px) clamp(28px,7vw,110px)", "display": "flex", "flexWrap": "wrap", "alignItems": "center", "gap": "clamp(18px,4vw,64px)"}}>

          <div style={{"flex": "1 1 440px", "minWidth": "300px", "maxWidth": "640px"}}>

            <h1 style={{"margin": "clamp(12px,2vw,20px) 0 0", "fontSize": "clamp(40px,6.4vw,78px)", "lineHeight": ".98", "letterSpacing": "-.035em", "fontWeight": "800", "textWrap": "balance"}}>
              Log every lift<br />
              <span style={{"color": "#1B5697"}}>Track your progress</span><br />
              Get stronger
            </h1>

            <p style={{"margin": "clamp(14px,2vw,22px) 0 0", "fontSize": "clamp(16px,1.6vw,20px)", "lineHeight": "1.5", "color": "#544D44", "maxWidth": "min(40ch,100%)", "textWrap": "pretty"}}>
              LiftCamp is a free workout tracker and exercise library built for strength training beginners and experienced lifters alike. Log sets in seconds, follow a routine that adapts to your week, and track all your PRs and progress.
            </p>


              <div style={{"display": "flex", "flexWrap": "wrap", "gap": "12px", "alignItems": "center", "margin": "clamp(18px,3vw,30px) 0 0"}}>
                <a href="https://liftcamp.app/login" style={{"padding": "15px 30px", "fontSize": "16.5px", "fontWeight": "700", "color": "#fff", "background": "#1B5697", "borderRadius": "12px", "boxShadow": "0 3px 12px rgba(27,86,151,.3)"}} className="lc-btn">Get the app</a>
              </div>
              <p style={{"margin": "12px 0 0", "fontSize": "13.5px", "color": "#8A8378"}}>Web app is live and in beta.</p>
          </div>

          <div style={{"flex": "1 1 380px", "minWidth": "280px", "display": "flex", "justifyContent": "center", "position": "relative"}}>

            <div style={{"position": "relative", "display": "flex", "justifyContent": "center", "padding": "clamp(4px,1.5vw,14px) 0 clamp(10px,2.5vw,26px)"}}>

              <div style={{"position": "absolute", "left": "50%", "top": "6%", "width": "clamp(230px,30vw,340px)", "aspectRatio": "1/1", "borderRadius": "99px", "background": "radial-gradient(circle,rgba(27,86,151,.14),rgba(27,86,151,0) 70%)", "transform": "translateX(-40%)", "pointerEvents": "none"}}></div>


                <div style={{"position": "absolute", "right": "-4%", "top": "9%", "fontSize": "clamp(8.5px,2.4vw,11px)", "transform": "rotate(7deg)", "transformOrigin": "bottom left", "zIndex": "1"}}>
                  <div style={{"width": "23em", "height": "45em", "borderRadius": "3.4em", "background": "#15181C", "padding": ".55em", "boxShadow": "0 26px 60px rgba(31,29,26,.28)"}}>
                    <div style={{"width": "100%", "height": "100%", "borderRadius": "2.95em", "background": "#FBF9F6", "overflow": "hidden", "padding": "2.2em 1.4em 0", "display": "flex", "flexDirection": "column", "gap": "1em"}}>
                      <div style={{"display": "flex", "alignItems": "center", "gap": ".5em", "fontSize": "1.05em", "fontWeight": "600", "color": "#544D44"}}><span style={{"fontSize": "1.2em", "color": "#1B5697"}}>{"\u2039"}</span> History</div>
                      <div>
                        <div style={{"fontSize": "2em", "fontWeight": "700", "letterSpacing": "-.02em"}}>Pull Day</div>
                        <div style={{"fontSize": "1em", "color": "#8A8378", "marginTop": ".25em"}}>August 7, 2026 · 1h 04m</div>
                      </div>
                      <div style={{"display": "flex", "flexWrap": "wrap", "gap": ".5em", "fontFamily": "'IBM Plex Mono',monospace", "fontSize": ".9em"}}>
                        <span style={{"padding": ".45em .7em", "borderRadius": "99px", "background": "#F1EEE8", "color": "#544D44"}}>8 exercises</span>
                        <span style={{"padding": ".45em .7em", "borderRadius": "99px", "background": "#F1EEE8", "color": "#544D44"}}>23 sets</span>
                        <span style={{"padding": ".45em .7em", "borderRadius": "99px", "background": "rgba(245,200,96,.4)", "color": "#7A5A10", "fontWeight": "500"}}>6 PRs</span>
                      </div>
                      <div style={{"background": "#fff", "border": "1px solid rgba(31,29,26,.09)", "borderRadius": "1.1em", "padding": "1em"}}>
                        <div style={{"display": "flex", "justifyContent": "space-between", "alignItems": "baseline"}}><span style={{"fontWeight": "600", "fontSize": "1.15em"}}>Wide-Grip Lat Pulldown</span><span style={{"fontSize": ".85em", "color": "#8A8378", "fontFamily": "'IBM Plex Mono',monospace"}}>1RM 177 lb</span></div>
                        <div style={{"display": "flex", "flexDirection": "column", "gap": ".55em", "marginTop": ".8em", "fontFamily": "'IBM Plex Mono',monospace", "fontSize": "1em", "color": "#544D44"}}>
                          <div style={{"display": "flex", "gap": "1.2em", "alignItems": "center"}}><span style={{"color": "#B0A99E"}}>1</span><span style={{"width": "5em"}}>120 lb</span><span>12 reps</span></div>
                          <div style={{"display": "flex", "gap": "1.2em", "alignItems": "center"}}><span style={{"color": "#B0A99E"}}>2</span><span style={{"width": "5em"}}>130 lb</span><span>11 reps</span><span style={{"marginLeft": "auto", "padding": ".15em .5em", "borderRadius": ".4em", "background": "#F5C860", "color": "#5E4406", "fontSize": ".85em", "fontWeight": "500"}}>PR</span></div>
                          <div style={{"display": "flex", "gap": "1.2em", "alignItems": "center"}}><span style={{"color": "#B0A99E"}}>3</span><span style={{"width": "5em"}}>130 lb</span><span>11 reps</span></div>
                        </div>
                      </div>
                      <div style={{"background": "#fff", "border": "1px solid rgba(31,29,26,.09)", "borderRadius": "1.1em", "padding": "1em"}}>
                        <div style={{"display": "flex", "justifyContent": "space-between", "alignItems": "baseline"}}><span style={{"fontWeight": "600", "fontSize": "1.15em"}}>Seated Machine Row</span><span style={{"fontSize": ".85em", "color": "#8A8378", "fontFamily": "'IBM Plex Mono',monospace"}}>1RM 177 lb</span></div>
                        <div style={{"display": "flex", "flexDirection": "column", "gap": ".55em", "marginTop": ".8em", "fontFamily": "'IBM Plex Mono',monospace", "fontSize": "1em", "color": "#544D44"}}>
                          <div style={{"display": "flex", "gap": "1.2em", "alignItems": "center"}}><span style={{"color": "#B0A99E"}}>1</span><span style={{"width": "5em"}}>110 lb</span><span>12 reps</span></div>
                          <div style={{"display": "flex", "gap": "1.2em", "alignItems": "center"}}><span style={{"color": "#B0A99E"}}>2</span><span style={{"width": "5em"}}>130 lb</span><span>11 reps</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>


              <div style={{"position": "relative", "zIndex": "2", "fontSize": "clamp(10.5px,3vw,13.4px)"}}>
                <div style={{"width": "24em", "height": "47.5em", "borderRadius": "3.6em", "background": "linear-gradient(160deg,#2B3037,#101317)", "padding": ".6em", "boxShadow": "0 34px 70px rgba(31,29,26,.34),0 4px 14px rgba(31,29,26,.16)"}}>
                  <div style={{"width": "100%", "height": "100%", "borderRadius": "3.05em", "background": "#FBF9F6", "overflow": "hidden", "display": "flex", "flexDirection": "column", "position": "relative"}}>

                    <div style={{"display": "flex", "justifyContent": "space-between", "alignItems": "center", "padding": "1.1em 1.9em .3em", "fontSize": ".95em", "fontWeight": "600", "color": "#1F1D1A", "fontFamily": "'IBM Plex Mono',monospace"}}>
                      <span>9:41</span>
                      <span style={{"display": "flex", "gap": ".35em", "alignItems": "flex-end"}}>
                        <span style={{"width": ".28em", "height": ".55em", "background": "#1F1D1A", "borderRadius": ".1em", "display": "block"}}></span>
                        <span style={{"width": ".28em", "height": ".8em", "background": "#1F1D1A", "borderRadius": ".1em", "display": "block"}}></span>
                        <span style={{"width": ".28em", "height": "1.05em", "background": "#1F1D1A", "borderRadius": ".1em", "display": "block"}}></span>
                        <span style={{"width": "1.7em", "height": ".85em", "border": ".12em solid #1F1D1A", "borderRadius": ".28em", "display": "block", "padding": ".12em"}}><span style={{"display": "block", "width": "70%", "height": "100%", "background": "#1F1D1A", "borderRadius": ".1em"}}></span></span>
                      </span>
                    </div>

                    <div style={{"flex": "1", "overflow": "hidden", "padding": ".9em 1.15em 0", "display": "flex", "flexDirection": "column", "gap": ".85em"}}>

                      <div style={{"display": "flex", "alignItems": "center", "gap": ".6em"}}>
                        <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201024%201024%22%20width%3D%221024%22%20height%3D%221024%22%3E%3Cg%20transform%3D%22scale(2%202)%22%3E%3Cpath%20fill%3D%22%231B5FA8%22%20d%3D%22M154.33%2063.8605C154.735%2063.8286%20155.221%2063.7839%20155.625%2063.787L334.96%2063.8631C346.512%2063.8626%20358.302%2063.1032%20369.538%2065.4435C412.342%2074.3585%20441.754%20110.631%20441.969%20154.538L442.007%20338.766C442.011%20351.632%20442.745%20365.236%20440.098%20377.848C432.091%20415.993%20397.028%20446.925%20357.438%20447.5C352.937%20447.703%20347.612%20447.506%20343.015%20447.504L176.886%20447.501C166.067%20447.507%20153.794%20448.189%20143.27%20446.337C104.089%20439.44%2073.0083%20404.626%2070.3225%20364.977C69.8948%20358.664%2069.9981%20352.265%2070.0021%20345.936L70.003%20179.365C70.0032%20165.657%2069.1366%20150.142%2071.6172%20136.77C79.158%2096.1199%20113.607%2066.612%20154.33%2063.8605Z%22%3E%3C%2Fpath%3E%3Cpath%20fill%3D%22%23F5D272%22%20d%3D%22M316.579%20164.404C315.533%20183.395%20307.048%20187.407%20289.126%20186.228C263.967%20184.642%20259.585%20180.977%20259.931%20155.786C260.062%20146.244%20259.198%20136.524%20267.403%20129.82C276.236%20122.603%20291.211%20126.035%20301.917%20127.184L327.8%20129.911C332.932%20130.441%20338.356%20130.668%20343.393%20131.423C367.21%20134.991%20373.826%20152.494%20377.865%20172.534L390.114%20231.533C393.545%20247.778%20395.334%20261.24%20393.313%20277.75C385.979%20338.198%20326.007%20376.487%20267.73%20368.039C253.996%20366.048%20241.158%20362.142%20228.428%20357.627C206.665%20349.907%20203.927%20342.75%20185.807%20360.778L173.942%20372.714C171.207%20375.502%20167.735%20379.356%20164.373%20381.318C156.923%20385.667%20146.907%20383.455%20143.728%20374.796C141.549%20369.589%20139.051%20364.635%20136.704%20359.506L126.446%20336.646C124.243%20331.79%20119.437%20321.947%20118.502%20317.455C112.091%20286.661%20139.186%20254.636%20168.616%20247.718C191.697%20242.293%20210.044%20251.652%20227.874%20265.032C235.171%20270.508%20244.529%20263.482%20252.035%20262.111C274.15%20258.074%20290.362%20270.577%20308.237%20281.418C315.783%20285.995%20324.159%20290.62%20331.547%20295.39C328.979%20292.255%20324.945%20288.568%20322.042%20285.458C307.09%20269.441%20309.66%20248.659%20320.144%20230.921C324.018%20224.368%20329.978%20217.084%20333.181%20210.357C337.353%20201.595%20341.557%20176.682%20334.235%20168.63C330.249%20164.247%20322.304%20164.696%20316.579%20164.404Z%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3C%2Fsvg%3E" alt="" style={{"width": "1.9em", "height": "1.9em", "borderRadius": ".5em", "display": "block", "flex": "none"}} />
                        <span style={{"fontSize": "1.65em", "fontWeight": "700", "letterSpacing": "-.02em"}}>Start Workout</span>
                      </div>

                      <div style={{"background": "#fff", "border": "1px solid rgba(31,29,26,.09)", "borderRadius": "1.1em", "padding": "1em 1.05em"}}>
                        <div style={{"display": "flex", "alignItems": "center", "justifyContent": "space-between"}}>
                          <span style={{"fontSize": "1.1em", "fontWeight": "600"}}>This week <span style={{"fontFamily": "'IBM Plex Mono',monospace", "color": "#1B5697"}}>1/3</span></span>
                          <span style={{"padding": ".3em .6em", "borderRadius": "99px", "background": "rgba(245,200,96,.42)", "color": "#6E5008", "fontSize": ".82em", "fontWeight": "600", "letterSpacing": ".05em"}}>1 WEEK</span>
                        </div>
                        <div style={{"height": ".42em", "borderRadius": "99px", "background": "#EDE9E2", "margin": ".85em 0", "overflow": "hidden"}}><span style={{"display": "block", "width": "33%", "height": "100%", "background": "#1B5697", "borderRadius": "99px"}}></span></div>
                        <div style={{"display": "flex", "alignItems": "center", "gap": ".42em"}}>
                          <span style={{"width": "1.55em", "height": "1.55em", "borderRadius": "99px", "background": "#1B5697", "color": "#fff", "fontSize": ".82em", "fontWeight": "600", "display": "grid", "placeItems": "center"}}>M</span>
                          <span style={{"width": "1.55em", "height": "1.55em", "borderRadius": "99px", "background": "#F1EEE8", "color": "#8A8378", "fontSize": ".82em", "fontWeight": "600", "display": "grid", "placeItems": "center"}}>T</span>
                          <span style={{"width": "1.55em", "height": "1.55em", "borderRadius": "99px", "background": "#F1EEE8", "color": "#8A8378", "fontSize": ".82em", "fontWeight": "600", "display": "grid", "placeItems": "center"}}>W</span>
                          <span style={{"width": "1.55em", "height": "1.55em", "borderRadius": "99px", "background": "#F1EEE8", "color": "#8A8378", "fontSize": ".82em", "fontWeight": "600", "display": "grid", "placeItems": "center"}}>T</span>
                          <span style={{"width": "1.55em", "height": "1.55em", "borderRadius": "99px", "background": "#F1EEE8", "color": "#8A8378", "fontSize": ".82em", "fontWeight": "600", "display": "grid", "placeItems": "center"}}>F</span>
                          <span style={{"width": "1.55em", "height": "1.55em", "borderRadius": "99px", "background": "#F1EEE8", "color": "#8A8378", "fontSize": ".82em", "fontWeight": "600", "display": "grid", "placeItems": "center"}}>S</span>
                          <span style={{"width": "1.55em", "height": "1.55em", "borderRadius": "99px", "background": "#F1EEE8", "color": "#8A8378", "fontSize": ".82em", "fontWeight": "600", "display": "grid", "placeItems": "center"}}>S</span>
                          <span style={{"marginLeft": "auto", "fontSize": ".9em", "color": "#8A8378", "fontFamily": "'IBM Plex Mono',monospace"}}>2 to go</span>
                        </div>
                      </div>

                      <div style={{"background": "#fff", "border": "1px solid rgba(31,29,26,.09)", "borderRadius": "1.1em", "padding": ".9em 1.05em", "display": "flex", "alignItems": "center", "gap": ".75em"}}>
                        <span style={{"width": "2.3em", "height": "2.3em", "borderRadius": "99px", "background": "#E7EDF4", "flex": "none", "display": "grid", "placeItems": "center"}}>
                          <span style={{"width": "1em", "height": ".3em", "borderRadius": ".1em", "background": "#1B5697", "display": "block"}}></span>
                        </span>
                        <span style={{"flex": "1", "minWidth": "0"}}>
                          <span style={{"display": "flex", "alignItems": "baseline", "gap": ".5em"}}><span style={{"fontSize": "1.15em", "fontWeight": "600"}}>Leg Day</span><span style={{"fontSize": ".88em", "color": "#8A8378"}}>2 days ago</span></span>
                          <span style={{"display": "block", "fontSize": ".9em", "color": "#8A8378", "fontFamily": "'IBM Plex Mono',monospace", "whiteSpace": "nowrap", "overflow": "hidden", "textOverflow": "ellipsis"}}>7 exercises · 21 sets · 28,555 lb</span>
                        </span>
                        <span style={{"color": "#B0A99E", "fontSize": "1.2em"}}>{"\u203a"}</span>
                      </div>

                      <div style={{"background": "#fff", "border": "1px solid rgba(31,29,26,.09)", "borderRadius": "1.1em", "padding": "1em 1.05em"}}>
                        <div style={{"fontSize": "1.15em", "fontWeight": "600"}}>Generate a workout</div>
                        <div style={{"fontSize": ".92em", "color": "#8A8378", "margin": ".2em 0 .8em"}}>Pick a day and we'll build it from your library.</div>
                        <div style={{"display": "grid", "gridTemplateColumns": "1fr 1fr", "gap": ".6em", "fontSize": "1.05em", "fontWeight": "600"}}>
                          <span style={{"textAlign": "center", "padding": ".85em", "borderRadius": ".8em", "background": "#F7DFDC", "color": "#8E4238"}}>Push</span>
                          <span style={{"textAlign": "center", "padding": ".85em", "borderRadius": ".8em", "background": "#D8E8E8", "color": "#2F5E5E"}}>Pull</span>
                          <span style={{"textAlign": "center", "padding": ".85em", "borderRadius": ".8em", "background": "#DEEBD9", "color": "#3E6238"}}>Legs</span>
                          <span style={{"textAlign": "center", "padding": ".85em", "borderRadius": ".8em", "background": "#F5E6D2", "color": "#7A5A2C"}}>Full body</span>
                        </div>
                      </div>

                      <div style={{"display": "flex", "gap": ".7em"}}>
                        <span style={{"flex": "1", "textAlign": "center", "padding": ".9em", "borderRadius": ".95em", "background": "#F1EEE8", "fontSize": "1em", "fontWeight": "600", "color": "#544D44"}}>New template</span>
                        <span style={{"flex": "1", "textAlign": "center", "padding": ".9em", "borderRadius": ".95em", "background": "#F1EEE8", "fontSize": "1em", "fontWeight": "600", "color": "#544D44"}}>Browse exercises</span>
                      </div>

                      <div style={{"fontSize": "1em", "fontWeight": "600", "color": "#1B5697"}}>Browse all routines {"\u2192"}</div>
                    </div>

                    <div style={{"background": "#1B5697", "padding": "1em 1.2em 1.3em", "position": "relative"}}>
                      <button type="button" style={{"position": "absolute", "top": "-1.3em", "left": "50%", "transform": "translateX(-50%)", "padding": ".75em 2.4em", "border": "none", "borderRadius": ".9em", "background": "#F5C860", "color": "#4E3B05", "fontSize": "1.1em", "fontWeight": "700", "cursor": "pointer", "boxShadow": "0 .4em 1em rgba(31,29,26,.25)", "whiteSpace": "nowrap"}}>+ Start</button>
                      <div style={{"display": "flex", "justifyContent": "space-around", "alignItems": "center", "marginTop": "1.6em", "fontSize": ".85em", "fontWeight": "600", "color": "rgba(255,255,255,.68)"}}>
                        <span style={{"color": "#fff"}}>Home</span>
                        <span>History</span>
                        <span>Exercises</span>
                      </div>
                    </div>

                  </div>
                </div>

                <div style={{"position": "absolute", "left": "-2.2em", "bottom": "7em", "zIndex": "3", "animation": "lcfloat 5.5s ease-in-out infinite", "background": "#fff", "border": "1px solid rgba(31,29,26,.08)", "borderRadius": "1.1em", "padding": ".85em 1.1em", "boxShadow": "0 1.2em 2.4em rgba(31,29,26,.18)", "display": "flex", "alignItems": "center", "gap": ".75em"}}>
                  <span style={{"width": "2.1em", "height": "2.1em", "borderRadius": ".7em", "background": "#F5C860", "color": "#4E3B05", "fontSize": ".85em", "fontWeight": "700", "display": "grid", "placeItems": "center", "flex": "none"}}>PR</span>
                  <span>
                    <span style={{"display": "block", "fontSize": "1.02em", "fontWeight": "600", "whiteSpace": "nowrap"}}>New PR · Lat Pulldown</span>
                    <span style={{"display": "block", "fontSize": ".9em", "color": "#8A8378", "fontFamily": "'IBM Plex Mono',monospace", "whiteSpace": "nowrap"}}>130 lb × 11 · +10 lb</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={{"maxWidth": "1360px", "margin": "0 auto", "padding": "0 clamp(18px,4vw,56px) clamp(40px,7vw,96px)"}}>
          <h2 style={{"margin": "0", "fontSize": "clamp(26px,3.4vw,38px)", "letterSpacing": "-.03em", "fontWeight": "800"}}>Questions people ask</h2>
          <div style={{"marginTop": "clamp(16px,2vw,24px)", "display": "grid", "gap": "clamp(14px,2vw,20px)", "gridTemplateColumns": "repeat(auto-fit,minmax(300px,1fr))", "maxWidth": "1100px"}}>
            {LANDING_FAQ.map((item) => (
              <div key={item.q} style={{"background": "#fff", "border": "1px solid rgba(31,29,26,.09)", "borderRadius": "16px", "padding": "clamp(16px,2vw,22px)"}}>
                <p style={{"margin": "0", "fontSize": "17px", "fontWeight": "700", "letterSpacing": "-.01em"}}>{item.q}</p>
                <p style={{"margin": "8px 0 0", "fontSize": "16px", "lineHeight": "1.6", "color": "#544D44"}}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <SiteFooter />

      </div>

    </div>
  );
}
