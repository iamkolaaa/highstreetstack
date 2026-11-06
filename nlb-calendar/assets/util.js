/* Small helpers shared by the client page and the admin page. */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = n => String(n).padStart(2, '0');
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const todayLondon = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const parts = iso => iso.split('-').map(Number);
export const weekday = iso => { const [y, m, d] = parts(iso); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const addDays = (iso, n) => { const [y, m, d] = parts(iso); const t = new Date(Date.UTC(y, m - 1, d)); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export const fmtDay = iso => { if (!iso) return ''; const [, m, d] = parts(iso); return `${DAYS[weekday(iso)]} ${d} ${MONTHS[m - 1]}`; };
export const fmtDayLong = iso => { const [, m, d] = parts(iso); return `${DAYS_LONG[weekday(iso)]} ${d} ${MONTH_FULL[m - 1]}`; };
export const fmtMonth = ym => { const [y, m] = ym.split('-').map(Number); return `${MONTH_FULL[m - 1]} ${y}`; };
export const fmtStamp = s => { const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s || ''); return m ? `${fmtDay(m[1])} at ${m[2]}` : String(s || ''); };
export const money = p => '£' + (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));
export const poundsToPence = v => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return isFinite(n) && String(v).trim() !== '' ? Math.round(n * 100) : null; };
export const penceToPounds = p => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));
export const clock = sec => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;

/* Storage can be blocked (private windows, site data off), so every use is guarded. */
export const store = {
  get(k, fallback = '') { try { const v = localStorage.getItem(k); return v == null ? fallback : v; } catch (e) { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  getS(k, fallback = '') { try { const v = sessionStorage.getItem(k); return v == null ? fallback : v; } catch (e) { return fallback; } },
  setS(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  delS(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
};

export function randomToken() {
  const a = new Uint8Array(16);
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
  return 'tk' + Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

export function toast(msg, kind = '') {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg; t.setAttribute('role', 'status');
  box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 6000 : 3200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
