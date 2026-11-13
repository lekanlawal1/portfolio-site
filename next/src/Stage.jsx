import { useEffect, useState } from 'react';
import shots from './shots.json';

// The desk is a set of renders of the 3D scene (tools/render-shots.cjs), not live 3D:
// it loads like a photo and never lags. Each object is a real button laid over its spot in the picture.
const SIZES = { land: { ar: 1440 / 900, widths: [1440, 2560] }, port: { ar: 390 / 844, widths: [780] } };
const url = (o, view, w) => `${import.meta.env.BASE_URL}shots/${o}-${view}-${w}.webp`;
const srcSet = (o, view) => SIZES[o].widths.map((w) => `${url(o, view, w)} ${w}w`).join(', ');
const load = (o, view) => {
  const img = new Image();
  img.sizes = '100vw';
  img.srcset = srcSet(o, view);
  return img.decode().catch(() => {});
};
const union = (rs) => {
  const x0 = Math.min(...rs.map((r) => r[0])), y0 = Math.min(...rs.map((r) => r[1]));
  return [x0, y0, Math.max(...rs.map((r) => r[0] + r[2])) - x0, Math.max(...rs.map((r) => r[1] + r[3])) - y0];
};

// What can be clicked in each state, and what it does.
function spots(view, rects, files) {
  if (!rects) return [];
  const objects = [
    // later entries sit on top: the folio's box includes its pen, which runs under the mug
    ['folio', 'Résumé', 'resume'], ['globe', 'Skills map', 'skills'], ['card', 'Contact', 'card'], ['mug', 'About me', 'mug']
  ].map(([name, label, go]) => ({ key: name, rect: rects[name], label, go }));
  if (view === 'desk') return [{ key: 'pile', rect: union(files.map((_, i) => rects[`file-${i}`])), label: 'Projects', go: 'fan' }, ...objects];
  // Spread files overlap; each one is clickable only on the strip you can see, from its top edge down to
  // where the file in front of it starts. The front file (index 0) keeps its whole area.
  if (view === 'fan') return [...objects, ...files.map((p, i) => {
    const r = rects[`file-${i}`];
    const h = i === 0 ? r[3] : Math.max(3, rects[`file-${i - 1}`][1] - r[1]);
    return { key: p.id, rect: [r[0], r[1], r[2], h], label: p.name, go: `open-${i}` };
  }).reverse()];
  return [];
}

export default function Stage({ view, dim, portrait, files, onGo, onBack, onReady }) {
  const o = portrait ? 'port' : 'land';
  const [shown, setShown] = useState([view, view]); // [underneath, on top]: the top one fades in over the old one

  useEffect(() => {
    let live = true;
    load(o, view).then(() => {
      if (!live) return;
      setShown(([, top]) => [top, view]);
      onReady?.();
    });
    return () => { live = false; };
  }, [view, o]);

  // Quietly fetch only what can be clicked next, so the next step is instant without spending mobile data on the rest.
  useEffect(() => {
    const next = view === 'desk' ? ['fan', 'mug', 'card'] : view === 'fan' ? files.map((_, i) => `open-${i}`) : [];
    const t = setTimeout(() => next.forEach((v) => load(o, v)), 600);
    return () => clearTimeout(t);
  }, [view, o]);

  const [under, top] = shown;
  return (
    <div className={dim ? 'stage dim' : 'stage'} onClick={onBack}>
      <div className="frame" style={{ '--ar': SIZES[o].ar }}>
        {under !== top && <img className="shot" srcSet={srcSet(o, under)} sizes="100vw" alt="" aria-hidden="true" />}
        <img key={top} className="shot top" srcSet={srcSet(o, top)} sizes="100vw" alt="A dark desk in a lit study: a brass nameplate, a gold globe, a pile of project files, a résumé folio, a black mug and a business card stand" />
        {top === view && !dim && spots(view, shots[o][view], files).map((s) => (
          <button key={s.key} type="button" className="spot" aria-label={s.label}
            style={{ left: `${s.rect[0]}%`, top: `${s.rect[1]}%`, width: `${s.rect[2]}%`, height: `${s.rect[3]}%` }}
            onClick={(e) => { e.stopPropagation(); onGo(s.go); }}>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
