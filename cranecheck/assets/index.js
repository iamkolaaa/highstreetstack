import { api, ApiError, errMsg } from './api.js';
import { MOCK } from './config.js';
import { session, doneFlags, listQueue, drain, discard, initAutoDrain } from './store.js';
import { chrome, esc, $, $$, href, fmtDate, fmtDateTime, fmtCode, normCode, loading } from './ui.js';

chrome({});
const app = $('#app');
let ctx = null;
let offlineNote = false;

const TS_LABEL = { none: ['Not started', 'na'], draft: ['Draft saved', 'warn'], submitted: ['Awaiting approval', 'blue'], approved: ['Approved ✓', 'ok'], rejected: ['Rejected – fix and resubmit', 'bad'] };

start();

async function start() {
  const code = session.getCode();
  if (!code) return showEntry();
  const c = session.getCtx();
  if (c && c.code === code) { ctx = c; renderHome(); } else app.innerHTML = loading('Checking your code…');
  initAutoDrain();
  await refresh();
}

/* ---------- code entry ---------- */
function showEntry(msg = '') {
  ctx = null;
  app.innerHTML = `
    <h1>Check in</h1>
    <p class="muted">Enter the check-in code Bennetts gave you for this crane.</p>
    <form id="f" class="card" novalidate>
      <div class="field">
        <label for="code">Check-in code</label>
        <input id="code" class="codein" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="9" placeholder="ABCD-EFGH" aria-describedby="err">
      </div>
      <div id="err" class="err" role="alert">${esc(msg)}</div>
      <button class="btn primary" id="go" type="submit">Continue</button>
      ${MOCK ? '<p class="hint center">Demo code: <b>DEMO-2026</b></p>' : ''}
    </form>
    <p class="small muted center">No code or it isn’t working? Phone the office on the red bar below.</p>`;
  const inp = $('#code');
  if (MOCK && !msg) inp.value = 'DEMO-2026';
  inp.addEventListener('input', () => { inp.value = fmtCode(inp.value); });
  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    const code = normCode(inp.value);
    const err = $('#err');
    if (code.length !== 8) { err.textContent = 'The code has 8 letters and numbers, like ABCD-EFGH.'; inp.classList.add('invalid'); return; }
    inp.classList.remove('invalid'); err.textContent = '';
    const b = $('#go'); b.disabled = true; b.textContent = 'Checking…';
    try {
      const r = await api('resolve', { code });
      session.setCode(code);
      ctx = { ...r, code, at: Date.now() }; session.setCtx(ctx);
      offlineNote = false; renderHome(); initAutoDrain();
    } catch (x) {
      err.textContent = x instanceof ApiError && x.network ? 'No signal. Move to where you have signal and try again.' : errMsg(x);
      b.disabled = false; b.textContent = 'Continue';
    }
  });
  if (window.top === window) inp.focus();
}

/* ---------- refresh ---------- */
async function refresh() {
  const code = session.getCode(); if (!code) return;
  try {
    const r = await api('resolve', { code });
    ctx = { ...r, code, at: Date.now() }; session.setCtx(ctx);
    offlineNote = false; renderHome();
  } catch (e) {
    if (e instanceof ApiError && e.network) {
      offlineNote = true;
      if (ctx) renderHome();
      else app.innerHTML = `<div class="banner warn"><strong>No signal</strong>Couldn’t reach the server and nothing is saved on this phone yet.</div><button class="btn primary" id="retry">Try again</button>`, $('#retry').addEventListener('click', () => { app.innerHTML = loading(); refresh(); });
    } else {
      session.clear(); showEntry(errMsg(e));
    }
  }
}

/* ---------- home ---------- */
function renderHome() {
  if (!ctx) return;
  const loc = doneFlags.get(ctx.code, ctx.today);
  const done = { pre: ctx.done.pre || loc.pre, close: ctx.done.close || loc.close };
  const ts = TS_LABEL[ctx.ts_status] || TS_LABEL.none;
  const s = ctx.site;
  const doneChip = d => d ? '<span class="chip ok">✓ Done today</span>' : '<span class="chip warn">To do</span>';
  app.innerHTML = `
    ${offlineNote ? '<div class="banner warn"><strong>No signal</strong>Showing what was saved on this phone. You can still fill in checks; they send when signal returns.</div>' : ''}
    <section class="card hd" aria-label="Today">
      <div class="bar">Hello ${esc(ctx.driver.name)}</div>
      <div class="body">
        <dl class="kv">
          <dt>Site</dt><dd>${esc(s.name)}</dd>
          <dt>Crane</dt><dd>${esc(s.crane)}</dd>
          <dt>SN / PN</dt><dd>${esc(s.serial)} / ${esc(s.pn)}</dd>
          <dt>Today</dt><dd>${esc(fmtDate(ctx.today))}</dd>
          <dt>Week ending</dt><dd>${esc(fmtDate(ctx.week_ending))}</dd>
        </dl>
      </div>
    </section>
    <div id="q"></div>
    <nav class="stack" aria-label="Actions">
      <a class="btn big primary" href="${href('check.html?kind=pre')}"><span>Pre-use check<span class="sub">Start of shift</span></span>${doneChip(done.pre)}</a>
      <a class="btn big primary" href="${href('check.html?kind=close')}"><span>Closedown<span class="sub">End of shift</span></span>${doneChip(done.close)}</a>
      <a class="btn big" href="${href('timesheet.html')}"><span>Timesheet<span class="sub">Week ending ${esc(fmtDate(ctx.week_ending))}</span></span><span class="chip ${ts[1]}">${esc(ts[0])}</span></a>
      <a class="btn big outline-danger" href="${href('check.html?kind=pre&jump=defect')}"><span>&#9888; Report a fault now<span class="sub">Goes straight to the defect and photo section</span></span></a>
      <button class="btn big ghost" id="histBtn" type="button" aria-expanded="false"><span>History<span class="sub">Last submissions and PDFs</span></span><span aria-hidden="true">&#9662;</span></button>
    </nav>
    <div id="hist" class="hide"></div>
    <p class="center" style="margin-top:20px"><button class="btn ghost sm" id="switch" type="button">Switch driver</button></p>`;
  $('#histBtn').addEventListener('click', toggleHistory);
  $('#switch').addEventListener('click', switchDriver);
  renderQueue();
}

async function renderQueue() {
  const box = $('#q'); if (!box || !ctx) return;
  const q = await listQueue(ctx.code);
  if (!q.length) { box.innerHTML = ''; return; }
  const errs = q.filter(x => x.status === 'error');
  box.innerHTML = `<div class="banner ${errs.length ? 'bad' : 'warn'}" role="status">
      <strong>${q.length} waiting to send</strong>
      ${errs.length ? errs.map(x => `<div class="small">${esc(x.payload.kind === 'pre' ? 'Pre-use' : 'Closedown')} ${esc(fmtDate(x.payload.date))}: ${esc(x.error)} <button class="btn ghost sm" data-discard="${esc(x.sid)}" type="button" style="display:inline-flex;min-height:40px">Discard</button></div>`).join('') : 'Saved on this phone. They send automatically when you have signal.'}
      <div style="margin-top:10px"><button class="btn sm primary" id="retryQ" type="button">Retry now</button></div>
    </div>`;
  $('#retryQ').addEventListener('click', async e => {
    e.target.disabled = true; e.target.textContent = 'Sending…';
    await drain(); await refresh(); renderQueue();
  });
  $$('[data-discard]', box).forEach(b => b.addEventListener('click', async () => {
    if (confirm('Discard this check? It has not been sent and cannot be recovered.')) { await discard(b.dataset.discard); renderQueue(); }
  }));
}
window.addEventListener('cc-queue', () => { renderQueue(); });
window.addEventListener('online', () => { drain().then(() => refresh()); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && session.getCode()) refresh(); });

async function toggleHistory() {
  const box = $('#hist'), btn = $('#histBtn');
  if (!box.classList.contains('hide')) { box.classList.add('hide'); btn.setAttribute('aria-expanded', 'false'); return; }
  box.classList.remove('hide'); btn.setAttribute('aria-expanded', 'true');
  box.innerHTML = `<div class="card">${loading()}</div>`;
  try {
    const r = await api('history', { code: ctx.code });
    const label = k => (k === 'pre' ? 'Pre-use' : 'Closedown');
    box.innerHTML = `<div class="card"><h3>Recent submissions</h3>${r.items.length ? r.items.map(i => `
      <div class="listrow"><div class="meta"><b>${label(i.kind)}</b> · ${esc(fmtDate(i.date))}<small>${esc(i.ref)} · sent ${esc(fmtDateTime(i.received_at))}</small></div>
      ${i.defects ? `<span class="chip bad">${i.defects} defect${i.defects > 1 ? 's' : ''}</span>` : '<span class="chip ok">No defects</span>'}
      ${i.pdf_url ? `<a class="btn sm ghost" href="${esc(i.pdf_url)}" target="_blank" rel="noopener">PDF</a>` : ''}</div>`).join('') : '<p class="muted">Nothing submitted yet.</p>'}</div>`;
  } catch (e) {
    box.innerHTML = `<div class="banner warn">${esc(e instanceof ApiError && e.network ? 'No signal, so history can’t load right now.' : errMsg(e))}</div>`;
  }
}

async function switchDriver() {
  const q = await listQueue(ctx.code);
  if (q.length && !confirm(`${q.length} check(s) are still waiting to send. They will keep trying to send. Switch driver anyway?`)) return;
  session.clear(); showEntry();
}
