import { MOCK } from './config.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* keep ?mock when moving between pages */
export function href(p) {
  if (!new URLSearchParams(location.search).has('mock')) return p;
  const [base, hash] = p.split('#');
  return base + (base.includes('?') ? '&' : '?') + 'mock' + (hash !== undefined ? '#' + hash : '');
}

/* ---- dates (Europe/London, YYYY-MM-DD) ---- */
export function todayLondon() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const utc = iso => new Date(iso + 'T00:00:00Z');
export function addDays(iso, n) { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function weekEndingOf(iso) { const d = utc(iso).getUTCDay(); return addDays(iso, d === 0 ? 0 : 7 - d); }
export function fmtDate(iso, long) {
  if (!iso) return '';
  return utc(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...(long ? { weekday: 'long', month: 'long' } : {}) });
}
export function fmtShort(iso) { return iso ? utc(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''; }
export function fmtDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return String(ts);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
}

/* ---- codes ---- */
export const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
export const fmtCode = s => { const n = normCode(s); return n.length > 4 ? n.slice(0, 4) + '-' + n.slice(4) : n; };

export const fmtNum = n => { const x = Number(n); return isFinite(x) ? String(Math.round(x * 100) / 100) : ''; };

export function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function wordmark(tag = 'a') {
  const attrs = tag === 'a' ? ` href="${href('index.html')}" aria-label="Bennetts home"` : '';
  return `<${tag} class="wm"${attrs}><span class="wm-name">bennetts</span><span class="wm-sub">TOWER CRANE PROFESSIONALS</span></${tag}>`;
}

/* header + fixed call bar + fine print */
export function chrome({ back, backLabel = 'Back', phone = '01453 811754' } = {}) {
  const tel = phone.replace(/\s+/g, '');
  const hdr = document.getElementById('hdr');
  if (hdr) {
    hdr.className = 'hdr';
    hdr.innerHTML = `<div class="hdr-in">${back ? `<a class="back" href="${href(back)}" aria-label="${esc(backLabel)}">&#8592; ${esc(backLabel)}</a>` : ''}${wordmark()}<span class="sp"></span>${MOCK ? `<button type="button" class="pill" id="demoPill" title="Tap to simulate no signal">Demo mode</button>` : ''}</div>`;
  }
  const ftr = document.getElementById('ftr');
  if (ftr) ftr.innerHTML = `<div class="fine">CraneCheck by High Street Stack</div><a class="callbar" href="tel:${tel}">&#9742; Phone Bennetts office ${esc(phone)}</a>`;
  if (MOCK) {
    const pill = document.getElementById('demoPill');
    const paint = () => {
      const off = localStorage.getItem('cc_mock_offline') === '1';
      pill.textContent = off ? 'Demo mode · no signal' : 'Demo mode';
      pill.classList.toggle('off', off);
    };
    try { paint(); pill.addEventListener('click', () => { try { localStorage.setItem('cc_mock_offline', localStorage.getItem('cc_mock_offline') === '1' ? '0' : '1'); } catch (e) {} paint(); window.dispatchEvent(new Event(localStorage.getItem('cc_mock_offline') === '1' ? 'offline' : 'online')); }); } catch (e) {}
  }
  registerSW();
}

function registerSW() {
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register(new URL('../sw.js', import.meta.url).pathname).catch(() => {});
    }
  } catch (e) {}
}

export function loading(msg = 'Loading…') { return `<div class="loading"><span class="spin"></span><p>${esc(msg)}</p></div>`; }

export async function loadForms() {
  const r = await fetch(new URL('../forms.json', import.meta.url));
  if (!r.ok) throw new Error('Could not load form definitions.');
  return r.json();
}

export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((res, rej) => {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy') ? res() : rej(new Error('copy failed')); } catch (e) { rej(e); } finally { ta.remove(); }
  });
}

export function debounce(fn, ms = 400) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
