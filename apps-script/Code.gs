// High Street Stack enquiry receiver. Deploy as Web app: Execute as me, Access: Anyone.
var SHEET_NAME = 'Enquiries';
var NOTIFY_TO = Session.getEffectiveUser().getEmail();
var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function clip(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
// A leading = + - @ or tab makes a spreadsheet evaluate the cell as a formula.
function safe(v) { return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
var PER_EMAIL_PER_HOUR = 5;
var GLOBAL_PER_HOUR = 60;

function validateEnquiry(body, now) {
  now = now || new Date();
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  if (clip(body.hss_ref, 10)) return { ok: false, error: 'spam', silent: true };
  var name = clip(body.name, 120);
  var email = clip(body.email, 200);
  if (!name) return { ok: false, error: 'name required' };
  if (!EMAIL.test(email)) return { ok: false, error: 'valid email required' };
  var row = [now.toISOString(), name, clip(body.biz, 200), email, clip(body.phone, 40), clip(body.msg, 2000), clip(body.source, 300)].map(safe);
  return { ok: true, row };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function bump(cache, key) {
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 3600);
  return n;
}

function rateLimited(key) {
  var cache = CacheService.getScriptCache();
  var perEmail = bump(cache, key);
  var global = bump(cache, 'global');
  return perEmail > PER_EMAIL_PER_HOUR || global > GLOBAL_PER_HOUR;
}

function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['Received', 'Name', 'Business', 'Email', 'Phone', 'Message', 'Source']);
  }
  return sh;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'slots') return json({ ok: true, taken: takenSlots() });
  return json({ ok: true });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad json' }); }
  if (body && body.type === 'call') return bookCall(body);
  var v = validateEnquiry(body);
  if (!v.ok) return json(v.silent ? { ok: true } : { ok: false, error: v.error });
  var key = 'k:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, clip(body.email, 200)));
  if (rateLimited(key)) return json({ ok: false, error: 'too many requests' });
  sheet().appendRow(v.row);
  try {
    MailApp.sendEmail({
      to: NOTIFY_TO,
      subject: 'New enquiry: ' + v.row[1] + (v.row[2] ? ' (' + v.row[2] + ')' : ''),
      body: 'Name: ' + v.row[1] + '\nBusiness: ' + v.row[2] + '\nEmail: ' + v.row[3] + '\nPhone: ' + v.row[4] + '\n\n' + v.row[5] + '\n\nSource: ' + v.row[6]
    });
  } catch (mailErr) {
    // Row is saved; quota exhaustion must not turn into a failed enquiry.
    console.error('notification email failed: ' + mailErr);
  }
  return json({ ok: true });
}


// ---------- Call bookings (highstreetstack.com/call/) ----------
// Same rules as lib/slots.js. Times are UK local. Change HOURS here and there together.
var TZ = 'Europe/London';
var CALLS_SHEET = 'Calls';
var SLOT_MIN = 20, LEAD_MIN = 180, DAYS_AHEAD = 14;
var HOURS = { 1: ['09:00', '18:00'], 2: ['09:00', '18:00'], 3: ['09:00', '18:00'], 4: ['09:00', '18:00'], 5: ['09:00', '18:00'], 6: ['10:00', '14:00'] };

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function toMin(hhmm) { var p = hhmm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function toHHMM(m) { return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }
function utcDay(s) { var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)); }
function addDays(s, n) { var t = utcDay(s); t.setUTCDate(t.getUTCDate() + n); return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate()); }
function dayDiff(a, b) { return Math.round((utcDay(b) - utcDay(a)) / 86400000); }
function londonNow(d) {
  var s = Utilities.formatDate(d || new Date(), TZ, 'yyyy-MM-dd HH:mm');
  return { date: s.slice(0, 10), minutes: toMin(s.slice(11)) };
}
function daySlots(date) {
  var h = HOURS[utcDay(date).getUTCDay()];
  if (!h) return [];
  var out = [];
  for (var t = toMin(h[0]); t + SLOT_MIN <= toMin(h[1]); t += SLOT_MIN) out.push(toHHMM(t));
  return out;
}
function openSlots(date, now) {
  var off = dayDiff(now.date, date);
  if (off < 0 || off > DAYS_AHEAD) return [];
  var cutoff = off === 0 ? now.minutes + LEAD_MIN : (off === 1 ? now.minutes + LEAD_MIN - 1440 : -1);
  return daySlots(date).filter(function (t) { return toMin(t) >= cutoff; });
}
function slotStart(date, time) { return Utilities.parseDate(date + ' ' + time, TZ, 'yyyy-MM-dd HH:mm'); }

function callsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CALLS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CALLS_SHEET);
    sh.appendRow(['Booked at', 'Call date', 'Call time', 'Name', 'Business', 'Phone', 'Email', 'About', 'Status']);
    sh.getRange('B:C').setNumberFormat('@');
  }
  return sh;
}

// 'yyyy-MM-dd HH:mm' slots already booked or blocked by an event in Kola's calendar.
function takenSlots() {
  var now = londonNow();
  var taken = {};
  var rows = callsSheet().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][8]).toLowerCase() === 'cancelled') continue;
    var d = rows[i][1] instanceof Date ? Utilities.formatDate(rows[i][1], TZ, 'yyyy-MM-dd') : String(rows[i][1]);
    var t = rows[i][2] instanceof Date ? Utilities.formatDate(rows[i][2], TZ, 'HH:mm') : String(rows[i][2]);
    taken[d + ' ' + t] = 1;
  }
  try {
    var from = slotStart(now.date, '00:00');
    var to = slotStart(addDays(now.date, DAYS_AHEAD + 1), '00:00');
    CalendarApp.getDefaultCalendar().getEvents(from, to).forEach(function (ev) {
      if (ev.isAllDayEvent()) return;
      if (ev.getTransparency && String(ev.getTransparency()) === 'TRANSPARENT') return;
      var s = ev.getStartTime().getTime(), e = ev.getEndTime().getTime();
      for (var k = 0; k <= DAYS_AHEAD; k++) {
        var day = addDays(now.date, k);
        daySlots(day).forEach(function (t) {
          var a = slotStart(day, t).getTime(), b = a + SLOT_MIN * 60000;
          if (a < e && b > s) taken[day + ' ' + t] = 1;
        });
      }
    });
  } catch (err) { console.error('calendar read failed: ' + err); }
  return Object.keys(taken);
}

function validateCall(body, now) {
  if (clip(body.hss_ref, 10)) return { ok: false, error: 'spam', silent: true };
  var c = { name: clip(body.name, 120), phone: clip(body.phone, 40), email: clip(body.email, 200), biz: clip(body.biz, 200), topic: clip(body.topic, 1000), date: clip(body.date, 10), time: clip(body.time, 5) };
  if (!c.name) return { ok: false, error: 'name required' };
  if ((c.phone.match(/\d/g) || []).length < 7) return { ok: false, error: 'valid phone required' };
  if (!EMAIL.test(c.email)) return { ok: false, error: 'valid email required' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date) || !/^\d{2}:\d{2}$/.test(c.time)) return { ok: false, error: 'pick a time' };
  if (openSlots(c.date, now).indexOf(c.time) < 0) return { ok: false, error: 'time not available' };
  return { ok: true, call: c };
}

function prettyWhen(c) {
  return Utilities.formatDate(slotStart(c.date, c.time), TZ, 'EEE d MMM') + ' at ' + c.time;
}

function bookCall(body) {
  var v = validateCall(body, londonNow());
  if (!v.ok) return json(v.silent ? { ok: true } : { ok: false, error: v.error });
  var c = v.call;
  var key = 'c:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, c.email));
  if (rateLimited(key)) return json({ ok: false, error: 'too many requests' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json({ ok: false, error: 'busy, try again' });
  try {
    if (takenSlots().indexOf(c.date + ' ' + c.time) >= 0) return json({ ok: false, error: 'time taken' });
    callsSheet().appendRow([new Date().toISOString(), c.date, c.time, c.name, c.biz, c.phone, c.email, c.topic, 'New'].map(safe));
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  var when = prettyWhen(c);
  var text = 'New call booked: ' + when + ' (20 min)\n' + c.name + (c.biz ? ' (' + c.biz + ')' : '') + '\nPhone: ' + c.phone + '\nEmail: ' + c.email + '\n\n' + c.topic + '\n\nRing them now to confirm.';
  try {
    var start = slotStart(c.date, c.time);
    CalendarApp.getDefaultCalendar().createEvent('Call: ' + c.name + (c.biz ? ' (' + c.biz + ')' : '') + ' ' + c.phone, start, new Date(start.getTime() + SLOT_MIN * 60000), { description: text });
  } catch (err) { console.error('calendar event failed: ' + err); }
  try { MailApp.sendEmail({ to: NOTIFY_TO, subject: 'Call booked: ' + c.name + ', ' + when, body: text }); } catch (err) { console.error('email failed: ' + err); }
  telegram(text);
  return json({ ok: true, when: when });
}

// Optional: set TG_TOKEN and TG_CHAT in Project Settings → Script properties for a Telegram ping.
function telegram(text) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('TG_TOKEN'), chat = p.getProperty('TG_CHAT');
  if (!token || !chat) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'post', payload: { chat_id: chat, text: text }, muteHttpExceptions: true });
  } catch (err) { console.error('telegram failed: ' + err); }
}
