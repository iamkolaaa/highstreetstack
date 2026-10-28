import { api, ApiError, errMsg } from './api.js';
import { session, ls } from './store.js';
import { chrome, esc, $, $$, href, fmtDate, fmtShort, fmtDateTime, fmtNum, addDays, weekEndingOf, todayLondon, loadForms, loading, toast, debounce } from './ui.js';

chrome({ back: 'index.html', backLabel: 'Home' });
const app = $('#app');
const code = session.getCode();
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FIELDS = ['start', 'finish', 'driver_h', 'crane_h', 'zoning_h', 'comment'];
const STATUS = { none: ['Not started', 'na'], draft: ['Draft', 'warn'], submitted: ['Submitted – awaiting approval', 'blue'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'bad'] };

let forms, ctx, we, T, flags, flash = '', offline = false, reviewing = false;
const lsKey = () => `cc_ts_${code}_${we}`;
const locked = () => T.status === 'submitted' || T.status === 'approved';
const emptyDay = () => ({ start: '', finish: '', driver_h: '', crane_h: '', zoning_h: '', comment: '' });

main();

async function main() {
  if (!code) { location.replace(href('index.html')); return; }
  try { forms = await loadForms(); } catch (e) { app.innerHTML = `<div class="banner bad">Could not load the timesheet form. Check your signal and reload.</div>`; return; }
  ctx = session.getCtx() || { driver: { name: '' }, site: { name: '' } };
  we = weekEndingOf(todayLondon());
  await load();
}

function weekOptions() {
  const cur = weekEndingOf(todayLondon());
  return [cur, addDays(cur, -7), addDays(cur, -14)];
}

function calc(start, finish) {
  const m = /^(\d{1,2}):(\d{2})$/, a = m.exec(start || ''), b = m.exec(finish || '');
  if (!a || !b) return '';
  let d = (+b[1] * 60 + +b[2]) - (+a[1] * 60 + +a[2]);
  if (d < 0) d += 1440;
  return Math.round(d / 60 * 100) / 100;
}
const num = v => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));

async function load() {
  app.innerHTML = loading('Loading timesheet…');
  offline = false;
  let server = null;
  try { server = (await api('timesheet_get', { code, week_ending: we })).ts; }
  catch (e) { if (e instanceof ApiError && e.network) offline = true; else { app.innerHTML = `<div class="banner bad">${esc(errMsg(e))}</div><a class="btn" href="${href('index.html')}">Back</a>`; return; } }
  const local = ls.get(lsKey());
  const src = (local && local.dirty && (!server || server.status === 'draft' || server.status === 'rejected')) ? local : server;
  T = { status: server ? server.status : 'none', days: {}, bonus: '', comment: '', operator_name: ctx.driver.name || '', submitted_at: server && server.submitted_at, approved_at: server && server.approved_at, approved_by: server && server.approved_by, reject_comment: server && server.reject_comment };
  if (src) { T.bonus = src.bonus == null ? '' : String(src.bonus); T.comment = src.comment || ''; T.operator_name = src.operator_name || T.operator_name; }
  flags = {};
  DAYS.forEach(k => {
    const s = (src && src.days && src.days[k]) || {};
    const d = emptyDay();
    FIELDS.forEach(f => { d[f] = s[f] == null ? '' : String(s[f]); });
    T.days[k] = d;
    const c = calc(d.start, d.finish);
    flags[k] = { dm: d.driver_h !== '' && c !== '' && Number(d.driver_h) !== c || (d.driver_h !== '' && c === ''), cm: d.crane_h !== '' && Number(d.crane_h) !== Number(d.driver_h) };
  });
  reviewing = false;
  render();
}

function render() {
  const lk = locked(), st = STATUS[T.status] || STATUS.none, dis = lk ? 'disabled' : '';
  const cols = forms.timesheet.columns;
  let meta = '';
  if (T.status === 'submitted') meta = `Sent ${esc(fmtDateTime(T.submitted_at))}. The site agent has been emailed an approval link. This sheet is locked.`;
  else if (T.status === 'approved') meta = `Approved by <b>${esc(T.approved_by)}</b> on ${esc(fmtDateTime(T.approved_at))}. This sheet is locked.`;
  else if (T.status === 'rejected') meta = `Rejected${T.approved_by ? ' by <b>' + esc(T.approved_by) + '</b>' : ''}${T.reject_comment ? ': “' + esc(T.reject_comment) + '”' : ''}. Correct it and submit again.`;
  else if (T.status === 'draft') meta = 'Draft saved on the server. You can carry on from any phone.';
  app.innerHTML = `
    ${flash ? `<div class="banner ok" role="status">${flash}</div>` : ''}
    <h1>${esc(forms.timesheet.title)}</h1>
    <div class="field"><label for="we">Week ending (Sunday)</label>
      <select id="we">${weekOptions().map(w => `<option value="${w}" ${w === we ? 'selected' : ''}>${esc(fmtDate(w))}</option>`).join('')}</select></div>
    <div class="card"><div class="row"><span class="chip ${st[1]}">${esc(st[0])}</span><span class="small muted">${esc(ctx.site.name)} · ${esc(ctx.driver.name)}</span></div>${meta ? `<p class="small" style="margin:8px 0 0">${meta}</p>` : ''}</div>
    ${offline ? '<div class="banner warn"><strong>No signal</strong>Anything you type is kept on this phone. Save to the server when signal returns.</div>' : ''}
    <div class="banner warn"><strong>Deadline: 4pm Monday</strong>${esc(forms.timesheet.deadline)}</div>
    ${DAYS.map((k, i) => dayCard(k, i, cols, dis)).join('')}
    <div class="totals" aria-live="polite"><div><b id="tD">0</b><span>${esc(cols[2])}</span></div><div><b id="tC">0</b><span>${esc(cols[3])}</span></div><div><b id="tZ">0</b><span>${esc(cols[4])}</span></div></div>
    <div class="field"><label for="bonus">${esc(forms.timesheet.bonusLabel)}</label><input id="bonus" type="number" inputmode="decimal" step="0.01" min="0" placeholder="£" value="${esc(T.bonus)}" ${dis}></div>
    <div class="field"><label for="tcomment">Comments for the office (optional)</label><textarea id="tcomment" rows="3" ${dis}>${esc(T.comment)}</textarea></div>
    <div class="card"><h3>Please note</h3><ul class="small" style="padding-left:18px;margin:6px 0 0">${forms.timesheet.notes.map(n => `<li style="margin-bottom:6px">${esc(n)}</li>`).join('')}</ul></div>
    <div id="errHost"></div>
    ${lk ? '' : `<div class="stack"><button type="button" class="btn" id="saveBtn">Save draft</button><button type="button" class="btn primary" id="subBtn">Submit for site agent approval</button></div>`}
    ${lk ? `<a class="btn" href="${href('index.html')}">Back to home</a>` : ''}`;
  totals();
}

function dayCard(k, i, cols, dis) {
  const d = T.days[k], date = addDays(we, i - 6);
  const inp = (f, label, type, extra = '') => `<div class="field"><label for="${k}-${f}">${esc(label)}</label><input id="${k}-${f}" data-d="${k}" data-f="${f}" type="${type}" ${extra} value="${esc(d[f])}" ${dis}></div>`;
  const hrs = (f, label) => inp(f, label, 'number', 'inputmode="decimal" step="0.25" min="0" max="24" placeholder="0"');
  return `<section class="day" aria-label="${DN[i]}"><div class="dh"><span>${DN[i]}</span><span>${esc(fmtShort(date))}</span></div><div class="db">
    <div class="grid2">${inp('start', forms.timesheet.columns[0], 'time')}${inp('finish', forms.timesheet.columns[1], 'time')}</div>
    <div class="grid2">${hrs('driver_h', forms.timesheet.columns[2])}${hrs('crane_h', forms.timesheet.columns[3])}</div>
    ${hrs('zoning_h', forms.timesheet.columns[4])}
    ${inp('comment', forms.timesheet.columns[5], 'text', 'autocomplete="off" placeholder="e.g. breakdown, weather"')}
  </div></section>`;
}

function totals() {
  const sum = f => DAYS.reduce((a, k) => a + num(T.days[k][f]), 0);
  const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = fmtNum(v) || '0'; };
  set('tD', sum('driver_h')); set('tC', sum('crane_h')); set('tZ', sum('zoning_h'));
}

const saveLocal = debounce(() => ls.set(lsKey(), { dirty: true, days: T.days, bonus: T.bonus, comment: T.comment, operator_name: T.operator_name, at: Date.now() }), 250);

app.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.d) {
    const k = t.dataset.d, f = t.dataset.f, d = T.days[k], fl = flags[k];
    d[f] = t.value;
    if (f === 'start' || f === 'finish') {
      const c = calc(d.start, d.finish);
      if (!fl.dm) { d.driver_h = c === '' ? '' : String(c); setVal(k, 'driver_h', d.driver_h); }
      if (!fl.cm) { d.crane_h = d.driver_h; setVal(k, 'crane_h', d.crane_h); }
    } else if (f === 'driver_h') {
      fl.dm = t.value !== '';
      if (!fl.cm) { d.crane_h = d.driver_h; setVal(k, 'crane_h', d.crane_h); }
    } else if (f === 'crane_h') fl.cm = t.value !== '';
    totals(); saveLocal();
  } else if (t.id === 'bonus') { T.bonus = t.value; saveLocal(); }
  else if (t.id === 'tcomment') { T.comment = t.value; saveLocal(); }
});
function setVal(k, f, v) { const el = $(`#${k}-${f}`); if (el) el.value = v; }

app.addEventListener('change', async e => {
  if (e.target.id === 'we') {
    saveLocalNow(); we = e.target.value; flash = ''; await load();
  }
});
function saveLocalNow() { if (T && !locked()) ls.set(lsKey(), { dirty: true, days: T.days, bonus: T.bonus, comment: T.comment, operator_name: T.operator_name, at: Date.now() }); }

app.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'saveBtn') save(false, t);
  else if (t.id === 'subBtn') startSubmit();
  else if (t.id === 'confirmBtn') confirmSubmit(t);
  else if (t.id === 'editBtn') { reviewing = false; render(); window.scrollTo(0, 0); }
});

function cleanDays() {
  const out = {};
  DAYS.forEach(k => {
    const d = T.days[k];
    if (!FIELDS.some(f => String(d[f] || '').trim() !== '')) return;
    out[k] = { start: d.start || '', finish: d.finish || '', driver_h: d.driver_h === '' ? '' : Number(d.driver_h), crane_h: d.crane_h === '' ? '' : Number(d.crane_h), zoning_h: d.zoning_h === '' ? '' : Number(d.zoning_h), comment: String(d.comment || '').trim() };
  });
  return out;
}

async function save(submit, btn) {
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = submit ? 'Submitting…' : 'Saving…'; }
  try {
    const r = await api('timesheet_save', { code, week_ending: we, days: cleanDays(), bonus: T.bonus === '' ? '' : Number(T.bonus), comment: T.comment, operator_name: T.operator_name, submit });
    ls.del(lsKey());
    if (submit) {
      flash = `<strong>Submitted for approval</strong>The site agent has been emailed an approval link. If it has not been approved by 4pm Monday, remind them.${r.demo_approve_url ? `<br><br><span class="small">Demo only: <a href="${esc(r.demo_approve_url)}">open the site agent’s approval page</a></span>` : ''}`;
      await load(); window.scrollTo(0, 0);
    } else {
      toast('Draft saved. You can carry on from any phone.', 'ok');
      T.status = 'draft'; if (btn) { btn.disabled = false; btn.textContent = orig; }
      const chip = $('.card .chip'); if (chip) { chip.className = 'chip warn'; chip.textContent = 'Draft'; }
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
    if (e instanceof ApiError && e.network) {
      saveLocalNow();
      toast(submit ? 'No signal. Submitting needs signal. Your hours are kept on this phone.' : 'No signal. Saved on this phone only; save again when you have signal.', 'bad');
    } else { showErr(errMsg(e)); }
  }
}

function showErr(msg) {
  const host = $('#errHost') || app;
  host.innerHTML = `<div class="banner bad" role="alert" style="margin-top:14px">${esc(msg)}</div>`;
  host.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/* ---------- submit review ---------- */
function problems() {
  let any = false;
  for (const k of DAYS) {
    const d = T.days[k];
    if (!FIELDS.some(f => String(d[f] || '').trim() !== '')) continue;
    if (num(d.driver_h) > 0 || num(d.crane_h) > 0) any = true;
    if (!d.driver_h && !d.start) return `${DN[DAYS.indexOf(k)]}: add start/finish times or driver hours.`;
    if (d.start && !d.finish) return `${DN[DAYS.indexOf(k)]}: add a finish time.`;
    if (d.finish && !d.start) return `${DN[DAYS.indexOf(k)]}: add a start time.`;
    if (num(d.driver_h) > 24 || num(d.crane_h) > 24 || num(d.zoning_h) > 24) return `${DN[DAYS.indexOf(k)]}: hours cannot be more than 24.`;
  }
  return any ? '' : 'Enter hours for at least one day before submitting.';
}

function startSubmit() {
  const p = problems();
  if (p) return showErr(p);
  reviewing = true;
  const cols = forms.timesheet.columns;
  const rows = DAYS.map((k, i) => ({ k, i, d: T.days[k] })).filter(x => FIELDS.some(f => String(x.d[f] || '').trim() !== ''));
  const sum = f => DAYS.reduce((a, k) => a + num(T.days[k][f]), 0);
  app.innerHTML = `
    <h1>Check and submit</h1>
    <p class="muted">Week ending ${esc(fmtDate(we))}. Once submitted you cannot change it unless the site agent rejects it.</p>
    <div class="scroll-x"><table class="t"><thead><tr><th>Day</th><th>${esc(cols[0])}</th><th>${esc(cols[1])}</th><th>${esc(cols[2])}</th><th>${esc(cols[3])}</th><th>${esc(cols[4])}</th><th>${esc(cols[5])}</th></tr></thead><tbody>
    ${rows.map(({ k, i, d }) => `<tr><td>${DN[i].slice(0, 3)}</td><td>${esc(d.start)}</td><td>${esc(d.finish)}</td><td>${esc(fmtNum(d.driver_h))}</td><td>${esc(fmtNum(d.crane_h))}</td><td>${esc(fmtNum(d.zoning_h))}</td><td>${esc(d.comment)}</td></tr>`).join('')}
    <tr><td><b>Total</b></td><td></td><td></td><td><b>${esc(fmtNum(sum('driver_h')))}</b></td><td><b>${esc(fmtNum(sum('crane_h')))}</b></td><td><b>${esc(fmtNum(sum('zoning_h')))}</b></td><td></td></tr></tbody></table></div>
    ${T.bonus !== '' ? `<p><b>Bonus:</b> £${esc(T.bonus)}</p>` : ''}
    ${T.comment ? `<p><b>Comments:</b> ${esc(T.comment)}</p>` : ''}
    <div class="card" style="margin-top:14px">
      <div class="field"><label for="opname">Type your full name</label><input id="opname" type="text" value="${esc(T.operator_name)}" autocomplete="name"></div>
      <label class="tick" id="confirmTick"><input type="checkbox" id="confirmChk"><span>These hours are correct. Send to the site agent for approval.</span></label>
    </div>
    <div id="errHost"></div>
    <div class="stack"><button type="button" class="btn primary" id="confirmBtn">Confirm and submit</button><button type="button" class="btn" id="editBtn">Back to edit</button></div>`;
  $('#opname').addEventListener('input', ev => { T.operator_name = ev.target.value; saveLocal(); });
  $('#confirmChk').addEventListener('change', ev => ev.target.closest('.tick').classList.toggle('on', ev.target.checked));
  window.scrollTo(0, 0);
}

function confirmSubmit(btn) {
  if (!String(T.operator_name || '').trim()) { $('#opname').classList.add('invalid'); return showErr('Type your name to sign.'); }
  if (!$('#confirmChk').checked) { return showErr('Tick the box to confirm the hours are correct.'); }
  save(true, btn);
}
