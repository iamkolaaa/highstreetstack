/* In-memory stand-in for the RealEstateWithMo API (docs/API.md). Demo only.
   Changes live in memory and are copied to sessionStorage, so a reload in the same tab keeps them.
   Demo mode accepts any admin PIN of 6 to 12 digits. */
import { ApiError } from './api.js?v=202611040820';
import { SITE_URL, WA_FALLBACK, AMENITIES } from './config.js?v=202611040820';
import { DEMO_PROPERTIES, DEMO_BOOKINGS, DEMO_BLOCKS, DEMO_SHARES, DEMO_SETTINGS } from './seed.js?v=202611040820';

export const IS_MOCK = true;
export const isMock = () => true;
export const DEMO_PIN_HINT = 'Demo mode: any 6 digits';
const STORE_KEY = 'rm_mock_db_v1';
const LATENCY = 220;
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SALE_KINDS = ['land', 'residential', 'commercial'];
const KINDS = ['shortlet', ...SALE_KINDS];
const UNITS = ['night', 'total', 'per_plot', 'per_sqm'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, '0');
const err = m => new ApiError(m);

/* ---------- time (Africa/Lagos) ---------- */
function lagosParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const today = () => lagosParts().date;
const nowStamp = (d = new Date()) => { const p = lagosParts(d); return `${p.date} ${p.time}`; };
const isDateStr = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const dow = s => new Date(s + 'T00:00:00Z').getUTCDay();
const clash = (a, b) => a.from < b.to && b.from < a.to;
function shortDay(s) { const d = new Date(s + 'T00:00:00Z'); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }
function longDay(s) { const d = new Date(s + 'T00:00:00Z'); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }
function rangeLabel(a, b) { return a.slice(5, 7) === b.slice(5, 7) ? `${+a.slice(8)} to ${shortDay(b)}` : `${shortDay(a)} to ${shortDay(b)}`; }
function dayList(days) {
  const d = [...days].sort((a, b) => a - b);
  const order = d.map(x => (x + 6) % 7); // Monday first
  const contiguous = order.every((v, i) => i === 0 || v === order[i - 1] + 1);
  const names = d.map(x => DAYS[x]);
  if (d.length > 2 && contiguous) return `${DAYS[d.find(x => (x + 6) % 7 === order[0])]} to ${DAYS[d.find(x => (x + 6) % 7 === order[order.length - 1])]}`;
  return names.join(', ');
}

/* ---------- small helpers ---------- */
const rndStr = (n, alphabet) => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n)), b => alphabet[b % alphabet.length]).join('');
const code = n => rndStr(n, CODE_ALPHABET);
const idLike = (pre, n = 8) => pre + rndStr(n, 'abcdefghijklmnopqrstuvwxyz234567');
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const intOrNull = v => (v === '' || v == null) ? null : (/^\d+$/.test(String(v)) ? Number(v) : NaN);

function normPhone(raw) {
  const s = String(raw == null ? '' : raw).replace(/[\s\-().]/g, '');
  if (!s) return '';
  if (s[0] === '+') { return /^\+\d{8,15}$/.test(s) ? s : null; }
  if (/^0\d{10}$/.test(s)) return '+234' + s.slice(1);
  if (/^234\d{10}$/.test(s)) return '+' + s;
  return null;
}
const isEmail = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

/* ---------- state ---------- */
let db = null;

function freshDb() {
  const props = clone(DEMO_PROPERTIES).map(p => ({
    ...p, featured: !!p.featured, demo: p.demo === 'yes' || p.demo === true,
    ical_token: rndStr(16, '0123456789abcdef'), ical_import_url: '', created_at: nowStamp(), updated_at: nowStamp()
  }));
  return { settings: clone(DEMO_SETTINGS), properties: props, bookings: clone(DEMO_BOOKINGS), blocks: clone(DEMO_BLOCKS), shares: clone(DEMO_SHARES), wrong: [], lockedUntil: 0 };
}
function persist() {
  try { globalThis.sessionStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* storage full or blocked: memory only */ }
}
function init() {
  if (db) return;
  try { const raw = globalThis.sessionStorage.getItem(STORE_KEY); if (raw) db = JSON.parse(raw); } catch (e) { db = null; }
  if (!db || !db.properties) db = freshDb();
  persist();
}
export function resetMock() { db = freshDb(); persist(); }

/* ---------- settings ---------- */
const S = k => db.settings[k] == null ? '' : String(db.settings[k]);
const SN = (k, d) => { const n = parseInt(S(k), 10); return isNaN(n) ? d : n; };
const list = k => S(k).split(',').map(x => x.trim()).filter(Boolean);
const waBase = () => S('WHATSAPP_NUMBER') ? 'https://wa.me/' + S('WHATSAPP_NUMBER').replace(/\D/g, '') : (S('WHATSAPP_LINK') || WA_FALLBACK);
function settingsPublic() {
  return {
    whatsapp_url: waBase(), check_in: S('CHECK_IN') || '14:00', check_out: S('CHECK_OUT') || '11:00',
    min_nights: SN('MIN_NIGHTS', 1), max_nights: SN('MAX_NIGHTS', 30), hold_hours: SN('HOLD_HOURS', 24),
    inspection_days: list('INSPECTION_DAYS').map(Number), inspection_slots: list('INSPECTION_SLOTS'),
    consult_days: list('CONSULT_DAYS').map(Number), consult_slots: list('CONSULT_SLOTS'), site_url: S('SITE_URL') || SITE_URL
  };
}
const settingsAdmin = () => { const s = clone(db.settings); delete s.PHOTOS_FOLDER_ID; return s; };

/* ---------- properties ---------- */
const minNightsOf = p => p.min_nights ? Number(p.min_nights) : SN('MIN_NIGHTS', 1);
function card(p) {
  return {
    id: p.id, slug: p.slug, kind: p.kind, brand: p.kind === 'shortlet' ? 'eko' : 'mo', title: p.title, area: p.area,
    lat: p.lat == null || p.lat === '' ? null : Number(p.lat), lng: p.lng == null || p.lng === '' ? null : Number(p.lng),
    summary: p.summary || '', bedrooms: p.bedrooms || 0, bathrooms: p.bathrooms || 0, max_guests: p.max_guests || 0,
    price_ngn: p.price_ngn ?? null, price_unit: p.price_unit || 'night', price_note: p.price_note || '', min_nights: minNightsOf(p),
    cover: (p.photos && p.photos[0]) || null, photo_count: (p.photos || []).length, featured: !!p.featured, demo: !!p.demo
  };
}
function full(p) {
  return { ...card(p), description: p.description || '', address: p.address || '', amenities: [...(p.amenities || [])], photos: clone(p.photos || []), check_in: p.check_in || S('CHECK_IN') || '14:00', check_out: p.check_out || S('CHECK_OUT') || '11:00', unavailable: unavailable(p.id, today(), addDays(today(), 365)) };
}
const nextBooking = p => {
  const now = nowStamp();
  const b = db.bookings.filter(x => x.property_id === p.id && x.kind === 'stay' && x.check_out > today() && (x.status === 'confirmed' || (x.status === 'pending' && x.hold_until > now))).sort((a, c) => a.check_in.localeCompare(c.check_in))[0];
  return b ? { ref: b.ref, status: b.status, check_in: b.check_in, check_out: b.check_out, name: b.name } : null;
};
function adminShape(p) {
  return { ...full(p), status: p.status, sort: p.sort ?? 0, demo: !!p.demo, ical_url: `https://script.google.com/macros/s/DEMO/exec?ical=${p.id}&k=${p.ical_token}`, ical_import_url: p.ical_import_url || '', updated_at: p.updated_at, next_booking: nextBooking(p) };
}
const live = () => db.properties.filter(p => p.status === 'live');
const byRank = (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.sort ?? 0) - (b.sort ?? 0) || a.title.localeCompare(b.title);
const findProp = (id) => db.properties.find(p => p.id === id);
function livePropOrThrow(id) {
  const p = id && findProp(id);
  if (!p || p.status !== 'live') throw err('That property is not available.');
  return p;
}

/* ---------- availability ---------- */
function expireHolds() {
  const now = nowStamp(); let changed = false;
  for (const b of db.bookings) if (b.kind === 'stay' && b.status === 'pending' && b.hold_until && b.hold_until <= now) { b.status = 'expired'; b.updated_at = now; changed = true; }
  if (changed) persist();
}
function occupied(propertyId, { ignoreRef = '' } = {}) {
  const now = nowStamp(), buf = SN('CLEANING_BUFFER_DAYS', 0), out = [];
  for (const b of db.bookings) {
    if (b.property_id !== propertyId || b.kind !== 'stay' || b.ref === ignoreRef) continue;
    const holds = b.status === 'confirmed' || (b.status === 'pending' && b.hold_until > now);
    if (holds) out.push({ from: b.check_in, to: addDays(b.check_out, buf) });
  }
  for (const k of db.blocks) if (k.property_id === propertyId) out.push({ from: k.from, to: k.to });
  return out;
}
const isFree = (propertyId, from, to, opts) => !occupied(propertyId, opts).some(r => clash({ from, to }, r));
function unavailable(propertyId, from, to) {
  const rs = occupied(propertyId).filter(r => r.to > from && r.from < to).sort((a, b) => a.from.localeCompare(b.from));
  const merged = [];
  for (const r of rs) {
    const last = merged[merged.length - 1];
    if (last && r.from <= last.to) { if (r.to > last.to) last.to = r.to; } else merged.push({ from: r.from, to: r.to });
  }
  return merged;
}
const quoteFor = (p, nights) => (p.price_unit === 'night' && p.price_ngn != null) ? nights * p.price_ngn : null;

/* ---------- validation ---------- */
function requireContact(p, { phoneOptional = false } = {}) {
  const name = clip(p.name, 80);
  if (name.length < 2) throw err('Add your name.');
  let phone = '';
  if (!String(p.phone || '').trim()) { if (!phoneOptional) throw err('Add a phone number we can reach you on WhatsApp.'); }
  else { phone = normPhone(p.phone); if (!phone) throw err('That phone number does not look right.'); }
  const email = clip(p.email, 120);
  if (email && !isEmail(email)) throw err('That email address does not look right.');
  return { name, phone, email };
}
function checkStayDates(prop, p, { ignoreRef = '' } = {}) {
  if (!isDateStr(p.check_in) || !isDateStr(p.check_out)) throw err('Pick your check-in and check-out dates.');
  if (p.check_out <= p.check_in) throw err('Pick a check-out date after the check-in date.');
  if (p.check_in < today()) throw err('The earliest check-in is today.');
  if (p.check_in > addDays(today(), SN('MAX_ADVANCE_DAYS', 365))) throw err('That is too far ahead. Message Mo for dates beyond a year.');
  const nights = daysBetween(p.check_in, p.check_out), min = minNightsOf(prop), max = SN('MAX_NIGHTS', 30);
  if (nights < min) throw err(`This place needs at least ${min} nights.`);
  if (nights > max) throw err(`Stays over ${max} nights are arranged on WhatsApp.`);
  if (!isFree(prop.id, p.check_in, p.check_out, { ignoreRef })) throw err('Those dates are no longer free. Pick different dates.');
  return nights;
}
function checkSlot(kind, p, propertyId, { ignoreRef = '' } = {}) {
  const days = (kind === 'inspection' ? list('INSPECTION_DAYS') : list('CONSULT_DAYS')).map(Number);
  const slots = kind === 'inspection' ? list('INSPECTION_SLOTS') : list('CONSULT_SLOTS');
  if (!isDateStr(p.slot_date) || !isTime(p.slot_time)) throw err('Pick a date and time slot.');
  if (p.slot_date < today() || p.slot_date > addDays(today(), 90) || !slots.includes(p.slot_time)) throw err('Pick a date and time slot.');
  if (!days.includes(dow(p.slot_date))) throw err(`${kind === 'inspection' ? 'Inspections' : 'Consultations'} run ${dayList(days)}. Pick another day.`);
  const taken = db.bookings.some(b => b.ref !== ignoreRef && b.kind === kind && b.status === 'confirmed' && b.slot_date === p.slot_date && b.slot_time === p.slot_time && (kind === 'consultation' || b.property_id === propertyId));
  if (taken) throw err('That slot is taken. Pick another.');
}
const shortTitle = t => String(t).split(',')[0].split(' with ')[0];

function makeBooking(p, { admin = false } = {}) {
  const kind = p.kind;
  if (!['stay', 'inspection', 'consultation'].includes(kind)) throw err('Something went wrong. Please try again.');
  if (!admin && String(p.website || '').trim()) throw err('Something went wrong. Please try again.');
  const who = requireContact(p, { phoneOptional: admin });
  const now = nowStamp();
  const b = {
    ref: 'RM-' + code(5), kind, status: admin ? (p.status === 'pending' ? 'pending' : 'confirmed') : 'pending', property_id: '', property_title: '',
    check_in: '', check_out: '', nights: 0, guests: 0, slot_date: '', slot_time: '', mode: '', name: who.name, phone: who.phone, email: who.email,
    note: clip(p.note, 600), quote_ngn: null, source: admin ? 'admin' : 'site', share_code: '', hold_until: '', admin_note: '', created_at: now, updated_at: now
  };
  if (!admin && who.phone) {
    const sameDay = db.bookings.filter(x => x.phone === who.phone && x.source !== 'admin' && x.created_at.slice(0, 10) === today()).length;
    if (sameDay >= 5) throw err('Too many requests from this number today. Message Mo on WhatsApp instead.');
  }
  if (kind === 'stay') {
    const prop = livePropOrThrow(p.property_id);
    if (prop.kind !== 'shortlet') throw err('That property is not available.');
    b.nights = checkStayDates(prop, p);
    const guests = parseInt(p.guests, 10) || 1;
    if (prop.max_guests && guests > prop.max_guests) throw err(`This place sleeps up to ${prop.max_guests} guests.`);
    Object.assign(b, { property_id: prop.id, property_title: prop.title, check_in: p.check_in, check_out: p.check_out, guests, quote_ngn: quoteFor(prop, b.nights) });
    if (b.status === 'pending') b.hold_until = nowStamp(new Date(Date.now() + SN('HOLD_HOURS', 24) * 3600000));
  } else if (kind === 'inspection') {
    const prop = livePropOrThrow(p.property_id);
    if (prop.kind === 'shortlet') throw err('That property is not available.');
    checkSlot('inspection', p, prop.id);
    Object.assign(b, { property_id: prop.id, property_title: prop.title, slot_date: p.slot_date, slot_time: p.slot_time });
  } else {
    if (!['online', 'in_person'].includes(p.mode)) throw err('Something went wrong. Please try again.');
    let prop = null;
    if (p.property_id) { prop = findProp(p.property_id); if (!prop) throw err('That property is not available.'); }
    checkSlot('consultation', p, '');
    Object.assign(b, { mode: p.mode, slot_date: p.slot_date, slot_time: p.slot_time, property_id: prop ? prop.id : '', property_title: prop ? prop.title : '' });
  }
  if (!admin && p.share_code) {
    const sh = db.shares.find(s => s.code === String(p.share_code).toUpperCase() && s.status === 'active');
    if (sh) { b.source = 'share'; b.share_code = sh.code; }
  }
  db.bookings.push(b);
  persist();
  return b;
}
function bookingPublic(b) {
  return { ref: b.ref, kind: b.kind, status: b.status, property_title: b.property_title, check_in: b.check_in, check_out: b.check_out, nights: b.nights, guests: b.guests, slot_date: b.slot_date, slot_time: b.slot_time, mode: b.mode, quote_ngn: b.quote_ngn, hold_until: b.hold_until, created_at: b.created_at };
}
function waText(b) {
  if (b.kind === 'stay') return `Hello Mo, I have requested ${b.ref}: ${shortTitle(b.property_title)}, ${rangeLabel(b.check_in, b.check_out)}, ${b.guests} guest${b.guests === 1 ? '' : 's'}.`;
  if (b.kind === 'inspection') return `Hello Mo, I have requested ${b.ref}: an inspection of ${shortTitle(b.property_title)} on ${longDay(b.slot_date)} at ${b.slot_time}.`;
  return `Hello Mo, I have requested ${b.ref}: a ${b.mode === 'online' ? 'video' : 'face to face'} consultation on ${longDay(b.slot_date)} at ${b.slot_time}.`;
}
const adminBooking = b => ({ ...clone(b), property_title: b.property_id && findProp(b.property_id) ? findProp(b.property_id).title : b.property_title });

/* ---------- admin gate ---------- */
function checkPin(p) {
  const now = Date.now();
  if (now < db.lockedUntil) throw err('Too many wrong PINs. Try again in 15 minutes.');
  if (!/^\d{6,12}$/.test(String(p.pin || ''))) {
    db.wrong = db.wrong.filter(t => now - t < 15 * 60000); db.wrong.push(now);
    if (db.wrong.length >= 5) { db.lockedUntil = now + 15 * 60000; db.wrong = []; persist(); throw err('Too many wrong PINs. Try again in 15 minutes.'); }
    persist();
    throw err('That PIN is not right.');
  }
}

/* ---------- property editing ---------- */
function validateProperty(src, existing) {
  const d = { ...(existing || {}), ...src };
  const title = clip(d.title, 200);
  if (title.length < 3 || title.length > 90) throw err('The title must be 3 to 90 characters.');
  if (!clip(d.area, 80)) throw err('Add the area.');
  if (!KINDS.includes(d.kind)) throw err('Pick a property type.');
  const price = intOrNull(d.price_ngn);
  if (Number.isNaN(price) || (price != null && price > 10000000000)) throw err('The price must be a whole number of naira.');
  const num = (v, lo, hi, m) => { if (v === '' || v == null) return null; const n = Number(v); if (!isFinite(n) || n < lo || n > hi) throw err(m); return n; };
  const lat = num(d.lat, -90, 90, 'The map pin looks wrong. Check the latitude.');
  const lng = num(d.lng, -180, 180, 'The map pin looks wrong. Check the longitude.');
  let minN = null;
  if (d.min_nights !== '' && d.min_nights != null) { minN = Number(d.min_nights); if (!Number.isInteger(minN) || minN < 1 || minN > 30) throw err('Minimum nights must be 1 to 30.'); }
  for (const k of ['check_in', 'check_out']) if (d[k] && !isTime(d[k])) throw err('Times must look like 14:00.');
  const amenities = Array.isArray(d.amenities) ? d.amenities : [];
  if (amenities.some(a => !AMENITIES.includes(a))) throw err('Pick amenities from the list.');
  if (String(d.description || '').length > 3000) throw err('The description is too long (3000 characters at most).');
  if (String(d.summary || '').length > 200) throw err('The summary is too long (200 characters at most).');
  const photos = Array.isArray(d.photos) ? d.photos : [];
  if (photos.length > 20) throw err('Add up to 20 photos.');
  const unit = UNITS.includes(d.price_unit) ? d.price_unit : (d.kind === 'shortlet' ? 'night' : 'total');
  const intField = v => { const n = intOrNull(v); if (Number.isNaN(n)) throw err('Bedrooms, bathrooms and guests must be whole numbers.'); return n; };
  return {
    kind: d.kind, title, area: clip(d.area, 80), address: clip(d.address, 200), lat, lng, summary: String(d.summary || '').trim(), description: String(d.description || '').trim(),
    bedrooms: intField(d.bedrooms), bathrooms: intField(d.bathrooms), max_guests: intField(d.max_guests), price_ngn: price, price_unit: unit, price_note: clip(d.price_note, 120),
    min_nights: minN, check_in: d.check_in || '', check_out: d.check_out || '', amenities, photos: photos.map(x => (x && x.id) ? { id: String(x.id) } : { url: String(x && x.url) }), featured: d.featured === true || d.featured === 'yes'
  };
}
function uniqueSlug(title, area, ownId) {
  const base = slugify(String(title).split(',')[0] + ' ' + area) || 'property';
  let s = base, n = 2;
  while (db.properties.some(p => p.slug === s && p.id !== ownId)) s = base + '-' + n++;
  return s;
}
const photoKey = ph => ph.id || ph.url;
const photoIdx = (p, id) => p.photos.findIndex(ph => photoKey(ph) === id);

function validateSettings(inp) {
  const out = {};
  const ints = { MIN_NIGHTS: [1, 30], MAX_NIGHTS: [1, 365], CLEANING_BUFFER_DAYS: [0, 14], HOLD_HOURS: [1, 168], MAX_ADVANCE_DAYS: [30, 730], SHARE_EXPIRY_DAYS: [1, 90] };
  const times = ['CHECK_IN', 'CHECK_OUT'];
  const slotLists = ['INSPECTION_SLOTS', 'CONSULT_SLOTS'], dayLists = ['INSPECTION_DAYS', 'CONSULT_DAYS'];
  const freeText = ['WHATSAPP_LINK', 'NOTIFY_EMAIL', 'ALERT_EMAIL', 'SITE_URL', 'ICAL_IMPORT'];
  for (const [k, v0] of Object.entries(inp || {})) {
    const v = String(v0 == null ? '' : v0).trim();
    if (k === 'WHATSAPP_NUMBER') { const digits = v.replace(/[+\s]/g, ''); if (digits && !/^\d{10,15}$/.test(digits)) throw err('The WhatsApp number must be 10 to 15 digits, with the country code.'); out[k] = digits; }
    else if (ints[k]) { if (!/^\d+$/.test(v) || +v < ints[k][0] || +v > ints[k][1]) throw err(`${k.toLowerCase().replace(/_/g, ' ')} must be a whole number from ${ints[k][0]} to ${ints[k][1]}.`); out[k] = v; }
    else if (times.includes(k)) { if (!isTime(v)) throw err('Times must look like 14:00.'); out[k] = v; }
    else if (slotLists.includes(k)) { const parts = v.split(',').map(x => x.trim()).filter(Boolean); if (!parts.length || !parts.every(isTime)) throw err('Slots must be times like 10:00, separated by commas.'); out[k] = parts.join(','); }
    else if (dayLists.includes(k)) { const parts = v.split(',').map(x => x.trim()).filter(Boolean); if (!parts.every(x => /^[0-6]$/.test(x))) throw err('Days must be numbers from 0 (Sunday) to 6 (Saturday).'); out[k] = parts.join(','); }
    else if (freeText.includes(k)) { if (k === 'ICAL_IMPORT' && !['yes', 'no'].includes(v)) throw err('Calendar import must be yes or no.'); if (k === 'WHATSAPP_LINK' && v && !/^https:\/\//.test(v)) throw err('Links must start with https://.'); out[k] = v.slice(0, 500); }
    else if (k.startsWith('LAST_') || k === 'PHOTOS_FOLDER_ID') continue;
    else throw err(`Unknown setting ${k}.`);
  }
  return out;
}

function parseMapUrl(url) {
  const u = String(url || '').trim();
  if (!/^https:\/\//.test(u)) throw err('Could not read a location from that link.');
  const pats = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/];
  for (const re of pats) { const m = u.match(re); if (m) return { lat: +m[1], lng: +m[2] }; }
  if (/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(u)) return { lat: 6.4474, lng: 3.4701 };
  throw err('Could not read a location from that link.');
}

/* ---------- actions ---------- */
const withDates = (list0, p) => {
  if (!!p.check_in !== !!p.check_out) throw err('Pick your check-in and check-out dates.');
  return list0;
};

const ACTIONS = {
  /* public */
  site() {
    const shortlets = live().filter(p => p.kind === 'shortlet').sort(byRank);
    const sale = live().filter(p => SALE_KINDS.includes(p.kind)).sort(byRank);
    const counts = { shortlet: 0, land: 0, residential: 0, commercial: 0 };
    for (const p of live()) counts[p.kind]++;
    return { settings: settingsPublic(), featured: shortlets.filter(p => p.featured).slice(0, 4).map(card), listings: sale.slice(0, 3).map(card), counts };
  },
  properties(p) {
    withDates(null, p);
    let rows = live();
    if (p.kind) rows = rows.filter(x => p.kind === 'sale' ? SALE_KINDS.includes(x.kind) : x.kind === p.kind);
    if (p.area) rows = rows.filter(x => x.area === p.area);
    if (p.guests) rows = rows.filter(x => x.max_guests != null && x.max_guests >= Number(p.guests));
    if (p.max_price) rows = rows.filter(x => x.price_ngn == null || x.price_ngn <= Number(p.max_price));
    if (Array.isArray(p.ids)) rows = rows.filter(x => p.ids.includes(x.id));
    rows = rows.sort(byRank).map(x => {
      const c = card(x);
      if (p.check_in && p.check_out) c.available = x.kind === 'shortlet' ? isFree(x.id, p.check_in, p.check_out) : true;
      return c;
    });
    return { properties: rows, settings: settingsPublic() };
  },
  property(p) {
    const row = db.properties.find(x => (p.id && x.id === p.id) || (p.slug && x.slug === p.slug) || (p.id && x.slug === p.id));
    if (!row || row.status !== 'live') throw err('That property is not available.');
    return { property: full(row), settings: settingsPublic() };
  },
  availability(p) {
    const row = livePropOrThrow(p.property_id);
    if (!isDateStr(p.from) || !isDateStr(p.to)) throw err('Pick your check-in and check-out dates.');
    return { unavailable: unavailable(row.id, p.from, p.to) };
  },
  quote(p) {
    const row = livePropOrThrow(p.property_id);
    if (!isDateStr(p.check_in) || !isDateStr(p.check_out)) throw err('Pick your check-in and check-out dates.');
    if (p.check_out <= p.check_in) throw err('Pick a check-out date after the check-in date.');
    const nights = daysBetween(p.check_in, p.check_out);
    return { nights, quote_ngn: quoteFor(row, nights), price_ngn: row.price_ngn ?? null, min_nights: minNightsOf(row), available: isFree(row.id, p.check_in, p.check_out) };
  },
  create_booking(p) {
    const b = makeBooking(p);
    return { booking: bookingPublic(b), whatsapp_url: waBase(), whatsapp_text: waText(b) };
  },
  booking(p) {
    const ref = String(p.ref || '').trim().toUpperCase(), phone = normPhone(p.phone);
    const b = db.bookings.find(x => x.ref === ref);
    if (!b || !phone || !b.phone || normPhone(b.phone) !== phone) throw err('No booking found with that reference and phone number.');
    return { booking: bookingPublic(b), whatsapp_url: waBase() };
  },
  share(p) {
    const sh = db.shares.find(s => s.code === String(p.code || '').trim().toUpperCase());
    const gone = !sh || sh.status !== 'active' || (sh.expires && sh.expires < today());
    if (gone) throw err('This link has expired. Message Mo for a fresh one.');
    const feat = findProp(sh.featured_id);
    if (!feat || feat.status !== 'live') throw err('This link has expired. Message Mo for a fresh one.');
    sh.views = (sh.views || 0) + 1; sh.last_viewed = nowStamp(); persist();
    const dated = sh.check_in && sh.check_out;
    const f = full(feat);
    const picks = sh.pick_ids.map(findProp).filter(x => x && x.status === 'live').map(x => {
      const c = card(x); if (dated) c.available = x.kind === 'shortlet' ? isFree(x.id, sh.check_in, sh.check_out) : true; return c;
    });
    if (dated) f.available = feat.kind === 'shortlet' ? isFree(feat.id, sh.check_in, sh.check_out) : true;
    return { share: { code: sh.code, note: sh.note, client_name: sh.client_name, check_in: sh.check_in, check_out: sh.check_out, expires: sh.expires }, featured: f, picks, settings: settingsPublic() };
  },

  /* admin */
  login(p) {
    checkPin(p);
    return { settings: settingsAdmin(), counts: { pending: db.bookings.filter(b => b.status === 'pending').length } };
  },
  bookings(p) {
    checkPin(p);
    const status = p.status || 'pending';
    let rows = db.bookings.filter(b => {
      if (status === 'all') return true;
      if (status === 'past') return ['done', 'declined', 'cancelled', 'expired'].includes(b.status);
      return b.status === status;
    });
    if (p.property_id) rows = rows.filter(b => b.property_id === p.property_id);
    const dateOf = b => b.check_in || b.slot_date;
    if (p.from) rows = rows.filter(b => (b.check_out || b.slot_date || '9999') >= p.from);
    if (p.to) rows = rows.filter(b => dateOf(b) <= p.to);
    rows = rows.sort(status === 'confirmed' ? (a, b) => dateOf(a).localeCompare(dateOf(b)) : (a, b) => b.created_at.localeCompare(a.created_at) || b.ref.localeCompare(a.ref));
    return { bookings: rows.map(adminBooking) };
  },
  update_booking(p) {
    checkPin(p);
    const b = db.bookings.find(x => x.ref === p.ref);
    if (!b) throw err('No booking found with that reference.');
    if (p.status) {
      if (!['confirmed', 'declined', 'cancelled', 'done'].includes(p.status)) throw err('Something went wrong. Please try again.');
      const ok = (b.status === 'pending' && ['confirmed', 'declined'].includes(p.status)) || (b.status === 'confirmed' && ['cancelled', 'done'].includes(p.status));
      if (!ok) throw err(`That booking is already ${b.status}.`);
    }
    const nb = { ...b };
    for (const k of ['check_in', 'check_out', 'slot_date', 'slot_time']) if (p[k] != null) nb[k] = p[k];
    if (p.guests != null) nb.guests = parseInt(p.guests, 10) || nb.guests;
    const movedDates = nb.check_in !== b.check_in || nb.check_out !== b.check_out;
    if (b.kind === 'stay' && movedDates) {
      const prop = findProp(b.property_id);
      if (!isDateStr(nb.check_in) || !isDateStr(nb.check_out)) throw err('Pick your check-in and check-out dates.');
      if (nb.check_out <= nb.check_in) throw err('Pick a check-out date after the check-in date.');
      nb.nights = daysBetween(nb.check_in, nb.check_out);
      if (!isFree(b.property_id, nb.check_in, nb.check_out, { ignoreRef: b.ref })) throw err('Those dates clash with another booking now.');
      if (p.quote_ngn == null && prop) nb.quote_ngn = quoteFor(prop, nb.nights);
    }
    if (p.status === 'confirmed' && b.kind === 'stay' && !isFree(b.property_id, nb.check_in, nb.check_out, { ignoreRef: b.ref })) throw err('Those dates clash with another booking now.');
    if (p.status === 'confirmed' && b.kind !== 'stay') {
      const taken = db.bookings.some(x => x.ref !== b.ref && x.kind === b.kind && x.status === 'confirmed' && x.slot_date === nb.slot_date && x.slot_time === nb.slot_time && (b.kind === 'consultation' || x.property_id === b.property_id));
      if (taken) throw err('That slot is taken. Pick another.');
    }
    if (p.quote_ngn !== undefined) { const q = intOrNull(p.quote_ngn); if (Number.isNaN(q)) throw err('The quote must be a whole number of naira.'); nb.quote_ngn = q; }
    if (p.admin_note != null) nb.admin_note = clip(p.admin_note, 600);
    if (p.status) { nb.status = p.status; nb.hold_until = p.status === 'pending' ? nb.hold_until : (nb.kind === 'stay' ? '' : nb.hold_until); }
    nb.updated_at = nowStamp();
    Object.assign(b, nb); persist();
    return { booking: adminBooking(b), whatsapp_client_url: b.phone ? 'https://wa.me/' + b.phone.replace(/\D/g, '') : '' };
  },
  admin_booking(p) {
    checkPin(p);
    const b = makeBooking(p, { admin: true });
    return { booking: adminBooking(b) };
  },
  properties_admin(p) {
    checkPin(p);
    const rows = db.properties.filter(x => p.include_archived || x.status !== 'archived').sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.title.localeCompare(b.title));
    return { properties: rows.map(adminShape) };
  },
  save_property(p) {
    checkPin(p);
    const src = p.property || {};
    const existing = src.id ? findProp(src.id) : null;
    if (src.id && !existing) throw err('That property is not available.');
    const v = validateProperty(src, existing);
    const now = nowStamp();
    if (existing) {
      const titleChanged = v.title !== existing.title || v.area !== existing.area;
      Object.assign(existing, v, { updated_at: now });
      if (titleChanged) existing.slug = uniqueSlug(v.title, v.area, existing.id);
      persist();
      return { property: adminShape(existing) };
    }
    const row = { id: idLike('p_'), slug: uniqueSlug(v.title, v.area, ''), status: 'live', ...v, sort: Math.max(0, ...db.properties.map(x => x.sort ?? 0)) + 1, demo: false, ical_token: rndStr(16, '0123456789abcdef'), ical_import_url: '', created_at: now, updated_at: now };
    db.properties.push(row); persist();
    return { property: adminShape(row) };
  },
  set_property_status(p) {
    checkPin(p);
    const row = findProp(p.id);
    if (!row) throw err('That property is not available.');
    if (!['live', 'hidden', 'archived'].includes(p.status)) throw err('Something went wrong. Please try again.');
    if (p.status === 'archived' && db.bookings.some(b => b.property_id === row.id && b.kind === 'stay' && b.status === 'confirmed' && b.check_out > today())) throw err('Cancel or finish its bookings first.');
    row.status = p.status; row.updated_at = nowStamp(); persist();
    return { property: adminShape(row) };
  },
  reorder_properties(p) {
    checkPin(p);
    (p.ids || []).forEach((id, i) => { const row = findProp(id); if (row) row.sort = i + 1; });
    persist();
    return {};
  },
  upload_photo(p) {
    checkPin(p);
    const row = findProp(p.property_id);
    if (!row) throw err('That property is not available.');
    if (!p.data || typeof p.data !== 'string') throw err('Choose a photo to upload.');
    if (p.data.length > 3000000) throw err('That photo is too large. Try a smaller one.');
    if (row.photos.length >= 20) throw err('Add up to 20 photos.');
    const photo = { url: 'data:image/jpeg;base64,' + p.data.replace(/^data:[^,]*,/, '') };
    row.photos.push(photo); row.updated_at = nowStamp(); persist();
    return { photo: clone(photo), photos: clone(row.photos) };
  },
  delete_photo(p) {
    checkPin(p);
    const row = findProp(p.property_id);
    if (!row) throw err('That property is not available.');
    const i = photoIdx(row, p.id);
    if (i < 0) throw err('That photo was not found.');
    row.photos.splice(i, 1); persist();
    return { photos: clone(row.photos) };
  },
  set_cover(p) {
    checkPin(p);
    const row = findProp(p.property_id);
    if (!row) throw err('That property is not available.');
    const i = photoIdx(row, p.id);
    if (i < 0) throw err('That photo was not found.');
    row.photos.unshift(row.photos.splice(i, 1)[0]); persist();
    return { photos: clone(row.photos) };
  },
  reorder_photos(p) {
    checkPin(p);
    const row = findProp(p.property_id);
    if (!row) throw err('That property is not available.');
    const ordered = (p.ids || []).map(id => row.photos.find(ph => photoKey(ph) === id)).filter(Boolean);
    const rest = row.photos.filter(ph => !ordered.includes(ph));
    row.photos = [...ordered, ...rest]; persist();
    return { photos: clone(row.photos) };
  },
  calendar(p) {
    checkPin(p);
    const row = findProp(p.property_id);
    if (!row) throw err('That property is not available.');
    let from = p.from, to = p.to;
    if (p.month) {
      if (!/^\d{4}-\d{2}$/.test(p.month)) throw err('Something went wrong. Please try again.');
      from = p.month + '-01';
      const d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); to = d.toISOString().slice(0, 10);
    }
    if (!isDateStr(from) || !isDateStr(to)) throw err('Something went wrong. Please try again.');
    const now = nowStamp();
    const bookings = db.bookings.filter(b => b.property_id === row.id && b.kind === 'stay' && (b.status === 'confirmed' || (b.status === 'pending' && b.hold_until > now)) && clash({ from, to }, { from: b.check_in, to: b.check_out }));
    const blocks = db.blocks.filter(k => k.property_id === row.id && clash({ from, to }, k));
    const ranges = [
      ...bookings.map(b => ({ from: b.check_in, to: b.check_out, kind: b.status === 'confirmed' ? 'booked' : 'pending', ref: b.ref, label: (b.status === 'confirmed' ? '' : 'Pending: ') + (b.name || b.ref) })),
      ...blocks.map(k => ({ from: k.from, to: k.to, kind: k.source === 'ical' ? 'imported' : 'blocked', block_id: k.id, label: k.reason || (k.source === 'ical' ? 'Imported' : 'Blocked') }))
    ].sort((a, b) => a.from.localeCompare(b.from));
    return { ranges, bookings: bookings.map(adminBooking), blocks: clone(blocks) };
  },
  add_block(p) {
    checkPin(p);
    const row = findProp(p.property_id);
    if (!row) throw err('That property is not available.');
    if (!isDateStr(p.from) || !isDateStr(p.to)) throw err('Pick your check-in and check-out dates.');
    if (p.to <= p.from) throw err('Pick a check-out date after the check-in date.');
    const mine = db.bookings.filter(b => b.property_id === row.id && b.kind === 'stay' && clash({ from: p.from, to: p.to }, { from: b.check_in, to: b.check_out }));
    if (mine.some(b => b.status === 'confirmed')) throw err('Those dates have a confirmed booking.');
    const now = nowStamp();
    for (const b of mine) if (b.status === 'pending' && b.hold_until > now) { b.status = 'expired'; b.updated_at = now; }
    const block = { id: idLike('b_'), property_id: row.id, from: p.from, to: p.to, reason: clip(p.reason, 120), source: 'admin', created_at: now };
    db.blocks.push(block); persist();
    return { block: clone(block) };
  },
  delete_block(p) {
    checkPin(p);
    const i = db.blocks.findIndex(k => k.id === p.id);
    if (i < 0) throw err('That block was not found.');
    if (db.blocks[i].source === 'ical') throw err('That one comes from the imported calendar. Remove it there.');
    db.blocks.splice(i, 1); persist();
    return {};
  },
  shares(p) {
    checkPin(p);
    return { shares: db.shares.filter(s => s.status !== 'deleted').sort((a, b) => b.created_at.localeCompare(a.created_at) || b.code.localeCompare(a.code)).map(shareShape) };
  },
  create_share(p) {
    checkPin(p);
    const feat = findProp(p.featured_id);
    if (!feat) throw err('That property is not available.');
    const picks = Array.isArray(p.pick_ids) ? p.pick_ids.filter(id => id !== feat.id && findProp(id)) : [];
    if (picks.length > 6) throw err('Pick up to 6 other properties.');
    const note = String(p.note || '').trim(), client = String(p.client_name || '').trim();
    if (note.length > 300) throw err('The note is too long (300 characters at most).');
    if (client.length > 60) throw err('The client name is too long (60 characters at most).');
    if (!!p.check_in !== !!p.check_out) throw err('Pick your check-in and check-out dates.');
    if (p.check_in && (!isDateStr(p.check_in) || !isDateStr(p.check_out))) throw err('Pick your check-in and check-out dates.');
    if (p.check_in && p.check_out <= p.check_in) throw err('Pick a check-out date after the check-in date.');
    let days = SN('SHARE_EXPIRY_DAYS', 14);
    if (p.expiry_days != null && p.expiry_days !== '') { days = parseInt(p.expiry_days, 10); if (!(days >= 1 && days <= 90)) throw err('Expiry must be 1 to 90 days.'); }
    let c; do { c = code(6); } while (db.shares.some(s => s.code === c));
    const now = nowStamp();
    const sh = { code: c, status: 'active', featured_id: feat.id, pick_ids: picks, note, client_name: client, check_in: p.check_in || '', check_out: p.check_out || '', expires: addDays(today(), days), views: 0, last_viewed: '', created_at: now };
    db.shares.push(sh); persist();
    const url = shareUrl(sh);
    return { share: shareShape(sh), whatsapp_text: `Hi${client ? ' ' + client.split(' ')[0] : ''}, I have picked ${shortTitle(feat.title)} for you${picks.length ? ', plus a few more to compare' : ''}: ${url}` };
  },
  update_share(p) {
    checkPin(p);
    const sh = db.shares.find(s => s.code === String(p.code || '').toUpperCase());
    if (!sh) throw err('That link was not found.');
    if (p.status != null) { if (!['expired', 'deleted'].includes(p.status)) throw err('Something went wrong. Please try again.'); sh.status = p.status; }
    if (p.note != null) { if (String(p.note).length > 300) throw err('The note is too long (300 characters at most).'); sh.note = String(p.note).trim(); }
    if (p.expires != null) { if (p.expires !== '' && !isDateStr(p.expires)) throw err('Something went wrong. Please try again.'); sh.expires = p.expires; }
    persist();
    return { share: shareShape(sh) };
  },
  settings_get(p) { checkPin(p); return { settings: settingsAdmin() }; },
  settings_set(p) {
    checkPin(p);
    Object.assign(db.settings, validateSettings(p.settings)); persist();
    return { settings: settingsAdmin() };
  },
  set_pin(p) {
    checkPin(p);
    if (!/^\d{6,12}$/.test(String(p.new_pin || ''))) throw err('The new PIN must be 6 to 12 digits.');
    return {};
  },
  import_properties(p) {
    checkPin(p);
    let added = 0, updated = 0, skipped = 0;
    for (const src of (Array.isArray(p.properties) ? p.properties : [])) {
      let v;
      try { v = validateProperty(src, null); } catch (e) { skipped++; continue; }
      const slug = slugify(src.slug || '') || uniqueSlug(v.title, v.area, '');
      const old = db.properties.find(x => x.slug === slug);
      const now = nowStamp();
      if (old) { if (!old.demo) { skipped++; continue; } Object.assign(old, v, { status: src.status || old.status, updated_at: now }); updated++; continue; }
      const id = src.id && !findProp(src.id) ? String(src.id) : idLike('p_');
      db.properties.push({ id, slug, status: 'live', ...v, sort: src.sort ?? db.properties.length + 1, demo: true, ical_token: rndStr(16, '0123456789abcdef'), ical_import_url: '', created_at: now, updated_at: now });
      added++;
    }
    persist();
    return { added, updated, skipped };
  },
  purge_demo(p) {
    checkPin(p);
    const ids = new Set(db.properties.filter(x => x.demo).map(x => x.id));
    const n = { properties: ids.size, bookings: 0, blocks: 0, shares: 0 };
    const keep = (arr, test, key) => { const before = arr.length; const out = arr.filter(test); n[key] = before - out.length; return out; };
    db.bookings = keep(db.bookings, b => !ids.has(b.property_id), 'bookings');
    db.blocks = keep(db.blocks, k => !ids.has(k.property_id), 'blocks');
    db.shares = keep(db.shares, s => !ids.has(s.featured_id), 'shares');
    db.properties = db.properties.filter(x => !ids.has(x.id));
    persist();
    return { removed: n };
  },
  ical_sync_now(p) {
    checkPin(p);
    db.settings.LAST_ICAL_SYNC = nowStamp(); persist();
    return { added: 0, removed: 0, last_sync: db.settings.LAST_ICAL_SYNC };
  },
  resolve_map_link(p) { checkPin(p); return parseMapUrl(p.url); }
};

const shareUrl = s => (S('SITE_URL') || SITE_URL) + 'share.html?s=' + s.code;
const shareShape = s => ({ ...clone(s), url: shareUrl(s) });

/* ---------- entry point ---------- */
export async function handle(action, params = {}) {
  init();
  await sleep(LATENCY);
  expireHolds();
  const fn = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!fn) throw new ApiError('Unknown action.');
  return clone({ ok: true, ...fn(params) });
}
