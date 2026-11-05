/* "Back to all projects": a small pill in the corner of every live project and demo, shown only to
   people who came from the portfolio. Someone who opens a project from a résumé, LinkedIn or a
   bookmark sees the project and nothing else.

   Load it from any page on lekanlawal1.github.io:
     <script src="https://lekanlawal1.github.io/portfolio-site/portfolio-bar.js" data-project="econ" defer></script>
   data-project is the project's short id (fine, dock, econ, wh, store, triage, fifa, sorted). Opening the page
   marks that project as seen, and the portfolio's project map shows a filled dot for it.

   "Came from the portfolio" means the portfolio set a flag in this tab's sessionStorage (all projects
   share its origin, and a tab opened from it gets a copy), or the page was opened straight from it. */
(() => {
  const PORTFOLIO = "https://lekanlawal1.github.io/portfolio-site/";
  const TOUR = ["fine", "dock", "econ", "wh", "store", "triage", "fifa", "sorted"];
  const CARD = { fine: "fine-print", econ: "economy", wh: "discrepancy", store: "superstore", triage: "triage", fifa: "football", dock: "docket", sorted: "sorted" };
  // the tour's stops, in the portfolio's order: id, name, where the stop opens
  const STOPS = [
    ["fine", "Fine Print", PORTFOLIO + "demos/fine-print/"],
    ["econ", "Canada Economy", "https://lekanlawal1.github.io/project5-canada-economy-platform/"],
    ["sorted", "Sorted", "https://lekanlawal1.github.io/project2-ai-ticket-triage/"],
    ["fifa", "The Gaffer", "https://lekanlawal1.github.io/football-agent/"],
    ["store", "Money Snitch", "https://lekanlawal1.github.io/project1-bi-dashboard/"],
    ["triage", "App Review Insights", "https://lekanlawal1.github.io/app-review-insights/"],
    ["dock", "Docket", "https://lekanlawal1.github.io/docket/"],
    ["wh", "Discrepancy Checker", PORTFOLIO + "demos/discrepancy-checker/"],
  ];
  const me = document.currentScript;
  // a page that loads this without data-project is recognised by its address
  const project = (me && me.dataset.project) || (STOPS.find(([, , url]) => location.href.startsWith(url)) || [])[0];
  const base = (me && me.dataset.portfolio) || PORTFOLIO;   // a relative path when served from the portfolio itself

  let fromPortfolio = !!(me && me.dataset.portfolio) || document.referrer.startsWith(PORTFOLIO);
  try {
    if (fromPortfolio) sessionStorage.setItem("pf-from", "1");
    else fromPortfolio = sessionStorage.getItem("pf-from") === "1";
  } catch { /* private mode */ }

  // a visit counts as seen however people arrive
  let visited = [];
  try { visited = JSON.parse(localStorage.getItem("town-visited") || "[]"); } catch {}
  if (project && TOUR.includes(project) && !visited.includes(project)) {
    visited.push(project);
    try { localStorage.setItem("town-visited", JSON.stringify(visited)); } catch {}
  }
  try { if (sessionStorage.getItem("pf-tour") === "1") fromPortfolio = true; } catch {}
  if (!fromPortfolio) return;

  const css = `
.pf-pill { position: fixed; left: 14px; bottom: 14px; z-index: 2147483000; display: flex; align-items: center; gap: 2px; padding: 4px;
  background: rgba(255, 255, 255, .86); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: #18181B;
  border: 1px solid rgba(0, 0, 0, .1); border-radius: 999px; box-shadow: 0 6px 24px rgba(0, 0, 0, .12);
  font: 600 13px/1 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; transition: opacity .2s, transform .2s; }
.pf-pill a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border-radius: 999px; white-space: nowrap; }
.pf-pill a:hover, .pf-pill a:focus-visible { background: rgba(0, 0, 0, .06); outline: none; }
.pf-pill .pf-stop { font: 600 11px/1 ui-monospace, "JetBrains Mono", monospace; letter-spacing: .04em; opacity: .6; padding: 0 6px; border-left: 1px solid rgba(0, 0, 0, .14); }
.pf-pill .pf-next { background: #FFB547; color: #1A1510; }
.pf-pill .pf-next:hover, .pf-pill .pf-next:focus-visible { background: #FFC266; }
.pf-pill .pf-next b { font-weight: 700; }
@media (max-width: 420px) { .pf-pill .pf-stop { display: none; } }
.pf-pill.away { opacity: 0; transform: translateY(8px); pointer-events: none; }
@media (prefers-color-scheme: dark) { .pf-pill { background: rgba(24, 24, 27, .82); color: #F4F4F5; border-color: rgba(255, 255, 255, .14); }
  .pf-pill a:hover { background: rgba(255, 255, 255, .1); } .pf-pill .pf-stop { border-color: rgba(255, 255, 255, .16); } }
@media (prefers-reduced-motion: reduce) { .pf-pill { transition: none; } }
@media print { .pf-pill { display: none; } }`;
  const style = document.createElement("style");
  style.textContent = css;
  let touring = false;
  try { touring = sessionStorage.getItem("pf-tour") === "1"; } catch {}
  const at = STOPS.findIndex(([id]) => id === project);
  const pill = document.createElement("nav");
  pill.className = "pf-pill";
  pill.setAttribute("aria-label", "Portfolio");
  const back = base + "index.html" + (CARD[project] ? `#${CARD[project]}` : "#work");
  pill.innerHTML = `<a href="${back}"><span aria-hidden="true">&larr;</span>All projects</a>`;
  // on the tour: which stop this is, and the way to the next one (the last stop leads home to say hello)
  if (touring && at >= 0) {
    const next = STOPS[at + 1];
    const stop = document.createElement("span");
    stop.className = "pf-stop"; stop.textContent = `${at + 1} of ${STOPS.length}`;
    const go = document.createElement("a");
    go.className = "pf-next";
    if (next) { go.href = next[2]; go.innerHTML = `Next: <b></b> <span aria-hidden="true">&rarr;</span>`; go.querySelector("b").textContent = next[1]; }
    else {
      go.href = base + "index.html#contact"; go.innerHTML = `Finish the tour <span aria-hidden="true">&rarr;</span>`;
      go.addEventListener("click", () => { try { sessionStorage.removeItem("pf-tour"); } catch {} });
    }
    pill.append(stop, go);
  }
  // keep out of the way: hide while scrolling down, come back when scrolling up or at rest near the top
  let lastY = scrollY;
  addEventListener("scroll", () => { const y = scrollY; pill.classList.toggle("away", y > lastY && y > 200); lastY = y; }, { passive: true });
  const mount = () => { document.head.appendChild(style); document.body.appendChild(pill); };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
