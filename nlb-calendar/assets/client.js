/* The client booking page: ?c=<link key>. Pick a day and time, hold it for 2 minutes, pay by card or ask to pay on the day. */
import { api, errMsg } from './api.js?v=202611061853';
import { MOCK } from './config.js?v=202611061853';
import { $, $$, esc, DAYS, MONTHS, todayLondon, addDays, weekday, fmtDayLong, fmtDay, money, clock, store, randomToken, toast } from './util.js?v=202611061853';

const KEY_TOKEN = 'pt_client_token', KEY_ME = 'pt_client_details';
const app = $('#app');
let cfg = null, linkKey = '';
const S = {
  phase: 'pick',            // pick | details | pay | wait | done
  slots: {}, days: [], sel: '', msg: '', msgKind: '', loadErr: '',
  hold: null, deadline: 0, total: 120, secret: '', result: null, busy: false, form: { name: '', email: '', phone: '', note: '' }
};
let token = '', tick = null, refresh = null, checkout = null;

function getToken() {
  if (token) return token;
  token = store.get(KEY_TOKEN);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) { token = randomToken(); store.set(KEY_TOKEN, token); }
  return token;
}
const call = (action, params = {}) => api(action, { key: linkKey, ...params });

export async function start(key) {
  linkKey = key || '';
  $('#hdr').innerHTML = header();
  try { const me = JSON.parse(store.get(KEY_ME) || '{}'); S.form = { ...S.form, name: me.name || '', email: me.email || '', phone: me.phone || '' }; } catch (e) { /* ignore */ }
  if (!linkKey) return invalid();
  app.innerHTML = loading('Opening the booking page');
  try {
    cfg = await call('config');
  } catch (e) {
    if (/isn't valid/.test(errMsg(e))) return invalid();
    return failed(errMsg(e));
  }
  document.title = 'Book a session with ' + coach();
  $('#hdr').innerHTML = header();
  await loadSlots();
  render();
  refresh = setInterval(() => { if (S.phase === 'pick' && !document.hidden) loadSlots().then(() => { if (S.phase === 'pick') renderPick(); }); }, 60000);
}

const coach = () => (cfg ? cfg.business_name.replace(/\s+PT$/i, '') : 'Chadrack');
function header() {
  const name = cfg ? cfg.business_name : 'Chadrack PT';
  return `<div class="top"><a class="brand" href="" aria-label="${esc(name)}"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--navy)"/><path d="M7 12h3v8H7zM22 12h3v8h-3zM10 14h2v4h-2zM20 14h2v4h-2zM12 15h8v2h-8z" fill="var(--lime)"/></svg><span>${esc(name)}</span></a><span class="top-note">Personal training</span></div>`;
}
const loading = t => `<div class="loading"><span class="spin"></span><p>${esc(t)}</p></div>`;
function invalid() {
  app.innerHTML = `<section class="card state"><h1>Link not valid</h1><p>This booking link isn't valid. Ask Chadrack for a new one.</p></section>`;
}
function failed(msg) {
  app.innerHTML = `<section class="card state"><h1>Can't load the times</h1><p>${esc(msg)}</p><button class="btn" id="retry">Try again</button></section>`;
  $('#retry').onclick = () => start(linkKey);
}

/* ---------- slots ---------- */
async function loadSlots() {
  const from = todayLondon(), to = addDays(from, cfg.horizon_weeks * 7 - 1);
  try {
    const out = {};
    for (let a = from; a <= to; a = addDays(a, 60)) {
      const b = addDays(a, 59) < to ? addDays(a, 59) : to;
      (await call('slots', { from: a, to: b })).slots.forEach(s => (out[s.date] = out[s.date] || []).push(s));
    }
    S.slots = out; S.loadErr = '';
  } catch (e) { S.loadErr = errMsg(e); }
  S.days = []; for (let d = from; d <= to; d = addDays(d, 1)) S.days.push(d);
  const free = d => (S.slots[d] || []).some(s => s.status === 'free');
  if (!S.sel || !S.days.includes(S.sel)) S.sel = S.days.find(free) || S.days[0];
}

function render() {
  clearInterval(tick); tick = null;
  if (S.phase === 'pick') renderPick();
  else if (S.phase === 'details') renderDetails();
  else if (S.phase === 'pay') renderPay();
  else if (S.phase === 'wait') app.innerHTML = hero(false) + `<section class="card state">${loading('Checking your payment')}</section>`;
  else renderDone();
  if (S.hold && (S.phase === 'details' || S.phase === 'pay')) { tick = setInterval(onTick, 250); onTick(); }
}

function hero(full = true, title = 'Nearly there.') {
  return `<section class="hero"><div class="hero-in"><p class="kicker">Book with ${esc(coach())}</p><h1>${full ? 'Pick a time that suits you.' : esc(title)}</h1>` +
    (full ? `<ul class="trust"><li>Your time is held for 2 minutes while you check out</li><li>${cfg && cfg.card_enabled ? `Pay by card now, or on the day once ${esc(coach())} confirms` : `Pay on the day once ${esc(coach())} confirms`}</li></ul>` : '') + `</div></section>`;
}
function banner() { return S.msg ? `<div class="banner ${S.msgKind}" role="alert">${esc(S.msg)}</div>` : ''; }

/* ---------- step 1: day and time ---------- */
function dayCard(d) {
  const list = S.slots[d] || [], free = list.filter(s => s.status === 'free').length, [, m, n] = d.split('-').map(Number), sel = d === S.sel;
  const off = d === S.days[0] ? ` style="--col:${weekday(d) || 7}"` : '';
  return `<button class="day${sel ? ' on' : ''}${free ? '' : ' none'}" data-day="${d}" role="radio" aria-checked="${sel}" ${free ? '' : 'aria-disabled="true"'}${off}>` +
    `<span class="dow">${DAYS[weekday(d)]}</span><span class="dom">${n}</span><span class="mon">${MONTHS[m - 1]}</span><span class="free">${free ? free + ' free' : 'Full'}</span></button>`;
}
function slotBtn(s) {
  return s.status === 'free'
    ? `<button class="slot" data-start="${s.start}"><span class="t">${s.start}</span><span class="p">${money(s.price_pence)}</span></button>`
    : `<button class="slot gone" disabled aria-label="${s.start} not available"><span class="t">${s.start}</span><span class="p">Taken</span></button>`;
}
function renderPick() {
  const list = S.slots[S.sel] || [], any = Object.values(S.slots).some(l => l.some(s => s.status === 'free'));
  app.innerHTML = hero() + banner() + (S.loadErr ? `<div class="banner bad" role="alert">${esc(S.loadErr)}</div>` : '') + `
  <div class="pick">
    <section class="card step" aria-labelledby="s1"><h2 id="s1"><span class="num">1</span>Choose a day</h2>
      <div class="dows" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
      <div class="days" role="radiogroup" aria-label="Day">${S.days.map(dayCard).join('')}</div>
    </section>
    <section class="card step" aria-labelledby="s2"><h2 id="s2"><span class="num">2</span>Choose a time</h2>
      ${!any ? `<p class="empty">There are no free times right now. Check back soon or message ${esc(coach())}.</p>` : `
      <p class="day-title">${esc(S.sel ? fmtDayLong(S.sel) : '')}</p>
      ${list.length ? `<div class="slots">${list.map(slotBtn).join('')}</div><p class="fine">${cfg.slot_minutes} minute sessions. Greyed times are taken.</p>` : `<p class="empty">No times on this day. Pick another day.</p>`}`}
    </section>
  </div>
  ${cfg.card_enabled ? `<p class="foot">Card payments are handled by Stripe. ${esc(cfg.business_name)} never sees your card number.</p>` : ''}`;
}

async function pickSlot(start) {
  if (S.busy) return;
  S.busy = true; S.msg = '';
  $$('.slot').forEach(b => { b.disabled = true; });
  try {
    const r = await call('hold', { client_token: getToken(), date: S.sel, start });
    S.hold = r.booking; startClock(r.booking.seconds_left); S.phase = 'details'; S.secret = '';
    render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    S.msg = errMsg(e); S.msgKind = 'bad'; await loadSlots(); renderPick();
  } finally { S.busy = false; }
}
function startClock(sec) { S.total = (cfg && cfg.hold_seconds) || 120; S.deadline = performance.now() + sec * 1000; }

/* ---------- countdown ---------- */
function clockHtml() {
  return `<div class="hold" id="hold"><div class="hold-row"><span class="hold-label">Your time is held for</span><span class="hold-time" id="holdtime" role="timer" aria-live="off">2:00</span></div><div class="bar"><i id="holdbar"></i></div></div>`;
}
function onTick() {
  const left = Math.max(0, Math.ceil((S.deadline - performance.now()) / 1000));
  const t = $('#holdtime'), bar = $('#holdbar'), box = $('#hold');
  if (t) t.textContent = clock(left);
  if (bar) bar.style.width = Math.max(0, Math.min(100, (S.deadline - performance.now()) / (S.total * 10))) + '%';
  if (box) box.classList.toggle('low', left <= 30);
  if (left <= 0) expired();
}
async function expired() {
  clearInterval(tick); tick = null;
  const h = S.hold; S.hold = null; unmount();
  if (h) { try { await call('release', { booking_id: h.id, client_token: getToken() }); } catch (e) { /* the server expires it anyway */ } }
  S.phase = 'pick'; S.msg = 'Time ran out, the slot is free again.'; S.msgKind = 'warn';
  await loadSlots(); render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function chooseAnother() {
  clearInterval(tick); tick = null;
  const h = S.hold; S.hold = null; unmount(); S.phase = 'pick'; S.msg = ''; render();
  if (h) { try { await call('release', { booking_id: h.id, client_token: getToken() }); } catch (e) { /* ignore */ } await loadSlots(); if (S.phase === 'pick') renderPick(); }
}

/* ---------- step 3: details ---------- */
function summary() {
  const h = S.hold;
  return `<div class="ticket"><div class="tk-main"><p class="tk-day">${esc(fmtDayLong(h.date))}</p><p class="tk-time">${h.start}<span> to ${h.end}</span></p></div><div class="tk-price"><span>Price</span><strong>${money(h.price_pence)}</strong></div></div>`;
}
function renderDetails() {
  const f = S.form;
  app.innerHTML = hero(false) + `<div class="narrow">${clockHtml()}${banner()}
  <section class="card step"><h2><span class="num">3</span>Your details</h2>${summary()}
    <form id="form" novalidate autocomplete="on">
      <label>Name<input name="name" autocomplete="name" required maxlength="60" value="${esc(f.name)}"></label>
      <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" required maxlength="120" value="${esc(f.email)}"><small>Your receipt and confirmation go here.</small></label>
      <label>Phone <em>(optional)</em><input name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="30" value="${esc(f.phone)}"></label>
      <label>Anything ${esc(coach())} should know? <em>(optional)</em><textarea name="note" rows="2" maxlength="300">${esc(f.note)}</textarea></label>
      <p class="err" id="err" role="alert" hidden></p>
      <div class="actions">
        ${cfg.card_enabled ? `<button class="btn primary" type="submit" data-pay="card">Pay now ${money(S.hold.price_pence)}</button>` : ''}
        <button class="btn ${cfg.card_enabled ? 'ghost' : 'primary'}" type="submit" data-pay="cash">Pay on the day (cash)</button>
      </div>
      <p class="fine">${cfg.card_enabled ? '' : 'Card payments are not switched on yet. '}Paying on the day: ${esc(coach())} confirms by email first, and your slot stays held for you until he does.</p>
      <button type="button" class="link" id="other">Choose another time</button>
    </form></section></div>`;
  S.msg = '';
}
function readForm() {
  const fd = new FormData($('#form'));
  return { name: String(fd.get('name') || '').trim(), email: String(fd.get('email') || '').trim(), phone: String(fd.get('phone') || '').trim(), note: String(fd.get('note') || '').trim() };
}
function formError(f) {
  if (!f.name) return 'Add your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) return 'Enter a valid email address.';
  if (!/^[0-9+()\s-]*$/.test(f.phone)) return 'Check the phone number.';
  return '';
}
function showErr(m) { const e = $('#err'); if (e) { e.textContent = m; e.hidden = !m; } }
async function submit(how) {
  if (S.busy) return;
  const f = readForm(); S.form = f;
  const bad = formError(f); if (bad) { showErr(bad); const el = $(bad.includes('name') ? 'input[name=name]' : 'input[name=email]'); if (el) el.focus(); return; }
  showErr(''); store.set(KEY_ME, JSON.stringify({ name: f.name, email: f.email, phone: f.phone }));
  S.busy = true; const btns = $$('#form button'); btns.forEach(b => { b.disabled = true; });
  const label = $(`[data-pay=${how}]`); const old = label && label.textContent; if (label) label.textContent = how === 'card' ? 'Opening payment...' : 'Sending...';
  try {
    if (how === 'cash') {
      const r = await call('request_cash', { booking_id: S.hold.id, client_token: getToken(), ...f });
      finishHold(); S.result = { kind: 'cash', booking: r.booking }; S.phase = 'done'; render();
    } else {
      const r = await call('create_checkout', { booking_id: S.hold.id, client_token: getToken(), ...f });
      S.secret = r.client_secret; S.pk = r.publishable_key; S.phase = 'pay'; render();
      await mountCheckout();
    }
  } catch (e) {
    const m = errMsg(e);
    if (/Time ran out/.test(m)) return expired();
    btns.forEach(b => { b.disabled = false; }); if (label) label.textContent = old; showErr(m);
  } finally { S.busy = false; }
}
function finishHold() { clearInterval(tick); tick = null; }

/* ---------- card payment ---------- */
function renderPay() {
  app.innerHTML = hero(false) + `<div class="narrow">${clockHtml()}${banner()}
  <section class="card step"><h2><span class="num">4</span>Pay ${money(S.hold.price_pence)}</h2>${summary()}
    <div id="checkout" class="checkout" aria-live="polite"></div>
    <button type="button" class="link" id="back">Back to my details</button></section></div>`;
}
function unmount() { try { if (checkout) checkout.destroy(); } catch (e) { /* ignore */ } checkout = null; }
function loadStripeJs() {
  if (window.Stripe) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.async = true;
    s.onload = ok; s.onerror = () => no(new Error('The card form could not load. Check your signal, or pay on the day.'));
    document.head.appendChild(s);
  });
}
async function mountCheckout() {
  const box = $('#checkout'); if (!box) return;
  if (MOCK) {
    box.innerHTML = `<div class="fake"><p class="fake-tag">Demo payment form</p><div class="fake-card"><span>Card number</span><b>4242 4242 4242 4242</b></div><div class="fake-row"><div class="fake-card"><span>Expiry</span><b>12 / 34</b></div><div class="fake-card"><span>CVC</span><b>123</b></div></div>
      <div class="actions"><button class="btn primary" id="fakepay">Pay (test) ${money(S.hold.price_pence)}</button><button class="btn ghost" id="fakecancel">Cancel</button></div></div>`;
    $('#fakepay').onclick = async () => { (await import('./mock.js?v=202611061853')).mockPay(S.hold.id); onPaid(); };
    $('#fakecancel').onclick = () => backToDetails();
    return;
  }
  box.innerHTML = loading('Loading the card form');
  try {
    await loadStripeJs();
    const stripe = window.Stripe(S.pk || cfg.stripe_publishable_key);
    unmount();
    const mount = stripe.createEmbeddedCheckoutPage ? stripe.createEmbeddedCheckoutPage.bind(stripe) : stripe.initEmbeddedCheckout.bind(stripe);
    checkout = await mount({ clientSecret: S.secret, onComplete: onPaid });
    box.innerHTML = ''; checkout.mount('#checkout');
  } catch (e) { box.innerHTML = `<p class="err">${esc(errMsg(e))}</p>`; }
}
function backToDetails() { unmount(); S.phase = 'details'; render(); }
async function onPaid() {
  const h = S.hold; clearInterval(tick); tick = null; unmount();
  S.phase = 'wait'; render();
  let r = null;
  for (let i = 0; i < 12; i++) {
    try { r = await call('confirm', { booking_id: h.id, client_token: getToken() }); } catch (e) { r = null; }
    if (r && ['paid', 'refunded'].includes(r.status)) break;
    await new Promise(ok => setTimeout(ok, MOCK ? 200 : 1500));
  }
  S.hold = null; S.result = { kind: r && r.status === 'paid' ? 'paid' : r && r.status === 'refunded' ? 'refunded' : 'unsure', booking: (r && r.booking) || h };
  S.phase = 'done'; render();
}

/* ---------- result ---------- */
function renderDone() {
  const r = S.result, b = r.booking, mail = esc(S.form.email || b.email || 'your email');
  const tick = `<svg class="tick" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="var(--lime)"/><path d="M14 25l7 7 13-15" fill="none" stroke="var(--navy)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ticket = `<div class="ticket done"><div class="tk-main"><p class="tk-day">${esc(fmtDayLong(b.date))}</p><p class="tk-time">${b.start}<span> to ${b.end}</span></p></div><div class="tk-price"><span>${r.kind === 'cash' ? 'In cash' : 'Paid'}</span><strong>${money(b.price_pence)}</strong></div></div>`;
  let body;
  if (r.kind === 'paid') body = `${tick}<h1>You're booked</h1>${ticket}<p>Thanks, ${esc((S.form.name || b.name || '').split(' ')[0])}. A confirmation is on its way to ${mail}. See you then.</p>`;
  else if (r.kind === 'cash') body = `${tick}<h1>Request sent</h1>${ticket}<p>${esc(coach())} will confirm by email at ${mail}. Your time stays held for you until he does. Please bring ${money(b.price_pence)} in cash.</p>`;
  else if (r.kind === 'refunded') body = `<h1>Sorry, that time was taken</h1><p>Someone else booked it a moment before your payment cleared. We have refunded ${money(b.price_pence)} in full. It usually reaches your card in 5 to 10 working days.</p><button class="btn primary" id="again">Pick another time</button>`;
  else body = `<h1>We're checking your payment</h1><p>It's taking a little longer than usual. If the money has left your account you'll get an email shortly. If not, you can try again.</p><button class="btn primary" id="again">Pick a time</button>`;
  app.innerHTML = hero(false, r.kind === 'paid' || r.kind === 'cash' ? 'Thank you.' : r.kind === 'refunded' ? 'Sorry about that.' : 'One moment.') + `<div class="narrow"><section class="card state ${r.kind}">${body}${r.kind === 'paid' || r.kind === 'cash' ? '<button class="btn ghost" id="again">Book another session</button>' : ''}</section></div>`;
}

/* ---------- events ---------- */
app.addEventListener('click', e => {
  const day = e.target.closest('[data-day]');
  if (day && S.phase === 'pick') { S.sel = day.dataset.day; S.msg = ''; renderPick(); const on = $('.day.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); const t = $('#s2'); if (t && window.matchMedia('(max-width: 899px)').matches) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const slot = e.target.closest('.slot[data-start]');
  if (slot) return pickSlot(slot.dataset.start);
  if (e.target.closest('#other')) return chooseAnother();
  if (e.target.closest('#back')) return backToDetails();
  if (e.target.closest('#again')) { S.phase = 'pick'; S.result = null; S.msg = ''; S.hold = null; loadSlots().then(render); render(); }
});
app.addEventListener('submit', e => {
  e.preventDefault();
  const how = (e.submitter && e.submitter.dataset.pay) || 'card';
  submit(how);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && (S.phase === 'details' || S.phase === 'pay')) onTick(); });
