/* Crane supervisor: bi-weekly lifting accessories inspection. Demo only, stored in this browser.
   The form is the Delta Tower Cranes Lifting Accessories Register, used as an example until Bennetts' own sheet is loaded. */
import { resizeToB64, dataUrl } from './photo.js';
import { createSigPad } from './sig.js';
import { chrome, esc, $, $$, href, fmtDate, fmtDateTime, todayLondon, addDays, debounce, toast } from './ui.js';

chrome(window.top === window ? { back: 'tour.html', backLabel: 'Demo' } : {});

const app = $('#app');
const KEY = 'ccdemo_sup_v1', DKEY = 'ccdemo_sup_draft';
const EVERY = 14;
const TYPES = ['4 Leg Chains', '2 Leg Chains', 'Single Leg Chain Sling', 'Crane Forks', 'Safety Net (1.5 x 1.5 x 1.6m)', 'Boat or Muck Skip', 'Other'];
const ROLES = ['Crane Supervisor', 'Lifting Supervisor', 'Appointed Person', 'Slinger / Signaller'];
const DECL = 'I have visually inspected the above accessories in accordance with LOLER regulations 1998.';
const COND = { good: ['Good', 'ok'], fair: ['Fair – requires monitoring', 'warn'], poor: ['Poor – quarantined / do not use', 'bad'] };
const MAX_PHOTOS = 2;

const trim = v => String(v == null ? '' : v).trim();
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');

/* ---------- demo data ---------- */
function seed() {
  const t = todayLondon();
  const reg = (id, type, desc, serial, swl, dueIn) => ({ id, type, desc, serial, swl, retest: addDays(t, dueIn), test: addDays(t, dueIn - 182) });
  const register = [
    reg('LA-01', '4 Leg Chains', '4 leg chain sling, 7 mm grade 8, 2 m', 'DTC-4L-0412', '3.15 t', 13),
    reg('LA-02', '2 Leg Chains', '2 leg chain sling, 8 mm grade 8, 2 m', 'DTC-2L-0388', '2.8 t', 13),
    reg('LA-03', 'Single Leg Chain Sling', '10 mm grade 8, 2 m', 'DTC-1L-0201', '3.15 t', 13),
    reg('LA-04', 'Crane Forks', 'Pallet forks, auto-levelling', 'CF-1150', '1.5 t', -9),
    reg('LA-05', 'Safety Net (1.5 x 1.5 x 1.6m)', 'Pallet safety net', 'SN-0772', '1.0 t', 96),
    reg('LA-06', 'Boat or Muck Skip', '1 m³ roll-over muck skip', 'MS-0931', '1.0 t', 140)
  ];
  const past = (ago, fair) => {
    const date = addDays(t, -ago);
    const items = register.map(r => ({ id: r.id, cond: fair && r.id === 'LA-05' ? 'fair' : 'good', c: fair && r.id === 'LA-05' ? 'Small tear in one corner of the net. Monitor at next check.' : '', photos: [], quar: false }));
    return { ref: `LA-${date.slice(2).replace(/-/g, '')}-${rnd(4)}`, date, received_at: `${date}T08:${20 + ago}:00.000Z`, name: 'Sam Taylor', role: 'Crane Supervisor', items, extra: [], flags: fair ? 1 : 0, sig: '', next_due: addDays(date, EVERY) };
  };
  return {
    v: 1,
    site: { name: 'Example site, Oxford', contractor: 'Main contractor (example)', form: 'Delta Tower Cranes · Lifting Accessories Register' },
    register,
    inspections: [past(14, true), past(28, false)]
  };
}
let db = ls.get(KEY);
if (!db || db.v !== 1) { db = seed(); ls.set(KEY, db); }
const saveDb = () => { if (!ls.set(KEY, db)) toast('This browser is out of storage space. Remove some photos.', 'bad'); };

function examStatus(retest, on = todayLondon()) {
  const d = daysBetween(on, retest);
  if (d < 0) return ['Exam overdue', 'bad', d];
  if (d <= 30) return [`Re-test in ${d} day${d === 1 ? '' : 's'}`, 'warn', d];
  return ['In date', 'ok', d];
}
const lastInspection = () => db.inspections.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
const nextDue = () => { const l = lastInspection(); return l ? addDays(l.date, EVERY) : todayLondon(); };
const demoNote = () => `<div class="demo-note"><b>Demo · example form.</b> This uses the Delta Tower Cranes lifting accessories register from a previous site, to show how a supervisor's bi-weekly equipment check would work. Bennetts' own supervisor sheet would replace it. Nothing here is sent anywhere.</div>`;

/* ---------- routing ---------- */
window.addEventListener('hashchange', route);
route();

function route() {
  const h = location.hash.slice(1);
  if (h.startsWith('r=')) return report(decodeURIComponent(h.slice(2)));
  if (h.startsWith('done=')) return done(decodeURIComponent(h.slice(5)));
  if (h === 'new') return wizard();
  home();
}

/* ---------- home ---------- */
function home() {
  const due = nextDue(), t = todayLondon(), dd = daysBetween(t, due);
  const dueChip = dd < 0 ? `<span class="chip bad">Overdue by ${-dd} day${dd === -1 ? '' : 's'}</span>` : dd === 0 ? '<span class="chip warn">Due today</span>' : `<span class="chip ok">Due in ${dd} days</span>`;
  const draft = ls.get(DKEY);
  const list = db.inspections.slice().sort((a, b) => b.received_at.localeCompare(a.received_at));
  app.innerHTML = `
    ${demoNote()}
    <section class="card hd" aria-label="Supervisor">
      <div class="bar">Crane supervisor · bi-weekly equipment check</div>
      <div class="body">
        <dl class="kv">
          <dt>Site</dt><dd>${esc(db.site.name)}</dd>
          <dt>Form</dt><dd>${esc(db.site.form)}</dd>
          <dt>How often</dt><dd>Every 2 weeks</dd>
          <dt>Next due</dt><dd>${esc(fmtDate(due))} ${dueChip}</dd>
        </dl>
      </div>
    </section>
    <nav class="stack" aria-label="Actions">
      <a class="btn big primary" href="#new"><span>${draft ? 'Carry on with inspection' : 'Start inspection'}<span class="sub">${db.register.length} accessories on the register, one at a time</span></span><span aria-hidden="true">&#8594;</span></a>
    </nav>
    <h2 style="margin-top:22px">Register</h2>
    <div class="card" style="padding:4px 14px">${db.register.map(r => { const s = examStatus(r.retest); return `
      <div class="listrow"><div class="meta"><b>${esc(r.id)} · ${esc(r.type)}</b><small>${esc(r.desc)} · SN ${esc(r.serial)} · SWL ${esc(r.swl)}</small><small>Thorough exam due ${esc(fmtDate(r.retest))}</small></div><span class="chip ${s[1]}">${esc(s[0])}</span></div>`; }).join('')}</div>
    <h2 style="margin-top:22px">Past inspections</h2>
    <div class="card" style="padding:4px 14px">${list.map(x => `
      <div class="listrow"><div class="meta"><b>${esc(fmtDate(x.date))}</b><small>${esc(x.name)} · ${esc(x.role)} · ${esc(x.ref)}</small></div>
      ${x.flags ? `<span class="chip warn">${x.flags} flagged</span>` : '<span class="chip ok">All good</span>'}
      <a class="btn sm ghost" href="#r=${esc(encodeURIComponent(x.ref))}">Report</a></div>`).join('') || '<p class="muted">None yet.</p>'}</div>
    <p class="center" style="margin-top:20px"><button class="btn ghost sm" id="reset" type="button">Reset demo</button></p>`;
  $('#reset').onclick = () => { if (!confirm('Put the supervisor demo back to its example data?')) return; ls.del(KEY); ls.del(DKEY); db = seed(); saveDb(); home(); };
  window.scrollTo(0, 0);
}

/* ---------- wizard ---------- */
let S, steps, pad = null;
const persistNow = () => { if (S) ls.set(DKEY, S); };
const persist = debounce(persistNow, 300);
window.addEventListener('pagehide', persistNow);

function fresh() {
  return { v: 1, step: 0, date: todayLondon(), name: '', role: ROLES[0], items: {}, extra: [], agreed: false, sig: '', returnReview: false };
}
function wizard() {
  S = ls.get(DKEY);
  if (!S || S.v !== 1) S = fresh();
  steps = [{ id: 'details' }, ...db.register.map(r => ({ id: 'item', r })), { id: 'extra' }, { id: 'sign' }, { id: 'review' }];
  if (S.step >= steps.length) S.step = 0;
  render();
}
const ans = id => (S.items[id] = S.items[id] || { cond: '', c: '', photos: [], quar: false });
const overdue = r => examStatus(r.retest, S.date)[2] < 0;
function goStep(i) { S.step = Math.max(0, Math.min(steps.length - 1, i)); if (steps[S.step].id === 'review') S.returnReview = false; persistNow(); render(); window.scrollTo(0, 0); }

function validate(i) {
  const st = steps[i];
  if (st.id === 'details') {
    if (!S.date) return ['#f-date', 'Pick the inspection date.'];
    if (!trim(S.name)) return ['#f-name', 'Type your name.'];
  }
  if (st.id === 'item') {
    const a = ans(st.r.id);
    if (!a.cond) return ['.seg', 'Pick the condition: Good, Fair or Poor.'];
    if (a.cond !== 'good' && !trim(a.c)) return ['#f-c', 'Say what you found in the comment box.'];
    if (a.cond === 'poor' && !a.quar) return ['#f-quar', 'Confirm it has been taken out of use and tagged.'];
  }
  if (st.id === 'extra') {
    for (let k = 0; k < S.extra.length; k++) {
      const x = S.extra[k];
      if (!trim(x.serial)) return [`#x-serial-${k}`, `Extra item ${k + 1}: add the serial number.`];
      if (!x.cond) return [`#x-seg-${k}`, `Extra item ${k + 1}: pick the condition.`];
      if (x.cond !== 'good' && !trim(x.c)) return [`#x-c-${k}`, `Extra item ${k + 1}: say what you found.`];
    }
  }
  if (st.id === 'sign') {
    if (!S.agreed) return ['#f-agree', 'Tick the box to confirm the declaration.'];
    if (!S.sig) return ['.sigwrap', 'Sign in the box with your finger.'];
  }
  return null;
}
function showMsg(v) {
  const el = $('#msg'); el.textContent = v[1]; el.classList.remove('hide');
  const t = $(v[0]); if (t) { t.classList.add('invalid'); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}

function render() {
  pad = null;
  const st = steps[S.step], total = steps.length;
  const pct = Math.round((S.step / (total - 1)) * 100);
  const isReview = st.id === 'review', rr = S.returnReview && !isReview;
  const nextLabel = isReview ? 'Submit inspection' : rr ? 'Done' : S.step === 0 ? 'Start' : S.step === total - 2 ? 'Review' : 'Next';
  app.innerHTML = `
    <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    <div class="prog-lbl"><span>Lifting accessories inspection</span><span>Step ${S.step + 1} of ${total}</span></div>
    <div id="body">${body(st)}</div>
    <div id="msg" class="banner bad hide" role="alert"></div>
    <div class="navbar">
      <button class="btn back" id="prev" type="button">${S.step === 0 ? 'Cancel' : rr ? 'Review' : 'Back'}</button>
      <button class="btn ${isReview ? 'ok' : 'primary'}" id="next" type="button">${nextLabel}</button>
    </div>`;
  wire(st);
  $('#prev').onclick = () => { if (S.step === 0) { persistNow(); location.hash = ''; return; } if (rr) return goStep(steps.length - 1); goStep(S.step - 1); };
  $('#next').onclick = () => {
    if (isReview) return submit();
    const v = validate(S.step); if (v) return showMsg(v);
    goStep(rr ? steps.length - 1 : S.step + 1);
  };
}

function condSeg(cur, idAttr = '', lockGood = false) {
  return `<div class="seg v" role="group" aria-label="Condition" ${idAttr}>
    ${Object.entries({ good: ['&#10003; Good', ''], fair: ['Fair', 'monitor'], poor: ['&#10007; Poor', 'quarantine'] }).map(([v, [l, s]]) => `<button type="button" data-v="${v}" class="${cur === v ? 'on' : ''}" aria-pressed="${cur === v}" ${lockGood && v !== 'poor' ? 'disabled' : ''}>${l}${s ? `<small>${s}</small>` : ''}</button>`).join('')}</div>`;
}
function photoRow(list, key) {
  return `<div class="photos">${list.map((b, i) => `<div class="ph"><img src="${dataUrl(b)}" alt="Photo ${i + 1}"><button type="button" data-rm="${key}:${i}" aria-label="Remove photo">&times;</button></div>`).join('')}
    ${list.length < MAX_PHOTOS ? `<label class="addph"><input type="file" accept="image/*" capture="environment" class="sr" data-add="${key}">&#128247; Add photo</label>` : ''}</div>`;
}

function body(st) {
  if (st.id === 'details') return `
    ${demoNote()}
    <div class="card hd"><div class="bar">Details</div><div class="body">
      <dl class="kv" style="margin-bottom:14px"><dt>Site</dt><dd>${esc(db.site.name)}</dd><dt>Accessories</dt><dd>${db.register.length} on the register</dd></dl>
      <p class="small muted">Submit one entry per lifting accessory inspected. Anything not on the register can be added at the end.</p>
      <div class="field"><label for="f-date">Inspection date</label><input type="date" id="f-date" value="${esc(S.date)}" max="${todayLondon()}"></div>
      <div class="field"><label for="f-name">Inspected by (print name)</label><input type="text" id="f-name" autocomplete="name" value="${esc(S.name)}"></div>
      <div class="field"><label for="f-role">Role</label><select id="f-role">${ROLES.map(r => `<option${r === S.role ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
    </div></div>`;
  if (st.id === 'item') {
    const r = st.r, a = ans(r.id), ex = examStatus(r.retest, S.date), od = ex[2] < 0;
    if (od && a.cond !== 'poor') { a.cond = 'poor'; if (!trim(a.c)) a.c = `Thorough examination out of date (was due ${fmtDate(r.retest)}).`; }
    return `
    <div class="item s-${a.cond || 'none'}">
      <div class="t"><span class="n">${S.step}</span><span class="lab">${esc(r.type)}<span class="badge" style="background:var(--blue-d)">${esc(r.id)}</span></span></div>
      <dl class="kv" style="margin-bottom:12px">
        <dt>Description</dt><dd>${esc(r.desc)}</dd>
        <dt>Serial no.</dt><dd>${esc(r.serial)}</dd>
        <dt>SWL</dt><dd>${esc(r.swl)}</dd>
        <dt>Test date</dt><dd>${esc(fmtDate(r.test))}</dd>
        <dt>Re-test date</dt><dd>${esc(fmtDate(r.retest))} <span class="chip ${ex[1]}">${esc(ex[0])}</span></dd>
      </dl>
      ${od ? `<div class="banner bad"><strong>Thorough examination out of date</strong>This accessory must not be used. Take it out of use, tag it as quarantined and tell the Bennetts office. Submitting this sends a quarantine alert.</div>` : ''}
      <label class="lbl">Condition</label>
      ${condSeg(a.cond, '', od)}
      <div class="field cmt"><label for="f-c">Comments${a.cond && a.cond !== 'good' ? ' (required)' : ' (optional)'}</label><textarea id="f-c" placeholder="What did you find?">${esc(a.c)}</textarea></div>
      ${a.cond === 'poor' ? `<label class="tick ${a.quar ? 'on' : ''}" id="f-quar"><input type="checkbox" id="quar" ${a.quar ? 'checked' : ''}><span>Taken out of use and tagged as quarantined</span></label>` : ''}
      ${photoRow(a.photos, 'i:' + r.id)}
    </div>`;
  }
  if (st.id === 'extra') return `
    <div class="card hd"><div class="bar">Anything else in use?</div><div class="body">
      <p class="muted small">Add any lifting accessory in use on site that isn’t on the register above. Leave this empty if there’s nothing.</p>
      ${S.extra.map((x, k) => `
        <div class="item s-${x.cond || 'none'}" style="margin-top:10px">
          <div class="t"><span class="n">+${k + 1}</span><span class="lab">Extra accessory</span><button type="button" class="btn sm ghost" data-xdel="${k}" style="min-height:40px">Remove</button></div>
          <div class="field"><label for="x-type-${k}">Accessory</label><select id="x-type-${k}" data-x="${k}:type">${TYPES.map(t => `<option${t === x.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
          ${x.type === 'Other' ? `<div class="field"><label for="x-desc-${k}">Describe it</label><input type="text" id="x-desc-${k}" data-x="${k}:desc" value="${esc(x.desc)}"></div>` : ''}
          <div class="grid2"><div class="field"><label for="x-serial-${k}">Serial number</label><input type="text" id="x-serial-${k}" data-x="${k}:serial" value="${esc(x.serial)}"></div>
          <div class="field"><label for="x-swl-${k}">SWL</label><input type="text" id="x-swl-${k}" data-x="${k}:swl" value="${esc(x.swl)}" placeholder="e.g. 2 t"></div></div>
          <label class="lbl">Condition</label>${condSeg(x.cond, `id="x-seg-${k}" data-xseg="${k}"`)}
          <div class="field cmt"><label for="x-c-${k}">Comments</label><textarea id="x-c-${k}" data-x="${k}:c">${esc(x.c)}</textarea></div>
        </div>`).join('')}
      <button type="button" class="btn ghost" id="xadd" style="margin-top:12px">+ Add an accessory</button>
    </div></div>`;
  if (st.id === 'sign') return `
    <div class="card hd"><div class="bar">Declaration</div><div class="body">
      <div class="decl">${esc(DECL)}</div>
      <label class="tick ${S.agreed ? 'on' : ''}" id="f-agree"><input type="checkbox" id="agree" ${S.agreed ? 'checked' : ''}><span>I agree</span></label>
      <div class="field"><label>Signed by</label><input type="text" value="${esc(S.name)} · ${esc(S.role)}" disabled></div>
      <label class="lbl">Signature</label>
      <div class="sigwrap"><canvas id="sig" aria-label="Signature pad"></canvas><span class="x"></span></div>
      <p class="row" style="justify-content:space-between"><span class="hint">Sign with your finger.</span><button type="button" class="btn sm ghost" id="sigclr">Clear</button></p>
    </div></div>`;
  /* review */
  const rows = db.register.map((r, i) => {
    const a = ans(r.id), c = COND[a.cond] || ['Not answered', 'na'];
    return `<div class="rv-row"><span class="no">${i + 1}</span><span class="tx"><b>${esc(r.type)}</b> · ${esc(r.serial)}${a.c ? `<em style="color:var(--muted)">${esc(a.c)}</em>` : ''}${a.photos.length ? `<em style="color:var(--muted)">${a.photos.length} photo${a.photos.length > 1 ? 's' : ''}</em>` : ''}</span><span class="chip ${c[1]}">${esc(c[0].split(' –')[0])}</span><button type="button" class="btn sm ghost" data-edit="${i + 1}" style="min-height:40px">Edit</button></div>`;
  }).join('');
  const flags = countFlags(), poor = countPoor();
  return `
    <h1>Check and submit</h1>
    ${poor ? `<div class="banner bad"><strong>${poor} item${poor > 1 ? 's' : ''} quarantined</strong>Submitting sends a quarantine alert to the Bennetts office and the site manager.</div>` : flags ? `<div class="banner warn"><strong>${flags} item${flags > 1 ? 's' : ''} to monitor</strong>These are flagged on the report.</div>` : '<div class="banner ok"><strong>All accessories in good condition</strong></div>'}
    <div class="rv-head"><span>Details</span><button type="button" class="btn" data-edit="0">Edit</button></div>
    <div class="rv-body"><div class="rv-row"><span class="tx">${esc(fmtDate(S.date))} · ${esc(S.name)} · ${esc(S.role)}</span></div></div>
    <div class="rv-head"><span>Register (${db.register.length})</span></div><div class="rv-body">${rows}</div>
    <div class="rv-head"><span>Extra accessories (${S.extra.length})</span><button type="button" class="btn" data-edit="${steps.length - 3}">Edit</button></div>
    <div class="rv-body">${S.extra.length ? S.extra.map((x, k) => `<div class="rv-row"><span class="no">+${k + 1}</span><span class="tx"><b>${esc(x.type === 'Other' ? x.desc || 'Other' : x.type)}</b> · ${esc(x.serial)}${x.c ? `<em style="color:var(--muted)">${esc(x.c)}</em>` : ''}</span><span class="chip ${(COND[x.cond] || ['', 'na'])[1]}">${esc((COND[x.cond] || ['–'])[0].split(' –')[0])}</span></div>`).join('') : '<div class="rv-row"><span class="tx muted">None added</span></div>'}</div>
    <div class="rv-head"><span>Declaration</span><button type="button" class="btn" data-edit="${steps.length - 2}">Edit</button></div>
    <div class="rv-body"><div class="rv-row"><span class="tx">${S.agreed ? '&#10003; Agreed' : 'Not agreed'} · ${S.sig ? 'Signed' : 'Not signed'}</span></div></div>`;
}
const allAnswers = () => db.register.map(r => ans(r.id)).concat(S.extra);
const countFlags = () => allAnswers().filter(a => a.cond === 'fair' || a.cond === 'poor').length;
const countPoor = () => allAnswers().filter(a => a.cond === 'poor').length;

function wire(st) {
  const clearErr = e => { e.target.classList.remove('invalid'); $('#msg').classList.add('hide'); };
  $$('input,textarea,select', app).forEach(el => el.addEventListener('input', clearErr));
  if (st.id === 'details') {
    $('#f-date').oninput = e => { S.date = e.target.value; persist(); };
    $('#f-name').oninput = e => { S.name = e.target.value; persist(); };
    $('#f-role').onchange = e => { S.role = e.target.value; persist(); };
  }
  if (st.id === 'item') {
    const a = ans(st.r.id);
    $$('.seg button', app).forEach(b => b.onclick = () => { a.cond = b.dataset.v; if (a.cond !== 'poor') a.quar = false; persistNow(); keep(() => render()); });
    $('#f-c').oninput = e => { a.c = e.target.value; persist(); };
    const q = $('#quar'); if (q) q.onchange = () => { a.quar = q.checked; $('#f-quar').classList.toggle('on', q.checked); $('#f-quar').classList.remove('invalid'); persistNow(); };
  }
  if (st.id === 'extra') {
    $('#xadd').onclick = () => { S.extra.push({ type: TYPES[0], desc: '', serial: '', swl: '', cond: '', c: '' }); persistNow(); render(); };
    $$('[data-xdel]', app).forEach(b => b.onclick = () => { S.extra.splice(+b.dataset.xdel, 1); persistNow(); render(); });
    $$('[data-x]', app).forEach(el => {
      const [k, f] = el.dataset.x.split(':');
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { S.extra[+k][f] = el.value; persist(); if (f === 'type') { persistNow(); keep(() => render()); } });
    });
    $$('[data-xseg]', app).forEach(g => $$('button', g).forEach(b => b.onclick = () => { S.extra[+g.dataset.xseg].cond = b.dataset.v; persistNow(); keep(() => render()); }));
  }
  if (st.id === 'sign') {
    const ag = $('#agree'); ag.onchange = () => { S.agreed = ag.checked; $('#f-agree').classList.toggle('on', ag.checked); $('#f-agree').classList.remove('invalid'); persistNow(); };
    pad = createSigPad($('#sig'), { onChange: png => { S.sig = png; $('.sigwrap').classList.remove('invalid'); persistNow(); } });
    if (S.sig) pad.load(S.sig);
    $('#sigclr').onclick = () => pad.clear();
  }
  if (st.id === 'review') $$('[data-edit]', app).forEach(b => b.onclick = () => { S.returnReview = true; goStep(+b.dataset.edit); });
  $$('[data-add]', app).forEach(inp => inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    try {
      const b64 = await resizeToB64(f, 800, 0.6);
      const id = inp.dataset.add.split(':')[1];
      ans(id).photos.push(b64); persistNow(); keep(() => render());
    } catch (e) { toast('Could not read that photo.', 'bad'); }
  });
  $$('[data-rm]', app).forEach(b => b.onclick = () => { const [, id, i] = b.dataset.rm.split(':'); ans(id).photos.splice(+i, 1); persistNow(); keep(() => render()); });
}
/* re-render without jumping the page */
function keep(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

function submit() {
  const v = steps.slice(0, -1).map((_, i) => [i, validate(i)]).find(x => x[1]);
  if (v) { S.returnReview = true; goStep(v[0]); setTimeout(() => showMsg(v[1]), 50); return; }
  const b = $('#next'); b.disabled = true; b.textContent = 'Sending…';
  const ref = `LA-${S.date.slice(2).replace(/-/g, '')}-${rnd(4)}`;
  const rec = {
    ref, date: S.date, received_at: new Date().toISOString(), name: trim(S.name), role: S.role,
    items: db.register.map(r => ({ id: r.id, ...ans(r.id), overdue: overdue(r) })),
    extra: S.extra.map(x => ({ ...x })), flags: countFlags(), poor: countPoor(), sig: S.sig, next_due: addDays(S.date, EVERY)
  };
  db.inspections.push(rec);
  if (!ls.set(KEY, db)) { rec.items.forEach(i => { i.photos = []; }); saveDb(); toast('Saved without photos: this browser is out of space.', 'bad'); }
  ls.del(DKEY); S = null;
  setTimeout(() => { location.hash = 'done=' + encodeURIComponent(ref); }, 400);
}

/* ---------- done ---------- */
function done(ref) {
  const x = db.inspections.find(i => i.ref === ref); if (!x) return home();
  const d = new Date(x.date + 'T00:00:00Z'), mon = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  const path = `CraneCheck – Bennetts / ${db.site.name} / ${x.date.slice(0, 4)} / ${x.date.slice(5, 7)} ${mon} / Lifting accessories ${x.date}.pdf`;
  app.innerHTML = `
    <div class="center"><div class="big-ok" aria-hidden="true">&#10003;</div><h1>Inspection sent</h1><div class="ref">${esc(x.ref)}</div><p class="muted small">Received ${esc(fmtDateTime(x.received_at))}</p></div>
    <div class="card"><h3>What happened</h3>
      <div class="listrow"><div class="meta"><b>PDF filed in Google Drive</b><small>${esc(path)}</small></div><span class="chip ok">Filed</span></div>
      <div class="listrow"><div class="meta"><b>Copy emailed to the Bennetts office</b><small>With the PDF attached</small></div><span class="chip ok">Sent</span></div>
      ${x.poor ? `<div class="listrow"><div class="meta"><b>Quarantine alert</b><small>${x.poor} item${x.poor > 1 ? 's' : ''} out of use. The office and site manager are told straight away, with photos.</small></div><span class="chip bad">Alert sent</span></div>` : ''}
      <div class="listrow"><div class="meta"><b>Next inspection</b><small>${esc(fmtDate(x.next_due))} (2 weeks). A reminder goes out the day before.</small></div><span class="chip blue">Booked</span></div>
      <p class="hint">Demo: nothing is really sent or filed.</p>
    </div>
    <div class="stack"><a class="btn primary" href="#r=${esc(encodeURIComponent(x.ref))}">View the report</a><a class="btn ghost" href="#">Back to supervisor home</a></div>`;
  window.scrollTo(0, 0);
}

/* ---------- printable report ---------- */
function report(ref) {
  const x = db.inspections.find(i => i.ref === ref);
  if (!x) { app.innerHTML = '<div class="banner warn"><strong>Not found</strong>That inspection isn’t in this demo any more.</div><a class="btn ghost" href="#">Back</a>'; return; }
  const reg = id => db.register.find(r => r.id === id) || {};
  const cc = c => COND[c] || ['–', 'na'];
  const cell = (c, t) => `<td style="${c === 'poor' ? 'color:#b00000;font-weight:600' : c === 'fair' ? 'color:#8a5a00;font-weight:600' : ''}">${t}</td>`;
  app.innerHTML = `
    <div class="row no-print" style="margin-bottom:12px"><a class="btn sm ghost" href="#">&#8592; Back</a><span class="grow"></span><button class="btn sm primary" type="button" id="pr">Print / Save as PDF</button></div>
    ${demoNote()}
    <article class="rep">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2 style="margin:0">Lifting Accessories Register</h2><p class="muted small" style="margin:4px 0 0">Bi-weekly inspection by the crane supervisor · example form: ${esc(db.site.form)}</p></div><span class="wm" style="transform:scale(.8);transform-origin:top right"><span class="wm-name">bennetts</span><span class="wm-sub">TOWER CRANE PROFESSIONALS</span></span></div>
      <dl class="kv" style="margin:14px 0">
        <dt>Site</dt><dd>${esc(db.site.name)}</dd>
        <dt>Inspection date</dt><dd>${esc(fmtDate(x.date))}</dd>
        <dt>Inspected by</dt><dd>${esc(x.name)} · ${esc(x.role)}</dd>
        <dt>Reference</dt><dd>${esc(x.ref)} · received ${esc(fmtDateTime(x.received_at))}</dd>
        <dt>Next due</dt><dd>${esc(fmtDate(x.next_due))}</dd>
      </dl>
      <div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Accessory</th><th>Serial</th><th>SWL</th><th>Re-test</th><th>Condition</th><th>Comments</th></tr></thead><tbody>
      ${x.items.map((a, i) => { const r = reg(a.id); return `<tr><td>${i + 1}</td><td>${esc(r.type)}<br><span class="small muted">${esc(r.desc)}</span></td><td>${esc(r.serial)}</td><td>${esc(r.swl)}</td><td${a.overdue ? ' style="color:#b00000;font-weight:600"' : ''}>${esc(fmtDate(r.retest))}${a.overdue ? '<br>OVERDUE' : ''}</td>${cell(a.cond, esc(cc(a.cond)[0]))}<td>${esc(a.c)}${a.quar ? '<br><b>Quarantined</b>' : ''}</td></tr>`; }).join('')}
      ${x.extra.map((a, k) => `<tr><td>+${k + 1}</td><td>${esc(a.type === 'Other' ? a.desc || 'Other' : a.type)}<br><span class="small muted">Not on register</span></td><td>${esc(a.serial)}</td><td>${esc(a.swl)}</td><td>–</td>${cell(a.cond, esc(cc(a.cond)[0]))}<td>${esc(a.c)}</td></tr>`).join('')}
      </tbody></table></div>
      ${x.items.some(a => a.photos && a.photos.length) ? `<h3 style="margin-top:16px">Photos</h3><div class="photos">${x.items.flatMap(a => (a.photos || []).map(p => `<figure style="margin:0"><img src="${dataUrl(p)}" alt="" style="width:150px;height:150px;object-fit:cover;border:2px solid var(--ink);border-radius:8px"><figcaption class="small">${esc(reg(a.id).type)}</figcaption></figure>`)).join('')}</div>` : ''}
      <h3 style="margin-top:16px">Declaration</h3>
      <p class="small">${esc(DECL)}</p>
      ${x.sig ? `<img class="sigimg" src="data:image/png;base64,${x.sig}" alt="Signature">` : `<p class="small muted">Signed electronically by ${esc(x.name)}</p>`}
      <p class="small">${esc(x.name)} · ${esc(x.role)} · ${esc(fmtDateTime(x.received_at))}</p>
    </article>`;
  $('#pr').onclick = () => window.print();
  window.scrollTo(0, 0);
}
