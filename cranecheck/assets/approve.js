import { api, ApiError, errMsg } from './api.js';
import { chrome, esc, $, fmtDate, fmtShort, fmtDateTime, fmtNum, addDays, loadForms, loading } from './ui.js';

chrome({});
const app = $('#app');
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const KL = { pre: 'Pre-use check', close: 'Closedown' };
const num = v => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v));

const token = (new URLSearchParams(location.hash.replace(/^#/, '')).get('t') || '').trim();
let forms, view;

main();

async function main() {
  if (!token) return fail('This approval link is incomplete. Please use the link from the email in full.');
  try { forms = await loadForms(); } catch (e) { return fail('Could not load the page. Check your signal and reload.'); }
  try { view = await api('approve_view', { token }); }
  catch (e) { return fail(e instanceof ApiError && e.network ? 'No signal. Please try again in a moment.' : errMsg(e)); }
  render();
}

function fail(msg) { app.innerHTML = `<div class="banner bad" role="alert"><strong>Can’t open this timesheet</strong>${esc(msg)}</div><p class="small muted">If you need help phone the Bennetts office on 01453 811754.</p>`; }

const nm = x => (x && typeof x === 'object' ? x.name : x) || '';

function render() {
  const ts = view.ts || {}, we = ts.week_ending, cols = forms.timesheet.columns;
  const days = ts.days || {};
  const sum = f => DAYS.reduce((a, k) => a + num((days[k] || {})[f]), 0);
  const status = view.status || ts.status;
  const open = status === 'submitted';
  const rows = DAYS.map((k, i) => ({ k, i, d: days[k] })).filter(x => x.d && Object.values(x.d).some(v => String(v || '') !== ''));
  const site = view.site && typeof view.site === 'object' ? view.site : { name: view.site };
  app.innerHTML = `
    <h1>Timesheet approval</h1>
    <div class="card hd"><div class="bar">${esc(forms.timesheet.title)} · week ending ${esc(fmtDate(we))}</div><div class="body"><dl class="kv">
      <dt>Driver</dt><dd>${esc(nm(view.driver))}</dd><dt>Site</dt><dd>${esc(nm(site))}</dd>${site.crane ? `<dt>Crane</dt><dd>${esc(site.crane)} (SN ${esc(site.serial)}, PN ${esc(site.pn)})</dd>` : ''}
      <dt>Status</dt><dd>${esc(status)}</dd></dl></div></div>
    <h2>Hours</h2>
    <div class="scroll-x"><table class="t"><thead><tr><th>Day</th><th>${esc(cols[0])}</th><th>${esc(cols[1])}</th><th>${esc(cols[2])}</th><th>${esc(cols[3])}</th><th>${esc(cols[4])}</th><th>${esc(cols[5])}</th></tr></thead><tbody>
      ${rows.map(({ k, i, d }) => `<tr><td>${DN[i].slice(0, 3)}<br><span class="muted small">${esc(fmtShort(addDays(we, i - 6)))}</span></td><td>${esc(d.start)}</td><td>${esc(d.finish)}</td><td>${esc(fmtNum(d.driver_h))}</td><td>${esc(fmtNum(d.crane_h))}</td><td>${esc(fmtNum(d.zoning_h))}</td><td>${esc(d.comment)}</td></tr>`).join('') || '<tr><td colspan="7">No hours entered.</td></tr>'}
      <tr><td><b>Total</b></td><td></td><td></td><td><b>${esc(fmtNum(sum('driver_h')))}</b></td><td><b>${esc(fmtNum(sum('crane_h')))}</b></td><td><b>${esc(fmtNum(sum('zoning_h')))}</b></td><td></td></tr></tbody></table></div>
    ${ts.bonus !== '' && ts.bonus != null ? `<p><b>Bonus:</b> £${esc(ts.bonus)}</p>` : ''}
    ${ts.comment ? `<p><b>Driver’s comments:</b> ${esc(ts.comment)}</p>` : ''}
    <h2 style="margin-top:20px">Crane checks this week</h2>
    ${(view.checks || []).length ? `<div class="card" style="padding:4px 14px">${view.checks.map(c => `<div class="listrow"><div class="meta"><b>${esc(KL[c.kind] || c.kind)}</b> · ${esc(fmtDate(c.date))}</div>${c.defects ? `<span class="chip bad">${c.defects} defect${c.defects > 1 ? 's' : ''}</span>` : '<span class="chip ok">No defects</span>'}${c.pdf_url ? `<a class="btn sm ghost" href="${esc(c.pdf_url)}" target="_blank" rel="noopener">PDF</a>` : ''}</div>`).join('')}</div>` : '<p class="muted">No crane checks were recorded for this week.</p>'}
    <div class="card"><p class="small" style="margin:0">${esc(forms.timesheet.notes[1] || '')}</p></div>
    ${open ? `
    <h2>Your decision</h2>
    <div class="card">
      <div class="field"><label for="nm">Your full name</label><input id="nm" type="text" autocomplete="name"></div>
      <div class="field"><label for="cm">Comment <span class="muted">(required if rejecting)</span></label><textarea id="cm" rows="3"></textarea></div>
      <div id="err"></div>
      <div class="stack"><button type="button" class="btn ok" id="ap">Approve timesheet</button><button type="button" class="btn outline-danger" id="rj">Reject</button></div>
    </div>` : `<div class="banner ${status === 'approved' ? 'ok' : 'info'}"><strong>This timesheet is ${esc(status)}</strong>${ts.approved_by ? `By ${esc(ts.approved_by)}${ts.approved_at ? ' on ' + esc(fmtDateTime(ts.approved_at)) : ''}.` : 'No further action is needed.'}</div>`}`;
  if (open) { $('#ap').addEventListener('click', () => decide('approve')); $('#rj').addEventListener('click', () => decide('reject')); }
}

async function decide(decision) {
  const name = $('#nm').value.trim(), comment = $('#cm').value.trim();
  const err = m => { $('#err').innerHTML = `<div class="banner bad" role="alert">${esc(m)}</div>`; };
  if (!name) { $('#nm').classList.add('invalid'); $('#nm').focus(); return err('Please type your name.'); }
  if (decision === 'reject' && !comment) { $('#cm').classList.add('invalid'); $('#cm').focus(); return err('Please say why you are rejecting it.'); }
  const b1 = $('#ap'), b2 = $('#rj'); b1.disabled = b2.disabled = true;
  (decision === 'approve' ? b1 : b2).textContent = 'Sending…';
  try {
    const r = await api('approve', { token, name, decision, comment });
    app.innerHTML = r.status === 'approved' || decision === 'approve'
      ? `<div class="center"><div class="big-ok" aria-hidden="true">✓</div><h1>Approved</h1><p>Thank you, ${esc(name)}. The signed timesheet is being sent to Bennetts. You can close this page.</p></div>`
      : `<div class="center"><div class="big-ok" style="color:var(--bad)" aria-hidden="true">✗</div><h1>Rejected</h1><p>The driver has been told and will correct and resubmit it. You can close this page.</p></div>`;
    window.scrollTo(0, 0);
  } catch (e) {
    b1.disabled = b2.disabled = false; b1.textContent = 'Approve timesheet'; b2.textContent = 'Reject';
    err(e instanceof ApiError && e.network ? 'No signal. Nothing was sent. Please press the button again.' : errMsg(e));
  }
}
