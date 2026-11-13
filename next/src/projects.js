// Ported from the live site's projects.js (same ids, numbers and receipts). Order = the pile from the top down.
// cover is the folder colour on the desk. Links are absolute so this works at any path.
export const SITE = 'https://lekanlawal1.github.io/portfolio-site/';
export const RESUME = SITE + 'assets/Lekan_Lawal_Resume.pdf';
export const projects = [
  {
    id: "fine-print",
    name: "Fine Print",
    kind: "iPhone app",
    line: "Paste a lease or job offer and see which clauses Ontario law has already made void, with the section of the law for each.",
    num: "0",
    cap: "wrong legal verdicts across a 12-document test set built to trip it up",
    cover: "paper",
    receipt: "The 12 test documents were written to trip it up: negations, a bad scan, text copied from a messy PDF, a hidden instruction aimed at AI. For all three engines, the label check removed every wrong legal verdict. The set is small and I wrote it.",
    see: [
      [
        "Evaluation write-up",
        "https://github.com/lekanlawal1/fine-print/blob/main/docs/phase5_evaluation.md"
      ]
    ],
    live: [
      "Check your own document",
      "https://lekanlawal1.github.io/portfolio-site/demos/fine-print/#your-document"
    ],
    study: "https://lekanlawal1.github.io/portfolio-site/projects/fine-print.html",
    source: "https://github.com/lekanlawal1/fine-print",
    skills: [
      "Swift",
      "Gemini API",
      "AI output checks",
      "Apple on-device AI",
      "PDF parsing and OCR",
      "Cloudflare Workers"
    ]
  },
  {
    id: "economy",
    name: "Canada Economy",
    kind: "Data platform",
    line: "Canada's economy by province, refreshed by itself whenever Statistics Canada publishes, with a briefing whose every number is checked.",
    num: "89",
    cap: "automatic checks run before every update; 11 of 11 headline figures match StatCan",
    cover: "kraft",
    receipt: "Every build runs 89 data checks and the update stops if one fails. It also compares 11 headline figures with Statistics Canada's own published numbers, and all 11 match. The live build writes its result into a file you can open.",
    see: [
      [
        "The live build report",
        "https://lekanlawal1.github.io/project5-canada-economy-platform/data/meta.json"
      ],
      [
        "What the checks are",
        "https://github.com/lekanlawal1/project5-canada-economy-platform/blob/main/docs/03_data_tests.md"
      ]
    ],
    live: [
      "Work out your inflation rate",
      "https://lekanlawal1.github.io/project5-canada-economy-platform/#mine-section"
    ],
    study: "https://lekanlawal1.github.io/portfolio-site/projects/project5.html",
    source: "https://github.com/lekanlawal1/project5-canada-economy-platform",
    skills: [
      "Python",
      "SQL",
      "JavaScript",
      "pandas",
      "DuckDB",
      "statsmodels",
      "Data quality checks",
      "Gemini API",
      "AI output checks",
      "Plotly",
      "GitHub Actions"
    ]
  },
  {
    id: "sorted",
    name: "Sorted",
    kind: "AI triage",
    line: "Bank support messages routed to the right team by an AI and a plain model that have to agree; a person takes the rest.",
    num: "99.1%",
    cap: "of the messages it sorted on its own reached the right team (770 test messages)",
    cover: "black",
    receipt: "770 real bank messages that I did not write. A message goes straight to a team only when the AI and a plain model pick the same one, the AI is at least 80 percent sure, and its quote is found in the message. 672 went on their own and 6 of those went to the wrong team. The live page lets you filter the inbox to just the mistakes.",
    see: [
      [
        "The results file",
        "https://lekanlawal1.github.io/project2-ai-ticket-triage/data/results.json"
      ]
    ],
    live: [
      "Sort a message",
      "https://lekanlawal1.github.io/project2-ai-ticket-triage/"
    ],
    study: "https://lekanlawal1.github.io/portfolio-site/projects/project2.html",
    source: "https://github.com/lekanlawal1/project2-ai-ticket-triage",
    skills: [
      "Python",
      "JavaScript",
      "scikit-learn",
      "Gemini API",
      "AI output checks",
      "Cloudflare Workers",
      "GitHub Actions"
    ]
  },
  {
    id: "football",
    name: "The Gaffer",
    kind: "Stats agent",
    line: "Ask a football question in plain English; an AI writes the SQL, your browser runs it on 1,853 matches, and the query is always shown.",
    num: "44/44",
    cap: "answers match hand-written SQL; 30 of 30 attacks stopped",
    cover: "cream",
    receipt: "94 test questions run against the real model with the same instructions as the live page: 50 with an answer I worked out by hand (44 scored so far, 6 wait on data that is not loaded yet), 14 that should get a question back or an honest no, and 30 attacks. Every scored answer matched and every attack was stopped. The first run of the larger set scored 41 of 44, and the write-up says what failed.",
    see: [
      [
        "Latest evaluation",
        "https://github.com/lekanlawal1/football-agent/blob/main/docs/eval_results.md"
      ]
    ],
    live: [
      "Ask it a question",
      "https://lekanlawal1.github.io/football-agent/"
    ],
    study: "https://lekanlawal1.github.io/portfolio-site/projects/football-agent.html",
    source: "https://github.com/lekanlawal1/football-agent",
    skills: [
      "Python",
      "SQL",
      "JavaScript",
      "DuckDB",
      "scikit-learn",
      "Gemini API",
      "NL-to-SQL agents",
      "AI output checks",
      "Cloudflare Workers",
      "GitHub Actions"
    ]
  },
  {
    id: "superstore",
    name: "Money Snitch",
    kind: "BI dashboard",
    line: "Drop in a sales export or a card statement and see which discounts, products and fees are taking a business's money.",
    num: "$135k",
    cap: "lost to deep discounts in the sample, found in seconds with the SQL shown",
    cover: "black",
    receipt: "On the public Superstore sample, order lines discounted by more than 20 percent made a net loss of $135,376 across 1,393 lines. The console's numbers are checked against an independent pandas calculation on the raw file.",
    see: [
      [
        "The test that checks it",
        "https://github.com/lekanlawal1/project1-bi-dashboard/blob/main/tests/test_console_sql.py"
      ]
    ],
    live: [
      "Check your margins",
      "https://lekanlawal1.github.io/project1-bi-dashboard/"
    ],
    study: "https://lekanlawal1.github.io/portfolio-site/projects/project1.html",
    source: "https://github.com/lekanlawal1/project1-bi-dashboard",
    skills: [
      "Python",
      "SQL",
      "JavaScript",
      "pandas",
      "DuckDB",
      "Data quality checks",
      "Reconciliation",
      "PDF parsing and OCR",
      "Playwright"
    ]
  },
  {
    id: "triage",
    name: "App Review Insights",
    kind: "AI analysis",
    line: "Pick any iPhone app and see what its users love, hate and ask for; every AI quote is checked against the real review.",
    num: "28/28",
    cap: "AI quotes found word for word in 500 of Wealthsimple's reviews",
    cover: "kraft",
    receipt: "The AI only suggests themes and quotes. The page then checks every quote against the review it cites and throws out any that is not there word for word, or that comes from a review the AI put in a different theme. On the Wealthsimple run all 28 passed. Pick any app on the live page and it shows its own count.",
    see: [
      [
        "The checking code",
        "https://github.com/lekanlawal1/app-review-insights/blob/main/site/analysis.js"
      ]
    ],
    live: [
      "Try it on any app",
      "https://lekanlawal1.github.io/app-review-insights/"
    ],
    study: "https://lekanlawal1.github.io/portfolio-site/projects/app-reviews.html",
    source: "https://github.com/lekanlawal1/app-review-insights",
    skills: [
      "JavaScript",
      "Gemini API",
      "AI output checks",
      "Cloudflare Workers",
      "GitHub Actions"
    ]
  },
  {
    id: "docket",
    name: "Docket",
    kind: "PDF toolkit",
    line: "38 PDF and document tools that run entirely in your browser: merge, sign, redact, compare, OCR and convert. Nothing is uploaded.",
    num: "38",
    cap: "tools, and redaction is checked after the fact before anything is saved",
    cover: "cream",
    receipt: "Docket has 38 tools and all of them run in the browser. Redaction redraws the marked pages as pictures, reads the result back, and refuses to save if any redacted text can still be found. A browser test drives every tool with generated PDFs.",
    see: [
      [
        "The end-to-end test",
        "https://github.com/lekanlawal1/docket/blob/main/tests/e2e.mjs"
      ]
    ],
    live: [
      "Use it now",
      "https://lekanlawal1.github.io/docket/"
    ],
    study: "https://lekanlawal1.github.io/portfolio-site/projects/docket.html",
    source: "https://github.com/lekanlawal1/docket",
    skills: [
      "JavaScript",
      "PDF parsing and OCR",
      "WebAssembly",
      "GitHub Actions",
      "Playwright"
    ]
  },
  {
    id: "discrepancy",
    name: "Discrepancy Checker",
    kind: "Excel workbook",
    line: "Checks warehouse counts against the system, receipts against slip and PO, and invoices against the rate card, all in Excel.",
    num: "$1,028",
    cap: "of billing errors found in the sample, with plain formulas you can inspect",
    cover: "black",
    receipt: "Four invoices fall outside the $1 tolerance: $771 charged too much and $257 charged too little. They are added up separately so they cannot cancel out. The workbook's Dollar impact block shows each figure with its SUMIFS formula.",
    see: [
      [
        "Open the demo",
        "https://lekanlawal1.github.io/portfolio-site/demos/discrepancy-checker/"
      ]
    ],
    live: [
      "Try it in your browser",
      "https://lekanlawal1.github.io/portfolio-site/demos/discrepancy-checker/"
    ],
    study: "https://lekanlawal1.github.io/portfolio-site/demos/discrepancy-checker/",
    download: "https://lekanlawal1.github.io/portfolio-site/demos/discrepancy-checker/Discrepancy_Checker_Sample.xlsx",
    skills: [
      "Excel",
      "Reconciliation",
      "Data quality checks",
      "JavaScript"
    ]
  }
];
