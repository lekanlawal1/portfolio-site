// Checks demos/fine-print/pipeline.js (the "check your own document" path) without calling the AI.
// The AI is replaced by the Fine Print evaluation set's own answer key: for every clause the app's
// test documents contain, the fake AI quotes the full sentence around the answer key's marker, the
// way Gemini does. Then the real pipeline must find every quote in the document, reject invented or
// reworded quotes, and catch the "pets are welcome" mislabel.
// Run: node tools/fine-print-demo/pipeline.test.mjs [path to a fine-print checkout, default ../fine-print]
import { createRequire } from "module";
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
const require = createRequire(import.meta.url);
globalThis.FinePrintEngine = require("../../demos/fine-print/engine.js");
const P = require("../../demos/fine-print/pipeline.js");
let failures = 0, passed = 0;
const check = (name, ok, detail = "") => { if (ok) passed++; else { failures++; console.log(`FAIL ${name} ${detail}`); } };

// ---------------------------------------------------------------- a fake Worker
const ALL = "pets security_deposit rent_deposit key_deposit nsf_fee acceleration_clause post_dated_cheques landlord_entry rent_increase guests non_compete vacation overtime termination auto_renewal unilateral_amendment liability_waiver arbitration indemnity content_license data_sharing cancellation_fee price_increase venue non_disparagement assignment".split(" ");
function fakeWorker({ type = "residential_lease", confidence = 0.95, answer = () => [], truncateOver = Infinity }) {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const ok = (data) => ({ ok: true, status: 200, json: async () => data });
    if (url.endsWith("/classify")) return ok({ type, confidence, scopes: Object.fromEntries(["residential_lease", "employment", "subscription_terms", "unknown"].map((t) => [t, ALL])) });
    if (body.chunk.length > truncateOver) return ok({ truncated: true });
    return ok({ clauses: answer(body.chunk) });
  };
}
globalThis.performance ??= { now: () => Date.now() };

// The sentence around a marker, as an AI would quote it.
function sentenceAround(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) return null;
  let a = at, b = at + marker.length;
  while (a > 0 && !/[.\n]/.test(text[a - 1])) a--;
  while (b < text.length && !/[.\n]/.test(text[b])) b++;
  return text.slice(a, Math.min(text.length, b + 1)).trim();
}

// ---------------------------------------------------------------- 1. the app's evaluation documents
const repo = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../fine-print");
const corpus = path.join(repo, "Eval/corpus");
if (!existsSync(corpus)) {
  console.log(`(skipping the corpus check: no fine-print checkout at ${repo})`);
} else {
  for (const f of readdirSync(corpus).filter((n) => n.endsWith(".truth.json")).sort()) {
    const truth = JSON.parse(readFileSync(path.join(corpus, f)));
    if (truth.source && truth.source !== "text") continue;   // OCR documents use fuzzy matching in the app
    const text = readFileSync(path.join(corpus, f.replace(".truth.json", ".txt")), "utf8");
    const expected = (truth.expected || []).filter((e) => text.includes(e.marker));
    fakeWorker({ type: truth.document_type, answer: (chunk) => expected
      .filter((e) => chunk.includes(e.marker))
      .map((e) => ({ type: e.type, quote: sentenceAround(chunk, e.marker), params: e.params || {} })) });
    const r = await P.analyze(text, "https://fake");
    for (const e of expected) {
      const hit = r.clauses.find((c) => c.type === e.type && text.slice(c.start, c.end).includes(e.marker));
      // a clause the label check rightly rejects (e.g. "pets are welcome" tagged as a pet ban) is not a miss
      const rejectedByLabel = r.rejected.some((x) => x.label && x.clause.type === e.type);
      check(`${f}: ${e.type} found at the right place`, hit || rejectedByLabel, `marker "${e.marker}"`);
    }
    check(`${f}: no true quote rejected as missing`, !r.rejected.some((x) => x.quoteFailure),
      JSON.stringify(r.rejected.filter((x) => x.quoteFailure).map((x) => x.clause.quote)));
  }
}

// ---------------------------------------------------------------- 2. invented, reworded and mislabelled clauses
const lease = "1. Rent\nThe Tenant shall pay rent of $1,500 on the first day of each month.\n\n2. Pets\nPets are welcome. The Tenant may keep cats and dogs.\n\n3. Entry\nThe Landlord may enter the unit at any time without notice.\n";
fakeWorker({ answer: () => [
  { type: "security_deposit", quote: "The Tenant shall pay a damage deposit of $500 before moving in.", params: { amount: 500 } },  // invented
  { type: "landlord_entry", quote: "The Landlord can enter the unit whenever they want without notice.", params: { notice_hours: 0 } }, // reworded
  { type: "pets", quote: "Pets are welcome. The Tenant may keep cats and dogs.", params: {} },                                 // mislabelled
  { type: "landlord_entry", quote: "The Landlord may enter the unit at any time without notice.", params: { notice_hours: 0 } },   // true
] });
{
  const r = await P.analyze(lease, "https://fake");
  check("invented clause rejected", r.rejected.some((x) => x.quoteFailure && x.clause.type === "security_deposit"));
  check("reworded quote rejected", r.rejected.some((x) => x.quoteFailure && x.clause.quote.startsWith("The Landlord can")));
  check("pets-are-welcome mislabel rejected by the label check", r.rejected.some((x) => x.label && x.clause.type === "pets"));
  check("true clause kept with its exact position", r.clauses.length === 1
    && lease.slice(r.clauses[0].start, r.clauses[0].end) === "The Landlord may enter the unit at any time without notice.");
  const findings = FinePrintEngine.evaluate(r.clauses, r.document_type, JSON.parse(readFileSync(new URL("../../demos/fine-print/data.json", import.meta.url))).packs, []);
  check("entry without notice is judged by the cited rule", findings.some((f) => f.tier === "rule_violation"));
}

// ---------------------------------------------------------------- 3. quotes survive what models do to text
{
  const src = P.normalizeMapped("The tenant’s self-\ncontained unit is “furnished”.\nRent is due monthly.");
  const m = P.verifyQuote("The tenant's selfcontained unit is \"furnished\".", src);
  check("curly quotes, hyphenation and line breaks still match", m.ok);
  check("short quotes prove nothing", !P.verifyQuote("pets", src).ok);
}

// ---------------------------------------------------------------- 4. chunking, ported from ChunkerTests.swift
{
  const doc = Array.from({ length: 40 }, (_, i) => `${i + 1}. The Tenant agrees to clause number ${i + 1}, which has some ordinary wording in it.\n`).join("");
  const parts = P.chunks(doc, 200);
  check("splits a long document", parts.length > 1);
  check("covers the whole document, in order", parts.map((c) => c.text).join("") === doc && parts[0].offset === 0);
  check("every part starts at a numbered clause", parts.every((c) => /^\d/.test(c.text)));
  check("every part fits the budget", parts.every((c) => Math.ceil(c.text.length / 3) <= 200));
  const giant = "1. " + "This sentence is part of one enormous clause. ".repeat(80);
  const g = P.chunks(giant, 200);
  check("an oversized clause splits at sentences", g.length > 1 && g.map((c) => c.text).join("") === giant);
  for (const [line, want] of [["4. Rent", true], ["4.2) Deposit", true], ["(a) Pets", true], ["Section 7 Entry", true],
    ["ARTICLE 3", true], ["TERMS AND CONDITIONS", true], ["2026 budget review", false], ["$1,500 deposit", false], ["The tenant agrees", false]]) {
    check(`clause start: "${line}"`, P.isClauseStart(line) === want);
  }
}

// ---------------------------------------------------------------- 5. a cut-off answer is split and retried
{
  const doc = "1. Pets\nNo pets of any kind are permitted in the unit.\n\n2. Guests\nGuests may not stay overnight more than twice a month.\n";
  fakeWorker({ truncateOver: 60, answer: (chunk) => [
    ...(chunk.includes("No pets") ? [{ type: "pets", quote: "No pets of any kind are permitted in the unit.", params: {} }] : []),
    ...(chunk.includes("Guests may") ? [{ type: "guests", quote: "Guests may not stay overnight more than twice a month.", params: {} }] : []),
  ] });
  const r = await P.analyze(doc, "https://fake");
  check("truncated answers are split until they fit", r.clauses.length === 2 && !r.failed.length, JSON.stringify(r.failed));
}

// ---------------------------------------------------------------- 6. contact details stay in the browser
{
  const { text, count } = P.redact("Call 289-555-0134 or write to jane.doe@example.com. Unit at M5V 2T6. SIN 123 456 789.");
  check("emails, phone numbers, postal codes and SIN-shaped numbers are removed", count === 4 && !/\d{3}-\d{4}|@|M5V|456/.test(text), text);
  check("money amounts are left alone", P.redact("Rent is $1,800 per month and the deposit is $1,800.").count === 0);
}

console.log(`${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
