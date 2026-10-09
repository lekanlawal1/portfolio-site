/* Runs the workbook's checks in the browser. The rules mirror the Excel formulas one for one:
     Inventory  variance = physical - system          status = variance = 0 ? OK : Check
     Receiving  variance = received - packing slip    flag   = Short / Over / PO mismatch / OK
     Billing    expected = pallets x rate             flag   = |invoice - expected| > tolerance ? Check : OK
   Only typed values are read from the file; every result is recomputed here. */

(() => {
  const SAMPLE = "Discrepancy_Checker_Sample.xlsx";
  const $ = (id) => document.getElementById(id);
  const state = { data: null, original: null, tab: "inventory", only: false, name: "" };

  // ------------------------------------------------------------------ formatting
  const qty = (n) => (n == null || n === "" ? "" : Number(n).toLocaleString("en-CA"));
  const signed = (n) => (n > 0 ? "+" : "") + qty(n);
  const money = (n) => {
    if (n == null) return "";
    const s = Math.abs(n).toLocaleString("en-CA", { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol" });
    return n < 0 ? `(${s})` : s;
  };
  const day = (d) => (d instanceof Date ? d.toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" }) : d ?? "");
  const month = (d) => (d instanceof Date ? d.toLocaleDateString("en-CA", { month: "short", year: "numeric" }) : d ?? "");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const round2 = (n) => Math.round(n * 100) / 100;

  // Excel WEEKNUM(date, 2): weeks start Monday, week 1 is the week containing 1 January.
  function weeknum(d) {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const offset = (jan1.getDay() + 6) % 7;
    const doy = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - jan1) / 864e5);
    return Math.floor((doy + offset) / 7) + 1;
  }

  // ------------------------------------------------------------------ reading a workbook
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const COLS = {
    inventory: { sku: ["sku"], sys: ["systemqty", "system", "systemquantity"], phys: ["physicalcount", "physical", "counted", "countqty"],
      reason: ["reason", "reasoncode"], date: ["countdate", "date"] },
    receiving: { date: ["receiptdate", "date", "received"], po: ["po", "ponumber", "purchaseorder"], carrier: ["carrier"],
      bol: ["bol", "billoflading"], sku: ["sku"], poQty: ["poqty", "orderedqty", "ordered"],
      slip: ["packingslipqty", "slipqty", "packingslip"], recv: ["qtyreceived", "receivedqty"] },
    billing: { month: ["month", "period", "billingmonth"], client: ["client", "customer"], pallets: ["palletsstored", "pallets"],
      rate: ["rate", "rate$"], invoice: ["invoiceamount", "invoiceamount$", "invoiced", "invoice"] },
    items: { sku: ["sku"], desc: ["description", "itemdescription"], loc: ["binlocation", "location", "bin"],
      cost: ["unitcost", "unitcost$", "cost"] },
  };
  const REQUIRED = { inventory: ["sku", "sys", "phys"], receiving: ["sku", "slip", "recv"], billing: ["client", "pallets", "invoice"] };
  const LABEL = { sku: "SKU", sys: "System qty", phys: "Physical count", slip: "Packing slip qty", recv: "Qty received",
    client: "Client", pallets: "Pallets stored", invoice: "Invoice amount" };

  function sheetRows(wb, name) {
    const real = wb.SheetNames.find((s) => norm(s) === norm(name));
    return real ? XLSX.utils.sheet_to_json(wb.Sheets[real], { header: 1, raw: true, defval: null }) : null;
  }

  function readTable(rows, spec) {
    if (!rows || !rows.length) return null;
    const head = rows[0].map(norm);
    const idx = {};
    for (const [key, names] of Object.entries(spec)) {
      const i = head.findIndex((h) => names.includes(h.replace(/\$$/, "")) || names.includes(h));
      if (i >= 0) idx[key] = i;
    }
    const out = [];
    for (const r of rows.slice(1)) {
      if (!r || r.every((v) => v == null || v === "")) continue;
      const o = {};
      for (const [k, i] of Object.entries(idx)) o[k] = r[i];
      out.push(o);
    }
    return { idx, rows: out };
  }

  const num = (v) => (v == null || v === "" ? null : Number(v));

  function parse(wb) {
    const errors = [];
    const items = new Map();
    const it = readTable(sheetRows(wb, "Items"), COLS.items);
    if (it) for (const r of it.rows) if (r.sku != null) items.set(String(r.sku).trim(), r);

    const rates = new Map();
    let tolerance = 1;
    const lists = sheetRows(wb, "Lists");
    if (lists) {
      const head = (lists[0] || []).map(norm);
      const ci = head.indexOf("client"), ri = head.findIndex((h) => h.startsWith("storagerate"));
      for (const row of lists.slice(1)) {
        if (ci >= 0 && ri >= 0 && row[ci] != null && row[ri] != null) rates.set(norm(row[ci]), Number(row[ri]));
        row.forEach((v, i) => { if (norm(v).startsWith("billingtolerance") && typeof row[i + 1] === "number") tolerance = row[i + 1]; });
      }
    }

    const data = { items, rates, tolerance, inventory: null, receiving: null, billing: null };
    for (const key of ["inventory", "receiving", "billing"]) {
      const t = readTable(sheetRows(wb, key), COLS[key]);
      if (!t) continue;
      const missing = REQUIRED[key].filter((k) => !(k in t.idx));
      if (missing.length) { errors.push(`${key[0].toUpperCase() + key.slice(1)} sheet is missing: ${missing.map((k) => LABEL[k]).join(", ")}`); continue; }
      const keyCol = { inventory: "sku", receiving: "sku", billing: "client" }[key];
      data[key] = t.rows.filter((r) => r[keyCol] != null && r[keyCol] !== "").map((r) => {
        for (const k of ["sys", "phys", "poQty", "slip", "recv", "pallets", "invoice", "rate"]) if (k in r) r[k] = num(r[k]);
        if (r.sku != null) r.sku = String(r.sku).trim();
        return r;
      });
    }
    if (!data.inventory && !data.receiving && !data.billing && !errors.length)
      errors.push("No sheet named Inventory, Receiving or Billing was found.");
    return { data, errors };
  }

  // ------------------------------------------------------------------ the checks
  function compute(d) {
    const lookup = (sku) => d.items.get(sku);
    const inv = (d.inventory || []).map((r) => {
      const item = lookup(r.sku);
      const variance = (r.phys ?? 0) - (r.sys ?? 0);
      const cost = item ? Number(item.cost) || 0 : 0;
      return { ...r, desc: item ? item.desc : "SKU not found", loc: item ? item.loc : "SKU not found", cost,
        variance, status: variance === 0 ? "OK" : "Check", value: round2(variance * cost) };
    });
    const rec = (d.receiving || []).map((r) => {
      const item = lookup(r.sku);
      const variance = (r.recv ?? 0) - (r.slip ?? 0);
      const flag = variance < 0 ? "Short" : variance > 0 ? "Over" : (r.poQty != null && r.slip !== r.poQty) ? "PO mismatch" : "OK";
      return { ...r, desc: item ? item.desc : "SKU not found", variance, flag,
        week: r.date instanceof Date ? `Wk ${String(weeknum(r.date)).padStart(2, "0")}` : "" };
    });
    const bil = (d.billing || []).map((r) => {
      const rate = d.rates.get(norm(r.client)) ?? r.rate ?? 0;
      const expected = round2((r.pallets ?? 0) * rate);
      const variance = round2((r.invoice ?? 0) - expected);
      return { ...r, rate, expected, variance, flag: Math.abs(variance) > d.tolerance ? "Check" : "OK" };
    });

    const count = (arr, f) => arr.filter(f).length;
    const reasons = {};
    for (const r of inv) if (r.reason) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    const clients = {};
    for (const r of bil) clients[r.client] = round2((clients[r.client] || 0) + r.variance);
    const k = {
      items: inv.length, invBad: count(inv, (r) => r.status === "Check"),
      recv: rec.length, recBad: count(rec, (r) => r.flag !== "OK"),
      invoices: bil.length, bilBad: count(bil, (r) => r.flag === "Check"),
      netCount: round2(inv.reduce((s, r) => s + r.value, 0)),
      netBilling: round2(bil.filter((r) => r.flag === "Check").reduce((s, r) => s + r.variance, 0)),
      over: round2(bil.filter((r) => r.flag === "Check" && r.variance > 0).reduce((s, r) => s + r.variance, 0)),
      under: round2(bil.filter((r) => r.flag === "Check" && r.variance < 0).reduce((s, r) => s + r.variance, 0)),
      units: inv.reduce((s, r) => s + Math.abs(r.variance), 0),
    };
    k.accuracy = k.items ? 1 - k.invBad / k.items : 0;
    const types = [["Count variance", k.invBad], ["Received short", count(rec, (r) => r.flag === "Short")],
      ["Received over", count(rec, (r) => r.flag === "Over")], ["PO mismatch", count(rec, (r) => r.flag === "PO mismatch")],
      ["Billing variance", k.bilBad]];
    return { inv, rec, bil, k, types, reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]), clients: Object.entries(clients) };
  }

  // ------------------------------------------------------------------ rendering
  function renderKpis(c) {
    const { k } = c;
    const has = state.data;
    const cards = [
      ["Items counted", has.inventory ? qty(k.items) : "-", has.inventory ? `${qty(k.units)} units off in total` : "No Inventory sheet", false],
      ["Count discrepancies", has.inventory ? qty(k.invBad) : "-", has.inventory ? `Accuracy ${(k.accuracy * 100).toFixed(1)}%` : "", k.invBad > 0],
      ["Net count variance", has.inventory && has.items.size ? money(k.netCount) : "-",
        has.items.size ? "Units off x unit cost" : "Needs an Items sheet with unit costs", k.netCount < 0],
      ["Receipts logged", has.receiving ? qty(k.recv) : "-", has.receiving ? "Against packing slip and PO" : "No Receiving sheet", false],
      ["Receiving exceptions", has.receiving ? qty(k.recBad) : "-", "Short, over or PO mismatch", k.recBad > 0],
      ["Invoices checked", has.billing ? qty(k.invoices) : "-", has.billing ? `Tolerance ${money(state.data.tolerance)}` : "No Billing sheet", false],
      ["Invoices flagged", has.billing ? qty(k.bilBad) : "-", "Outside the tolerance", k.bilBad > 0],
      ["Overbilled", has.billing ? money(k.over) : "-", "Owed back to clients", k.over > 0],
      ["Underbilled", has.billing ? money(-k.under) : "-", "Revenue not invoiced", k.under < 0],
    ];
    $("kpis").innerHTML = cards.map(([l, v, s, bad]) =>
      `<div class="kpi${bad ? " bad" : ""}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`).join("");
  }

  function bars(el, pairs, colour, fmt = qty) {
    if (!pairs.length) { $(el).innerHTML = `<span class="lab">Nothing to show</span>`; return; }
    const max = Math.max(...pairs.map(([, v]) => Math.abs(v)), 1);
    const diverging = pairs.some(([, v]) => v < 0);
    $(el).innerHTML = pairs.map(([label, v]) => {
      let fill, numPos;
      if (!diverging) {
        const w = (Math.abs(v) / max) * 78;
        fill = `left:0;width:${w}%`; numPos = `left:calc(${w}% + 6px)`;
      } else {
        const w = (Math.abs(v) / max) * 18;
        fill = v >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
        numPos = v >= 0 ? `left:calc(${50 + w}% + 6px)` : `right:calc(${50 + w}% + 6px)`;
      }
      const col = typeof colour === "function" ? colour(v) : colour;
      return `<div class="lab" title="${esc(label)}">${esc(label)}</div><div class="track">${diverging ? '<div class="axis" style="left:50%"></div>' : ""}`
        + `<div class="fill" style="${fill};background:${col}"></div><div class="val" style="${numPos}">${fmt(v)}</div></div>`;
    }).join("");
  }

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function renderCharts(c) {
    bars("c-type", c.types, css("--bad"));
    bars("c-reason", c.reasons, css("--sky"));
    bars("c-client", c.clients, (v) => (v >= 0 ? css("--amber") : css("--accent-2")), money);
  }

  const input = (tab, i, key, v, cls = "") =>
    `<input inputmode="decimal" class="${cls}${v !== state.original[tab][i][key] ? " changed" : ""}" data-tab="${tab}" data-i="${i}" data-k="${key}" value="${v == null ? "" : cls.includes("money") ? v.toFixed(2) : v}" aria-label="${key}">`;
  const pill = (s) => `<span class="pill ${s === "OK" ? "ok" : "bad"}">${esc(s)}</span>`;
  const vcls = (v) => (v !== 0 ? "n calc neg" : "n calc");

  const TABLES = {
    inventory: {
      head: ["SKU", "Description", "System qty", "Physical count", "Variance", "Status", "Bin", "Unit cost", "Variance ($)", "Reason", "Count date"],
      num: [2, 3, 4, 7, 8],
      bad: (r) => r.status !== "OK",
      row: (r, i) => [esc(r.sku), [esc(r.desc), "calc"], [qty(r.sys), "n"], [input("inventory", i, "phys", r.phys), "n"],
        [signed(r.variance), vcls(r.variance)], [pill(r.status), "calc"], [esc(r.loc), "calc"], [money(r.cost), "n calc"],
        [money(r.value), r.value ? "n calc neg" : "n calc"], esc(r.reason ?? ""), day(r.date)],
    },
    receiving: {
      head: ["Receipt date", "PO", "Carrier", "BOL", "SKU", "Description", "PO qty", "Packing slip qty", "Qty received", "Variance", "Flag", "Week"],
      bad: (r) => r.flag !== "OK",
      row: (r, i) => [day(r.date), esc(r.po), esc(r.carrier ?? ""), esc(r.bol ?? ""), esc(r.sku), [esc(r.desc), "calc"], [qty(r.poQty), "n"],
        [qty(r.slip), "n"], [input("receiving", i, "recv", r.recv), "n"], [signed(r.variance), vcls(r.variance)], [pill(r.flag), "calc"], [r.week, "calc"]],
    },
    billing: {
      head: ["Month", "Client", "Pallets stored", "Rate", "Invoice amount", "Expected", "Variance", "Flag"],
      bad: (r) => r.flag !== "OK",
      row: (r, i) => [month(r.month), esc(r.client), [qty(r.pallets), "n"], [money(r.rate), "n calc"],
        [input("billing", i, "invoice", r.invoice, "money"), "n"], [money(r.expected), "n calc"],
        [money(r.variance), r.flag !== "OK" ? "n calc neg" : "n calc"], [pill(r.flag), "calc"]],
    },
  };

  function renderTable(c) {
    const src = { inventory: c.inv, receiving: c.rec, billing: c.bil }[state.tab];
    const t = TABLES[state.tab];
    const numericHead = { inventory: [2, 3, 4, 7, 8], receiving: [6, 7, 8, 9], billing: [2, 3, 4, 5, 6] }[state.tab];
    const rows = src.map((r, i) => [r, i]).filter(([r]) => !state.only || t.bad(r));
    const body = rows.length ? rows.map(([r, i]) => `<tr class="${t.bad(r) ? "bad" : ""}">` + t.row(r, i).map((cell) => {
      const [html, cls] = Array.isArray(cell) ? cell : [cell, ""];
      return `<td class="${cls}">${html}</td>`;
    }).join("") + "</tr>").join("")
      : `<tr><td colspan="${t.head.length}">${src.length ? "No rows need a look." : "This file has no " + state.tab + " sheet."}</td></tr>`;
    $("grid").innerHTML = `<thead><tr>${t.head.map((h, i) => `<th class="${numericHead.includes(i) ? "n" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody>`;
    $("n-inventory").textContent = c.k.invBad || "";
    $("n-receiving").textContent = c.k.recBad || "";
    $("n-billing").textContent = c.k.bilBad || "";
    for (const el of document.querySelectorAll(".tab .c")) el.style.display = el.textContent ? "" : "none";
  }

  let current;
  function render(tableToo = true) {
    current = compute(state.data);
    renderKpis(current);
    renderCharts(current);
    if (tableToo) renderTable(current);
    const edited = ["inventory", "receiving", "billing"].some((t) => (state.data[t] || []).some((r, i) =>
      ["phys", "recv", "invoice"].some((k) => k in r && r[k] !== state.original[t][i][k])));
    $("reset").hidden = !edited;
  }

  // Edits: recompute on every keystroke, but only rebuild the table when focus leaves,
  // so the cursor is not lost while typing. The row's own cells update in place.
  $("grid").addEventListener("input", (e) => {
    const el = e.target;
    if (el.tagName !== "INPUT") return;
    const v = el.value.trim() === "" ? null : Number(el.value.replace(/[$,\s]/g, ""));
    if (v !== null && Number.isNaN(v)) return;
    state.data[el.dataset.tab][+el.dataset.i][el.dataset.k] = v;
    el.classList.toggle("changed", v !== state.original[el.dataset.tab][+el.dataset.i][el.dataset.k]);
    render(false);
    const tr = el.closest("tr");
    const r = { inventory: current.inv, receiving: current.rec, billing: current.bil }[el.dataset.tab][+el.dataset.i];
    const cells = TABLES[el.dataset.tab].row(r, +el.dataset.i);
    [...tr.children].forEach((td, j) => {
      if (td.contains(el)) return;
      const [html, cls] = Array.isArray(cells[j]) ? cells[j] : [cells[j], ""];
      td.innerHTML = html; td.className = cls;
    });
    tr.className = TABLES[el.dataset.tab].bad(r) ? "bad" : "";
  });
  $("grid").addEventListener("change", () => renderTable(current));
  $("grid").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") e.target.blur(); });

  $("reset").addEventListener("click", () => { state.data = clone(state.original); render(); });
  $("only").addEventListener("change", (e) => { state.only = e.target.checked; renderTable(current); });
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === b));
    state.tab = b.dataset.tab; renderTable(current);
  }));

  const clone = (d) => ({ ...d, inventory: d.inventory && d.inventory.map((r) => ({ ...r })),
    receiving: d.receiving && d.receiving.map((r) => ({ ...r })), billing: d.billing && d.billing.map((r) => ({ ...r })) });

  function load(buf, name) {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const { data, errors } = parse(wb);
    if (!data.inventory && !data.receiving && !data.billing) throw new Error(errors.join(". "));
    state.original = clone(data);
    state.data = clone(data);
    state.name = name;
    render();
    const parts = [["inventory", "count rows"], ["receiving", "receipts"], ["billing", "invoices"]]
      .filter(([k]) => data[k]).map(([k, w]) => `${data[k].length} ${w}`);
    $("status").innerHTML = `<b>${esc(name)}</b>: ${parts.join(", ")}`;
    $("drop-err").textContent = errors.length ? `Skipped: ${errors.join(". ")}.` : "";
  }

  // ------------------------------------------------------------------ data sources
  async function loadSample() {
    try {
      const res = await fetch(SAMPLE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      load(await res.arrayBuffer(), "Sample workbook");
    } catch (err) {
      $("status").textContent = `Could not load the sample workbook (${err.message}).`;
    }
  }

  function readFile(file) {
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) { $("drop-err").textContent = "Please choose an .xlsx file."; return; }
    const fr = new FileReader();
    fr.onload = () => {
      try { load(new Uint8Array(fr.result), file.name); }
      catch (err) { $("drop-err").textContent = `Could not check this file. ${err.message}`; }
    };
    fr.readAsArrayBuffer(file);
  }

  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    const own = b.dataset.src === "own";
    $("drop").classList.toggle("show", own);
    if (!own && state.name !== "Sample workbook") { $("drop-err").textContent = ""; loadSample(); }
  }));
  $("file").addEventListener("change", (e) => readFile(e.target.files[0]));
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => readFile(e.dataTransfer.files[0]));

  // ------------------------------------------------------------------ formula guide
  const F = [
    ["Inventory, column B", "Look up the description",
      `=IFERROR(INDEX(Items!$B$2:$B$200,\n  MATCH($A2,Items!$A$2:$A$200,0)),"SKU not found")`,
      "MATCH finds the row in the item list that holds this SKU (0 means exact match). INDEX returns the description from that row. IFERROR shows a message instead of an error when the SKU is not on file.",
      `=XLOOKUP($A2,Items!$A$2:$A$200,Items!$B$2:$B$200,"SKU not found")`],
    ["Inventory, columns E and F", "Variance and status", `=D2-C2\n=IF(E2=0,"OK","Check")`,
      "Physical count minus system qty. Negative means fewer on the shelf than the system thinks. Any non-zero variance is marked Check, and conditional formatting turns the row red."],
    ["Inventory, column I", "Dollar impact", "=E2*H2",
      "Units off times unit cost (looked up from Items the same way as the description). Summed on the dashboard as the net count variance."],
    ["Receiving, column K", "Short, over or PO mismatch",
      `=IF(J2<0,"Short",IF(J2>0,"Over",\n  IF(H2<>G2,"PO mismatch","OK")))`,
      "J is qty received minus packing slip qty. If the count matches the slip, it still compares the slip with the PO, because a supplier can ship and bill a different quantity than was ordered."],
    ["Billing, columns D to F", "Rate and expected amount",
      `=IFERROR(INDEX(Lists!$F$2:$F$20,\n  MATCH(B2,Lists!$E$2:$E$20,0)),0)\n=C2*D2`,
      "The client's storage rate comes from one table on the Lists sheet, so a rate change is made once. Expected invoice is pallets stored times rate.",
      "=XLOOKUP(B2,Lists!$E$2:$E$20,Lists!$F$2:$F$20,0)"],
    ["Billing, column H", "Variance flag with a tolerance", `=IF(ABS(G2)>Lists!$I$2,"Check","OK")`,
      "G is invoiced minus expected. ABS catches overbilling and underbilling alike. The $1.00 tolerance sits in one cell, so rounding cents are not flagged."],
    ["Dashboard", "Counts", `=COUNTA(Inventory!$A$2:$A$500)\n=COUNTIF(Inventory!$F$2:$F$500,"Check")`,
      "COUNTA counts the rows filled in; COUNTIF counts the rows marked Check. Ranges run to row 500 so new rows are picked up."],
    ["Dashboard", "Billing variance", `=SUMIF(Billing!$H$2:$H$500,"Check",\n  Billing!$G$2:$G$500)`,
      "Adds the variance of flagged invoices only. This page splits it into overbilled and underbilled, so the two can't cancel out."],
  ];
  $("formulas").innerHTML = F.map(([where, title, code, text, alt]) => `<div class="f-card"><div class="where">${where}</div><h4>${title}</h4>`
    + `<code class="mono">${esc(code)}</code><p>${text}</p>`
    + (alt ? `<div class="alt">In Excel 365 with XLOOKUP:<code class="mono">${esc(alt)}</code></div>` : "") + "</div>").join("");

  // Re-colour the charts when the day/night theme changes.
  new MutationObserver(() => current && renderCharts(current)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  loadSample();
})();
