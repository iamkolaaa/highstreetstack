import { api, ApiError, errMsg } from './api.js';
import { MOCK, PUBLIC_URL } from './config.js';
import { resizeToB64, fileToB64 } from './photo.js';
import { chrome, esc, $, $$, href, fmtDate, fmtDateTime, fmtCode, copyText, addDays, weekEndingOf, todayLondon, loading, toast } from './ui.js';

chrome({ back: 'index.html', backLabel: 'Home' });
const app = $('#app');
const KL = { pre: 'Pre-use', close: 'Closedown', timesheet: 'Timesheet', scan: 'Scan', supervisor: 'Lifting accessories (supervisor)' };
const TABS = [['register', 'Register'], ['sites', 'Sites'], ['drivers', 'Drivers'], ['codes', 'Codes'], ['scans', 'Scans'], ['settings', 'Settings']];

let pin = '', data = null, tab = 'register', edit = null, lastCode = null, regCache = null, weekly = {};
const PK = MOCK ? 'ccdemo_pin' : 'cc_pin';
const ss = { get() { try { return sessionStorage.getItem(PK) || ''; } catch (e) { return ''; } }, set(v) { try { v ? sessionStorage.setItem(PK, v) : sessionStorage.removeItem(PK); } catch (e) {} } };
const call = (action, p = {}) => api(action, { pin, ...p });
const errText = e => (e instanceof ApiError && e.network ? 'No signal. Try again.' : errMsg(e));
const errBox = m => `<div class="banner bad" role="alert">${esc(m)}</div>`;

start();

async function start() {
  pin = ss.get();
  if (!pin) return login();
  app.innerHTML = loading();
  try { data = await call('admin_data'); shell(); }
  catch (e) { if (e instanceof ApiError && e.network) { app.innerHTML = errBox(errText(e)) + '<button class="btn primary" id="rt">Retry</button>'; $('#rt').onclick = start; } else { ss.set(''); pin = ''; login(errText(e)); } }
}

function login(msg = '') {
  app.innerHTML = `<div style="max-width:420px;margin:0 auto"><h1>Admin</h1><p class="muted">Bennetts office and High Street Stack only.</p>
    <form id="f" class="card"><div class="field"><label for="pin">PIN</label><input id="pin" type="password" inputmode="numeric" autocomplete="current-password" class="codein" style="letter-spacing:.3em" maxlength="20"></div>
    <div id="err">${msg ? errBox(msg) : ''}</div><button class="btn primary" id="go">Sign in</button>${MOCK ? '<p class="hint center">Demo PIN: <b>123456</b></p>' : ''}</form></div>`;
  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    const v = $('#pin').value.trim(); if (!v) return;
    const b = $('#go'); b.disabled = true; b.textContent = 'Checking…';
    pin = v;
    try { data = await call('admin_data'); ss.set(pin); shell(); }
    catch (x) { pin = ''; $('#err').innerHTML = errBox(errText(x)); b.disabled = false; b.textContent = 'Sign in'; }
  });
  if (MOCK && !msg) $('#pin').value = '123456';
  if (window.top === window) $('#pin').focus();
}

function shell() {
  app.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:8px"><h1 style="margin:0">Admin</h1><button class="btn ghost sm" id="out" type="button">Sign out</button></div>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    <div id="panel"></div>`;
  $('#out').onclick = () => { ss.set(''); pin = ''; data = null; login(); };
  $$('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; edit = null; $$('[data-tab]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); panel(); });
  panel();
}
function panel() { ({ register, sites, drivers, codes, scans, settings })[tab](); }
async function reload() { data = await call('admin_data'); }
const siteName = id => (data.sites.find(s => s.id === id) || {}).name || id;
const driverName = id => (data.drivers.find(d => d.id === id) || {}).name || id;

/* helper: run an async action on a button with an error area */
async function run(btn, fn, errSel = '#err') {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Working…';
  const box = $(errSel); if (box) box.innerHTML = '';
  try { await fn(); } catch (e) { if (box) box.innerHTML = errBox(errText(e)); else toast(errText(e), 'bad'); }
  finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = orig; } }
}
const fld = (id, label, val = '', type = 'text', extra = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(val)}" ${extra}></div>`;

/* ================= Register ================= */
async function register() {
  const today = todayLondon();
  const f = regCache ? regCache.f : { site: '', from: addDays(today, -14), to: '' };
  $('#panel').innerHTML = `<div class="card"><div class="grid2">
    <div class="field"><label for="rs">Site</label><select id="rs"><option value="">All sites</option>${data.sites.map(s => `<option value="${esc(s.id)}" ${s.id === f.site ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="rf">From</label><input id="rf" type="date" value="${esc(f.from)}"></div>
    <div class="field"><label for="rt">To</label><input id="rt" type="date" value="${esc(f.to)}"></div>
    <div class="field"><label>&nbsp;</label><button class="btn primary" id="rg" type="button">Show</button></div></div></div>
    <div id="err"></div><div id="rres"></div>`;
  $('#rg').onclick = e => run(e.target, loadRegister);
  if (regCache) drawRegister(); else run($('#rg'), loadRegister);
}
async function loadRegister() {
  const f = { site: $('#rs').value, from: $('#rf').value, to: $('#rt').value };
  const p = {}; if (f.site) p.site_id = f.site; if (f.from) p.from = f.from; if (f.to) p.to = f.to;
  const r = await call('admin_register', p);
  regCache = { f, items: r.items || [] }; weekly = {};
  drawRegister();
}
function drawRegister() {
  const items = regCache.items, el = $('#rres'); if (!el) return;
  if (!items.length) { el.innerHTML = '<p class="muted center">Nothing found for those filters.</p>'; return; }
  const groups = new Map(); const scansL = [];
  items.forEach(i => { if (i.kind === 'scan') return scansL.push(i); const we = i.kind === 'timesheet' ? i.date : weekEndingOf(i.date); const key = we + '|' + i.site; if (!groups.has(key)) groups.set(key, { we, site: i.site, rows: [] }); groups.get(key).rows.push(i); });
  const row = i => `<div class="listrow"><div class="meta"><b>${esc(KL[i.kind] || i.kind)}</b> · ${esc(fmtDate(i.date))}<small>${esc(i.driver)}${i.driver && i.ref ? ' · ' : ''}${esc(i.ref)}${i.received_at ? ' · ' + esc(fmtDateTime(i.received_at)) : ''}</small></div>
    ${i.defects ? `<span class="chip bad">${i.defects} defect${i.defects > 1 ? 's' : ''}</span>` : ''}${i.status && i.kind === 'timesheet' ? `<span class="chip ${i.status === 'approved' ? 'ok' : i.status === 'rejected' ? 'bad' : 'blue'}">${esc(i.status)}</span>` : ''}
    ${i.pdf_url ? `<a class="btn sm ghost" href="${esc(i.pdf_url)}" target="_blank" rel="noopener">${i.kind === 'scan' ? 'Open' : 'PDF'}</a>` : ''}</div>`;
  let h = '';
  [...groups.values()].sort((a, b) => b.we.localeCompare(a.we) || a.site.localeCompare(b.site)).forEach((g, gi) => {
    const sid = (data.sites.find(s => s.name === g.site) || {}).id; const key = sid + '|' + g.we;
    h += `<div class="wkhead"><span>Week ending ${esc(fmtDate(g.we))} · ${esc(g.site)}</span>${sid ? (weekly[key] ? `<a class="btn sm ok" href="${esc(weekly[key])}" target="_blank" rel="noopener">Open weekly sheet</a>` : `<button type="button" class="btn sm primary" data-wk="${esc(sid)}" data-we="${esc(g.we)}">Build weekly sheet PDF</button>`) : ''}</div><div class="card" style="padding:4px 14px">${g.rows.map(row).join('')}</div>`;
  });
  if (scansL.length) h += `<div class="wkhead"><span>Scanned paper copies</span></div><div class="card" style="padding:4px 14px">${scansL.map(row).join('')}</div>`;
  el.innerHTML = h;
  $$('[data-wk]', el).forEach(b => b.onclick = () => run(b, async () => { const r = await call('admin_weekly_pdf', { site_id: b.dataset.wk, week_ending: b.dataset.we }); weekly[b.dataset.wk + '|' + b.dataset.we] = r.pdf_url; drawRegister(); toast('Weekly sheet built', 'ok'); }));
}

/* ================= Sites ================= */
function sites() {
  const p = $('#panel');
  if (edit && edit.type === 'site') {
    const s = edit.row;
    p.innerHTML = `<h2>${s.id ? 'Edit' : 'Add'} site</h2><form id="f" class="card">
      ${fld('s-name', 'Site name', s.name)}${fld('s-address', 'Address', s.address)}${fld('s-contractor', 'Contractor', s.contractor)}
      <div class="grid2">${fld('s-crane', 'Crane make &amp; model', s.crane)}${fld('s-serial', 'Crane SN', s.serial)}</div>${fld('s-pn', 'Crane PN', s.pn)}
      ${fld('s-mname', 'Site manager / agent name', s.manager_name)}${fld('s-memail', 'Site manager email (gets approval links)', s.manager_email, 'email')}${fld('s-cemail', 'Site contact email (gets defect alerts)', s.contact_email, 'email')}
      <label class="tick ${s.active !== false ? 'on' : ''}"><input type="checkbox" id="s-active" ${s.active !== false ? 'checked' : ''}><span>Active</span></label>
      <div id="err"></div><div class="stack"><button class="btn primary" id="sv">Save site</button><button type="button" class="btn" id="cn">Cancel</button></div></form>`;
    $('#cn').onclick = () => { edit = null; sites(); };
    $('#f').onsubmit = e => { e.preventDefault(); run($('#sv'), async () => {
      const site = { name: $('#s-name').value.trim(), address: $('#s-address').value.trim(), contractor: $('#s-contractor').value.trim(), crane: $('#s-crane').value.trim(), serial: $('#s-serial').value.trim(), pn: $('#s-pn').value.trim(), manager_name: $('#s-mname').value.trim(), manager_email: $('#s-memail').value.trim(), contact_email: $('#s-cemail').value.trim(), active: $('#s-active').checked };
      if (s.id) site.id = s.id;
      await call('admin_save_site', { site }); await reload(); edit = null; sites(); toast('Site saved', 'ok');
    }); };
    return;
  }
  p.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="margin:0">Sites</h2><button class="btn sm primary" id="add" type="button">+ Add site</button></div>
    <div class="card" style="margin-top:12px;padding:4px 14px">${data.sites.map(s => `<div class="listrow"><div class="meta"><b>${esc(s.name)}</b><small>${esc(s.crane)} · SN ${esc(s.serial)} · PN ${esc(s.pn)}</small><small>${esc(s.contractor)}</small></div>${s.active === false ? '<span class="chip na">Inactive</span>' : '<span class="chip ok">Active</span>'}<button class="btn sm ghost" data-edit="${esc(s.id)}" type="button">Edit</button></div>`).join('') || '<p class="muted">No sites yet.</p>'}</div>`;
  $('#add').onclick = () => { edit = { type: 'site', row: { active: true } }; sites(); };
  $$('[data-edit]').forEach(b => b.onclick = () => { edit = { type: 'site', row: { ...data.sites.find(s => s.id === b.dataset.edit) } }; sites(); });
}

/* ================= Drivers ================= */
function drivers() {
  const p = $('#panel');
  if (edit && edit.type === 'driver') {
    const d = edit.row;
    p.innerHTML = `<h2>${d.id ? 'Edit' : 'Add'} driver</h2><form id="f" class="card">${fld('d-name', 'Full name', d.name)}${fld('d-phone', 'Mobile', d.phone, 'tel')}${fld('d-email', 'Email', d.email, 'email')}
      <label class="tick ${d.active !== false ? 'on' : ''}"><input type="checkbox" id="d-active" ${d.active !== false ? 'checked' : ''}><span>Active</span></label>
      <div id="err"></div><div class="stack"><button class="btn primary" id="sv">Save driver</button><button type="button" class="btn" id="cn">Cancel</button></div></form>`;
    $('#cn').onclick = () => { edit = null; drivers(); };
    $('#f').onsubmit = e => { e.preventDefault(); run($('#sv'), async () => {
      const driver = { name: $('#d-name').value.trim(), phone: $('#d-phone').value.trim(), email: $('#d-email').value.trim(), active: $('#d-active').checked };
      if (d.id) driver.id = d.id;
      await call('admin_save_driver', { driver }); await reload(); edit = null; drivers(); toast('Driver saved', 'ok');
    }); };
    return;
  }
  p.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="margin:0">Drivers</h2><button class="btn sm primary" id="add" type="button">+ Add driver</button></div>
    <div class="card" style="margin-top:12px;padding:4px 14px">${data.drivers.map(d => `<div class="listrow"><div class="meta"><b>${esc(d.name)}</b><small>${esc(d.phone)} ${esc(d.email)}</small></div>${d.active === false ? '<span class="chip na">Inactive</span>' : '<span class="chip ok">Active</span>'}<button class="btn sm ghost" data-edit="${esc(d.id)}" type="button">Edit</button></div>`).join('') || '<p class="muted">No drivers yet.</p>'}</div>`;
  $('#add').onclick = () => { edit = { type: 'driver', row: { active: true } }; drivers(); };
  $$('[data-edit]').forEach(b => b.onclick = () => { edit = { type: 'driver', row: { ...data.drivers.find(d => d.id === b.dataset.edit) } }; drivers(); });
}

/* ================= Codes ================= */
const shareText = (site, code) => `Your CraneCheck code for ${site} is ${code} — ${PUBLIC_URL}`;
function shareButtons(site, code) {
  const t = shareText(site, code);
  return `<div class="grid2"><button type="button" class="btn sm" data-copy="${esc(code)}">Copy code</button><button type="button" class="btn sm" data-copytext="${esc(t)}">Copy message</button>
    <a class="btn sm ok" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(t)}">WhatsApp</a><a class="btn sm primary" href="sms:?&body=${encodeURIComponent(t)}">SMS</a></div>`;
}
function bindShare(root) {
  $$('[data-copy]', root).forEach(b => b.onclick = () => copyText(b.dataset.copy).then(() => toast('Code copied', 'ok'), () => toast('Could not copy', 'bad')));
  $$('[data-copytext]', root).forEach(b => b.onclick = () => copyText(b.dataset.copytext).then(() => toast('Message copied', 'ok'), () => toast('Could not copy', 'bad')));
}
function codes() {
  const today = todayLondon();
  const act = data.drivers.filter(d => d.active !== false), sts = data.sites.filter(s => s.active !== false);
  const statusOf = c => c.revoked ? ['Revoked', 'bad'] : (c.kind === 'temp' && c.expires && c.expires < today) ? ['Expired', 'na'] : ['Active', 'ok'];
  $('#panel').innerHTML = `<h2>Issue a code</h2><form id="f" class="card">
    <div class="grid2"><div class="field"><label for="c-d">Driver</label><select id="c-d">${act.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="c-s">Site</label><select id="c-s">${sts.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div></div>
    <div class="field"><label>Type</label><div class="grid2"><label class="tick on" id="k1"><input type="radio" name="kind" value="permanent" checked><span>Permanent</span></label><label class="tick" id="k2"><input type="radio" name="kind" value="temp"><span>Temporary</span></label></div></div>
    <div class="field hide" id="expw"><label for="c-e">Expires on</label><input id="c-e" type="date" value="${addDays(today, 14)}" min="${today}"></div>
    <div id="err"></div><button class="btn primary" id="iss">Issue code</button></form>
    <div id="newc">${lastCode ? newCodeCard(lastCode) : ''}</div>
    <h2 style="margin-top:20px">All codes</h2>
    <div class="card" style="padding:4px 14px">${data.codes.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(c => { const st = statusOf(c), code = fmtCode(c.code); return `<div class="listrow"><div class="meta"><b style="font-family:var(--head);letter-spacing:.08em;font-size:1.1rem">${esc(code)}</b><small>${esc(driverName(c.driver_id))} · ${esc(siteName(c.site_id))}</small><small>${c.kind === 'temp' ? 'Temporary, expires ' + esc(fmtDate(c.expires)) : 'Permanent'}</small></div><span class="chip ${st[1]}">${st[0]}</span>${st[0] === 'Active' ? `<button class="btn sm outline-danger" data-revoke="${esc(c.code)}" type="button">Revoke</button>` : ''}</div>`; }).join('') || '<p class="muted">No codes yet.</p>'}</div>`;
  const radios = $$('input[name=kind]');
  radios.forEach(r => r.onchange = () => { $('#expw').classList.toggle('hide', radios.find(x => x.checked).value !== 'temp'); $('#k1').classList.toggle('on', radios[0].checked); $('#k2').classList.toggle('on', radios[1].checked); });
  $('#f').onsubmit = e => { e.preventDefault(); run($('#iss'), async () => {
    const kind = radios.find(x => x.checked).value, did = $('#c-d').value, sid = $('#c-s').value;
    if (!did || !sid) throw new Error('Add an active driver and an active site first.');
    const r = await call('admin_issue_code', { driver_id: did, site_id: sid, kind, ...(kind === 'temp' ? { expires: $('#c-e').value } : {}) });
    lastCode = { code: r.code, site: siteName(sid), driver: driverName(did) };
    await reload(); codes(); toast('Code issued', 'ok');
  }); };
  $$('[data-revoke]').forEach(b => b.onclick = () => { if (confirm('Revoke this code? The driver will be signed out.')) run(b, async () => { await call('admin_revoke_code', { code: b.dataset.revoke }); await reload(); codes(); toast('Code revoked', 'ok'); }, '#nonexistent'); });
  bindShare($('#panel'));
}
function newCodeCard(c) {
  return `<div class="card" style="border-color:var(--blue)"><p class="small muted" style="margin:0">New code for ${esc(c.driver)} at ${esc(c.site)}</p><div class="newcode" id="nc">${esc(c.code)}</div>${shareButtons(c.site, c.code)}</div>`;
}

/* ================= Scans ================= */
function scans() {
  const m = todayLondon().slice(0, 7);
  $('#panel').innerHTML = `<h2>Upload scanned paper copies</h2><p class="muted">Photos and scans are shrunk automatically. PDFs must be 1 MB or smaller.</p>
    <form id="f" class="card"><div class="grid2"><div class="field"><label for="x-s">Site</label><select id="x-s">${data.sites.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="x-m">Month</label><input id="x-m" type="month" value="${m}"></div></div>
    <div class="field"><label for="x-f">Files</label><input id="x-f" type="file" multiple accept="image/*,application/pdf"></div>
    <div id="err"></div><button class="btn primary" id="up">Upload</button></form><div id="prog"></div>`;
  $('#f').onsubmit = e => { e.preventDefault(); run($('#up'), async () => {
    const files = Array.from($('#x-f').files || []); if (!files.length) throw new Error('Choose at least one file.');
    const site_id = $('#x-s').value, month = $('#x-m').value; if (!site_id || !month) throw new Error('Pick a site and a month.');
    const box = $('#prog'); box.innerHTML = '<div class="card" style="padding:4px 14px">' + files.map((f, i) => `<div class="listrow"><div class="meta">${esc(f.name)}</div><span class="chip na" id="st${i}">Waiting</span></div>`).join('') + '</div>';
    const st = (i, t, c) => { const el = $('#st' + i); el.textContent = t; el.className = 'chip ' + c; };
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; st(i, 'Sending…', 'blue');
      try {
        let b64, mime, name = f.name;
        if (/^image\//.test(f.type)) { b64 = await resizeToB64(f, 2000, 0.8); mime = 'image/jpeg'; name = name.replace(/\.[^.]+$/, '') + '.jpg'; }
        else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) { if (f.size > 1000000) throw new Error('PDF is over 1 MB'); b64 = await fileToB64(f); mime = 'application/pdf'; if (!/\.pdf$/i.test(name)) name += '.pdf'; }
        else throw new Error('Only photos and PDFs');
        await call('admin_upload_scan', { site_id, month, name, b64, mime });
        st(i, 'Uploaded', 'ok');
      } catch (x) { st(i, errText(x), 'bad'); }
    }
    regCache = null;
  }); };
}

/* ================= Settings ================= */
function settings() {
  const s = data.settings || {};
  $('#panel').innerHTML = `<h2>Settings</h2><form id="f" class="card">
    <div class="field"><label for="st-a">Alert emails (defect alerts, approvals) <span class="muted">comma separated</span></label><textarea id="st-a" rows="2">${esc(s.alert_emails)}</textarea></div>
    ${fld('st-b', 'Bennetts email (receives approved timesheets and weekly sheets)', s.bennetts_email, 'email')}
    <div id="err"></div><button class="btn primary" id="sv">Save settings</button></form>
    <h2 style="margin-top:20px">Change PIN</h2><form id="pf" class="card">
    ${fld('p-1', 'New PIN (at least 6 digits)', '', 'password', 'inputmode="numeric" autocomplete="new-password"')}${fld('p-2', 'Repeat new PIN', '', 'password', 'inputmode="numeric" autocomplete="new-password"')}
    <div id="perr"></div><button class="btn" id="pv">Change PIN</button></form>
    ${MOCK ? '<h2 style="margin-top:20px">Demo</h2><div class="card"><p class="small muted">Wipes everything entered in demo mode and restores the sample data.</p><button type="button" class="btn outline-danger" id="rs">Reset demo data</button></div>' : ''}`;
  $('#f').onsubmit = e => { e.preventDefault(); run($('#sv'), async () => { const r = await call('admin_settings', { settings: { alert_emails: $('#st-a').value.trim(), bennetts_email: $('#st-b').value.trim() } }); data.settings = r.settings || data.settings; toast('Settings saved', 'ok'); }); };
  $('#pf').onsubmit = e => { e.preventDefault(); run($('#pv'), async () => {
    const a = $('#p-1').value, b = $('#p-2').value;
    if (!/^\d{6,}$/.test(a)) throw new Error('The PIN must be at least 6 digits.');
    if (a !== b) throw new Error('The two PINs do not match.');
    await call('admin_set_pin', { new_pin: a }); pin = a; ss.set(a); $('#p-1').value = $('#p-2').value = ''; toast('PIN changed', 'ok');
  }, '#perr'); };
  const rs = $('#rs'); if (rs) rs.onclick = async () => { if (!confirm('Reset all demo data?')) return; const m = await import('./mock.js'); m.resetMock(); ['ccdemo_code', 'ccdemo_ctx'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} }); ss.set(''); location.reload(); };
}
