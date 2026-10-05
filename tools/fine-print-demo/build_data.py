"""Build demos/fine-print/data.json from the Fine Print repository.

Nothing in the demo is hand-written: documents, rule packs and heuristics are copied from the
app's repo, and each document's clauses are the evaluation's ground-truth labels, which the
app's Gemini engine matched in full in the 4 October 2026 run (34/34 clauses, 20/20 numbers).
The verdicts are NOT stored here: the browser computes them with engine.js, a port of the
app's RuleEngine and LabelGuard.

Usage:
    python tools/fine-print-demo/build_data.py /path/to/fine-print
"""

import json
import re
import sys
from pathlib import Path

DOCS = [
    # (corpus file stem, demo title, short description)
    ("01_lease_problems", "Lease with problems", "An Ontario residential lease with several clauses the law has already voided."),
    ("02_lease_fair", "A fair lease", "An Ontario lease that mostly follows the rules: what a clean result looks like."),
    ("04_employment_offer", "Job offer", "An Ontario employment offer with a non-compete and short vacation."),
    ("05_subscription_terms", "Streaming terms", "Online terms of service: no Ontario statute applies, so only 'worth a look' flags."),
    ("06_contractor_agreement", "Contractor agreement", "A document the app can't classify, so it refuses to give any legal verdict."),
]
TRAP = "08_lease_negations"
# The real failure found in testing (docs/phase5_evaluation.md and LabelGuard.swift): both AI
# engines labelled this sentence as a no-pets clause, and the s.14 rule then called it void.
TRAP_QUOTE = "Pets are welcome. The Tenant may keep cats and dogs in the unit."


def sentence_span(text: str, marker: str) -> tuple[int, int]:
    """The full sentence around the marker: what the app's AI is asked to quote."""
    i = text.find(marker)
    if i < 0:
        raise ValueError(f"marker not found: {marker!r}")
    start = i
    while start > 0 and text[start - 1] != "\n" and not re.match(r"[.!?] ", text[start - 2:start]):
        start -= 1
    # Skip a leading section number such as "3. " or "(b) ".
    m = re.match(r"\s*(\d+(?:\.\d+)*\.?|\([a-z]\))\s+", text[start:])
    if m:
        start += m.end()
    end = i + len(marker)
    while end < len(text) and text[end] != "\n" and not (text[end] in ".!?" and (end + 1 == len(text) or text[end + 1] in " \n")):
        end += 1
    if end < len(text) and text[end] in ".!?":
        end += 1
    return start, end


def document(repo: Path, stem: str, title: str, blurb: str) -> dict:
    text = (repo / "Eval" / "corpus" / f"{stem}.txt").read_text()
    truth = json.loads((repo / "Eval" / "corpus" / f"{stem}.truth.json").read_text())
    clauses = []
    for c in truth["expected"]:
        s, e = sentence_span(text, c["marker"])
        clauses.append({"type": c["type"], "start": s, "end": e, "quote": text[s:e], "params": c.get("params", {})})
    return {"id": stem, "title": title, "blurb": blurb, "document_type": truth["document_type"],
            "text": text, "clauses": clauses}


def main(repo: Path) -> None:
    packs = [json.loads((repo / "Packs" / f).read_text()) for f in ("ca-on-residential-lease.json", "ca-on-employment.json")]
    heuristics = json.loads((repo / "Packs" / "universal-heuristics.json").read_text())
    docs = [document(repo, *d) for d in DOCS]

    trap = document(repo, TRAP, "Try to break it", "A lease that welcomes pets.")
    s = trap["text"].find(TRAP_QUOTE)
    assert s >= 0, "trap quote not found in the negations document"
    trap["clauses"].insert(0, {"type": "pets", "start": s, "end": s + len(TRAP_QUOTE), "quote": TRAP_QUOTE,
                               "params": {}, "ai_mislabel": True})

    out = {"source": "https://github.com/lekanlawal1/fine-print", "packs": packs, "heuristics": heuristics,
           "documents": docs, "trap": trap}
    dest = Path(__file__).resolve().parents[2] / "demos" / "fine-print" / "data.json"
    dest.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"wrote {dest} ({dest.stat().st_size // 1024} KB): {len(docs)} documents + trap")
    for d in docs + [trap]:
        for c in d["clauses"]:
            print(f"  {d['id'][:22]:22s} {c['type']:22s} {c['quote'][:90]!r}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
