import { lazy, Suspense, useEffect, useState } from 'react';
// The 3D desk is the heavy part; the nav, hints and panels paint first and the scene streams in after.
const Scene = lazy(() => import('./Scene.jsx'));
// The loader and its 9-second 'slow connection' timer live in index.html so they work before any script arrives.
const loader = () => document.getElementById('loader');
let drawn = false;
const lift = () => { clearTimeout(window.loaderSlow); loader()?.classList.add('done'); };
import { projects, RESUME } from './projects.js';
import List from './List.jsx';

// #list, #skills and a project id (#economy) show the paper list; anything else is the desk.
const LIST = new Set(['list', 'skills', ...projects.map((p) => p.id)]);
const route = () => location.hash.slice(1);

const q = new URLSearchParams(location.search);
const TOUCH = matchMedia('(pointer: coarse)').matches;
const tap = TOUCH ? 'tap' : 'click';
const back = TOUCH ? 'tap the desk to put it back' : 'Esc puts it back';
const HINT = {
  desk: `${tap} the pile to spread my files out, or pick up the mug`,
  fan: `pick one. ${TOUCH ? 'Tap the desk' : 'Esc'} to stack them again`,
  open: TOUCH ? 'tap the desk to put it back' : 'Esc puts it back, arrows flip to the next one',
  mug: back,
  card: back
};
const isPortrait = () => innerWidth / innerHeight < 0.95;
// Phones, small tablets and low-core machines start on the light renderer; the monitor can still drop a fast device down.
const startQuality = () => q.get('q') || (TOUCH || innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high');

export default function App() {
  const [mode, setMode] = useState(q.get('s') || 'desk');
  const [open, setOpen] = useState(Number(q.get('open') || 0));
  const [portrait, setPortrait] = useState(isPortrait);
  const [quality, setQuality] = useState(startQuality);
  const [hash, setHash] = useState(route);
  const listView = LIST.has(hash);
  const flip = (d) => setOpen((k) => (k + d + 8) % 8);
  const putBack = () => setMode((m) => (m === 'open' ? 'fan' : 'desk'));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') putBack();
      if (mode === 'open' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) flip(e.key === 'ArrowRight' ? 1 : -1);
    };
    const onResize = () => setPortrait(isPortrait());
    const onHash = () => setHash(route());
    addEventListener('keydown', onKey); addEventListener('resize', onResize); addEventListener('hashchange', onHash);
    return () => { removeEventListener('keydown', onKey); removeEventListener('resize', onResize); removeEventListener('hashchange', onHash); };
  }, [mode]);

  // The list needs no 3D, so the loader lifts at once; going back to a desk that has not drawn yet shows it again.
  useEffect(() => {
    if (listView) lift();
    else if (!drawn) loader()?.classList.remove('done');
  }, [listView]);

  if (listView) return <List target={hash} />;

  const p = projects[open];
  const Close = ({ label }) => <button type="button" className="close" onClick={putBack}>{label}</button>;
  return (
    <>
      {/* keyboard and screen-reader way into everything the desk does */}
      <nav className="skip" aria-label="Desk objects">
        <button type="button" onClick={() => setMode('fan')}>Projects</button>
        <button type="button" onClick={() => setMode('mug')}>About me</button>
        <button type="button" onClick={() => setMode('card')}>Contact</button>
        <a href={RESUME}>Résumé PDF</a>
        <a href="#list">List of projects</a>
      </nav>

      <Suspense fallback={null}>
        <Scene mode={mode} open={open} setMode={setMode} setOpen={setOpen} portrait={portrait} quality={quality}
          onDecline={q.get('q') ? null : () => setQuality('low')} putBack={putBack} still={q.has('still')} onReady={() => { drawn = true; lift(); }}
          onObject={(what) => { if (what === 'resume') open(RESUME, '_blank', 'noopener'); else location.hash = 'skills'; }} />
      </Suspense>

      <nav className="nav" aria-label="Main">
        <a href={RESUME}>Résumé</a>
        <a href="#contact" onClick={(e) => { e.preventDefault(); setMode('card'); }}>Contact</a>
        <a href="#list">Just show me a list</a>
      </nav>

      {mode === 'open' && (
        <aside className="sheet right" aria-labelledby="ptitle" key={p.id}>
          <div className="row">
            <p className="typed">File {open + 1} of 8, {p.kind}</p>
            <Close label="Put it back" />
          </div>
          <h2 id="ptitle">{p.name}</h2>
          <p>{p.line}</p>
          <p className="num">{p.num}</p>
          <p>{p.cap}</p>
          <div className="slip"><p className="typed">How I know</p><p>{p.receipt}</p><p className="links">{p.see.map(([t, u]) => <a key={u} href={u}>{t}</a>)}</p></div>
          <div className="video" role="img" aria-label="Placeholder for a 60-second process video">[YOUR 60-SECOND PROCESS VIDEO]</div>
          <div className="actions">
            <a className="ink" href={p.live[1]}>{p.live[0]}</a>
            {p.study && <a href={p.study}>Case study</a>}
            {p.download ? <a href={p.download} download>Download the workbook</a> : <a href={p.source}>Source</a>}
          </div>
          <div className="row pager">
            <button type="button" onClick={() => flip(-1)}>Previous file</button>
            <button type="button" onClick={() => flip(1)}>Next file</button>
          </div>
        </aside>
      )}

      {mode === 'mug' && (
        <aside className="sheet left" aria-labelledby="about">
          <div className="row"><h2 id="about">About me</h2><Close label="Put the mug down" /></div>
          <p>Data, BI and AI, in Canada.</p>
          <p className="todo">[YOUR ABOUT TEXT: three sentences on who you are, how you work, and the role you want next.]</p>
          <p className="todo">[WHAT YOU ARE LOOKING FOR: the role, the city or remote, when you can start.]</p>
          <p className="sign">Lekan</p>
        </aside>
      )}

      {mode === 'card' && (
        <aside className="sheet left" aria-labelledby="contact">
          <div className="row"><h2 id="contact">Get in touch</h2><Close label="Put it back" /></div>
          <p>Email is the quickest way to reach me.</p>
          <div className="actions">
            <button className="ink" type="button" onClick={(e) => { navigator.clipboard?.writeText('lekan1553@gmail.com'); e.currentTarget.textContent = 'Copied'; }}>Copy my email</button>
            <a href="mailto:lekan1553@gmail.com">Write to me</a>
          </div>
          <p className="links"><a href="https://www.linkedin.com/in/lekan-lawal/">LinkedIn</a> <a href="https://github.com/lekanlawal1">GitHub</a> <a href={RESUME}>Résumé PDF</a></p>
        </aside>
      )}

      <p className="hint" aria-hidden="true">{HINT[mode]}</p>
    </>
  );
}
