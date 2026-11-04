/* In-memory stand-in for the diary API (docs/API.md). Demo only: nothing is kept after a reload.
   Demo passphrase: demo-pass. Add ?igoff to the address to see the "Instagram not connected" state.
   Emails ending .test are "not Google accounts". Imported Google Calendar events cannot be changed here, as in the real thing. */
import { ApiError } from './api.js?v=202611042019';

export const DEMO_PASS = 'demo-pass';
const FUTURE_DAYS = 182;
const PAST_DAYS = 30;
const MAPS = 'https://maps.google.com/?q=';

const TYPES = [
  { id: '4e056460e2b343cea50da7e70d55', slug: 'run-club', name: 'Monday Run Club', weekday: 1, start: '18:30', location: 'Furzton Lake', dir: MAPS + 'Furzton+Lake+Milton+Keynes', price: null, pay: '' },
  { id: '59cf4212ebc14606ac56ca8e5eb', slug: 'boxing', name: 'Wednesday Boxing', weekday: 3, start: '19:00', location: 'Mighty One Hundred Gym', dir: MAPS + 'Mighty+One+Hundred+Gym+Milton+Keynes', price: 1500, pay: 'https://example.com/pay/boxing' },
  { id: '288da3d2e3354b6a8a20f2f8e0a', slug: 'track', name: 'Thursday Track', weekday: 4, start: '06:20', location: 'Stantonbury Athletic Track', dir: MAPS + 'Stantonbury+Athletic+Track', price: 500, pay: '' },
  { id: '79c788d295ae4b2d8ca2b2c3d4e', slug: 'social-run', name: 'Saturday Social Run', weekday: 6, start: '09:00', location: 'See calendar for location', dir: '', price: null, pay: '' },
  { id: 'd89c2a2e06004f40b3beb3c8391', slug: 'long-run', name: 'Sunday Long Run', weekday: 0, start: '09:00', location: 'See calendar for location', dir: '', price: null, pay: '' }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, '0');
const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join('');
const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => pad(b.toString(16))).join('');

function londonParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const today = () => londonParts().date;
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = s => new Date(s + 'T00:00:00Z').getUTCDay();
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const addMinutes = (t, n) => { const m = Math.min(toMin(t) + n, 1439); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const nextDow = (wd, atLeast) => { let d = addDays(today(), atLeast); while (dow(d) !== wd) d = addDays(d, 1); return d; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function ordinal(n) { const v = n % 100; return n + (v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }
function label(s) { const d = new Date(s + 'T00:00:00Z'); return `${DAYS[d.getUTCDay()]} ${ordinal(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`; }
const dayLabel = s => { const d = new Date(s + 'T00:00:00Z'); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

let db = null;
let pass = DEMO_PASS;
let wrong = [];
let lockedUntil = 0;
let feedKey = hex(16);

const blank = () => ({ client: '', series_id: '', paid: false, calendar: 'nlb', read_only: false, edit_url: '' });

function seed() {
  const t0 = today();
  const events = [];
  for (let i = 0; i < 56; i++) {
    const date = addDays(t0, i);
    for (const ty of TYPES) {
      if (ty.weekday !== dow(date)) continue;
      events.push({
        key: `st:${ty.id}:${date}`, source: 'nlb-app', status: 'active', title: ty.name, date,
        start: ty.start, end: addMinutes(ty.start, 60), location: ty.location, directions_url: ty.dir,
        description: '', price_pence: ty.price, payment_url: ty.pay, origin_url: '', type_slug: ty.slug, edited: false, ...blank()
      });
    }
  }
  // a few weeks of the weekend runs get a real place, as they would after the app sync
  const places = ['Willen Lake', 'Caldecotte Lake', 'Campbell Park', 'Willen Lake'];
  let n = 0;
  for (const e of events) {
    if ((e.type_slug === 'social-run' || e.type_slug === 'long-run') && n < 8) {
      e.location = places[Math.floor(n / 2) % places.length];
      e.directions_url = MAPS + encodeURIComponent(e.location + ' Milton Keynes');
      n++;
    }
  }
  // one run that Chadrack has already changed
  const edited = events.find(e => e.type_slug === 'run-club' && e.date > addDays(t0, 8));
  if (edited) {
    edited._base = clone(edited);
    edited.start = '19:00'; edited.end = '20:00'; edited.location = 'Campbell Park';
    edited.directions_url = MAPS + 'Campbell+Park+Milton+Keynes'; edited.description = 'Starting half an hour later this week.'; edited.edited = true;
  }
  // one by hand
  const sat = nextDow(6, 12);
  events.push({
    key: 'mn:' + rnd(8), source: 'manual', status: 'active', title: 'Park clean-up and coffee', date: addDays(sat, 7),
    start: '11:00', end: '12:30', location: 'Campbell Park', directions_url: MAPS + 'Campbell+Park+Milton+Keynes',
    description: 'Bags and gloves provided.', price_pence: null, payment_url: '', origin_url: '', type_slug: '', edited: false, ...blank()
  });
  // PT clients: a weekly series that started last week, and a one-off
  const sid = hex(4), tue = addDays(nextDow(2, 0), -7);
  for (let i = 0; i < 8; i++) {
    const date = addDays(tue, 7 * i);
    events.push(pt({ key: `pt:${sid}:${date}`, date, client: 'Sam Okoro', series_id: sid, start: '17:00', end: '18:00', location: 'Gym 1', price_pence: 4000, paid: i === 0, description: 'Leg day on the second week.' }));
  }
  const thu = nextDow(4, 2);
  events.push(pt({ key: `pt:${hex(4)}:${thu}`, date: thu, client: 'Priya Shah', series_id: hex(4), start: '12:15', end: '13:00', location: 'Campbell Park', price_pence: 3000, paid: false }));
  // two events that were added in Google Calendar itself
  events.push(gcal('Dentist', addDays(t0, 4), '10:00', '11:00', 'nlb', 'Bletchley Road'));
  events.push(gcal('Physio (own)', addDays(t0, 6), '08:00', '09:00', 'pt', ''));

  const sun = nextDow(0, 6);
  const sat2 = nextDow(6, 13);
  const suggestions = [
    {
      id: 'sg1', status: 'new', post_url: 'https://www.instagram.com/p/DemoPost1/', posted_at: `${addDays(t0, -1)} 17:42`,
      caption: `Sunday Long Run \u{1F3C3}‍♂️\n\u{1F4C5} ${label(sun)} \u{1F558} 8:30am\n\u{1F4CD} Willen Lake\n\nWe are doing the full lake loop twice. All paces welcome, nobody gets left behind.\n\n#NLB #nobodyleftbehind #miltonkeynes #runclub`
    },
    {
      id: 'sg2', status: 'new', post_url: 'https://www.instagram.com/p/DemoPost2/', posted_at: `${addDays(t0, -3)} 09:15`,
      caption: `Winter warm-up weekend ❄️\n${label(sat2)}, 10am: Social Run from Caldecotte Lake\n${label(addDays(sat2, 1))}, 9:30am: Long Run from Campbell Park\nBring a head torch if you have one, it still gets dark early. See you there \u{1F499}\n#NLB #winterrunning`
    }
  ];
  db = {
    events, suggestions, lastSync: `${londonParts().date} ${londonParts().time}`,
    people: [{ email: 'chadrack@example.com', role: 'edit' }]
  };
}
function pt(o) {
  return {
    source: 'pt', status: 'active', title: 'PT: ' + o.client, start: '', end: '', location: '', directions_url: '', description: '', price_pence: null,
    payment_url: '', origin_url: '', type_slug: '', edited: false, ...blank(), calendar: 'pt', ...o
  };
}
function gcal(title, date, start, end, calendar, location) {
  return {
    key: 'gc:' + hex(8), source: 'gcal', status: 'active', title, date, start, end, location, directions_url: '', description: '', price_pence: null,
    payment_url: '', origin_url: '', type_slug: '', edited: false, ...blank(), calendar, read_only: true,
    edit_url: `https://calendar.google.com/calendar/u/0/r/day/${date.slice(0, 4)}/${+date.slice(5, 7)}/${+date.slice(8, 10)}`
  };
}

const ini = () => { if (!db) seed(); };
const cleanEvent = e => { const { _base, ...rest } = e; return clone(rest); };
const MAX_PEOPLE = 25;
const calendar = () => {
  const base = 'https://script.google.com/macros/s/DEMO/exec?feed=ics&key=' + feedKey;
  return { feed_all: base + '&cal=all', feed_nlb: base + '&cal=nlb', feed_pt: base + '&cal=pt' };
};
const roleName = r => (r === 'edit' ? 'can edit' : 'can see');

function checkPass(p) {
  const now = Date.now();
  if (now < lockedUntil) throw new ApiError('Too many wrong attempts. Try again in 15 minutes.');
  if (String(p.pin || '').trim() !== pass) {
    wrong = wrong.filter(t => now - t < 15 * 60000); wrong.push(now);
    if (wrong.length >= 5) { lockedUntil = now + 15 * 60000; wrong = []; throw new ApiError('Too many wrong attempts. Try again in 15 minutes.'); }
    throw new ApiError('Wrong passphrase.');
  }
  wrong = [];
}

const isHm = s => s === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
function validate(ev, { partial = false } = {}) {
  const f = ev || {};
  if (!partial || 'title' in f || 'date' in f) {
    if (!String(f.title || '').trim() || (!partial && !f.date)) throw new ApiError('Add a title and a date.');
  }
  if ('title' in f && String(f.title).trim().length > 80) throw new ApiError('The title is too long (80 characters at most).');
  if ('date' in f && f.date) {
    const d = new Date(f.date + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || isNaN(d) || d.toISOString().slice(0, 10) !== f.date) throw new ApiError('That date does not look right.');
    if (f.date < addDays(today(), -365) || f.date > addDays(today(), 730)) throw new ApiError('Pick a date from a year ago to two years ahead.');
  }
  for (const k of ['start', 'end']) if (k in f && !isHm(String(f[k] || ''))) throw new ApiError('Times need to look like 18:30.');
  if (f.start && f.end && f.end <= f.start) throw new ApiError('The end time must be after the start.');
  if (String(f.location || '').length > 120) throw new ApiError('The location is too long (120 characters at most).');
  if (String(f.description || '').length > 1000) throw new ApiError('The description is too long (1000 characters at most).');
  if (f.origin_url && !/^https:\/\//.test(f.origin_url)) throw new ApiError('Links must start with https://');
}

function mkEvent(ev, source) {
  validate(ev);
  const start = ev.start || '';
  const location = String(ev.location || '').trim();
  const key = source === 'instagram' ? 'ig:' + rnd(8) : 'mn:' + rnd(8);
  return {
    key, source, status: 'active', title: ev.title.trim(), date: ev.date, start,
    end: ev.end || (start ? addMinutes(start, 60) : ''), location,
    directions_url: location ? MAPS + encodeURIComponent(location + ' Milton Keynes') : '',
    description: ev.description || '', price_pence: null, payment_url: '',
    origin_url: ev.origin_url || '', type_slug: '', edited: false, ...blank()
  };
}

const find = key => {
  const e = db.events.find(x => x.key === key && x.status !== 'deleted');
  if (!e) throw new ApiError('That event was not found.');
  return e;
};
const writable = key => {
  const e = find(key);
  if (e.source === 'gcal') throw new ApiError('This one is in Google Calendar, so it can only be changed there.');
  return e;
};
const scoped = (e, scope) => (e.source !== 'pt' || scope !== 'following' || !e.series_id ? [e]
  : db.events.filter(x => x.source === 'pt' && x.series_id === e.series_id && x.status !== 'deleted' && x.date >= e.date).sort((a, b) => a.date.localeCompare(b.date)));
const sorted = list => list.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
const out = (e, list) => ({ event: cleanEvent(e), events: list.map(cleanEvent) });

/* clashes, worked out the same way as the real thing */
const span = x => (x.start ? [toMin(x.start), toMin(x.end && x.end > x.start ? x.end : addMinutes(x.start, 60))] : [0, 1440]);
function clashes(slots, skip) {
  const hits = [];
  for (const c of slots) {
    const [a1, a2] = span(c);
    for (const e of db.events) {
      if (e.status !== 'active' || e.date !== c.date || skip.includes(e.key)) continue;
      const [b1, b2] = span(e);
      if (a1 < b2 && b1 < a2) hits.push({ date: c.date, title: e.title });
    }
  }
  return hits;
}
function clashError(hits) {
  const by = new Map();
  for (const h of hits) { if (!by.has(h.title)) by.set(h.title, []); if (!by.get(h.title).includes(h.date)) by.get(h.title).push(h.date); }
  const parts = [...by].map(([t, d]) => {
    d.sort();
    const shown = d.slice(0, 5).map(dayLabel).join(', ') + (d.length > 5 ? `, and ${d.length - 5} more` : '');
    return `${t} on ${d.length === 1 ? shown : d.length + ' dates: ' + shown}`;
  });
  return new ApiError('Clashes with ' + parts.join('; '), { clash: true });
}

const ACTIONS = {
  login(p) { checkPass(p); return {}; },
  events(p) {
    checkPass(p);
    const from = p.from || addDays(today(), -PAST_DAYS);
    const to = p.to || addDays(today(), FUTURE_DAYS);
    const list = db.events.filter(e => e.status !== 'deleted' && e.date >= from && e.date <= to).map(cleanEvent);
    return { events: sorted(list), last_sync: db.lastSync, calendar: calendar(), people_enabled: true };
  },
  add_event(p) {
    checkPass(p);
    const src = p.event && p.event.source === 'instagram' ? 'instagram' : 'manual';
    const e = mkEvent(p.event || {}, src);
    db.events.push(e);
    return { event: cleanEvent(e) };
  },
  add_pt(p) {
    checkPass(p);
    const client = String(p.client || '').trim();
    if (!client) throw new ApiError('Add the client name.');
    if (client.length > 40) throw new ApiError('The client name is too long (40 characters at most).');
    if (!p.date) throw new ApiError('Add a date.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(p.start || ''))) throw new ApiError('Add a start time like 18:30.');
    const weeks = p.repeat_weeks == null || p.repeat_weeks === '' ? 1 : Number(p.repeat_weeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 26) throw new ApiError('Repeat for 1 to 26 weeks.');
    validate({ title: 'PT: ' + client, date: p.date, start: p.start, end: p.end || '', location: p.location, description: p.notes });
    const price = p.price_pence == null || p.price_pence === '' ? null : Number(p.price_pence);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1000000)) throw new ApiError('The price must be a number of pence.');
    const end = p.end || addMinutes(p.start, 60), sid = hex(4);
    const dates = Array.from({ length: weeks }, (_, i) => addDays(p.date, 7 * i));
    const hits = clashes(dates.map(date => ({ date, start: p.start, end })), []);
    if (hits.length && p.force !== true) throw clashError(hits);
    const made = dates.map(date => pt({
      key: `pt:${sid}:${date}`, date, client, series_id: sid, start: p.start, end, location: String(p.location || '').trim(),
      description: String(p.notes || '').trim(), price_pence: price === null ? null : Math.round(price), paid: p.paid === true
    }));
    db.events.push(...made);
    return { event: cleanEvent(made[0]), events: made.map(cleanEvent), series_id: sid, count: made.length };
  },
  update_event(p) {
    checkPass(p);
    const e = writable(p.key);
    const f = p.event || {};
    const targets = scoped(e, p.scope);
    if (f.clear_overrides || p.clear_overrides) {
      if (e._base) { const keep = { status: e.status }; Object.assign(e, clone(e._base), keep); delete e._base; }
      e.edited = false;
      return out(e, [e]);
    }
    const isPt = e.source === 'pt';
    const fields = e.source === 'nlb-app' ? ['title', 'location', 'start', 'end', 'description']
      : isPt ? ['client', 'date', 'start', 'end', 'location', 'description', 'price_pence', 'paid']
        : ['title', 'date', 'location', 'start', 'end', 'description', 'origin_url'];
    const names = fields.filter(k => k in f);
    const delta = isPt && 'date' in f && f.date ? Math.round((new Date(f.date) - new Date(e.date)) / 86400000) : 0;
    const plans = targets.map(t => {
      const next = {};
      for (const k of names) next[k] = typeof f[k] === 'string' ? f[k].trim() : f[k];
      if (isPt && 'date' in f && t !== e) next.date = addDays(t.date, delta);
      if (isPt && 'start' in f && !('end' in f) && t.start && t.end) next.end = addMinutes(f.start, toMin(t.end) - toMin(t.start));
      const merged = { ...t, ...next };
      if (isPt && 'client' in next) {
        if (!next.client) throw new ApiError('Add the client name.');
        if (next.client.length > 40) throw new ApiError('The client name is too long (40 characters at most).');
        merged.title = 'PT: ' + next.client;
      }
      validate(merged);
      return { t, next };
    });
    if (names.some(k => k === 'date' || k === 'start' || k === 'end') && p.force !== true) {
      const hits = clashes(plans.filter(x => x.t.status === 'active').map(x => ({ date: x.next.date || x.t.date, start: 'start' in x.next ? x.next.start : x.t.start, end: 'end' in x.next ? x.next.end : x.t.end })), targets.map(x => x.key));
      if (hits.length) throw clashError(hits);
    }
    for (const { t, next } of plans) {
      if (t.source === 'nlb-app' && !t._base) t._base = clone(t);
      for (const k of Object.keys(next)) {
        if (k === 'price_pence') t.price_pence = next.price_pence === '' || next.price_pence == null ? null : Math.round(Number(next.price_pence));
        else t[k] = next[k];
      }
      if (isPt && 'client' in next) t.title = 'PT: ' + next.client;
      if ('location' in next && t.source !== 'pt') t.directions_url = t.location ? MAPS + encodeURIComponent(t.location + ' Milton Keynes') : '';
      if (t.source === 'nlb-app') t.edited = true;
    }
    return out(e, targets);
  },
  cancel_event(p) { checkPass(p); const e = writable(p.key), list = scoped(e, p.scope); list.forEach(x => { x.status = 'cancelled'; }); return out(e, list); },
  restore_event(p) { checkPass(p); const e = writable(p.key), list = scoped(e, p.scope); list.forEach(x => { x.status = 'active'; }); return out(e, list); },
  delete_event(p) {
    checkPass(p);
    const e = find(p.key);
    if (e.source === 'nlb-app') throw new ApiError('This one comes from the NLB app. Cancel it instead.');
    if (e.source === 'gcal') throw new ApiError('This one is in Google Calendar. Delete it there.');
    const list = scoped(e, p.scope);
    list.forEach(x => { x.status = 'deleted'; });
    return { deleted: list.map(x => x.key) };
  },
  suggestions(p) {
    checkPass(p);
    const off = new URLSearchParams(location.search).has('igoff');
    return { suggestions: off ? [] : clone(db.suggestions.filter(s => s.status === 'new')), instagram_connected: !off };
  },
  dismiss_suggestion(p) {
    checkPass(p);
    const s = db.suggestions.find(x => x.id === p.id);
    if (s) s.status = 'dismissed';
    return {};
  },
  approve_suggestion(p) {
    checkPass(p);
    const s = db.suggestions.find(x => x.id === p.id);
    if (!s) throw new ApiError('That suggestion was not found.');
    const e = mkEvent({ ...(p.event || {}), origin_url: s.post_url }, 'instagram');
    db.events.push(e);
    s.status = 'approved';
    return { event: cleanEvent(e) };
  },
  sync_now(p) {
    checkPass(p);
    const t = londonParts();
    db.lastSync = `${t.date} ${t.time}`;
    return { added: 0, updated: 0, removed: 0, last_sync: db.lastSync };
  },
  rotate_feed_key(p) { checkPass(p); feedKey = hex(16); return { calendar: calendar() }; },
  people_list(p) {
    checkPass(p);
    const people = db.people.map(x => ({ email: x.email, role: roleName(x.role), rule_id: 'user:' + x.email })).sort((a, b) => a.email.localeCompare(b.email));
    return { people, max: MAX_PEOPLE };
  },
  people_add(p) {
    checkPass(p);
    const email = String(p.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ApiError('Enter a valid email address.');
    if (p.role !== 'edit' && p.role !== 'see') throw new ApiError('Choose can edit or can see.');
    if (/\.test$/.test(email)) throw new ApiError("That email isn't a Google account, so it can't be given edit access. Send them the subscribe link instead.");
    const have = db.people.find(x => x.email === email);
    if (have && have.role === p.role) throw new ApiError('That email is already on the list.');
    if (!have && db.people.length >= MAX_PEOPLE) throw new ApiError('The limit is ' + MAX_PEOPLE + ' people. Remove someone first.');
    if (have) have.role = p.role; else db.people.push({ email, role: p.role });
    return { person: { email, role: roleName(p.role), rule_id: 'user:' + email } };
  },
  people_remove(p) {
    checkPass(p);
    const i = db.people.findIndex(x => 'user:' + x.email === p.rule_id);
    if (i < 0) throw new ApiError('That person was not found.');
    db.people.splice(i, 1);
    return {};
  },
  set_pin(p) {
    checkPass(p);
    const n = String(p.new_pin || '').trim();
    if (n.length < 8 || n.length > 64) throw new ApiError('The passphrase must be 8 to 64 characters.');
    pass = n;
    return {};
  }
};

export async function handle(action, params = {}) {
  ini();
  await sleep(220);
  const fn = ACTIONS[action];
  if (!fn) throw new ApiError('Unknown action.');
  return { ok: true, ...fn(params) };
}
