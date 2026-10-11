/* Fine Print demo: the text of a PDF, read in the browser with pdf.js (vendor/pdfjs, 4.10.38).
   Nothing is uploaded here; the text goes into the box so the person can read it, take out names,
   and only then send it.

   pdf.js gives pieces of text with their positions. They're put back into lines (same baseline),
   lines into paragraphs (a bigger gap than usual between lines starts a new one), page numbers and
   lines repeated at the top or bottom of most pages (headers, footers) are dropped, and words split
   with a hyphen at the end of a line are joined. The line-building is pure, so tests run it in Node. */

const FinePrintPdf = (() => {
  // items: [{ page, s, x, y, w, h }] -> plain text with blank lines between paragraphs
  function textFromItems(items) {
    const pages = new Map();
    for (const it of items) {
      if (!it.s || !it.s.trim()) continue;
      if (!pages.has(it.page)) pages.set(it.page, []);
      pages.get(it.page).push(it);
    }
    // each page: lines top to bottom, each line its pieces left to right
    const perPage = [...pages.keys()].sort((a, b) => a - b).map((p) => {
      const rows = [];
      for (const it of pages.get(p).sort((a, b) => b.y - a.y || a.x - b.x)) {
        const row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(2, (it.h || 10) * 0.35));
        if (row) row.items.push(it); else rows.push({ y: it.y, h: it.h || 10, items: [it] });
      }
      return rows.sort((a, b) => b.y - a.y).map((r) => {
        let s = "", end = null;
        for (const it of r.items.sort((a, b) => a.x - b.x)) {
          const gap = end == null ? 0 : it.x - end;
          s += (end != null && gap > 1 && !s.endsWith(" ") && !it.s.startsWith(" ") ? " " : "") + it.s;
          end = it.x + (it.w || 0);
        }
        return { y: r.y, h: r.h, s: s.replace(/\s+/g, " ").trim() };
      }).filter((l) => l.s);
    });
    // headers and footers: one of the top two or bottom two lines of a page, repeated on most pages
    const norm = (s) => s.replace(/\d+/g, "#").toLowerCase();
    const edge = new Map();
    const edges = (lines) => [...new Set([0, 1, lines.length - 2, lines.length - 1].filter((i) => i >= 0 && i < lines.length))];
    for (const lines of perPage) for (const k of new Set(edges(lines).map((i) => norm(lines[i].s)))) edge.set(k, (edge.get(k) || 0) + 1);
    const repeated = (s) => perPage.length >= 2 && (edge.get(norm(s)) || 0) >= Math.max(2, Math.ceil(perPage.length * 0.6));
    const pageNumber = (s) => /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(s) || /^-\s*\d+\s*-$/.test(s);

    const paras = [];
    let cur = "";
    for (const lines of perPage) {
      const atEdge = new Set(edges(lines));
      const kept = lines.filter((l, i) => !pageNumber(l.s) && !(atEdge.has(i) && repeated(l.s)));
      // a normal line step on this page, to tell a new paragraph from the next line
      const steps = kept.slice(1).map((l, i) => kept[i].y - l.y).filter((d) => d > 0).sort((a, b) => a - b);
      const step = steps.length ? steps[Math.floor((steps.length - 1) / 2)] : 14;   // the lower middle: few lines, big gaps
      kept.forEach((l, i) => {
        const gap = i ? kept[i - 1].y - l.y : 0;
        const newPara = i > 0 && gap > step * 1.45;
        const heading = /^(\d+(\.\d+)*[.)]?|[A-Z]\.|\([a-z0-9]+\))\s/.test(l.s) || /^[A-Z0-9 ,&'-]{4,}$/.test(l.s);
        if (cur && (newPara || (i === 0 && /[.:;]$/.test(cur)) || heading)) { paras.push(cur); cur = ""; }
        if (!cur) cur = l.s;
        else if (/[A-Za-z]-$/.test(cur) && /^[a-z]/.test(l.s)) cur = cur.slice(0, -1) + l.s;   // "ten-" + "ant"
        else cur += " " + l.s;
      });
    }
    if (cur) paras.push(cur);
    return paras.join("\n\n");
  }

  let lib = null;
  async function pdfjs() {
    if (lib) return lib;
    lib = await import(new URL("vendor/pdfjs/pdf.min.mjs", document.baseURI).href);
    lib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/pdf.worker.min.mjs", document.baseURI).href;
    return lib;
  }
  async function textFromPdf(buffer) {
    const pdf = await (await pdfjs()).getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
    if (pdf.numPages > 80) throw new Error("That PDF has more than 80 pages, which is longer than the checker can read.");
    const items = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      for (const it of tc.items) if (it.str) items.push({ page: p, s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) });
    }
    const pages = pdf.numPages;
    pdf.destroy();
    return { text: textFromItems(items), pages };
  }

  return { textFromItems, textFromPdf };
})();

if (typeof module !== "undefined") module.exports = FinePrintPdf;
