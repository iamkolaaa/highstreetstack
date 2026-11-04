import { api, errMsg } from './api.js?v=202611042019';
import { MOCK } from './config.js?v=202611042019';
import { parseCaption } from './parser.js?v=202611042019';

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? String(u) : '');
const pad = n => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const todayLondon = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const parts = iso => iso.split('-').map(Number);
const fmtDay = iso => { if (!iso) return ''; const [y, m, d] = parts(iso); return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`; };
const fmtDayLong = iso => { const [y] = parts(iso); return fmtDay(iso) + (y !== +todayLondon().slice(0, 4) ? ' ' + y : ''); };
const addDays = (iso, n) => { const [y, m, d] = parts(iso); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const mins = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const addMins = (t, n) => { const m = Math.min(mins(t) + n, 1439); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const fmtSync = s => { const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s || ''); return m ? `${fmtDay(m[1])} at ${m[2]}` : String(s || ''); };

const TYPE_LABEL = { 'run-club': 'Run club', 'social-run': 'Social run', 'long-run': 'Long run', boxing: 'Boxing', track: 'Track' };
const typeClass = e => (e.calendar === 'pt' ? 't-pt' : TYPE_LABEL[e.type_slug] ? 't-' + e.type_slug : 't-other');
const chipLabel = e => (e.source === 'pt' ? 'PT' : e.source === 'gcal' ? 'Google Calendar' : TYPE_LABEL[e.type_slug] || (e.source === 'instagram' ? 'Instagram' : e.source === 'manual' ? 'Added by hand' : 'Event'));
const SOURCE_LABEL = { 'nlb-app': 'NLB app', instagram: 'Instagram', manual: 'Added by hand', pt: 'PT session', gcal: 'Google Calendar' };
const price = p => (p == null ? '' : p === 0 ? 'Free' : '£' + (p % 100 === 0 ? p / 100 : (p / 100).toFixed(2)));
const when = e => (e.start ? (e.end ? `${e.start} to ${e.end}` : e.start) : 'All day');

/* The passphrase lives in this tab only, or on this device if "Remember" was ticked. Storage can be blocked, so every use is guarded. */
const PASS_KEY = 'diary_pass';
const store = {
  get() {
    try { const v = sessionStorage.getItem(PASS_KEY); if (v) return v; } catch (e) {}
    try { return localStorage.getItem(PASS_KEY) || ''; } catch (e) { return ''; }
  },
  set(v, remember) {
    try { sessionStorage.removeItem(PASS_KEY); } catch (e) {}
    try { localStorage.removeItem(PASS_KEY); } catch (e) {}
    if (!v) return;
    try { (remember ? localStorage : sessionStorage).setItem(PASS_KEY, v); } catch (e) {}
  }
};

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg; t.setAttribute('role', 'status');
  ($('#sheet').open ? $('#sheet') : document.body).appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

const directionsUrl = e => safeUrl(e.directions_url) || (e.location ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.location) : '');

/* ---------- state ---------- */
const S = {
  events: [], lastSync: '', cal: {}, status: 'loading', error: '',
  unlocked: false, boot: false, pass: '', lockMsg: '',
  mode: 'list', tab: 'diary', month: todayLondon().slice(0, 7), day: '', filter: 'all', past: false, connect: 'all', syncMsg: '',
  sugg: null, suggState: 'idle', suggError: '', igConnected: true,
  people: null, peopleState: 'idle', peopleError: '', peopleMax: 25, peopleMsg: '',
  ig: { url: '', caption: '', results: null },
  draft: {}
};
let lastLoad = 0;
let pending = null;   // what to do once "Just this one" or "This and later ones" is picked

/* ---------- calls ---------- */
async function adm(action, params = {}) {
  try { return await api(action, { pin: S.pass, ...params }); } catch (e) {
    if (/^wrong passphrase/i.test(errMsg(e))) lock('That passphrase no longer works. Unlock again.');
    throw e;
  }
}

async function loadEvents() {
  try {
    const r = await adm('events');
    S.events = r.events || []; S.lastSync = r.last_sync || ''; S.cal = r.calendar || {};
    S.status = 'ready'; S.error = '';
  } catch (e) {
    if (!S.unlocked) return;
    if (S.events.length) toast(errMsg(e), 'bad');
    else { S.status = 'error'; S.error = errMsg(e); }
  }
  lastLoad = Date.now();
  renderHeader(); renderFooter();
  if (S.tab === 'diary') renderMain();
}

function upsert(ev) {
  const i = S.events.findIndex(x => x.key === ev.key);
  if (i >= 0) S.events[i] = ev; else S.events.push(ev);
  S.events.sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title));
}
const byKey = k => S.events.find(e => e.key === k);
const refreshDiary = () => { if (S.tab === 'diary') renderMain(); };
const visible = () => S.events.filter(e => S.filter === 'all' || e.calendar === S.filter);
const hasLater = e => !!(e.source === 'pt' && e.series_id && S.events.some(x => x.series_id === e.series_id && x.key !== e.key && x.date >= e.date));

function lock(msg) {
  S.unlocked = false; S.pass = ''; store.set('');
  S.events = []; S.cal = {}; S.status = 'loading'; S.lastSync = '';
  S.tab = 'diary'; S.sugg = null; S.suggState = 'idle'; S.people = null; S.peopleState = 'idle'; S.peopleMsg = ''; S.draft = {}; S.ig = { url: '', caption: '', results: null };
  S.lockMsg = msg || ''; pending = null;
  if ($('#sheet').open) $('#sheet').close();
  renderHeader(); renderMain(); renderFooter();
}

/* ---------- header, footer ---------- */
function renderHeader() {
  $('#hdr').innerHTML = `<div class="hdr-in">
    <div class="hdr-top">
      <svg class="mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="104" fill="#c8f23d"/><path d="M150 392V132l212 260V132" fill="none" stroke="#0d2240" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="grow"><h1>Diary</h1><p class="tagline">NLB sessions and PT clients</p></div>
      ${S.unlocked ? '<button class="admin-btn on" data-act="lock" aria-label="Lock the diary">Lock</button>' : ''}
    </div>
    ${S.unlocked ? `<div class="cal-row"><button class="btn accent" data-act="connect">Connect your calendar</button></div>` : ''}
  </div>`;
}
function renderFooter() {
  $('#ftr').textContent = S.unlocked && S.lastSync ? `Updated ${fmtSync(S.lastSync)}` : '';
}

/* ---------- main ---------- */
function renderMain() {
  const app = $('#app');
  if (!S.unlocked) {
    app.innerHTML = S.boot ? `<div class="loading"><span class="spin"></span><p>Opening the diary</p></div>` : viewUnlock();
    if (!S.boot) setTimeout(() => { const i = $('input[name=pin]', app); if (i && !$('#sheet').open) i.focus(); }, 60);
    return;
  }
  const tabs = `<nav class="tabs" aria-label="Sections">
    ${[['diary', 'Diary'], ['instagram', 'From Instagram'], ['spotted', 'Spotted on Instagram'], ['people', 'People']].map(([k, l]) =>
      `<button class="tab" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${l}${k === 'spotted' && S.sugg && S.sugg.length ? `<span class="count">${S.sugg.length}</span>` : ''}</button>`).join('')}
  </nav>`;
  let body = '';
  if (S.tab === 'diary') body = viewDiary();
  else if (S.tab === 'instagram') body = viewInstagram();
  else if (S.tab === 'spotted') body = viewSpotted();
  else if (S.tab === 'people') body = viewPeople();
  app.innerHTML = tabs + body;
  refreshConflicts();
}

function viewUnlock() {
  return `<div class="panel unlock"><h2>Unlock the diary</h2>
    <p class="hint">Enter your passphrase to see the sessions. Nothing is shown until you do.</p>
    <form data-form="pin" novalidate>
      <label class="fld"><span>Passphrase</span><input name="pin" type="password" autocomplete="current-password" minlength="8" maxlength="64" required></label>
      <label class="chk"><input type="checkbox" name="remember"><span>Remember on this device</span></label>
      <p class="err" role="alert">${esc(S.lockMsg)}</p>
      <button class="btn full" type="submit">Unlock</button>
    </form></div>`;
}

function viewDiary() {
  if (S.status === 'loading') return `<div class="loading"><span class="spin"></span><p>Loading the diary</p></div>`;
  if (S.status === 'error') return `<div class="panel"><h2>Could not load the diary</h2><p>${esc(S.error)}</p><button class="btn" data-act="retry">Try again</button></div>`;
  const sync = `<div class="panel"><div class="bar" style="margin:0"><div><strong>Sync with the NLB app</strong><div class="small muted" id="sync-msg">${esc(S.syncMsg || (S.lastSync ? 'Last sync: ' + fmtSync(S.lastSync) : 'Not synced yet'))}</div></div><button class="btn small" data-act="sync">Sync now</button></div></div>`;
  const top = `<div class="bar"><h2 style="margin:0">${S.mode === 'list' ? 'Coming up' : 'Month view'}</h2><button class="btn accent small" data-act="add">Add</button></div>`;
  const seg = (name, pairs, cur, act, key) => `<div class="seg" role="group" aria-label="${name}">${pairs.map(([v, l]) => `<button data-act="${act}" data-${key}="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
  const controls = `<div class="bar">${seg('Show', [['all', 'All'], ['nlb', 'NLB'], ['pt', 'PT']], S.filter, 'filter', 'filter')}${seg('View', [['list', 'List'], ['month', 'Month']], S.mode, 'mode', 'mode')}</div>`;
  return sync + top + controls + (S.mode === 'list' ? listView() : monthView());
}

function card(e) {
  const meta = [e.location, price(e.price_pence)].filter(Boolean).join(' · ');
  return `<button class="ev ${typeClass(e)} ${e.status === 'cancelled' ? 'cancelled' : ''}" data-act="open" data-key="${esc(e.key)}">
    <span class="ev-time">${esc(e.start || 'All day')}</span>
    <span class="ev-main"><span class="ev-title">${esc(e.title)}</span>${meta ? `<span class="ev-meta">${esc(meta)}</span>` : ''}
      <span class="ev-tags"><span class="chip">${esc(chipLabel(e))}</span>${e.source === 'pt' ? `<span class="tag ${e.paid ? 'paid' : 'unpaid'}">${e.paid ? 'Paid' : 'Not paid'}</span>` : ''}${e.status === 'cancelled' ? '<span class="tag">Cancelled</span>' : ''}${e.edited ? '<span class="tag edit">Changed</span>' : ''}</span>
    </span></button>`;
}

function listView() {
  const t0 = todayLondon(), from = S.past ? addDays(t0, -30) : t0;
  const list = visible().filter(e => e.date >= from);
  const earlier = `<p><button class="btn small line" data-act="toggle-past">${S.past ? 'Hide earlier sessions' : 'Show the last 30 days'}</button></p>`;
  if (!list.length) return `<div class="empty"><p>Nothing in the diary${S.filter === 'all' ? '' : ' for this filter'}.</p></div>${earlier}`;
  let out = earlier, cur = '';
  for (const e of list) {
    if (e.date !== cur) {
      cur = e.date;
      const rel = cur === t0 ? 'Today' : cur === addDays(t0, 1) ? 'Tomorrow' : '';
      out += `<h3 class="day">${esc(fmtDay(cur))}${rel ? `<span class="rel">${rel}</span>` : ''}</h3>`;
    }
    out += card(e);
  }
  return out;
}

function monthView() {
  const t0 = todayLondon();
  const [y, m] = S.month.split('-').map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const list = visible(), by = {};
  for (const e of list) (by[e.date] = by[e.date] || []).push(e);
  if (!S.day) S.day = t0.slice(0, 7) === S.month ? t0 : '';
  const cur = t0.slice(0, 7);
  const first = list.length && list[0].date.slice(0, 7) < cur ? list[0].date.slice(0, 7) : cur;
  const last = list.length && list[list.length - 1].date.slice(0, 7) > cur ? list[list.length - 1].date.slice(0, 7) : cur;
  let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="wd" aria-hidden="true">${d}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += `<div class="cell blank" aria-hidden="true"></div>`;
  for (let d = 1; d <= total; d++) {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const evs = by[iso] || [];
    const dots = evs.slice(0, 4).map(e => `<span class="dot ${typeClass(e)} ${e.status === 'cancelled' ? 'x' : ''}"></span>`).join('') + (evs.length > 4 ? '+' : '');
    cells += `<button class="cell ${iso === t0 ? 'today' : ''} ${iso < t0 ? 'past' : ''}" data-act="pick-day" data-date="${iso}" aria-pressed="${S.day === iso}" aria-label="${esc(fmtDay(iso))}, ${evs.length ? evs.length + (evs.length === 1 ? ' event' : ' events') : 'no events'}">${d}<span class="dots">${dots}</span></button>`;
  }
  const dayEvs = S.day ? (by[S.day] || []) : [];
  return `<div class="month-h">
      <button class="btn small line" data-act="month" data-d="-1" aria-label="Previous month" ${S.month <= first ? 'disabled' : ''}>&lsaquo;</button>
      <h2>${MONTH_FULL[m - 1]} ${y}</h2>
      <button class="btn small line" data-act="month" data-d="1" aria-label="Next month" ${S.month >= last ? 'disabled' : ''}>&rsaquo;</button>
    </div>
    <div class="grid" role="group" aria-label="${MONTH_FULL[m - 1]} ${y}">${cells}</div>
    ${S.day ? `<h3 class="day">${esc(fmtDay(S.day))}</h3>${dayEvs.length ? dayEvs.map(card).join('') : '<p class="muted">Nothing on this day.</p>'}` : '<p class="muted">Tap a day to see what is on.</p>'}`;
}

/* ---------- sheet ---------- */
const sheet = () => $('#sheet');
function openSheet(html) {
  const el = sheet();
  el.innerHTML = `<div class="grab"></div><div class="sheet-in">${html}</div>`;
  if (!el.open) el.showModal();
  refreshConflicts();
}
const closeSheet = () => { if (sheet().open) sheet().close(); };
const head = (title, extra = '') => `<div class="sheet-h"><h2 id="sheet-title">${esc(title)}</h2><button class="btn small line" data-act="close-sheet">Close</button></div>${extra}`;

function sheetDetail(key) {
  const e = byKey(key);
  if (!e) return closeSheet();
  const dir = directionsUrl(e), pay = safeUrl(e.payment_url), post = safeUrl(e.origin_url), pt = e.source === 'pt';
  const priceHtml = pt ? (e.price_pence != null ? `${esc(price(e.price_pence))}, ${e.paid ? 'paid' : 'not paid'}` : (e.paid ? 'Paid' : 'Not paid')) : '';
  const facts = [
    ['When', `${esc(fmtDayLong(e.date))}, ${esc(when(e))}`],
    pt ? ['Client', esc(e.client)] : null,
    e.location ? ['Where', `${esc(e.location)}${dir ? `<br><a class="btn small line" href="${esc(dir)}" target="_blank" rel="noopener">Directions</a>` : ''}`] : null,
    pt ? ['Price', priceHtml] : e.price_pence != null ? ['Price', `${esc(price(e.price_pence))}${pay ? `<br><a class="btn small accent" href="${esc(pay)}" target="_blank" rel="noopener">Pay</a>` : ''}`] : (pay ? ['Pay', `<a class="btn small accent" href="${esc(pay)}" target="_blank" rel="noopener">Pay</a>`] : null),
    e.description ? ['Notes', esc(e.description).replace(/\n/g, '<br>')] : null,
    ['Source', `<span class="badge">${esc(SOURCE_LABEL[e.source] || e.source)}</span>${post ? `<br><a class="btn small line" href="${esc(post)}" target="_blank" rel="noopener">View post</a>` : ''}`]
  ].filter(Boolean);
  const cancelled = e.status === 'cancelled', k = esc(e.key), editUrl = safeUrl(e.edit_url);
  const actions = e.read_only
    ? `<h3>Google Calendar</h3><p class="hint">This one was added in Google Calendar, so it can only be changed there.</p>
       <div class="actions">${editUrl ? `<a class="btn" href="${esc(editUrl)}" target="_blank" rel="noopener">Edit in Google Calendar</a>` : ''}</div>`
    : `<h3>Change</h3>
    ${e.source === 'nlb-app' ? '<p class="hint">This one comes from the NLB app. Changes made here are kept when it syncs.</p>' : ''}
    ${hasLater(e) ? '<p class="hint">This is one of a weekly series. You will be asked whether a change covers this one or the later ones too.</p>' : ''}
    <div class="actions">
      <button class="btn" data-act="edit" data-key="${k}">Edit</button>
      ${pt ? `<button class="btn line" data-act="paid" data-key="${k}">${e.paid ? 'Mark as not paid' : 'Mark as paid'}</button>` : ''}
      <button class="btn line" data-act="${cancelled ? 'restore' : 'cancel'}" data-key="${k}">${cancelled ? 'Restore' : 'Cancel'}</button>
      ${e.source !== 'nlb-app' ? `<button class="btn danger" data-act="delete" data-key="${k}">Delete</button>` : ''}
      ${e.source === 'nlb-app' && e.edited ? `<button class="btn line" data-act="reset" data-key="${k}">Reset to app details</button>` : ''}
    </div>`;
  openSheet(`<div class="${typeClass(e)}">${head(e.title, `<p><span class="chip">${esc(chipLabel(e))}</span> ${cancelled ? '<span class="tag">Cancelled</span>' : ''}</p>`)}</div>
    <dl class="facts">${facts.map(([k2, v]) => `<div><dt>${k2}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${actions}`);
}

function sheetAdd() {
  openSheet(`${head('Add to the diary')}
    <div class="provs">
      <button class="prov" data-act="add-pt"><span class="prov-name">PT session</span><span class="prov-hint">A session with a client. It can repeat every week.</span></button>
      <button class="prov" data-act="add-club"><span class="prov-name">Club event</span><span class="prov-hint">Something for the club that is not a regular session.</span></button>
    </div>`);
}

function sheetScope(title, key) {
  openSheet(`${head(title)}
    <p>This is one of a weekly series. What should it cover?</p>
    <div class="actions">
      <button class="btn" data-act="scope" data-scope="one">Just this one</button>
      <button class="btn line" data-act="scope" data-scope="following">This and later ones</button>
    </div>
    <button class="btn line full" data-act="open" data-key="${esc(key)}">Back</button>`);
}
// Runs fn('one' | 'following', button), asking first when the session has later ones in its series.
function withScope(e, title, fn) {
  if (!hasLater(e)) return fn('one');
  pending = fn;
  sheetScope(title, e.key);
}

/* connect your calendar */
function sheetConnect() {
  const pick = ['all', 'nlb', 'pt'].includes(S.connect) ? S.connect : 'all';
  const feed = safeUrl(S.cal['feed_' + pick]), enc = encodeURIComponent;
  const name = enc(pick === 'pt' ? 'PT Sessions' : pick === 'nlb' ? 'NLB Events' : 'NLB Diary');
  const rows = [];
  const row = (title, hint, href) => rows.push(`<a class="prov" href="${esc(href)}" target="_blank" rel="noopener"><span class="prov-name">${title}</span><span class="prov-hint">${hint}</span></a>`);
  if (feed) {
    row('Outlook / Hotmail', 'For outlook.com, hotmail and live addresses.', `https://outlook.live.com/calendar/0/addfromweb?url=${enc(feed)}&name=${name}`);
    row('Microsoft 365', 'For a work or school Outlook account.', `https://outlook.office.com/calendar/0/addfromweb?url=${enc(feed)}&name=${name}`);
    row('iPhone, iPad or Mac', 'Opens the Calendar app and asks to subscribe.', feed.replace(/^https?:\/\//i, 'webcal://'));
  }
  const seg = `<div class="seg" role="group" aria-label="Which calendars">${[['all', 'Both'], ['nlb', 'NLB only'], ['pt', 'PT only']].map(([v, l]) => `<button data-act="connect-pick" data-pick="${v}" aria-pressed="${pick === v}">${l}</button>`).join('')}</div>`;
  openSheet(`${head('Connect your calendar')}
    <div class="provs">
      <div class="prov"><span class="prov-name">Google account</span>
        <span class="prov-hint">Gmail or Google Workspace. Add the email under People. Google sends an invite for both calendars. Accept it and they show up in Google Calendar, and changes made there come back here.</span>
        <span class="prov-hint">Using the Google account that owns the calendars already? Open Google Calendar and look under My calendars. There is nothing to add.</span>
        <button class="btn small" data-act="go-people">Open People</button></div>
    </div>
    <h3>Any other calendar app</h3>
    <p class="hint">Which calendars?</p>
    <p>${seg}</p>
    ${feed ? `<div class="provs">${rows.join('')}
      <div class="prov other"><span class="prov-name">Other calendar apps</span>
        <span class="prov-hint">Copy the link, then look for "Subscribe" or "Add calendar from URL".</span>
        <span class="copy-row"><input id="ics" readonly value="${esc(feed)}" aria-label="Calendar link" onfocus="this.select()"><button class="btn" data-act="copy">Copy</button></span></div>
    </div>` : '<div class="banner warn">The calendar links are not ready yet.</div>'}
    <p class="hint">Outlook and Apple show these read-only and check for changes every few hours. Add and change things on this page.</p>
    <p class="hint">Keep the link private. Anyone who has it can see these calendars.</p>
    <button class="btn line full" data-act="rotate">Make a new link</button>
    <p class="hint">Old links stop working when you do.</p>`);
}

/* ---------- forms ---------- */
function fieldsHtml(v = {}, { lockDate = false, noLink = false } = {}) {
  return `<label class="fld"><span>Title</span><input name="title" required maxlength="80" autocomplete="off" value="${esc(v.title)}"></label>
    <div class="fld-row three">
      <label class="fld"><span>Date</span><input type="date" name="date" required ${lockDate ? 'disabled' : ''} value="${esc(v.date)}"></label>
      <label class="fld"><span>Start</span><input type="time" name="start" value="${esc(v.start)}"></label>
      <label class="fld"><span>End</span><input type="time" name="end" value="${esc(v.end)}"></label>
    </div>
    <label class="fld"><span>Location</span><input name="location" maxlength="120" autocomplete="off" value="${esc(v.location)}"></label>
    <label class="fld"><span>Notes</span><textarea name="description" maxlength="1000">${esc(v.description)}</textarea></label>
    ${noLink ? '' : `<label class="fld"><span>Link</span><input type="url" name="origin_url" inputmode="url" placeholder="https://" autocomplete="off" value="${esc(v.origin_url)}"></label>`}`;
}
function readForm(form) {
  const fd = new FormData(form), o = {};
  for (const k of ['title', 'date', 'start', 'end', 'location', 'description', 'origin_url']) if (fd.has(k)) o[k] = String(fd.get(k)).trim();
  return o;
}
function checkValues(v, { needDate = true } = {}) {
  if (!v.title || (needDate && !v.date)) return 'Add a title and a date.';
  if (v.start && v.end && v.end <= v.start) return 'The end time must be after the start.';
  if (v.origin_url && !/^https:\/\//i.test(v.origin_url)) return 'Links must start with https://';
  return '';
}

/* PT form */
const poundsText = p => (p == null ? '' : p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));
function ptFields(v = {}, { repeat = false } = {}) {
  return `<label class="fld"><span>Client</span><input name="client" required maxlength="40" autocomplete="off" value="${esc(v.client)}"></label>
    <div class="fld-row three">
      <label class="fld"><span>Date</span><input type="date" name="date" required value="${esc(v.date)}"></label>
      <label class="fld"><span>Start</span><input type="time" name="start" required value="${esc(v.start)}"></label>
      <label class="fld"><span>End</span><input type="time" name="end" value="${esc(v.end)}"></label>
    </div>
    ${repeat ? `<label class="fld"><span>Repeats</span><select name="repeat">${Array.from({ length: 26 }, (_, i) => `<option value="${i + 1}">${i === 0 ? 'Does not repeat' : `Every week, ${i + 1} sessions`}</option>`).join('')}</select></label>
    <div class="pt-preview" data-pt-preview aria-live="polite"></div>` : ''}
    <label class="fld"><span>Location</span><input name="location" maxlength="120" autocomplete="off" value="${esc(v.location)}"></label>
    <div class="fld-row">
      <label class="fld"><span>Price (£)</span><input type="number" name="price" inputmode="decimal" min="0" step="0.01" value="${esc(poundsText(v.price_pence))}"></label>
      <label class="chk"><input type="checkbox" name="paid" ${v.paid ? 'checked' : ''}><span>Paid</span></label>
    </div>
    <label class="fld"><span>Notes</span><textarea name="description" maxlength="1000">${esc(v.description)}</textarea></label>`;
}
function readPt(form) {
  const fd = new FormData(form), g = k => String(fd.get(k) ?? '').trim();
  return { client: g('client'), date: g('date'), start: g('start'), end: g('end'), location: g('location'), description: String(fd.get('description') ?? '').trim(),
    price: g('price'), paid: fd.has('paid'), repeat: Math.max(1, Math.min(26, parseInt(g('repeat'), 10) || 1)), scope: g('scope') === 'following' ? 'following' : 'one' };
}
function checkPt(v) {
  if (!v.client) return 'Add the client name.';
  if (!v.date) return 'Add a date.';
  if (!v.start) return 'Add a start time.';
  if (v.end && v.end <= v.start) return 'The end time must be after the start.';
  if (v.price !== '' && !(Number(v.price) >= 0)) return 'The price should be a number, like 40 or 37.50.';
  return '';
}
const penceOf = v => (v.price === '' ? '' : Math.round(Number(v.price) * 100));

/* conflict banner, worked out from the events already loaded */
function conflictsFor(v, excludeKey) {
  if (!v.date) return [];
  const span = x => (x.start ? [mins(x.start), x.end ? mins(x.end) : mins(x.start) + 60] : [0, 1440]);
  const [a1, a2] = span(v);
  return S.events.filter(e => e.status !== 'cancelled' && e.date === v.date && e.key !== excludeKey && (() => { const [b1, b2] = span(e); return a1 < b2 && b1 < a2; })());
}
function refreshPt(form) {
  const v = readPt(form), out = $('[data-conflict-out]', form), prev = $('[data-pt-preview]', form);
  const dates = v.date ? Array.from({ length: v.repeat }, (_, i) => addDays(v.date, 7 * i)) : [];
  if (prev) prev.innerHTML = dates.length > 1 ? `<strong>${dates.length} sessions</strong>, ${esc(fmtDay(dates[0]))} to ${esc(fmtDay(dates[dates.length - 1]))}<br><span class="small muted">${dates.map(d => esc(fmtDay(d))).join(', ')}</span>` : '';
  if (!out) return;
  const by = new Map();
  for (const d of dates) for (const e of conflictsFor({ date: d, start: v.start, end: v.end })) { if (!by.has(e.title)) by.set(e.title, []); by.get(e.title).push(fmtDay(d)); }
  out.innerHTML = by.size ? 'Clashes with ' + [...by].map(([t, d]) => `${esc(t)} on ${d.length === 1 ? d[0] : d.length + ' dates: ' + d.slice(0, 5).join(', ') + (d.length > 5 ? ', and ' + (d.length - 5) + ' more' : '')}`).join('; ') + '.' : '';
}
function refreshConflicts(root = document) {
  $$('form[data-conflict]', root).forEach(form => {
    if (form.dataset.form === 'pt-add') return refreshPt(form);
    const out = $('[data-conflict-out]', form);
    if (!out) return;
    const v = form.dataset.form === 'pt-edit' ? readPt(form) : readForm(form);
    if (form.dataset.lockdate && form.dataset.date) v.date = form.dataset.date;
    const hits = conflictsFor(v, form.dataset.key || '');
    if (!hits.length) { out.innerHTML = ''; return; }
    const list = hits.map(e => `${esc(e.title)}${e.start ? ' ' + esc(e.start) : ''}`).join(', ');
    const editable = hits.filter(e => !e.read_only);
    out.innerHTML = `Already on ${esc(fmtDay(v.date))}: ${list}.` + (editable.length ? ` Edit that instead?<br>` +
      editable.map(e => `<button type="button" class="btn small line" data-act="edit" data-key="${esc(e.key)}">${editable.length === 1 ? 'Edit that' : 'Edit ' + esc(e.title)}</button>`).join('') : '');
  });
}
const conflictSlot = `<div class="banner warn" data-conflict-out role="status"></div>`;
const forceBtn = `<button class="btn line full hide" type="submit" data-force>Save anyway</button>`;

function sheetEdit(key) {
  const e = byKey(key);
  if (!e || e.read_only) return;
  if (e.source === 'pt') return sheetEditPt(e);
  const app = e.source === 'nlb-app';
  openSheet(`${head('Edit event')}
    ${app ? '<p class="hint">This one comes from the NLB app. What you change here is kept when it syncs. The date can only be changed by cancelling this one and adding a new event.</p>' : ''}
    <form data-form="edit" data-key="${esc(e.key)}" data-conflict ${app ? `data-lockdate="1" data-date="${esc(e.date)}"` : ''} novalidate>
      ${fieldsHtml(e, { lockDate: app, noLink: app })}
      ${conflictSlot}
      <p class="err" role="alert"></p>
      <button class="btn full" type="submit">Save changes</button>
      ${forceBtn}
    </form>`);
}
function sheetEditPt(e) {
  const later = hasLater(e);
  openSheet(`${head('Edit PT session')}
    <form data-form="pt-edit" data-key="${esc(e.key)}" data-conflict novalidate>
      ${ptFields(e)}
      ${later ? `<fieldset class="scope"><legend>Apply to</legend>
        <label class="chk"><input type="radio" name="scope" value="one" checked><span>Just this one</span></label>
        <label class="chk"><input type="radio" name="scope" value="following"><span>This and later ones</span></label></fieldset>` : ''}
      ${conflictSlot}
      <p class="err" role="alert"></p>
      <button class="btn full" type="submit">Save changes</button>
      ${forceBtn}
    </form>`);
}
function sheetAddPt() {
  openSheet(`${head('Add a PT session')}
    <form data-form="pt-add" data-conflict novalidate>
      ${ptFields({}, { repeat: true })}
      ${conflictSlot}
      <p class="err" role="alert"></p>
      <button class="btn full" type="submit">Add session</button>
      ${forceBtn}
    </form>`);
}
function sheetAddClub() {
  const d = S.draft;
  openSheet(`${head('Add a club event')}
    <p class="hint">For anything that is not a regular session.</p>
    <form data-form="add" data-conflict novalidate>
      ${fieldsHtml(d)}
      ${conflictSlot}
      <p class="err" role="alert"></p>
      <button class="btn full" type="submit">Add event</button>
    </form>`);
}

/* ---------- Instagram: paste a post ---------- */
function knownVenues() {
  return [...new Set(S.events.map(e => e.location).filter(l => l && !/^see calendar/i.test(l)))];
}
const norm = t => String(t || '').replace(/\r\n?/g, '\n');

function markup(text, ranges) {
  const rs = ranges.filter(r => r && r[1] > r[0]).sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  for (const [s, e] of rs) {
    if (s < pos) continue;
    out += esc(text.slice(pos, s)) + `<mark>${esc(text.slice(s, e))}</mark>`;
    pos = e;
  }
  return out + esc(text.slice(pos));
}
function snippet(text, [s, e]) {
  const ls = text.lastIndexOf('\n', s - 1) + 1;
  let le = text.indexOf('\n', e); if (le < 0) le = text.length;
  let a = ls, b = le;
  if (b - a > 160) { a = Math.max(ls, s - 60); b = Math.min(le, e + 80); }
  return (a > ls ? '…' : '') + markup(text.slice(a, b), [[s - a, e - a]]) + (b < le ? '…' : '');
}

function viewInstagram() {
  return `<div class="panel"><h2>From Instagram</h2>
    <p class="hint">Paste the link to a post and its caption. The dates found are shown for you to check before saving.</p>
    <form data-form="ig-read" novalidate>
      <label class="fld"><span>Post link</span><input type="url" name="url" inputmode="url" placeholder="https://www.instagram.com/p/..." autocomplete="off" value="${esc(S.ig.url)}"></label>
      <label class="fld"><span>Caption</span><textarea name="caption" rows="7" required>${esc(S.ig.caption)}</textarea></label>
      <p class="err" role="alert"></p>
      <button class="btn full" type="submit">Find dates</button>
    </form></div>
    <div id="ig-results">${igResults()}</div>`;
}

function igResults() {
  const res = S.ig.results;
  if (!res) return '';
  const text = norm(S.ig.caption);
  if (!res.length) {
    return `<div class="panel"><h3>No date found in that caption</h3><p class="hint">Add the event by hand instead.</p><button class="btn" data-act="ig-by-hand">Add by hand</button></div>`;
  }
  return `<div class="panel"><h3>Caption, with the dates marked</h3><div class="cap open">${markup(text, res.map(r => r.range))}</div></div>` +
    res.map((r, i) => {
      const v = r.vals || { title: r.title, date: r.date, start: r.start, end: r.end, location: r.location, description: '', origin_url: S.ig.url };
      const saved = !!r.saved;
      return `<article class="panel">
        <div class="card-h"><h3 style="margin:0">Date ${i + 1} of ${res.length}</h3>${r.confidence === 'low' ? '<span class="tag edit">Check this one</span>' : ''}</div>
        <p class="snippet">${snippet(text, r.range)}</p>
        ${r.confidence === 'low' ? `<div class="banner warn">Not sure about this one. ${esc(r.reasons.join(' '))} Check the date and time before saving.</div>` : ''}
        <form data-form="ig-save" data-idx="${i}" data-conflict novalidate>
          <fieldset ${saved ? 'disabled' : ''} style="border:0;padding:0;margin:0;min-width:0">
          ${fieldsHtml(v)}
          ${conflictSlot}
          <p class="err" role="alert"></p>
          <button class="btn full" type="submit">${saved ? 'Saved' : 'Save event'}</button>
          </fieldset>
        </form></article>`;
    }).join('');
}

/* ---------- Instagram: spotted ---------- */
async function loadSuggestions() {
  S.suggState = 'loading'; S.suggError = '';
  if (S.tab === 'spotted') renderMain();
  try {
    const r = await adm('suggestions');
    S.igConnected = r.instagram_connected !== false;
    const venues = knownVenues();
    S.sugg = (r.suggestions || []).map(s => ({ ...s, _text: norm(s.caption), _ev: parseCaption(norm(s.caption), { now: new Date(), venues }) }));
    S.suggState = 'ready';
  } catch (e) { S.suggState = 'error'; S.suggError = errMsg(e); }
  if (S.tab === 'spotted') renderMain();
}

function viewSpotted() {
  if (S.suggState === 'loading' || (S.suggState === 'idle' && !S.sugg)) return `<div class="loading"><span class="spin"></span><p>Looking for new posts</p></div>`;
  if (S.suggState === 'error') return `<div class="panel"><h2>Could not load posts</h2><p>${esc(S.suggError)}</p><button class="btn" data-act="tab" data-tab="spotted">Try again</button></div>`;
  const notConnected = !S.igConnected ? `<div class="panel"><h2>Spotted on Instagram</h2><p>Instagram isn't connected yet, so nothing shows up here by itself. Paste a post into From Instagram instead.</p><button class="btn" data-act="tab" data-tab="instagram">Go to From Instagram</button></div>` : '';
  const list = S.sugg || [];
  if (!list.length) return notConnected || `<div class="empty"><h2>Spotted on Instagram</h2><p>Nothing new from Instagram.</p></div>`;
  return notConnected + list.map(s => {
    const ranges = s._ev.map(r => r.range);
    const det = s._ev.length ? s._ev.map((r, i) => `<div class="sg-det">
        <strong>${esc(fmtDay(r.date))}${r.start ? ', ' + esc(r.start) + (r.end ? ' to ' + esc(r.end) : '') : ''}</strong>
        ${r.confidence === 'low' ? '<span class="tag edit">Check this one</span>' : ''}
        <div>${esc(r.title)}${r.location ? ' at ' + esc(r.location) : ''}</div>
        ${r.reasons.length ? `<div class="small muted">${esc(r.reasons.join(' '))}</div>` : ''}
        <div class="row"><button class="btn small" data-act="approve" data-sid="${esc(s.id)}" data-idx="${i}">Approve</button></div>
      </div>`).join('') : `<div class="sg-det"><p class="muted" style="margin:0">No date found in this post.</p><div class="row"><button class="btn small" data-act="approve" data-sid="${esc(s.id)}" data-idx="-1">Add by hand</button></div></div>`;
    const post = safeUrl(s.post_url);
    return `<article class="panel" data-sid="${esc(s.id)}">
      <div class="card-h"><strong>${esc(/^\d{4}-\d{2}-\d{2}/.test(s.posted_at || '') ? 'Posted ' + fmtDay(s.posted_at.slice(0, 10)) : 'Instagram post')}</strong>${post ? `<a href="${esc(post)}" target="_blank" rel="noopener">View post</a>` : ''}</div>
      <div class="cap">${markup(s._text, ranges)}</div>
      ${det}
      <div class="row" style="margin-top:8px"><button class="btn small danger" data-act="dismiss" data-sid="${esc(s.id)}">Dismiss</button></div>
    </article>`;
  }).join('');
}

/* ---------- People (calendar access) ---------- */
async function loadPeople() {
  S.peopleState = 'loading'; S.peopleError = '';
  try {
    const r = await adm('people_list');
    S.people = r.people || []; S.peopleMax = r.max || 25; S.peopleState = 'ready';
  } catch (e) { S.peopleState = 'error'; S.peopleError = errMsg(e); }
  if (S.tab === 'people') renderMain();
}

function viewPeople() {
  if (S.peopleState === 'loading' || (S.peopleState === 'idle' && !S.people)) return `<div class="loading"><span class="spin"></span><p>Loading people</p></div>`;
  if (S.peopleState === 'error') return `<div class="panel"><h2>Could not load people</h2><p>${esc(S.peopleError)}</p><button class="btn" data-act="tab" data-tab="people">Try again</button></div>`;
  const list = S.people || [], full = list.length >= S.peopleMax;
  return `<div class="panel"><h2>People</h2>
    <p class="hint">Give someone access to both calendars, NLB Events and PT Sessions. They need a Google account. Everyone else can use Connect your calendar.</p>
    <form data-form="people-add" novalidate>
      <label class="fld"><span>Email</span><input type="email" name="email" inputmode="email" autocomplete="off" autocapitalize="none" maxlength="254" required></label>
      <label class="fld"><span>Access</span><select name="role"><option value="edit" selected>can edit</option><option value="see">can see</option></select></label>
      <p class="err" role="alert"></p>
      <button class="btn full" type="submit" ${full ? 'disabled' : ''}>Add person</button>
    </form>
    <p class="small muted" style="margin:10px 0 0">${list.length} of ${S.peopleMax} people added.${full ? ' Remove someone to add another.' : ''}</p>
  </div>
  ${S.peopleMsg ? `<div class="banner ok" role="status">${esc(S.peopleMsg)}</div>` : ''}
  ${list.length ? `<div class="panel people">${list.map(p => `<div class="person">
      <span class="person-email">${esc(p.email)}</span>
      <span class="chip">${esc(p.role)}</span>
      <button class="btn small danger" data-act="person-remove" data-rule="${esc(p.rule_id)}" data-email="${esc(p.email)}">Remove</button>
    </div>`).join('')}</div>` : '<div class="empty"><p>Nobody added yet.</p></div>'}
  <div class="panel"><h2>Passphrase</h2>
    <p class="hint">8 to 64 characters. A few words together work well. You will stay unlocked on this device until you press Lock.</p>
    <form data-form="passphrase" novalidate>
      <label class="fld"><span>New passphrase</span><input type="password" name="next" autocomplete="new-password" minlength="8" maxlength="64" required></label>
      <label class="fld"><span>Type it again</span><input type="password" name="again" autocomplete="new-password" minlength="8" maxlength="64" required></label>
      <p class="err" role="alert"></p>
      <button class="btn full" type="submit">Change passphrase</button>
    </form></div>`;
}

function sheetApprove(sid, idx) {
  const s = (S.sugg || []).find(x => x.id === sid);
  if (!s) return;
  const r = idx >= 0 ? s._ev[idx] : null;
  const v = r ? { title: r.title, date: r.date, start: r.start, end: r.end, location: r.location, description: '', origin_url: s.post_url }
    : { title: norm(s.caption).split('\n')[0].replace(/#\S+/g, '').trim().slice(0, 60), origin_url: s.post_url };
  openSheet(`${head(r ? 'Approve event' : 'Add event')}
    ${r && r.confidence === 'low' ? `<div class="banner warn">Not sure about this one. ${esc(r.reasons.join(' '))} Check the date and time before saving.</div>` : ''}
    <form data-form="approve" data-sid="${esc(sid)}" data-conflict novalidate>
      ${fieldsHtml(v)}
      ${conflictSlot}
      <p class="err" role="alert"></p>
      <button class="btn full" type="submit">Save event</button>
    </form>`);
}

/* ---------- actions ---------- */
async function busy(btn, label, fn) {
  const was = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; if (label) btn.textContent = label; }
  try { return await fn(); } finally { if (btn && btn.isConnected) { btn.disabled = false; if (!btn.dataset.keep) btn.textContent = was; } }
}
const takeEvents = r => { (r.events && r.events.length ? r.events : r.event ? [r.event] : []).forEach(upsert); };

const ACT = {
  open: t => sheetDetail(t.dataset.key),
  'close-sheet': () => closeSheet(),
  lock: () => lock(),
  mode: t => { S.mode = t.dataset.mode; renderMain(); },
  filter: t => { S.filter = t.dataset.filter; S.day = ''; renderMain(); },
  'toggle-past': () => { S.past = !S.past; renderMain(); },
  month: t => {
    const [y, m] = S.month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + +t.dataset.d, 1));
    S.month = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; S.day = '';
    renderMain();
  },
  'pick-day': t => { S.day = t.dataset.date; renderMain(); },
  add: () => sheetAdd(),
  'add-pt': () => sheetAddPt(),
  'add-club': () => sheetAddClub(),
  connect: () => sheetConnect(),
  'connect-pick': t => { S.connect = t.dataset.pick; sheetConnect(); },
  'go-people': () => { closeSheet(); ACT.tab({ dataset: { tab: 'people' } }); },
  rotate: t => {
    if (!confirm('Make a new calendar link? Old links stop working, so every calendar using one will need the new link.')) return;
    return busy(t, 'Working', async () => {
      try {
        const r = await adm('rotate_feed_key');
        S.cal = r.calendar || S.cal;
        sheetConnect(); toast('New link made. Old links no longer work.');
      } catch (e) { toast(errMsg(e), 'bad'); }
    });
  },
  'person-remove': t => {
    if (!confirm(`Remove ${t.dataset.email}? They will lose access to both calendars.`)) return;
    return busy(t, 'Removing', async () => {
      try {
        await adm('people_remove', { rule_id: t.dataset.rule });
        S.people = (S.people || []).filter(p => p.rule_id !== t.dataset.rule); S.peopleMsg = '';
        renderMain(); toast('Removed');
      } catch (e) { toast(errMsg(e), 'bad'); }
    });
  },
  copy: async t => {
    const input = $('#ics');
    try { await navigator.clipboard.writeText(input.value); } catch (e) { input.select(); try { document.execCommand('copy'); } catch (e2) {} }
    t.textContent = 'Copied'; setTimeout(() => { if (t.isConnected) t.textContent = 'Copy'; }, 2000);
  },
  retry: () => { S.status = 'loading'; renderMain(); loadEvents(); },
  tab: t => {
    if (!S.unlocked) return;
    S.tab = t.dataset.tab;
    S.peopleMsg = '';
    if (S.tab === 'spotted') { S.suggState = 'loading'; renderMain(); loadSuggestions(); }
    else if (S.tab === 'people') { S.peopleState = 'loading'; renderMain(); loadPeople(); }
    else renderMain();
  },
  sync: t => busy(t, 'Syncing', async () => {
    try {
      const r = await adm('sync_now');
      S.syncMsg = `Last sync: ${r.added || 0} added, ${r.updated || 0} updated, ${r.removed || 0} removed (${fmtSync(r.last_sync)})`;
      await loadEvents();
      const m = $('#sync-msg'); if (m) m.textContent = S.syncMsg;
    } catch (e) { toast(errMsg(e), 'bad'); }
  }),
  edit: t => { if (S.unlocked) sheetEdit(t.dataset.key); },
  scope: t => { const fn = pending; pending = null; if (fn) return fn(t.dataset.scope, t); },
  cancel: t => { const e = byKey(t.dataset.key); if (e) return withScope(e, 'Cancel', (scope, b) => change(b || t, e.key, 'cancel_event', 'Cancelled', { scope })); },
  restore: t => { const e = byKey(t.dataset.key); if (e) return withScope(e, 'Restore', (scope, b) => change(b || t, e.key, 'restore_event', 'Restored', { scope })); },
  paid: t => { const e = byKey(t.dataset.key); if (e) return change(t, e.key, 'update_event', e.paid ? 'Marked as not paid' : 'Marked as paid', { event: { paid: !e.paid } }); },
  reset: t => change(t, t.dataset.key, 'update_event', 'Back to the app details', { event: { clear_overrides: true }, clear_overrides: true }),
  delete: t => {
    const e = byKey(t.dataset.key);
    if (!e) return;
    return withScope(e, 'Delete', async (scope, b) => {
      if (!confirm(scope === 'following' ? 'Delete this session and the later ones? This cannot be undone.' : 'Delete this? This cannot be undone.')) { if (scope === 'following') sheetDetail(e.key); return; }
      await busy(b || t, 'Deleting', async () => {
        try {
          const r = await adm('delete_event', { key: e.key, scope });
          const gone = r.deleted && r.deleted.length ? r.deleted : [e.key];
          S.events = S.events.filter(x => !gone.includes(x.key)); closeSheet(); refreshDiary(); toast('Deleted'); loadEvents();
        } catch (ex) { toast(errMsg(ex), 'bad'); }
      });
    });
  },
  'ig-by-hand': () => {
    const first = norm(S.ig.caption).split('\n').map(l => l.replace(/#\S+/g, '').trim()).find(Boolean) || '';
    S.draft = { title: first.slice(0, 60), origin_url: S.ig.url };
    sheetAddClub();
  },
  approve: t => sheetApprove(t.dataset.sid, +t.dataset.idx),
  dismiss: t => busy(t, 'Dismissing', async () => {
    const sid = t.dataset.sid;
    try {
      const s = S.sugg.find(x => x.id === sid);
      if (!s.done) await adm('dismiss_suggestion', { id: sid });
      S.sugg = S.sugg.filter(x => x.id !== sid);
      renderMain();
    } catch (e) { toast(errMsg(e), 'bad'); }
  })
};

async function change(btn, key, action, done, extra = {}) {
  await busy(btn, '', async () => {
    try {
      const r = await adm(action, { key, ...extra });
      takeEvents(r); refreshDiary(); sheetDetail(key); toast(done); loadEvents();
    } catch (e) { toast(errMsg(e), 'bad'); }
  });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACT[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t, e); }
});

/* live conflict check, series preview and draft keeping */
document.addEventListener('input', e => {
  const form = e.target.closest('form');
  if (!form) return;
  const force = $('[data-force]', form); if (force) force.classList.add('hide');
  if (form.hasAttribute('data-conflict')) refreshConflicts();
  if (form.dataset.form === 'add') S.draft = readForm(form);
  if (form.dataset.form === 'ig-read') { const fd = new FormData(form); S.ig.url = String(fd.get('url') || ''); S.ig.caption = String(fd.get('caption') || ''); }
});

/* form submits */
document.addEventListener('submit', async e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const err = $('.err', form), main = $('button[type=submit]', form);
  const btn = e.submitter && e.submitter.form === form ? e.submitter : main;
  const force = !!(e.submitter && e.submitter.hasAttribute('data-force'));
  const say = m => { if (err) err.textContent = m; };
  say('');
  const kind = form.dataset.form;
  try {
    if (kind === 'pin') {
      const fd = new FormData(form), pass = String(fd.get('pin') || '').trim();
      if (!pass) return say('Enter your passphrase.');
      if (pass.length < 8) return say('The passphrase is at least 8 characters.');
      await busy(btn, 'Checking', async () => {
        await api('login', { pin: pass });
        S.pass = pass; S.unlocked = true; S.lockMsg = ''; S.status = 'loading'; store.set(pass, fd.has('remember'));
        renderHeader(); renderMain(); renderFooter();
        loadEvents();
      });
    } else if (kind === 'passphrase') {
      const fd = new FormData(form), next = String(fd.get('next') || '').trim(), again = String(fd.get('again') || '').trim();
      if (next.length < 8 || next.length > 64) return say('The passphrase must be 8 to 64 characters.');
      if (next !== again) return say('The two passphrases are not the same.');
      await busy(btn, 'Saving', async () => {
        await adm('set_pin', { new_pin: next });
        const remembered = (() => { try { return !!localStorage.getItem(PASS_KEY); } catch (e2) { return false; } })();
        S.pass = next; store.set(next, remembered);
        form.reset(); toast('Passphrase changed');
      });
    } else if (kind === 'people-add') {
      const fd = new FormData(form), email = String(fd.get('email') || '').trim().toLowerCase(), role = fd.get('role') === 'see' ? 'see' : 'edit';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return say('Enter a valid email address.');
      if ((S.people || []).length >= S.peopleMax && !(S.people || []).some(p => p.email === email)) return say(`The limit is ${S.peopleMax} people. Remove someone first.`);
      await busy(btn, 'Adding', async () => {
        const r = await adm('people_add', { email, role });
        S.people = (S.people || []).filter(p => p.email !== r.person.email).concat(r.person).sort((a, b) => a.email.localeCompare(b.email));
        S.peopleMsg = 'Added to both calendars. Google will email them an invite.';
        renderMain(); toast('Added');
      });
    } else if (kind === 'ig-read') {
      const fd = new FormData(form);
      S.ig.url = String(fd.get('url') || '').trim(); S.ig.caption = String(fd.get('caption') || '');
      if (!S.ig.caption.trim()) return say('Paste the caption first.');
      if (S.ig.url && !/^https:\/\//i.test(S.ig.url)) return say('Links must start with https://');
      S.ig.results = parseCaption(norm(S.ig.caption), { now: new Date(), venues: knownVenues() });
      $('#ig-results').innerHTML = igResults();
      refreshConflicts();
      const first = $('#ig-results'); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (kind === 'pt-add') {
      const v = readPt(form), bad = checkPt(v);
      if (bad) return say(bad);
      await busy(btn, 'Saving', async () => {
        const r = await adm('add_pt', { client: v.client, date: v.date, start: v.start, end: v.end, location: v.location, notes: v.description,
          price_pence: penceOf(v), paid: v.paid, repeat_weeks: v.repeat, ...(force ? { force: true } : {}) });
        takeEvents(r); closeSheet(); refreshDiary();
        toast(r.count > 1 ? `${r.count} sessions added` : 'Session added'); loadEvents();
      });
    } else if (kind === 'pt-edit') {
      const key = form.dataset.key, cur = byKey(key), v = readPt(form), bad = checkPt(v);
      if (bad) return say(bad);
      const end = v.end || addMins(v.start, 60);
      const want = { client: v.client, date: v.date, start: v.start, end, location: v.location, description: v.description, price_pence: penceOf(v), paid: v.paid };
      const was = { client: cur.client, date: cur.date, start: cur.start, end: cur.end, location: cur.location, description: cur.description, price_pence: cur.price_pence == null ? '' : cur.price_pence, paid: cur.paid };
      const patch = {};
      for (const k of Object.keys(want)) if (want[k] !== was[k]) patch[k] = want[k];
      if (!Object.keys(patch).length) { sheetDetail(key); return; }
      await busy(btn, 'Saving', async () => {
        const r = await adm('update_event', { key, event: patch, scope: v.scope, ...(force ? { force: true } : {}) });
        takeEvents(r); refreshDiary(); sheetDetail(key); toast(r.events && r.events.length > 1 ? `${r.events.length} sessions saved` : 'Saved'); loadEvents();
      });
    } else {
      const v = readForm(form);
      if (form.dataset.lockdate) v.date = form.dataset.date;
      const bad = checkValues(v);
      if (bad) return say(bad);
      await busy(btn, 'Saving', async () => {
        if (kind === 'add') {
          const source = /instagram\.com/i.test(v.origin_url || '') ? 'instagram' : 'manual';
          const r = await adm('add_event', { event: { ...v, source } });
          upsert(r.event); S.draft = {}; closeSheet(); refreshDiary(); toast('Event added'); loadEvents();
        } else if (kind === 'edit') {
          const key = form.dataset.key, cur = byKey(key);
          const ev = cur && cur.source === 'nlb-app'
            ? { title: v.title, start: v.start, end: v.end, location: v.location, description: v.description }
            : v;
          const r = await adm('update_event', { key, event: ev, ...(force ? { force: true } : {}) });
          upsert(r.event); refreshDiary(); sheetDetail(key); toast('Saved'); loadEvents();
        } else if (kind === 'ig-save') {
          const i = +form.dataset.idx, row = S.ig.results[i];
          await adm('add_event', { event: { ...v, source: 'instagram' } }).then(r => { upsert(r.event); });
          row.saved = true; row.vals = v;
          $$('fieldset', form).forEach(f => { f.disabled = true; }); btn.dataset.keep = '1'; btn.textContent = 'Saved';
          toast('Event saved'); loadEvents();
        } else if (kind === 'approve') {
          const sid = form.dataset.sid, s = S.sugg.find(x => x.id === sid);
          const ev = { ...v, source: 'instagram', origin_url: s.post_url };
          // the first approval uses the suggestion; further dates in the same post are added directly
          const r = s.done ? await adm('add_event', { event: ev }) : await adm('approve_suggestion', { id: sid, event: ev });
          s.done = true; upsert(r.event);
          closeSheet(); toast('Event saved'); loadEvents();
          if (S.tab === 'spotted') renderMain();
        }
      });
    }
  } catch (ex) {
    say(errMsg(ex));
    if (ex && ex.clash) { const fb = $('[data-force]', form); if (fb) fb.classList.remove('hide'); }
  }
});

sheet().addEventListener('click', e => { if (e.target === sheet()) closeSheet(); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.unlocked && Date.now() - lastLoad > 5 * 60000 && S.status === 'ready') loadEvents();
});

/* ---------- start ---------- */
(async function start() {
  if (MOCK) document.title = 'Diary (demo)';
  const saved = store.get();
  S.boot = !!saved;
  renderHeader(); renderMain(); renderFooter();
  if (!saved) return;
  try {
    await api('login', { pin: saved });
    S.pass = saved; S.unlocked = true; S.status = 'loading';
  } catch (e) {
    if (!e.network) store.set('');
    S.lockMsg = errMsg(e);
  }
  S.boot = false;
  renderHeader(); renderMain(); renderFooter();
  if (S.unlocked) loadEvents();
})();
