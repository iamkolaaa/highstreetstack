/* In-browser mock of every CraneCheck API action, backed by localStorage. Demo only. */
import { ApiError } from './api.js';
import { todayLondon, addDays, weekEndingOf, href } from './ui.js';

const KEY = 'cc_mock_db_v1';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
let forms = null;
let db = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => JSON.parse(JSON.stringify(o));
const ymd = d => d.slice(2).replace(/-/g, '');
const rnd = (n, set = ALPHA) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => set[b % set.length]).join('');
const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function getForms() {
  if (!forms) forms = await (await fetch(new URL('../forms.json', import.meta.url))).json();
  return forms;
}

function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

function mkRef(date) { db.seq = (db.seq || 1) + 1; return `CC-${ymd(date)}-${String(1000 + db.seq * 37 % 9000).padStart(4, '0')}`.slice(0, 16); }
const pdfUrl = (ref, extra = '') => new URL(`mock-pdf.html?ref=${encodeURIComponent(ref)}${extra}`, import.meta.url).href;

function seed(f) {
  const today = todayLondon();
  const ds = f.demoSite;
  const d = {
    seq: 1,
    settings: { alert_emails: 'ops@bennetts-demo.example', bennetts_email: f.company.email, pin: '123456' },
    sites: [{ id: 'S1', name: ds.name, address: ds.address, contractor: ds.contractor, crane: ds.crane, serial: ds.serial, pn: ds.pn, manager_name: 'Site Agent (demo)', manager_email: 'agent@kingerlee-demo.example', contact_email: 'siteoffice@kingerlee-demo.example', active: true }],
    drivers: [{ id: 'D1', name: 'Kola Salau', phone: '07700 900123', email: 'kola@example.com', active: true }],
    codes: [{ code: 'DEMO2026', driver_id: 'D1', site_id: 'S1', kind: 'permanent', expires: '', created_at: new Date().toISOString(), revoked: false }],
    submissions: [], timesheets: [], scans: [], photos: {}, tokens: {}
  };
  db = d; // mkRef reads the live db
  const preN = f.inspection.sections[0].items.length, closeN = f.inspection.sections[1].items.length;
  for (let i = 1; i <= 6; i++) {
    const date = addDays(today, -i);
    const wd = new Date(date + 'T00:00:00Z').getUTCDay();
    if (wd === 0 && i > 3) continue;
    for (const kind of ['pre', 'close']) {
      const defects = (kind === 'pre' && i === 3) ? 1 : 0;
      const ref = mkRef(date);
      const received = `${date}T${kind === 'pre' ? '07:' + (10 + i) : '17:' + (20 + i)}:00.000Z`;
      d.submissions.push({ ref, sid: 'seed-' + kind + i, kind, date, week_ending: weekEndingOf(date), received_at: received, site_id: 'S1', driver_id: 'D1', code: 'DEMO2026', defects, status: 'filed', pdf_url: pdfUrl(ref), n: kind === 'pre' ? preN : closeN });
    }
  }
  const prevWE = addDays(weekEndingOf(today), -7);
  const days = {};
  ['mon', 'tue', 'wed', 'thu', 'fri'].forEach(k => { days[k] = { start: '07:30', finish: '17:30', driver_h: 10, crane_h: 10, zoning_h: 0, comment: '' }; });
  d.timesheets.push({ id: 'T1', site_id: 'S1', driver_id: 'D1', week_ending: prevWE, status: 'approved', days, bonus: '', comment: '', operator_name: 'Kola Salau', submitted_at: addDays(prevWE, 1) + 'T09:05:00.000Z', approved_at: addDays(prevWE, 1) + 'T11:40:00.000Z', approved_by: 'Site Agent (demo)', pdf_url: pdfUrl('TS-' + prevWE) });
  return d;
}

async function ensure() {
  const f = await getForms();
  if (db) return f;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db) { db = seed(f); save(); }
  return f;
}

export function resetMock() { try { localStorage.removeItem(KEY); } catch (e) {} db = null; }

const fail = (m, o) => { throw new ApiError(m, o); };
const siteOf = id => db.sites.find(s => s.id === id);
const driverOf = id => db.drivers.find(s => s.id === id);

function codeRow(code) {
  const c = normCode(code);
  const row = db.codes.find(x => x.code === c);
  if (!row || row.revoked) fail('That code is not recognised. Check it and try again.');
  if (row.kind === 'temp' && row.expires && row.expires < todayLondon()) fail('That code has expired. Ask the Bennetts office for a new one.');
  const driver = driverOf(row.driver_id), site = siteOf(row.site_id);
  if (!driver || !site || driver.active === false || site.active === false) fail('That code is no longer active.');
  return { row, driver, site };
}
function tsOf(site_id, driver_id, we) { return db.timesheets.find(t => t.site_id === site_id && t.driver_id === driver_id && t.week_ending === we); }
function tsPublic(t) { return t ? { week_ending: t.week_ending, status: t.status, days: t.days, bonus: t.bonus, comment: t.comment, operator_name: t.operator_name, submitted_at: t.submitted_at, approved_at: t.approved_at, approved_by: t.approved_by, reject_comment: t.reject_comment || '' } : null; }
function checksForWeek(site_id, driver_id, we) {
  const from = addDays(we, -6);
  return db.submissions.filter(s => s.site_id === site_id && s.driver_id === driver_id && s.date >= from && s.date <= we).sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind)).map(s => ({ date: s.date, kind: s.kind, defects: s.defects, pdf_url: s.pdf_url }));
}
function adminAuth(p) { if (String(p.pin) !== String(db.settings.pin)) fail('Wrong PIN.'); }

const H = {
  async resolve(p) {
    const { driver, site } = codeRow(p.code);
    const today = todayLondon(), we = weekEndingOf(today);
    const mine = db.submissions.filter(s => s.site_id === site.id && s.date === today);
    const t = tsOf(site.id, driver.id, we);
    return { ok: true, driver: { id: driver.id, name: driver.name }, site: { id: site.id, name: site.name, address: site.address, contractor: site.contractor, crane: site.crane, serial: site.serial, pn: site.pn, manager_name: site.manager_name }, today, week_ending: we, done: { pre: mine.some(s => s.kind === 'pre'), close: mine.some(s => s.kind === 'close') }, ts_status: t ? t.status : 'none' };
  },

  async upload_photo(p) {
    codeRow(p.code);
    if (!p.b64 || typeof p.b64 !== 'string') fail('No photo data.');
    if (p.b64.length > 1400000) fail('Photo is too large.');
    const id = 'F' + rnd(10);
    return { ok: true, file_id: id, url: 'https://drive.example/' + id };
  },

  async submit_check(p, f) {
    const { row, driver, site } = codeRow(p.code);
    const dup = db.submissions.find(s => s.sid === p.sid);
    if (dup) return { ok: true, ref: dup.ref, pdf_url: dup.pdf_url, defects: dup.defects };
    if (p.kind !== 'pre' && p.kind !== 'close') fail('Unknown check type.');
    const sec = f.inspection.sections.find(s => s.id === p.kind);
    const a = p.answers || {};
    let defects = 0, star = false;
    for (let i = 1; i <= sec.items.length; i++) {
      const x = a[String(i)];
      if (!x || !['ok', 'x', 'na'].includes(x.v)) fail(`Item ${i} has not been answered.`);
      if (x.v === 'x') { defects++; if (!String(x.c || '').trim()) fail(`Item ${i} is a defect and needs a comment.`); }
      if (sec.items[i - 1].startsWith('*')) star = true;
    }
    if (defects && !String((p.defect || {}).text || '').trim()) fail('Describe the defect(s) in the Defects section.');
    if (star && !String(p.banksman || '').trim()) fail('Banksman / supervisor name is required.');
    const dc = p.declaration || {};
    if (!String(dc.name || '').trim()) fail('Type your name to sign.');
    if (p.kind === 'pre' && dc.agreed !== true) fail('The declaration must be agreed.');
    const date = /^\d{4}-\d\d-\d\d$/.test(p.date) ? p.date : todayLondon();
    const ref = mkRef(date);
    const rec = { ref, sid: p.sid, kind: p.kind, date, week_ending: weekEndingOf(date), received_at: new Date().toISOString(), site_id: site.id, driver_id: driver.id, code: row.code, defects, status: 'filed', pdf_url: pdfUrl(ref), payload: { ...p, code: undefined } };
    db.submissions.push(rec); save();
    return { ok: true, ref, pdf_url: rec.pdf_url, defects };
  },

  async history(p) {
    const { site } = codeRow(p.code);
    const items = db.submissions.filter(s => s.site_id === site.id).sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, 30).map(s => ({ ref: s.ref, kind: s.kind, date: s.date, received_at: s.received_at, defects: s.defects, pdf_url: s.pdf_url }));
    return { ok: true, items };
  },

  async timesheet_get(p) {
    const { driver, site } = codeRow(p.code);
    return { ok: true, ts: tsPublic(tsOf(site.id, driver.id, p.week_ending)) };
  },

  async timesheet_save(p) {
    const { driver, site } = codeRow(p.code);
    if (!/^\d{4}-\d\d-\d\d$/.test(p.week_ending) || weekEndingOf(p.week_ending) !== p.week_ending) fail('Week ending must be a Sunday.');
    let t = tsOf(site.id, driver.id, p.week_ending);
    if (t && (t.status === 'submitted' || t.status === 'approved')) fail(`This timesheet is already ${t.status} and cannot be changed.`);
    if (!t) { t = { id: 'T' + rnd(6), site_id: site.id, driver_id: driver.id, week_ending: p.week_ending, status: 'draft' }; db.timesheets.push(t); }
    t.days = p.days || {}; t.bonus = p.bonus || ''; t.comment = p.comment || ''; t.operator_name = p.operator_name || driver.name;
    let demo;
    if (p.submit) {
      if (!String(p.operator_name || '').trim()) fail('Type your name to submit.');
      const token = hex(32);
      t.status = 'submitted'; t.submitted_at = new Date().toISOString(); t.approved_at = ''; t.approved_by = ''; t.reject_comment = '';
      t.pdf_url = pdfUrl('TS-' + t.week_ending);
      db.tokens[token] = { ts_id: t.id, used: false, expires: Date.now() + 14 * 864e5 };
      demo = new URL(href('approve.html') + '#t=' + token, location.href).href;
    } else { t.status = t.status === 'rejected' ? 'draft' : 'draft'; }
    save();
    return { ok: true, status: t.status, ...(demo ? { demo_approve_url: demo } : {}) };
  },

  async approve_view(p) {
    const tk = db.tokens[p.token];
    if (!tk) fail('This approval link is not valid.');
    if (tk.expires < Date.now()) fail('This approval link has expired. Ask the driver to resubmit.');
    const t = db.timesheets.find(x => x.id === tk.ts_id);
    const site = siteOf(t.site_id), driver = driverOf(t.driver_id);
    return { ok: true, site: { id: site.id, name: site.name, address: site.address, contractor: site.contractor, crane: site.crane, serial: site.serial, pn: site.pn, manager_name: site.manager_name }, driver: { id: driver.id, name: driver.name }, ts: tsPublic(t), checks: checksForWeek(site.id, driver.id, t.week_ending), status: t.status };
  },

  async approve(p) {
    const tk = db.tokens[p.token];
    if (!tk) fail('This approval link is not valid.');
    if (tk.used) fail('This link has already been used.');
    if (tk.expires < Date.now()) fail('This approval link has expired.');
    if (!String(p.name || '').trim()) fail('Type your name.');
    const t = db.timesheets.find(x => x.id === tk.ts_id);
    if (t.status !== 'submitted') fail('This timesheet is not waiting for approval.');
    if (p.decision === 'approve') { t.status = 'approved'; t.approved_by = p.name.trim(); t.approved_at = new Date().toISOString(); }
    else if (p.decision === 'reject') { if (!String(p.comment || '').trim()) fail('Say why you are rejecting it.'); t.status = 'rejected'; t.reject_comment = p.comment.trim(); t.approved_by = p.name.trim(); t.approved_at = new Date().toISOString(); }
    else fail('Unknown decision.');
    tk.used = true; save();
    return { ok: true, status: t.status };
  },

  /* ---- admin ---- */
  async admin_data(p) {
    adminAuth(p);
    const { pin, ...settings } = db.settings;
    return { ok: true, sites: clone(db.sites), drivers: clone(db.drivers), codes: clone(db.codes), settings };
  },
  async admin_save_site(p) {
    adminAuth(p);
    const s = p.site || {};
    if (!String(s.name || '').trim()) fail('Site name is required.');
    let row = s.id && siteOf(s.id);
    if (!row) { row = { id: 'S' + rnd(5) }; db.sites.push(row); }
    Object.assign(row, { name: s.name, address: s.address || '', contractor: s.contractor || '', crane: s.crane || '', serial: s.serial || '', pn: s.pn || '', manager_name: s.manager_name || '', manager_email: s.manager_email || '', contact_email: s.contact_email || '', active: s.active !== false });
    save(); return { ok: true, site: clone(row) };
  },
  async admin_save_driver(p) {
    adminAuth(p);
    const d = p.driver || {};
    if (!String(d.name || '').trim()) fail('Driver name is required.');
    let row = d.id && driverOf(d.id);
    if (!row) { row = { id: 'D' + rnd(5) }; db.drivers.push(row); }
    Object.assign(row, { name: d.name, phone: d.phone || '', email: d.email || '', active: d.active !== false });
    save(); return { ok: true, driver: clone(row) };
  },
  async admin_issue_code(p) {
    adminAuth(p);
    if (!driverOf(p.driver_id)) fail('Pick a driver.');
    if (!siteOf(p.site_id)) fail('Pick a site.');
    if (p.kind !== 'permanent' && p.kind !== 'temp') fail('Pick permanent or temporary.');
    if (p.kind === 'temp' && !p.expires) fail('A temporary code needs an expiry date.');
    let code; do { code = rnd(8); } while (db.codes.some(c => c.code === code));
    db.codes.push({ code, driver_id: p.driver_id, site_id: p.site_id, kind: p.kind, expires: p.kind === 'temp' ? p.expires : '', created_at: new Date().toISOString(), revoked: false });
    save(); return { ok: true, code: code.slice(0, 4) + '-' + code.slice(4) };
  },
  async admin_revoke_code(p) {
    adminAuth(p);
    const c = db.codes.find(x => x.code === normCode(p.code));
    if (!c) fail('Code not found.');
    c.revoked = true; save(); return { ok: true };
  },
  async admin_register(p) {
    adminAuth(p);
    const inRange = d => (!p.from || d >= p.from) && (!p.to || d <= p.to);
    const items = [];
    db.submissions.filter(s => (!p.site_id || s.site_id === p.site_id) && inRange(s.date)).forEach(s => items.push({ ref: s.ref, kind: s.kind, date: s.date, received_at: s.received_at, driver: (driverOf(s.driver_id) || {}).name || '', site: (siteOf(s.site_id) || {}).name || '', defects: s.defects, pdf_url: s.pdf_url, status: s.status }));
    db.timesheets.filter(t => t.status !== 'draft' && (!p.site_id || t.site_id === p.site_id) && inRange(t.week_ending)).forEach(t => items.push({ ref: 'TS ' + t.week_ending, kind: 'timesheet', date: t.week_ending, received_at: t.submitted_at || '', driver: (driverOf(t.driver_id) || {}).name || '', site: (siteOf(t.site_id) || {}).name || '', defects: 0, pdf_url: t.pdf_url || '', status: t.status }));
    db.scans.filter(s => (!p.site_id || s.site_id === p.site_id) && inRange(s.month + '-01')).forEach(s => items.push({ ref: s.name, kind: 'scan', date: s.month + '-01', received_at: s.uploaded_at, driver: '', site: (siteOf(s.site_id) || {}).name || '', defects: 0, pdf_url: s.url, status: 'filed' }));
    items.sort((a, b) => (b.received_at || b.date).localeCompare(a.received_at || a.date));
    return { ok: true, items };
  },
  async admin_weekly_pdf(p) {
    adminAuth(p);
    if (!siteOf(p.site_id)) fail('Pick a site.');
    return { ok: true, pdf_url: pdfUrl('WEEK-' + p.week_ending, '&weekly=1') };
  },
  async admin_upload_scan(p) {
    adminAuth(p);
    if (!siteOf(p.site_id)) fail('Pick a site.');
    if (!/^\d{4}-\d\d$/.test(p.month)) fail('Month must be YYYY-MM.');
    if (!p.b64 || p.b64.length > 1400000) fail('File missing or too large (max 1.4 MB).');
    const url = pdfUrl('SCAN-' + p.name, '&scan=1');
    db.scans.push({ id: 'X' + rnd(6), site_id: p.site_id, month: p.month, name: p.name, url, uploaded_at: new Date().toISOString() });
    save(); return { ok: true, url };
  },
  async admin_settings(p) {
    adminAuth(p);
    const s = p.settings || {};
    db.settings.alert_emails = s.alert_emails || ''; db.settings.bennetts_email = s.bennetts_email || '';
    save(); const { pin, ...out } = db.settings; return { ok: true, settings: out };
  },
  async admin_set_pin(p) {
    adminAuth(p);
    if (!/^\d{6,}$/.test(String(p.new_pin || ''))) fail('The new PIN must be at least 6 digits.');
    db.settings.pin = String(p.new_pin); save(); return { ok: true };
  }
};

export async function handle(action, params = {}) {
  let off = false; try { off = localStorage.getItem('cc_mock_offline') === '1'; } catch (e) {}
  if (off) { await sleep(250); throw new ApiError('No signal. Could not reach the server.', { network: true }); }
  const f = await ensure();
  await sleep(120 + Math.random() * 200);
  const fn = H[action];
  if (!fn) fail('Unknown action: ' + action);
  return fn(clone(params), f);
}
