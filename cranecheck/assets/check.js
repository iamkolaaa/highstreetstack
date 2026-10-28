import { api, ApiError, errMsg } from './api.js';
import { session, drafts, photos, enqueue, sendAndWait, doneFlags, initAutoDrain } from './store.js';
import { resizeToB64, dataUrl } from './photo.js';
import { createSigPad } from './sig.js';
import { chrome, esc, $, $$, href, fmtDate, loadForms, uuid, todayLondon, weekEndingOf, debounce, loading, toast } from './ui.js';

chrome({ back: 'index.html', backLabel: 'Home' });

const app = $('#app');
const params = new URLSearchParams(location.search);
const kind = params.get('kind') === 'close' ? 'close' : 'pre';
const code = session.getCode();
const date = todayLondon();
const MAX_PHOTOS = 4;
const OFFICE = '01453 811754';
const WARN_TEXT = 'Any issues with the crane are to be phoned through to the Bennetts office on 01453 811754. The crane should not be reset until instructed by Bennetts.';

let forms, ctx, sec, items = [], steps = [], S, pad = null;

const trim = v => String(v == null ? '' : v).trim();
const persistNow = () => { if (S && !S.submitted) drafts.save(kind, code, date, S); };
const persist = debounce(persistNow, 300);
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) persistNow(); });

main();

async function main() {
  if (!code) { location.replace(href('index.html')); return; }
  try { forms = await loadForms(); } catch (e) { return fatal('Could not load the check sheet. Check your signal and reload.'); }
  ctx = session.getCtx();
  if (!ctx || ctx.code !== code) {
    try { const r = await api('resolve', { code }); ctx = { ...r, code }; session.setCtx(ctx); }
    catch (e) { return fatal(e instanceof ApiError && e.network ? 'No signal and nothing saved on this phone yet. Open the home page once with signal first.' : errMsg(e)); }
  }
  initAutoDrain();
  sec = forms.inspection.sections.find(s => s.id === kind);
  items = sec.items.map((raw, i) => ({ n: i + 1, raw, label: raw.replace(/^\*/, ''), sup: raw.startsWith('*') }));
  buildSteps();

  const saved = drafts.load(kind, code, date);
  S = saved && saved.v === 1 && !saved.submitted ? saved : freshState();
  if (S.step >= steps.length) S.step = 0;
  if (params.get('jump') === 'defect') {
    S.fault = true;
    S.step = steps.findIndex(s => s.id === 'defects');
    onEnter();
  }
  render();
}

function fatal(msg) {
  app.innerHTML = `<div class="banner bad"><strong>Can’t open the check</strong>${esc(msg)}</div><a class="btn primary" href="${href('index.html')}">Back to home</a>`;
}

function freshState() {
  return { v: 1, sid: uuid(), step: 0, answers: {}, banksman: '', lube: [], required: [], defectText: '', defectAction: '', defectAuto: '', defectPhotos: [], name: ctx.driver.name, agreed: false, sig: '', returnReview: false, fault: false, submitted: false };
}

/* ---------- steps ---------- */
function pageSizes(n) {
  const pages = Math.max(1, Math.ceil(n / 6)), base = Math.floor(n / pages), extra = n % pages;
  return Array.from({ length: pages }, (_, i) => base + (i < extra ? 1 : 0));
}
function buildSteps() {
  steps = [{ id: 'details' }];
  let off = 0;
  pageSizes(items.length).forEach(sz => { steps.push({ id: 'items', from: off, to: off + sz }); off += sz; });
  if (items.some(i => i.sup)) steps.push({ id: 'banksman' });
  if (kind === 'pre') { steps.push({ id: 'lube' }); steps.push({ id: 'required' }); }
  steps.push({ id: 'defects' });
  steps.push({ id: 'sign' });
  steps.push({ id: 'review' });
}
const stepIdx = id => steps.findIndex(s => s.id === id);
const defectItems = () => items.filter(i => (S.answers[i.n] || {}).v === 'x');

function defectSummary() {
  return defectItems().map(i => `${i.n}. ${i.label}: ${trim((S.answers[i.n] || {}).c)}`).join('\n');
}
function onEnter() {
  const st = steps[S.step];
  if (st.id === 'defects') {
    const auto = defectSummary();
    if (!trim(S.defectText) || S.defectText === S.defectAuto) S.defectText = auto;
    S.defectAuto = auto;
  }
  if (st.id === 'review') S.returnReview = false;
}
function goStep(i) {
  S.step = Math.max(0, Math.min(steps.length - 1, i));
  onEnter(); persistNow(); render(); window.scrollTo(0, 0);
}

/* ---------- validation ---------- */
function validateStep(i, ui) {
  const st = steps[i];
  if (st.id === 'items') {
    const pg = items.slice(st.from, st.to);
    const miss = pg.filter(it => !(S.answers[it.n] && S.answers[it.n].v));
    const noc = pg.filter(it => (S.answers[it.n] || {}).v === 'x' && !trim(S.answers[it.n].c));
    if (ui) {
      $$('.item').forEach(el => el.classList.remove('missing'));
      miss.concat(noc).forEach(it => { const el = $('#item-' + it.n); if (el) el.classList.add('missing'); });
      noc.forEach(it => { const t = $('#c-' + it.n); if (t) t.classList.add('invalid'); });
    }
    if (miss.length) return `Answer every item on this page (${miss.length} left), or tap “All OK on this page”.`;
    if (noc.length) return `Item ${noc[0].n} is a defect. Say what is wrong in the comment box.`;
  }
  if (st.id === 'banksman' && !trim(S.banksman)) { if (ui) mark('#f-banksman'); return 'Enter the name of the Banksman / Crane Supervisor.'; }
  if (st.id === 'defects' && defectItems().length && !trim(S.defectText)) { if (ui) mark('#f-defect'); return 'You marked a defect, so describe it here.'; }
  if (st.id === 'sign') {
    if (!trim(S.name)) { if (ui) mark('#f-name'); return 'Type your name.'; }
    if (kind === 'pre' && !S.agreed) { if (ui) mark('#f-agree'); return 'Tick the box to confirm the declaration.'; }
  }
  return '';
}
function mark(sel) { const el = $(sel); if (el) { el.classList.add('invalid'); el.focus && el.focus({ preventScroll: true }); } }
function validateAll() {
  for (let i = 0; i < steps.length - 1; i++) { const m = validateStep(i, false); if (m) return { i, msg: m }; }
  return null;
}
function showMsg(text) {
  const el = $('#msg'); if (!el) return toast(text, 'bad');
  el.textContent = text; el.classList.remove('hide');
  const first = $('.item.missing') || $('.invalid') || el;
  first.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/* ---------- render ---------- */
function render() {
  if (pad) { pad = null; }
  const st = steps[S.step], total = steps.length;
  const pct = Math.round((S.step / (total - 1)) * 100);
  const rr = S.returnReview && st.id !== 'review';
  const isFirst = S.step === 0, isReview = st.id === 'review';
  const nextLabel = isReview ? 'Submit check' : rr ? 'Done' : isFirst ? 'Start' : S.step === total - 2 ? 'Review' : 'Next';
  app.innerHTML = `
    <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    <div class="prog-lbl"><span>${esc(sec.title)}</span><span>Step ${S.step + 1} of ${total}</span></div>
    <div id="stepbody">${renderStep(st)}</div>
    <div id="msg" class="banner bad hide" role="alert"></div>
    <div class="navbar">
      <button type="button" class="btn back" data-act="back">${rr ? 'Cancel' : isFirst ? 'Home' : 'Back'}</button>
      <button type="button" class="btn ${isReview ? 'ok' : 'primary'}" data-act="${isReview ? 'submit' : 'next'}" id="nextBtn">${nextLabel}</button>
    </div>`;
  hydrate(st);
}

function hydrate(st) {
  $$('img[data-pid]').forEach(async img => { const b = await photos.b64(img.dataset.pid); if (b) img.src = dataUrl(b); });
  if (st.id === 'sign') {
    const c = $('#sigc');
    if (c) { pad = createSigPad(c, { onChange: b => { S.sig = b; persist(); } }); if (S.sig) pad.load(S.sig); }
  }
}

function renderStep(st) {
  switch (st.id) {
    case 'details': return stepDetails();
    case 'items': return stepItems(st);
    case 'banksman': return stepBanksman();
    case 'lube': return stepTicks('lube', 'Lubrication points', 'Only tick if checked / lubricated.', forms.inspection.lubrication);
    case 'required': return stepTicks('required', 'Required by operator', 'Tick anything you need supplied.', forms.inspection.required);
    case 'defects': return stepDefects();
    case 'sign': return stepSign();
    case 'review': return stepReview();
  }
  return '';
}

function detailsList() {
  const s = ctx.site;
  return `<dl class="kv">
    <dt>Operator</dt><dd>${esc(ctx.driver.name)}</dd>
    <dt>Site</dt><dd>${esc(s.name)}${s.address ? `<br><span class="muted small">${esc(s.address)}</span>` : ''}</dd>
    <dt>Crane</dt><dd>${esc(s.crane)}</dd>
    <dt>Crane SN</dt><dd>${esc(s.serial)}</dd>
    <dt>Crane PN</dt><dd>${esc(s.pn)}</dd>
    <dt>Date</dt><dd>${esc(fmtDate(date))}</dd>
    <dt>Week ending</dt><dd>${esc(fmtDate(weekEndingOf(date)))}</dd>
  </dl>`;
}

function stepDetails() {
  const loc = doneFlags.get(code, date);
  const already = (ctx.today === date && ctx.done && ctx.done[kind]) || loc[kind];
  return `<h1>${esc(sec.title)}</h1>
    ${already ? `<div class="banner warn"><strong>Already sent today</strong>You have already submitted this check today. Only carry on if you need to send a corrected one.</div>` : ''}
    ${S.fault ? '<div class="banner info"><strong>Reporting a fault</strong>You will land on the defect section first.</div>' : ''}
    <div class="card hd"><div class="bar">Details</div><div class="body">${detailsList()}</div></div>
    <div class="card"><p class="small" style="margin:0">${esc(forms.inspection.legend)}</p><p class="small" style="margin:8px 0 0"><span class="badge">Banksman / Supervisor</span> ${esc(forms.inspection.supervisorNote)}</p></div>`;
}

/* ----- items ----- */
function thumbs(ids, owner) {
  return ids.map(id => `<span class="ph"><img data-pid="${esc(id)}" alt="Photo"><button type="button" data-act="rmph" data-n="${esc(owner)}" data-id="${esc(id)}" aria-label="Remove photo">&times;</button></span>`).join('');
}
function itemCard(it) {
  const a = S.answers[it.n] || {}, v = a.v || '', ph = a.photos || [];
  const btn = (val, g, t) => `<button type="button" data-act="ans" data-n="${it.n}" data-v="${val}" class="${v === val ? 'on' : ''}" aria-pressed="${v === val}"><span class="g" aria-hidden="true">${g}</span> ${t}</button>`;
  return `<article class="item ${v ? 's-' + v : ''}" id="item-${it.n}">
    <div class="t"><span class="n">${it.n}</span><div class="lab">${esc(it.label)}${it.sup ? '<span class="badge">Banksman / Supervisor</span>' : ''}</div></div>
    <div class="seg" role="group" aria-label="Item ${it.n}">${btn('ok', '✓', 'OK')}${btn('x', '✗', 'Defect')}${btn('na', '', 'N/A')}</div>
    ${v === 'x' ? `<div class="cmt"><label class="lbl" for="c-${it.n}">What is wrong? (required)</label><textarea id="c-${it.n}" data-cmt="${it.n}" rows="3" placeholder="Describe the defect">${esc(a.c || '')}</textarea></div>` : ''}
    <div class="photos">${thumbs(ph, it.n)}${ph.length < MAX_PHOTOS ? `<button type="button" class="addph ${v === 'x' ? 'strong' : ''}" data-act="addph" data-n="${it.n}">&#128247; Add photo${ph.length ? ` (${ph.length}/${MAX_PHOTOS})` : ''}</button>` : `<span class="small muted">${MAX_PHOTOS}/${MAX_PHOTOS} photos</span>`}
      <input type="file" accept="image/*" capture="environment" hidden data-file="${it.n}"></div>
  </article>`;
}
function stepItems(st) {
  const pg = items.slice(st.from, st.to);
  return `<h2>${esc(sec.title)}</h2>
    <p class="muted" style="margin-top:-4px">Items ${st.from + 1}–${st.to} of ${items.length}</p>
    <button type="button" class="btn ok allok" data-act="allok">✓ All OK on this page</button>
    ${pg.map(itemCard).join('')}`;
}
function replaceCard(n) {
  const it = items[n - 1], el = $('#item-' + n);
  if (!el) return;
  const tmp = document.createElement('div'); tmp.innerHTML = itemCard(it);
  el.replaceWith(tmp.firstElementChild);
  $$('img[data-pid]', $('#item-' + n)).forEach(async img => { const b = await photos.b64(img.dataset.pid); if (b) img.src = dataUrl(b); });
}

function setAnswer(n, v) {
  const a = S.answers[n] || (S.answers[n] = { v: '', c: '', photos: [] });
  a.v = v; persist(); replaceCard(n);
  if (v === 'x') { const t = $('#c-' + n); if (t) t.focus(); }
}
function allOk() {
  const st = steps[S.step];
  items.slice(st.from, st.to).forEach(it => {
    const a = S.answers[it.n] || (S.answers[it.n] = { v: '', c: '', photos: [] });
    if (!a.v) { a.v = 'ok'; replaceCard(it.n); }
  });
  $$('.item.missing').forEach(el => el.classList.remove('missing'));
  $('#msg').classList.add('hide'); persist();
}

/* ----- photos ----- */
function photoList(target) {
  if (target === 'defect') return S.defectPhotos;
  const a = S.answers[target] || (S.answers[target] = { v: '', c: '', photos: [] });
  return a.photos || (a.photos = []);
}
async function addPhoto(target, file) {
  const list = photoList(target);
  if (list.length >= MAX_PHOTOS) return toast(`Up to ${MAX_PHOTOS} photos`, 'bad');
  const btn = $(target === 'defect' ? '[data-act=addph][data-n=defect]' : `#item-${target} [data-act=addph]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Processing photo…'; }
  try {
    const b64 = await resizeToB64(file);
    const item = target === 'defect' ? 'defect' : `${kind}-${target}`;
    const id = await photos.add({ code, kind, date, item, name: `${date}_${item}_${list.length + 1}.jpg`, b64 });
    list.push(id); persist();
  } catch (e) { toast('Could not use that photo. Try again.', 'bad'); }
  refreshPhotos(target);
}
async function removePhoto(target, id) {
  const list = photoList(target); const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  await photos.del(id); persist(); refreshPhotos(target);
}
function refreshPhotos(target) {
  if (target === 'defect') { const el = $('#defPhotos'); if (el) { el.innerHTML = defectPhotoHtml(); hydrate({ id: 'x' }); } }
  else replaceCard(+target);
}

/* ----- other steps ----- */
function stepBanksman() {
  const sup = items.filter(i => i.sup);
  return `<h2>Banksman / Crane Supervisor</h2>
    <p>${esc(forms.inspection.supervisorNote)}</p>
    <ul class="small muted">${sup.map(i => `<li>${i.n}. ${esc(i.label)}</li>`).join('')}</ul>
    <div class="field"><label for="f-banksman">Name of Banksman / Supervisor who checked these</label>
    <input id="f-banksman" type="text" autocomplete="off" value="${esc(S.banksman)}" placeholder="Full name"></div>`;
}
function stepTicks(key, title, hint, list) {
  return `<h2>${esc(title)}</h2><p class="muted">${esc(hint)}</p>
    ${list.map(raw => { const on = S[key].includes(raw); const sup = raw.startsWith('*');
      return `<label class="tick ${on ? 'on' : ''}"><input type="checkbox" data-tick="${key}" value="${esc(raw)}" ${on ? 'checked' : ''}><span>${esc(raw.replace(/^\*/, ''))}${sup ? '<span class="badge">Banksman / Supervisor</span>' : ''}</span></label>`; }).join('')}`;
}
function defectPhotoHtml() {
  return `${thumbs(S.defectPhotos, 'defect')}${S.defectPhotos.length < MAX_PHOTOS ? `<button type="button" class="addph strong" data-act="addph" data-n="defect">&#128247; Add photo${S.defectPhotos.length ? ` (${S.defectPhotos.length}/${MAX_PHOTOS})` : ''}</button>` : `<span class="small muted">${MAX_PHOTOS}/${MAX_PHOTOS} photos</span>`}<input type="file" accept="image/*" capture="environment" hidden data-file="defect">`;
}
function callBanner(extra = '') {
  return `<div class="banner bad"><strong>Phone the Bennetts office</strong>${esc(WARN_TEXT)}<div style="margin-top:10px"><a class="btn danger" href="tel:${OFFICE.replace(/\s/g, '')}">&#9742; Call ${OFFICE}</a></div>${extra}</div>`;
}
function stepDefects() {
  const nx = defectItems().length;
  return `<h2>Defects &amp; action taken</h2>
    ${nx ? callBanner() : '<div class="banner ok"><strong>No defects marked</strong>Use this section only if you want to add a note or report a fault.</div>'}
    <div class="field"><label for="f-defect">Defects ${nx ? '(required)' : '(optional)'}</label>
      <textarea id="f-defect" rows="6" placeholder="Describe the defect(s)">${esc(S.defectText)}</textarea></div>
    <div class="field"><label for="f-action">Action taken</label>
      <textarea id="f-action" rows="4" placeholder="What did you do about it?">${esc(S.defectAction)}</textarea></div>
    <label class="lbl">Photos of the defect</label>
    <div class="photos" id="defPhotos">${defectPhotoHtml()}</div>`;
}
function stepSign() {
  return `<h2>${kind === 'pre' ? 'Declaration' : 'Name &amp; signature'}</h2>
    ${kind === 'pre' ? `<div class="decl">${esc(forms.inspection.declaration)}</div>` : '<p>Confirm you have carried out the closedown procedures above.</p>'}
    <div class="field"><label for="f-name">Type your full name</label><input id="f-name" type="text" autocomplete="name" value="${esc(S.name)}"></div>
    ${kind === 'pre' ? `<label class="tick ${S.agreed ? 'on' : ''}" id="f-agree"><input type="checkbox" id="agree" ${S.agreed ? 'checked' : ''}><span>I agree with the declaration above</span></label>` : ''}
    <label class="lbl">Signature <span class="muted">(sign with your finger)</span></label>
    <div class="sigwrap"><canvas id="sigc" aria-label="Signature pad"></canvas><div class="x"></div></div>
    <p style="margin-top:8px"><button type="button" class="btn ghost sm" data-act="clearsig">Clear signature</button></p>`;
}

/* ----- review ----- */
const VL = { ok: ['OK', 'ok'], x: ['DEFECT', 'bad'], na: ['N/A', 'na'] };
function group(title, stepI, body) {
  return `<section><div class="rv-head"><span>${esc(title)}</span>${stepI >= 0 ? `<button type="button" class="btn" data-act="edit" data-step="${stepI}">Edit</button>` : ''}</div><div class="rv-body">${body}</div></section>`;
}
function stepReview() {
  const bad = validateAll();
  const nx = defectItems().length;
  let h = `<h2>Check your answers</h2>`;
  if (bad) h += `<div class="banner warn"><strong>Not finished yet</strong>${esc(bad.msg)}<div style="margin-top:10px"><button type="button" class="btn sm" data-act="edit" data-step="${bad.i}">Go there</button></div></div>`;
  if (nx) h += callBanner();
  h += `<div class="card hd"><div class="bar">Details</div><div class="body">${detailsList()}</div></div>`;
  steps.forEach((st, i) => {
    if (st.id === 'items') {
      h += group(`Items ${st.from + 1}–${st.to}`, i, items.slice(st.from, st.to).map(it => {
        const a = S.answers[it.n] || {}, vl = VL[a.v] || ['Not answered', 'warn'];
        return `<div class="rv-row"><span class="no">${it.n}</span><span class="tx">${esc(it.label)}${it.sup ? '<span class="badge">B/S</span>' : ''}${a.v === 'x' ? `<em>${esc(a.c || '')}</em>` : ''}${(a.photos || []).length ? `<span class="small muted"> · ${(a.photos || []).length} photo(s)</span>` : ''}</span><span class="chip ${vl[1]}">${vl[0]}</span></div>`;
      }).join(''));
    } else if (st.id === 'banksman') h += group('Banksman / Supervisor', i, `<div class="rv-row"><span class="tx">${esc(S.banksman) || '<em>Missing</em>'}</span></div>`);
    else if (st.id === 'lube') h += group('Lubrication points', i, `<div class="rv-row"><span class="tx">${S.lube.length ? S.lube.map(x => esc(x.replace(/^\*/, ''))).join(', ') : '<span class="muted">None ticked</span>'}</span></div>`);
    else if (st.id === 'required') h += group('Required by operator', i, `<div class="rv-row"><span class="tx">${S.required.length ? S.required.map(esc).join(', ') : '<span class="muted">None ticked</span>'}</span></div>`);
    else if (st.id === 'defects') h += group('Defects & action taken', i, `<div class="rv-row"><span class="tx"><b>Defects:</b> ${esc(S.defectText) || '<span class="muted">None</span>'}<br><b>Action:</b> ${esc(S.defectAction) || '<span class="muted">None</span>'}${S.defectPhotos.length ? `<br><span class="small muted">${S.defectPhotos.length} photo(s)</span>` : ''}</span></div>`.replace(/\n/g, '<br>'));
    else if (st.id === 'sign') h += group(kind === 'pre' ? 'Declaration' : 'Name & signature', i, `<div class="rv-row"><span class="tx"><b>${esc(S.name)}</b>${kind === 'pre' ? `<br>${S.agreed ? '✓ Declaration agreed' : '<em>Declaration not agreed</em>'}` : ''}${S.sig ? `<br><img alt="Signature" style="max-width:220px;border:1px solid #ccc;margin-top:6px" src="data:image/png;base64,${S.sig}">` : '<br><span class="muted">No signature drawn</span>'}</span></div>`);
  });
  return h;
}

/* ---------- submit ---------- */
function buildPayload() {
  const answers = {};
  items.forEach(it => {
    const a = S.answers[it.n];
    answers[String(it.n)] = { v: a.v, c: a.v === 'x' ? trim(a.c) : '', photos: (a.photos || []).slice() };
  });
  const defect = { text: trim(S.defectText), action: trim(S.defectAction) };
  if (S.defectPhotos.length) defect.photos = S.defectPhotos.slice();
  const declaration = { name: trim(S.name), agreed: true };
  if (S.sig) declaration.sig = S.sig;
  const p = { kind, date, client_ts: new Date().toISOString(), answers, defect, banksman: items.some(i => i.sup) ? trim(S.banksman) : '', declaration };
  if (kind === 'pre') { p.lube = S.lube.slice(); p.required = S.required.slice(); }
  return p;
}

async function submit() {
  const bad = validateAll();
  if (bad) { S.returnReview = true; goStep(bad.i); validateStep(bad.i, true); showMsg(bad.msg); return; }
  const btn = $('#nextBtn'); btn.disabled = true; btn.textContent = 'Sending…';
  const nDefects = defectItems().length;
  const payload = buildPayload();
  try {
    await enqueue({ sid: S.sid, code, payload });
  } catch (e) { btn.disabled = false; btn.textContent = 'Submit check'; return toast('Could not save on this phone. Try again.', 'bad'); }
  doneFlags.mark(code, date, kind);
  S.submitted = true; drafts.clear(kind, code, date);
  app.innerHTML = loading('Sending your check…');
  const r = await sendAndWait(S.sid);
  showResult(r, nDefects);
}

function showResult(r, nDefects) {
  const home = `<a class="btn primary" href="${href('index.html')}" style="margin-top:14px">Back to home</a>`;
  if (r.ok) {
    const d = typeof r.defects === 'number' ? r.defects : nDefects;
    app.innerHTML = `<div class="center"><div class="big-ok" aria-hidden="true">✓</div><h1>${kind === 'pre' ? 'Pre-use check' : 'Closedown'} sent</h1><p class="muted">Thank you, ${esc(ctx.driver.name)}.</p><div class="ref" aria-label="Reference">${esc(r.ref)}</div>
      ${r.pdf_url ? `<a class="btn ghost" href="${esc(r.pdf_url)}" target="_blank" rel="noopener">Open PDF</a>` : ''}</div>
      ${d > 0 ? `<div style="margin-top:16px" class="banner ok"><strong>Defect alert sent</strong>An alert for ${d} defect${d > 1 ? 's' : ''} has been emailed to the Bennetts office and the site contact.</div>${callBanner()}` : ''}
      ${home}`;
  } else if (r.network) {
    app.innerHTML = `<div class="center"><div class="big-ok" style="color:var(--warn)" aria-hidden="true">&#9201;</div><h1>Saved on this phone</h1></div>
      <div class="banner warn"><strong>No signal</strong>Your check is saved and will send by itself when your phone has signal. You can close this page. Keep the app on this phone until it has sent. You can see how many are waiting on the home page.</div>
      ${nDefects > 0 ? callBanner() : ''}${home}`;
  } else {
    app.innerHTML = `<div class="banner bad"><strong>The server did not accept this check</strong>${esc(r.error || 'Unknown error')}. It is still saved on this phone; the office has not received it. Phone the office, or retry from the home page.</div>${nDefects > 0 ? callBanner() : ''}${home}`;
  }
  window.scrollTo(0, 0);
}

/* ---------- events ---------- */
function next() {
  const m = validateStep(S.step, true);
  if (m) return showMsg(m);
  if (S.returnReview) return goStep(stepIdx('review'));
  const st = steps[S.step];
  if (S.fault && st.id === 'defects') {
    const bad = validateAll();
    if (bad && bad.i < S.step) {
      S.fault = false; goStep(bad.i);
      toast('Now mark the faulty item with ✗ Defect', 'ok');
      return;
    }
  }
  goStep(S.step + 1);
}
function back() {
  if (S.returnReview) return goStep(stepIdx('review'));
  if (S.step === 0) { location.href = href('index.html'); return; }
  goStep(S.step - 1);
}

app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act;
  if (a === 'ans') setAnswer(+b.dataset.n, b.dataset.v);
  else if (a === 'allok') allOk();
  else if (a === 'addph') { const f = app.querySelector(`input[data-file="${b.dataset.n}"]`); if (f) f.click(); }
  else if (a === 'rmph') removePhoto(b.dataset.n === 'defect' ? 'defect' : +b.dataset.n, b.dataset.id);
  else if (a === 'next') next();
  else if (a === 'back') back();
  else if (a === 'edit') { S.returnReview = true; goStep(+b.dataset.step); }
  else if (a === 'clearsig') { if (pad) pad.clear(); }
  else if (a === 'submit') submit();
});
app.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-file]')) {
    const f = t.files && t.files[0]; const owner = t.dataset.file === 'defect' ? 'defect' : +t.dataset.file;
    t.value = ''; if (f) addPhoto(owner, f);
  } else if (t.matches('[data-tick]')) {
    const list = S[t.dataset.tick], i = list.indexOf(t.value);
    if (t.checked && i < 0) list.push(t.value); else if (!t.checked && i >= 0) list.splice(i, 1);
    t.closest('.tick').classList.toggle('on', t.checked); persist();
  } else if (t.id === 'agree') {
    S.agreed = t.checked; t.closest('.tick').classList.toggle('on', t.checked); $('#f-agree').classList.remove('invalid'); persist();
  }
});
app.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('[data-cmt]')) { const n = +t.dataset.cmt; (S.answers[n] || (S.answers[n] = { v: 'x', c: '', photos: [] })).c = t.value; t.classList.remove('invalid'); }
  else if (t.id === 'f-banksman') S.banksman = t.value;
  else if (t.id === 'f-defect') S.defectText = t.value;
  else if (t.id === 'f-action') S.defectAction = t.value;
  else if (t.id === 'f-name') S.name = t.value;
  else return;
  t.classList.remove('invalid'); persist();
});
