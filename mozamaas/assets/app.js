/* Moza Maas pre-orders — ordering app. Data: data/menu.json. Payments: Supabase function → Stripe Checkout. */
(() => {
"use strict";
const API = "https://rbjyyikzddnjecbnjvey.supabase.co/functions/v1/mm-preorder";
const KIOSKS = {
  Accrington: { brand: "YO! Sushi", short: "YO!", store: "Tesco Extra, 2 Eagle Street, Accrington BB5 1LJ", lat: 53.752544, lng: -2.369619, cls: "yo" },
  Padiham:    { brand: "YO! Sushi", short: "YO!", store: "Tesco, Wyre Street, Padiham BB12 8DQ", lat: 53.801489, lng: -2.310579, cls: "yo" },
  Colne:      { brand: "Panku",     short: "Panku", store: "Asda, Swinden Retail Park, Corporation Street, Colne BB8 8LU", lat: 53.848467, lng: -2.196852, cls: "panku" },
};
const SLOT_AM = "11:30–12:30", SLOT_PM = "16:00–17:00";
const CONTACT = "mozamaasltd@gmail.com";
let R = { // defaults; replaced by GET /config when the function answers
  minCollect: 20, minDeliver: 80, deliveryFee: 0, deliveryFreeOver: 80, deliveryMiles: 5,
  deliveryTimes: ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"],
  deliveryDays: { Accrington: [1, 2, 3, 4, 5], Padiham: [1, 2, 3, 4, 5], Colne: [1, 2, 3, 4, 5] }, pmSlotKiosks: ["Accrington", "Padiham"], pmSlotDays: [5, 6],
  bufferMin: 30, collectHours: 24, deliverHours: 48, largeSharers: 15, largeHours: 72,
  xmasFrom: "2026-12-19", xmasTo: "2026-12-24", xmasHours: 168, deliveryOffFrom: "2026-12-19", deliveryOffTo: "2027-01-03",
  blocked: ["2026-12-25", "2026-12-26", "2027-01-01"], caps: { Accrington: [6, 20], Padiham: [6, 20], Colne: [4, 12] },
  offerPct: 10, offerMin: 40, offerCloses: "2026-12-18",
};
const CODES = ["OFFICE10", "QR10", "TESCO10", "ASDA10", "LINKEDIN10", "FB10", "XMAS10", "LEAFLET10", "PRESS", "EMAIL", "WALKIN"];
let paymentsReady = null;
let OUT = {}; // kiosk -> [item names marked out of stock by the kiosk team]
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const gbp = (n) => "£" + (Math.round(n * 100) / 100).toFixed(2);
const gbp0 = (n) => Number.isInteger(n) ? "£" + n : gbp(n);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const atLocal = (date, hhmm) => { const [y, m, d] = date.split("-").map(Number); const [h, mi] = hhmm.split(":").map(Number); return new Date(y, m - 1, d, h, mi); };
const wd = (date) => atLocal(date, "12:00").getDay();
const fmtDay = (date, opts = { weekday: "long", day: "numeric", month: "long" }) => atLocal(date, "12:00").toLocaleDateString("en-GB", opts);
const miles = (a, b) => { const R = 3958.8, t = (x) => x * Math.PI / 180; const dLat = t(b.lat - a.lat), dLng = t(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

let MENU = {};
const S = Object.assign({ kiosk: "Accrington", baskets: {}, mode: "collect", date: "", slot: "", code: "", postcode: "" }, store.get("mm-order", {}));
S.baskets = S.baskets || {};
let pc = null; // {postcode, lat, lng, miles, ok}
let q = "";
const save = () => store.set("mm-order", { kiosk: S.kiosk, baskets: S.baskets, mode: S.mode, code: S.code, postcode: S.postcode });
const basket = () => (S.baskets[S.kiosk] = S.baskets[S.kiosk] || {});
const items = () => MENU[S.kiosk] || [];
const find = (n) => items().find((x) => x.name === n);
const isOut = (it) => { const o = OUT[S.kiosk] || []; return !!it && (o.includes(it.name) || (it.bundle || []).some(([n]) => o.includes(n))); };
const outInBasket = () => Object.keys(basket()).filter((n) => isOut(find(n)));

function counts() {
  let platters = 0, sub = 0, n = 0;
  for (const [name, qty] of Object.entries(basket())) {
    const it = find(name); if (!it) continue; sub += Math.round(it.price * 100) * qty; n += qty;
    if (it.bundle) for (const [bn, bq] of it.bundle) { const b = find(bn); if (b && b.category === "Sharers") platters += bq * qty; }
    else if (it.category === "Sharers") platters += qty;
  }
  return { platters, sub: sub / 100, n };
}
function needHours(date) {
  let h = S.mode === "deliver" ? R.deliverHours : R.collectHours; const c = counts();
  if (c.platters > R.largeSharers) h = Math.max(h, R.largeHours);
  if (date >= R.xmasFrom && date <= R.xmasTo) h = Math.max(h, R.xmasHours);
  return h;
}
function slotsFor(date) {
  if (S.mode === "deliver") return R.deliveryTimes;
  const s = [SLOT_AM]; if (R.pmSlotKiosks.includes(S.kiosk) && R.pmSlotDays.includes(wd(date))) s.push(SLOT_PM); return s;
}
function slotOk(date, slot) { const start = atLocal(date, slot.slice(0, 5)); return start - Date.now() >= (needHours(date) * 60 + R.bufferMin) * 60e3; }
function dayState(date) {
  if (R.blocked.includes(date) || R.blocked.includes(`${S.kiosk}:${date}`)) return { ok: false, why: "Closed" };
  if (S.mode === "deliver") {
    if (!(R.deliveryDays[S.kiosk] || []).includes(wd(date))) return { ok: false, why: "No delivery" };
    if (date >= R.deliveryOffFrom && date <= R.deliveryOffTo) return { ok: false, why: "No delivery" };
  }
  const any = slotsFor(date).some((s) => slotOk(date, s));
  return any ? { ok: true } : { ok: false, why: "Too soon" };
}
function totals() {
  const c = counts(); const code = (S.code || "").trim().toUpperCase();
  const codeKnown = CODES.includes(code); const offerOpen = iso(new Date()) <= R.offerCloses;
  const codeOk = codeKnown && offerOpen && c.sub >= R.offerMin;
  const disc = codeOk ? Math.round(Math.round(c.sub * 100) * R.offerPct / 100) / 100 : 0;
  const deliv = S.mode === "deliver" && c.n && R.deliveryFee > 0 && (c.sub - disc) < R.deliveryFreeOver ? R.deliveryFee : 0;
  return { ...c, code, codeKnown, codeOk, offerOpen, disc, deliv, total: Math.round((c.sub - disc + deliv) * 100) / 100 };
}

/* ---------- render: kiosks + menu ---------- */
function renderKioskPickers() {
  $$("[data-kiosk]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kiosk === S.kiosk)));
  const k = KIOSKS[S.kiosk];
  $$(".js-kiosk-name").forEach((e) => e.textContent = `${k.brand} ${S.kiosk}`);
  $$(".js-kiosk-store").forEach((e) => e.textContent = k.store);
  document.body.dataset.brand = k.cls;
}
function renderCats() {
  const cats = [...new Set(items().map((i) => i.category))];
  $("#cats").innerHTML = cats.map((c) => `<button class="chip" type="button" data-cat="${esc(c)}">${esc(c.replace(" (heat-me-up)", ""))}</button>`).join("");
  $$("#cats .chip").forEach((b) => b.addEventListener("click", () => { const el = document.getElementById("cat-" + slug(b.dataset.cat)); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }));
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function cardHtml(it) {
  const qn = basket()[it.name] || 0; const k = KIOSKS[S.kiosk];
  const tags = [it.popular && !it.bundle ? `<span class="tag hot">Popular</span>` : "", it.was ? `<span class="tag save">Save ${gbp(it.was - it.price)}</span>` : "", it.vegan ? `<span class="tag veg">Vegan</span>` : it.veg ? `<span class="tag veg">Veggie</span>` : "", it.raw_fish ? `<span class="tag fish">Raw fish</span>` : ""].join("");
  const img = it.img ? `<img src="${esc(it.img)}" alt="${esc(it.name)}" loading="lazy" decoding="async" width="400" height="300">` : `<div class="noimg">${esc(it.name)}</div>`;
  const pcs = it.pieces ? ` <span class="tag pc">${it.pieces} pcs</span>` : "";
  const out = isOut(it);
  const ctrl = out ? `<span class="soldout">Out of stock</span>` : qn ? `<div class="stepper" role="group" aria-label="Quantity of ${esc(it.name)}"><button type="button" data-d="-1" aria-label="Remove one">−</button><output>${qn}</output><button type="button" data-d="1" aria-label="Add one">+</button></div>` : `<button class="add" type="button" data-d="1" aria-label="Add ${esc(it.name)}">Add</button>`;
  return `<article class="card ${k.cls}${qn ? " in" : ""}${out ? " out" : ""}" data-name="${esc(it.name)}"><div class="ph">${img}<div class="tags">${tags}</div></div><div class="body"><h4>${esc(it.name)}${pcs}</h4>${it.desc ? `<p>${esc(it.desc)}</p>` : ""}<div class="foot"><span class="price">${gbp(it.price)}${it.was ? `<s>${gbp(it.was)}</s>` : ""}</span>${ctrl}</div></div></article>`;
}
function renderMenu() {
  const term = q.trim().toLowerCase(); const out = [];
  const cats = [...new Set(items().map((i) => i.category))];
  for (const c of cats) {
    const list = items().filter((i) => i.category === c && (!term || (i.name + " " + i.desc + (i.veg ? " veggie vegetarian" : "") + (i.vegan ? " vegan plant" : "")).toLowerCase().includes(term)));
    if (!list.length) continue;
    out.push(`<section class="cat" id="cat-${slug(c)}"><h3>${esc(c)}</h3><div class="grid">${list.map(cardHtml).join("")}</div></section>`);
  }
  $("#menu").innerHTML = out.join("") || `<p class="empty">Nothing matches “${esc(q)}”.</p>`;
}
function bindMenu() {
  $("#menu").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-d]"); if (!btn) return;
    const card = btn.closest(".card"); const name = card.dataset.name; change(name, Number(btn.dataset.d));
    card.outerHTML = cardHtml(find(name));
  });
}
function change(name, d) {
  if (d > 0 && isOut(find(name))) { toast(`${name} is out of stock at ${S.kiosk} right now.`); return; }
  const b = basket(); const v = Math.max(0, Math.min(60, (b[name] || 0) + d)); if (v) b[name] = v; else delete b[name];
  save(); renderBasket();
  if (d > 0) pulse();
}
function pulse() { const c = $("#hdr-count"); if (c) { c.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 260 }); } }

/* ---------- render: basket ---------- */
function renderBasket() {
  const t = totals(); const b = basket();
  $("#hdr-count").textContent = t.n; $("#hdr-total").textContent = t.n ? gbp(t.total) : "Basket";
  $("#bar").hidden = !t.n; $("#bar-count").textContent = `${t.n} item${t.n === 1 ? "" : "s"}`; $("#bar-total").textContent = gbp(t.total);
  const lines = Object.entries(b).map(([n, qn]) => { const it = find(n); if (!it) return ""; return `<li data-name="${esc(n)}"><div><div class="nm">${esc(n)}</div><div class="sub">${isOut(it) ? `<span class="soldout">Out of stock: please remove</span>` : `${gbp(it.price)} each`}</div></div><div class="mini"><button type="button" data-d="-1" aria-label="Remove one ${esc(n)}">−</button><output>${qn}</output><button type="button" data-d="1" aria-label="Add one ${esc(n)}">+</button></div></li>`; }).join("");
  $("#lines").innerHTML = lines || `<li class="empty">Your basket is empty. Add something tasty from the menu.</li>`;
  // mode
  $$("#seg button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.mode === S.mode)));
  $("#deliver-box").hidden = S.mode !== "deliver";
  const dd = (R.deliveryDays[S.kiosk] || []).map((n) => ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"][n]);
  const dayList = dd.length === 5 && !dd.includes("Saturdays") && !dd.includes("Sundays") ? "Monday to Friday" : dd.join(", ");
  $("#deliver-days").textContent = dd.length ? `${R.deliveryFee > 0 ? "Delivery" : "Free delivery"} to workplaces within ${R.deliveryMiles} miles of the kiosk, ${dayList}. Minimum order ${gbp0(R.minDeliver)}. Choose the time you'd like and we'll email to confirm it. Order at least ${R.deliverHours} hours before your delivery time.` : "Delivery isn't running from this kiosk at the moment.";
  renderDays(); renderSlots();
  // code
  const codeHint = $("#code-hint");
  if (!t.code) codeHint.textContent = `${R.offerPct}% off your workplace's first pre-order of ${gbp(R.offerMin)} or more.`;
  else if (!t.codeKnown) codeHint.textContent = "That code isn't recognised.";
  else if (!t.offerOpen) codeHint.textContent = "This offer has ended.";
  else if (!t.codeOk) codeHint.textContent = `Code accepted — it applies once your order reaches ${gbp(R.offerMin)}.`;
  else codeHint.textContent = `${R.offerPct}% off applied. One per workplace, first order only.`;
  // totals
  $("#t-sub").textContent = gbp(t.sub);
  $("#t-disc-row").hidden = !t.disc; $("#t-disc").textContent = "−" + gbp(t.disc); $("#t-disc-lbl").textContent = `First-order ${R.offerPct}% (${t.code})`;
  $("#t-del-row").hidden = S.mode !== "deliver"; $("#t-del").textContent = t.deliv ? gbp(t.deliv) : "Free";
  $("#t-total").textContent = gbp(t.total);
  // capacity hint
  const cap = (R.caps || {})[S.kiosk]; $("#cap").innerHTML = cap && t.platters > cap[0] ? `<div class="note warn">That's more sharers than we can make for one day at ${S.kiosk} right now (${cap[0]}). Split it across two days, or message us and we'll see what we can do.</div>` : (t.platters > R.largeSharers ? `<div class="note warn">Big order! More than ${R.largeSharers} sharers needs 72 hours' notice.</div>` : "");
  validate();
}
function renderDays() {
  const box = $("#days"); const out = []; const today = new Date();
  let firstOk = "";
  for (let i = 0; i < 28; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i); const ds = iso(d); const st = dayState(ds);
    if (st.ok && !firstOk) firstOk = ds;
    out.push(`<button type="button" class="day" data-date="${ds}" aria-pressed="${ds === S.date}" ${st.ok ? "" : "disabled"} title="${st.ok ? fmtDay(ds) : st.why}">${d.toLocaleDateString("en-GB", { weekday: "short" })}<b>${d.getDate()}</b>${d.toLocaleDateString("en-GB", { month: "short" })}</button>`);
  }
  if (!S.date || !dayState(S.date).ok) S.date = firstOk;
  box.innerHTML = out.join("");
  $$("#days .day").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.date === S.date)));
  $("#date-hint").textContent = S.date ? `${fmtDay(S.date)} · ${needHours(S.date)} hours' notice` : "No dates available in the next four weeks.";
}
function renderSlots() {
  const box = $("#slots"); if (!S.date) { box.innerHTML = ""; S.slot = ""; return; }
  const list = slotsFor(S.date); const ok = list.filter((s) => slotOk(S.date, s));
  if (!ok.includes(S.slot)) S.slot = ok[0] || "";
  box.innerHTML = list.map((s) => `<button type="button" class="chip" data-slot="${s}" aria-pressed="${s === S.slot}" ${ok.includes(s) ? "" : "disabled"}>${S.mode === "deliver" ? "" : "Collect "}${s}</button>`).join("");
  $("#slot-hint").textContent = S.mode === "deliver" ? "Requested delivery time. We'll email to confirm it, usually within one working day; our driver takes a photo at hand-over to confirm delivery." : (R.pmSlotKiosks.includes(S.kiosk) ? "Afternoon collection (16:00–17:00) is on Fridays and Saturdays." : "Collect between 11:30 and 12:30.");
}
function validate() {
  const t = totals(); const p = [];
  if (!t.n) p.push("add something to your basket");
  else if (t.sub < (S.mode === "deliver" ? R.minDeliver : R.minCollect)) p.push(`reach the ${gbp0(S.mode === "deliver" ? R.minDeliver : R.minCollect)} minimum${S.mode === "deliver" ? " for delivery" : ""}`);
  if (!S.date || !S.slot) p.push("choose a day and time");
  if (outInBasket().length) p.push("remove items that are out of stock");
  if (S.mode === "deliver" && !(pc && pc.ok && pc.postcode === normPc(S.postcode))) p.push("check your delivery postcode");
  if (!$("#consent").checked) p.push("tick to agree to the order terms");
  const msg = $("#status");
  if (paymentsReady === false) { msg.innerHTML = `<div class="note warn">Online payment is being switched on. You can build your order now; paying opens very soon.</div>`; }
  else msg.innerHTML = p.length ? `<div class="hint">To pay: ${p.join(", ")}.</div>` : "";
  const pay = $("#pay"); pay.disabled = !!p.length || paymentsReady === false; pay.textContent = p.length ? "Pay securely" : `Pay ${gbp(t.total)} securely`;
}

/* ---------- delivery postcode ---------- */
const normPc = (s) => String(s || "").toUpperCase().replace(/\s+/g, "").replace(/^(.+)(\d[A-Z]{2})$/, "$1 $2");
async function checkPostcode() {
  const raw = $("#postcode").value; S.postcode = raw; save(); const out = $("#pc-note");
  const clean = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(clean)) { pc = null; out.innerHTML = `<div class="note err">That doesn't look like a full UK postcode.</div>`; validate(); return; }
  out.innerHTML = `<div class="hint">Checking…</div>`;
  let r = null;
  for (const path of ["postcodes", "terminated_postcodes"]) { try { const res = await fetch(`https://api.postcodes.io/${path}/${clean}`); if (res.ok) { const j = await res.json(); if (j.result) { r = j.result; break; } } } catch {} }
  if (!r) { pc = null; out.innerHTML = `<div class="note err">We couldn't find that postcode.</div>`; validate(); return; }
  const d = miles(KIOSKS[S.kiosk], { lat: r.latitude, lng: r.longitude }); const ok = d <= R.deliveryMiles;
  pc = { postcode: normPc(clean), ok, miles: d };
  out.innerHTML = ok ? `<div class="note ok">${esc(r.postcode)} is ${d.toFixed(1)} miles from ${S.kiosk} — we deliver there.</div>` : `<div class="note err">${esc(r.postcode)} is ${d.toFixed(1)} miles away — outside our ${R.deliveryMiles}-mile delivery area. You can still collect.</div>`;
  validate();
}

/* ---------- pay ---------- */
const ERR = {
  payments_not_configured: "Online payment is being switched on. Please try again shortly.",
  too_soon: "That time is now too soon for the notice we need — pick a later slot.",
  below_minimum: "Your order is below the minimum.", bad_item: "An item has changed on the menu. Refresh the page and try again.",
  empty: "Your basket is empty.", unknown_kiosk: "Please choose a kiosk.", date_blocked: "The kiosk is closed that day — pick another.",
  no_delivery_that_day: "We don't deliver on that day — pick another or collect.", bad_slot: "Please pick a time slot.",
  bad_postcode: "We couldn't find that postcode.", out_of_area: "That address is outside our delivery area.",
  out_of_stock: "Something in your basket has just gone out of stock at this kiosk. It's marked in your basket: remove it and try again.",
  day_full: "That day is fully booked at this kiosk — please choose another day.", stripe: "The payment page couldn't open. Please try again in a minute.",
};
async function pay() {
  const t = totals(); const btn = $("#pay"); btn.disabled = true; btn.textContent = "Opening secure payment…";
  const body = { kiosk: S.kiosk, mode: S.mode, items: Object.entries(basket()), date: S.date, slot: S.slot, code: t.codeOk ? t.code : "", optin: $("#optin").checked, postcode: S.mode === "deliver" ? (pc && pc.postcode) : "" };
  try {
    const r = await fetch(API + "/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.url) { store.set("mm-last", { kiosk: S.kiosk, items: body.items, date: S.date, slot: S.slot, mode: S.mode, total: t.total }); location.href = j.url; return; }
    if (j.error === "payments_not_configured") paymentsReady = false;
    if (j.error === "out_of_stock") { await loadStock(); renderMenu(); renderBasket(); }
    toast(ERR[j.error] || "Something went wrong. Please try again.");
  } catch { toast("We couldn't reach the payment service. Check your connection and try again."); }
  validate();
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 6000); }

/* ---------- confirmation ---------- */
async function showConfirmation(id) {
  const box = $("#confirm"); box.hidden = false; $("#c-title").textContent = "Payment received"; $("#c-body").innerHTML = `<p>Loading your order…</p>`;
  let o = null; try { const r = await fetch(`${API}/session?id=${encodeURIComponent(id)}`); if (r.ok) o = await r.json(); } catch {}
  const last = store.get("mm-last", null);
  if (!o) o = last ? { paid: true, ref: "", kiosk: last.kiosk, store: KIOSKS[last.kiosk].store, brand: KIOSKS[last.kiosk].brand, date: last.date, slot: last.slot, mode: last.mode, items: last.items.map(([n, q]) => `${q} × ${n}`), total: last.total } : null;
  if (!o) { $("#c-body").innerHTML = `<p>Thank you — your payment went through. Your receipt is on its way by email.</p>`; return; }
  $("#c-title").textContent = o.firstName ? `Thanks, ${o.firstName}!` : "Thank you!";
  $("#c-ref").textContent = o.ref ? `ORDER ${o.ref}` : "ORDER CONFIRMED";
  const when = o.mode === "deliver" ? `${fmtDay(o.date)}, requested for ${o.slot} (we'll email to confirm)` : `${fmtDay(o.date)}, ${o.slot}`;
  $("#c-body").innerHTML = `<dl><dt>${o.mode === "deliver" ? "Delivery" : "Collect"}</dt><dd>${esc(when)}</dd><dt>Where</dt><dd>${o.mode === "deliver" ? "To your workplace" : `${esc(o.brand)} counter, ${esc(o.store)}`}</dd><dt>Paid</dt><dd>${gbp(o.total)}</dd></dl><ul class="ticks">${o.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="hint" style="margin-top:14px">We make it fresh on the morning. Your card receipt comes from Stripe. Keep it chilled and eat it on the day. Need to change or cancel? Email ${CONTACT} at least 24 hours before for a full refund.</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><button class="btn btn-primary" id="ics" type="button">Add to calendar</button><button class="btn btn-ghost" id="c-close" type="button">Back to the menu</button></div>`;
  $("#ics").onclick = () => downloadIcs(o); $("#c-close").onclick = () => { box.hidden = true; };
  if (o.kiosk && S.baskets[o.kiosk]) { S.baskets[o.kiosk] = {}; save(); renderBasket(); renderMenu(); }
}
function downloadIcs(o) {
  const [a, b] = o.slot.split("–"); const st = atLocal(o.date, a), en = b ? atLocal(o.date, b) : new Date(st.getTime() + 60 * 60e3);
  const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Moza Maas//Pre-order//EN", "BEGIN:VEVENT", `UID:${o.ref || Date.now()}@mozamaas`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(st)}`, `DTEND:${z(en)}`, `SUMMARY:${o.mode === "deliver" ? "Sushi delivery" : "Collect sushi order"} (${o.brand} ${o.kiosk})`, `LOCATION:${(o.mode === "deliver" ? "Your workplace" : o.store).replace(/,/g, "\\,")}`, `DESCRIPTION:Order ${o.ref}. ${o.items.join("; ").replace(/,/g, "\\,")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a2 = document.createElement("a"); a2.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a2.download = "sushi-order.ics"; document.body.appendChild(a2); a2.click(); a2.remove();
}

/* ---------- stock ---------- */
async function loadStock() { try { const r = await fetch(API + "/stock", { cache: "no-store" }); if (r.ok) OUT = (await r.json()).out || {}; } catch { /* keep last known */ } }

/* ---------- mobile sheet ---------- */
function openSheet(open) { $("#basket").classList.toggle("open", open); $("#scrim").hidden = !open; document.body.style.overflow = open ? "hidden" : ""; }

/* ---------- boot ---------- */
async function boot() {
  try { const r = await fetch("data/menu.json", { cache: "no-cache" }); MENU = (await r.json()).kiosks; } catch { $("#menu").innerHTML = `<p class="note err">The menu couldn't load. Please refresh.</p>`; return; }
  // deep links: #padiham, #colne-qr10, ?paid=1&session_id=…
  const toks = location.hash.replace("#", "").toLowerCase().split("-").filter(Boolean);
  for (const t of toks) { const k = Object.keys(KIOSKS).find((x) => x.toLowerCase() === t); if (k) S.kiosk = k; const c = CODES.find((x) => x.toLowerCase() === t); if (c) S.code = c; }
  if (!MENU[S.kiosk]) S.kiosk = "Accrington";
  $("#code").value = S.code || ""; $("#postcode").value = S.postcode || "";
  renderKioskPickers(); renderCats(); renderMenu(); renderBasket(); bindMenu();
  $$("[data-kiosk]").forEach((b) => b.addEventListener("click", () => { S.kiosk = b.dataset.kiosk; pc = null; $("#pc-note").innerHTML = ""; save(); renderKioskPickers(); renderCats(); renderMenu(); renderBasket(); if (b.closest(".hero")) document.getElementById("order").scrollIntoView({ behavior: "smooth" }); }));
  $("#search").addEventListener("input", (e) => { q = e.target.value; renderMenu(); });
  $("#lines").addEventListener("click", (e) => { const b = e.target.closest("button[data-d]"); if (!b) return; const n = b.closest("li").dataset.name; change(n, Number(b.dataset.d)); renderMenu(); });
  $$("#seg button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; save(); renderBasket(); }));
  $("#days").addEventListener("click", (e) => { const b = e.target.closest(".day"); if (!b || b.disabled) return; S.date = b.dataset.date; renderBasket(); });
  $("#slots").addEventListener("click", (e) => { const b = e.target.closest("[data-slot]"); if (!b || b.disabled) return; S.slot = b.dataset.slot; renderBasket(); });
  $("#code").addEventListener("input", (e) => { S.code = e.target.value; save(); renderBasket(); });
  $("#pc-check").addEventListener("click", checkPostcode);
  $("#postcode").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); checkPostcode(); } });
  $("#postcode").addEventListener("input", () => { pc = null; $("#pc-note").innerHTML = ""; validate(); });
  ["#consent", "#optin"].forEach((s) => $(s).addEventListener("change", validate));
  $("#pay").addEventListener("click", pay);
  $("#bar-open").addEventListener("click", () => openSheet(true)); $("#scrim").addEventListener("click", () => openSheet(false)); $("#sheet-close").addEventListener("click", () => openSheet(false));
  $("#hdr-basket").addEventListener("click", (e) => { if (matchMedia("(max-width:1060px)").matches) { e.preventDefault(); openSheet(true); } });
  if (S.postcode && S.mode === "deliver") checkPostcode();
  const qs = new URLSearchParams(location.search);
  if (qs.get("paid") && qs.get("session_id")) showConfirmation(qs.get("session_id"));
  if (qs.get("cancelled")) toast("Payment cancelled — your basket is still here.");
  if (qs.toString()) history.replaceState(null, "", location.pathname + location.hash);
  // live stock and rules
  loadStock().then(() => { renderMenu(); renderBasket(); });
  try { const r = await fetch(API + "/config"); if (r.ok) { const j = await r.json(); paymentsReady = !!j.paymentsReady; R = Object.assign(R, j.rules || {}); renderBasket(); } } catch { /* keep defaults */ }
  setInterval(renderBasket, 60e3); // slots close as the clock moves
  setInterval(() => loadStock().then(() => { renderMenu(); renderBasket(); }), 5 * 60e3);
}
document.addEventListener("DOMContentLoaded", boot);
})();
