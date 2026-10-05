/* Fine Print's verdict logic, ported line for line from the app's Swift code:
     FinePrintCore/Sources/FinePrintCore/RuleEngine.swift   (rules -> findings)
     FinePrintCore/Sources/FinePrintCore/LabelGuard.swift   (does the wording support the label?)
     FinePrintCore/Sources/FinePrintCore/TextNormalizer.swift (normalisation used by LabelGuard)
   https://github.com/lekanlawal1/fine-print

   Like the Swift original it is pure and deterministic: the same clauses and rule packs always
   give the same verdicts, and no AI is involved at this stage. Tested against the app's own
   rule cases in tools/fine-print-demo/engine.test.mjs. */

const FinePrintEngine = (() => {
  // ---------------------------------------------------------------- TextNormalizer
  const HYPHENS = new Set(["-", "‐", "‑", "‒", "\u2013", "\u2014", "−", "­"]);
  function fold(c) {
    switch (c) {
      case "‘": case "’": case "‚": case "′": case "`": return "'";
      case "\u201C": case "\u201D": case "„": case "″": return "\"";
      case "ﬀ": return "ff";
      case "ﬁ": return "fi";
      case "ﬂ": return "fl";
      case "…": return "...";
      default: return c.toLowerCase();
    }
  }
  const isSpace = (c) => /\s/.test(c);
  const isLower = (c) => c !== c.toUpperCase() && c === c.toLowerCase();

  function normalize(text) {
    const src = Array.from(text);
    let out = "";
    let lastWasSpace = true; // also trims leading whitespace
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (HYPHENS.has(c)) {
        // Line-break hyphenation ("rent-\nal") is joined with no space.
        let j = i + 1;
        while (j < src.length && (src[j] === " " || src[j] === "\t")) j++;
        if (j < src.length && (src[j] === "\n" || src[j] === "\r")) {
          let k = j + 1;
          while (k < src.length && isSpace(src[k])) k++;
          if (k < src.length && isLower(src[k])) { i = k; continue; }
        }
        i++; // every other hyphen or dash is dropped
        continue;
      }
      if (isSpace(c)) {
        if (!lastWasSpace) { out += " "; lastWasSpace = true; }
        i++;
        continue;
      }
      out += fold(c);
      lastWasSpace = false;
      i++;
    }
    return out.endsWith(" ") ? out.slice(0, -1) : out;
  }

  // ---------------------------------------------------------------- LabelGuard
  // Patterns are matched against NORMALIZED text, so "post-dated" is written "postdated".
  const LABEL_RULES = {
    pets: { topic: ["pet", "animal", "dog", "cat", "bird", "fish"],
      opposite: ["pets are welcome", "animals are welcome", "may keep", "pets are permitted",
        "pets are allowed", "permitted to keep", "allowed to keep"],
      imposes: ["no ", "not ", "prohibit", "forbid", "without"] },
    security_deposit: { topic: ["deposit"],
      opposite: ["no damage deposit", "no security deposit", "no deposit", "not be required",
        "not required", "waived"],
      otherConcept: ["rent deposit", "last month", "applied to the rent", "applied to rent",
        "key", "fob", "access card", "remote"],
      imposes: ["pay", "payable", "provide", "required", "collect"] },
    rent_deposit: { topic: ["deposit", "last month"], opposite: ["no rent deposit", "no deposit"] },
    key_deposit: { topic: ["key", "fob", "card", "remote"], opposite: ["no key deposit", "no deposit"],
      imposes: ["deposit"] },
    nsf_fee: { topic: ["nsf", "returned", "bounced", "dishonour", "dishonor", "insufficient"],
      opposite: ["will not charge", "not charge any", "no fee", "no charge", "free of charge"],
      imposes: ["fee", "charge", "cost", "penalty"] },
    acceleration_clause: { topic: ["remainder", "remaining", "balance", "become due", "becomes due",
      "immediately due", "accelerat"] },
    post_dated_cheques: { topic: ["postdated", "preauthorized", "preauthorised", "automatic", "debit",
      "autopay", "credit card", "cheque"],
      opposite: ["optional", "may pay", "choice", "prefer", "option", "if the tenant wishes"],
      imposes: ["must", "shall", "required", "condition"] },
    landlord_entry: { topic: ["enter", "entry", "access"] },
    rent_increase: { topic: ["increase", "raise"] },
    non_compete: { topic: ["compet", "rival"] },
    vacation: { topic: ["vacation", "holiday", "paid time off", "pto", "days off"] },
    overtime: { topic: ["overtime", "over 44", "hours worked over", "in excess", "beyond",
      "time and a half", "one and onehalf"] },
  };

  /* True if `phrase` occurs without "no "/"not " immediately before it
     ("no pets are allowed" must not count as "pets are allowed"). */
  function containsUnnegated(text, phrase) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(phrase, from);
      if (at < 0) return false;
      const before = text.slice(Math.max(0, at - 5), at);
      if (!before.endsWith("no ") && !before.endsWith("not ")) return true;
      from = at + phrase.length;
    }
  }

  /* -> { kind: "consistent" } | { kind: "unsupported", note } | { kind: "contradicted", note } */
  function checkLabel(type, text) {
    const rule = LABEL_RULES[type];
    if (!rule) return { kind: "consistent" }; // no rule-backed verdicts for this type
    const t = normalize(text);
    const name = type.replaceAll("_", " ");
    const has = (p) => t.includes(p);
    if (rule.topic?.length && !rule.topic.some(has))
      return { kind: "unsupported", note: `its wording doesn't mention anything about ${name}` };
    const opp = (rule.opposite || []).find((p) => containsUnnegated(t, p));
    if (opp)
      return { kind: "contradicted", note: `the wording says "${opp}", which is the opposite of a ${name} restriction` };
    const other = (rule.otherConcept || []).find(has);
    if (other) return { kind: "unsupported", note: `its wording ("${other}") suggests a different kind of clause` };
    if (rule.imposes?.length && !rule.imposes.some(has))
      return { kind: "unsupported", note: `its wording doesn't clearly impose a ${name} term` };
    return { kind: "consistent" };
  }

  // ---------------------------------------------------------------- RuleEngine
  function evaluateCheck(check, p) {
    switch (check.kind) {
      case "present": return { kind: "violated" };
      case "review": return { kind: "review" };
      case "max_ratio": {
        const a = p[check.param], b = p[check.of_param];
        if (a != null && b != null && b > 0) return { kind: a / b <= check.limit ? "compliant" : "violated" };
        return { kind: "missing", names: [check.param, check.of_param].filter((n) => p[n] == null) };
      }
      case "max_value":
        return p[check.param] == null ? { kind: "missing", names: [check.param] }
          : { kind: p[check.param] <= check.limit ? "compliant" : "violated" };
      case "min_value":
        return p[check.param] == null ? { kind: "missing", names: [check.param] }
          : { kind: p[check.param] >= check.limit ? "compliant" : "violated" };
      default:
        throw new Error(`unknown check kind '${check.kind}'`);
    }
  }

  function finding(outcome, rule, pack, clause) {
    let tier, explanation;
    switch (outcome.kind) {
      case "labelUncertain":
        tier = "needs_human";
        explanation = `The AI labelled this clause \u201C${rule.title.toLowerCase()}\u201D, but ${outcome.note}. `
          + "Because the label isn't certain, the app won't give a legal verdict on it. "
          + `If it is this kind of clause, ${rule.citation} applies. Read it yourself.`;
        break;
      case "violated":
        tier = "rule_violation"; explanation = rule.explanation_if_violated; break;
      case "compliant":
        tier = "rule_compliant"; explanation = rule.explanation_if_compliant ?? `Consistent with ${rule.citation}.`; break;
      case "missing":
        tier = "needs_human";
        explanation = `This clause is covered by ${rule.citation}, but the app couldn't read `
          + `the value(s) it needs to check it (${outcome.names.join(", ")}). Read it yourself.`;
        break;
      case "review":
        tier = "needs_human"; explanation = rule.explanation_if_violated; break;
    }
    return { id: `${pack.id}.${rule.id}#${clause.start}`, tier, title: rule.title, explanation, clause,
      citation: rule.citation, packName: pack.name, lastVerified: pack.last_verified,
      sourceURL: rule.source_url ?? pack.source_url, exceptionNote: rule.exception_note ?? null };
  }

  function apply(rule, pack, clause) {
    const outcome = clause.labelNote
      ? { kind: "labelUncertain", note: clause.labelNote } // never a legal verdict on a doubtful label
      : evaluateCheck(rule.check, clause.params || {});
    return finding(outcome, rule, pack, clause);
  }

  const RANK = { rule_violation: 0, needs_human: 1, worth_a_look: 2, rule_compliant: 3 };

  /* clauses: [{ type, start, end, quote, params, labelNote? }] -> findings, most serious first. */
  function evaluate(clauses, documentType, packs, heuristics) {
    const applicable = packs.filter((p) => p.document_types.includes(documentType));
    const findings = [];
    for (const clause of clauses) {
      const matches = applicable.flatMap((pack) => pack.rules.filter((r) => r.applies_to === clause.type).map((r) => [pack, r]));
      if (matches.length) {
        for (const [pack, rule] of matches) findings.push(apply(rule, pack, clause));
      } else {
        const flag = heuristics?.flags.find((f) => f.applies_to === clause.type);
        if (flag) findings.push({ id: `heuristic.${flag.applies_to}#${clause.start}`, tier: "worth_a_look",
          title: flag.title, explanation: flag.explanation, clause, citation: null,
          packName: heuristics.name, lastVerified: null, sourceURL: null, exceptionNote: null });
      }
      // Clauses with no rule and no heuristic produce no finding.
    }
    return findings.sort((a, b) => (RANK[a.tier] - RANK[b.tier]) || (a.clause.start - b.clause.start));
  }

  /* The Analyzer step before the rules: LabelGuard on each clause's wording.
     contradicted -> dropped (no verdict at all); unsupported -> kept with a labelNote. */
  function guardLabels(clauses, enabled = true) {
    const kept = [], dropped = [];
    for (const c of clauses) {
      if (!enabled) { kept.push({ ...c }); continue; }
      const check = checkLabel(c.type, c.quote);
      if (check.kind === "contradicted") dropped.push({ clause: c, reason: check.note });
      else kept.push(check.kind === "unsupported" ? { ...c, labelNote: check.note } : { ...c });
    }
    return { kept, dropped };
  }

  const TIERS = {
    rule_violation: { label: "Conflicts with the law", meaning: "These clauses conflict with a specific section of Ontario law." },
    needs_human: { label: "Check this yourself", meaning: "The law covers these, but the app can't decide from the text alone." },
    worth_a_look: { label: "Worth a look", meaning: "Common patterns to read carefully. No legal claim is made." },
    rule_compliant: { label: "Consistent with the rules", meaning: "Checked against a rule and consistent with it." },
  };

  return { normalize, checkLabel, evaluate, guardLabels, TIERS, ORDER: Object.keys(RANK) };
})();

if (typeof module !== "undefined") module.exports = FinePrintEngine;
