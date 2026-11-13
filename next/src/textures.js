import * as THREE from 'three';

// Every surface with print on it is drawn once onto a canvas: real paper, real type, no font loader.
export const SANS = "'Libre Franklin', system-ui, sans-serif";
export const MONO = "'Courier Prime', 'Courier New', monospace";
export const SERIF = "'Libre Caslon Text', Georgia, serif";
export const PEN = "'Nanum Pen Script', cursive";
export const PLATE = "'Archivo Variable', 'Arial Black', sans-serif";
export const GOLD = '#FFB547';

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

function grain(g, w, h, alpha, seed) {
  const r = rng(seed);
  for (let i = 0; i < w * h / 90; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * alpha})`;
    g.fillRect(r() * w, r() * h, 2, 2);
  }
}

function fit(g, text, font, size, max) {
  let s = size;
  do { g.font = font.replace('@', s + 'px'); s -= 2; } while (g.measureText(text).width > max && s > 10);
}

export function woodTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#14110E'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 420; i++) {
      const y = r() * h, a = r() * 0.16, c = 40 + r() * 40;
      g.strokeStyle = `rgba(${c + 20},${c},${c - 15},${a})`;
      g.lineWidth = 0.5 + r() * 2.5;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 160 + i) * 5);
      g.stroke();
    }
  }, 3);
}

export function leatherTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#33261C'; g.fillRect(0, 0, w, h);
    grain(g, w, h, 0.5, 3);
  }, 4);
}

const COVERS = {
  paper: { bg: '#F1ECE2', ink: '#151412', sub: '#6B655B', label: null },
  kraft: { bg: '#B08850', ink: '#151412', sub: '#3E3222', label: '#F1EADA' },
  cream: { bg: '#E3D8C1', ink: '#151412', sub: '#5C5546', label: '#FAF6EC' },
  black: { bg: '#1A1917', ink: GOLD, sub: '#B9A47C', label: null }
};

// The top band is what shows when the files are spread, so name and number live there.
export function coverTex(p, i) {
  const c = COVERS[p.cover];
  return canvasTex(1024, 1352, (g, w, h) => {
    g.fillStyle = c.bg; g.fillRect(0, 0, w, h);
    grain(g, w, h, p.cover === 'black' ? 0.25 : 0.12, 11 + i);
    if (c.label) { g.fillStyle = c.label; g.fillRect(48, 36, w - 96, 170); }
    g.fillStyle = c.ink; g.textBaseline = 'alphabetic';
    fit(g, p.name, `700 @ ${MONO}`, 62, w - 480);
    g.fillText(p.name, 84, 118);
    g.fillStyle = c.sub; g.font = `400 32px ${MONO}`;
    g.fillText(p.kind, 86, 168);
    g.fillStyle = c.ink; g.textAlign = 'right';
    fit(g, p.num, `800 @ ${SANS}`, 120, 300);
    g.fillText(p.num, w - 84, 172);
    g.textAlign = 'left';
    if (p.cover === 'paper') return leasePage(g, w, h, p);
    g.fillStyle = p.cover === 'black' ? '#E9DFC9' : '#20304F'; g.font = `400 64px ${PEN}`;
    g.fillText('file ' + (i + 1) + ' of 8', 90, 300);
    g.strokeStyle = c.sub; g.globalAlpha = 0.5; g.lineWidth = 2;
    g.strokeRect(86, 340, w - 172, 2);
    g.globalAlpha = 1;
    g.fillStyle = c.ink; g.font = `400 46px ${SERIF}`;
    wrap(g, p.cap, 86, 430, w - 172, 62);
  });
}

function wrap(g, text, x, y, max, lh) {
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (g.measureText(t).width > max && line) { g.fillText(line, x, y); line = word; y += lh; } else line = t;
  }
  g.fillText(line, x, y);
}

function leasePage(g, w, h, p) {
  g.fillStyle = '#6B655B'; g.font = `400 30px ${MONO}`;
  g.fillText('Residential lease, Ontario', 86, 290);
  const bar = (y, wd) => { g.fillStyle = '#D6D0C4'; g.fillRect(86, y, wd, 14); };
  [330, 366, 402].forEach((y, k) => bar(y, [820, 760, 690][k]));
  g.fillStyle = 'rgba(255,181,71,.75)'; g.fillRect(80, 432, 500, 58);
  g.fillStyle = '#151412'; g.font = `400 40px ${SERIF}`; g.fillText('No pets of any kind.', 92, 476);
  [520, 556, 592, 628, 664].forEach((y, k) => bar(y, [850, 800, 830, 610, 760][k]));
  g.fillStyle = '#151412'; g.font = `400 340px ${SERIF}`; g.fillText('0', 70, 1010);
  g.font = `400 44px ${SERIF}`;
  wrap(g, p.cap, 86, 1090, w - 172, 56);
  g.save(); g.translate(720, 560); g.rotate(-0.24);
  g.strokeStyle = 'rgba(178,40,32,.85)'; g.lineWidth = 9; g.strokeRect(-150, -52, 300, 104);
  g.fillStyle = 'rgba(178,40,32,.85)'; g.font = `700 56px ${MONO}`; g.textAlign = 'center';
  g.fillText('CHECKED', 0, 18); g.restore();
}

export function tabTex(name) {
  return canvasTex(440, 224, (g, w, h) => {
    g.fillStyle = '#C9963E'; g.fillRect(0, 0, w, h);
    grain(g, w, h, 0.15, name.length);
    g.fillStyle = '#16213A';
    fit(g, name, `400 @ ${PEN}`, 96, w - 140);
    g.fillText(name, 124, 140);
  });
}

export function plateTex() {
  return canvasTex(2048, 480, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, '#7A5520'); lg.addColorStop(0.35, '#E3B866'); lg.addColorStop(0.6, '#B88838'); lg.addColorStop(1, '#6E4B1C');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 1400; i++) { // brushed metal
      g.fillStyle = `rgba(${r() > 0.5 ? '255,240,200' : '60,40,10'},${r() * 0.08})`;
      g.fillRect(0, r() * h, w, 1);
    }
    g.textAlign = 'center';
    // engraved like a real office nameplate: wide grotesk capitals, not a bookish serif
    g.font = `600 150px ${PLATE}`;
    g.fontStretch = 'expanded'; // after font: setting font resets the stretch
    g.letterSpacing = '18px';
    g.fillStyle = 'rgba(255,236,190,.55)'; g.fillText('LEKAN LAWAL', w / 2 + 3, 262);
    g.fillStyle = '#2A1C08'; g.fillText('LEKAN LAWAL', w / 2, 258);
    g.font = `500 46px ${PLATE}`; g.letterSpacing = '16px';
    g.fillStyle = 'rgba(255,236,190,.5)'; g.fillText('DATA, BI AND AI. CANADA', w / 2 + 2, 384);
    g.fillStyle = '#2A1C08'; g.fillText('DATA, BI AND AI. CANADA', w / 2, 382);
  });
}

export function folioTex() {
  return canvasTex(720, 1000, (g, w, h) => {
    g.fillStyle = '#151311'; g.fillRect(0, 0, w, h);
    grain(g, w, h, 0.5, 9);
    g.textAlign = 'center'; g.fillStyle = '#D9A441';
    g.font = `italic 400 92px ${SERIF}`;
    g.fillText('Résumé', w / 2, 480);
    g.font = `400 30px ${SANS}`; g.letterSpacing = '3px';
    g.fillText('Lekan Lawal', w / 2, 540);
  });
}

export function cardTex() {
  return canvasTex(890, 510, (g, w, h) => {
    g.fillStyle = '#EEE8DB'; g.fillRect(0, 0, w, h);
    grain(g, w, h, 0.08, 21);
    g.fillStyle = '#1B1916';
    g.font = `400 58px ${SERIF}`; g.fillText('Lekan Lawal', 58, 112);
    g.fillStyle = '#5E574B'; g.font = `400 26px ${SANS}`;
    g.fillText('Data, BI and AI', 60, 156);
    g.fillStyle = '#1B1916'; g.font = `400 26px ${MONO}`;
    ['lekan1553@gmail.com', 'linkedin.com/in/lekan-lawal', 'github.com/lekanlawal1'].forEach((t, k) => g.fillText(t, 60, 352 + k * 40));
    const foil = g.createLinearGradient(700, 380, 830, 470);
    foil.addColorStop(0, '#8C6424'); foil.addColorStop(0.5, '#F0CB7E'); foil.addColorStop(1, '#9A6E28');
    g.fillStyle = foil; g.font = `italic 400 96px ${SERIF}`; g.textAlign = 'right';
    g.fillText('LL', w - 56, h - 58);
  });
}
