import { useEffect } from 'react';
import { projects, RESUME } from './projects.js';

const EMAIL = 'lekan1553@gmail.com';
// Skill -> the projects that use it, in the order skills first appear.
const skills = [...new Set(projects.flatMap((p) => p.skills))]
  .map((s) => [s, projects.filter((p) => p.skills.includes(s))]);

// The paper version of the desk: no 3D, loads in a blink, and is what search engines and screen readers get.
export default function List({ target }) {
  useEffect(() => {
    const el = target && document.getElementById(target);
    (el || document.querySelector('.list')).scrollIntoView?.({ block: 'start' });
  }, [target]);

  return (
    <main className="list">
      <header className="list-head">
        <h1 className="plate-name">Lekan Lawal</h1>
        <p className="plate-role">Data, BI and AI. Canada</p>
        <p className="list-intro">Eight tools that check their own work. Under every number is how it was measured, and where you can check it yourself.</p>
        <p className="list-links">
          <a className="ink" href={RESUME}>Résumé PDF</a>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <a href="https://www.linkedin.com/in/lekan-lawal/">LinkedIn</a>
          <a href="https://github.com/lekanlawal1">GitHub</a>
        </p>
      </header>

      <ol className="files">
        {projects.map((p, i) => (
          <li key={p.id} id={p.id}>
            <article aria-labelledby={`t-${p.id}`}>
              <p className="typed">File {i + 1} of 8, {p.kind}</p>
              <h2 id={`t-${p.id}`}>{p.name}</h2>
              <p>{p.line}</p>
              <p className="proof"><span className="num">{p.num}</span> <span>{p.cap}</span></p>
              <details>
                <summary>How I know</summary>
                <p>{p.receipt}</p>
                <p className="links">{p.see.map(([t, u]) => <a key={u} href={u}>{t}</a>)}</p>
              </details>
              <div className="actions">
                <a className="ink" href={p.live[1]}>{p.live[0]}</a>
                {p.study && <a href={p.study}>Case study</a>}
                {p.download ? <a href={p.download} download>Download the workbook</a> : <a href={p.source}>Source</a>}
              </div>
              <p className="typed skills">{p.skills.join(', ')}</p>
            </article>
          </li>
        ))}
      </ol>

      <section id="skills" className="skill-map" aria-labelledby="skills-title">
        <h2 id="skills-title">Skills, and where I used them</h2>
        <dl>
          {skills.map(([s, ps]) => (
            <div key={s}>
              <dt>{s}</dt>
              <dd>{ps.map((p, k) => <span key={p.id}>{k > 0 && ', '}<a href={`#${p.id}`}>{p.name}</a></span>)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="list-foot">
        <p>Email is the quickest way to reach me: <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
        <p><a href="#">Back to the desk</a></p>
      </footer>
    </main>
  );
}
