/* Browser port of the PDF HTML builders in apps-script/Code.gs (inspectionHtml, gridHtml, tickGridHtml,
   defectsHtml, declarationHtml, buildCheckPdf, buildWeeklyPdf, buildTimesheetPdf). Keep the markup identical
   so the demo copy matches what the live system files to Drive. Apps Script-only calls are replaced:
   Utilities.formatDate -> Intl (Europe/London); Drive photo URLs -> thumbnails the demo kept (or plain labels). */

const TZ = 'Europe/London';
const BLUE = '#1f6fb2', GREY = '#d9d9d9', RED_ROW = '#f4b6b6';
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let FORMS = null;
let PHOTOS = {};

/* ---------- pure helpers (same as Code.gs) ---------- */
const pad2 = n => (n < 10 ? '0' : '') + n;
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const isDateStr = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));
function addDays(s, n) {
  if (!isDateStr(s)) return null;
  const t = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + n));
  return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate());
}
function dayKeyOf(s) {
  if (!isDateStr(s)) return null;
  const t = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  return DAY_KEYS[(t.getUTCDay() + 6) % 7];
}
function weekDates(we) { const out = []; for (let i = 0; i < 7; i++) out.push(addDays(we, i - 6)); return out; }
function niceDate(s) {
  if (!isDateStr(s)) return String(s == null ? '' : s);
  return DAY_NAMES[DAY_KEYS.indexOf(dayKeyOf(s))].slice(0, 3) + ' ' + parseInt(s.slice(8, 10), 10) + ' ' + MONTHS[parseInt(s.slice(5, 7), 10) - 1] + ' ' + s.slice(0, 4);
}
function initials(name) {
  const parts = String(name == null ? '' : name).trim().split(/\s+/);
  let out = '';
  for (let i = 0; i < parts.length && out.length < 3; i++) if (parts[i]) out += parts[i].charAt(0).toUpperCase();
  return out;
}
function sumHours(days, field) {
  let t = 0;
  for (const k of DAY_KEYS) { const d = days && days[k]; if (d && typeof d[field] === 'number') t += d[field]; }
  return Math.round(t * 100) / 100;
}
/* Utilities.formatDate(new Date(iso), TZ, 'yyyy-MM-dd HH:mm') */
function fmtLondon(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso || '');
    const p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  } catch (e) { return String(iso || ''); }
}

/* ---------- builders (markup identical to Code.gs) ---------- */
function wordmarkHtml() {
  const c = FORMS.company;
  const addr = c.address.replace(/, /g, ' | ').replace(/,/g, ' |');
  return '<table style="width:100%"><tr>' +
    '<td style="width:36%"><table style="width:160px;border:2px solid #000"><tr><td align="center" style="padding:4px 8px;border:2px solid #000">' +
    '<div style="font-size:22pt;font-weight:bold;letter-spacing:-1px">bennetts</div>' +
    '<div style="font-size:5pt;letter-spacing:0.6px;font-weight:bold">TOWER CRANE PROFESSIONALS</div></td></tr></table></td>' +
    '<td style="font-size:7pt;line-height:1.4"><b>' + esc(c.name) + '</b> | ' + esc(addr) + '<br>Email: ' + esc(c.email) + ' | Tel: ' + esc(c.phone) +
    '<br><b>' + esc(c.web) + '</b></td></tr></table>' +
    '<table style="width:100%;margin-top:6px"><tr><td bgcolor="' + BLUE + '" style="background:' + BLUE + ';height:3px;font-size:2pt;line-height:3px">&nbsp;</td></tr></table>';
}
function footerHtml(formRef, submittedLine) {
  const c = FORMS.company;
  return '<table style="width:100%;margin-top:10px"><tr><td style="font-size:6.5pt;color:#444;line-height:1.5">' +
    'Company registered in England, number: ' + esc(c.companyNo) + ' | Registered address: ' + esc(c.address) + '<br>' +
    esc(formRef) + '<br>' + esc(submittedLine) + '</td><td align="right" style="font-size:7pt;color:#444">' + esc(c.web) + '</td></tr></table>';
}
function barRow(text, span) {
  return '<tr><td colspan="' + span + '" bgcolor="' + BLUE + '" style="background:' + BLUE + ';color:#fff;font-weight:bold;font-size:9pt;padding:4px 6px">' + esc(text) + '</td></tr>';
}
function infoCell(label) {
  return '<td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:3px 5px;border:1px solid #fff;width:17%">' + label + '</td>';
}
function valCell(val, span) {
  return '<td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:3px 5px;border:1px solid #fff"' + (span ? ' colspan="' + span + '"' : '') + '>' + (val || '&nbsp;') + '</td>';
}
function markHtml(v) {
  if (v === 'ok') return '<span style="color:#14732a;font-weight:bold;font-size:10pt">✓</span>';
  if (v === 'x') return '<span style="color:#c00000;font-weight:bold;font-size:10pt">✗</span>';
  if (v === 'na') return '<span style="color:#333;font-size:6pt">N/A</span>';
  return '&nbsp;';
}
/* Live: links to the Drive file. Demo: the link opens the thumbnail the demo kept, if any (click handled in mock-pdf.html). */
function photoLinks(ids) {
  return (ids || []).map((id, i) => '<a href="#photo-' + esc(id) + '"' + (PHOTOS[id] ? ' data-photo="' + esc(id) + '"' : '') + '>photo ' + (i + 1) + '</a>').join(' ');
}
function sigImg(decl) {
  if (!decl) return '';
  const b64 = decl.sig || '';
  return b64 && b64.length < 150000 ? '<img src="data:image/png;base64,' + b64 + '" height="24">' : '';
}

function gridHtml(section, kind, cols, multi) {
  const n = cols.length;
  /* Browser only: a fixed-layout table takes its widths from the first row, which here has a colspan, so state them up front. */
  const cg = '<colgroup><col style="width:4%"><col>' + cols.map(() => '<col style="width:' + (multi ? '5' : '14') + '%">').join('') + '<col style="width:' + (multi ? '22' : '30') + '%"></colgroup>';
  let h = '<table style="width:100%;margin-top:6px;table-layout:fixed">' + cg;
  h += '<tr><td colspan="2" bgcolor="' + BLUE + '" style="background:' + BLUE + ';color:#fff;font-weight:bold;font-size:9pt;padding:4px 6px">' + esc(section.title) + '</td>';
  cols.forEach(c => {
    h += '<td align="center" bgcolor="' + BLUE + '" style="background:' + BLUE + ';color:#fff;font-weight:bold;font-size:' + (multi ? '8' : '7') + 'pt;width:' + (multi ? '5' : '14') + '%">' + esc(c.letter) +
      (c.sub ? '<br><span style="font-size:5.5pt;font-weight:normal">' + esc(c.sub) + '</span>' : '') + '</td>';
  });
  h += '<td bgcolor="' + BLUE + '" style="background:' + BLUE + ';color:#fff;font-weight:bold;font-size:9pt;padding:4px 6px;width:' + (multi ? '22' : '30') + '%">Comments</td></tr>';
  section.items.forEach((raw, i) => {
    const star = raw.charAt(0) === '*', label = star ? raw.slice(1).trim() : raw, key = String(i + 1);
    const ans = c => c[kind] && c[kind].answers && c[kind].answers[key];
    const defect = cols.some(c => { const a = ans(c); return a && a.v === 'x'; });
    const bg = defect ? RED_ROW : GREY;
    const notes = [];
    cols.forEach(c => {
      const a = ans(c);
      if (a && (a.c || (a.photos && a.photos.length))) {
        notes.push((multi ? '<b>' + esc(c.letter + (c.sub ? ' ' + c.sub : '')) + ':</b> ' : '') + esc(a.c || '') + (a.photos && a.photos.length ? ' ' + photoLinks(a.photos) : ''));
      }
    });
    const td = 'bgcolor="' + bg + '" style="background:' + bg + ';border-bottom:1px solid #8a8a8a;padding:2px 4px;';
    h += '<tr><td ' + td + 'width:4%;font-size:7pt" align="center">' + (i + 1) + '</td>' +
      '<td ' + td + 'font-size:7.5pt;' + (star ? 'color:#8b1a1a;' : '') + (defect ? 'font-weight:bold;' : '') + '">' + esc(label) + (star ? '*' : '') + '</td>';
    cols.forEach(c => { const a = ans(c); h += '<td ' + td + '" align="center">' + markHtml(a ? a.v : '') + '</td>'; });
    h += '<td ' + td + 'font-size:6.5pt">' + (notes.join('<br>') || '&nbsp;') + '</td></tr>';
  });
  h += '<tr><td colspan="2" align="right" style="font-size:6pt;padding:2px 4px">Operator initials</td>';
  cols.forEach(c => {
    const p = c[kind];
    h += '<td align="center" style="font-size:6.5pt;border-bottom:1px solid #8a8a8a">' + (p && p.declaration ? esc(initials(p.declaration.name)) : '&nbsp;') + '</td>';
  });
  h += '<td>&nbsp;</td></tr></table>';
  return h;
}

function tickGridHtml(title, labels, field, cols) {
  const n = cols.length;
  let h = '<table style="width:100%;margin-top:6px;table-layout:fixed">' +
    '<tr><td bgcolor="' + BLUE + '" style="background:' + BLUE + ';color:#fff;font-weight:bold;font-size:9pt;padding:4px 6px">' + esc(title) + '</td>';
  cols.forEach(c => {
    h += '<td align="center" bgcolor="' + BLUE + '" style="background:' + BLUE + ';color:#fff;font-weight:bold;font-size:7pt;width:' + (n > 1 ? '5' : '14') + '%">' + esc(c.letter) + '</td>';
  });
  h += '</tr>';
  labels.forEach(raw => {
    const star = raw.charAt(0) === '*', label = star ? raw.slice(1).trim() : raw;
    h += '<tr><td bgcolor="' + GREY + '" style="background:' + GREY + ';border-bottom:1px solid #8a8a8a;padding:1px 4px;font-size:7pt;' + (star ? 'color:#8b1a1a;' : '') + '">' + esc(label) + (star ? '*' : '') + '</td>';
    cols.forEach(c => {
      const on = c.pre && c.pre[field] && c.pre[field].indexOf(raw) >= 0;
      h += '<td align="center" bgcolor="' + GREY + '" style="background:' + GREY + ';border-bottom:1px solid #8a8a8a">' + (on ? markHtml('ok') : '&nbsp;') + '</td>';
    });
    h += '</tr>';
  });
  return h + '</table>';
}

function defectsHtml(cols) {
  let h = '<table style="width:100%;margin-top:6px">' + barRow('Defects', 4) +
    '<tr><td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px;width:9%">Day</td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px;width:16%">Items flagged</td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px">Defect</td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px">Action taken</td></tr>';
  let any = false;
  cols.forEach(c => {
    const flagged = [], texts = [], acts = [];
    ['pre', 'close'].forEach(k => {
      const p = c[k];
      if (!p) return;
      const nums = Object.keys(p.answers || {}).filter(q => p.answers[q].v === 'x');
      if (nums.length) flagged.push((k === 'pre' ? 'Pre-use ' : 'Closedown ') + nums.join(', '));
      if (p.defect && p.defect.text) texts.push(esc(p.defect.text) + (p.defect.photos && p.defect.photos.length ? ' ' + photoLinks(p.defect.photos) : ''));
      if (p.defect && p.defect.action) acts.push(p.defect.action);
    });
    if (!flagged.length && !texts.length && !acts.length) return;
    any = true;
    h += '<tr><td bgcolor="' + RED_ROW + '" style="background:' + RED_ROW + ';padding:2px 4px;border-bottom:1px solid #8a8a8a">' + esc(c.letter + (c.sub ? ' ' + c.sub : '')) + '</td>' +
      '<td bgcolor="' + RED_ROW + '" style="background:' + RED_ROW + ';padding:2px 4px;border-bottom:1px solid #8a8a8a;font-size:7pt">' + esc(flagged.join(' / ')) + '</td>' +
      '<td bgcolor="' + RED_ROW + '" style="background:' + RED_ROW + ';padding:2px 4px;border-bottom:1px solid #8a8a8a;font-size:7pt">' + texts.join(' / ') + '</td>' +
      '<td bgcolor="' + RED_ROW + '" style="background:' + RED_ROW + ';padding:2px 4px;border-bottom:1px solid #8a8a8a;font-size:7pt">' + esc(acts.join(' / ')) + '</td></tr>';
  });
  if (!any) h += '<tr><td colspan="4" bgcolor="' + GREY + '" style="background:' + GREY + ';padding:3px 5px">No defects reported.</td></tr>';
  return h + '</table>';
}

function declarationHtml(cols, site, approvalHtml) {
  let h = '<table style="width:100%;margin-top:6px">' + barRow('Declaration', 5) +
    '<tr><td colspan="5" style="font-size:6.5pt;padding:3px 0">' + esc(FORMS.inspection.declaration) + '</td></tr>' +
    '<tr><td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px;width:9%">Day</td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px">Operator (print name)</td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px;width:16%">Signature</td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px">Crane Supervisor / Banksman</td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';font-weight:bold;padding:2px 4px;width:14%">Date</td></tr>';
  cols.forEach(c => {
    const names = [], banks = [];
    let sig = '';
    ['pre', 'close'].forEach(k => {
      const p = c[k];
      if (!p) return;
      if (p.declaration && p.declaration.name && names.indexOf(p.declaration.name) < 0) names.push(p.declaration.name);
      if (p.banksman && banks.indexOf(p.banksman) < 0) banks.push(p.banksman);
      if (!sig && p.declaration) sig = sigImg(p.declaration);
    });
    if (!names.length && !banks.length) return;
    h += '<tr><td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:2px 4px;border-bottom:1px solid #8a8a8a">' + esc(c.letter) + '</td>' +
      '<td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:2px 4px;border-bottom:1px solid #8a8a8a">' + esc(names.join(' / ')) + '</td>' +
      '<td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:2px 4px;border-bottom:1px solid #8a8a8a">' + (sig || '&nbsp;') + '</td>' +
      '<td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:2px 4px;border-bottom:1px solid #8a8a8a">' + esc(banks.join(' / ')) + '</td>' +
      '<td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:2px 4px;border-bottom:1px solid #8a8a8a">' + esc(c.date) + '</td></tr>';
  });
  h += '<tr><td colspan="2" bgcolor="' + GREY + '" style="background:' + GREY + ';padding:5px;font-weight:bold">Site Manager approval</td>' +
    '<td colspan="3" bgcolor="' + GREY + '" style="background:' + GREY + ';padding:5px">' + (approvalHtml || ('Print name: ' + esc(site.manager_name || '') + ' &nbsp;&nbsp; Signature / date: ____________________')) + '</td></tr>';
  return h + '</table>';
}

function inspectionHtml(o) {
  const site = o.site;
  let h = wordmarkHtml() +
    '<div style="font-size:15pt;margin:10px 0 2px 0;letter-spacing:0.3px">' + esc(o.title.toUpperCase()) + '</div>' +
    (o.subtitle ? '<div style="font-size:9pt;font-weight:bold;margin-bottom:4px">' + esc(o.subtitle) + '</div>' : '') +
    '<table style="width:100%;margin-top:4px">' +
    '<tr>' + infoCell('Operator Name') + valCell(esc(o.operators), 1) + infoCell('Week Ending') + valCell(esc(o.weekEnd), 1) + '</tr>' +
    '<tr>' + infoCell('Site Address') + valCell(esc(site.contractor + ' ' + site.address).trim() + (site.name ? ' (' + esc(site.name) + ')' : ''), 3) + '</tr>' +
    '<tr>' + infoCell('Crane Make &amp; Model') + valCell(esc(site.crane)) + infoCell('Crane SN.') + valCell(esc(site.serial)) + '</tr>' +
    '<tr>' + infoCell('Contractor') + valCell(esc(site.contractor)) + infoCell('Crane PN') + valCell(esc(site.pn)) + '</tr></table>' +
    '<div style="font-size:6.5pt;margin:4px 0">✓ ' + esc(FORMS.inspection.legend) + ' <span style="color:#8b1a1a">' + esc(FORMS.inspection.supervisorNote) + '</span></div>';
  const secs = FORMS.inspection.sections;
  if (o.showPre) h += gridHtml(secs[0], 'pre', o.cols, o.multi);
  if (o.showPre) h += tickGridHtml('Lubrication Points  * Only to be ticked if checked / lubricated', FORMS.inspection.lubrication, 'lube', o.cols);
  if (o.showPre) h += tickGridHtml('Required by the Operator  * Please tick if required', FORMS.inspection.required, 'required', o.cols);
  if (o.showClose) h += gridHtml(secs[1], 'close', o.cols, o.multi);
  h += defectsHtml(o.cols) + declarationHtml(o.cols, site, o.approvalHtml);
  h += footerHtml(FORMS.inspection.title + ' ' + FORMS.inspection.ref, o.footerLine);
  return h;
}

function tsCell(v, align) {
  return '<td align="' + (align || 'center') + '" bgcolor="' + GREY + '" style="background:' + GREY + ';border:1px solid #fff;padding:4px;height:20px">' + (v === '' || v == null ? '&nbsp;' : esc(v)) + '</td>';
}
function timesheetInner(t, payload, site, driver, approval) {
  const we = t.week_ending, dates = weekDates(we), days = payload.days || {};
  let h = wordmarkHtml() + '<div style="font-size:15pt;margin:10px 0 4px 0;letter-spacing:0.3px">' + esc(FORMS.timesheet.title.toUpperCase()) + '</div>' +
    '<table style="width:100%">' +
    '<tr>' + infoCell('Name') + valCell(esc(payload.operator_name || driver.name)) + infoCell('Week Ending') + valCell(esc(we)) + '</tr>' +
    '<tr>' + infoCell('Crane Make / Model') + valCell(esc(site.crane)) + infoCell('Serial No.') + valCell(esc(site.serial)) + '</tr>' +
    '<tr>' + infoCell('Contractor') + valCell(esc(site.contractor)) + infoCell('Site Address') + valCell(esc(site.name || site.address)) + '</tr></table>' +
    '<div style="font-size:7pt;text-align:center;margin:3px 0">' + esc(FORMS.timesheet.deadline) + '</div>' +
    '<table style="width:100%;table-layout:fixed"><tr><td bgcolor="' + BLUE + '" style="background:' + BLUE + ';width:16%">&nbsp;</td>';
  FORMS.timesheet.columns.forEach((c, i) => {
    h += '<td align="center" bgcolor="' + BLUE + '" style="background:' + BLUE + ';color:#fff;font-weight:bold;font-size:7pt;padding:4px;' + (i === 5 ? 'width:30%' : '') + '">' + esc(c) + '</td>';
  });
  h += '</tr>';
  DAY_NAMES.forEach((dn, i) => {
    const d = days[DAY_KEYS[i]] || {};
    h += '<tr><td bgcolor="' + GREY + '" style="background:' + GREY + ';border:1px solid #fff;padding:4px;font-size:7.5pt">' + esc(dn) + '<br><span style="font-size:6pt">' + esc(dates[i]) + '</span></td>' +
      tsCell(d.start) + tsCell(d.finish) + tsCell(d.driver_h) + tsCell(d.crane_h) + tsCell(d.zoning_h) + tsCell(d.comment, 'left') + '</tr>';
  });
  h += '<tr><td bgcolor="' + GREY + '" style="background:' + GREY + ';border:1px solid #fff;padding:4px;font-weight:bold">TOTAL</td>' + tsCell('') + tsCell('') +
    tsCell(sumHours(days, 'driver_h')) + tsCell(sumHours(days, 'crane_h')) + tsCell(sumHours(days, 'zoning_h')) + tsCell('') + '</tr></table>';
  h += '<table style="width:100%;margin-top:6px">' +
    '<tr><td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:5px;border:1px solid #fff;width:62%"><b>' + esc(FORMS.timesheet.bonusLabel) + '</b></td>' +
    tsCell(payload.bonus === '' || payload.bonus == null ? '' : '£' + payload.bonus, 'left') + '</tr></table>';
  h += '<table style="width:100%;margin-top:2px">' +
    '<tr><td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:6px;border:1px solid #fff;width:20%"><b>Site Agent\'s Signature</b></td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:6px;border:1px solid #fff">' + (approval ? 'Approved by <b>' + esc(approval.name) + '</b> at ' + esc(fmtLondon(approval.at)) : '&nbsp;') + '</td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:6px;border:1px solid #fff;width:12%"><b>Print Name</b></td>' +
    '<td bgcolor="' + GREY + '" style="background:' + GREY + ';padding:6px;border:1px solid #fff;width:22%">' + (approval ? esc(approval.name) : esc(site.manager_name || '')) + '&nbsp;</td></tr>' +
    '<tr><td colspan="4" bgcolor="' + GREY + '" style="background:' + GREY + ';padding:6px;border:1px solid #fff;height:36px;vertical-align:top">Any comments by Site Agent:- ' +
    esc((approval && approval.comment) || '') + '</td></tr></table>';
  h += '<table style="width:100%;margin-top:6px"><tr><td style="font-size:7pt;line-height:1.5">' +
    FORMS.timesheet.notes.map((n, i) => (i + 1) + '. ' + esc(n)).join('<br>') + '</td></tr></table>';
  if (payload.comment) h += '<div style="font-size:7pt;margin-top:6px"><b>Driver note:</b> ' + esc(payload.comment) + '</div>';
  h += footerHtml(FORMS.timesheet.title + ' ' + FORMS.timesheet.ref, 'Submitted digitally ' + fmtLondon(t.submitted_at || new Date().toISOString()) + ' · ' + t.id);
  return h;
}

/* ---------- demo glue: find the record, build the document ---------- */

/* Seeded demo rows carry no answers; fill in a plausible record so the sheet is not blank. */
function synthPayload(sub, driver, site) {
  const sec = FORMS.inspection.sections.find(s => s.id === sub.kind);
  const answers = {};
  sec.items.forEach((_, i) => { answers[String(i + 1)] = { v: 'ok', c: '', photos: [] }; });
  const p = { kind: sub.kind, date: sub.date, answers, banksman: 'Site Agent (demo)', declaration: { name: driver.name, agreed: true } };
  if (sub.defects > 0) {
    answers['4'] = { v: 'x', c: 'Loose bolt on ladder (demo entry)', photos: [] };
    p.defect = { text: 'Loose bolt on ladder (demo entry)', action: 'Taped off, Bennetts phoned' };
  }
  if (sub.kind === 'pre') { p.lube = []; p.required = []; }
  return p;
}
const payloadOf = (sub, driver, site) => sub.payload && sub.payload.answers ? sub.payload : synthPayload(sub, driver, site);
function latestSub(subs, date, kind) {
  let best = null;
  subs.forEach(s => { if (s.date === date && s.kind === kind && (!best || s.received_at > best.received_at)) best = s; });
  return best;
}

/* db = the mock's localStorage object; q = URLSearchParams; returns { title, html } or null if not found. */
export function buildDocument(db, forms, q, photos) {
  FORMS = forms; PHOTOS = photos || {};
  const ref = q.get('ref') || '';
  const siteOf = id => (db.sites || []).find(s => s.id === id);
  const driverOf = id => (db.drivers || []).find(s => s.id === id) || { name: '' };

  if (q.get('scan')) {
    const s = (db.scans || []).find(x => 'SCAN-' + x.name === ref || x.name === ref.replace(/^SCAN-/, ''));
    if (!s) return null;
    const site = siteOf(s.site_id) || {};
    return { title: 'Scanned paper copy', html: scanInner(s, site) };
  }

  if (q.get('weekly') || ref.startsWith('WEEK-')) {
    const we = q.get('we') || ref.replace(/^WEEK-/, '');
    if (!isDateStr(we)) return null;
    let site = siteOf(q.get('site'));
    const forWeek = db.submissions.filter(s => s.week_ending === we);
    if (!site && forWeek.length) site = siteOf(forWeek[0].site_id);
    if (!site) return null;
    const subs = forWeek.filter(s => s.site_id === site.id);
    if (!subs.length) return null;
    const cols = weekDates(we).map((d, i) => {
      const pre = latestSub(subs, d, 'pre'), close = latestSub(subs, d, 'close');
      return { letter: 'MTWTFSS'.charAt(i), sub: d.slice(8), date: d, pre: pre ? payloadOf(pre, driverOf(pre.driver_id), site) : null, close: close ? payloadOf(close, driverOf(close.driver_id), site) : null };
    });
    const names = [], refs = [];
    let latest = '';
    subs.forEach(s => { const d = driverOf(s.driver_id); if (d.name && names.indexOf(d.name) < 0) names.push(d.name); refs.push(s.ref); if (s.received_at > latest) latest = s.received_at; });
    let ts = null;
    (db.timesheets || []).forEach(t => { if (t.site_id === site.id && t.week_ending === we && t.status === 'approved' && (!ts || t.approved_at > ts.approved_at)) ts = t; });
    const approval = ts ? 'Approved by <b>' + esc(ts.approved_by) + '</b> at ' + esc(fmtLondon(ts.approved_at)) + (site.manager_name ? ' (' + esc(site.manager_name) + ')' : '') : '';
    return {
      title: 'Weekly Inspection WE ' + we,
      html: inspectionHtml({
        site, title: FORMS.inspection.title, subtitle: 'Weekly sheet', weekEnd: we, operators: names.join(', '),
        cols, showPre: true, showClose: true, multi: true, approvalHtml: approval,
        footerLine: 'Submitted digitally ' + fmtLondon(latest) + ' · ' + refs.slice(0, 14).join(', ') + (refs.length > 14 ? ' +' + (refs.length - 14) : '')
      })
    };
  }

  if (ref.startsWith('TS-') || q.get('ts')) {
    const we = ref.replace(/^TS-/, '');
    const t = (db.timesheets || []).find(x => x.id === q.get('ts')) || (db.timesheets || []).find(x => x.week_ending === we && x.status !== 'draft') || (db.timesheets || []).find(x => x.week_ending === we);
    if (!t) return null;
    const site = siteOf(t.site_id), driver = driverOf(t.driver_id);
    if (!site) return null;
    const approval = t.status === 'approved' ? { name: t.approved_by, at: t.approved_at, comment: '' } : null;
    return { title: 'Timesheet WE ' + t.week_ending + ' ' + driver.name, html: timesheetInner(t, t, site, driver, approval) };
  }

  const sub = (db.submissions || []).find(s => s.ref === ref);
  if (!sub) return null;
  const site = siteOf(sub.site_id), driver = driverOf(sub.driver_id);
  if (!site) return null;
  const payload = payloadOf(sub, driver, site);
  const col = { letter: niceDate(sub.date), sub: '', date: sub.date, pre: null, close: null };
  col[sub.kind] = payload;
  return {
    title: (sub.kind === 'pre' ? 'Pre-use ' : 'Closedown ') + sub.date + ' ' + driver.name,
    html: inspectionHtml({
      site, title: FORMS.inspection.title, subtitle: (sub.kind === 'pre' ? 'Daily Pre-Use Checks' : 'Daily Closedown Procedures') + ' – ' + niceDate(sub.date),
      weekEnd: sub.week_ending, operators: driver.name, cols: [col], showPre: sub.kind === 'pre', showClose: sub.kind === 'close', multi: false,
      approvalHtml: '', footerLine: 'Submitted digitally ' + fmtLondon(sub.received_at) + ' · ' + sub.ref
    })
  };
}

/* The live system files the uploaded scan itself; the demo does not keep the file, so show its filing details. */
function scanInner(s, site) {
  return wordmarkHtml() +
    '<div style="font-size:15pt;margin:10px 0 4px 0;letter-spacing:0.3px">SCANNED PAPER COPY</div>' +
    '<table style="width:100%">' +
    '<tr>' + infoCell('File name') + valCell(esc(s.name)) + infoCell('Month') + valCell(esc(s.month)) + '</tr>' +
    '<tr>' + infoCell('Site') + valCell(esc(site.name || '')) + infoCell('Uploaded') + valCell(esc(fmtLondon(s.uploaded_at))) + '</tr></table>' +
    '<div style="font-size:8pt;margin:14px 0;padding:14px;border:1px dashed #8a8a8a;text-align:center;color:#444">In the live system the scanned file itself is filed here, in the site\'s month folder on Google Drive. The demo only keeps the filing details.</div>' +
    footerHtml('Scanned paper copy', 'Filed ' + fmtLondon(s.uploaded_at));
}

/* Same body rules as pageHtml() in Code.gs, scoped to the page wrapper. */
export const DOC_CSS = '.pdfdoc{font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#111}' +
  '.pdfdoc table{border-collapse:collapse;width:100%}.pdfdoc td,.pdfdoc th{vertical-align:middle;font-size:8pt}.pdfdoc a{color:' + BLUE + '}';
