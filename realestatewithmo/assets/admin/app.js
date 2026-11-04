/* Admin shell: PIN session, hash router, nav, shared helpers handed to every screen. */
import * as CFG from '../config.js?v=202611040820';
import * as API from '../api.js?v=202611040820';
import * as FMT from '../format.js?v=202611040820';
import * as UI from '../ui.js?v=202611040820';
import * as Inbox from './inbox.js?v=202611040820';
import * as Cal from './calendar.js?v=202611040820';
import * as Props from './properties.js?v=202611040820';
import * as Shares from './shares.js?v=202611040820';
import * as Settings from './settings.js?v=202611040820';

const TZ = CFG.TZ || 'Africa/Lagos';
const MOCK = !!CFG.MOCK;
const PIN_KEY = 'rm_pin';
const root = document.getElementById('app');

/* ---------- small helpers (format.js wins when it has the function) ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const utc = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
const pick = (name, fallback) => (typeof FMT[name] === 'function' ? FMT[name] : fallback);

const localEsc = s => String(s === null || s === undefined ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const esc = pick('esc', localEsc);

const todayLagos = pick('todayLagos', () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const addDays = pick('addDays', (s, n) => new Date(utc(s) + n * 86400000).toISOString().slice(0, 10));
const nightsBetween = pick('nights', (a, b) => Math.round((utc(b) - utc(a)) / 86400000));
const ngn = pick('ngn', n => {
  const v = Math.round(Number(n));
  return isFinite(v) ? '₦' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
});
const fmtDay = pick('fmtDay', s => (isDate(s) ? DAYS[new Date(utc(s)).getUTCDay()] + ' ' + Number(s.slice(8, 10)) + ' ' + MONTHS[Number(s.slice(5, 7)) - 1] : ''));
const fmtRange = pick('fmtRange', (a, b) => {
  if (!isDate(a) || !isDate(b)) return '';
  const n = nightsBetween(a, b);
  const da = Number(a.slice(8, 10));
  const left = a.slice(0, 7) === b.slice(0, 7) ? String(da) : da + ' ' + MONTHS[Number(a.slice(5, 7)) - 1];
  return left + ' to ' + Number(b.slice(8, 10)) + ' ' + MONTHS[Number(b.slice(5, 7)) - 1] + ' (' + n + (n === 1 ? ' night' : ' nights') + ')';
});
const kindLabel = pick('kindLabel', k => ({ shortlet: 'Shortlet', land: 'Land', residential: 'Residential', commercial: 'Commercial', stay: 'Stay', inspection: 'Inspection', consultation: 'Consultation' }[k] || k || ''));
const photoSrc = pick('photoSrc', (p, w) => {
  if (!p) return '';
  if (p.url) return p.url;
  return p.id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(p.id) + '&sz=w' + (w || 800) : '';
});
const priceLabel = (p) => {
  if (!p || p.price_ngn === '' || p.price_ngn === null || p.price_ngn === undefined) return (p && p.price_note) || 'No price yet';
  const unit = { night: ' / night', per_plot: ' per plot', per_sqm: ' per sqm', total: '' }[p.price_unit] || '';
  return ngn(p.price_ngn) + unit;
};

/* ---------- icons ---------- */
const svg = (d, extra = '') => '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' + extra + '>' + d + '</svg>';
export const ICONS = {
  inbox: svg('<path d="M3 13l2.2-7.5A2 2 0 017.1 4h9.8a2 2 0 011.9 1.5L21 13v5a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 13h5l1.2 2.5h5.6L16 13h5"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  properties: svg('<path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>'),
  links: svg('<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'),
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>'),
  wa: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20.5 3.5A11 11 0 003.2 17.1L2 22l5-1.3A11 11 0 1020.5 3.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.6 8.2c-.4.6-.3 1.6.5 2.9 1 1.7 2.4 2.9 4 3.5 1 .4 1.7.2 2.1-.4l.3-.8-1.9-1-.8.800c-1-.4-1.9-1.3-2.4-2.300l.7-.8-.9-2z" fill="currentColor"/></svg>',
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  pin: svg('<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.500C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  check: svg('<path d="M5 12.500l4.5 4.500L19 7.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  refresh: svg('<path d="M20 11a8 8 0 00-14.5-3.500M4 4v4.500h4.5"/><path d="M4 13a8 8 0 0014.5 3.500M20 20v-4.500h-4.5"/>'),
  eye: svg('<path d="M2 12s3.5-6.5 10-6.500S22 12 22 12s-3.5 6.5-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>')
};

/* ---------- toast, copy, sheets ---------- */
function ownToast(msg, kind) {
  let box = document.getElementById('a-toasts');
  if (!box) { box = document.createElement('div'); box.id = 'a-toasts'; box.className = 'a-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'a-toast' + (kind === 'bad' ? ' bad' : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 5000 : 2800);
}
export function toast(msg, kind = 'ok') {
  try {
    if (typeof UI.toast === 'function') { UI.toast(msg, kind === 'bad' ? 'err' : kind); return; }
  } catch (e) { /* fall through */ }
  ownToast(msg, kind);
}

export async function copy(text, okMsg = 'Copied.') {
  let done = false;
  try {
    if (typeof UI.copy === 'function') { const r = await UI.copy(text); done = r !== false; }
  } catch (e) { done = false; }
  if (!done) {
    try { await navigator.clipboard.writeText(text); done = true; } catch (e) { done = false; }
  }
  if (!done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-999px;top:0';
    document.body.appendChild(ta); ta.select();
    try { done = document.execCommand('copy'); } catch (e) { done = false; }
    ta.remove();
  }
  toast(done ? okMsg : 'Could not copy. Press and hold to copy it yourself.', done ? 'ok' : 'bad');
  return done;
}

/* Bottom sheet built on <dialog>. Returns { el, body, close }. */
export function sheet({ title = '', html = '', onClose = null, tall = false } = {}) {
  const d = document.createElement('dialog');
  d.className = 'asheet' + (tall ? ' tall' : '');
  d.innerHTML = '<div class="asheet-in"><div class="asheet-h"><h2>' + esc(title) + '</h2>' +
    '<button type="button" class="icon-btn" data-close aria-label="Close">' + ICONS.x + '</button></div>' +
    '<div class="asheet-b">' + html + '</div></div>';
  document.body.appendChild(d);
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    d.remove();
    if (onClose) onClose();
  };
  d.addEventListener('close', finish);
  d.addEventListener('cancel', () => { /* Escape closes through the close event */ });
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('[data-close]')) close();
  });
  function close() { if (d.open) d.close(); else finish(); }
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  const first = d.querySelector('input:not([type=hidden]), textarea, select');
  if (first && !tall && window.matchMedia('(min-width: 700px)').matches) first.focus();
  return { el: d, body: d.querySelector('.asheet-b'), close };
}

export function confirm(text, { ok = 'Confirm', cancel = 'Not now', danger = false, title = '' } = {}) {
  return new Promise(resolve => {
    let answer = false;
    const s = sheet({
      title: title || (danger ? 'Are you sure?' : 'Please confirm'),
      html: '<p class="a-p">' + esc(text) + '</p><div class="a-actions"><button type="button" class="btn btn-outline" data-no>' + esc(cancel) +
        '</button><button type="button" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' + esc(ok) + '</button></div>',
      onClose: () => resolve(answer)
    });
    s.body.querySelector('[data-yes]').addEventListener('click', () => { answer = true; s.close(); });
    s.body.querySelector('[data-no]').addEventListener('click', () => s.close());
  });
}

/* ---------- session and API ---------- */
let pin = '';
let settings = {};
let screen = null; // { poll?, destroy? }
let pollTimer = null;
let pendingCount = 0;

try { pin = sessionStorage.getItem(PIN_KEY) || ''; } catch (e) { pin = ''; }

function normSettings(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => { out[k.toLowerCase()] = obj[k]; });
  return out;
}
export const getSettings = () => settings;
function mergeSettings(obj) { settings = Object.assign({}, settings, normSettings(obj)); }

function logout(msg) {
  try { sessionStorage.removeItem(PIN_KEY); } catch (e) { /* ignore */ }
  pin = '';
  stopPoll();
  if (screen && screen.destroy) { try { screen.destroy(); } catch (e) { /* ignore */ } }
  screen = null;
  showLogin(msg || '');
}

async function call(action, params = {}) {
  try {
    return await API.adminApi(pin)(action, params);
  } catch (e) {
    const m = (e && e.message) || '';
    if (!e.network && /PIN/.test(m) && !/too many/i.test(m) && action !== 'set_pin' && action !== 'login') {
      logout('Please sign in again.');
    }
    throw e;
  }
}

/* Cached property list for pickers and WhatsApp texts. */
let propCache = null;
export async function props(force = false) {
  if (!propCache || force) {
    const r = await call('properties_admin', { include_archived: true });
    propCache = r.properties || [];
  }
  return propCache;
}
export const dropPropCache = () => { propCache = null; };

export function setBadge(n) {
  pendingCount = Number(n) || 0;
  document.querySelectorAll('[data-badge]').forEach(b => {
    b.textContent = pendingCount > 99 ? '99+' : String(pendingCount);
    b.hidden = pendingCount < 1;
  });
  try { document.title = (pendingCount ? '(' + pendingCount + ') ' : '') + 'Admin | RealEstateWithMo'; } catch (e) { /* ignore */ }
}

export const ctx = {
  api: call, esc, toast, copy, sheet, confirm, props, dropPropCache, setBadge, getSettings, mergeSettings,
  MOCK, TZ,
  AREAS: CFG.AREAS || [],
  AMENITIES: CFG.AMENITIES || [],
  SITE_URL: CFG.SITE_URL || 'https://highstreetstack.com/realestatewithmo/',
  nav: h => { location.hash = h; },
  icons: ICONS,
  f: { ngn, fmtDay, fmtRange, todayLagos, addDays, nights: nightsBetween, photoSrc, kindLabel, priceLabel, isDate },
  getPending: () => pendingCount,
  setPassword: p => { pin = p; try { sessionStorage.setItem(PIN_KEY, p); } catch (e) { /* ignore */ } }
};

/* ---------- login ---------- */
function showLogin(msg = '') {
  document.body.classList.remove('is-in');
  root.innerHTML =
    '<main class="a-login">' +
    '<div class="a-login-card">' +
    '<div class="a-login-mark" aria-hidden="true"><img src="../assets/icon.svg" alt="" width="56" height="56"></div>' +
    '<p class="eyebrow">RealEstateWithMo</p>' +
    '<h1>Welcome back, Mo</h1>' +
    '<p class="a-muted">Enter your PIN to open your bookings.</p>' +
    '<form id="a-login-f" novalidate>' +
    '<label class="field"><span class="a-lbl">PIN</span>' +
    '<input class="input a-pin" id="a-pin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" maxlength="12" placeholder="6 to 12 digits" aria-describedby="a-login-msg"></label>' +
    '<p id="a-login-msg" class="a-err" role="alert">' + esc(msg) + '</p>' +
    (MOCK ? '<p class="a-demo">Demo mode: any 6 digits</p>' : '') +
    '<button class="btn btn-primary a-block" type="submit" id="a-login-b">Sign in</button>' +
    '</form></div></main>';
  const f = document.getElementById('a-login-f');
  const inp = document.getElementById('a-pin');
  const out = document.getElementById('a-login-msg');
  inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 12); });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const v = inp.value.trim();
    if (!/^\d{6,12}$/.test(v)) { out.textContent = 'Your PIN is 6 to 12 digits.'; inp.focus(); return; }
    const b = document.getElementById('a-login-b');
    b.disabled = true; b.textContent = 'Checking...'; out.textContent = '';
    try {
      const r = await API.adminApi(v)('login', {});
      pin = v;
      try { sessionStorage.setItem(PIN_KEY, v); } catch (er) { /* ignore */ }
      mergeSettings(r.settings);
      startShell(r.counts && r.counts.pending);
    } catch (er) {
      out.textContent = (er && er.message) || 'Could not sign in.';
      b.disabled = false; b.textContent = 'Sign in';
      inp.select();
    }
  });
  if (!matchMedia('(pointer: coarse)').matches) inp.focus();
}

/* ---------- shell ---------- */
const TABS = [
  ['inbox', 'Inbox', ICONS.inbox],
  ['calendar', 'Calendar', ICONS.calendar],
  ['properties', 'Properties', ICONS.properties],
  ['shares', 'Links', ICONS.links],
  ['settings', 'Settings', ICONS.settings]
];

function startShell(pending) {
  document.body.classList.add('is-in');
  root.innerHTML =
    '<header class="a-top"><a class="a-brand" href="#inbox"><img src="../assets/icon.svg" alt="" width="30" height="30"><span><b>RealEstateWithMo</b><small>Your admin</small></span></a>' +
    '<button type="button" class="a-link" id="a-out">Sign out</button></header>' +
    '<nav class="a-tabs" aria-label="Main">' +
    TABS.map(t => '<a href="#' + t[0] + '" data-tab="' + t[0] + '"><span class="a-ic">' + t[2] +
      (t[0] === 'inbox' ? '<b class="a-badge" data-badge hidden>0</b>' : '') + '</span><span class="a-tl">' + t[1] + '</span></a>').join('') +
    '</nav>' +
    '<main id="a-view" class="a-main" tabindex="-1"></main>';
  document.getElementById('a-out').addEventListener('click', () => logout(''));
  setBadge(pending || 0);
  startPoll();
  route();
}

const TAB_OF = { inbox: 'inbox', calendar: 'calendar', properties: 'properties', property: 'properties', shares: 'shares', settings: 'settings' };

async function route() {
  if (!pin) { showLogin(); return; }
  const old = document.getElementById('a-view');
  if (!old) return;
  const view = old.cloneNode(false); // a fresh element so listeners from the last screen do not pile up
  old.replaceWith(view);
  const parts = (location.hash || '#inbox').replace(/^#\/?/, '').split('/');
  let name = parts[0] || 'inbox';
  const param = decodeURIComponent(parts.slice(1).join('/') || '');
  if (name === 'login') name = 'inbox';
  if (!TAB_OF[name]) name = 'inbox';
  if (screen && screen.destroy) { try { screen.destroy(); } catch (e) { /* ignore */ } }
  screen = null;
  document.querySelectorAll('.a-tabs a').forEach(a => {
    const on = a.dataset.tab === TAB_OF[name];
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  view.innerHTML = '<div class="a-skel"><div></div><div></div><div></div></div>';
  window.scrollTo(0, 0);
  const mine = (route.n = (route.n || 0) + 1);
  try {
    let s = null;
    if (name === 'inbox') s = await Inbox.render(view, ctx, param);
    else if (name === 'calendar') s = await Cal.render(view, ctx, param);
    else if (name === 'properties') s = await Props.render(view, ctx, param);
    else if (name === 'property') s = await Props.renderEditor(view, ctx, param);
    else if (name === 'shares') s = await Shares.render(view, ctx, param);
    else if (name === 'settings') s = await Settings.render(view, ctx, param);
    if (mine !== route.n) { if (s && s.destroy) s.destroy(); return; }
    screen = s || null;
  } catch (e) {
    if (mine !== route.n) return;
    const msg = (e && e.message) || 'Something went wrong.';
    view.innerHTML = '<div class="a-state"><h2>That did not load</h2><p>' + esc(msg) + '</p><button class="btn btn-primary" id="a-retry">Try again</button></div>';
    const r = document.getElementById('a-retry');
    if (r) r.addEventListener('click', route);
  }
}

/* ---------- polling: every 60 s while the tab is visible ---------- */
async function tick() {
  if (!pin || document.visibilityState !== 'visible') return;
  try {
    if (screen && screen.poll) await screen.poll();
    if (!(screen && screen.badge)) {
      const r = await call('bookings', { status: 'pending' });
      setBadge((r.bookings || []).length);
    }
  } catch (e) { /* quiet: the next tick tries again */ }
}
function startPoll() {
  stopPoll();
  pollTimer = setInterval(tick, 60000);
}
function stopPoll() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && pin) tick(); });

window.addEventListener('hashchange', () => { if (pin) route(); });

/* ---------- boot ---------- */
(async function boot() {
  if (!pin) { showLogin(); return; }
  root.innerHTML = '<div class="a-boot" aria-busy="true"><div class="a-skel"><div></div><div></div></div></div>';
  try {
    const r = await API.adminApi(pin)('login', {});
    mergeSettings(r.settings);
    startShell(r.counts && r.counts.pending);
  } catch (e) {
    if (e && e.network) {
      root.innerHTML = '<div class="a-state"><h2>No signal</h2><p>' + esc(e.message) + '</p><button class="btn btn-primary" id="a-retry">Try again</button></div>';
      document.getElementById('a-retry').addEventListener('click', () => location.reload());
    } else {
      try { sessionStorage.removeItem(PIN_KEY); } catch (er) { /* ignore */ }
      pin = '';
      showLogin((e && e.message) || '');
    }
  }
})();
