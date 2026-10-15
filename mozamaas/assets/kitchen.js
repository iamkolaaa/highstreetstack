/* Staff view: paid pre-orders from Stripe via the mm-preorder function. */
(() => {
"use strict";
const API = "https://rbjyyikzddnjecbnjvey.supabase.co/functions/v1/mm-preorder";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const gbp = (n) => "£" + (Math.round(n * 100) / 100).toFixed(2);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (ds) => new Date(ds + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
let DATA = null, view = "make", kioskF = "All";
const parse = (s) => { const m = /^(\d+)\s*×\s*(.+)$/.exec(s.trim()); return m ? [m[2].trim(), Number(m[1])] : [s.trim(), 1]; };

async function load(pin) {
  $("#msg").textContent = "Loading orders…";
  try {
    const r = await fetch(API + "/kitchen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin, sinceDays: 75 }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { $("#msg").textContent = { bad_pin: "Wrong PIN.", kitchen_not_configured: "The staff PIN hasn't been set yet (Supabase secret STAFF_PIN).", payments_not_configured: "Stripe isn't connected yet (Supabase secret STRIPE_SECRET_KEY)." }[j.error] || "Couldn't load orders."; if (j.error === "bad_pin") sessionStorage.removeItem("mm-pin"); return; }
    sessionStorage.setItem("mm-pin", pin); DATA = j; $("#gate").hidden = true; $("#app").hidden = false; $("#msg").textContent = ""; render();
  } catch { $("#msg").textContent = "Couldn't reach the order service."; }
}
function expandItems(kiosk, items) {
  const menu = (DATA.menu[kiosk] || []); const out = {};
  for (const s of items) { const [n, q] = parse(s); const it = menu.find((x) => x.n === n);
    if (it && it.b) for (const [bn, bq] of it.b) out[bn] = (out[bn] || 0) + bq * q; else out[n] = (out[n] || 0) + q; }
  return out;
}
function orders() { return (DATA.orders || []).filter((o) => o.paid && (kioskF === "All" || o.kiosk === kioskF)); }
function render() {
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  document.querySelectorAll("[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === kioskF)));
  $("#gen").textContent = "Updated " + new Date(DATA.generated).toLocaleString("en-GB");
  if (view === "make") renderMake(); else if (view === "orders") renderOrders(); else renderMonth();
}
function renderMake() {
  const today = iso(new Date()); const days = [...Array(8)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return iso(d); });
  const html = [];
  for (const ds of days) {
    const list = orders().filter((o) => o.date === ds && !(o.refunded >= o.total && o.total > 0)); if (!list.length) continue;
    html.push(`<h2 class="kday">${ds === today ? "Today · " : ""}${fmt(ds)}</h2>`);
    for (const kiosk of [...new Set(list.map((o) => o.kiosk))]) {
      const ko = list.filter((o) => o.kiosk === kiosk); const tot = {};
      ko.forEach((o) => Object.entries(expandItems(kiosk, o.items)).forEach(([n, q]) => tot[n] = (tot[n] || 0) + q));
      const caps = DATA.caps[kiosk] || [];
      html.push(`<section class="kbox"><h3>${esc(kiosk)} <small>${ko.length} order${ko.length > 1 ? "s" : ""}${caps.length ? ` · caps ${caps[0]} sharers / ${caps[1]} boxes` : ""}</small></h3><table><thead><tr><th>Make</th><th class="n">Qty</th></tr></thead><tbody>${Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([n, q]) => `<tr><td>${esc(n)}</td><td class="n"><b>${q}</b></td></tr>`).join("")}</tbody></table>
      <div class="olist">${ko.sort((a, b) => a.slot.localeCompare(b.slot)).map((o) => `<div class="o"><b>${esc(o.slot)} · ${o.mode === "deliver" ? "DELIVER" : "Collect"}</b> — ${esc(o.name)}${o.workplace ? ` (${esc(o.workplace)})` : ""} · ref ${esc(o.ref)}${o.notes ? `<div class="allergy">⚠ ${esc(o.notes)}</div>` : ""}</div>`).join("")}</div></section>`);
    }
  }
  $("#out").innerHTML = html.join("") || `<p class="empty">No paid orders for the next 7 days${kioskF !== "All" ? " at " + esc(kioskF) : ""}.</p>`;
}
function renderOrders() {
  const list = orders().slice().sort((a, b) => (b.date + b.slot).localeCompare(a.date + a.slot));
  $("#out").innerHTML = list.map((o) => `<article class="ocard${o.refunded ? " ref" : ""}"><header><b>${fmt(o.date)} · ${esc(o.slot)}</b><span class="pill ${o.mode}">${o.mode === "deliver" ? "Delivery" : "Collect"}</span><span class="pill">${esc(o.kiosk)}</span>${o.refunded ? `<span class="pill bad">Refunded ${gbp(o.refunded)}</span>` : ""}</header>
    <div class="who"><b>${esc(o.name)}</b>${o.workplace ? " · " + esc(o.workplace) : ""}<br>${o.phone ? `<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : ""} ${o.email ? `· <a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : ""}${o.address ? `<br>📍 ${esc(o.address)}` : ""}</div>
    ${o.notes ? `<div class="allergy">⚠ Allergies / notes: ${esc(o.notes)}</div>` : ""}
    <ul>${o.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <footer>Paid <b>${gbp(o.total)}</b>${o.discount ? ` (incl. −${gbp(o.discount)} ${esc(o.code)})` : ""}${o.delivery ? ` · delivery ${gbp(o.delivery)}` : ""} · ref ${esc(o.ref)} · opt-in ${esc(o.optin)} · <a href="https://dashboard.stripe.com/payments/${esc(o.pi)}" target="_blank" rel="noopener">Stripe</a></footer></article>`).join("") || `<p class="empty">No paid orders yet.</p>`;
}
function vatOf(o) { // estimate: standard-rated share of the goods, discount spread evenly, delivery treated as zero-rated
  const menu = DATA.menu[o.kiosk] || []; let goods = 0, std = 0;
  for (const s of o.items) { const [n, q] = parse(s); const it = menu.find((x) => x.n === n); if (!it) continue;
    const price = (o.subtotal && o.items.length === 1) ? o.subtotal / q : null; // unused fallback
    const parts = it.b ? it.b : [[n, 1]]; let pv = 0, sv = 0;
    for (const [bn, bq] of parts) { const c = menu.find((x) => x.n === bn); if (!c) continue; pv += bq; if (c.v) sv += bq; }
    goods += q; std += pv ? (sv / pv) * q : 0; void price; }
  const stdShare = goods ? std / goods : 0; const goodsPaid = o.total - o.delivery;
  return Math.round(goodsPaid * stdShare / 6 * 100) / 100;
}
function renderMonth() {
  const m = $("#month").value || iso(new Date()).slice(0, 7);
  const list = orders().filter((o) => new Date(o.created * 1000).toISOString().slice(0, 7) === m);
  const by = {};
  for (const o of list) { const k = by[o.kiosk] = by[o.kiosk] || { n: 0, gross: 0, disc: 0, deliv: 0, refund: 0, vat: 0 }; k.n++; k.gross += o.total; k.disc += o.discount; k.deliv += o.delivery; k.refund += o.refunded; k.vat += vatOf(o) * (o.total ? (o.total - o.refunded) / o.total : 0); }
  const rows = Object.entries(by).map(([k, v]) => { const net = v.gross - v.refund; return { k, ...v, net, exvat: net - v.vat }; });
  const sum = rows.reduce((a, r) => ({ n: a.n + r.n, gross: a.gross + r.gross, refund: a.refund + r.refund, net: a.net + r.net, vat: a.vat + r.vat, exvat: a.exvat + r.exvat }), { n: 0, gross: 0, refund: 0, net: 0, vat: 0, exvat: 0 });
  $("#out").innerHTML = `<p class="hint">Online pre-order takings by the month the payment was taken, for the monthly disclosure to Wonderfield. VAT is an estimate (drinks, mochi and snacks at 20%, cold food and delivery at 0%) — confirm with your accountant. Stripe's fees are not deducted.</p>
  <table class="month"><thead><tr><th>Kiosk</th><th class="n">Orders</th><th class="n">Taken</th><th class="n">Refunds</th><th class="n">Net</th><th class="n">VAT (est.)</th><th class="n">Net ex-VAT</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td>${esc(r.k)}</td><td class="n">${r.n}</td><td class="n">${gbp(r.gross)}</td><td class="n">${gbp(r.refund)}</td><td class="n">${gbp(r.net)}</td><td class="n">${gbp(r.vat)}</td><td class="n"><b>${gbp(r.exvat)}</b></td></tr>`).join("")}
  <tr class="tot"><td>Total</td><td class="n">${sum.n}</td><td class="n">${gbp(sum.gross)}</td><td class="n">${gbp(sum.refund)}</td><td class="n">${gbp(sum.net)}</td><td class="n">${gbp(sum.vat)}</td><td class="n"><b>${gbp(sum.exvat)}</b></td></tr></tbody></table>
  <p><button class="btn btn-ghost" id="csv" type="button">Download ${esc(m)} orders (CSV)</button></p>`;
  $("#csv").onclick = () => {
    const head = ["created", "ref", "kiosk", "date", "slot", "mode", "name", "workplace", "items", "subtotal", "discount", "code", "delivery", "total", "refunded", "vat_estimate"];
    const lines = [head.join(",")].concat(list.map((o) => [new Date(o.created * 1000).toISOString(), o.ref, o.kiosk, o.date, o.slot, o.mode, o.name, o.workplace, o.items.join("; "), o.subtotal, o.discount, o.code, o.delivery, o.total, o.refunded, vatOf(o)].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = `mozamaas-preorders-${m}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };
}
document.addEventListener("DOMContentLoaded", () => {
  $("#month").value = iso(new Date()).slice(0, 7);
  $("#gate").addEventListener("submit", (e) => { e.preventDefault(); load($("#pin").value.trim()); });
  document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; render(); }));
  document.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { kioskF = b.dataset.k; render(); }));
  $("#month").addEventListener("change", () => { if (view === "month") render(); });
  $("#reload").addEventListener("click", () => load(sessionStorage.getItem("mm-pin") || ""));
  $("#print").addEventListener("click", () => window.print());
  const saved = sessionStorage.getItem("mm-pin"); if (saved) load(saved);
});
})();
