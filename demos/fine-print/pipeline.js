/* Fine Print's reading pipeline for a document you paste, ported from the app's Swift code:
     FinePrintCore/Sources/FinePrintCore/Analyzer.swift      (classify -> chunk -> extract -> VERIFY -> dedupe)
     FinePrintCore/Sources/FinePrintCore/Chunker.swift       (split on clause boundaries)
     FinePrintCore/Sources/FinePrintCore/QuoteVerifier.swift (a quote must exist in the document)
     FinePrintCore/Sources/FinePrintCore/TextNormalizer.swift (with the map back to the original text)

   Only two steps leave the browser: classifying the document and tagging clauses in each section.
   Both go to a small Cloudflare Worker that holds the Gemini key (window.FINE_PRINT_API). Every
   check after that runs here, and verdicts come from FinePrintEngine (engine.js), never from the AI. */

const FinePrintPipeline = (() => {
  const E = FinePrintEngine;
  const TYPE_THRESHOLD = 0.6;        // Analyzer.typeConfidenceThreshold
  const MIN_QUOTE = 15;              // QuoteVerifier.minimumCharacters
  // GeminiExtractor's budget: 24,000 tokens of context, 2,000 for instructions, 8,000 for the answer,
  // at a pessimistic 3 characters per token (ConservativeTokenEstimator).
  const CHUNK_TOKENS = 24_000 - 2_000 - 8_000;
  const tokens = (n) => Math.ceil(n / 3);

  // ---------------------------------------------------------------- TextNormalizer, with the map
  // Same folding as engine.js's normalize(), but every output character remembers the index (in
  // the original string) it came from, so a matched quote can be highlighted in the untouched text.
  const HYPHENS = new Set(["-", "‐", "‑", "‒", "–", "—", "−", "­"]);
  const FOLD = { "‘": "'", "’": "'", "‚": "'", "′": "'", "`": "'", "“": "\"", "”": "\"",
    "„": "\"", "″": "\"", "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "…": "..." };
  const isSpace = (c) => /\s/.test(c);
  const isNewline = (c) => c === "\n" || c === "\r";
  const isLower = (c) => c !== c.toUpperCase() && c === c.toLowerCase();

  function normalizeMapped(text) {
    let out = "";
    const map = [];
    let lastWasSpace = true;
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (HYPHENS.has(c)) {
        let j = i + 1;
        while (j < text.length && (text[j] === " " || text[j] === "\t")) j++;
        if (j < text.length && isNewline(text[j])) {
          let k = j + 1;
          while (k < text.length && isSpace(text[k])) k++;
          if (k < text.length && isLower(text[k])) { i = k; continue; }
        }
        i++;
        continue;
      }
      if (isSpace(c)) {
        if (!lastWasSpace) { out += " "; map.push(i); lastWasSpace = true; }
        i++;
        continue;
      }
      const f = FOLD[c] ?? c.toLowerCase();
      for (const ch of f) { out += ch; map.push(i); }
      lastWasSpace = false;
      i++;
    }
    if (out.endsWith(" ")) { out = out.slice(0, -1); map.pop(); }
    return { chars: out, map };
  }

  // ---------------------------------------------------------------- QuoteVerifier (exact; pasted text is not OCR)
  function verifyQuote(quote, source) {
    const needle = normalizeMapped(quote).chars;
    if (needle.length < MIN_QUOTE) return { ok: false, reason: "the quote was too short to prove anything" };
    const at = source.chars.indexOf(needle);
    if (at < 0) return { ok: false, reason: "the AI's quote isn't in your document word for word" };
    return { ok: true, start: source.map[at], end: source.map[at + needle.length - 1] + 1 };
  }

  // ---------------------------------------------------------------- Chunker
  // "4.", "4.2)", "(a)", "Section 7", "ARTICLE 3", or an ALL-CAPS heading
  function isClauseStart(line) {
    const t = line.replace(/^\s+/, "");
    if (!t) return false;
    if (/\d/.test(t[0])) {
      let k = 0;
      while (k < t.length && (/\d/.test(t[k]) || t[k] === ".")) k++;
      if (t[k] === ")") k++;
      return (t[k - 1] === "." || t[k - 1] === ")") && k < t.length && isSpace(t[k]);
    }
    if (t[0] === "(") return /^\([A-Za-z0-9]{1,3}\)/.test(t);
    if (/^(section|article|clause|schedule) \d/i.test(t)) return true;
    const letters = t.replace(/[^\p{L}]/gu, "");
    return letters.length >= 5 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  }

  function segments(text) {
    const starts = [0];
    for (let i = 0; i < text.length - 1; i++) if (text[i] === "\n") starts.push(i + 1);
    const bounds = [0];
    let prevBlank = false;
    starts.forEach((s, n) => {
      const line = text.slice(s, n + 1 < starts.length ? starts[n + 1] : text.length);
      const blank = !line.trim();
      if (s !== 0 && !blank && (prevBlank || isClauseStart(line))) bounds.push(s);
      prevBlank = blank;
    });
    bounds.push(text.length);
    const out = [];
    for (let i = 0; i + 1 < bounds.length; i++) if (bounds[i] < bounds[i + 1]) out.push([bounds[i], bounds[i + 1]]);
    return out;
  }

  function splitLong(text, [lo, hi], limit) {
    const sentences = [];
    let start = lo;
    for (let i = lo; i < hi; i++) {
      const atEnd = i + 1 === hi;
      if ((".;?!".includes(text[i]) && (atEnd || isSpace(text[i + 1]))) || atEnd) { sentences.push([start, i + 1]); start = i + 1; }
    }
    const out = [];
    const maxChars = Math.max(1, limit * 3);
    for (const [a, b] of sentences) {
      if (tokens(b - a) <= limit) { out.push([a, b]); continue; }
      for (let x = a; x < b; x += maxChars) out.push([x, Math.min(x + maxChars, b)]);
    }
    return out;
  }

  function chunks(text, limit = CHUNK_TOKENS) {
    const pieces = [];
    for (const seg of segments(text)) {
      if (tokens(seg[1] - seg[0]) <= limit) pieces.push(seg);
      else pieces.push(...splitLong(text, seg, limit));
    }
    const result = [];
    let cur = null;
    for (const p of pieces) {
      if (cur && tokens(p[1] - cur[0]) <= limit) cur = [cur[0], p[1]];
      else { if (cur) result.push(cur); cur = p; }
    }
    if (cur) result.push(cur);
    return result.map(([a, b]) => ({ text: text.slice(a, b), offset: a })).filter((c) => c.text.trim());
  }

  // An answer cut off for length means too many clauses for one reply: split near the middle.
  function halves(text) {
    const mid = Math.floor(text.length / 2);
    for (const sep of ["\n\n", "\n", ". "]) {
      const after = text.indexOf(sep, mid), before = text.lastIndexOf(sep, mid);
      const cut = [after, before].filter((x) => x > 0 && x < text.length - 1)
        .sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
      if (cut) return [text.slice(0, cut + sep.length), text.slice(cut + sep.length)];
    }
    return text.length > 1 ? [text.slice(0, mid), text.slice(mid)] : null;
  }

  // ---------------------------------------------------------------- the Worker
  async function call(api, path, body) {
    const res = await fetch(`${api}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `The service returned HTTP ${res.status}`);
    return data;
  }

  async function extract(api, text, documentType, depth = 0) {
    const r = await call(api, "/extract", { chunk: text, documentType });
    if (!r.truncated) return r.clauses;
    const h = depth < 3 && halves(text);
    if (!h) throw new Error("The AI's answer was cut off before it finished");
    return [...await extract(api, h[0], documentType, depth + 1), ...await extract(api, h[1], documentType, depth + 1)];
  }

  // Same type and more than half overlap = the same clause found twice; keep the first.
  function dedupe(clauses) {
    const kept = [];
    for (const c of [...clauses].sort((a, b) => a.start - b.start)) {
      const dup = kept.some((k) => k.type === c.type
        && Math.max(0, Math.min(k.end, c.end) - Math.max(k.start, c.start)) > 0.5 * Math.min(k.end - k.start, c.end - c.start));
      if (!dup) kept.push(c);
    }
    return kept;
  }

  // ---------------------------------------------------------------- Analyzer
  async function analyze(text, api, onProgress = () => {}) {
    const t0 = performance.now();
    onProgress("Working out what kind of document this is...");
    let guess = { type: "unknown", confidence: 0, scopes: null };
    let typeError = null;
    try { guess = await call(api, "/classify", { text }); } catch (err) { typeError = err.message; }
    const documentType = guess.confidence >= TYPE_THRESHOLD ? guess.type : "unknown";
    if (!guess.scopes) throw new Error(typeError || "Couldn't reach the AI service");

    const parts = chunks(text);
    const extracted = [], failed = [];
    for (let i = 0; i < parts.length; i++) {
      onProgress(parts.length > 1 ? `The AI is reading section ${i + 1} of ${parts.length}...` : "The AI is reading and quoting clauses...");
      try { extracted.push(...await extract(api, parts[i].text, documentType)); }
      catch (err) { failed.push({ start: parts[i].offset, end: parts[i].offset + parts[i].text.length, reason: err.message }); }
    }

    onProgress("Checking every quote against your document...");
    const source = normalizeMapped(text);
    const inScope = new Set(guess.scopes[documentType]);
    const verified = [], rejected = [];
    for (const c of extracted) {
      if (!inScope.has(c.type)) { rejected.push({ clause: c, reason: `"${c.type.replaceAll("_", " ")}" doesn't apply to this kind of document` }); continue; }
      const m = verifyQuote(c.quote, source);
      if (!m.ok) { rejected.push({ clause: c, reason: m.reason, quoteFailure: true }); continue; }
      const wording = text.slice(m.start, m.end);
      const label = E.checkLabel(c.type, wording);
      const clause = { type: c.type, start: m.start, end: m.end, quote: wording, params: c.params || {} };
      if (label.kind === "contradicted") { rejected.push({ clause, reason: `the label contradicts the wording: ${label.note}`, label: true }); continue; }
      if (label.kind === "unsupported") clause.labelNote = label.note;
      verified.push(clause);
    }
    return {
      document_type: documentType, typeConfidence: guess.confidence, typeGuess: guess.type, typeError,
      clauses: dedupe(verified), rejected, failed, sections: parts.length,
      seconds: (performance.now() - t0) / 1000,
    };
  }

  // Strip contact details before anything leaves the browser.
  function redact(text) {
    let n = 0;
    const sub = (re, label) => { text = text.replace(re, () => { n++; return label; }); };
    sub(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]");
    sub(/(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]");
    sub(/\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g, "[number]");                       // SIN-shaped
    sub(/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi, "[postal code]");
    return { text, count: n };
  }

  return { analyze, redact, chunks, normalizeMapped, verifyQuote, isClauseStart, halves, dedupe };
})();

if (typeof module !== "undefined") module.exports = FinePrintPipeline;
