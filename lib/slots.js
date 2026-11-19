// Call booking slots. Times are UK local (Europe/London). Shared by call/call.js and tests;
// apps-script/Code.gs keeps a copy of the same rules for the server check.
export const SLOT_MIN = 20;
export const LEAD_MIN = 180;      // earliest slot is 3 hours from now
export const DAYS_AHEAD = 14;
// Day of week (0 = Sunday) -> [first start, end]. Missing day = no calls.
export const HOURS = { 1: ['09:00', '18:00'], 2: ['09:00', '18:00'], 3: ['09:00', '18:00'], 4: ['09:00', '18:00'], 5: ['09:00', '18:00'], 6: ['10:00', '14:00'] };

const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const pad = n => String(n).padStart(2, '0');
const toHHMM = min => pad(Math.floor(min / 60)) + ':' + pad(min % 60);

export function londonNow(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n, 12));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

// All slots for a day in the schedule, ignoring what's booked.
export function daySlots(date) {
  const h = HOURS[weekday(date)];
  if (!h) return [];
  const out = [];
  for (let t = toMin(h[0]); t + SLOT_MIN <= toMin(h[1]); t += SLOT_MIN) out.push(toHHMM(t));
  return out;
}

// Slots someone can still book: in the schedule, at least LEAD_MIN away, within DAYS_AHEAD, not taken.
export function openSlots(date, now, taken = new Set()) {
  const offset = dayDiff(now.date, date);
  if (offset < 0 || offset > DAYS_AHEAD) return [];
  const cutoff = offset === 0 ? now.minutes + LEAD_MIN : (offset === 1 ? now.minutes + LEAD_MIN - 1440 : -1);
  return daySlots(date).filter(t => toMin(t) >= cutoff && !taken.has(date + ' ' + t));
}

export function dayDiff(a, b) {
  const u = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((u(b) - u(a)) / 86400000);
}

export function bookableDays(now, taken) {
  const out = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const d = addDays(now.date, i);
    if (daySlots(d).length) out.push({ date: d, open: openSlots(d, now, taken).length });
  }
  return out;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const safe = v => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);

export function validateCall(body, now) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  if (clip(body.hss_ref, 10)) return { ok: false, error: 'spam', silent: true };
  const name = clip(body.name, 120), phone = clip(body.phone, 40), email = clip(body.email, 200);
  const date = clip(body.date, 10), time = clip(body.time, 5);
  if (!name) return { ok: false, error: 'name required' };
  if ((phone.match(/\d/g) || []).length < 7) return { ok: false, error: 'valid phone required' };
  if (!EMAIL.test(email)) return { ok: false, error: 'valid email required' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: 'pick a time' };
  if (!openSlots(date, now).includes(time)) return { ok: false, error: 'time not available' };
  return { ok: true, call: { name, phone, email, biz: clip(body.biz, 200), topic: clip(body.topic, 1000), date, time } };
}

export { safe };
