/* The warp: the one transition used across the portfolio and every project it links to.
   Leaving, the page dims while amber particles stream in and close into a small ring with a label
   ("Stop 4 of 8 · The Gaffer"). Arriving, the next page starts on that same ring, which bursts outward
   as the page fades in. Between pages on this site the browser's own cross-page transition (where
   supported) bridges the two, so it reads as one movement.

   Load it early and without defer, so an arriving page can stay covered until the reveal plays:
     <script src="https://lekanlawal1.github.io/portfolio-site/warp.js"></script>
   API: PFWarp.out(target, { label })  target is a URL or a function (an in-page jump)
        PFWarp.in({ label })            plays the reveal (runs by itself on arrival) */
(() => {
  if (window.PFWarp) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEY = "pf-warp";
  const root = document.documentElement;
  let arriving = null;
  try { arriving = JSON.parse(sessionStorage.getItem(KEY) || "null"); sessionStorage.removeItem(KEY); } catch {}

  const style = document.createElement("style");
  style.textContent = `
@view-transition { navigation: auto; }
html.pf-in { background: #0E0D0C !important; }
html.pf-in body { visibility: hidden; }
.pf-warp { position: fixed; inset: 0; z-index: 2147483600; pointer-events: auto; }
.pf-warp canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.pf-warp .pf-wl { position: absolute; left: 50%; top: calc(50% + 70px); translate: -50% 0; width: max-content; max-width: 86vw; text-align: center;
  font: 600 12px/1.5 "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .14em; text-transform: uppercase; color: #FFB547; opacity: 0; }
.pf-warp .pf-wl b { display: block; margin-top: 6px; font: 500 26px/1.1 "Inter Tight", "Inter", system-ui, sans-serif; letter-spacing: -.02em; text-transform: none; color: #F2EEE7; }`;
  (document.head || root).appendChild(style);
  if (arriving && !reduce) {
    root.classList.add("pf-in");
    setTimeout(() => root.classList.remove("pf-in"), 3000);   // never leave a page hidden
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out3 = (t) => 1 - Math.pow(1 - t, 3);
  const clamp = (v) => Math.max(0, Math.min(1, v));

  function stage(label) {
    const el = document.createElement("div");
    el.className = "pf-warp"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<canvas></canvas><div class="pf-wl"></div>`;
    if (label) {
      const [top, big] = String(label).split("|");
      el.querySelector(".pf-wl").textContent = top;
      if (big) { const b = document.createElement("b"); b.textContent = big; el.querySelector(".pf-wl").appendChild(b); }
    }
    document.body.appendChild(el);
    const cv = el.querySelector("canvas"), dpr = Math.min(devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = W < 600 ? 150 : 240, cx = W / 2, cy = H / 2, R = W < 600 ? 34 : 42;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { sx: Math.random() * W, sy: Math.random() * H, a, r: R + (Math.random() - 0.5) * 10, d: Math.random() * 0.3, s: 0.8 + Math.random() * 1.4,
        fx: cx + Math.cos(Math.random() * 7) * (Math.max(W, H) * (0.55 + Math.random() * 0.4)), fy: cy + Math.sin(Math.random() * 7) * (Math.max(W, H) * (0.55 + Math.random() * 0.4)) };
    });
    return { el, ctx, W, H, cx, cy, pts, label: el.querySelector(".pf-wl") };
  }
  function dot(ctx, x, y, s, a) {
    ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
  }

  let busy = false;
  function out(target, opts = {}) {
    const go = () => {
      try { sessionStorage.setItem(KEY, JSON.stringify({ label: opts.label || "" })); } catch {}
      location.href = target;
    };
    if (reduce || busy || !document.body) {
      if (typeof target === "function") { target(); return; }
      location.href = target; return;
    }
    busy = true;
    const S = stage(opts.label), T = 640, t0 = performance.now();
    let done = false;
    const finish = () => { if (done) return; done = true; if (typeof target === "function") { target(); S.el.remove(); busy = false; play(opts); } else go(); };
    S.el.addEventListener("pointerdown", finish);
    const tick = (now) => {
      if (done) return;
      const t = clamp((now - t0) / T), { ctx, W, H, cx, cy } = S;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1; ctx.fillStyle = `rgba(14,13,12,${ease(clamp(t / 0.8)).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "#FFB547";
      for (const p of S.pts) {
        const e = ease(clamp((t - p.d) / (1 - p.d))), sw = (1 - e) * 1.3;
        const tx = cx + Math.cos(p.a + sw + t * 0.6) * p.r, ty = cy + Math.sin(p.a + sw + t * 0.6) * p.r;
        dot(ctx, p.sx + (tx - p.sx) * e, p.sy + (ty - p.sy) * e, p.s, 0.35 + 0.6 * e);
      }
      ctx.globalCompositeOperation = "source-over";
      S.label.style.opacity = clamp((t - 0.45) / 0.4).toFixed(3);
      if (t < 1) requestAnimationFrame(tick); else setTimeout(finish, 90);
    };
    requestAnimationFrame(tick);
  }

  // the reveal: the ring the last page closed on bursts outward while the page fades in
  function play(opts = {}) {
    root.classList.remove("pf-in");
    if (reduce || !document.body) return;
    const S = stage(opts.label), T = 820, t0 = performance.now();
    S.el.style.pointerEvents = "none";
    S.label.style.opacity = "1";
    const tick = (now) => {
      const t = clamp((now - t0) / T), { ctx, W, H, cx, cy } = S;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1; ctx.fillStyle = `rgba(14,13,12,${(1 - out3(clamp((t - 0.12) / 0.75))).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "#FFB547";
      for (const p of S.pts) {
        const e = out3(clamp((t - p.d * 0.4) / 0.85));
        const x0 = cx + Math.cos(p.a + 0.6) * p.r, y0 = cy + Math.sin(p.a + 0.6) * p.r;
        dot(ctx, x0 + (p.fx - x0) * e, y0 + (p.fy - y0) * e, p.s * (1 - e * 0.4), (1 - e) * 0.95);
      }
      ctx.globalCompositeOperation = "source-over";
      S.label.style.opacity = (1 - clamp(t / 0.35)).toFixed(3);
      S.label.style.transform = `translateY(${(-clamp(t / 0.35) * 10).toFixed(1)}px)`;
      if (t < 1) requestAnimationFrame(tick); else S.el.remove();
    };
    requestAnimationFrame(tick);
  }

  window.PFWarp = { out, in: play, arriving, reduce };
  // arriving by warp: play the reveal as soon as there's a page to reveal
  if (arriving) {
    const start = () => play(arriving);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
  }
  // coming back with the browser's back button restores the old page as it was: clear any cover
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    root.classList.remove("pf-in"); busy = false;
    document.querySelectorAll(".pf-warp").forEach((el) => el.remove());
  });
})();
