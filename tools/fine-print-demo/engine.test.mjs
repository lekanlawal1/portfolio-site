// Checks demos/fine-print/engine.js against the Fine Print app's own Swift tests.
// Run: node tools/fine-print-demo/engine.test.mjs
import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const E = require("../../demos/fine-print/engine.js");
const data = JSON.parse(readFileSync(new URL("../../demos/fine-print/data.json", import.meta.url)));
const [lease, employment] = data.packs;
let failures = 0, passed = 0;
const check = (name, ok, detail = "") => { if (ok) passed++; else { failures++; console.log(`FAIL ${name} ${detail}`); } };

// 1. ruleCases, copied from FinePrintCore/Tests/FinePrintCoreTests/ShippingPacksTests.swift
const L = "residential_lease", EM = "employment";
const ruleCases = [
  ["no-pets-void", L, "pets", {}, "rule_violation"],
  ["acceleration-void", L, "acceleration_clause", {}, "rule_violation"],
  ["security-deposit", L, "security_deposit", { amount: 500 }, "rule_violation"],
  ["rent-deposit-cap", L, "rent_deposit", { amount: 1500, monthly_rent: 1500 }, "rule_compliant"],
  ["rent-deposit-cap", L, "rent_deposit", { amount: 1600, monthly_rent: 1500 }, "rule_violation"],
  ["rent-deposit-cap", L, "rent_deposit", { amount: 1500 }, "needs_human"],
  ["key-deposit-limit", L, "key_deposit", { amount: 50 }, "needs_human"],
  ["key-deposit-limit", L, "key_deposit", { amount: 50, replacement_cost: 50 }, "rule_compliant"],
  ["key-deposit-limit", L, "key_deposit", { amount: 100, replacement_cost: 50 }, "rule_violation"],
  ["nsf-admin-fee", L, "nsf_fee", { amount: 20 }, "rule_compliant"],
  ["nsf-admin-fee", L, "nsf_fee", { amount: 50 }, "rule_violation"],
  ["required-postdated-cheques", L, "post_dated_cheques", {}, "rule_violation"],
  ["entry-notice", L, "landlord_entry", { notice_hours: 24 }, "rule_compliant"],
  ["entry-notice", L, "landlord_entry", { notice_hours: 12 }, "rule_violation"],
  ["entry-notice", L, "landlord_entry", { notice_hours: 0 }, "rule_violation"],
  ["rent-increase-notice", L, "rent_increase", { notice_days: 90 }, "rule_compliant"],
  ["rent-increase-notice", L, "rent_increase", { notice_days: 30 }, "rule_violation"],
  ["rent-increase-frequency", L, "rent_increase", { months_between_increases: 12 }, "rule_compliant"],
  ["rent-increase-frequency", L, "rent_increase", { months_between_increases: 6 }, "rule_violation"],
  ["non-compete-void", EM, "non_compete", {}, "rule_violation"],
  ["vacation-minimum", EM, "vacation", { vacation_weeks: 2 }, "rule_compliant"],
  ["vacation-minimum", EM, "vacation", { vacation_weeks: 1 }, "rule_violation"],
  ["overtime-threshold", EM, "overtime", { overtime_threshold_hours: 44 }, "rule_compliant"],
  ["overtime-threshold", EM, "overtime", { overtime_threshold_hours: 50 }, "rule_violation"],
  ["overtime-rate", EM, "overtime", { overtime_multiplier: 1.5 }, "rule_compliant"],
  ["overtime-rate", EM, "overtime", { overtime_multiplier: 1.0 }, "rule_violation"],
  ["termination-notice-review", EM, "termination", {}, "needs_human"],
];
const tested = new Set();
for (const [rule, doc, type, params, expected] of ruleCases) {
  const pack = doc === L ? lease : employment;
  const clause = { type, start: 0, end: 10, quote: "x", params };
  const f = E.evaluate([clause], doc, [pack], data.heuristics).find((x) => x.id.startsWith(`${pack.id}.${rule}#`));
  tested.add(rule);
  check(`rule ${rule} ${JSON.stringify(params)}`, f && f.tier === expected, `got ${f?.tier}`);
  check(`rule ${rule} has citation`, f && f.citation && f.lastVerified === pack.last_verified);
}
// Same coverage rule as the Swift suite: every shipping rule has a case.
const all = [...lease.rules, ...employment.rules].map((r) => r.id);
check("every shipping rule is tested", all.every((r) => tested.has(r)), all.filter((r) => !tested.has(r)).join(","));

// 2. Scoping and ordering, from RulesAndPipelineTests.swift
const pets = { type: "pets", start: 0, end: 5, quote: "No pets.", params: {} };
check("unknown documents never get legal verdicts",
  JSON.stringify(E.evaluate([pets], "unknown", data.packs, data.heuristics).map((f) => f.tier)) === "[]"
  || E.evaluate([pets], "unknown", data.packs, data.heuristics).every((f) => f.tier === "worth_a_look"));
const nc = { type: "non_compete", start: 0, end: 5, quote: "x", params: {} };
const ncf = E.evaluate([nc], "unknown", data.packs, data.heuristics);
check("heuristics carry no citation", ncf.length === 1 && ncf[0].tier === "worth_a_look" && ncf[0].citation === null);

// 3. LabelGuard: the trap and the negations document
const g = (type, text) => E.checkLabel(type, text).kind;
check("pets are welcome is contradicted", g("pets", "Pets are welcome. The Tenant may keep cats and dogs in the unit.") === "contradicted");
check("no pets is consistent", g("pets", "No pets of any kind are permitted in the unit or the building.") === "consistent");
check("'no pets are allowed' is not read as allowing pets", g("pets", "No pets are allowed.") === "consistent");
check("no damage deposit is contradicted", g("security_deposit", "No damage deposit or security deposit will be required for this tenancy.") === "contradicted");
check("optional cheques are contradicted", g("post_dated_cheques", "Post-dated cheques are optional.") === "contradicted");
check("rent deposit labelled security is unsupported", g("security_deposit", "The Tenant shall pay a rent deposit of $1,800, to be applied to the last month.") === "unsupported");
check("normaliser drops hyphens", E.normalize("Post-dated  cheques") === "postdated cheques");

// 4. Every hand-labelled clause in the demo passes LabelGuard (they are correct labels)
for (const d of data.documents) for (const c of d.clauses) {
  check(`label ok: ${d.id} ${c.type}`, g(c.type, c.quote) === "consistent", g(c.type, c.quote));
}
// 5. The trap: guard off gives the wrong void verdict, guard on drops it
const trap = data.trap;
const off = E.evaluate(E.guardLabels(trap.clauses, false).kept, trap.document_type, data.packs, data.heuristics);
const on = E.guardLabels(trap.clauses, true);
check("trap without guard: wrong 'void' verdict appears", off.some((f) => f.clause.type === "pets" && f.tier === "rule_violation"));
check("trap with guard: pets clause dropped", on.dropped.length === 1 && on.dropped[0].clause.type === "pets");

console.log(`${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
