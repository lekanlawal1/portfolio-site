// Renders every desk state from the 3D scene into still images plus click areas.
// Run with the dev server up (npx vite --port 5173): node tools/render-shots.cjs [land|port]
// Writes public/shots/<o>-<state>-<width>.webp and src/shots.json. The live site only ever loads these images.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const STATES = ['desk', 'fan', 'mug', 'card', ...Array.from({ length: 8 }, (_, i) => `open-${i}`)];
// phones show the spread desk behind an open file, so they need no open-* shots
const SHAPES = { land: { w: 1440, h: 900, sizes: [1440, 2560] }, port: { w: 390, h: 844, sizes: [780] } };
const only = process.argv[2];
const jsonPath = path.join(ROOT, 'src/shots.json');

(async () => {
  const out = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : {};
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [o, shape] of Object.entries(SHAPES)) {
    if (only && only !== o) continue;
    out[o] = out[o] || {};
    for (const state of STATES) {
      if (o === 'port' && state.startsWith('open')) continue;
      const [s, open] = state.split('-');
      const p = await b.newPage({ viewport: { width: shape.w, height: shape.h } });
      const t = Date.now();
      await p.goto(`http://localhost:5173/render.html?still&s=${s}&open=${open || 0}&o=${o}&dpr=2`);
      await p.waitForFunction(() => window.SHOT, null, { timeout: 240000 });
      await p.waitForTimeout(1200);
      const files = await p.evaluate((sizes) => {
        const src = document.querySelector('canvas');
        return sizes.map((w) => {
          const c = document.createElement('canvas');
          c.width = w; c.height = Math.round(src.height * w / src.width);
          const g = c.getContext('2d');
          g.imageSmoothingQuality = 'high';
          g.drawImage(src, 0, 0, c.width, c.height);
          return [w, c.toDataURL('image/webp', 0.82)];
        });
      }, shape.sizes);
      for (const [w, url] of files) fs.writeFileSync(path.join(ROOT, `public/shots/${o}-${state}-${w}.webp`), Buffer.from(url.split(',')[1], 'base64'));
      out[o][state] = await p.evaluate(() => window.SHOT);
      fs.writeFileSync(jsonPath, JSON.stringify(out, null, 1));
      console.log(o, state, Math.round((Date.now() - t) / 1000) + 's', files.map(([w, u]) => `${w}:${Math.round(u.length * 0.75 / 1024)}KB`).join(' '));
      await p.close();
    }
  }
  await b.close();
})();
