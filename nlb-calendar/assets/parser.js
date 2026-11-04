/* Reads dates, times and places out of an Instagram caption. Pure: no DOM, no network.
   parseCaption(text, { now, venues }) returns one entry per date found:
   { date:'YYYY-MM-DD', start:'HH:MM'|'', end:'HH:MM'|'', location, title,
     confidence:'high'|'low', matched, range:[from,to], reasons:[...] }
   range points into the caption text (after line endings are made \n). */

export const DEFAULT_VENUES = [
  'Furzton Lake',
  'Stantonbury Athletic Track',
  'Mighty One Hundred Gym',
  'Willen Lake',
  'Campbell Park',
  'Caldecotte Lake'
];

const MONTH_NUM = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const WEEKDAY_NUM = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

const WD = '(?<wd>mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const WD_PLAIN = WD.replace('(?<wd>', '(?:');
const MON = '(?<m>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const MON_PLAIN = MON.replace('(?<m>', '(?:');
const WD_PREFIX = `(?:(?<![a-z])${WD}\\.?,?[ \\t]+)?`;

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;

const pad = n => String(n).padStart(2, '0');
const spaces = n => ' '.repeat(n);

/* ---------- date helpers (UTC arithmetic on plain dates) ---------- */
function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const dowOf = s => new Date(s + 'T00:00:00Z').getUTCDay();
function addDays(s, n) { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function londonToday(now) {
  const d = now instanceof Date && !isNaN(now) ? now : new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/* nearest future occurrence of day/month (today counts) */
function inferYear(d, m, today) {
  const ty = +today.slice(0, 4);
  for (let y = ty; y <= ty + 4; y++) {
    if (validDate(y, m, d)) { const s = iso(y, m, d); if (s >= today) return s; }
  }
  return null;
}

/* ---------- normalising ---------- */
/* Every step keeps the string the same length, so positions in `clean`
   are also positions in the original caption. */
function sanitize(orig, venues) {
  let s = orig;
  s = s.replace(/\u{1F4CD}/gu, '@ ');
  s = s.replace(/https?:\/\/\S+|www\.\S+/gi, m => spaces(m.length));
  s = s.replace(/[   -​  　]/g, ' ').replace(/[‐-―−]/g, '-');
  s = s.replace(EMOJI_RE, m => spaces(m.length));
  s = s.replace(/#[\p{L}\p{N}_]+/gu, m => spaces(m.length));
  s = s.replace(/@(?! )([\w.]+)/g, (m, w) => venues.some(v => v.toLowerCase().startsWith(w.toLowerCase())) ? m : spaces(m.length));
  s = s.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, (m, d, suf) => d + spaces(suf.length));
  return s;
}
const lower = s => s.replace(/[A-Z]/g, c => c.toLowerCase());

/* ---------- dates ---------- */
function relativeDate(kind, wd, today) {
  const d = (dowOf(today) + 6) % 7; // Monday = 0
  const t = wd == null ? 5 : (WEEKDAY_NUM[wd.slice(0, 3)] + 6) % 7;
  const upcoming = t >= d ? t - d : 7 - (d - t);
  if (kind === 'today' || kind === 'tonight') return today;
  if (kind === 'tomorrow') return addDays(today, 1);
  if (kind === 'this') return addDays(today, upcoming);
  if (kind === 'next') return addDays(today, t > d ? t - d + 7 : (t === d ? 7 : 7 - (d - t)));
  if (kind === 'thisweekend') return addDays(today, upcoming);
  if (kind === 'nextweekend') return addDays(today, upcoming + 7);
  return null;
}

function findDates(norm, today) {
  const found = []; // { s, e, items:[{date, wd, swapped, relative}] }
  const taken = (s, e) => found.some(o => s < o.e && e > o.s);
  const push = (m, items) => {
    const s = m.index, e = m.index + m[0].length;
    items = items.filter(x => x.date);
    if (!items.length || taken(s, e)) return;
    found.push({ s, e, items });
  };
  const each = (re, fn) => { re.lastIndex = 0; let m; while ((m = re.exec(norm))) fn(m); };
  const mnum = s => MONTH_NUM[s.slice(0, 3)];
  const resolve = (d, m, y) => {
    if (y) { const yy = +y; return validDate(yy, m, d) ? iso(yy, m, d) : null; }
    return inferYear(d, m, today);
  };

  // two days sharing a month: "8th & 9th Nov"
  each(new RegExp(`(?:(?<![a-z])${WD_PLAIN}\\.?,?[ \\t]+)?(?<![\\d:.\\/])(?<d1>\\d{1,2})[ \\t]*(?:&|and|\\/|,)[ \\t]*(?:${WD_PLAIN}\\.?,?[ \\t]+)?(?<d2>\\d{1,2})[ \\t]*(?:of[ \\t]+)?${MON}\\b`, 'g'), m => {
    const mo = mnum(m.groups.m);
    push(m, [m.groups.d1, m.groups.d2].map(d => ({ date: resolve(+d, mo), wd: null })));
  });

  // day then month: "Sat 8 Nov", "8 November 2026", "Sunday the 16th of November"
  each(new RegExp(`${WD_PREFIX}(?:the[ \\t]+)?(?<![\\d:.\\/])(?<d>\\d{1,2})(?!\\d)[ \\t]*(?:of[ \\t]+)?${MON}\\b\\.?(?:[ \\t]*,?[ \\t]*(?<y>20\\d\\d)(?!\\d))?`, 'g'), m => {
    push(m, [{ date: resolve(+m.groups.d, mnum(m.groups.m), m.groups.y), wd: m.groups.wd || null }]);
  });

  // month then day: "Nov 8"
  each(new RegExp(`${WD_PREFIX}(?<![a-z])${MON}\\b\\.?[ \\t]*(?<d>\\d{1,2})(?!\\d|:|\\.\\d|[ \\t]*(?:am|pm|a\\.m|p\\.m|k\\b|km|mi\\b))(?:[ \\t]*,?[ \\t]*(?<y>20\\d\\d)(?!\\d))?`, 'g'), m => {
    push(m, [{ date: resolve(+m.groups.d, mnum(m.groups.m), m.groups.y), wd: m.groups.wd || null }]);
  });

  // numeric, UK order: 8/11, 08/11/26, 8/11/2026
  each(new RegExp(`${WD_PREFIX}(?<![\\d\\/.:\\-])(?<a>\\d{1,2})\\/(?<b>\\d{1,2})(?:\\/(?<y>\\d{4}|\\d{2}))?(?![\\d\\/])(?![ \\t]*(?:marathon|mile|km|k\\b|%))`, 'g'), m => {
    let day = +m.groups.a, mon = +m.groups.b, swapped = false;
    if (mon > 12 && day <= 12) { [day, mon] = [mon, day]; swapped = true; }
    let y = m.groups.y;
    if (y && y.length === 2) y = String(2000 + +y);
    push(m, [{ date: resolve(day, mon, y), wd: m.groups.wd || null, swapped }]);
  });

  // relative
  each(/\b(today|tonight|tomorrow|tmrw)\b/g, m => {
    push(m, [{ date: relativeDate(m[1] === 'tmrw' ? 'tomorrow' : m[1], null, today), wd: null, relative: true }]);
  });
  each(/\b(this|next)[ \t]+weekend\b/g, m => {
    push(m, [{ date: relativeDate(m[1] + 'weekend', null, today), wd: null, relative: true }]);
  });
  each(new RegExp(`\\b(?<k>this|next)[ \\t]+(?:coming[ \\t]+)?${WD}\\b`, 'g'), m => {
    push(m, [{ date: relativeDate(m.groups.k, m.groups.wd, today), wd: null, relative: true }]);
  });

  found.sort((a, b) => a.s - b.s);
  return found;
}

/* ---------- times ---------- */
const MER = '(a\\.?m\\.?|p\\.?m\\.?)';
const meridiem = s => (s ? (s[0] === 'a' ? 'am' : 'pm') : '');
function to24(h, mi, ap) {
  if (mi > 59) return null;
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (ap === 'pm' ? 12 : 0); }
  else if (h > 23) return null;
  return `${pad(h)}:${pad(mi)}`;
}
const mins = t => +t.slice(0, 2) * 60 + +t.slice(3);

/* returns { start, end, ambiguous, spans:[[from,to]] }; `src` is lower case with dates blanked */
function findTimes(src, cue = src) {
  let w = src;
  const cands = [];
  const pmContext = /\b(?:evening|tonight|night|after work)\b/.test(cue) || /\d[ \t]*p\.?m(?![a-z])/.test(cue);
  const pass = (re, fn) => {
    re.lastIndex = 0;
    const hits = []; let m;
    while ((m = re.exec(w))) hits.push(m);
    for (const m of hits) {
      const r = fn(m);
      if (!r) continue;
      cands.push({ i: m.index, len: m[0].length, ...r });
      w = w.slice(0, m.index) + spaces(m[0].length) + w.slice(m.index + m[0].length);
    }
  };

  // 9-11am, 9am to 11am, 6.30pm-8pm
  pass(new RegExp(`(?<![\\d:.])(\\d{1,2})(?:[:.](\\d{2}))?[ \\t]*${MER}?[ \\t]*(?:-|\\bto\\b|\\buntil\\b|\\btill\\b|\\btil\\b)[ \\t]*(\\d{1,2})(?:[:.](\\d{2}))?[ \\t]*${MER}(?![a-z])`, 'g'), m => {
    const a2 = meridiem(m[6]);
    let a1 = meridiem(m[3]) || a2;
    let start = to24(+m[1], +(m[2] || 0), a1);
    const end = to24(+m[4], +(m[5] || 0), a2);
    if (start && end && mins(start) >= mins(end) && !m[3] && a1 === 'pm') start = to24(+m[1], +(m[2] || 0), 'am');
    return start ? { start, end: end || '' } : null;
  });
  // 18:30-19:30
  pass(/(?<![\d:.])([01]?\d|2[0-3])[:.]([0-5]\d)[ \t]*(?:-|\bto\b|\buntil\b|\btill\b|\btil\b)[ \t]*([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)(?![ \t]*[ap]\.?m)/g, m => ({
    start: to24(+m[1], +m[2], ''), end: to24(+m[3], +m[4], '')
  }));
  // 9am, 9:30am, 9.30pm
  pass(new RegExp(`(?<![\\d:.])(\\d{1,2})(?:[:.](\\d{2}))?[ \\t]*${MER}(?![a-z])`, 'g'), m => {
    const start = to24(+m[1], +(m[2] || 0), meridiem(m[3]));
    return start ? { start, end: '' } : null;
  });
  // 18:30
  pass(/(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g, m => ({ start: to24(+m[1], +m[2], ''), end: '' }));
  // 18.30 (only when the hour cannot be a day-time dot such as 9.30 with no am/pm)
  pass(/(?<![\d:.])(1[3-9]|2[0-3])\.([0-5]\d)(?![\d.])/g, m => ({ start: to24(+m[1], +m[2], ''), end: '' }));
  // noon, midday
  pass(/\b(?:noon|midday|mid-day)\b/g, () => ({ start: '12:00', end: '' }));
  // half 6: only with an evening cue
  pass(/\bhalf[ \t]+(?:past[ \t]+)?(\d{1,2})\b(?![:.]\d)(?![ \t]*(?:marathon|k\b|km|mile))/g, m => {
    const h = +m[1];
    if (!pmContext || h < 1 || h > 11) return null;
    return { start: `${pad(h + 12)}:30`, end: '' };
  });
  // bare number, only after "at" or "@"
  pass(/(?:\bat|@)[ \t]*(\d{1,2})(?:[:.]([0-5]\d))?(?![\d:.]\d)(?![ \t]*(?:k\b|km|miles?\b|mi\b|min|minute|people|%|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/g, m => {
    const h = +m[1], mi = +(m[2] || 0);
    if (h < 1 || h > 23) return null;
    if (h >= 13 || h === 12) return { start: to24(h, mi, ''), end: '' };
    // 7-11 reads as morning, 1-6 as evening
    return { start: to24(h >= 7 ? h : h + 12, mi, ''), end: '', ambiguous: true };
  });

  cands.sort((a, b) => a.i - b.i);
  const first = cands[0];
  if (!first) return { start: '', end: '', ambiguous: false, spans: [] };
  let end = first.end || '';
  if (!end) {
    const m = /(?:\buntil|\btill|\btil|\bfinish(?:ing|es)?(?:[ \t]+at)?|\bends?(?:[ \t]+at)?)[ \t]*(\d{1,2})(?:[:.]([0-5]\d))?[ \t]*(a\.?m\.?|p\.?m\.?)?(?![a-z\d])/.exec(w);
    if (m) {
      const h = +m[1], mi = +(m[2] || 0), ap = meridiem(m[3]);
      let cand = to24(h, mi, ap);
      if (cand && !ap && h < 12 && mins(cand) <= mins(first.start)) cand = to24(h + 12, mi, '');
      if (cand && mins(cand) > mins(first.start)) end = cand;
    }
  }
  return { start: first.start, end, ambiguous: !!first.ambiguous, spans: cands.map(c => [c.i, c.i + c.len]) };
}

/* ---------- location ---------- */
const WEAK_REJECT = /^(?:\d|noon\b|midday\b|half\b|least\b|once\b|home\b|work\b|about\b|around\b|last\b|first\b|the (?:end|start|weekend|same|moment|time|back)\b|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|tonight\b|night\b)/i;
const LOC_CUTS = [
  /\s{2,}/,
  /[.!?;](?:\s|$)/,
  /\s-\s/,
  /\b\d{1,2}(?::\d{2}|[.:]\d{2}[ \t]*[ap]\.?m|[ \t]*[ap]\.?m\b)/i,
  /\b(?:from|until|till|til|with|bring|see you|wear|please|starts?|kicks? off|free|everyone|then|and bring|every)\b/i,
  /\bon (?:mon|tue|wed|thu|fri|sat|sun)/i,
  /\bhalf\b/i,
  /(?:\bat|@)[ \t]*\d/i
];
function trimLocation(rest, weak) {
  let t = rest.split('\n')[0];
  let cut = t.length;
  for (const re of LOC_CUTS) { const m = re.exec(t); if (m && m.index < cut) cut = m.index; }
  t = t.slice(0, cut).replace(/[\s,;:\-]+$/, '').replace(/^[\s,:\-]+/, '').trim();
  if (t.length > 80) t = t.slice(0, 80).replace(/\s+\S*$/, '');
  if (!/[a-z]{3}/i.test(t)) return '';
  if (weak && WEAK_REJECT.test(t)) return '';
  return t;
}
function findLocation(clean, norm, venues) {
  const captures = [];
  const grab = (re, weak) => {
    re.lastIndex = 0; let m;
    while ((m = re.exec(clean))) {
      const t = trimLocation(clean.slice(m.index + m[0].length), weak);
      if (t) captures.push(t);
    }
  };
  // clean and norm are the same length, so one regex run on norm gives positions for both
  const strong = /(?:\bmeet(?:ing)?(?:[ \t]+up)?[ \t]+(?:at|@|by|outside|in)\b|\b(?:location|venue|where|place)[ \t]*[:\-]|@)[ \t]*/gi;
  const weak = /\bat\b[ \t]+/gi;
  grab(strong, false);
  const strongCount = captures.length;
  grab(weak, true);

  let best = null;
  for (const v of venues) {
    const i = norm.indexOf(lower(v));
    if (i >= 0 && (!best || i < best.i)) best = { i, v };
  }
  if (best) {
    const rich = captures.find(c => lower(c).includes(lower(best.v)));
    return rich || best.v;
  }
  return captures.length ? captures[0] : (strongCount ? captures[0] : '');
}

/* ---------- title ---------- */
const TYPE_RE = /\b(long run|social run|run club|track session|track night|boxing|boxercise|track)\b/g;
const TYPE_NAME = { 'long run': 'Long Run', 'social run': 'Social Run', 'run club': 'Run Club', 'track session': 'Track Session', 'track night': 'Track Session', track: 'Track Session', boxing: 'Boxing', boxercise: 'Boxing' };
function typeIn(norm) {
  TYPE_RE.lastIndex = 0;
  let m;
  while ((m = TYPE_RE.exec(norm))) {
    if (m[1] === 'track' && /(?:keep|on|off|lose|lost|of|fast)[ \t]+$/.test(norm.slice(Math.max(0, m.index - 6), m.index))) continue;
    if (m[1] === 'track' && /^[ \t]+of\b/.test(norm.slice(m.index + 5, m.index + 9))) continue;
    return TYPE_NAME[m[1]];
  }
  return '';
}
const CONNECT_LEAD = /^(?:(?:at|on|from|to|and|for|the|@)\b|[-,:;&|*.\s])+/i;
const CONNECT_TAIL = /(?:\b(?:at|on|from|to|and|for)\b|[-,:;&|*@\s])+$/i;
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FILLER = '(?:' + WD_PLAIN.slice(3, -1) + '|' + MON_PLAIN.slice(3, -1) + '|at|on|from|to|and|the|for|this|next|today|tonight|tomorrow|weekend|meet|meeting|join|us|come|see|you|there|location|venue)';
const FILLER_RE = new RegExp(`\\b${FILLER}\\b`, 'g');
function lineTitle(clean, norm, lineStart, lineEnd, mentions, locs) {
  const chars = clean.slice(lineStart, lineEnd).split('');
  const blank = (s, e) => { for (let i = Math.max(s, lineStart); i < Math.min(e, lineEnd); i++) chars[i - lineStart] = ' '; };
  for (const m of mentions) blank(m.s, m.e);
  const here = lower(chars.join(''));
  for (const [s, e] of findTimes(here, lower(clean.slice(lineStart, lineEnd))).spans) blank(s + lineStart, e + lineStart);
  for (const loc of locs) {
    const re = new RegExp(`(?:\\b(?:meet(?:ing)?[ \\t]+)?(?:at|@)[ \\t]*)?${escRe(lower(loc))}`, 'g');
    const cur = lower(chars.join(''));
    let m;
    while ((m = re.exec(cur))) blank(m.index + lineStart, m.index + m[0].length + lineStart);
  }
  const pieces = chars.join('').split(/[,.!?;|]+|\s-\s/);
  for (let piece of pieces) {
    let text = piece.replace(/\s+/g, ' ').trim();
    text = text.replace(CONNECT_LEAD, '').replace(CONNECT_TAIL, '').trim();
    const probe = lower(text).replace(FILLER_RE, ' ');
    if ((probe.match(/\p{L}/gu) || []).length >= 3) return text;
  }
  return '';
}
function truncateTitle(t) {
  if (t.length <= 60) return t;
  return t.slice(0, 60).replace(/\s+\S*$/, '').replace(/[\s,;:\-]+$/, '');
}

/* ---------- main ---------- */
export function parseCaption(text, opts = {}) {
  const orig = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  if (!orig.trim()) return [];
  const venues = [...new Set([...DEFAULT_VENUES, ...(Array.isArray(opts.venues) ? opts.venues.filter(Boolean) : [])])];
  const today = londonToday(opts.now);
  const clean = sanitize(orig, venues);
  const norm = lower(clean);

  const mentions = findDates(norm, today);
  if (!mentions.length) return [];

  const lineStartOf = i => norm.lastIndexOf('\n', i - 1) + 1;
  const lineEndOf = i => { const j = norm.indexOf('\n', i); return j < 0 ? norm.length : j; };

  // each mention gets the stretch of text up to the next mention
  const multi = mentions.length > 1;
  mentions.forEach((m, k) => {
    if (!multi) { m.cs = 0; m.ce = norm.length; return; }
    const prev = mentions[k - 1], next = mentions[k + 1];
    m.cs = prev && lineStartOf(prev.s) === lineStartOf(m.s) ? m.s : lineStartOf(m.s);
    m.ce = next ? (lineStartOf(next.s) === lineStartOf(m.s) ? next.s : lineStartOf(next.s)) : norm.length;
  });

  const blankDates = (s, e) => {
    const chars = norm.slice(s, e).split('');
    for (const m of mentions) for (let i = Math.max(m.s, s); i < Math.min(m.e, e); i++) chars[i - s] = ' ';
    return chars.join('');
  };

  // per-mention details
  const details = mentions.map(m => {
    const ctxNorm = blankDates(m.cs, m.ce);
    const ctxClean = clean.slice(m.cs, m.ce).split('').map((c, i) => (ctxNorm[i] === ' ' && norm[m.cs + i] !== ' ' ? ' ' : c)).join('');
    const t = findTimes(ctxNorm, lower(clean.slice(m.cs, m.ce)));
    return { m, ctxNorm, ctxClean, t, loc: findLocation(ctxClean, ctxNorm, venues), type: typeIn(ctxNorm) };
  });

  // fall back to caption-wide values when there is only one distinct answer
  const wholeNorm = blankDates(0, norm.length);
  const wholeClean = clean.split('').map((c, i) => (wholeNorm[i] === ' ' && norm[i] !== ' ' ? ' ' : c)).join('');
  const globalT = findTimes(wholeNorm, norm);
  const globalLoc = findLocation(wholeClean, wholeNorm, venues);
  const starts = new Set(details.filter(d => d.t.start).map(d => d.t.start + '|' + d.t.end));
  const locs = new Set(details.filter(d => d.loc).map(d => d.loc));
  for (const d of details) {
    if (!d.t.start) {
      if (starts.size === 1) { const [s, e] = [...starts][0].split('|'); d.t = { start: s, end: e, ambiguous: false, spans: [] }; }
      else if (starts.size === 0 && globalT.start) d.t = globalT;
    }
    if (!d.loc) {
      if (locs.size === 1) d.loc = [...locs][0];
      else if (locs.size === 0) d.loc = globalLoc;
    }
  }

  // first usable line as the title
  const lines = [];
  { let pos = 0; for (const ln of norm.split('\n')) { lines.push([pos, pos + ln.length]); pos += ln.length + 1; } }
  let firstLine = '';
  let seen = 0;
  for (const [s, e] of lines) {
    if (!clean.slice(s, e).trim()) continue;
    if (++seen > 3) break;
    const t = lineTitle(clean, norm, s, e, mentions, [...locs, globalLoc].filter(Boolean));
    if (t) { firstLine = t; break; }
  }

  const out = [];
  const seenDates = new Set();
  for (const d of details) {
    for (const it of d.m.items) {
      if (seenDates.has(it.date)) continue;
      seenDates.add(it.date);
      const reasons = [];
      if (it.wd && dowOf(it.date) !== WEEKDAY_NUM[it.wd.slice(0, 3)]) reasons.push('The weekday does not match the date.');
      if (it.swapped) reasons.push('The date was read as month first because the second number is over 12.');
      if (d.t.ambiguous) reasons.push('The time had no am or pm, so it was guessed.');
      let title;
      if (d.type) title = firstLine && firstLine.length <= 60 && typeIn(lower(firstLine)) === d.type ? firstLine : d.type;
      else title = truncateTitle(firstLine) || 'NLB event';
      out.push({
        date: it.date,
        start: d.t.start || '',
        end: d.t.end || '',
        location: d.loc || '',
        title,
        confidence: reasons.length ? 'low' : 'high',
        matched: orig.slice(d.m.s, d.m.e).trim(),
        range: [d.m.s, d.m.e],
        reasons
      });
    }
  }
  return out;
}
