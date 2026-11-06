/* The admin page: ?admin. Passphrase first. Bookings, hours, prices, dashboard, settings. */
import { api, errMsg } from './api.js?v=202611061344';
import { $, $$, esc, DAYS, DAYS_LONG, todayLondon, fmtDay, fmtDayLong, fmtMonth, fmtStamp, money, poundsToPence, penceToPounds, store, toast, copyText } from './util.js?v=202611061344';
import { chartSvg, tableHtml } from './charts.js?v=202611061344';

const PASS_KEY = 'pt_admin_pass';
const app = $('#app');
const S = {
  pass: '', tab: 'bookings', filter: 'upcoming', bookings: null, pending: 0, sched: null, settings: null, dash: null, month: todayLondon().slice(0, 7),
  avail: [], bands: [], busy: false, lockMsg: '', err: ''
};
const ORDER = [1, 2, 3, 4, 5, 6, 0];   // Monday first
const TABS = [['bookings', 'Bookings'], ['hours', 'Hours'], ['prices', 'Prices'], ['dashboard', 'Dashboard'], ['settings', 'Settings']];

const call = (action, params = {}) => api(action, { pin: S.pass, ...params });
const saved = () => { try { const v = sessionStorage.getItem(PASS_KEY); if (v) return v; } catch (e) { /* ignore */ } return store.get(PASS_KEY); };
function remember(v, keep) {
  store.delS(PASS_KEY); store.del(PASS_KEY);
  if (v) (keep ? store.set : store.setS)(PASS_KEY, v);
}

export async function start() {
  document.title = 'Admin';
  $('#hdr').innerHTML = `<div class="top"><span class="brand"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--navy)"/><path d="M7 12h3v8H7zM22 12h3v8h-3zM10 14h2v4h-2zM20 14h2v4h-2zM12 15h8v2h-8z" fill="var(--lime)"/></svg><span>Admin</span></span><button class="link" id="lock" hidden>Lock</button></div>`;
  $('#lock').onclick = lock;
  const p = saved();
  if (p) { S.pass = p; try { await call('login'); return unlocked(); } catch (e) { S.pass = ''; remember('', false); S.lockMsg = e.network ? errMsg(e) : ''; } }
  renderLock();
}
function lock() { S.pass = ''; remember('', false); Object.assign(S, { bookings: null, sched: null, settings: null, dash: null }); $('#lock').hidden = true; renderLock(); }

function renderLock() {
  app.innerHTML = `<section class="card state lockcard"><h1>Admin</h1><p>Enter your passphrase to see bookings and change the times.</p>
  <form id="unlock"><label>Passphrase<input name="p" type="password" autocomplete="current-password" required></label>
  <label class="check"><input type="checkbox" name="keep"> Remember on this device</label>
  <p class="err" id="uerr" role="alert" ${S.lockMsg ? '' : 'hidden'}>${esc(S.lockMsg)}</p><button class="btn primary" type="submit">Unlock</button></form></section>`;
  $('#unlock').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target); S.pass = String(fd.get('p') || '');
    const b = $('#unlock button'); b.disabled = true; b.textContent = 'Checking...';
    try { await call('login'); remember(S.pass, !!fd.get('keep')); S.lockMsg = ''; unlocked(); }
    catch (er) { S.pass = ''; b.disabled = false; b.textContent = 'Unlock'; const u = $('#uerr'); u.textContent = errMsg(er); u.hidden = false; }
  };
}

async function unlocked() {
  $('#lock').hidden = false;
  await loadBookings();
  show(S.pending ? 'bookings' : S.tab);
}
function show(tab) {
  S.tab = tab; S.err = '';
  const nav = `<nav class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" class="tab${k === tab ? ' on' : ''}" aria-selected="${k === tab}" data-tab="${k}">${l}${k === 'bookings' && S.pending ? `<b class="badge">${S.pending}</b>` : ''}</button>`).join('')}</nav>`;
  app.innerHTML = nav + `<div id="pane" class="pane">${loadingHtml()}</div>`;
  ({ bookings: paneBookings, hours: paneHours, prices: panePrices, dashboard: paneDashboard, settings: paneSettings })[tab]();
}
const loadingHtml = () => '<div class="loading"><span class="spin"></span><p>Loading</p></div>';
const pane = html => { const p = $('#pane'); if (p) p.innerHTML = html; };
function fail(e) {
  if (/passphrase|Too many wrong/i.test(errMsg(e))) { S.lockMsg = errMsg(e); return lock(); }
  toast(errMsg(e), 'bad');
}
async function guard(fn) { if (S.busy) return; S.busy = true; try { await fn(); } catch (e) { fail(e); } finally { S.busy = false; } }

/* ---------- bookings ---------- */
const PILL = { paid: ['Paid by card', 'ok'], cash_pending: ['Waiting for you', 'warn'], confirmed: ['Confirmed', 'ok'], declined: ['Declined', 'mute'], cancelled: ['Cancelled', 'mute'], refunded: ['Refunded', 'mute'] };
async function loadBookings() {
  const r = await call('bookings', { filter: S.filter }); S.bookings = r.bookings; S.pending = r.pending;
}
function bookingCard(b) {
  const pill = b.status === 'confirmed' && b.pay_method === 'cash' ? [b.cash_received_at ? 'Cash received' : 'Cash on the day', 'ok'] : PILL[b.status] || [b.status, 'mute'];
  const acts = [];
  if (b.status === 'cash_pending') acts.push(['approve', 'Approve', 'primary'], ['decline', 'Decline', 'ghost']);
  if (b.status === 'confirmed' && b.pay_method === 'cash' && !b.cash_received_at) acts.push(['cash_received', 'Mark cash received', 'primary'], ['cancel', 'Cancel', 'ghost']);
  if (b.status === 'paid') acts.push(['refund', 'Refund', 'ghost']);
  return `<article class="bk st-${b.status}"><div class="bk-when"><b>${esc(fmtDay(b.date))}</b><span>${b.start} to ${b.end}</span></div>
    <div class="bk-who"><b>${esc(b.name)}</b><span class="pill ${pill[1]}">${pill[0]}</span> <span class="amt">${money(b.price_pence)}</span>
      <p class="bk-meta"><a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.phone ? ` &middot; <a href="tel:${esc(b.phone.replace(/\s/g, ''))}">${esc(b.phone)}</a>` : ''}</p>
      ${b.note ? `<p class="bk-note">${esc(b.note)}</p>` : ''}${b.decline_reason && b.status === 'declined' ? `<p class="bk-note">${esc(b.decline_reason)}</p>` : ''}</div>
    <div class="bk-act">${acts.map(([a, l, k]) => `<button class="btn sm ${k}" data-bk="${a}" data-id="${esc(b.id)}">${l}</button>`).join('')}</div></article>`;
}
function paneBookings() {
  const chips = [['upcoming', 'Upcoming'], ['pending', 'Waiting for you' + (S.pending ? ` (${S.pending})` : '')], ['past', 'Past'], ['all', 'All']];
  const list = S.bookings || [];
  pane(`<div class="chips" role="group" aria-label="Show">${chips.map(([k, l]) => `<button class="chip${k === S.filter ? ' on' : ''}" data-filter="${k}" aria-pressed="${k === S.filter}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="bks">${list.map(bookingCard).join('')}</div>` : `<p class="empty">${S.filter === 'pending' ? 'Nothing is waiting for you.' : 'No bookings here yet.'}</p>`}`);
}
async function bookingAction(act, id) {
  const b = (S.bookings || []).find(x => x.id === id); if (!b) return;
  if (act === 'refund' && !confirm(`Refund ${money(b.price_pence)} to ${b.name}? This also cancels the session.`)) return;
  if (act === 'cancel' && !confirm(`Cancel ${b.name} on ${fmtDay(b.date)} ${b.start}?`)) return;
  if (act === 'decline' && !confirm(`Decline ${b.name} on ${fmtDay(b.date)} ${b.start}? They will be told.`)) return;
  await guard(async () => {
    await call(act, { id });
    await loadBookings(); toast({ approve: 'Approved. The client has been told.', decline: 'Declined.', cash_received: 'Cash marked as received.', refund: 'Refunded.', cancel: 'Cancelled.' }[act]);
    paneBookings(); updateBadge();
  });
}
function updateBadge() { const t = $('.tab[data-tab=bookings]'); if (t) t.innerHTML = 'Bookings' + (S.pending ? `<b class="badge">${S.pending}</b>` : ''); }

/* ---------- hours and one-off blocks ---------- */
async function loadSched() { S.sched = await call('schedule'); S.avail = S.sched.availability.map(a => ({ ...a })); S.bands = S.sched.prices.map(b => ({ ...b })); }
async function paneHours() { if (!S.sched) try { await loadSched(); } catch (e) { return fail(e); } drawHours(); }
function availRow(a, i) {
  return `<div class="arow" data-i="${i}"><input type="time" step="900" value="${esc(a.start)}" data-f="start" aria-label="Start"><span>to</span><input type="time" step="900" value="${esc(a.end)}" data-f="end" aria-label="End">
    <label class="check sm"><input type="checkbox" data-f="active" ${a.active ? 'checked' : ''}> On</label><button class="x" data-rm-avail="${i}" aria-label="Remove these hours">&times;</button></div>`;
}
function drawHours() {
  const days = ORDER.map(wd => {
    const rows = S.avail.map((a, i) => [a, i]).filter(([a]) => +a.weekday === wd);
    return `<div class="dayrow"><h3>${DAYS_LONG[wd]}</h3>${rows.length ? rows.map(([a, i]) => availRow(a, i)).join('') : '<p class="muted">Not working</p>'}<button class="btn sm ghost" data-add-avail="${wd}">Add hours</button></div>`;
  }).join('');
  const bl = S.sched.blackouts, mine = bl.filter(b => b.source !== 'nlb'), nlb = bl.filter(b => b.source === 'nlb');
  const row = (b, del) => `<li><span><b>${esc(fmtDay(b.date))}</b> ${b.start ? b.start + ' to ' + b.end : 'All day'}</span><span class="muted">${esc(b.reason)}</span>${del ? `<button class="x" data-rm-block="${esc(b.id)}" aria-label="Remove this block">&times;</button>` : ''}</li>`;
  pane(`<section class="card"><h2>Weekly hours</h2><p class="muted">Clients can book ${S.sched.slot_minutes} minute sessions inside these hours.</p><div class="week">${days}</div>
    <button class="btn primary" id="save-avail">Save hours</button></section>
    <section class="card"><h2>Days off and one-off blocks</h2>
    <form id="blockform" class="inline"><label>Date<input type="date" name="date" required min="${todayLondon()}"></label><label>From <em>(optional)</em><input type="time" name="start" step="900"></label><label>To<input type="time" name="end" step="900"></label>
      <label class="grow">Reason<input name="reason" maxlength="60" placeholder="Away, dentist..."></label><button class="btn primary" type="submit">Block this time</button></form>
    <p class="fine">Leave the times empty to block the whole day.</p>
    ${mine.length ? `<ul class="list">${mine.map(b => row(b, true)).join('')}</ul>` : '<p class="empty small">No blocks set.</p>'}
    ${nlb.length ? `<details><summary>${nlb.length} NLB sessions are blocking times automatically</summary><ul class="list">${nlb.map(b => row(b, false)).join('')}</ul></details>` : ''}</section>`);
}
function syncAvail() {
  $$('.arow').forEach(r => { const a = S.avail[+r.dataset.i]; if (!a) return; a.start = $('[data-f=start]', r).value; a.end = $('[data-f=end]', r).value; a.active = $('[data-f=active]', r).checked; });
}

/* ---------- prices ---------- */
async function panePrices() { if (!S.sched) try { await loadSched(); } catch (e) { return fail(e); } if (!S.settings) try { S.settings = await call('settings'); } catch (e) { return fail(e); } drawPrices(); }
function bandRow(b, i) {
  const days = String(b.weekdays || '').split(',').filter(Boolean).map(Number);
  return `<div class="band" data-i="${i}"><label class="grow">Name<input data-f="label" maxlength="40" value="${esc(b.label)}"></label>
    <fieldset class="dayset"><legend>Days <em>(none ticked means every day)</em></legend>${ORDER.map(wd => `<label class="dchip"><input type="checkbox" data-wd="${wd}" ${days.includes(wd) ? 'checked' : ''}><span>${DAYS[wd]}</span></label>`).join('')}</fieldset>
    <div class="trio"><label>From<input type="time" step="900" data-f="start" value="${esc(b.start)}"></label><label>To<input type="time" step="900" data-f="end" value="${esc(b.end)}"></label>
      <label>Price (&pound;)<input data-f="price" inputmode="decimal" value="${penceToPounds(+b.price_pence)}"></label><label>Priority<input data-f="priority" type="number" min="0" max="99" value="${+b.priority || 0}"></label></div>
    <button class="x" data-rm-band="${i}" aria-label="Remove this price band">&times;</button></div>`;
}
function drawPrices() {
  pane(`<section class="card"><h2>Standard price</h2><form id="defprice" class="inline"><label>One session (&pound;)<input name="p" inputmode="decimal" value="${penceToPounds(+S.settings.settings.default_price_pence)}"></label><button class="btn primary" type="submit">Save price</button></form>
    <p class="fine">This is the price for any time that no band below covers.</p></section>
    <section class="card"><h2>Price bands</h2><p class="muted">Charge more or less at certain days and times. If two bands cover the same time, the higher priority number wins.</p>
    <div class="bands">${S.bands.length ? S.bands.map(bandRow).join('') : '<p class="empty small">No bands. Every session uses the standard price.</p>'}</div>
    <div class="actions"><button class="btn ghost" id="add-band">Add a band</button><button class="btn primary" id="save-bands">Save bands</button></div></section>`);
}
function syncBands() {
  $$('.band').forEach(r => {
    const b = S.bands[+r.dataset.i]; if (!b) return;
    b.label = $('[data-f=label]', r).value; b.start = $('[data-f=start]', r).value; b.end = $('[data-f=end]', r).value;
    b.price_pence = poundsToPence($('[data-f=price]', r).value); b.priority = +$('[data-f=priority]', r).value || 0;
    b.weekdays = $$('[data-wd]:checked', r).map(x => x.dataset.wd).join(',');
  });
}

/* ---------- dashboard ---------- */
async function paneDashboard() {
  try { S.dash = await call('dashboard', { month: S.month }); } catch (e) { return fail(e); }
  drawDash();
}
function monthOptions() {
  const out = []; let [y, m] = todayLondon().slice(0, 7).split('-').map(Number);
  for (let i = 0; i < 12; i++) { const v = `${y}-${String(m).padStart(2, '0')}`; out.push(`<option value="${v}" ${v === S.month ? 'selected' : ''}>${fmtMonth(v)}</option>`); m--; if (!m) { m = 12; y--; } }
  return out.join('');
}
function drawDash() {
  const d = S.dash, c = d.cards, cl = d.clients;
  const tile = (label, v, cls = '') => `<div class="tile ${cls}"><span>${label}</span><strong>${money(v)}</strong></div>`;
  const maxTop = Math.max(1, ...cl.top.map(t => t.paid_pence)), srcTotal = Math.max(1, cl.by_source['pt-link'] + cl.by_source.manual);
  pane(`<div class="dash-head"><label>Month <select id="month">${monthOptions()}</select></label><button class="btn sm ghost" id="refresh">Refresh from Stripe</button>
    <span class="muted">${d.stripe_connected ? (d.cache_at ? 'Stripe data updated ' + esc(fmtStamp(d.cache_at)) : 'Not fetched yet. Press Refresh.') : 'Stripe is not connected yet. Card income needs it (Settings).'}</span></div>
    <section class="tiles" aria-label="${esc(fmtMonth(d.month))}">${tile('PT by card', c.pt_card, 'c1')}${tile('PT cash received', c.pt_cash, 'c2')}${tile('PT cash expected', c.pt_cash_expected, 'exp')}${tile('Other Stripe income', c.other, 'c3')}${tile('Total', c.total, 'tot')}</section>
    <section class="card"><h2>Last 12 months</h2>${chartSvg(d.months, d.month)}
      <ul class="legend"><li><i class="sw c1"></i>PT by card</li><li><i class="sw c2"></i>PT cash</li><li><i class="sw c3"></i>Other Stripe income</li></ul>
      <details><summary>Show the numbers</summary>${tableHtml(d.months)}</details></section>
    <section class="card"><h2>Clients</h2><div class="tiles small"><div class="tile"><span>All clients</span><strong>${cl.total}</strong></div><div class="tile"><span>New this month</span><strong>${cl.new_this_month}</strong></div><div class="tile"><span>Returning this month</span><strong>${cl.returning_this_month}</strong></div></div>
      <h3>Where they came from</h3>
      <div class="hbar"><span>Booking link</span><i style="width:${Math.round(100 * cl.by_source['pt-link'] / srcTotal)}%"></i><b>${cl.by_source['pt-link']}</b></div>
      <div class="hbar"><span>Added by hand</span><i class="alt" style="width:${Math.round(100 * cl.by_source.manual / srcTotal)}%"></i><b>${cl.by_source.manual}</b></div>
      <h3>Top clients by spend</h3>${cl.top.length ? cl.top.map(t => `<div class="hbar"><span>${esc(t.name)}</span><i style="width:${Math.round(100 * t.paid_pence / maxTop)}%"></i><b>${money(t.paid_pence)}</b></div>`).join('') : '<p class="empty small">No payments yet.</p>'}</section>`);
}

/* ---------- settings ---------- */
async function paneSettings() { try { S.settings = await call('settings'); } catch (e) { return fail(e); } drawSettings(); }
function drawSettings() {
  const r = S.settings, s = r.settings, st = r.stripe;
  pane(`<section class="card"><h2>Booking link</h2><p class="muted">Send this to clients. Anyone with it can book.</p>
    <div class="copy"><input readonly id="booklink" value="${esc(r.booking_link)}" aria-label="Booking link"><button class="btn sm primary" data-copy="booklink">Copy</button></div>
    <button class="btn sm ghost" id="rot-link">Make a new link</button> <span class="fine">The old link stops working at once.</span></section>
  <section class="card"><h2>Sessions</h2><form id="setform">
    <div class="grid2"><label>Business name<input name="business_name" maxlength="60" value="${esc(s.business_name)}"></label>
    <label>Session length (minutes)<select name="slot_minutes">${[30, 45, 60, 75, 90].map(n => `<option ${+s.slot_minutes === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label>Notice needed (hours)<input name="min_notice_hours" type="number" min="0" max="168" value="${esc(s.min_notice_hours)}"></label>
    <label>Booking window (weeks)<input name="horizon_weeks" type="number" min="1" max="26" value="${esc(s.horizon_weeks)}"></label>
    <label>Standard price (&pound;)<input name="price" inputmode="decimal" value="${penceToPounds(+s.default_price_pence)}"></label>
    <label>Email for alerts and new bookings<input name="alert_email" type="email" value="${esc(s.alert_email)}"></label></div>
    <label class="check"><input type="checkbox" name="block_nlb" ${s.block_nlb !== 'no' ? 'checked' : ''}> Block times when I am leading an NLB session</label>
    <button class="btn primary" type="submit">Save settings</button></form>
    <p class="fine">NLB sessions last synced: ${esc(r.last_sync ? fmtStamp(r.last_sync) : 'not yet')}. ${r.last_sync_error ? `<span class="errtxt">${esc(r.last_sync_error)}</span>` : ''} <button class="link" id="sync">Sync now</button></p></section>
  <section class="card"><h2>Show bookings in my Google Calendar</h2><p class="muted">Paid and confirmed bookings go on a calendar called PT Sessions. Give your Google email access to see it.</p>
    <form id="shareform" class="inline"><label class="grow">Google email<input name="email" type="email" required value="${esc(s.share_email)}" placeholder="you@gmail.com"></label><button class="btn primary" type="submit">Share my diary</button></form>
    <details><summary>Not a Google calendar? Use a subscribe link</summary><div class="copy"><input readonly id="feedlink" value="${esc(r.feed_url)}" aria-label="Calendar feed link"><button class="btn sm primary" data-copy="feedlink">Copy</button></div>
    <p class="fine">Outlook and Apple check this every few hours and show it read-only. <button class="link" id="rot-feed">Make a new link</button></p></details></section>
  <section class="card"><h2>Card payments (Stripe)</h2>
    <p class="status ${st.connected ? 'ok' : 'warn'}">${st.connected ? `Connected, ${st.mode} mode (key ending ${esc(st.last4)})` : 'Not connected yet'}</p>
    ${st.mode === 'test' ? '<p class="fine">Test mode: no real money moves. Test card 4242 4242 4242 4242, any future date, any CVC.</p>' : ''}
    <form id="stripeform"><label>Restricted secret key<input name="secret_key" type="password" autocomplete="off" spellcheck="false" placeholder="rk_test_..." required></label>
    <label>Publishable key<input name="publishable_key" autocomplete="off" spellcheck="false" placeholder="pk_test_..." required></label>
    <button class="btn primary" type="submit">${st.connected ? 'Replace keys' : 'Connect Stripe'}</button></form>
    <details><summary>Which permissions does the key need?</summary><ul class="plain"><li>Checkout Sessions: write</li><li>Charges: read</li><li>Balance: read</li><li>Refunds: write</li><li>PaymentIntents: read</li></ul>
    <p class="fine">Create it in Stripe under Developers, API keys, Create restricted key. Use test keys first. To go live, paste the live keys here.</p></details></section>
  <section class="card"><h2>Passphrase</h2><form id="pinform" class="inline"><label class="grow">New passphrase (8 to 64 characters)<input name="pin" type="password" autocomplete="new-password" minlength="8" maxlength="64" required></label><button class="btn primary" type="submit">Change passphrase</button></form></section>`);
}

/* ---------- events ---------- */
app.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.tab) return show(t.dataset.tab);
  if (t.dataset.filter) { S.filter = t.dataset.filter; return guard(async () => { await loadBookings(); paneBookings(); updateBadge(); }); }
  if (t.dataset.bk) return bookingAction(t.dataset.bk, t.dataset.id);
  if (t.dataset.addAvail !== undefined) { syncAvail(); S.avail.push({ weekday: +t.dataset.addAvail, start: '09:00', end: '12:00', active: true }); return drawHours(); }
  if (t.dataset.rmAvail !== undefined) { syncAvail(); S.avail.splice(+t.dataset.rmAvail, 1); return drawHours(); }
  if (t.id === 'save-avail') { syncAvail(); return guard(async () => { S.sched = await call('availability_save', { rows: S.avail }); S.avail = S.sched.availability.map(a => ({ ...a })); drawHours(); toast('Hours saved.'); }); }
  if (t.dataset.rmBlock) return guard(async () => { S.sched = await call('blackout_delete', { id: t.dataset.rmBlock }); drawHours(); toast('Block removed.'); });
  if (t.id === 'add-band') { syncBands(); S.bands.push({ id: '', label: 'New band', weekdays: '', start: '17:00', end: '20:00', price_pence: +(S.settings.settings.default_price_pence), priority: 1 }); return drawPrices(); }
  if (t.dataset.rmBand !== undefined) { syncBands(); S.bands.splice(+t.dataset.rmBand, 1); return drawPrices(); }
  if (t.id === 'save-bands') {
    syncBands();
    if (S.bands.some(b => b.price_pence === null)) return toast('Check the prices.', 'bad');
    return guard(async () => { S.sched = await call('prices_save', { rows: S.bands }); S.bands = S.sched.prices.map(b => ({ ...b })); drawPrices(); toast('Price bands saved.'); });
  }
  if (t.id === 'refresh') return guard(async () => { t.disabled = true; t.textContent = 'Refreshing...'; await call('stripe_refresh'); await paneDashboardQuiet(); toast('Updated from Stripe.'); });
  if (t.dataset.copy) { const el = $('#' + t.dataset.copy); if (el) { el.select(); toast(await copyText(el.value) ? 'Copied.' : 'Press and hold to copy.'); } return; }
  if (t.id === 'rot-link') { if (!confirm('Make a new booking link? The old link stops working at once, so send the new one to clients.')) return; return guard(async () => { S.settings = await call('rotate_link_key'); drawSettings(); toast('New link made.'); }); }
  if (t.id === 'rot-feed') { if (!confirm('Make a new calendar link? Calendars using the old one stop updating.')) return; return guard(async () => { S.settings = await call('rotate_feed_key'); drawSettings(); toast('New link made.'); }); }
  if (t.id === 'sync') return guard(async () => { t.textContent = 'Syncing...'; const r = await call('sync_now'); S.settings = await call('settings'); S.sched = null; drawSettings(); toast(`Synced. ${r.added} added, ${r.updated} changed, ${r.removed} removed.`); });
});
async function paneDashboardQuiet() { S.dash = await call('dashboard', { month: S.month }); drawDash(); }
app.addEventListener('change', e => { if (e.target.id === 'month') { S.month = e.target.value; guard(paneDashboardQuiet); } });
app.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, fd = new FormData(f);
  if (f.id === 'blockform') return guard(async () => { S.sched = await call('blackout_add', { date: fd.get('date'), start: fd.get('start') || '', end: fd.get('end') || '', reason: fd.get('reason') || '' }); drawHours(); toast('Blocked.'); });
  if (f.id === 'defprice') return guard(async () => {
    const p = poundsToPence(fd.get('p')); if (p === null) throw new Error('Check the price.');
    S.settings = await call('settings_save', { settings: { default_price_pence: p } }); S.sched = null; await loadSched(); drawPrices(); toast('Price saved.');
  });
  if (f.id === 'setform') return guard(async () => {
    const p = poundsToPence(fd.get('price')); if (p === null) throw new Error('Check the price.');
    S.settings = await call('settings_save', { settings: { business_name: fd.get('business_name'), slot_minutes: +fd.get('slot_minutes'), min_notice_hours: +fd.get('min_notice_hours'), horizon_weeks: +fd.get('horizon_weeks'), default_price_pence: p, alert_email: fd.get('alert_email'), block_nlb: fd.get('block_nlb') ? 'yes' : 'no' } });
    S.sched = null; drawSettings(); toast('Settings saved.');
  });
  if (f.id === 'shareform') return guard(async () => { const r = await call('share_diary', { email: fd.get('email') }); S.settings = r; drawSettings(); toast(r.result === 'already' ? 'That email already has access.' : 'Shared. Google will email an invite.'); });
  if (f.id === 'stripeform') return guard(async () => { S.settings = await call('stripe_connect', { secret_key: fd.get('secret_key'), publishable_key: fd.get('publishable_key') }); drawSettings(); toast('Stripe connected.'); });
  if (f.id === 'pinform') return guard(async () => { const n = String(fd.get('pin')); await call('set_pin', { new_pin: n }); S.pass = n; if (store.get(PASS_KEY)) remember(n, true); else remember(n, false); f.reset(); toast('Passphrase changed.'); });
});
