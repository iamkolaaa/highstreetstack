/* Demo data for ?mock. Same replies as the real backend (see docs/API.md), kept in memory.
   Client link key: demo. Admin passphrase: demo-pass. */
import { ApiError } from './api.js?v=202611061853';
import { todayLondon, addDays, weekday, pad, fmtDay } from './util.js?v=202611061853';

const HOLD = Math.min(120, Math.max(3, +new URLSearchParams(location.search).get('hold') || 120));   // ?hold=5 shortens the demo clock
const BAD_LINK = "This booking link isn't valid. Ask Chadrack for a new one.";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { throw new ApiError(m); };
const today = todayLondon();
const mins = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const uid = p => p + Math.random().toString(36).slice(2, 9);
const nowStamp = () => { const d = new Date(); return `${todayLondon()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const monthOf = d => d.slice(0, 7);
const addMonths = (ym, n) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return `${y}-${pad(m + 1)}`; };

const S = {
  pass: 'demo-pass', link: 'demo', feedKey: 'demofeedkey',
  settings: { slot_minutes: 60, min_notice_hours: 12, horizon_weeks: 8, default_price_pence: 3500, currency: 'gbp', block_nlb: 'yes', alert_email: 'chadrack@example.com', share_email: '', business_name: 'Chadrack PT' },
  stripe: { connected: true, mode: 'test', last4: '4242' },
  avail: [[1, '07:00', '10:00'], [1, '17:00', '20:00'], [2, '07:00', '10:00'], [2, '17:00', '20:00'], [3, '07:00', '10:00'], [3, '17:00', '20:00'],
    [4, '07:00', '10:00'], [4, '17:00', '20:00'], [5, '07:00', '10:00'], [5, '17:00', '20:00'], [6, '10:00', '14:00']].map(([weekday, start, end]) => ({ weekday, start, end, active: true })),
  blackouts: [{ id: 'nlb1', date: addDays(today, 2), start: '18:30', end: '19:30', reason: 'Monday Run Club', source: 'nlb' }, { id: 'x1', date: addDays(today, 9), start: '', end: '', reason: 'Away', source: 'manual' }],
  prices: [{ id: 'pr1', label: 'Weekday evenings', weekdays: '1,2,3,4,5', start: '17:00', end: '20:00', price_pence: 4500, priority: 2 }],
  bookings: [], clients: [], payments: [], charges: [], paid: {}, cacheAt: ''
};

function seed() {
  const mk = (o) => ({ id: uid('b_'), status: 'paid', pay_method: 'card', end: hhmm(mins(o.start) + 60), price_pence: 3500, phone: '', note: '', email: '', cash_received_at: '', card: true, created_at: nowStamp(), ...o });
  const names = ['Amara Obi', 'Dan Whitfield', 'Priya Shah', 'Tom Hardy', 'Lola Bright', 'Sam Okafor'];
  names.forEach((n, i) => S.clients.push({ id: 'c' + i, name: n, email: n.toLowerCase().replace(/ /g, '.') + '@example.com', phone: '07700 90' + (1000 + i), first_seen: addMonths(monthOf(today), -(i % 5)) + '-05', source: i === 5 ? 'manual' : 'pt-link', bookings: 2 + i, paid_pence: 7000 + i * 3500 }));
  const tomorrow = addDays(today, 1);
  S.bookings.push(mk({ name: names[0], email: 'amara.obi@example.com', phone: '07700 901000', date: tomorrow, start: '07:00', client_id: 'c0' }));
  S.bookings.push(mk({ name: names[1], email: 'dan.whitfield@example.com', date: addDays(today, 3), start: '17:00', price_pence: 4500, status: 'confirmed', pay_method: 'cash', card: false, approved_at: nowStamp(), client_id: 'c1' }));
  S.bookings.push(mk({ name: names[2], email: 'priya.shah@example.com', phone: '07700 901002', note: 'Wants to work on core strength', date: addDays(today, 4), start: '08:00', status: 'cash_pending', pay_method: 'cash', card: false, client_id: 'c2' }));
  S.bookings.push(mk({ name: names[3], email: 'tom.hardy@example.com', date: addDays(today, 5), start: '18:00', price_pence: 4500, status: 'cash_pending', pay_method: 'cash', card: false, client_id: 'c3' }));
  S.bookings.push(mk({ name: names[4], email: 'lola.bright@example.com', date: addDays(today, -3), start: '07:00', client_id: 'c4' }));
  S.bookings.push(mk({ name: names[0], email: 'amara.obi@example.com', date: addDays(today, -9), start: '17:00', price_pence: 4500, client_id: 'c0' }));
  S.bookings.push(mk({ name: names[1], email: 'dan.whitfield@example.com', date: addDays(today, -6), start: '08:00', status: 'confirmed', pay_method: 'cash', card: false, cash_received_at: nowStamp(), client_id: 'c1' }));
  S.payments.push({ kind: 'cash', amount_pence: 3500, at: addDays(today, -6) + ' 08:10:00' });
  // a year of Stripe charges: ours (source pt-diary) and other income
  for (let i = 11; i >= 0; i--) {
    const ym = addMonths(monthOf(today), -i), n = 6 + ((i * 5) % 7), others = 2 + (i % 4);
    for (let k = 0; k < n; k++) S.charges.push({ created: Date.parse(ym + '-' + pad(2 + k * 2 % 26) + 'T10:00:00Z') / 1000, amount: k % 3 ? 3500 : 4500, refunded: k === 4 ? 3500 : 0, status: 'succeeded', source: 'pt-diary' });
    for (let k = 0; k < others; k++) S.charges.push({ created: Date.parse(ym + '-' + pad(3 + k * 5) + 'T12:00:00Z') / 1000, amount: 1500 + ((i + k) * 900) % 4200, refunded: 0, status: 'succeeded', source: '' });
    if (i > 0) S.payments.push({ kind: 'cash', amount_pence: 3500 * (1 + (i % 3)), at: ym + '-12 09:00:00' });
  }
  S.cacheAt = nowStamp();
}
seed();

/* ---- slots ---- */
const isOn = a => a.active !== false && a.active !== 'no';
const takes = (b, now) => ['paid', 'cash_pending', 'confirmed'].includes(b.status) || (['held', 'pending_payment'].includes(b.status) && b.hold_until > now);
function priceFor(date, start) {
  let best = null; const wd = weekday(date), t = mins(start);
  S.prices.forEach(b => {
    const days = String(b.weekdays || '').split(',').filter(Boolean).map(Number);
    if (days.length && !days.includes(wd)) return;
    if (t < mins(b.start) || t >= mins(b.end)) return;
    if (!best || b.priority > best.priority) best = b;
  });
  return best ? best.price_pence : +S.settings.default_price_pence;
}
function slots(from, to) {
  const now = Date.now(), st = S.settings, len = +st.slot_minutes, last = addDays(today, st.horizon_weeks * 7 - 1), out = [];
  const lo = from > today ? from : today, hi = to < last ? to : last;
  for (let d = lo; d <= hi; d = addDays(d, 1)) {
    const made = [];
    S.avail.filter(a => isOn(a) && +a.weekday === weekday(d)).sort((a, b) => (a.start < b.start ? -1 : 1)).forEach(w => {
      for (let m = mins(w.start); m + len <= mins(w.end); m += len) {
        if (made.some(x => m < x[1] && x[0] < m + len)) continue;
        made.push([m, m + len]);
        const start = hhmm(m);
        if (new Date(d + 'T' + start + ':00').getTime() < now + st.min_notice_hours * 3600000) continue;
        const blocked = S.blackouts.some(b => b.date === d && (!b.start || (m < mins(b.end) && mins(b.start) < m + len)));
        const held = S.bookings.some(b => b.date === d && takes(b, now) && m < mins(b.end) && mins(b.start) < m + len);
        out.push({ date: d, start, end: hhmm(m + len), price_pence: priceFor(d, start), status: blocked || held ? 'taken' : 'free' });
      }
    });
  }
  return out;
}
const secLeft = b => Math.max(0, Math.ceil(((b.hold_until || 0) - Date.now()) / 1000));
const pubB = b => ({ id: b.id, status: b.status, date: b.date, start: b.start, end: b.end, price_pence: b.price_pence, pay_method: b.pay_method, name: b.name, email: b.email, seconds_left: secLeft(b), label: `${fmtDay(b.date)} ${b.start}` });
const own = p => { const b = S.bookings.find(x => x.id === p.booking_id && x.client_token === p.client_token); if (!b) fail('That booking was not found. Pick a time again.'); return b; };
const live = b => ['held', 'pending_payment'].includes(b.status) && secLeft(b) > 0;
function sweep() {
  S.bookings.forEach(b => {
    if (['held', 'pending_payment'].includes(b.status) && secLeft(b) === 0) { if (S.paid[b.id] && b.status === 'pending_payment') return; b.status = 'expired'; }
  });
}
function details(b, p) {
  const name = String(p.name || '').trim().slice(0, 60), email = String(p.email || '').trim().toLowerCase();
  if (!name) fail('Add your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail('Enter a valid email address.');
  if (!/^[0-9+()\s-]*$/.test(p.phone || '')) fail('Check the phone number.');
  Object.assign(b, { name, email, phone: String(p.phone || '').trim(), note: String(p.note || '').trim().slice(0, 300) });
}
function toClient(b) {
  let c = S.clients.find(x => x.email === b.email);
  if (!c) { c = { id: uid('c'), name: b.name, email: b.email, phone: b.phone, first_seen: today, source: 'pt-link', bookings: 0, paid_pence: 0 }; S.clients.push(c); }
  b.client_id = c.id; return c;
}
function recount() {
  S.clients.forEach(c => {
    const mine = S.bookings.filter(b => b.client_id === c.id);
    if (!mine.length) return;
    c.bookings = mine.filter(b => ['paid', 'cash_pending', 'confirmed'].includes(b.status)).length;
    c.paid_pence = mine.filter(b => b.status === 'paid' || (b.status === 'confirmed' && b.cash_received_at)).reduce((a, b) => a + b.price_pence, 0);
  });
}

/* ---- the fake checkout: the page calls these from its "Pay (test)" button ---- */
export function mockPay(bookingId) {
  const b = S.bookings.find(x => x.id === bookingId);
  if (!b) return;
  S.paid[bookingId] = true;
  S.charges.push({ created: Date.now() / 1000, amount: b.price_pence, refunded: 0, status: 'succeeded', source: 'pt-diary' });
}

const PUBLIC = {
  config: () => ({ business_name: S.settings.business_name, slot_minutes: +S.settings.slot_minutes, currency: 'gbp', stripe_publishable_key: 'pk_test_demo', stripe_mode: 'test', card_enabled: true,
    min_notice_hours: +S.settings.min_notice_hours, horizon_weeks: +S.settings.horizon_weeks, hold_seconds: HOLD, server_time: new Date().toISOString() }),
  slots: p => { sweep(); const from = /^\d{4}-\d{2}-\d{2}$/.test(p.from || '') ? p.from : today; const to = /^\d{4}-\d{2}-\d{2}$/.test(p.to || '') && p.to >= from ? p.to : addDays(from, 6); return { slots: slots(from, to), server_time: new Date().toISOString() }; },
  hold: p => {
    sweep();
    const token = String(p.client_token || ''); if (token.length < 16) fail('Refresh the page and try again.');
    const mine = S.bookings.find(b => b.client_token === token && live(b));
    if (mine && mine.date === p.date && mine.start === p.start && mine.status === 'held') return { booking: pubB(mine) };
    if (mine) mine.status = 'expired';
    const s = slots(p.date, p.date).find(x => x.start === p.start);
    if (!s || s.status !== 'free') fail('Sorry, that time has just gone. Pick another.');
    const b = { id: uid('b_'), status: 'held', date: s.date, start: s.start, end: s.end, price_pence: s.price_pence, pay_method: '', client_token: token, hold_until: Date.now() + HOLD * 1000, name: '', email: '', phone: '', note: '', created_at: nowStamp() };
    S.bookings.push(b); return { booking: pubB(b) };
  },
  release: p => { const b = own(p); if (['held', 'pending_payment'].includes(b.status)) b.status = 'expired'; return { booking: pubB(b) }; },
  create_checkout: p => {
    sweep(); const b = own(p);
    if (!live(b)) fail('Time ran out and the slot is free again. Pick a time again.');
    details(b, p); b.status = 'pending_payment'; b.pay_method = 'card';
    return { client_secret: 'mock_secret_' + b.id, publishable_key: 'pk_test_demo', booking: pubB(b) };
  },
  confirm: p => {
    const b = own(p);
    if (S.paid[b.id] && ['held', 'pending_payment', 'expired'].includes(b.status)) {
      b.status = 'paid'; b.card = true; toClient(b); recount();
    } else sweep();
    return { status: b.status, booking: pubB(b) };
  },
  request_cash: p => {
    sweep(); const b = own(p);
    if (!live(b)) fail('Time ran out and the slot is free again. Pick a time again.');
    details(b, p); b.status = 'cash_pending'; b.pay_method = 'cash'; b.card = false; b.hold_until = 0; toClient(b); recount();
    return { status: b.status, booking: pubB(b) };
  },
  booking: p => ({ booking: pubB(own(p)) })
};

const adminB = b => ({ id: b.id, status: b.status, date: b.date, start: b.start, end: b.end, price_pence: b.price_pence, pay_method: b.pay_method, name: b.name, email: b.email, phone: b.phone || '', note: b.note || '',
  paid_at: '', cash_received_at: b.cash_received_at || '', approved_at: b.approved_at || '', decline_reason: b.decline_reason || '', created_at: b.created_at, card: !!b.card });
const target = p => { const b = S.bookings.find(x => x.id === p.id); if (!b) fail('That booking was not found.'); return b; };
const schedule = () => ({ availability: S.avail.map(a => ({ ...a, active: isOn(a) })), blackouts: S.blackouts.filter(b => b.date >= today).sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1)),
  prices: S.prices.map(x => ({ ...x })), default_price_pence: +S.settings.default_price_pence, slot_minutes: +S.settings.slot_minutes });
const settingsOut = () => ({ settings: { ...S.settings, slot_minutes: String(S.settings.slot_minutes), min_notice_hours: String(S.settings.min_notice_hours), horizon_weeks: String(S.settings.horizon_weeks), default_price_pence: String(S.settings.default_price_pence) },
  link_key: S.link, booking_link: location.origin + location.pathname + '?mock&c=' + S.link, stripe: { ...S.stripe },
  feed_url: 'https://script.google.com/macros/s/DEMO/exec?feed=ics&key=' + S.feedKey, last_sync: nowStamp().slice(0, 16), last_sync_error: '' });

function dashboard(p) {
  const month = /^\d{4}-\d{2}$/.test(p.month || '') ? p.month : monthOf(today);
  const months = []; for (let i = 11; i >= 0; i--) months.push(addMonths(month, -i));
  const by = {}; months.forEach(m => { by[m] = { month: m, pt_card: 0, pt_cash: 0, other: 0 }; });
  S.charges.forEach(c => { const m = monthOf(new Date(c.created * 1000).toISOString().slice(0, 10)); if (by[m] && c.status === 'succeeded') by[m][c.source === 'pt-diary' ? 'pt_card' : 'other'] += Math.max(0, c.amount - c.refunded); });
  S.payments.forEach(x => { if (x.kind === 'cash' && by[monthOf(x.at)]) by[monthOf(x.at)].pt_cash += x.amount_pence; });
  const cur = by[month];
  const expected = S.bookings.filter(b => b.pay_method === 'cash' && ['cash_pending', 'confirmed'].includes(b.status) && !b.cash_received_at && monthOf(b.date) === month).reduce((a, b) => a + b.price_pence, 0);
  const cl = S.clients, fresh = cl.filter(c => monthOf(c.first_seen) === month).length;
  const booked = new Set(S.bookings.filter(b => monthOf(b.date) === month && ['paid', 'cash_pending', 'confirmed'].includes(b.status)).map(b => b.client_id));
  return { month, cards: { pt_card: cur.pt_card, pt_cash: cur.pt_cash, pt_cash_expected: expected, other: cur.other, total: cur.pt_card + cur.pt_cash + cur.other }, months: months.map(m => by[m]),
    clients: { total: cl.length, by_source: { 'pt-link': cl.filter(c => c.source !== 'manual').length, manual: cl.filter(c => c.source === 'manual').length }, new_this_month: fresh,
      returning_this_month: cl.filter(c => booked.has(c.id) && monthOf(c.first_seen) < month).length,
      top: cl.filter(c => c.paid_pence > 0).sort((a, b) => b.paid_pence - a.paid_pence).slice(0, 5).map(c => ({ name: c.name, paid_pence: c.paid_pence, bookings: c.bookings })) },
    cache_at: S.cacheAt, stripe_connected: S.stripe.connected };
}

const ADMIN = {
  login: () => ({}),
  bookings: p => {
    const f = p.filter || 'upcoming', shown = ['paid', 'cash_pending', 'confirmed', 'declined', 'cancelled', 'refunded'];
    const list = S.bookings.filter(b => shown.includes(b.status) && (f === 'pending' ? b.status === 'cash_pending' : f === 'past' ? b.date < today : f === 'all' ? true : b.date >= today && ['paid', 'cash_pending', 'confirmed'].includes(b.status)))
      .sort((a, b) => ((a.date + a.start < b.date + b.start) === (f !== 'past') ? -1 : 1));
    return { bookings: list.map(adminB), pending: S.bookings.filter(b => b.status === 'cash_pending').length };
  },
  approve: p => { const b = target(p); if (b.status !== 'cash_pending') fail('This request is ' + b.status.replace('_', ' ') + ', so it can no longer be approved.'); b.status = 'confirmed'; b.approved_at = nowStamp(); return { booking: adminB(b) }; },
  decline: p => { const b = target(p); if (b.status !== 'cash_pending') fail('This request is ' + b.status.replace('_', ' ') + ', so it can no longer be declined.'); b.status = 'declined'; b.decline_reason = p.reason || 'Declined'; return { booking: adminB(b) }; },
  cash_received: p => {
    const b = target(p); if (b.pay_method !== 'cash' || b.status !== 'confirmed') fail('Only a confirmed pay-on-the-day booking can be marked as received.');
    if (b.cash_received_at) fail('That cash is already marked as received.');
    b.cash_received_at = nowStamp(); S.payments.push({ kind: 'cash', amount_pence: b.price_pence, at: nowStamp() }); recount(); return { booking: adminB(b) };
  },
  refund: p => {
    const b = target(p); if (b.status !== 'paid') fail('Only a booking paid by card can be refunded.');
    b.status = 'refunded'; const c = S.charges.slice().reverse().find(x => x.source === 'pt-diary' && !x.refunded && x.amount === b.price_pence); if (c) c.refunded = c.amount; recount(); return { booking: adminB(b) };
  },
  cancel: p => {
    const b = target(p); if (b.status === 'paid') fail('Refund a card payment instead. That also cancels the session.');
    if (!['cash_pending', 'confirmed'].includes(b.status)) fail('That booking cannot be cancelled.'); b.status = 'cancelled'; recount(); return { booking: adminB(b) };
  },
  schedule,
  availability_save: p => {
    for (const r of p.rows || []) { if (!(r.start && r.end) || r.end <= r.start) fail('The end time must be after the start.'); }
    S.avail = (p.rows || []).map(r => ({ weekday: +r.weekday, start: r.start, end: r.end, active: r.active !== false })); return schedule();
  },
  blackout_add: p => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) fail('Pick a date.'); if (p.date < today) fail('That date has already passed.');
    if (!!p.start !== !!p.end) fail('Add both a start and an end time, or leave both empty for the whole day.'); if (p.start && p.end <= p.start) fail('The end time must be after the start.');
    S.blackouts.push({ id: uid('x'), date: p.date, start: p.start || '', end: p.end || '', reason: (p.reason || '').trim() || 'Not available', source: 'manual' }); return schedule();
  },
  blackout_delete: p => { const b = S.blackouts.find(x => x.id === p.id); if (!b) fail('That block was not found.'); if (b.source === 'nlb') fail('That one comes from the NLB sessions. Turn off the NLB blocking in Settings to remove them.'); S.blackouts = S.blackouts.filter(x => x !== b); return schedule(); },
  prices_save: p => {
    for (const r of p.rows || []) { if (!String(r.label || '').trim()) fail('Give each price band a name.'); if (!r.start || !r.end || r.end <= r.start) fail('Each price band needs a start and a later end time.'); }
    S.prices = (p.rows || []).map(r => ({ id: r.id || uid('pr'), label: r.label.trim(), weekdays: r.weekdays || '', start: r.start, end: r.end, price_pence: +r.price_pence, priority: +r.priority || 0 })); return schedule();
  },
  settings: settingsOut,
  settings_save: p => {
    const s = p.settings || {}, n = k => (s[k] === undefined ? null : +s[k]);
    if (n('slot_minutes') !== null && (n('slot_minutes') < 15 || n('slot_minutes') > 180 || n('slot_minutes') % 5)) fail('Session length must be 15 to 180 minutes, in steps of 5.');
    if (n('min_notice_hours') !== null && (n('min_notice_hours') < 0 || n('min_notice_hours') > 168)) fail('Notice must be 0 to 168 hours.');
    if (n('horizon_weeks') !== null && (n('horizon_weeks') < 1 || n('horizon_weeks') > 26)) fail('Booking window must be 1 to 26 weeks.');
    if (n('default_price_pence') !== null && (n('default_price_pence') < 100 || n('default_price_pence') > 100000)) fail('The price must be between £1 and £1,000.');
    if (s.business_name !== undefined && !String(s.business_name).trim()) fail('Add a business name.');
    ['slot_minutes', 'min_notice_hours', 'horizon_weeks', 'default_price_pence'].forEach(k => { if (s[k] !== undefined) S.settings[k] = +s[k]; });
    ['business_name', 'alert_email'].forEach(k => { if (s[k] !== undefined) S.settings[k] = String(s[k]).trim(); });
    if (s.block_nlb !== undefined) S.settings.block_nlb = s.block_nlb === 'no' || s.block_nlb === false ? 'no' : 'yes';
    return settingsOut();
  },
  rotate_link_key: () => { S.link = 'demo'; return settingsOut(); },
  share_diary: p => { const e = String(p.email || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) fail('Enter a valid email address.'); S.settings.share_email = e; return { ...settingsOut(), result: 'shared' }; },
  stripe_connect: p => {
    const sk = String(p.secret_key || '').trim(), pk = String(p.publishable_key || '').trim();
    if (!/^(sk|rk)_(test|live)_\w{8,}$/.test(sk)) fail('That secret key is not right. It starts with rk_test_, rk_live_, sk_test_ or sk_live_.');
    if (!/^pk_(test|live)_\w{8,}$/.test(pk)) fail('That publishable key is not right. It starts with pk_test_ or pk_live_.');
    if (sk.split('_')[1] !== pk.split('_')[1]) fail('One key is for test mode and the other is for live mode. Use two test keys or two live keys.');
    S.stripe = { connected: true, mode: sk.split('_')[1], last4: sk.slice(-4) }; return settingsOut();
  },
  set_pin: p => { const n = String(p.new_pin || ''); if (n.length < 8 || n.length > 64) fail('The passphrase must be 8 to 64 characters.'); S.pass = n; return {}; },
  rotate_feed_key: () => { S.feedKey = uid('k'); return settingsOut(); },
  dashboard,
  stripe_refresh: () => { S.cacheAt = nowStamp(); return { charges: S.charges.length, cache_at: S.cacheAt }; },
  sync_now: () => ({ added: 0, updated: 0, removed: 0, last_sync: nowStamp().slice(0, 16) })
};

export async function handle(action, params = {}) {
  await sleep(120);
  if (Object.prototype.hasOwnProperty.call(PUBLIC, action)) {
    if (params.key !== S.link) fail(BAD_LINK);
    return JSON.parse(JSON.stringify({ ok: true, ...PUBLIC[action](params) }));
  }
  if (Object.prototype.hasOwnProperty.call(ADMIN, action)) {
    if (params.pin !== S.pass) fail('Wrong passphrase.');
    return JSON.parse(JSON.stringify({ ok: true, ...ADMIN[action](params) }));
  }
  fail('Unknown action.');
}
