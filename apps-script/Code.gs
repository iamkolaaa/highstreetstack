// High Street Stack enquiry receiver. Deploy as Web app: Execute as me, Access: Anyone.
var SHEET_NAME = 'Enquiries';
var NOTIFY_TO = Session.getEffectiveUser().getEmail();
var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function clip(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }

function validateEnquiry(body, now) {
  now = now || new Date();
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  if (clip(body.website, 10)) return { ok: false, error: 'spam', silent: true };
  var name = clip(body.name, 120);
  var email = clip(body.email, 200);
  if (!name) return { ok: false, error: 'name required' };
  if (!EMAIL.test(email)) return { ok: false, error: 'valid email required' };
  var row = [now.toISOString(), name, clip(body.biz, 200), email, clip(body.phone, 40), clip(body.msg, 2000), clip(body.source, 300)];
  return { ok: true, row };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rateLimited(key) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 3600);
  return n > 5;
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

function doGet() { return json({ ok: true }); }

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad json' }); }
  var v = validateEnquiry(body);
  if (!v.ok) return json(v.silent ? { ok: true } : { ok: false, error: v.error });
  var key = 'k:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, clip(body.email, 200)));
  if (rateLimited(key)) return json({ ok: false, error: 'too many requests' });
  sheet().appendRow(v.row);
  MailApp.sendEmail({
    to: NOTIFY_TO,
    subject: 'New enquiry: ' + v.row[1] + (v.row[2] ? ' (' + v.row[2] + ')' : ''),
    body: 'Name: ' + v.row[1] + '\nBusiness: ' + v.row[2] + '\nEmail: ' + v.row[3] + '\nPhone: ' + v.row[4] + '\n\n' + v.row[5] + '\n\nSource: ' + v.row[6]
  });
  return json({ ok: true });
}
