/* The portfolio bar: a slim strip at the top of every live project and demo with a way back to the
   portfolio's projects, plus the visitor's progress on the island tour.

   Load it from any page on lekanlawal1.github.io:
     <script src="https://lekanlawal1.github.io/portfolio-site/portfolio-bar.js" data-project="econ" defer></script>
   data-project is the island building's id (econ, store, triage, fifa, fine, wh). Opening the page
   counts as visiting that project. Pages on this origin share localStorage with the portfolio, so the
   tour sees visits however people arrive. Leave data-project off for archived projects. */
(() => {
  const PORTFOLIO = "https://lekanlawal1.github.io/portfolio-site/";
  const TOUR = ["fine", "econ", "wh", "store", "triage", "fifa"];
  const CARD = { fine: "fine-print", econ: "economy", wh: "discrepancy", store: "superstore", triage: "triage", fifa: "football" };
  const me = document.currentScript;
  const project = me && me.dataset.project;
  const base = (me && me.dataset.portfolio) || PORTFOLIO;   // a relative path when served from the portfolio itself

  let visited = [];
  try { visited = JSON.parse(localStorage.getItem("town-visited") || "[]"); } catch { /* private mode */ }
  if (project && TOUR.includes(project) && !visited.includes(project)) {
    visited.push(project);
    try { localStorage.setItem("town-visited", JSON.stringify(visited)); } catch { /* private mode */ }
  }
  const n = TOUR.filter((id) => visited.includes(id)).length;
  const done = n >= TOUR.length;

  const css = `
.pf-strip { position: relative; z-index: 2147483000; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  min-height: 40px; padding: 6px 16px; background: #1D1535; color: #FFF7EA; font: 600 13.5px/1.2 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
.pf-strip a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 5px 10px; }
.pf-strip a:hover, .pf-strip a:focus-visible { background: rgba(255, 247, 234, .14); outline: none; }
.pf-strip .pf-arrow { font-size: 16px; line-height: 1; }
.pf-strip .pf-tour { border: 1.5px solid rgba(255, 247, 234, .35); }
.pf-strip .pf-dots { display: inline-flex; gap: 3px; }
.pf-strip .pf-dots i { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid #FFF7EA; }
.pf-strip .pf-dots i.on { background: #FFC23C; border-color: #FFC23C; }
.pf-strip .pf-tour.done { background: #FFC23C; color: #1D1535; border-color: #FFC23C; }
.pf-strip .pf-tour.done .pf-dots i { border-color: #1D1535; background: #1D1535; }
@media (max-width: 420px) { .pf-strip .pf-label-long { display: none; } }
@media print { .pf-strip { display: none; } }`;
  const style = document.createElement("style");
  style.textContent = css;

  const strip = document.createElement("nav");
  strip.className = "pf-strip";
  strip.setAttribute("aria-label", "Portfolio");
  const back = base + "index.html" + (project ? `#${CARD[project]}` : "#projects");
  strip.innerHTML = `
    <a class="pf-back" href="${back}"><span class="pf-arrow" aria-hidden="true">&larr;</span>Back to <span class="pf-label-long">all </span>projects</a>
    <a class="pf-tour${done ? " done" : ""}" href="${base}index.html#${done ? "reward" : "tour"}"
       aria-label="Island tour: ${n} of ${TOUR.length} projects explored${done ? ", reward unlocked" : ""}">
      <span class="pf-dots" aria-hidden="true">${TOUR.map((_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>
      ${done ? "Reward unlocked" : `Tour ${n}/${TOUR.length}`}
    </a>`;

  const mount = () => { document.head.appendChild(style); document.body.prepend(strip); };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
