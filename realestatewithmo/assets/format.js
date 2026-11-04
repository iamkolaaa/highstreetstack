import { TZ, WA_FALLBACK } from './config.js?v=202611040819';

const DAY = 86400000;
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const utc = d => { const [y, m, dd] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, dd); };
const ymd = ms => { const x = new Date(ms); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`; };

export const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
export const addDays = (d, n) => ymd(utc(d) + n * DAY);
export const nights = (a, b) => (a && b ? Math.round((utc(b) - utc(a)) / DAY) : 0);
export const weekday = d => new Date(utc(d)).getUTCDay();
export const monthLabel = m => { const [y, mo] = m.split('-').map(Number); return `${MON_LONG[mo - 1]} ${y}`; };

export function todayLagos() {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const g = t => p.find(x => x.type === t).value;
    return `${g('year')}-${g('month')}-${g('day')}`;
  } catch (e) {
    return ymd(Date.now() + 3600000);
  }
}

export const ngn = n => '₦' + Math.round(Number(n) || 0).toLocaleString('en-GB');

export function priceLabel(p) {
  if (!p || p.price_ngn == null || p.price_ngn === '' || Number(p.price_ngn) <= 0) return p && p.price_note ? p.price_note : 'Contact for pricing';
  const v = ngn(p.price_ngn);
  switch (p.price_unit) {
    case 'night': return v + ' / night';
    case 'per_plot': return v + ' per plot';
    case 'per_sqm': return v + ' per sqm';
    default: return v;
  }
}

export function priceParts(p) {
  const l = priceLabel(p);
  const i = l.indexOf(' / ');
  if (i > 0) return { main: l.slice(0, i), unit: l.slice(i + 1) };
  const j = l.indexOf(' per ');
  if (j > 0) return { main: l.slice(0, j), unit: l.slice(j + 1) };
  return { main: l, unit: '' };
}

export const fmtDay = d => { if (!isDate(d)) return ''; const x = new Date(utc(d)); return `${WD[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
export const fmtLong = d => { if (!isDate(d)) return ''; const x = new Date(utc(d)); return `${WD_LONG[x.getUTCDay()]} ${x.getUTCDate()} ${MON_LONG[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
export const fmtShort = d => { if (!isDate(d)) return ''; const x = new Date(utc(d)); return `${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
export const fmtTime = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return t || ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`; };

export function fmtRange(a, b) {
  if (!isDate(a) || !isDate(b)) return '';
  const n = nights(a, b);
  const x = new Date(utc(a)), y = new Date(utc(b));
  const left = x.getUTCMonth() === y.getUTCMonth() && x.getUTCFullYear() === y.getUTCFullYear() ? String(x.getUTCDate()) : `${x.getUTCDate()} ${MON[x.getUTCMonth()]}`;
  return `${left} to ${y.getUTCDate()} ${MON[y.getUTCMonth()]} (${n} night${n === 1 ? '' : 's'})`;
}

export function photoSrc(photo, w = 800) {
  if (!photo) return '';
  if (photo.id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(photo.id)}&sz=w${w}`;
  const u = String(photo.url || '');
  if (/^https:\/\/images\.unsplash\.com\//.test(u) && /[?&]w=\d+/.test(u)) return u.replace(/([?&]w=)\d+/, '$1' + w);
  return u;
}

export function waUrl(settings, text) {
  const base = (settings && settings.whatsapp_url) || WA_FALLBACK;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function waClientUrl(phone, text) {
  const d = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

export const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const KIND = { shortlet: 'Shortlet', land: 'Land', residential: 'Residential', commercial: 'Commercial' };
export const kindLabel = k => KIND[k] || 'Property';
export const brandOf = k => (k === 'shortlet' ? 'eko' : 'mo');
export const isSale = k => k === 'land' || k === 'residential' || k === 'commercial';

/* Build a relative link, carrying ?mock when the current page has it. */
export function href(path, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) q.set(k, v === true ? '' : v); });
  try { if (new URLSearchParams(location.search).has('mock') && !q.has('mock')) q.set('mock', ''); } catch (e) { /* no location */ }
  const s = q.toString().replace(/mock=(&|$)/, 'mock$1');
  return s ? `${path}?${s}` : path;
}

export const param = k => { try { return new URLSearchParams(location.search).get(k) || ''; } catch (e) { return ''; } };
