/* Z Autoz CRM views: customers, vehicles, MOT reminders, add-from-paper import, settings.
   Loaded after crm.js; each view registers itself with ZA.crm.register(). */
(function () {
  const ZA = window.ZA, crm = ZA.crm, staff = ZA.staff, fmt = ZA.fmt, sb = ZA.sb, q = ZA.q;
  const { $, $$, esc } = crm;

  // ---------- tiny helpers ----------
  const isOwner = () => !!(crm.me && crm.me.role === 'owner');
  const uid = async () => (await staff.session()).user.id;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const fld = (label, inner, style) => `<div class="field"${style ? ` style="${style}"` : ''}><label>${label}</label>${inner}</div>`;
  const inp = (id, val, extra) => `<input class="input" id="${id}" value="${esc(val == null ? '' : val)}" ${extra || ''}>`;
  const nz = (v) => { v = (v == null ? '' : String(v)).trim(); return v === '' ? null : v; };
  const num = (v) => { v = String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''); return v === '' || isNaN(Number(v)) ? null : Number(v); };
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const MOT_RESULT = { pass: 'Pass', pass_advisories: 'Pass + advisories', fail: 'Fail' };
  const NOTE_KINDS = [['note', 'Note'], ['call', 'Call'], ['whatsapp', 'WhatsApp'], ['sms', 'Text'], ['email', 'Email'], ['handwritten', 'From paper']];
  const KIND_LABEL = { note: 'Note', call: 'Call', whatsapp: 'WhatsApp', sms: 'Text', email: 'Email', system: 'System', handwritten: 'From paper' };

  function openModal(title, body, footer) {
    const m = crm.modal(`<div class="drawer-h"><h3 style="margin:0">${title}</h3><button class="x" type="button" data-close>×</button></div>
      <div class="drawer-b">${body}</div>${footer ? `<div class="drawer-f">${footer}</div>` : ''}`);
    $$('[data-close]', m).forEach(b => b.onclick = () => crm.closeModal());
    return m;
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvCell = (v) => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const toCSV = (rows) => rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {
      const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} t.remove(); return ok;
    }
  }
  const platesHtml = (regs) => (regs || '').split(',').map(s => s.trim()).filter(Boolean).map(r => crm.plate(r)).join(' ') || '<span class="muted">—</span>';
  const ago = (ts) => { const d = Math.floor((Date.now() - new Date(ts)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };

  // UK phone tidy: "+447700900123" / "7700900123" -> "07700 900123"
  function normPhone(p) {
    let s = String(p || '').replace(/[^0-9+]/g, '');
    if (!s) return '';
    if (s.startsWith('+44')) s = '0' + s.slice(3); else if (s.startsWith('0044')) s = '0' + s.slice(4);
    else if (/^44\d{10}$/.test(s)) s = '0' + s.slice(2);
    else if (/^7\d{9}$/.test(s)) s = '0' + s;
    return s;
  }
  const phoneDigits = (p) => String(p || '').replace(/\D/g, '');
  function prettyPhone(p) {
    const s = normPhone(p);
    if (/^07\d{9}$/.test(s)) return s.slice(0, 5) + ' ' + s.slice(5);
    if (/^01\d{9}$|^02\d{9}$/.test(s)) return s.slice(0, 5) + ' ' + s.slice(5);
    return s || String(p || '').trim();
  }
  function splitName(s) {
    s = String(s || '').trim().replace(/\s+/g, ' ');
    if (!s) return ['', ''];
    const i = s.indexOf(' ');
    return i < 0 ? [tidyName(s), ''] : [tidyName(s.slice(0, i)), tidyName(s.slice(i + 1))];
  }
  function tidyName(s) {
    s = String(s || '').trim();
    if (s && (s === s.toUpperCase() || s === s.toLowerCase())) s = s.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    return s;
  }
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function isoOk(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null; }
  // dd/mm/yyyy, d/m/yy, yyyy-mm-dd, "12 Mar 2026", "12-Mar-26" -> ISO or null
  function parseDate(s) {
    s = String(s || '').trim(); if (!s) return null;
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) return isoOk(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/))) { let y = +m[3]; if (m[3].length === 2) y += 2000; return isoOk(y, +m[2], +m[1]); }
    if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-\/]+([A-Za-z]{3,9})\.?,?[\s\-\/]+(\d{2}|\d{4})$/))) {
      const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()); if (mi < 0) return null; let y = +m[3]; if (m[3].length === 2) y += 2000; return isoOk(y, mi + 1, +m[1]);
    }
    return null;
  }

  // View-specific styles live here so the stylesheet files stay untouched.
  (function injectCss() {
    if (document.getElementById('cv-css')) return;
    const s = document.createElement('style'); s.id = 'cv-css'; const extra = document.createElement('style'); extra.textContent = '.cv-drop{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;border:2px dashed #c6cbd4;border-radius:14px;padding:26px 16px;cursor:pointer;background:#fafbfc;color:var(--muted)}.cv-drop b{color:var(--text)}.cv-drop.on,.cv-drop:hover{border-color:var(--orange);background:#fff6f2}.cv-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px;margin-top:12px}.cv-thumb{position:relative;aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:#eef0f4;display:grid;place-items:center;font-weight:700;color:var(--muted)}.cv-thumb img{width:100%;height:100%;object-fit:cover}.cv-thumb button{position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;line-height:1}'; document.head.appendChild(extra);
    s.textContent = `
.cv-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.cv-search{position:relative;flex:1;min-width:200px;max-width:520px}
.cv-search svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:17px;color:var(--muted)}
.cv-search input{width:100%;padding:11px 14px 11px 38px;border-radius:999px;border:1.5px solid #d3d7de;background:#fff;font:inherit}
.cv-search input:focus{outline:none;border-color:var(--orange);box-shadow:0 0 0 4px rgba(255,106,19,.15)}
.cv-grid{display:grid;gap:0 12px;grid-template-columns:repeat(2,1fr)}
.cv-grid .span2{grid-column:1/-1}
@media(max-width:560px){.cv-grid{grid-template-columns:1fr}.row{flex-wrap:wrap}.row>*{min-width:130px}}
.cv-actions{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 14px}
.cv-stats{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:14px}
.cv-stats b{display:block;font:700 1.5rem/1.1 var(--display)}.cv-stats span{font-size:.8rem;color:var(--muted)}
.cv-note-add{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}.cv-note-add .input{flex:1;min-width:160px}
.cv-note-add select{width:130px;flex:none}
.cv-mot{background:#fff;border:1px solid #e3e6eb;border-radius:14px;padding:12px 14px;margin-bottom:10px;display:grid;grid-template-columns:auto 1fr;gap:6px 14px;align-items:center}
.cv-mot .who{min-width:0}.cv-mot .acts{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}
@media(min-width:900px){.cv-mot{grid-template-columns:150px minmax(150px,1.2fr) minmax(150px,1fr) auto}.cv-mot .acts{grid-column:auto;justify-content:flex-end}}
.cv-quick{display:grid;grid-template-columns:repeat(6,1fr);gap:0 12px}
.cv-quick .c2{grid-column:span 2}.cv-quick .c3{grid-column:span 3}.cv-quick .c6{grid-column:1/-1}
@media(max-width:700px){.cv-quick{grid-template-columns:1fr 1fr}.cv-quick .c2,.cv-quick .c3{grid-column:span 1}.cv-quick .c6{grid-column:1/-1}}
.cv-flash{animation:cvflash .7s ease-out}
@keyframes cvflash{0%{box-shadow:0 0 0 0 rgba(23,163,74,.8);background:#e9f8ef}100%{box-shadow:0 0 0 18px rgba(23,163,74,0);background:#fff}}
.cv-prog{height:14px;border-radius:99px;background:#e3e6ec;overflow:hidden}.cv-prog i{display:block;height:100%;width:0;background:var(--grad);transition:width .15s}
.cv-warn{color:#b33a00;font-size:.8rem}.cv-bad{color:var(--bad);font-size:.8rem}
.cv-map{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin:10px 0}
.cv-map div{background:#fff;border:1px solid #e3e6eb;border-radius:10px;padding:8px 10px}.cv-map small{display:block;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}
.cv-map select{width:100%;padding:7px 8px;border:1.5px solid #d3d7de;border-radius:8px;background:#fff}
.cv-sess li{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid #f0f1f4;list-style:none}
.cv-sess{padding:0;margin:0}
.cv-tbl-edit input[type=text],.cv-tbl-edit input[type=number],.cv-tbl-edit select{width:100%;min-width:70px;padding:6px 8px;border:1px solid #d3d7de;border-radius:7px;font:inherit;background:#fff}
.cv-tbl-edit td{vertical-align:middle}
.cv-hours{display:grid;grid-template-columns:100px 90px 1fr;gap:8px;align-items:center;margin-bottom:6px}
.cv-hours .t{display:flex;gap:6px;align-items:center}.cv-hours input[type=time]{padding:6px 8px;border:1px solid #d3d7de;border-radius:7px;font:inherit}
.cv-bay{display:flex;gap:6px;align-items:center;margin-bottom:6px}.cv-bay input{flex:1;min-width:0;padding:7px 9px;border:1px solid #d3d7de;border-radius:7px;font:inherit}.cv-bay select{padding:7px;border:1px solid #d3d7de;border-radius:7px}
.cv-bay button{border:1px solid #d3d7de;background:#fff;border-radius:7px;padding:5px 9px;cursor:pointer}
.cv-sub{font-family:var(--font);font-size:.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:14px 0 8px}
`;
    document.head.appendChild(s);
  })();

  // ---------- shared data logic ----------
  async function logNote(row) { return staff.addNote(Object.assign({ created_by: await uid() }, row)); }
  const conflictHtml = (ex, toName) => `<div class="notice" id="conf"><b>${esc(fmt.plate(ex.reg))}</b> is already on file${ex.za_customers ? ' with <b>' + esc(fmt.name(ex.za_customers)) + '</b> ' + esc(ex.za_customers.phone || '') : ''}.
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn btn-dark btn-sm" id="cmove">Move this car to ${esc(toName)}</button><button type="button" class="btn btn-ghost btn-sm" id="ccancel">Cancel</button></div></div>`;

  // Attach a car to a customer. If the reg exists with another owner and allowMove is false, returns {status:'conflict'}.
  async function attachVehicle(custId, custName, f, allowMove) {
    const reg = fmt.normReg(f.reg);
    const fills = {}; ['make', 'model', 'colour'].forEach(k => { if (nz(f[k])) fills[k] = f[k].trim(); }); if (f.mot_expiry) fills.mot_expiry = f.mot_expiry;
    const ex = await staff.vehicleByReg(reg);
    if (!ex) return { status: 'created', vehicle: await staff.saveVehicle(Object.assign({ reg, customer_id: custId }, fills)) };
    if (ex.customer_id === custId) return { status: 'same', vehicle: await staff.saveVehicle(Object.assign({ id: ex.id }, fills)) };
    if (ex.customer_id && !allowMove) return { status: 'conflict', existing: ex };
    const prev = ex.za_customers ? fmt.name(ex.za_customers) : 'nobody';
    const v = await staff.saveVehicle(Object.assign({ id: ex.id, customer_id: custId }, fills));
    await logNote({ vehicle_id: ex.id, customer_id: custId, kind: 'system', body: `Owner changed from ${prev} to ${custName}` });
    return { status: 'moved', vehicle: v };
  }

  // Shared timeline of notes with an add box. opts: {col:'customer_id'|'vehicle_id', id, customerId, vehicleId}
  function notesPanel(host, notes, opts) {
    host.innerHTML = `<h3>Notes & history <span>${notes.length}</span></h3>
      <div class="cv-note-add"><input class="input" id="nbody" placeholder="Add a note (Enter to save)"><select class="input" id="nkind">${NOTE_KINDS.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select><button class="btn btn-dark btn-sm" id="nadd" type="button">Add</button></div>
      <ul class="timeline">${notes.map(n => `<li class="k-${esc(n.kind)}"><div class="when">${fmt.day(n.created_at)} ${fmt.time(n.created_at)} · ${esc(KIND_LABEL[n.kind] || n.kind)}</div><div style="white-space:pre-wrap">${esc(n.body)}</div></li>`).join('') || '<li class="muted">Nothing yet</li>'}</ul>`;
    const add = async () => {
      const body = $('#nbody', host).value.trim(); if (!body) return;
      try {
        const n = await logNote({ customer_id: opts.customerId || null, vehicle_id: opts.vehicleId || null, body, kind: $('#nkind', host).value });
        notes.unshift(n); crm.toast('Note added'); notesPanel(host, notes, opts);
      } catch (e) { crm.fail(e); }
    };
    $('#nadd', host).onclick = add;
    $('#nbody', host).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  }

  // ---------- 1. CUSTOMERS ----------
  crm.register('customers', {
    title: 'Customers', nav: true,
    async render(el) {
      let text = '', seq = 0, rows = [];
      el.innerHTML = `<div class="cv-bar"><div class="cv-search">${crm.ICONS.search}<input id="cs" placeholder="Search name, phone, reg or email…" autocomplete="off"></div>
        <button class="btn btn-primary btn-sm" id="cadd" type="button">+ Add customer</button><button class="btn btn-ghost btn-sm" id="cexp" type="button">Export CSV</button></div>
        <div class="small muted" id="cinfo" style="margin-bottom:8px"></div><div id="clist"></div>`;
      async function load() {
        const my = ++seq; $('#clist', el).innerHTML = '<div class="skeleton" style="height:160px"></div>';
        try {
          const r = await staff.search(text, 100); if (my !== seq) return; rows = r || []; draw();
        } catch (e) { if (my === seq) { $('#clist', el).innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; } crm.fail(e); }
      }
      function draw() {
        $('#cinfo', el).textContent = rows.length ? `${rows.length}${rows.length >= 100 ? '+' : ''} ${text ? 'matching' : 'most recent'} customers` : '';
        if (!rows.length) {
          $('#clist', el).innerHTML = `<div class="tbl-wrap" style="background:#fff"><div class="empty-state"><b>${text ? 'Nobody found for “' + esc(text) + '”' : 'No customers yet'}</b>
            ${text ? 'Check the spelling, or try just the last few digits of the phone number or the reg.' : 'Add your first customer, or type up the paper records from the Add from paper page.'}
            <div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn btn-primary btn-sm" type="button" data-add>+ Add customer</button><button class="btn btn-ghost btn-sm" type="button" data-go="#/import">Add from paper</button></div></div></div>`;
        } else {
          $('#clist', el).innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Phone</th><th>Vehicles</th><th>Next MOT</th><th>Last visit</th><th>Bookings</th></tr></thead><tbody>${rows.map(c => `
            <tr class="click" data-id="${c.id}"><td><b>${esc(fmt.name(c))}</b>${(c.tags || []).map(t => ` <span class="tag">${esc(t)}</span>`).join('')}</td>
            <td>${c.phone ? `<a href="${fmt.phoneHref(c.phone)}">${esc(c.phone)}</a>` : '<span class="muted">—</span>'}</td>
            <td>${platesHtml(c.regs)}</td><td>${c.next_mot ? crm.motPill(c.next_mot) : '<span class="muted">—</span>'}</td>
            <td>${c.last_booking ? fmt.date(c.last_booking) : '<span class="muted">—</span>'}</td><td>${c.booking_count || 0}</td></tr>`).join('')}</tbody></table></div>`;
        }
        $$('tr.click', el).forEach(tr => tr.onclick = e => { if (e.target.closest('a')) return; crm.go('#/customer/' + tr.dataset.id); });
        $$('[data-add]', el).forEach(b => b.onclick = () => addCustomerModal(() => load()));
        $$('[data-go]', el).forEach(b => b.onclick = () => crm.go(b.dataset.go));
      }
      $('#cs', el).addEventListener('input', debounce(e => { text = e.target.value.trim(); load(); }, 250));
      $('#cadd', el).onclick = () => addCustomerModal(() => load());
      $('#cexp', el).onclick = async () => {
        try {
          const all = await staff.search(text, 5000);
          const head = ['First name', 'Last name', 'Phone', 'Email', 'Postcode', 'Vehicles', 'Next MOT', 'Last visit', 'Bookings', 'Marketing OK'];
          download(`z-autoz-customers-${fmt.today()}.csv`, toCSV([head].concat(all.map(c => [c.first_name, c.last_name, c.phone, c.email, c.postcode, c.regs, c.next_mot, c.last_booking ? fmt.isoDay(new Date(c.last_booking)) : '', c.booking_count, c.marketing_opt_in ? 'yes' : 'no']))));
          crm.toast(`Exported ${all.length} customers`);
        } catch (e) { crm.fail(e); }
      };
      await load(); $('#cs', el).focus();
    }
  });

  function addCustomerModal(after) {
    const m = openModal('Add customer', `
      <div class="row">${fld('First name', inp('af', '', 'autocomplete="off"'))}${fld('Last name', inp('al', '', 'autocomplete="off"'))}</div>
      <div class="row">${fld('Phone', inp('ap', '', 'type="tel"'))}${fld('Email', inp('ae', '', 'type="email"'))}</div>
      <div class="row">${fld('Postcode', inp('az', ''), 'max-width:200px')}${fld('Notes', inp('an', ''))}</div>
      <label class="check" style="margin-bottom:14px"><input type="checkbox" id="am"> OK to send marketing / reminders</label>
      <div class="box"><h4>First vehicle (optional)</h4>
        <div class="field"><label>Registration</label><div class="plate sm"><div class="gb"><i>★</i>UK</div><input id="ar" placeholder="AB12 CDE" autocomplete="off"></div></div>
        <div class="row">${fld('Make', inp('amk', ''))}${fld('Model', inp('amd', ''))}${fld('MOT expiry', inp('amo', '', 'type="date"'))}</div></div>
      <div id="aconf"></div><div id="aerr" class="notice bad" style="display:none"></div>`,
      '<button class="btn btn-primary" type="button" id="asave">Save customer</button><button class="btn btn-ghost" type="button" data-close>Cancel</button>');
    $$('[data-close]', m).forEach(b => b.onclick = () => crm.closeModal());
    $('#ar', m).addEventListener('input', e => { e.target.value = fmt.plate(e.target.value); });
    let created = null;
    async function save(allowMove) {
      const err = $('#aerr', m); err.style.display = 'none'; $('#aconf', m).innerHTML = '';
      const btn = $('#asave', m); btn.disabled = true;
      try {
        const fn = $('#af', m).value.trim(), ln = $('#al', m).value.trim(), ph = $('#ap', m).value.trim(), reg = fmt.normReg($('#ar', m).value);
        if (!fn && !ln && !ph) throw new Error('Enter a name or a phone number.');
        if (reg && !fmt.plateValid(reg)) throw new Error('That registration does not look right.');
        if (reg && !allowMove) { const ex = await staff.vehicleByReg(reg); if (ex && ex.customer_id) { $('#aconf', m).innerHTML = conflictHtml(ex, fmt.name({ first_name: fn, last_name: ln }) || 'the new customer'); $('#cmove', m).onclick = () => save(true); $('#ccancel', m).onclick = () => crm.closeModal(); btn.disabled = false; return; } }
        if (!created) created = await staff.saveCustomer({ first_name: tidyName(fn), last_name: tidyName(ln), phone: nz(ph) && prettyPhone(ph), email: nz($('#ae', m).value), postcode: nz($('#az', m).value), notes: nz($('#an', m).value), marketing_opt_in: $('#am', m).checked, source: 'walk-in' });
        if (reg) await attachVehicle(created.id, fmt.name(created), { reg, make: $('#amk', m).value, model: $('#amd', m).value, mot_expiry: $('#amo', m).value }, true);
        crm.closeModal(); crm.toast('Customer added'); if (after) after(created);
        crm.go('#/customer/' + created.id);
      } catch (e) { err.textContent = e.message; err.style.display = ''; btn.disabled = false; }
    }
    $('#asave', m).onclick = () => save(false);
  }

  // ---------- 2. CUSTOMER PROFILE ----------
  crm.register('customer', {
    title: 'Customer', nav: false,
    async render(el, params) {
      const id = params[0]; if (!id) return crm.go('#/customers');
      let c, vehicles, history, notes;
      try { [c, vehicles, history, notes] = await Promise.all([staff.customer(id), staff.vehiclesOf(id), staff.historyOfCustomer(id), staff.notes('customer_id', id)]); }
      catch (e) { el.innerHTML = `<div class="notice bad">Could not find that customer. They may have been deleted. <a href="#/customers">Back to customers</a></div>`; return; }
      const again = () => crm.refresh();
      const spent = history.filter(b => b.status === 'collected').reduce((s, b) => s + (Number(b.price_final) || 0), 0);
      const visits = history.filter(b => b.status === 'collected').length;
      $('#title').textContent = fmt.name(c);
      el.innerHTML = `<div class="profile">
        <div>
          <div class="panel"><h3>Details</h3>
            <div class="cv-actions">
              <button class="btn btn-ghost btn-sm" type="button" data-act="call" ${c.phone ? '' : 'disabled'}>${crm.ICONS.phone.replace('<svg', '<svg width="15" height="15"')} Call</button>
              <button class="btn btn-green btn-sm" type="button" data-act="wa" ${c.phone ? '' : 'disabled'}>WhatsApp</button>
              <button class="btn btn-dark btn-sm" type="button" data-act="sms" ${c.phone ? '' : 'disabled'}>Text</button>
              <button class="btn btn-primary btn-sm" type="button" data-act="book">+ New booking</button></div>
            <div class="row">${fld('First name', inp('cf', c.first_name))}${fld('Last name', inp('cl', c.last_name))}</div>
            ${fld('Phone', inp('cp', c.phone, 'type="tel"'))}${fld('Second phone', inp('cp2', c.phone2, 'type="tel"'))}${fld('Email', inp('ce', c.email, 'type="email"'))}
            ${fld('Address', inp('ca', c.address))}${fld('Postcode', inp('cz', c.postcode), 'max-width:200px')}
            ${fld('Notes', `<textarea class="input" id="cn" rows="3">${esc(c.notes || '')}</textarea>`)}
            ${fld('Tags (comma separated)', inp('ct', (c.tags || []).join(', '), 'placeholder="e.g. taxi, fleet, VIP"'))}
            <label class="check" style="margin-bottom:14px"><input type="checkbox" id="cm" ${c.marketing_opt_in ? 'checked' : ''}> OK to send marketing / MOT reminders</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" type="button" id="csave">Save</button>
            ${isOwner() ? '<button class="btn btn-ghost btn-sm" type="button" id="cdel" style="color:var(--bad)">Delete customer</button>' : ''}</div>
            <p class="small muted" style="margin:12px 0 0">Customer since ${fmt.date(c.created_at)} · source: ${esc(c.source)}</p>
          </div></div>
        <div>
          <div class="panel"><div class="cv-stats"><div><b>${fmt.money(spent)}</b><span>spent in total</span></div><div><b>${visits}</b><span>completed visits</span></div><div><b>${history.length}</b><span>bookings</span></div></div></div>
          <div class="panel"><h3>Vehicles <button class="btn btn-ghost btn-sm" type="button" id="vadd" style="padding:5px 12px">+ Add vehicle</button></h3>
            ${vehicles.map(v => `<div class="veh" data-vid="${v.id}">${crm.plate(v.reg)}<div style="flex:1;min-width:0"><b>${esc([v.make, v.model].filter(Boolean).join(' ') || 'Details not recorded')}</b>${v.colour ? ' <span class="muted">· ' + esc(v.colour) + '</span>' : ''}<div class="small muted">${v.last_mileage ? Number(v.last_mileage).toLocaleString('en-GB') + ' miles' : ''}</div></div>${crm.motPill(v.mot_expiry)}</div>`).join('') || '<div class="muted small">No vehicles yet.</div>'}
          </div>
          <div class="panel"><h3>Bookings <span>${history.length}</span></h3>${history.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Reg</th><th>Job</th><th>Site</th><th>Status</th><th>Price</th></tr></thead><tbody>${history.map(b => `
            <tr class="click" data-bid="${b.id}"><td>${fmt.date(b.starts_at)}</td><td>${crm.plate(b.reg_display || b.vehicle_reg)}</td><td>${esc(b.service_name)}</td><td>${esc(crm.locName(b.location_id))}</td><td>${crm.statusPill(b.status)}</td><td>${fmt.money(b.price_final != null ? b.price_final : b.price_quoted)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small">No bookings yet.</div>'}</div>
          <div class="panel" id="notes"></div>
        </div></div>`;
      notesPanel($('#notes', el), notes, { col: 'customer_id', id, customerId: id });
      $$('.veh', el).forEach(v => v.onclick = () => crm.go('#/vehicle/' + v.dataset.vid));
      $$('[data-bid]', el).forEach(r => r.onclick = () => crm.openBooking(r.dataset.bid, again));
      $$('[data-act]', el).forEach(b => b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'call') location.href = fmt.phoneHref(c.phone);
        else if (a === 'wa') window.open(fmt.whatsapp(c.phone, crm.whatsappText(c, vehicles[0], 'other')), '_blank', 'noopener');
        else if (a === 'sms') location.href = 'sms:' + String(c.phone).replace(/[^0-9+]/g, '');
        else crm.newBooking({ customer: c, reg: vehicles[0] && vehicles[0].reg }, again);
      });
      $('#csave', el).onclick = async () => {
        try {
          await staff.saveCustomer({ id, first_name: $('#cf', el).value.trim(), last_name: $('#cl', el).value.trim(), phone: nz($('#cp', el).value), phone2: nz($('#cp2', el).value), email: nz($('#ce', el).value),
            address: nz($('#ca', el).value), postcode: nz($('#cz', el).value), notes: nz($('#cn', el).value), marketing_opt_in: $('#cm', el).checked,
            tags: $('#ct', el).value.split(',').map(s => s.trim()).filter(Boolean) });
          crm.toast('Saved'); again();
        } catch (e) { crm.fail(e); }
      };
      if ($('#cdel', el)) $('#cdel', el).onclick = async () => {
        if (!confirm(`Delete ${fmt.name(c)}? They will be hidden from the customer list. Their bookings stay in the diary.`)) return;
        try { await staff.deleteCustomer(id); crm.toast('Customer deleted'); crm.go('#/customers'); } catch (e) { crm.fail(e); }
      };
      $('#vadd', el).onclick = () => addVehicleModal(c, again);
    }
  });

  function addVehicleModal(c, after) {
    const m = openModal('Add vehicle to ' + esc(fmt.name(c)), `
      <div class="field"><label>Registration</label><div class="plate sm"><div class="gb"><i>★</i>UK</div><input id="vr" placeholder="AB12 CDE" autocomplete="off"></div><div id="vmatch" class="small" style="margin-top:8px"></div></div>
      <div class="row">${fld('Make', inp('vmk', ''))}${fld('Model', inp('vmd', ''))}</div>
      <div class="row">${fld('Colour', inp('vcl', ''))}${fld('MOT expiry', inp('vmo', '', 'type="date"'))}</div>
      <div id="vconf"></div><div id="verr" class="notice bad" style="display:none"></div>`,
      '<button class="btn btn-primary" type="button" id="vsave">Add vehicle</button><button class="btn btn-ghost" type="button" data-close>Cancel</button>');
    const look = debounce(async () => {
      const reg = fmt.normReg($('#vr', m).value); const box = $('#vmatch', m); box.innerHTML = '';
      if (reg.length < 2) return;
      try {
        const ex = await staff.vehicleByReg(reg); if (!ex) return;
        box.innerHTML = `<span class="notice ok" style="display:inline-block">Already on file: ${esc([ex.make, ex.model].filter(Boolean).join(' ') || 'details not recorded')}${ex.za_customers ? ' · owner ' + esc(fmt.name(ex.za_customers)) : ''}</span>`;
        if (ex.make && !$('#vmk', m).value) $('#vmk', m).value = ex.make; if (ex.model && !$('#vmd', m).value) $('#vmd', m).value = ex.model; if (ex.mot_expiry && !$('#vmo', m).value) $('#vmo', m).value = ex.mot_expiry;
      } catch (_) {}
    }, 350);
    $('#vr', m).addEventListener('input', e => { e.target.value = fmt.plate(e.target.value); look(); });
    async function save(allowMove) {
      const err = $('#verr', m); err.style.display = 'none'; $('#vconf', m).innerHTML = ''; const btn = $('#vsave', m); btn.disabled = true;
      try {
        const reg = fmt.normReg($('#vr', m).value);
        if (!reg) throw new Error('Enter the registration.');
        if (!fmt.plateValid(reg)) throw new Error('That registration does not look right.');
        const r = await attachVehicle(c.id, fmt.name(c), { reg, make: $('#vmk', m).value, model: $('#vmd', m).value, colour: $('#vcl', m).value, mot_expiry: $('#vmo', m).value }, allowMove);
        if (r.status === 'conflict') { $('#vconf', m).innerHTML = conflictHtml(r.existing, fmt.name(c)); $('#cmove', m).onclick = () => save(true); $('#ccancel', m).onclick = () => crm.closeModal(); btn.disabled = false; return; }
        crm.closeModal(); crm.toast(r.status === 'moved' ? 'Car moved to ' + fmt.name(c) : 'Vehicle added'); after();
      } catch (e) { err.textContent = e.message; err.style.display = ''; btn.disabled = false; }
    }
    $('#vsave', m).onclick = () => save(false);
  }

  // ---------- 3. VEHICLES ----------
  crm.register('vehicles', {
    title: 'Vehicles', nav: true,
    async render(el) {
      let text = '', seq = 0;
      el.innerHTML = `<div class="cv-bar"><div class="plate sm" style="max-width:300px;flex:1"><div class="gb"><i>★</i>UK</div><input id="vq" placeholder="Search reg" autocomplete="off" autocapitalize="characters" inputmode="text"></div>
        <span class="small muted">Type any part of a registration.</span></div><div id="vnew"></div><div id="vlist"></div>`;
      async function load() {
        const my = ++seq; $('#vlist', el).innerHTML = '<div class="skeleton" style="height:160px"></div>';
        try {
          const rows = await staff.vehicles(text); if (my !== seq) return;
          const reg = fmt.normReg(text);
          const exact = rows.some(v => v.reg === reg);
          $('#vnew', el).innerHTML = reg && fmt.plateValid(reg) && !exact ? `<div class="notice" style="margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">${crm.plate(reg)}<span>Not on file yet.</span><button class="btn btn-primary btn-sm" type="button" id="vbook">New vehicle — book it in</button></div>` : '';
          if ($('#vbook', el)) $('#vbook', el).onclick = () => crm.newBooking({ reg }, () => load());
          $('#vlist', el).innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Reg</th><th>Vehicle</th><th>Owner</th><th>MOT</th><th>Mileage</th><th>Updated</th></tr></thead><tbody>${rows.map(v => `
            <tr class="click" data-id="${v.id}"><td>${crm.plate(v.reg)}</td><td><b>${esc([v.make, v.model].filter(Boolean).join(' ') || '—')}</b>${v.colour ? '<div class="small muted">' + esc(v.colour) + '</div>' : ''}</td>
            <td>${v.za_customers ? esc(fmt.name(v.za_customers)) + '<div class="small muted">' + esc(v.za_customers.phone || '') + '</div>' : '<span class="muted">No owner</span>'}</td>
            <td>${v.mot_expiry ? crm.motPill(v.mot_expiry) : '<span class="muted">—</span>'}</td><td>${v.last_mileage ? Number(v.last_mileage).toLocaleString('en-GB') : '—'}</td><td>${fmt.date(v.updated_at)}</td></tr>`).join('')}</tbody></table></div>
            <p class="small muted" style="margin-top:8px">${rows.length >= 100 ? 'Showing the 100 most recently updated. Type a reg to narrow it down.' : rows.length + ' vehicles'}</p>`
            : `<div class="tbl-wrap" style="background:#fff"><div class="empty-state"><b>${text ? 'No vehicle matches “' + esc(text) + '”' : 'No vehicles yet'}</b>Cars appear here once they are booked in or typed up from paper.</div></div>`;
          $$('tr.click', el).forEach(tr => tr.onclick = () => crm.go('#/vehicle/' + tr.dataset.id));
        } catch (e) { $('#vlist', el).innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; crm.fail(e); }
      }
      $('#vq', el).addEventListener('input', e => { e.target.value = fmt.plate(e.target.value); text = e.target.value.trim(); debouncedLoad(); });
      const debouncedLoad = debounce(load, 250);
      await load(); $('#vq', el).focus();
    }
  });

  // ---------- 4. VEHICLE ----------
  function mileageChart(history) {
    const pts = history.filter(b => b.mileage).map(b => ({ t: new Date(b.starts_at).getTime(), m: Number(b.mileage) })).sort((a, b) => a.t - b.t);
    if (pts.length < 2) return '';
    const W = 320, H = 110, P = 26, t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    const mn = Math.min(...pts.map(p => p.m)), mx = Math.max(...pts.map(p => p.m)), span = Math.max(1, mx - mn);
    const X = p => P + (t1 === t0 ? 0 : (p.t - t0) / (t1 - t0)) * (W - 2 * P), Y = p => H - 18 - ((p.m - mn) / span) * (H - 38);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:460px;height:auto" role="img" aria-label="Mileage over time">
      <polyline fill="none" stroke="#ff6a13" stroke-width="2.5" stroke-linejoin="round" points="${pts.map(p => X(p).toFixed(1) + ',' + Y(p).toFixed(1)).join(' ')}"/>
      ${pts.map(p => `<circle cx="${X(p).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="3.5" fill="#d4213d"><title>${fmt.date(new Date(p.t).toISOString())}: ${p.m.toLocaleString('en-GB')} miles</title></circle>`).join('')}
      <text x="${P}" y="${H - 3}" font-size="9" fill="#5d6472">${fmt.date(new Date(t0).toISOString())}</text><text x="${W - P}" y="${H - 3}" font-size="9" fill="#5d6472" text-anchor="end">${fmt.date(new Date(t1).toISOString())}</text>
      <text x="${P}" y="10" font-size="9" fill="#5d6472">${mx.toLocaleString('en-GB')} mi</text><text x="${W - P}" y="10" font-size="9" fill="#5d6472" text-anchor="end">${mn.toLocaleString('en-GB')} mi (first)</text></svg>`;
  }

  crm.register('vehicle', {
    title: 'Vehicle', nav: false,
    async render(el, params) {
      const id = params[0]; if (!id) return crm.go('#/vehicles');
      let v, history, notes;
      try { [v, history, notes] = await Promise.all([staff.vehicle(id), staff.historyOfVehicle(id), staff.notes('vehicle_id', id)]); }
      catch (e) { el.innerHTML = `<div class="notice bad">Could not find that vehicle. <a href="#/vehicles">Back to vehicles</a></div>`; return; }
      const again = () => crm.refresh(); const own = v.za_customers;
      $('#title').textContent = fmt.plate(v.reg);
      el.innerHTML = `<div class="profile"><div>
        <div class="panel"><div style="margin-bottom:14px"><span class="plate-badge lg">${esc(fmt.plate(v.reg))}</span> ${crm.motPill(v.mot_expiry)}</div>
          <div class="row">${fld('Make', inp('xmk', v.make))}${fld('Model', inp('xmd', v.model))}</div>
          <div class="row">${fld('Colour', inp('xcl', v.colour))}${fld('Fuel', `<select class="input" id="xfu"><option value=""></option>${['petrol', 'diesel', 'hybrid', 'electric', 'other'].map(f => `<option ${v.fuel_type === f ? 'selected' : ''}>${f}</option>`).join('')}</select>`)}</div>
          <div class="row">${fld('Year', inp('xyr', v.year, 'inputmode="numeric"'))}${fld('Engine cc', inp('xcc', v.engine_cc, 'inputmode="numeric"'))}</div>
          <div class="row">${fld('MOT expiry', inp('xmo', v.mot_expiry, 'type="date"'))}${fld('Tax due', inp('xtx', v.tax_due, 'type="date"'))}</div>
          ${fld('Last mileage', inp('xmi', v.last_mileage, 'inputmode="numeric"'), 'max-width:200px')}
          ${fld('Notes', `<textarea class="input" id="xnt" rows="3">${esc(v.notes || '')}</textarea>`)}
          <div class="cv-actions"><button class="btn btn-primary btn-sm" type="button" id="xsave">Save</button><button class="btn btn-dark btn-sm" type="button" id="xbook">Book this car</button></div>
          <div class="gov-row">${fmt.govBtn(v.reg, 'MOT history on GOV.UK')}</div>
        </div>
        <div class="panel"><h3>Owner <button class="btn btn-ghost btn-sm" type="button" id="xown" style="padding:5px 12px">Change owner</button></h3>
          ${own ? `<div class="veh" data-cid="${own.id}"><div style="flex:1"><b>${esc(fmt.name(own))}</b><div class="small muted">${esc(own.phone || '')} ${esc(own.email || '')}</div></div><span class="muted">›</span></div>` : '<div class="muted small">No owner linked to this car.</div>'}</div>
      </div><div>
        <div class="panel"><h3>Service history <span>${history.length}</span></h3>${history.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Job</th><th>Site</th><th>Status</th><th>Miles</th><th>MOT</th><th>Price</th></tr></thead><tbody>${history.map(b => `
          <tr class="click" data-bid="${b.id}"><td>${fmt.date(b.starts_at)}</td><td>${esc(b.service_name)}</td><td>${esc(crm.locName(b.location_id))}</td><td>${crm.statusPill(b.status)}</td><td>${b.mileage ? Number(b.mileage).toLocaleString('en-GB') : '—'}</td><td>${b.mot_result ? esc(MOT_RESULT[b.mot_result] || b.mot_result) : '—'}</td><td>${fmt.money(b.price_final != null ? b.price_final : b.price_quoted)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small">No bookings yet.</div>'}</div>
        ${mileageChart(history) ? `<div class="panel"><h3>Mileage</h3>${mileageChart(history)}</div>` : ''}
        <div class="panel" id="notes"></div></div></div>`;
      notesPanel($('#notes', el), notes, { col: 'vehicle_id', id, vehicleId: id, customerId: v.customer_id });
      $$('[data-bid]', el).forEach(r => r.onclick = () => crm.openBooking(r.dataset.bid, again));
      if ($('[data-cid]', el)) $('[data-cid]', el).onclick = () => crm.go('#/customer/' + own.id);
      $('#xbook', el).onclick = () => crm.newBooking({ reg: v.reg, customer: own || undefined }, again);
      $('#xsave', el).onclick = async () => {
        try {
          await staff.saveVehicle({ id, make: nz($('#xmk', el).value), model: nz($('#xmd', el).value), colour: nz($('#xcl', el).value), fuel_type: nz($('#xfu', el).value),
            year: num($('#xyr', el).value), engine_cc: num($('#xcc', el).value), mot_expiry: nz($('#xmo', el).value), tax_due: nz($('#xtx', el).value), last_mileage: num($('#xmi', el).value), notes: nz($('#xnt', el).value) });
          crm.toast('Saved'); again();
        } catch (e) { crm.fail(e); }
      };
      $('#xown', el).onclick = () => changeOwnerModal(v, own, again);
    }
  });

  function changeOwnerModal(v, oldOwner, after) {
    const m = openModal('Change owner of ' + esc(fmt.plate(v.reg)), `
      <div class="field"><label>Find a customer</label><input class="input" id="oq" placeholder="Name, phone or reg" autocomplete="off"></div>
      <div id="ores" style="margin-bottom:14px"></div>
      <div class="box"><h4>Or create a new customer</h4><div class="row">${fld('First name', inp('onf', ''))}${fld('Last name', inp('onl', ''))}</div>
        <div class="row">${fld('Phone', inp('onp', '', 'type="tel"'))}<div style="display:flex;align-items:end;padding-bottom:14px"><button class="btn btn-dark btn-sm" type="button" id="ocreate">Create and assign</button></div></div></div>`);
    const prevName = oldOwner ? fmt.name(oldOwner) : 'nobody';
    async function assign(c) {
      try {
        await staff.saveVehicle({ id: v.id, customer_id: c.id });
        await logNote({ vehicle_id: v.id, customer_id: c.id, kind: 'system', body: `Owner changed from ${prevName} to ${fmt.name(c)}` });
        crm.closeModal(); crm.toast('Owner changed'); after();
      } catch (e) { crm.fail(e); }
    }
    const run = debounce(async () => {
      const t = $('#oq', m).value.trim(); const box = $('#ores', m);
      if (t.length < 2) { box.innerHTML = ''; return; }
      try {
        const rows = await staff.search(t, 8);
        box.innerHTML = rows.map(c => `<div class="veh" data-id="${c.id}"><div style="flex:1"><b>${esc(fmt.name(c))}</b><div class="small muted">${esc(c.phone || '')} ${c.regs ? '· ' + esc(c.regs) : ''}</div></div><button class="btn btn-dark btn-sm" type="button">Pick</button></div>`).join('') || '<div class="muted small">No matches. Create a new customer below.</div>';
        $$('.veh', box).forEach(r => r.onclick = () => assign(rows.find(c => c.id === r.dataset.id)));
      } catch (e) { crm.fail(e); }
    }, 250);
    $('#oq', m).addEventListener('input', run);
    $('#ocreate', m).onclick = async () => {
      const fn = $('#onf', m).value.trim(), ln = $('#onl', m).value.trim(), ph = $('#onp', m).value.trim();
      if (!fn && !ln && !ph) return crm.toast('Enter a name or phone for the new customer', true);
      try { assign(await staff.saveCustomer({ first_name: tidyName(fn), last_name: tidyName(ln), phone: nz(ph) && prettyPhone(ph), source: 'walk-in' })); } catch (e) { crm.fail(e); }
    };
  }

  // ---------- 5. MOT REMINDERS ----------
  crm.register('mot', {
    title: 'MOT reminders', nav: true,
    async render(el) {
      const BUCKETS = [['over', 'Overdue', -365, -1], ['w1', 'Due in 7 days', 0, 7], ['d30', 'Due in 30 days', 0, 30], ['d60', 'Due in 31–60 days', 31, 60]];
      let cur = 'w1', all = [], last = {};
      el.innerHTML = `<p class="muted small" style="margin:0 0 12px">Customers can MOT up to a month (minus a day) early and keep their renewal date.</p>
        <div class="cv-bar"><div class="seg" id="mseg" style="flex-wrap:wrap"></div><span style="flex:1"></span><button class="btn btn-ghost btn-sm" type="button" id="mcopy">Copy all numbers</button></div><div id="mlist"><div class="skeleton" style="height:160px"></div></div>`;
      const inB = (r, b) => r.days_left >= b[2] && r.days_left <= b[3];
      async function load() {
        all = await staff.motDue(-365, 60);
        const ids = all.map(r => r.vehicle_id); last = {};
        for (let i = 0; i < ids.length; i += 80) {
          const chunk = ids.slice(i, i + 80);
          const ns = await q(sb.from('za_notes').select('vehicle_id,created_at,kind').in('vehicle_id', chunk).ilike('body', 'MOT reminder%').order('created_at', { ascending: false }));
          (ns || []).forEach(n => { if (!last[n.vehicle_id]) last[n.vehicle_id] = n; });
        }
        draw();
      }
      const rowsNow = () => { const b = BUCKETS.find(x => x[0] === cur); return all.filter(r => inB(r, b)).sort((a, b) => a.mot_expiry.localeCompare(b.mot_expiry)); };
      function draw() {
        $('#mseg', el).innerHTML = BUCKETS.map(b => `<button type="button" data-b="${b[0]}" class="${cur === b[0] ? 'on' : ''}">${b[1]} <span style="opacity:.7">${all.filter(r => inB(r, b)).length}</span></button>`).join('');
        $$('#mseg button', el).forEach(b => b.onclick = () => { cur = b.dataset.b; draw(); });
        const rows = rowsNow();
        $('#mlist', el).innerHTML = rows.map(r => {
          const n = r.days_left, l = last[r.vehicle_id];
          const when = n < 0 ? `${-n} day${n === -1 ? '' : 's'} overdue` : n === 0 ? 'due today' : `in ${n} day${n === 1 ? '' : 's'}`;
          return `<div class="cv-mot" data-vid="${r.vehicle_id}"><div>${crm.plate(r.reg)}</div>
            <div class="who"><b>${esc([r.make, r.model].filter(Boolean).join(' ') || 'Car')}</b><div class="small muted">Expires ${fmt.date(r.mot_expiry)} · <span class="${n < 0 ? 'error' : ''}">${when}</span></div></div>
            <div class="who">${r.customer_id ? `<a href="#/customer/${r.customer_id}"><b>${esc(fmt.name(r))}</b></a>` : '<span class="muted">No owner</span>'}<div class="small muted">${esc(r.phone || 'no phone')}</div>
              <div class="small" style="margin-top:3px">${r.mot_booked ? '<span class="tag green">Booked</span> ' : ''}${l ? `<span class="muted">Contacted ${ago(l.created_at)} (${esc(l.kind)})</span>` : '<span class="muted">Not contacted</span>'}</div></div>
            <div class="acts"><button class="btn btn-green btn-sm" type="button" data-a="wa" ${r.phone ? '' : 'disabled'}>WhatsApp</button><button class="btn btn-dark btn-sm" type="button" data-a="sms" ${r.phone ? '' : 'disabled'}>Text</button>
              <button class="btn btn-ghost btn-sm" type="button" data-a="call" ${r.phone ? '' : 'disabled'}>Call</button><button class="btn btn-ghost btn-sm" type="button" data-a="done">Mark contacted</button><button class="btn btn-primary btn-sm" type="button" data-a="book">Book</button></div></div>`;
        }).join('') || '<div class="tbl-wrap" style="background:#fff"><div class="empty-state"><b>Nobody in this range</b>Add MOT expiry dates to cars and they will show up here.</div></div>';
        $$('.cv-mot', el).forEach(card => $$('[data-a]', card).forEach(b => b.onclick = () => act(all.find(r => r.vehicle_id === card.dataset.vid), b.dataset.a)));
      }
      async function log(r, kind) {
        try {
          const n = await logNote({ vehicle_id: r.vehicle_id, customer_id: r.customer_id, kind, body: `MOT reminder sent (${kind})` });
          last[r.vehicle_id] = n; crm.toast('Logged: ' + (KIND_LABEL[kind] || kind) + ' reminder'); draw();
        } catch (e) { crm.fail(e); }
      }
      function act(r, a) {
        if (!r) return;
        const cust = { id: r.customer_id, first_name: r.first_name, last_name: r.last_name, phone: r.phone, email: r.email };
        const text = crm.whatsappText(cust, { reg: r.reg, mot_expiry: r.mot_expiry }, 'mot');
        if (a === 'wa') { window.open(fmt.whatsapp(r.phone, text), '_blank', 'noopener'); log(r, 'whatsapp'); }
        else if (a === 'sms') { location.href = 'sms:' + String(r.phone).replace(/[^0-9+]/g, '') + '?&body=' + encodeURIComponent(text); log(r, 'sms'); }
        else if (a === 'call') { location.href = fmt.phoneHref(r.phone); log(r, 'call'); }
        else if (a === 'book') crm.newBooking({ reg: r.reg, customer: r.customer_id ? cust : undefined, location_id: 'mot', service_id: 'mot4' }, () => load().catch(crm.fail));
        else {
          const mm = openModal('How did you contact them?', `<p class="muted">${crm.plate(r.reg)} ${esc(fmt.name(r))}</p><div class="cv-actions"><button class="btn btn-green" type="button" data-k="whatsapp">WhatsApp</button><button class="btn btn-dark" type="button" data-k="sms">Text</button><button class="btn btn-ghost" type="button" data-k="call">Phone call</button></div>`);
          $$('[data-k]', mm).forEach(b => b.onclick = () => { crm.closeModal(); log(r, b.dataset.k); });
        }
      }
      $('#mcopy', el).onclick = async () => {
        const nums = [...new Set(rowsNow().map(r => r.phone).filter(Boolean).map(p => String(p).replace(/\s+/g, '')))];
        if (!nums.length) return crm.toast('No phone numbers in this list', true);
        crm.toast((await copyText(nums.join('\n'))) ? `Copied ${nums.length} numbers` : 'Could not copy', false);
      };
      try { await load(); } catch (e) { $('#mlist', el).innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; crm.fail(e); }
    }
  });

  // ---------- 6. ADD FROM PAPER ----------
  // Find-or-create core shared by Quick entry and spreadsheet import.
  // e: {first,last,phone,email,reg,make,model,mot_expiry (ISO),postcode,notes,last_visit (ISO),forceReg}
  async function findCustomerByPhone(phone) {
    const d = normPhone(phone); if (phoneDigits(d).length < 10) return null;
    const rows = await staff.search(d, 8);
    return rows.find(c => normPhone(c.phone) === d || normPhone(c.phone2) === d) || null;
  }
  async function findCustomerByEmail(email) {
    email = String(email || '').trim().toLowerCase(); if (!/.+@.+\..+/.test(email)) return null;
    const rows = await staff.search(email, 8);
    return rows.find(c => String(c.email || '').toLowerCase() === email) || null;
  }
  async function importEntry(e, ctx) {
    const out = { warnings: [], matched: null, customer: null, vehicle: null, createdCustomer: false, createdVehicle: false, relink: null, noteIds: [] };
    const full = [e.first, e.last].filter(Boolean).join(' ').trim();
    const reg = fmt.normReg(e.reg);
    const regOk = !!reg && (fmt.plateValid(reg) || e.forceReg);
    if (reg && !regOk) out.warnings.push(`Reg "${e.reg}" looks wrong, so the car was not saved`);
    if (!full && !e.phone && !e.email && !regOk) { out.skip = 'Nothing usable: no name, phone, email or valid reg'; return out; }
    let veh = regOk ? await staff.vehicleByReg(reg) : null;
    let cust = null;
    if (e.phone) { cust = await findCustomerByPhone(e.phone); if (cust) out.matched = 'phone'; }
    if (!cust && e.email) { cust = await findCustomerByEmail(e.email); if (cust) out.matched = 'email'; }
    const owner = veh && veh.za_customers && !veh.za_customers.deleted_at ? veh.za_customers : null;
    if (!cust && !e.phone && !e.email) {
      if (full && ctx.names.has(full.toLowerCase())) { cust = ctx.names.get(full.toLowerCase()); out.matched = 'name'; }
      else if (owner && (!full || fmt.name(owner).toLowerCase() === full.toLowerCase())) { cust = owner; out.matched = 'reg'; }
    }
    if (!cust && (full || e.phone || e.email)) {
      cust = await staff.saveCustomer({ first_name: e.first || '', last_name: e.last || '', phone: nz(e.phone) && prettyPhone(e.phone), email: nz(e.email), postcode: nz(e.postcode), source: 'import' });
      out.createdCustomer = true; if (full) ctx.names.set(full.toLowerCase(), cust);
    }
    out.customer = cust;
    if (regOk) {
      const fills = {}; if (nz(e.make)) fills.make = e.make.trim(); if (nz(e.model)) fills.model = e.model.trim(); if (e.mot_expiry) fills.mot_expiry = e.mot_expiry;
      if (veh) {
        const patch = {}; Object.keys(fills).forEach(k => { if (!veh[k] || (k === 'mot_expiry' && fills[k] > veh[k])) patch[k] = fills[k]; });
        if (cust && veh.customer_id !== cust.id) {
          const prev = owner ? fmt.name(owner) : 'nobody'; patch.customer_id = cust.id;
          out.relink = { id: veh.id, prev: veh.customer_id || null };
          const sn = await logNote({ vehicle_id: veh.id, customer_id: cust.id, kind: 'system', body: `Owner changed from ${prev} to ${fmt.name(cust)} (typed up from paper records)` });
          out.noteIds.push(sn.id); out.warnings.push(`${fmt.plate(reg)} was linked to ${prev}; moved to ${fmt.name(cust)}`);
        }
        out.vehicle = Object.keys(patch).length ? await staff.saveVehicle(Object.assign({ id: veh.id }, patch)) : veh;
      } else {
        out.vehicle = await staff.saveVehicle(Object.assign({ reg, customer_id: cust ? cust.id : null }, fills)); out.createdVehicle = true;
      }
    }
    const body = [e.last_visit ? `Last visit ${fmt.date(e.last_visit)}` : '', nz(e.notes) || ''].filter(Boolean).join(e.last_visit && nz(e.notes) ? ': ' : '');
    if (body) {
      if (cust || out.vehicle) { const n = await logNote({ customer_id: cust ? cust.id : null, vehicle_id: out.vehicle ? out.vehicle.id : null, kind: 'handwritten', body }); out.noteIds.push(n.id); }
      else out.warnings.push('Notes dropped (no customer or car to attach them to)');
    }
    return out;
  }
  async function undoEntry(r) {
    // only touches rows this entry created (plus restoring an owner we moved)
    if (r.noteIds.length) await q(sb.from('za_notes').delete().in('id', r.noteIds));
    if (r.relink) await staff.saveVehicle({ id: r.relink.id, customer_id: r.relink.prev });
    if (r.createdVehicle && r.vehicle) await q(sb.from('za_vehicles').delete().eq('id', r.vehicle.id));
    if (r.createdCustomer && r.customer) await q(sb.from('za_customers').delete().eq('id', r.customer.id));
  }

  crm.register('import', {
    title: 'Add from paper', nav: true,
    async render(el) {
      el.innerHTML = `<div class="cv-bar"><div class="seg" id="itab"><button type="button" data-t="quick" class="on">Quick entry</button><button type="button" data-t="paste">Paste a spreadsheet</button><button type="button" data-t="photos">Send photos</button></div></div>
        <div class="notice" style="margin-bottom:14px"><b>Lots of paper?</b> Take a picture of each page, or of your spreadsheet or bookings book, and send it to Kola to be converted and added to the system for you. Or upload the photos under <a href="#" id="go-photos">Send photos</a> and they'll be on the system within 48 hours.</div>
        <div id="ibody"></div>`;
      const body = $('#ibody', el); let tab = 'quick';
      const quick = quickEntry(body), paste = pasteImport(body), photos = sendPhotos(body);
      const show = (t) => { tab = t; $$('#itab button', el).forEach(b => b.classList.toggle('on', b.dataset.t === t)); quick.root.style.display = t === 'quick' ? '' : 'none'; paste.root.style.display = t === 'paste' ? '' : 'none'; photos.root.style.display = t === 'photos' ? '' : 'none'; if (t === 'quick') quick.focus(); };
      $('#itab', el).addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.t); });
      $('#go-photos', el).addEventListener('click', e => { e.preventDefault(); show('photos'); });
      show(location.hash.includes('photos') ? 'photos' : 'quick');
    }
  });

  // ---------- Send photos of paper records ----------
  function sendPhotos(host) {
    const root = document.createElement('div'); host.appendChild(root);
    let files = [];
    root.innerHTML = `<div class="panel">
        <h3>Send photos of your records</h3>
        <p class="muted" style="margin-top:-4px">Customer notebooks, job cards, a bookings diary or a spreadsheet. We type them up and add every customer and car to the system within 48 hours.</p>
        <label class="cv-drop" id="pdrop">
          <input type="file" id="pfile" multiple accept="image/*,application/pdf,.csv,.xls,.xlsx" style="display:none">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>
          <b>Take photos or choose files</b><span class="muted small">On a phone this opens the camera. Photos, PDFs or spreadsheets, up to 20 MB each.</span>
        </label>
        <div id="pthumbs" class="cv-thumbs"></div>
        <div class="row" style="margin-top:12px">
          <div class="field"><label>Your name</label><input class="input" id="psender" placeholder="e.g. Zaki, Pam's MOT Centre"></div>
          <div class="field"><label>Anything we should know? <span class="muted small">(optional)</span></label><input class="input" id="pnote" placeholder="e.g. pages 1–20 of the 2024 book"></div>
        </div>
        <div id="pmsg"></div>
        <button class="btn btn-primary" id="psend" type="button" disabled>Send</button>
      </div>
      <div class="panel" id="plist" style="display:none"><h3>Sent for typing up</h3><div id="pitems"></div></div>`;
    const fileIn = $('#pfile', root), drop = $('#pdrop', root), sendBtn = $('#psend', root), msg = $('#pmsg', root);
    const draw = () => {
      $('#pthumbs', root).innerHTML = files.map((f, i) => `<div class="cv-thumb">${f.type.startsWith('image/') && !/hei[cf]/.test(f.type) ? `<img src="${URL.createObjectURL(f)}" alt="">` : `<span>${esc((f.name.split('.').pop() || 'file').toUpperCase())}</span>`}<button type="button" data-i="${i}" aria-label="Remove">×</button></div>`).join('');
      sendBtn.disabled = !files.length; sendBtn.textContent = files.length ? `Send ${files.length} file${files.length === 1 ? '' : 's'}` : 'Send';
    };
    const add = (list) => { files = files.concat(Array.from(list)).slice(0, 60); msg.innerHTML = ''; draw(); };
    fileIn.addEventListener('change', () => { add(fileIn.files); fileIn.value = ''; });
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', e => add(e.dataTransfer.files));
    $('#pthumbs', root).addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { files.splice(Number(b.dataset.i), 1); draw(); } });
    sendBtn.addEventListener('click', async () => {
      if (!files.length) return;
      sendBtn.disabled = true; msg.innerHTML = '<div class="notice">Sending…</div>';
      try {
        const r = await ZA.pub.sendPaper(files, $('#psender', root).value.trim(), $('#pnote', root).value.trim(), (d, n) => { msg.innerHTML = `<div class="notice">Sending ${d} of ${n}…</div>`; });
        msg.innerHTML = `<div class="notice ok" style="margin-bottom:12px"><b>Got them: ${r.count} file${r.count === 1 ? '' : 's'}.</b> They'll be typed up and on the system within 48 hours. You'll see the customers appear under Customers.</div>`;
        files = []; $('#pnote', root).value = ''; draw(); list();
      } catch (e) { msg.innerHTML = `<div class="notice bad" style="margin-bottom:12px">${esc(e.message)}</div>`; sendBtn.disabled = false; }
    });
    async function list() {
      let rows = [];
      try { rows = (await staff.paperList()) || []; } catch (_) { rows = []; }
      if (!rows.length) { $('#plist', root).style.display = 'none'; return; }
      const batches = {}; rows.forEach(r => { (batches[r.batch] = batches[r.batch] || []).push(r); });
      $('#plist', root).style.display = '';
      const label = { received: 'Received', in_progress: 'Being typed up', done: 'Added' };
      $('#pitems', root).innerHTML = Object.entries(batches).map(([b, rs]) => `<div class="veh" style="cursor:default;flex-wrap:wrap">
          <b style="min-width:150px">${fmt.day(rs[0].created_at)} ${fmt.time(rs[0].created_at)}</b>
          <span>${rs.length} file${rs.length === 1 ? '' : 's'}${rs[0].sender ? ' from ' + esc(rs[0].sender) : ''}${rs[0].note ? ' · ' + esc(rs[0].note) : ''}</span>
          <span style="flex:1"></span>
          <span class="tag ${rs[0].status === 'done' ? 'green' : rs[0].status === 'in_progress' ? 'orange' : ''}">${label[rs[0].status] || rs[0].status}</span>
          ${crm.me && crm.me.role === 'owner' ? `<button class="btn btn-ghost btn-sm" type="button" data-open="${esc(b)}">View</button><select class="input" data-st="${esc(b)}" style="width:auto;padding:6px 8px">${Object.entries(label).map(([k, t]) => `<option value="${k}" ${rs[0].status === k ? 'selected' : ''}>${t}</option>`).join('')}</select>` : ''}
        </div>`).join('');
      $$('[data-open]', root).forEach(btn => btn.onclick = async () => { for (const r of batches[btn.dataset.open]) { const u = await staff.paperUrl(r.path); if (u) window.open(u, '_blank', 'noopener'); } });
      $$('[data-st]', root).forEach(s => s.onchange = async () => { try { await staff.paperStatus(s.dataset.st, s.value); crm.toast('Updated'); } catch (e) { crm.fail(e); } });
    }
    list();
    return { root };
  }

  function quickEntry(host) {
    const root = document.createElement('div'); host.appendChild(root);
    const session = []; let busy = false, todayCount = 0, vehSeq = 0, phoneSeq = 0;
    root.innerHTML = `<div class="panel" id="qf"><div class="cv-quick">
        <div class="field c2"><label>Reg</label><div class="plate sm"><div class="gb"><i>★</i>UK</div><input id="q-reg" placeholder="AB12 CDE" autocomplete="off" autocapitalize="characters"></div></div>
        <div class="field c2"><label>Name <span class="muted" style="font-weight:400">(First Last)</span></label>${inp('q-name', '', 'autocomplete="off"')}</div>
        <div class="field c2"><label>Phone</label>${inp('q-phone', '', 'type="tel" autocomplete="off"')}</div>
        <div class="c6" id="q-match" style="min-height:8px;margin-bottom:6px"></div>
        <div class="field c2"><label>Make</label>${inp('q-make', '', 'list="q-makes" autocomplete="off"')}</div>
        <div class="field c2"><label>Model</label>${inp('q-model', '', 'autocomplete="off"')}</div>
        <div class="field c1"><label>MOT due</label>${inp('q-mot', '', 'placeholder="dd/mm/yyyy" autocomplete="off"')}</div>
        <div class="field c1"><label>Last visit</label>${inp('q-visit', '', 'placeholder="dd/mm/yyyy" autocomplete="off"')}</div>
        <div class="field c6"><label>Notes <span class="muted" style="font-weight:400">(what was done — Enter saves, Shift+Enter for a new line)</span></label><textarea class="input" id="q-notes" rows="2" placeholder="e.g. Full service, new front discs, advised on rear tyres"></textarea></div>
      </div>
      <datalist id="q-makes">${['Audi', 'BMW', 'Citroen', 'Dacia', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Jaguar', 'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG', 'Mini', 'Nissan', 'Peugeot', 'Renault', 'Seat', 'Skoda', 'Suzuki', 'Tesla', 'Toyota', 'Vauxhall', 'Volkswagen', 'Volvo'].map(x => `<option value="${x}">`).join('')}</datalist>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn btn-primary" type="button" id="q-save">Save &amp; next</button><button class="btn btn-ghost btn-sm" type="button" id="q-clear">Clear</button><span class="small muted">Ctrl+Enter saves from anywhere. Enter moves to the next box.</span><span style="flex:1"></span><b id="q-count" class="small"></b></div>
      <div id="q-err" class="error" style="margin-top:8px"></div></div>
      <div class="panel"><h3>Added this session <span id="q-n">0</span></h3><ul class="cv-sess" id="q-list"><li class="muted small">Nothing yet. Type the first record above.</li></ul></div>`;
    const g = (id) => $('#q-' + id, root);
    const order = ['reg', 'name', 'phone', 'make', 'model', 'mot', 'visit', 'notes'];
    const state = { vehOwner: null, phoneCust: null };

    function renderMatch() {
      const parts = [];
      if (state.veh) parts.push(`<span class="notice ok" style="display:inline-block;margin-right:6px">Car on file: <b>${esc([state.veh.make, state.veh.model].filter(Boolean).join(' ') || 'no details')}</b>${state.veh.za_customers ? ' · owner ' + esc(fmt.name(state.veh.za_customers)) : ''}${state.veh.mot_expiry ? ' · MOT ' + fmt.date(state.veh.mot_expiry) : ''}</span>`);
      if (state.phoneCust) parts.push(`<span class="notice ok" style="display:inline-block">Already on file: <b>${esc(fmt.name(state.phoneCust))}</b> — will add to them</span>`);
      const qr = fmt.normReg(g('reg').value); if (fmt.plateValid(qr)) parts.push(fmt.govBtn(qr, 'Look up on GOV.UK'));
      g('match').innerHTML = parts.join(' ');
    }
    const checkReg = debounce(async () => {
      const reg = fmt.normReg(g('reg').value), my = ++vehSeq; state.veh = null;
      if (reg.length < 3) return renderMatch();
      try {
        const v = await staff.vehicleByReg(reg); if (my !== vehSeq) return; state.veh = v;
        if (v) { if (!g('make').value && v.make) g('make').value = v.make; if (!g('model').value && v.model) g('model').value = v.model; if (!g('mot').value && v.mot_expiry) g('mot').value = fmt.date(v.mot_expiry); }
        else if (fmt.plateValid(reg)) { const car = await ZA.pub.lookupReg(reg); if (my !== vehSeq) return; if (car) { if (!g('make').value && car.make) g('make').value = car.make; if (!g('model').value && car.model) g('model').value = car.model; if (!g('mot').value && car.mot_expiry) g('mot').value = fmt.date(car.mot_expiry); g('match').innerHTML = `<span class="notice ok" style="display:inline-block">Looked up: <b>${esc(fmt.carLine(car))}</b></span> ${fmt.govBtn(reg)}`; return; } }
        renderMatch();
      } catch (_) {}
    }, 300);
    const checkPhone = debounce(async () => {
      const ph = g('phone').value, my = ++phoneSeq; state.phoneCust = null;
      if (phoneDigits(ph).length < 10) return renderMatch();
      try { const c = await findCustomerByPhone(ph); if (my !== phoneSeq) return; state.phoneCust = c; renderMatch(); } catch (_) {}
    }, 300);
    g('reg').addEventListener('input', e => { e.target.value = fmt.plate(e.target.value); checkReg(); });
    g('phone').addEventListener('input', checkPhone);
    ['mot', 'visit'].forEach(k => g(k).addEventListener('blur', () => { const d = parseDate(g(k).value); if (d) g(k).value = fmt.date(d); }));

    root.addEventListener('keydown', (e) => {
      const t = e.target; if (!t.id || !t.id.startsWith('q-')) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); return save(); }
      if (e.key !== 'Enter') return;
      const k = t.id.slice(2), i = order.indexOf(k);
      if (k === 'notes') { if (e.shiftKey) return; e.preventDefault(); return save(); }
      if (i >= 0) { e.preventDefault(); g(order[i + 1]).focus(); }
    });
    function clear() {
      order.forEach(k => { g(k).value = ''; }); state.veh = null; state.phoneCust = null; vehSeq++; phoneSeq++; renderMatch(); g('err').textContent = ''; g('reg').focus();
    }
    function drawSession() {
      g('n').textContent = session.length;
      g('count').textContent = `${todayCount} customer${todayCount === 1 ? '' : 's'} added today`;
      g('list').innerHTML = session.map((s, i) => `<li><span style="flex:none">${s.reg ? crm.plate(s.reg) : '<span class="muted small">no car</span>'}</span><b>${esc(s.name || 'No name')}</b><span class="small muted">${esc(s.phone || '')}</span>
        ${s.res.createdCustomer ? '<span class="tag green">New customer</span>' : s.res.customer ? '<span class="tag">Existing customer</span>' : ''}${s.res.warnings.length ? `<span class="cv-warn">${esc(s.res.warnings.join('; '))}</span>` : ''}
        <span style="flex:1"></span>${i === 0 ? '<button class="btn btn-ghost btn-sm" type="button" data-undo>Undo</button>' : ''}</li>`).join('') || '<li class="muted small">Nothing yet. Type the first record above.</li>';
      const u = $('[data-undo]', g('list')); if (u) u.onclick = undo;
    }
    async function undo() {
      const s = session[0]; if (!s || busy) return; busy = true;
      try { await undoEntry(s.res); session.shift(); if (s.res.createdCustomer) todayCount = Math.max(0, todayCount - 1); drawSession(); crm.toast('Undone'); }
      catch (e) { crm.fail(e); } busy = false;
    }
    async function save() {
      if (busy) return; g('err').textContent = '';
      const [first, last] = splitName(g('name').value), reg = g('reg').value, phone = g('phone').value.trim();
      const mot = g('mot').value.trim(), visit = g('visit').value.trim();
      const motIso = mot ? parseDate(mot) : null, visitIso = visit ? parseDate(visit) : null;
      if (mot && !motIso) { g('err').textContent = 'MOT due date not understood. Use dd/mm/yyyy.'; g('mot').focus(); return; }
      if (visit && !visitIso) { g('err').textContent = 'Last visit date not understood. Use dd/mm/yyyy.'; g('visit').focus(); return; }
      if (phone && phoneDigits(phone).length < 10) { if (!confirm('That phone number looks short. Save anyway?')) { g('phone').focus(); return; } }
      let forceReg = false;
      if (fmt.normReg(reg) && !fmt.plateValid(reg)) { if (!confirm(`"${reg}" does not look like a normal UK registration. Save it anyway?`)) { g('reg').focus(); return; } forceReg = true; }
      if (!first && !last && !phone && !fmt.normReg(reg)) { g('err').textContent = 'Type at least a reg, a name or a phone number.'; g('reg').focus(); return; }
      busy = true; g('save').disabled = true;
      try {
        const res = await importEntry({ first, last, phone, reg, make: g('make').value, model: g('model').value, mot_expiry: motIso, last_visit: visitIso, notes: g('notes').value.trim(), forceReg }, { names: new Map() });
        if (res.skip) { g('err').textContent = res.skip; }
        else {
          if (res.createdCustomer) todayCount++;
          session.unshift({ res, reg: fmt.normReg(reg), name: [first, last].filter(Boolean).join(' ') || (res.customer ? fmt.name(res.customer) : ''), phone });
          drawSession(); clear();
          const f = $('#qf', root); f.classList.remove('cv-flash'); void f.offsetWidth; f.classList.add('cv-flash');
          crm.toast(res.createdCustomer ? 'Saved — new customer' : res.customer ? 'Saved — added to ' + fmt.name(res.customer) : 'Saved');
        }
      } catch (e) { crm.fail(e); g('err').textContent = e.message; }
      busy = false; g('save').disabled = false;
    }
    g('save').onclick = save; g('clear').onclick = clear;
    (async () => {
      try {
        const start = new Date(fmt.today() + 'T00:00:00'); // approximate London midnight in local clock; fine for a counter
        todayCount = await q(sb.from('za_customers').select('id', { count: 'exact', head: true }).eq('source', 'import').gte('created_at', start.toISOString())) || 0;
      } catch (_) { todayCount = 0; } drawSession();
    })();
    return { root, focus: () => setTimeout(() => g('reg').focus(), 30) };
  }

  // ----- paste / CSV import -----
  const FIELDS = [['ignore', 'Ignore'], ['full_name', 'Full name'], ['first_name', 'First name'], ['last_name', 'Last name'], ['phone', 'Phone'], ['email', 'Email'], ['reg', 'Reg'], ['make', 'Make'], ['model', 'Model'], ['mot_expiry', 'MOT expiry'], ['last_visit', 'Last visit'], ['postcode', 'Postcode'], ['notes', 'Notes']];
  function parseDelimited(text, delim) {
    const rows = []; let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += ch; }
      else if (ch === '"' && cell === '') inQ = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c !== ''));
  }
  function detectDelim(text) {
    const line = text.split(/\r?\n/).find(l => l.trim()) || '';
    const cnt = (c) => line.split(c).length - 1;
    const best = [['\t', cnt('\t')], [',', cnt(',')], [';', cnt(';')], ['|', cnt('|')]].sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : ',';
  }
  const looksPhone = (s) => phoneDigits(s).length >= 9 && /^[\d\s+()\-.]+$/.test(s);
  const HEAD_MAP = [[/^(full\s*)?name$|^customer(\s*name)?$|^client$/i, 'full_name'], [/first|forename|given/i, 'first_name'], [/last|surname|family/i, 'last_name'], [/phone|mobile|tel|contact\s*n/i, 'phone'], [/e-?mail/i, 'email'],
    [/^reg|plate|vrm|vehicle\s*reg|registration/i, 'reg'], [/make|manufacturer/i, 'make'], [/model/i, 'model'], [/mot/i, 'mot_expiry'], [/last\s*(visit|seen|service)|visit|date/i, 'last_visit'], [/post\s*code|postcode|zip/i, 'postcode'], [/note|work|job|detail|comment|desc/i, 'notes']];
  function guessMapping(rows, hasHeader) {
    const n = Math.max(...rows.slice(0, 20).map(r => r.length)), map = Array(n).fill('ignore'), used = new Set();
    const set = (i, f) => { if (map[i] === 'ignore' && (!used.has(f) || f === 'notes')) { map[i] = f; used.add(f); } };
    if (hasHeader) rows[0].forEach((h, i) => { const hit = HEAD_MAP.find(([re]) => re.test(h)); if (hit) set(i, hit[1]); });
    const sample = rows.slice(hasHeader ? 1 : 0, 25);
    for (let i = 0; i < n; i++) {
      if (map[i] !== 'ignore') continue;
      const vals = sample.map(r => r[i] || '').filter(Boolean); if (!vals.length) continue;
      const ratio = (fn) => vals.filter(fn).length / vals.length;
      if (!used.has('reg') && ratio(v => /\d/.test(v) && /[A-Za-z]/.test(v) && fmt.plateValid(v) && v.replace(/\s/g, '').length <= 8) > 0.6) set(i, 'reg');
      else if (!used.has('email') && ratio(v => /.+@.+\..+/.test(v)) > 0.6) set(i, 'email');
      else if (!used.has('phone') && ratio(looksPhone) > 0.6) set(i, 'phone');
      else if (!used.has('mot_expiry') && ratio(v => !!parseDate(v)) > 0.6) set(i, 'mot_expiry');
    }
    if (!used.has('full_name') && !used.has('first_name')) { for (let i = 0; i < n; i++) if (map[i] === 'ignore' && sample.some(r => /^[A-Za-z][A-Za-z'\- ]+$/.test(r[i] || ''))) { set(i, 'full_name'); break; } }
    return map;
  }
  function buildEntry(row, map) {
    const e = { first: '', last: '', phone: '', email: '', reg: '', make: '', model: '', mot_expiry: null, last_visit: null, postcode: '', notes: '' }, warns = [], bad = {};
    const notes = [];
    map.forEach((f, i) => {
      const v = (row[i] || '').trim(); if (!v || f === 'ignore') return;
      if (f === 'full_name') { const [a, b] = splitName(v); e.first = e.first || a; e.last = e.last || b; }
      else if (f === 'first_name') e.first = tidyName(v); else if (f === 'last_name') e.last = tidyName(v);
      else if (f === 'phone') { e.phone = prettyPhone(v); if (phoneDigits(e.phone).length < 10) { warns.push('Phone looks short'); bad.phone = 1; } }
      else if (f === 'email') { e.email = v; if (!/.+@.+\..+/.test(v)) { warns.push('Email looks wrong'); bad.email = 1; } }
      else if (f === 'reg') { e.reg = fmt.plate(v); if (!fmt.plateValid(v)) { warns.push('Reg not recognised'); bad.reg = 1; } }
      else if (f === 'mot_expiry' || f === 'last_visit') { const d = parseDate(v); if (d) e[f] = d; else { warns.push(f === 'mot_expiry' ? 'MOT date not understood' : 'Visit date not understood'); bad[f] = 1; } }
      else if (f === 'notes') notes.push(v); else e[f] = v;
    });
    e.notes = notes.join('; ');
    return { e, warns, bad };
  }

  function pasteImport(host) {
    const root = document.createElement('div'); host.appendChild(root);
    let rows = [], hasHeader = true, map = [], running = false, stop = false;
    root.innerHTML = `<div class="panel"><h3>Paste from Excel / Google Sheets, or upload a CSV</h3>
        <textarea class="input" id="p-txt" rows="6" placeholder="Reg, Name, Phone, Make, Model, MOT due&#10;AB12 CDE, John Smith, 07700 900123, Ford, Focus, 14/03/2026" style="font-family:monospace;font-size:.85rem"></textarea>
        <div class="cv-actions" style="margin-top:10px;align-items:center"><input type="file" id="p-file" accept=".csv,.tsv,.txt,text/csv" style="max-width:260px"><label class="check" style="margin:0"><input type="checkbox" id="p-head" checked> First row is a header</label><span class="small muted" id="p-info"></span></div></div>
      <div id="p-map"></div><div id="p-prev"></div><div id="p-run"></div>`;
    const g = (id) => $('#p-' + id, root);
    function parse() {
      const t = g('txt').value; if (!t.trim()) { rows = []; draw(); return; }
      rows = parseDelimited(t, detectDelim(t));
      const first = rows[0] || [];
      const dataish = first.some(c => looksPhone(c) || parseDate(c) || (/\d/.test(c) && /[A-Za-z]/.test(c) && fmt.plateValid(c) && c.replace(/\s/g, '').length <= 8 && c.length <= 8));
      hasHeader = !dataish && rows.length > 1; g('head').checked = hasHeader;
      map = rows.length ? guessMapping(rows, hasHeader) : []; draw();
    }
    function dataRows() { return hasHeader ? rows.slice(1) : rows; }
    function draw() {
      const dr = dataRows();
      g('info').textContent = rows.length ? `${dr.length} row${dr.length === 1 ? '' : 's'}, ${map.length} columns` : '';
      if (!rows.length) { g('map').innerHTML = g('prev').innerHTML = ''; return; }
      const head = hasHeader ? rows[0] : [], sampleRow = dr[0] || [];
      g('map').innerHTML = `<div class="panel"><h3>1. Tell me what each column is</h3><div class="cv-map">${map.map((f, i) => `<div><small title="${esc(sampleRow[i] || '')}">${esc(head[i] || 'Column ' + (i + 1))}: <i>${esc(sampleRow[i] || '—')}</i></small>
        <select data-i="${i}">${FIELDS.map(([k, t]) => `<option value="${k}" ${f === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`).join('')}</div></div>`;
      $$('#p-map select', root).forEach(s => s.onchange = () => { map[+s.dataset.i] = s.value; drawPreview(); });
      drawPreview();
    }
    function drawPreview() {
      const dr = dataRows(); const built = dr.map(r => buildEntry(r, map));
      const usable = built.filter(b => b.e.first || b.e.last || b.e.phone || b.e.email || (b.e.reg && !b.bad.reg)).length;
      const cols = map.map((f, i) => [f, i]).filter(([f]) => f !== 'ignore');
      g('prev').innerHTML = `<div class="panel"><h3>2. Check the first 10 rows <span>${usable} of ${dr.length} importable</span></h3>${cols.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th>${cols.map(([f]) => `<th>${(FIELDS.find(x => x[0] === f) || [])[1]}</th>`).join('')}<th>Check</th></tr></thead><tbody>${built.slice(0, 10).map((b, i) => `<tr><td class="muted">${i + 1}</td>${cols.map(([f, ci]) => {
        const key = f === 'full_name' || f === 'first_name' || f === 'last_name' ? '' : f; const bad = key && b.bad[key];
        let shown = dr[i][ci] || ''; if (f === 'phone' && b.e.phone) shown = b.e.phone; if ((f === 'mot_expiry' || f === 'last_visit') && b.e[f]) shown = fmt.date(b.e[f]);
        return `<td class="${bad ? 'cv-bad' : ''}">${f === 'reg' && !bad && shown ? crm.plate(shown) : esc(shown) || '<span class="muted">—</span>'}</td>`;
      }).join('')}<td>${b.warns.length ? `<span class="cv-warn">${esc(b.warns.join('; '))}</span>` : '<span class="tag green">OK</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">Choose at least one column above.</div>'}
        <div class="cv-actions" style="margin-top:14px"><button class="btn btn-primary" type="button" id="p-go" ${usable ? '' : 'disabled'}>Import ${usable} row${usable === 1 ? '' : 's'}</button><span class="small muted">Existing customers are matched by phone (or email) and added to, never duplicated. Bad dates and regs are left out, not guessed.</span></div></div>`;
      g('go').onclick = () => runImport(dr, built);
    }
    async function runImport(dr, built) {
      if (running) return; running = true; stop = false;
      const ctx = { names: new Map() }, sum = { cc: 0, cv: 0, matched: 0, moved: 0, ok: 0, skipped: [], warn: 0 };
      g('go').disabled = true;
      g('run').innerHTML = `<div class="panel"><h3>Importing… <span id="p-pct">0%</span></h3><div class="cv-prog"><i id="p-bar"></i></div><div class="cv-actions" style="margin-top:12px"><button class="btn btn-ghost btn-sm" type="button" id="p-stop">Stop</button><span class="small muted" id="p-now"></span></div></div>`;
      g('stop').onclick = () => { stop = true; };
      for (let i = 0; i < built.length; i++) {
        if (stop) { sum.skipped.push({ n: i + 1, why: 'Stopped before reaching the remaining rows' }); break; }
        const b = built[i];
        try {
          const ent = Object.assign({}, b.e); if (b.bad.reg) ent.reg = '';
          const r = await importEntry(ent, ctx);
          if (r.skip) sum.skipped.push({ n: i + 1 + (hasHeader ? 1 : 0), why: r.skip }); else {
            sum.ok++; if (r.createdCustomer) sum.cc++; else if (r.customer) sum.matched++; if (r.createdVehicle) sum.cv++; if (r.relink) sum.moved++; sum.warn += b.warns.length;
          }
        } catch (e) { sum.skipped.push({ n: i + 1 + (hasHeader ? 1 : 0), why: e.message }); }
        const pct = Math.round((i + 1) / built.length * 100); $('#p-bar', root).style.width = pct + '%'; $('#p-pct', root).textContent = pct + '%'; $('#p-now', root).textContent = `Row ${i + 1} of ${built.length}`;
      }
      running = false;
      g('run').innerHTML = `<div class="panel"><h3>Done</h3><div class="cv-stats"><div><b>${sum.cc}</b><span>customers created</span></div><div><b>${sum.cv}</b><span>vehicles created</span></div><div><b>${sum.matched}</b><span>matched existing customers</span></div><div><b>${sum.skipped.length}</b><span>skipped</span></div></div>
        ${sum.moved ? `<p class="small cv-warn">${sum.moved} car(s) were moved from another owner (logged in the car's notes).</p>` : ''}${sum.warn ? `<p class="small muted">${sum.warn} warning(s): bad dates, regs or short phone numbers were left out.</p>` : ''}
        ${sum.skipped.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Row</th><th>Why it was skipped</th></tr></thead><tbody>${sum.skipped.map(s => `<tr><td>${s.n}</td><td>${esc(s.why)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <div class="cv-actions" style="margin-top:12px"><button class="btn btn-dark btn-sm" type="button" data-go="#/customers">See customers</button></div></div>`;
      $$('[data-go]', g('run')).forEach(x => x.onclick = () => crm.go(x.dataset.go));
      crm.toast(`Imported: ${sum.cc} new customers, ${sum.cv} vehicles`); g('go').disabled = false;
    }
    g('txt').addEventListener('input', debounce(parse, 300));
    g('head').onchange = () => { hasHeader = g('head').checked; if (rows.length) { map = guessMapping(rows, hasHeader); draw(); } };
    g('file').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { g('txt').value = String(r.result).replace(/^﻿/, ''); parse(); }; r.readAsText(f); };
    return { root };
  }

  // ---------- 7. SETTINGS ----------
  const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
  const truthy = (v) => v === true || v === 'true';

  crm.register('settings', {
    title: 'Settings', nav: true,
    async render(el) {
      const owner = isOwner(), ro = owner ? '' : 'disabled';
      let services, closures, staffRows, settings;
      try { [services, closures, staffRows, settings] = await Promise.all([staff.allServices(), staff.closures(), staff.staffList().catch(() => []), ZA.pub.settings().catch(() => ({}))]); crm.settings = settings; crm.services = services; }
      catch (e) { el.innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; return; }
      const redraw = async () => { try { await crm.loadRef(); } catch (_) {} crm.refresh(); };
      el.innerHTML = `${owner ? '' : '<div class="notice" style="margin-bottom:14px">You can look at the settings, but only the owner can change them.</div>'}
        <div id="s-ph"></div><div class="panel" id="s-svc"></div><div id="s-sites"></div><div class="panel" id="s-close"></div><div class="panel" id="s-rules"></div><div class="panel" id="s-staff"></div><div class="panel" id="s-demo"></div>`;

      // --- services & prices ---
      if (truthy(settings.prices_are_placeholders)) {
        $('#s-ph', el).innerHTML = `<div class="notice" style="margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>Prices are placeholders.</b> The website shows them as typical prices until you confirm they are right.</span>${owner ? '<button class="btn btn-dark btn-sm" type="button" id="s-conf">Prices are confirmed</button>' : ''}</div>`;
        if (owner) $('#s-conf', el).onclick = async () => { try { await q(sb.from('za_settings').update({ value: false }).eq('key', 'prices_are_placeholders')); crm.toast('Prices confirmed'); redraw(); } catch (e) { crm.fail(e); } };
      }
      const svcHost = $('#s-svc', el);
      svcHost.innerHTML = `<h3>Services & prices ${owner ? '<button class="btn btn-ghost btn-sm" type="button" id="s-addsvc" style="padding:5px 12px">+ Add service</button>' : ''}</h3>
        <div class="tbl-wrap"><table class="tbl cv-tbl-edit"><thead><tr><th style="min-width:170px">Name</th><th style="min-width:100px">Price label</th><th style="width:80px">From £</th><th style="width:80px">Mins</th><th>Garage</th><th>MOT</th><th>Online</th><th>Walk-in</th><th style="width:70px">Max at once</th><th>Active</th><th></th></tr></thead>
        <tbody>${services.map(s => `<tr data-id="${esc(s.id)}"><td><input type="text" data-f="name" value="${esc(s.name)}" ${ro}><div class="small muted">${esc(s.id)}</div></td><td><input type="text" data-f="price_label" value="${esc(s.price_label || '')}" ${ro}></td>
          <td><input type="number" step="0.01" data-f="price_from" value="${s.price_from == null ? '' : s.price_from}" ${ro}></td><td><input type="number" data-f="duration_min" value="${s.duration_min}" ${ro}></td>
          <td><input type="checkbox" data-f="garage" ${s.location_ids.includes('garage') ? 'checked' : ''} ${ro}></td><td><input type="checkbox" data-f="mot" ${s.location_ids.includes('mot') ? 'checked' : ''} ${ro}></td>
          <td><input type="checkbox" data-f="online" ${s.online ? 'checked' : ''} ${ro}></td><td><input type="checkbox" data-f="walk_in" ${s.walk_in ? 'checked' : ''} ${ro}></td>
          <td><input type="number" data-f="max_concurrent" value="${s.max_concurrent == null ? '' : s.max_concurrent}" ${ro}></td><td><input type="checkbox" data-f="active" ${s.active ? 'checked' : ''} ${ro}></td>
          <td>${owner ? '<button class="btn btn-dark btn-sm" type="button" data-save>Save</button>' : ''}</td></tr>`).join('')}</tbody></table></div>`;
      $$('tr[data-id]', svcHost).forEach(tr => { const b = $('[data-save]', tr); if (!b) return; b.onclick = async () => {
        const s = services.find(x => x.id === tr.dataset.id), f = (k) => $(`[data-f="${k}"]`, tr);
        const ids = []; if (f('garage').checked) ids.push('garage'); if (f('mot').checked) ids.push('mot');
        if (!f('name').value.trim()) return crm.toast('A service needs a name', true);
        if (!ids.length) return crm.toast('Tick at least one site', true);
        const row = Object.assign({}, s, { name: f('name').value.trim(), price_label: nz(f('price_label').value), price_from: num(f('price_from').value), duration_min: num(f('duration_min').value) || s.duration_min,
          location_ids: ids, online: f('online').checked, walk_in: f('walk_in').checked, max_concurrent: num(f('max_concurrent').value), active: f('active').checked });
        try { const saved = await staff.saveService(row); Object.assign(s, saved); crm.toast('Saved ' + row.name); await crm.loadRef(); } catch (e) { crm.fail(e); }
      }; });
      if ($('#s-addsvc', el)) $('#s-addsvc', el).onclick = () => {
        const m = openModal('Add service', `${fld('Name', inp('ns-n', '', 'placeholder="e.g. Wheel alignment"'))}
          ${fld('Category', `<select class="input" id="ns-c">${['mot', 'servicing', 'repairs', 'tyres', 'diagnostics', 'other'].map(c => `<option ${c === 'other' ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
          <div class="row">${fld('Price label', inp('ns-l', '', 'placeholder="from £50" '))}${fld('From £', inp('ns-p', '', 'inputmode="decimal"'))}${fld('Minutes', inp('ns-d', '60', 'inputmode="numeric"'))}</div>
          <div id="ns-e" class="error"></div>`, '<button class="btn btn-primary" type="button" id="ns-s">Add service</button><button class="btn btn-ghost" type="button" data-close>Cancel</button>');
        $$('[data-close]', m).forEach(b => b.onclick = () => crm.closeModal());
        $('#ns-s', m).onclick = async () => {
          const name = $('#ns-n', m).value.trim(); const id = slug(name);
          if (!name || !id) return $('#ns-e', m).textContent = 'Give the service a name.';
          if (services.some(s => s.id === id)) return $('#ns-e', m).textContent = 'There is already a service with that name.';
          try {
            await staff.saveService({ id, name, category: $('#ns-c', m).value, description: '', duration_min: num($('#ns-d', m).value) || 60, price_from: num($('#ns-p', m).value), price_label: nz($('#ns-l', m).value),
              location_ids: ['garage'], online: true, walk_in: false, max_concurrent: null, sort: Math.max(0, ...services.map(s => s.sort || 0)) + 10, active: true });
            crm.closeModal(); crm.toast('Service added'); redraw();
          } catch (e) { crm.fail(e); }
        };
      };

      // --- sites ---
      $('#s-sites', el).innerHTML = crm.locations.map(l => {
        const bays = (l.bays || []).map(b => Object.assign({}, b));
        return `<div class="panel" data-loc="${esc(l.id)}"><h3>${esc(l.name)} <span>${l.id === 'mot' ? "Pam's MOT" : 'Garage'}</span></h3>
          <div class="row">${fld('Phone', inp('lp-' + l.id, l.phone, `type="tel" ${ro}`))}${fld('Slot length (minutes)', inp('ls-' + l.id, l.slot_minutes, `inputmode="numeric" ${ro}`))}</div>
          <div class="row">${fld('Jobs at once (staff)', inp('lc-' + l.id, l.capacity, `inputmode="numeric" ${ro}`))}${fld('Jobs online customers can book at once', inp('lo-' + l.id, l.online_capacity == null ? '' : l.online_capacity, `inputmode="numeric" placeholder="same as staff" ${ro}`))}</div>
          <p class="small muted" style="margin:-6px 0 12px">The rest stay free for walk-ins.</p>
          <div class="cv-sub">Opening hours</div><div data-hours></div>
          <div class="cv-sub">Bays & parking spaces</div><div data-bays></div>
          ${owner ? '<button class="btn btn-ghost btn-sm" type="button" data-addbay>+ Add space</button>' : ''}
          ${owner ? '<div style="margin-top:14px"><button class="btn btn-primary btn-sm" type="button" data-savesite>Save ' + esc(l.short_name) + '</button></div>' : ''}</div>`;
      }).join('');
      crm.locations.forEach(l => {
        const host = $(`[data-loc="${l.id}"]`, el), hours = {};
        const bays = (l.bays || []).map(b => Object.assign({}, b));
        $('[data-hours]', host).innerHTML = DAYS.map(([k, name]) => {
          const r = ((l.hours || {})[k] || [])[0]; hours[k] = ((l.hours || {})[k] || []);
          return `<div class="cv-hours" data-day="${k}"><b>${name}</b><label class="check" style="margin:0"><input type="checkbox" data-closed ${r ? '' : 'checked'} ${ro}> Closed</label><div class="t"><input type="time" data-o value="${r ? r[0] : '09:00'}" ${ro}> to <input type="time" data-c value="${r ? r[1] : '17:00'}" ${ro}></div></div>`;
        }).join('');
        $$('.cv-hours', host).forEach(row => { const sync = () => { $$('input[type=time]', row).forEach(t => t.style.opacity = $('[data-closed]', row).checked ? .4 : 1); }; $('[data-closed]', row).onchange = sync; sync(); });
        const drawBays = () => {
          $('[data-bays]', host).innerHTML = bays.map((b, i) => `<div class="cv-bay"><input type="text" data-bl="${i}" value="${esc(b.label)}" ${ro}><select data-bk="${i}" ${ro}><option value="work" ${b.kind === 'work' ? 'selected' : ''}>Work bay</option><option value="yard" ${b.kind !== 'work' ? 'selected' : ''}>Parking</option></select>
            ${owner ? `<button type="button" data-up="${i}" title="Move up">↑</button><button type="button" data-dn="${i}" title="Move down">↓</button><button type="button" data-rm="${i}" title="Remove">×</button>` : ''}</div>`).join('') || '<div class="muted small">No spaces yet.</div>';
          $$('[data-bl]', host).forEach(x => x.oninput = () => { bays[+x.dataset.bl].label = x.value; });
          $$('[data-bk]', host).forEach(x => x.onchange = () => { bays[+x.dataset.bk].kind = x.value; });
          $$('[data-up]', host).forEach(x => x.onclick = () => { const i = +x.dataset.up; if (i > 0) { [bays[i - 1], bays[i]] = [bays[i], bays[i - 1]]; drawBays(); } });
          $$('[data-dn]', host).forEach(x => x.onclick = () => { const i = +x.dataset.dn; if (i < bays.length - 1) { [bays[i + 1], bays[i]] = [bays[i], bays[i + 1]]; drawBays(); } });
          $$('[data-rm]', host).forEach(x => x.onclick = () => { if (confirm('Remove this space? Cars currently assigned to it will show as having no space.')) { bays.splice(+x.dataset.rm, 1); drawBays(); } });
        };
        drawBays();
        if ($('[data-addbay]', host)) $('[data-addbay]', host).onclick = () => { bays.push({ id: '', label: 'New space', kind: 'yard' }); drawBays(); const ins = $$('[data-bl]', host); ins[ins.length - 1].select(); };
        if ($('[data-savesite]', host)) $('[data-savesite]', host).onclick = async () => {
          try {
            const nh = {};
            DAYS.forEach(([k]) => { const row = $(`[data-day="${k}"]`, host); if ($('[data-closed]', row).checked) { nh[k] = []; return; }
              const o = $('[data-o]', row).value, c = $('[data-c]', row).value; if (!o || !c || o >= c) throw new Error(`Check the opening times for ${DAYS.find(d => d[0] === k)[1]}.`);
              nh[k] = [[o, c]].concat(hours[k].slice(1)); });
            const used = new Set(bays.map(b => b.id).filter(Boolean));
            const nb = bays.map(b => { const label = (b.label || '').trim() || 'Space'; let id = b.id; if (!id) { const base = slug(label) || 'space'; id = base; let n = 2; while (used.has(id)) id = base + '-' + n++; used.add(id); } return { id, label, kind: b.kind === 'work' ? 'work' : 'yard' }; });
            const cap = num($('#lc-' + l.id, host).value), slot = num($('#ls-' + l.id, host).value);
            if (!cap || cap < 1) throw new Error('Jobs at once must be 1 or more.'); if (!slot || slot < 5) throw new Error('Slot length must be at least 5 minutes.');
            const oc = num($('#lo-' + l.id, host).value); if (oc != null && oc > cap) throw new Error('Online jobs cannot be more than jobs at once.');
            await staff.saveLocation({ id: l.id, phone: nz($('#lp-' + l.id, host).value), hours: nh, capacity: cap, online_capacity: oc, slot_minutes: slot, bays: nb });
            await crm.loadRef(); crm.toast('Saved ' + l.short_name);
          } catch (e) { crm.fail(e); }
        };
      });

      // --- closed days ---
      const cl = $('#s-close', el);
      const drawClosures = () => {
        cl.innerHTML = `<h3>Closed days <span>${closures.length} upcoming</span></h3>
          ${owner ? `<div class="row" style="align-items:end;margin-bottom:10px">${fld('Date', inp('cd-d', '', 'type="date"'), 'max-width:190px')}${fld('Site', `<select class="input" id="cd-l"><option value="">Both sites</option>${crm.locations.map(l => `<option value="${esc(l.id)}">${esc(l.short_name)}</option>`).join('')}</select>`)}${fld('Reason', inp('cd-r', '', 'placeholder="e.g. Bank holiday"'))}<div class="field" style="flex:none"><button class="btn btn-dark btn-sm" type="button" id="cd-a">Add</button></div></div>` : ''}
          ${closures.map(c => `<div class="veh" style="cursor:default"><b style="min-width:130px">${fmt.dayOfIso(c.day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b><span class="tag ${c.location_id ? 'orange' : ''}">${c.location_id ? esc(crm.locName(c.location_id)) : 'Both sites'}</span><span class="muted" style="flex:1">${esc(c.reason || '')}</span>${owner ? `<button class="btn btn-ghost btn-sm" type="button" data-del="${c.id}">Remove</button>` : ''}</div>`).join('') || '<div class="muted small">No upcoming closed days.</div>'}`;
        if (owner) {
          $('#cd-a', cl).onclick = async () => {
            const day = $('#cd-d', cl).value; if (!day) return crm.toast('Pick a date', true);
            try { const r = await staff.addClosure({ day, location_id: $('#cd-l', cl).value || null, reason: nz($('#cd-r', cl).value) }); closures.push(r); closures.sort((a, b) => a.day.localeCompare(b.day)); crm.toast('Closed day added'); drawClosures(); } catch (e) { crm.fail(e); }
          };
          $$('[data-del]', cl).forEach(b => b.onclick = async () => { try { await staff.delClosure(b.dataset.del); closures = closures.filter(c => c.id !== b.dataset.del); crm.toast('Removed'); drawClosures(); } catch (e) { crm.fail(e); } });
        }
      };
      drawClosures();

      // --- booking rules ---
      $('#s-rules', el).innerHTML = `<h3>Booking rules</h3><div class="row">
        ${fld('Shortest notice for online bookings (hours)', inp('br-l', settings.lead_time_hours == null ? 2 : settings.lead_time_hours, `inputmode="numeric" ${ro}`))}
        ${fld('How far ahead people can book (days)', inp('br-m', settings.max_days_ahead == null ? 60 : settings.max_days_ahead, `inputmode="numeric" ${ro}`))}</div>
        ${fld('Online bookings', `<select class="input" id="br-a" ${ro}><option value="true" ${settings.auto_confirm === false || settings.auto_confirm === 'false' ? '' : 'selected'}>Confirmed automatically</option><option value="false" ${settings.auto_confirm === false || settings.auto_confirm === 'false' ? 'selected' : ''}>Wait for us to confirm</option></select>`, 'max-width:340px')}
        ${owner ? '<button class="btn btn-primary btn-sm" type="button" id="br-s">Save booking rules</button>' : ''}`;
      if (owner) $('#br-s', el).onclick = async () => {
        const lead = num($('#br-l', el).value), maxd = num($('#br-m', el).value);
        if (lead == null || lead < 0) return crm.toast('Notice must be 0 hours or more', true); if (!maxd || maxd < 1) return crm.toast('Days ahead must be 1 or more', true);
        try {
          await q(sb.from('za_settings').upsert([{ key: 'lead_time_hours', value: lead, public: true }, { key: 'max_days_ahead', value: maxd, public: true }, { key: 'auto_confirm', value: $('#br-a', el).value === 'true', public: false }]));
          await crm.loadRef(); crm.toast('Booking rules saved');
        } catch (e) { crm.fail(e); }
      };

      // --- staff ---
      $('#s-staff', el).innerHTML = `<h3>Staff <span>${staffRows.length}</span></h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead><tbody>${staffRows.map(s => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.email || '')}</td><td><span class="tag ${s.role === 'owner' ? 'orange' : ''}">${esc(s.role)}</span></td><td>${s.active ? '<span class="tag green">Active</span>' : '<span class="tag red">Off</span>'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No staff listed.</td></tr>'}</tbody></table></div>
        <p class="small muted" style="margin:10px 0 0">To add someone, ask Kola to create their login.</p>`;

      // --- demo data ---
      $('#s-demo', el).innerHTML = `<h3>Demo data</h3><p class="small muted" style="margin-top:0">Sample customers, cars and bookings used while setting up. Removing them does not touch anything you or customers entered for real.</p>
        ${owner ? '<button class="btn btn-ghost btn-sm" type="button" id="dm" style="color:var(--bad)">Remove demo data</button>' : '<span class="small muted">Only the owner can remove demo data.</span>'}`;
      if (owner) $('#dm', el).onclick = async () => {
        if (!confirm('Remove all demo customers, cars and bookings? This cannot be undone.')) return;
        try { await staff.clearDemo(); crm.toast('Demo data removed'); } catch (e) { crm.fail(e); }
      };
    }
  });
})();
