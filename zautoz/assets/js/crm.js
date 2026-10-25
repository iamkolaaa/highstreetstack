/* Z Autoz CRM core: auth, shell, router, Today board + yard, Diary, booking drawer, new-booking modal, global search.
   Other views live in crm-views.js and register via ZA.crm.register(). */
(function () {
  const { staff, pub, fmt, sb } = window.ZA;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = fmt.esc;

  const STATUSES = [
    ['requested', 'Requested'], ['confirmed', 'Booked'], ['arrived', 'Arrived'], ['in_progress', 'In progress'],
    ['ready', 'Ready'], ['collected', 'Collected'], ['cancelled', 'Cancelled'], ['no_show', 'No-show']
  ];
  const STATUS_LABEL = Object.fromEntries(STATUSES);
  const BOARD_COLS = [['confirmed', 'Booked in'], ['arrived', 'On site'], ['in_progress', 'In progress'], ['ready', 'Ready to collect'], ['collected', 'Collected']];

  const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICONS = {
    today: I('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
    diary: I('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    customers: I('<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-5-5.5"/>'),
    vehicles: I('<path d="M5 17h14M3 13l2-6h14l2 6v4H3z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
    mot: I('<path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7z"/><path d="M8 12l3 3 5-6"/>'),
    import: I('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
    settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    search: I('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    phone: I('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
    chat: I('<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>'),
    print: I('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>')
  };
  const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true" style="height:30px;width:auto"><defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#ff7a1a"/><stop offset="1" stop-color="#d4213d"/></linearGradient></defs><g transform="translate(32 32)"><g fill="#c9ced8"><circle r="21"/>${[0,45,90,135,180,225,270,315].map(a=>`<rect x="-4" y="-29" width="8" height="10" rx="1.5" transform="rotate(${a})"/>`).join('')}</g><circle r="15" fill="#111318"/><path d="M-9 -9 H9 L-3 5 H9 V9 H-9 L3 -5 H-9 Z" fill="url(#lg)"/></g></svg>`;

  const crm = window.ZA.crm = {
    me: null, locations: [], services: [], settings: {}, views: {}, order: [], route: null,
    loc: (() => { try { return localStorage.getItem('za-loc') || 'all'; } catch (_) { return 'all'; } })(),
    ICONS, STATUSES, STATUS_LABEL, esc, $, $$,
    register(name, def) { this.views[name] = def; if (def.nav && !this.order.includes(name)) this.order.push(name); },
    setLoc(l) { this.loc = l; try { localStorage.setItem('za-loc', l); } catch (_) {} },
    locName(id) { const l = this.locations.find(x => x.id === id); return l ? l.short_name : id; },
    svc(id) { return this.services.find(s => s.id === id); },
    statusPill(s) { return `<span class="st st-${s}">${STATUS_LABEL[s] || s}</span>`; },
    plate(r) { return r ? `<span class="plate-badge">${esc(fmt.plate(r))}</span>` : '<span class="muted small">no reg</span>'; },
    motPill(d) {
      if (!d) return '';
      const n = fmt.daysUntil(d);
      const cls = n < 0 ? 'over' : n <= 30 ? 'soon' : 'ok';
      const txt = n < 0 ? `MOT expired ${-n}d ago` : n === 0 ? 'MOT due today' : n <= 60 ? `MOT due in ${n}d` : 'MOT ' + fmt.date(d);
      return `<span class="mot-pill ${cls}">${txt}</span>`;
    },
    locSeg(onChange, withAll = true) {
      const opts = (withAll ? [['all', 'Both sites']] : []).concat(this.locations.map(l => [l.id, l.id === 'mot' ? "Pam's MOT" : 'Garage']));
      const cur = withAll ? this.loc : (this.loc === 'all' ? this.locations[0].id : this.loc);
      const id = 'seg' + Math.random().toString(36).slice(2, 7);
      setTimeout(() => {
        const el = document.getElementById(id); if (!el) return;
        el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; this.setLoc(b.dataset.v); $$('button', el).forEach(x => x.classList.toggle('on', x === b)); onChange(b.dataset.v); });
      });
      return `<div class="seg" id="${id}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" class="${v === cur ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    },
    toast(msg, bad) {
      const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; const long = arguments[2];
      $('#toasts').appendChild(t); setTimeout(() => t.remove(), long || (bad ? 6000 : 3200));
    },
    fail(e) { console.error(e); crm.toast(e && e.message ? e.message : 'Something went wrong', true); },
    modal(html) { const m = $('#modal'); m.innerHTML = html; m.classList.add('open'); $('#scrim').classList.add('open'); const f = $('input,select,textarea', m); if (f) setTimeout(() => f.focus(), 60); return m; },
    closeModal() { $('#modal').classList.remove('open'); if (!$('#drawer').classList.contains('open')) $('#scrim').classList.remove('open'); },
    drawer(html) { const d = $('#drawer'); d.innerHTML = html; d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('open'); return d; },
    closeDrawer() { const d = $('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); if (!$('#modal').classList.contains('open')) $('#scrim').classList.remove('open'); },
    go(hash) { if (location.hash === hash) render(); else location.hash = hash; },
    refresh() { render(); },
    // Called by realtime; views may set crm.onLive = fn
    onLive: null,
    async loadRef() {
      [this.locations, this.services, this.settings] = await Promise.all([pub.locations(), staff.allServices(), pub.settings().catch(() => ({}))]);
    },
    whatsappText(c, v, kind) {
      const name = c.first_name || 'there';
      const reg = v ? fmt.plate(v.reg || v.vehicle_reg || '') : '';
      if (kind === 'ready') return `Hi ${name}, your ${reg ? reg + ' ' : ''}is ready to collect from Z Autoz. Thanks!`;
      if (kind === 'mot') return `Hi ${name}, a reminder from Z Autoz / Pam's MOT Centre: the MOT on ${reg} is due on ${fmt.date(v.mot_expiry)}. Book online at https://highstreetstack.com/zautoz/book.html?service=mot4&reg=${fmt.normReg(reg)} or call 01908 644514.`;
      if (kind === 'confirm') return `Hi ${name}, you're booked in at Z Autoz. Ref ${v.ref}, ${fmt.longDay(v.starts_at)} at ${fmt.time(v.starts_at)}. Any problems, just reply.`;
      return `Hi ${name}, it's Z Autoz.`;
    }
  };

  // ---------- auth ----------
  async function boot() {
    const s = await staff.session();
    if (!s) return showLogin();
    try { crm.me = await staff.me(); } catch (e) { crm.me = null; }
    if (!crm.me || !crm.me.active) return showNoAccess(s.user.email);
    try { await crm.loadRef(); } catch (e) { crm.fail(e); }
    shell();
    window.addEventListener('hashchange', render);
    render();
    staff.onBookings(() => { if (typeof crm.onLive === 'function') crm.onLive(); updateBadges(); });
    updateBadges(); setInterval(updateBadges, 60000);
  }
  function showLogin(msg) {
    $('#app').innerHTML = `<div class="login"><div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">${LOGO.replace('height:30px', 'height:52px')}<h2 style="margin:0;font-style:italic">Z Autoz Workshop</h2></div>
      <form id="lf">
        <div class="field"><label for="le">Email</label><input class="input" id="le" type="email" autocomplete="username" required></div>
        <div class="field"><label for="lp">Password</label><input class="input" id="lp" type="password" autocomplete="current-password"></div>
        <div id="lerr" class="error" style="margin-bottom:10px">${msg ? esc(msg) : ''}</div>
        <button class="btn btn-primary" style="width:100%">Sign in</button>
        <button class="btn btn-ghost btn-sm" type="button" id="lm" style="width:100%;margin-top:10px">Email me a sign-in link instead</button>
      </form>
      <p class="small muted" style="margin:16px 0 0">Staff only. <a href="../">Back to the website</a></p><a class="btn btn-dark btn-sm" href="demo.html" style="width:100%;margin-top:14px">Open the demo workshop (no login)</a></div></div>`;
    $('#lf').addEventListener('submit', async e => {
      e.preventDefault(); $('#lerr').textContent = '';
      try { await staff.signIn($('#le').value.trim(), $('#lp').value); boot(); } catch (er) { $('#lerr').textContent = er.message; }
    });
    $('#lm').addEventListener('click', async () => {
      const em = $('#le').value.trim(); if (!em) { $('#lerr').textContent = 'Type your email first.'; return; }
      try { await staff.magic(em); $('#lerr').innerHTML = '<span style="color:var(--ok)">Check your email for the sign-in link.</span>'; } catch (er) { $('#lerr').textContent = er.message; }
    });
  }
  function showNoAccess(email) {
    $('#app').innerHTML = `<div class="login"><div class="card"><h2>No workshop access</h2><p class="muted">${esc(email)} is signed in but isn't on the Z Autoz staff list. Ask the owner to add you.</p><button class="btn btn-dark" id="so">Sign out</button></div></div>`;
    $('#so').onclick = async () => { await staff.signOut(); showLogin(); };
  }

  // ---------- shell ----------
  const NAV = [['today', 'Today'], ['diary', 'Diary'], ['customers', 'Customers'], ['vehicles', 'Vehicles'], ['mot', 'MOT reminders'], ['import', 'Add from paper'], ['settings', 'Settings']];
  function shell() {
    $('#app').innerHTML = `
      <div class="crm-shell">
        <nav class="side">
          <a class="brand" href="#/today" style="text-decoration:none;color:#fff;display:flex;gap:8px;align-items:center">${LOGO}<b style="font-family:var(--display);font-style:italic;text-transform:uppercase"><span class="grad-text">Z</span> Autoz</b></a>
          ${NAV.map(([k, t]) => `<a class="nav-i" data-nav="${k}" href="#/${k}">${ICONS[k]}<span>${t}</span><span class="badge" id="b-${k}" style="display:none"></span></a>`).join('')}
          <div class="foot">${esc(crm.me.name)} · ${esc(crm.me.role)}<br><button id="signout">Sign out</button> · <a href="../" style="color:#ffb48a">Website</a></div>
        </nav>
        <div class="main">
          <div class="topbar">
            <h1 id="title"></h1>
            <div class="spacer"></div>
            <div class="gsearch">${ICONS.search}<input id="gs" placeholder="Search reg, name or phone…" autocomplete="off"><div class="gresults" id="gr"></div></div>
            <button class="btn btn-primary btn-sm" id="newb">${ICONS.plus.replace('<svg', '<svg width="16" height="16"')} New booking</button>
          </div>
          <div class="content" id="view"></div>
        </div>
      </div>
      <nav class="mobile-nav">${NAV.map(([k, t]) => `<a data-nav="${k}" href="#/${k}">${ICONS[k]}<span>${{ import: 'Add', mot: 'MOT', settings: 'Setup' }[k] || t.split(' ')[0]}</span></a>`).join('')}</nav>`;
    $('#signout').onclick = async () => { await staff.signOut(); location.hash = ''; showLogin(); };
    $('#newb').onclick = () => crm.newBooking();
    $('#scrim').onclick = () => { crm.closeModal(); crm.closeDrawer(); };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { crm.closeModal(); crm.closeDrawer(); $('#gr').classList.remove('open'); }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#gs').focus(); }
    });
    globalSearch();
  }
  async function updateBadges() {
    try {
      const s = await staff.stats(); if (!s) return;
      const set = (k, n) => { const b = $('#b-' + k); if (b) { b.style.display = n ? '' : 'none'; b.textContent = n; } };
      set('today', s.requested); set('mot', s.mot_due_30 + s.mot_overdue);
    } catch (_) {}
  }

  function render() {
    const gs = $('#gs'); if (gs) { gs.value = ''; $('#gr').classList.remove('open'); }
    const parts = (location.hash.replace(/^#\/?/, '') || 'today').split('/');
    const name = parts[0]; const v = crm.views[name] || crm.views.today;
    crm.route = name; crm.onLive = null;
    $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name || (name === 'customer' && a.dataset.nav === 'customers') || (name === 'vehicle' && a.dataset.nav === 'vehicles')));
    $('#title').textContent = v.title || '';
    const el = $('#view'); el.innerHTML = '<div class="skeleton" style="height:200px"></div>';
    Promise.resolve(v.render(el, parts.slice(1).map(decodeURIComponent))).catch(e => { el.innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; crm.fail(e); });
  }

  // ---------- global search ----------
  function globalSearch() {
    const inp = $('#gs'), box = $('#gr'); let t, hl = -1, items = [];
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 180); });
    inp.addEventListener('focus', () => { if (inp.value) run(); });
    document.addEventListener('click', e => { if (!e.target.closest('.gsearch')) box.classList.remove('open'); });
    inp.addEventListener('keydown', e => {
      const as = $$('a', box);
      if (e.key === 'ArrowDown') { hl = Math.min(as.length - 1, hl + 1); }
      else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); }
      else if (e.key === 'Enter') { const a = as[hl >= 0 ? hl : 0]; if (a) { a.click(); } e.preventDefault(); return; }
      else return;
      e.preventDefault(); as.forEach((a, i) => a.classList.toggle('hl', i === hl));
    });
    async function run() {
      const q = inp.value.trim(); hl = -1;
      if (q.length < 2) { box.classList.remove('open'); return; }
      try {
        const [cs, vs] = await Promise.all([staff.search(q, 8), fmt.normReg(q).length >= 2 ? staff.vehicles(q) : Promise.resolve([])]);
        items = [];
        vs.slice(0, 6).forEach(v => items.push(`<a href="#/vehicle/${v.id}">${crm.plate(v.reg)}<span>${esc([v.make, v.model].filter(Boolean).join(' '))}<br><span class="small muted">${v.za_customers ? esc(fmt.name(v.za_customers)) : 'No owner linked'}</span></span></a>`));
        cs.forEach(c => items.push(`<a href="#/customer/${c.id}"><b>${esc(fmt.name(c))}</b><span class="small muted">${esc(c.phone || '')} ${c.regs ? '· ' + esc(c.regs) : ''}</span></a>`));
        const reg = fmt.normReg(q);
        if (fmt.plateValid(reg) && !vs.some(v => v.reg === reg)) items.unshift(`<a href="#" data-newreg="${reg}">${crm.plate(reg)}<span><b>New vehicle</b><br><span class="small muted">Book it in</span></span></a>`);
        box.innerHTML = items.join('') || '<div style="padding:14px" class="muted">No matches</div>';
        box.classList.add('open');
        $$('a', box).forEach(a => a.addEventListener('click', e => {
          box.classList.remove('open'); inp.value = '';
          if (a.dataset.newreg) { e.preventDefault(); crm.newBooking({ reg: a.dataset.newreg }); }
        }));
      } catch (e) { crm.fail(e); }
    }
  }

  // ---------- TODAY: tiles + board / yard ----------
  crm.register('today', {
    title: 'Today', nav: true,
    async render(el) {
      let mode = (() => { try { return localStorage.getItem('za-today-mode') || 'board'; } catch (_) { return 'board'; } })();
      el.innerHTML = `
        <div class="tiles" id="tiles"></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
          ${crm.locSeg(() => load())}
          <div class="seg" id="mode"><button data-m="board" class="${mode === 'board' ? 'on' : ''}">Job board</button><button data-m="yard" class="${mode === 'yard' ? 'on' : ''}">Yard map</button><button data-m="list" class="${mode === 'list' ? 'on' : ''}">List</button></div>
          <div class="spacer" style="flex:1"></div>
          <button class="btn btn-dark btn-sm" id="walkin">+ Walk-in now</button>
        </div>
        <div id="requested"></div>
        <div id="area"></div>`;
      $('#mode', el).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; try { localStorage.setItem('za-today-mode', mode); } catch (_) {} $$('#mode button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); });
      $('#walkin', el).onclick = () => crm.newBooking({ walkIn: true });
      let rows = [];
      async function load() {
        const day = fmt.today();
        const from = new Date(day + 'T00:00:00Z'); from.setUTCHours(from.getUTCHours() - 2);
        const to = new Date(day + 'T23:59:59Z'); to.setUTCHours(to.getUTCHours() + 2);
        const [today, onsite, stats] = await Promise.all([
          staff.bookingsBetween(from.toISOString(), to.toISOString(), crm.loc),
          staff.bookingsWhere({ status: ['arrived', 'in_progress', 'ready', 'requested'] }),
          staff.stats()
        ]);
        const map = new Map();
        today.filter(b => fmt.isoDay(new Date(b.starts_at)) === day).forEach(b => map.set(b.id, b));
        onsite.filter(b => crm.loc === 'all' || b.location_id === crm.loc).forEach(b => map.set(b.id, b)); // cars still on site from earlier days + all requests
        rows = Array.from(map.values()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        tiles(stats); draw();
      }
      function tiles(s) {
        if (!s) return;
        $('#tiles', el).innerHTML = [
          [s.today, 'Booked today', '#/diary'], [s.on_site, 'Cars on site', '#/today'], [s.requested, 'Need confirming', '#/today', s.requested > 0],
          [s.mot_due_30, 'MOTs due in 30 days', '#/mot'], [s.customers, 'Customers', '#/customers'], [fmt.money(s.week_value), 'Booked this week', '#/diary']
        ].map(([n, t, h, alert]) => `<a class="tile ${alert ? 'alert' : ''}" href="${h}"><b>${n}</b><span>${t}</span></a>`).join('');
      }
      function card(b) {
        const late = b.status === 'confirmed' && new Date(b.starts_at) < new Date(Date.now() - 15 * 60000);
        return `<div class="jc loc-${b.location_id} ${late ? 'late' : ''}" draggable="true" data-id="${b.id}">
          <div class="t">${crm.plate(b.reg_display || b.vehicle_reg)}<b>${fmt.time(b.starts_at)}</b></div>
          <div class="who">${esc(fmt.name(b))}</div>
          <div class="svc">${esc(b.service_name)}${b.bay ? ' · ' + esc(bayLabel(b)) : ''}</div>
          <div class="meta">${b.make ? `<span class="tag">${esc([b.make, b.model].filter(Boolean).join(' '))}</span>` : ''}${crm.loc === 'all' ? `<span class="tag ${b.location_id === 'mot' ? 'green' : 'orange'}">${b.location_id === 'mot' ? 'MOT centre' : 'Garage'}</span>` : ''}${late ? '<span class="tag red">Late</span>' : ''}${b.source === 'online' ? '<span class="tag">Online</span>' : ''}${fmt.isoDay(new Date(b.starts_at)) !== fmt.today() ? '<span class="tag">Since ' + fmt.day(b.starts_at, { day: 'numeric', month: 'short' }) + '</span>' : ''}</div>
        </div>`;
      }
      function bayLabel(b) { const l = crm.locations.find(x => x.id === b.location_id); const bay = l && l.bays.find(x => x.id === b.bay); return bay ? bay.label : b.bay; }
      function draw() {
        const req = rows.filter(b => b.status === 'requested');
        $('#requested', el).innerHTML = req.length ? `<div class="panel" style="border-color:#f3df9b;background:#fffbea"><h3>Online requests to confirm <span>${req.length}</span></h3>${req.map(b => `
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid #f3e8bf">
            ${crm.plate(b.reg_display)}<b>${esc(fmt.name(b))}</b><span class="muted small">${esc(b.service_name)} · ${fmt.day(b.starts_at)} ${fmt.time(b.starts_at)} · ${esc(crm.locName(b.location_id))}</span>
            <span style="flex:1"></span><button class="btn btn-sm btn-green" data-confirm="${b.id}">Confirm</button><button class="btn btn-sm btn-ghost" data-open="${b.id}">Open</button></div>`).join('')}</div>` : '';
        const act = rows.filter(b => !['requested', 'cancelled', 'no_show'].includes(b.status));
        const area = $('#area', el);
        if (mode === 'board') {
          area.innerHTML = `<div class="board">${BOARD_COLS.map(([s, t]) => { const list = act.filter(b => b.status === s); return `<div class="col" data-status="${s}"><h4>${t}<span>${list.length}</span></h4>${list.map(card).join('') || ''}</div>`; }).join('')}</div>
          <p class="small muted" style="margin-top:8px">Drag a card to move it along. Click a card for the job sheet.</p>`;
          dnd(area, '.col', async (id, col) => move(id, { status: col.dataset.status }));
        } else if (mode === 'yard') {
          const locs = crm.loc === 'all' ? crm.locations : crm.locations.filter(l => l.id === crm.loc);
          const onsite = act.filter(b => ['arrived', 'in_progress', 'ready'].includes(b.status));
          area.innerHTML = locs.map(l => {
            const here = onsite.filter(b => b.location_id === l.id);
            const unplaced = here.filter(b => !b.bay || !l.bays.some(x => x.id === b.bay));
            const expected = act.filter(b => b.location_id === l.id && b.status === 'confirmed');
            const used = here.length; const cap = l.bays.length;
            return `<div class="panel"><h3>${esc(l.short_name)} <span class="${used >= cap ? 'error' : ''}">${used}/${cap} spaces used</span></h3>
              <div class="yard-legend"><span>🟧 Work bays</span><span>⬜ Parking</span><span>Drag cars between spaces. Expected today: ${expected.length}</span></div>
              <div class="unplaced" data-bay="" data-loc="${l.id}">${unplaced.length ? unplaced.map(b => `<div class="chip" draggable="true" data-id="${b.id}">${crm.plate(b.reg_display)}<span class="small">${esc(b.service_name)}</span></div>`).join('') : '<span class="small muted">Cars on site without a space appear here. Mark a car "Arrived" to put it on the map.</span>'}</div>
              <div class="yard">${l.bays.map(bay => { const b = here.find(x => x.bay === bay.id); return `<div class="bay ${bay.kind === 'work' ? 'work' : ''} ${b ? '' : 'empty'}" data-bay="${bay.id}" data-loc="${l.id}"><div class="lbl">${esc(bay.label)}</div>${b ? `<div class="car" draggable="true" data-id="${b.id}">${crm.plate(b.reg_display)}<div class="who">${esc(fmt.name(b))} · ${esc(b.service_name)}</div><div style="margin-top:4px">${crm.statusPill(b.status)}</div></div>` : ''}</div>`; }).join('')}</div></div>`;
          }).join('');
          dnd(area, '.bay, .unplaced', async (id, zone) => {
            const b = rows.find(r => r.id === id);
            if (b && zone.dataset.loc !== b.location_id) return crm.toast('That car is booked at the other site.', true);
            const taken = rows.find(r => r.bay === zone.dataset.bay && zone.dataset.bay && r.id !== id && r.location_id === zone.dataset.loc && ['arrived', 'in_progress', 'ready'].includes(r.status));
            if (taken) { await staff.updateBooking(taken.id, { bay: b.bay || null }); taken.bay = b.bay || null; } // swap
            return move(id, { bay: zone.dataset.bay || null });
          }, '[draggable]');
        } else {
          area.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Reg</th><th>Customer</th><th>Job</th><th>Site</th><th>Status</th></tr></thead><tbody>${act.map(b => `<tr class="click" data-open="${b.id}"><td><b>${fmt.time(b.starts_at)}</b></td><td>${crm.plate(b.reg_display)}</td><td>${esc(fmt.name(b))}<div class="small muted">${esc(b.phone || '')}</div></td><td>${esc(b.service_name)}</td><td>${esc(crm.locName(b.location_id))}</td><td>${crm.statusPill(b.status)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state"><b>Nothing booked today</b>Walk-ins can be added with the button above.</td></tr>'}</tbody></table></div>`;
        }
        $$('[data-open], .jc, .car, .chip', el).forEach(n => n.addEventListener('click', e => { if (e.target.closest('[data-confirm]')) return; crm.openBooking(n.dataset.open || n.dataset.id, load); }));
        $$('[data-confirm]', el).forEach(n => n.addEventListener('click', async e => { e.stopPropagation(); try { await staff.setStatus(n.dataset.confirm, 'confirmed'); crm.toast('Confirmed'); load(); } catch (er) { crm.fail(er); } }));
      }
      async function move(id, patch) {
        const b = rows.find(r => r.id === id); if (!b) return;
        try {
          if (patch.status && patch.status !== b.status) { await staff.setStatus(id, patch.status); Object.assign(b, { status: patch.status }); if (['collected'].includes(patch.status)) b.bay = null; if (patch.status === 'ready') maybeTellReady(b); }
          if ('bay' in patch) { await staff.updateBooking(id, { bay: patch.bay, status: ['confirmed'].includes(b.status) ? 'arrived' : b.status }); b.bay = patch.bay; if (b.status === 'confirmed') b.status = 'arrived'; }
          draw();
        } catch (e) { crm.fail(e); load(); }
      }
      function maybeTellReady(b) {
        if (!b.phone) return;
        crm.toast(`${fmt.plate(b.reg_display)} marked ready`);
        crm.modal(`<div class="drawer-h"><h3 style="margin:0">Tell ${esc(b.first_name || 'the customer')} it's ready?</h3><button class="x" onclick="ZA.crm.closeModal()">×</button></div>
          <div class="drawer-b"><p>${crm.plate(b.reg_display)} ${esc(b.service_name)}</p><div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn btn-green" target="_blank" rel="noopener" href="${fmt.whatsapp(b.phone, crm.whatsappText(b, b, 'ready'))}">WhatsApp</a>
          <a class="btn btn-dark" href="sms:${b.phone.replace(/\s/g, '')}?&body=${encodeURIComponent(crm.whatsappText(b, b, 'ready'))}">Text</a>
          <a class="btn btn-ghost" href="${fmt.phoneHref(b.phone)}">Call</a><button class="btn btn-ghost" onclick="ZA.crm.closeModal()">Not now</button></div></div>`);
      }
      crm.onLive = () => load();
      await load();
    }
  });

  // Simple drag and drop + touch fallback (tap a card then tap a zone)
  function dnd(root, zoneSel, onDrop, itemSel) {
    itemSel = itemSel || '[draggable]';
    let dragId = null, armed = null;
    $$(itemSel, root).forEach(it => {
      it.addEventListener('dragstart', e => { dragId = it.dataset.id; it.classList.add('dragging'); e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; });
      it.addEventListener('dragend', () => it.classList.remove('dragging'));
    });
    $$(zoneSel, root).forEach(z => {
      z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('drop'); });
      z.addEventListener('dragleave', () => z.classList.remove('drop'));
      z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('drop'); const id = e.dataTransfer.getData('text/plain') || dragId; if (id) onDrop(id, z); });
    });
  }

  // ---------- DIARY ----------
  crm.register('diary', {
    title: 'Diary', nav: true,
    async render(el, params) {
      let day = params[0] || fmt.today();
      let view = 'day';
      el.innerHTML = `<div class="diary"><div class="diary-head">
          <button class="btn btn-ghost btn-sm" id="prev">‹</button><button class="btn btn-ghost btn-sm" id="tod">Today</button><button class="btn btn-ghost btn-sm" id="next">›</button>
          <input type="date" class="input" id="pick" style="width:auto;padding:7px 10px">
          <b id="dlabel" style="font-size:1.05rem"></b><span style="flex:1"></span>
          <div class="seg" id="dv"><button data-v="day" class="on">Day</button><button data-v="week">Week</button></div>
          ${crm.locSeg(() => load())}
        </div><div id="grid"></div></div>
        <p class="small muted" style="margin-top:8px">Click an empty time to book it. Dashed outline = online request waiting for confirmation.</p>`;
      const H0 = 8, H1 = 18.5, PX = 56; // px per hour
      $('#prev', el).onclick = () => { day = fmt.addDays(day, view === 'week' ? -7 : -1); load(); };
      $('#next', el).onclick = () => { day = fmt.addDays(day, view === 'week' ? 7 : 1); load(); };
      $('#tod', el).onclick = () => { day = fmt.today(); load(); };
      $('#pick', el).onchange = e => { if (e.target.value) { day = e.target.value; load(); } };
      $('#dv', el).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; $$('#dv button', el).forEach(x => x.classList.toggle('on', x === b)); load(); });
      async function load() {
        $('#pick', el).value = day;
        let days = [day];
        if (view === 'week') { const dow = (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7; const mon = fmt.addDays(day, -dow); days = Array.from({ length: 6 }, (_, i) => fmt.addDays(mon, i)); }
        $('#dlabel', el).textContent = view === 'week' ? `Week of ${fmt.dayOfIso(days[0], { day: 'numeric', month: 'long' })}` : fmt.dayOfIso(day, { weekday: 'long', day: 'numeric', month: 'long' });
        const from = new Date(days[0] + 'T00:00:00Z'); from.setUTCHours(-2);
        const to = new Date(days[days.length - 1] + 'T23:59:00Z'); to.setUTCHours(26);
        const rows = await staff.bookingsBetween(from.toISOString(), to.toISOString(), crm.loc);
        const locs = crm.loc === 'all' ? crm.locations : crm.locations.filter(l => l.id === crm.loc);
        const lanes = [];
        days.forEach(d => locs.forEach(l => lanes.push({ d, l })));
        const hours = []; for (let h = H0; h < H1; h++) hours.push(h);
        $('#grid', el).innerHTML = `<div style="overflow-x:auto"><div class="diary-grid" style="grid-template-columns:54px 1fr;min-width:${Math.max(600, lanes.length * 130)}px">
          <div class="diary-times"><div class="diary-lane-h" style="height:37px"></div>${hours.map(h => `<div>${String(h).padStart(2, '0')}:00</div>`).join('')}</div>
          <div class="diary-lanes" style="grid-template-columns:repeat(${lanes.length},1fr)">
          ${lanes.map(({ d, l }) => {
            const evs = rows.filter(b => b.location_id === l.id && fmt.isoDay(new Date(b.starts_at)) === d);
            // place overlapping events side by side
            const placed = []; evs.forEach(b => { const s = new Date(b.starts_at), e = new Date(b.ends_at); let col = 0; while (placed.some(p => p.col === col && p.s < e && p.e > s)) col++; placed.push({ b, s, e, col }); });
            const ncol = Math.max(1, ...placed.map(p => p.col + 1));
            return `<div class="diary-lane" data-day="${d}" data-loc="${l.id}"><div class="diary-lane-h">${view === 'week' ? fmt.dayOfIso(d, { weekday: 'short', day: 'numeric' }) + ' · ' : ''}${l.id === 'mot' ? "Pam's MOT" : 'Garage'}</div>
              <div style="position:relative">${hours.map(h => `<div class="hr" data-h="${h}"></div>`).join('')}
              ${placed.map(({ b, s, e, col }) => { const top = (hm(b.starts_at) - H0) * PX, ht = Math.max(22, (e - s) / 36e5 * PX - 2); return `<div class="ev loc-${b.location_id} st-${b.status}" data-id="${b.id}" style="top:${top}px;height:${ht}px;left:${3 + col * (100 / ncol)}%;width:calc(${100 / ncol}% - 6px);right:auto" title="${esc(b.service_name)}"><b>${fmt.time(b.starts_at)} ${esc(fmt.plate(b.reg_display || ''))}</b><br>${esc(fmt.name(b))}<br>${esc(b.service_name)}</div>`; }).join('')}
              ${d === fmt.today() ? `<div class="now-line" style="top:${(hm(new Date()) - H0) * PX}px"></div>` : ''}
              </div></div>`;
          }).join('')}</div></div></div>`;
        $$('.ev', el).forEach(n => n.onclick = () => crm.openBooking(n.dataset.id, load));
        $$('.hr', el).forEach(n => n.onclick = e => {
          const lane = n.closest('.diary-lane'); const rect = n.getBoundingClientRect();
          const mins = (e.clientY - rect.top) / rect.height * 60 < 30 ? 0 : 30;
          crm.newBooking({ location_id: lane.dataset.loc, day: lane.dataset.day, time: String(n.dataset.h).padStart(2, '0') + ':' + String(mins).padStart(2, '0') }, load);
        });
      }
      function hm(ts) { const t = fmt.time(ts).split(':'); return Number(t[0]) + Number(t[1]) / 60; }
      crm.onLive = () => load();
      await load();
    }
  });

  // ---------- BOOKING DRAWER ----------
  crm.openBooking = async function (id, after) {
    const d = crm.drawer('<div class="drawer-b"><div class="skeleton" style="height:300px"></div></div>');
    let b, lines, events, notes;
    try { [b, lines, events] = await Promise.all([staff.booking(id), staff.lines(id), staff.events(id)]); notes = await staff.notes('booking_id', id); }
    catch (e) { crm.closeDrawer(); return crm.fail(e); }
    const loc = crm.locations.find(l => l.id === b.location_id) || { bays: [] };
    const total = () => lines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0);
    const isMot = (b.service_id || '').startsWith('mot');
    d.innerHTML = `
      <div class="drawer-h">${crm.plate(b.reg_display || b.vehicle_reg)}<div><b>${esc(b.service_name)}</b><div class="small muted">${esc(b.ref)} · ${esc(crm.locName(b.location_id))}</div></div><button class="x" id="dx">×</button></div>
      <div class="drawer-b">
        <div class="status-flow" id="sf">${STATUSES.map(([k, t]) => `<button data-s="${k}" class="${b.status === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <dl class="kv">
          <dt>When</dt><dd><b>${fmt.longDay(b.starts_at)}</b>, ${fmt.time(b.starts_at)}–${fmt.time(b.ends_at)} <button class="btn btn-sm btn-ghost" id="move" style="padding:3px 10px;margin-left:6px">Move</button></dd>
          <dt>Customer</dt><dd><a href="#/customer/${b.customer_id}">${esc(fmt.name(b))}</a><div class="small">${b.phone ? `<a href="${fmt.phoneHref(b.phone)}">${esc(b.phone)}</a> · <a target="_blank" rel="noopener" href="${fmt.whatsapp(b.phone, crm.whatsappText(b, b, 'confirm'))}">WhatsApp</a>` : '<span class="muted">no phone</span>'}${b.email ? ' · ' + esc(b.email) : ''}</div></dd>
          <dt>Vehicle</dt><dd><a href="#/vehicle/${b.vehicle_id}">${esc([b.make, b.model, b.colour].filter(Boolean).join(' ') || 'Details not recorded')}</a> ${crm.motPill(b.mot_expiry)}${b.vehicle_reg ? '<div style="margin-top:6px">' + fmt.govBtn(b.vehicle_reg, 'MOT history on GOV.UK') + '</div>' : ''}</dd>
          <dt>Booked</dt><dd>${esc(b.source)} · ${fmt.date(b.created_at)}</dd>
          ${b.customer_notes ? `<dt>Customer says</dt><dd style="white-space:pre-wrap">${esc(b.customer_notes)}</dd>` : ''}
        </dl>
        <div class="box"><h4>Workshop</h4>
          <div class="row">
            <div class="field"><label>Space</label><select class="input" id="bay"><option value="">Not on site / no space</option>${loc.bays.map(x => `<option value="${x.id}" ${b.bay === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
            <div class="field"><label>Mileage</label><input class="input" id="mileage" inputmode="numeric" value="${b.mileage || ''}" placeholder="e.g. 64,210"></div>
          </div>
          ${isMot ? `<div class="field"><label>MOT result</label><div class="seg" id="motres">${[['', '—'], ['pass', 'Pass'], ['pass_advisories', 'Pass + advisories'], ['fail', 'Fail']].map(([v, t]) => `<button type="button" data-v="${v}" class="${(b.mot_result || '') === v ? 'on' : ''}">${t}</button>`).join('')}</div>
            <div id="newexp" style="margin-top:8px;${b.mot_result && b.mot_result !== 'fail' ? '' : 'display:none'}"><label class="small">New MOT expiry</label><input type="date" class="input" id="newmot" style="max-width:200px" value=""></div></div>` : ''}
          <div class="field"><label>Staff notes</label><textarea class="input" id="snotes" rows="3" placeholder="What was found, advisories, parts ordered…">${esc(b.staff_notes || '')}</textarea></div>
        </div>
        <div class="box"><h4>Parts & labour</h4>
          <table class="lines" style="width:100%"><thead><tr><th style="width:90px">Type</th><th>Description</th><th style="width:56px">Qty</th><th style="width:80px">£ each</th><th style="width:70px;text-align:right">Total</th><th></th></tr></thead><tbody id="lines"></tbody></table>
          <button class="btn btn-ghost btn-sm" id="addline" style="margin-top:8px">+ Add line</button>
          <div class="row" style="margin-top:12px;align-items:end">
            <div class="field"><label>Quoted</label><input class="input" id="pq" inputmode="decimal" value="${b.price_quoted ?? ''}"></div>
            <div class="field"><label>Final price</label><input class="input" id="pf" inputmode="decimal" value="${b.price_final ?? ''}" placeholder="auto from lines"></div>
            <div class="field"><label class="check" style="margin-bottom:12px"><input type="checkbox" id="paid" ${b.paid ? 'checked' : ''}> Paid</label></div>
          </div>
        </div>
        <div class="box"><h4>Notes & history</h4>
          <div style="display:flex;gap:8px;margin-bottom:10px"><input class="input" id="note" placeholder="Add a note (Enter to save)"><select class="input" id="notek" style="width:120px"><option value="note">Note</option><option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="sms">Text</option></select></div>
          <ul class="timeline" id="tl"></ul>
        </div>
      </div>
      <div class="drawer-f">
        <button class="btn btn-primary" id="save">Save</button>
        <button class="btn btn-ghost" id="print">${ICONS.print.replace('<svg', '<svg width="16" height="16"')} Job card</button>
        <button class="btn btn-ghost" id="again">Book again</button>
      </div>`;
    const drawLines = () => {
      $('#lines', d).innerHTML = lines.map((l, i) => `<tr data-i="${i}"><td><select data-f="kind">${['labour', 'part', 'mot', 'other'].map(k => `<option ${l.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></td>
        <td><input data-f="description" value="${esc(l.description)}"></td><td><input data-f="qty" inputmode="decimal" value="${l.qty}"></td><td><input data-f="unit_price" inputmode="decimal" value="${l.unit_price}"></td>
        <td style="text-align:right">${fmt.money(l.qty * l.unit_price)}</td><td><button class="x" style="font-size:1.1rem" data-del="${i}">×</button></td></tr>`).join('') +
        `<tr><td colspan="4" style="text-align:right"><b>Total</b></td><td style="text-align:right"><b>${fmt.money(total())}</b></td><td></td></tr>`;
      $$('#lines [data-f]', d).forEach(inp => inp.addEventListener('change', () => { const l = lines[inp.closest('tr').dataset.i]; l[inp.dataset.f] = inp.dataset.f === 'qty' || inp.dataset.f === 'unit_price' ? Number(inp.value) || 0 : inp.value; l._dirty = true; drawLines(); }));
      $$('#lines [data-del]', d).forEach(x => x.onclick = async () => { const l = lines[x.dataset.del]; if (l.id) { try { await staff.delLine(l.id); } catch (e) { return crm.fail(e); } } lines.splice(x.dataset.del, 1); drawLines(); });
    };
    const drawTl = () => {
      const items = [
        ...notes.map(n => ({ at: n.created_at, kind: n.kind, html: esc(n.body) })),
        ...events.map(e => ({ at: e.at, kind: 'system', html: e.from_status ? `Status ${STATUS_LABEL[e.from_status] || e.from_status} → <b>${STATUS_LABEL[e.to_status] || e.to_status}</b>${e.note ? ' · ' + esc(e.note) : ''}` : `Booked (${esc(e.note || '')}) as <b>${STATUS_LABEL[e.to_status]}</b>` }))
      ].sort((a, b) => b.at.localeCompare(a.at));
      $('#tl', d).innerHTML = items.map(i => `<li class="k-${i.kind}"><div class="when">${fmt.day(i.at)} ${fmt.time(i.at)} · ${i.kind}</div>${i.html}</li>`).join('') || '<li class="muted">Nothing yet</li>';
    };
    drawLines(); drawTl();
    $('#dx', d).onclick = () => crm.closeDrawer();
    $('#addline', d).onclick = () => { lines.push({ booking_id: id, kind: isMot && !lines.length ? 'mot' : 'labour', description: isMot && !lines.length ? 'MOT test' : '', qty: 1, unit_price: isMot && !lines.length ? Number(b.price_quoted || 0) : 0, sort: lines.length, _dirty: true }); drawLines(); const ins = $$('#lines [data-f="description"]', d); ins[ins.length - 1].focus(); };
    $('#sf', d).addEventListener('click', async e => {
      const x = e.target.closest('button'); if (!x || x.dataset.s === b.status) return;
      try { await staff.setStatus(id, x.dataset.s); b.status = x.dataset.s; $$('#sf button', d).forEach(y => y.classList.toggle('on', y === x)); events = await staff.events(id); drawTl(); crm.toast('Status: ' + STATUS_LABEL[b.status]); after && after(); } catch (er) { crm.fail(er); }
    });
    if (isMot) $('#motres', d).addEventListener('click', e => { const x = e.target.closest('button'); if (!x) return; $$('#motres button', d).forEach(y => y.classList.toggle('on', y === x)); b.mot_result = x.dataset.v || null; $('#newexp', d).style.display = b.mot_result && b.mot_result !== 'fail' ? '' : 'none'; if (b.mot_result && b.mot_result !== 'fail') { const tested = fmt.isoDay(new Date(b.starts_at)); const early = b.mot_expiry && fmt.daysUntil(b.mot_expiry) - fmt.daysUntil(tested) >= 0 && fmt.daysUntil(b.mot_expiry) - fmt.daysUntil(tested) <= 31; const base = early ? b.mot_expiry : tested; const dt = new Date(base + 'T12:00:00Z'); dt.setUTCFullYear(dt.getUTCFullYear() + 1); if (!early) dt.setUTCDate(dt.getUTCDate() - 1); $('#newmot', d).value = dt.toISOString().slice(0, 10); } });
    $('#note', d).addEventListener('keydown', async e => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      try { const n = await staff.addNote({ booking_id: id, customer_id: b.customer_id, vehicle_id: b.vehicle_id, body: e.target.value.trim(), kind: $('#notek', d).value, created_by: (await staff.session()).user.id }); notes.unshift(n); e.target.value = ''; drawTl(); } catch (er) { crm.fail(er); }
    });
    $('#save', d).onclick = async () => {
      try {
        const dirty = lines.filter(l => l._dirty && l.description.trim());
        for (const l of dirty) { const row = { booking_id: id, kind: l.kind, description: l.description, qty: l.qty, unit_price: l.unit_price, sort: l.sort || 0 }; if (l.id) { await window.ZA.q(sb.from('za_job_lines').update(row).eq('id', l.id)); } else { const r = await staff.addLine(row); l.id = r.id; } l._dirty = false; }
        const pf = $('#pf', d).value.trim();
        const mileage = Number(($('#mileage', d).value || '').replace(/[^0-9]/g, '')) || null;
        await staff.updateBooking(id, {
          bay: $('#bay', d).value || null, mileage, staff_notes: $('#snotes', d).value,
          price_quoted: $('#pq', d).value.trim() === '' ? null : Number($('#pq', d).value), price_final: pf === '' ? (lines.length ? total() : null) : Number(pf),
          paid: $('#paid', d).checked, mot_result: isMot ? (b.mot_result || null) : null
        });
        const vpatch = {};
        if (mileage) vpatch.last_mileage = mileage;
        if (isMot && b.mot_result && b.mot_result !== 'fail' && $('#newmot', d).value) vpatch.mot_expiry = $('#newmot', d).value;
        if (Object.keys(vpatch).length && b.vehicle_id) await staff.saveVehicle(Object.assign({ id: b.vehicle_id }, vpatch));
        crm.toast('Saved'); after && after();
      } catch (e) { crm.fail(e); }
    };
    $('#print', d).onclick = () => printJobCard(b, lines, total());
    $('#again', d).onclick = () => { crm.closeDrawer(); crm.newBooking({ reg: b.vehicle_reg, service_id: b.service_id, location_id: b.location_id }); };
    $('#move', d).onclick = () => crm.newBooking({ moveId: id, reg: b.vehicle_reg, service_id: b.service_id, location_id: b.location_id, day: fmt.isoDay(new Date(b.starts_at)) }, after);
  };

  function printJobCard(b, lines, total) {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return crm.toast('Allow pop-ups to print', true);
    const l = crm.locations.find(x => x.id === b.location_id) || {};
    w.document.write(`<!doctype html><title>Job card ${esc(b.ref)}</title><style>body{font:14px/1.45 Arial,sans-serif;margin:28px;color:#111}h1{margin:0;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}.plate{display:inline-block;background:#ffd200;border:2px solid #111;border-radius:4px;padding:2px 8px;font-weight:700;letter-spacing:1px;font-size:18px}.box{border:1px solid #ccc;min-height:110px;padding:8px;margin-top:10px}.r{text-align:right}</style>
      <div style="display:flex;justify-content:space-between"><div><h1>${esc(l.name || 'Z Autoz')}</h1>${esc(l.address || '')}, ${esc(l.postcode || '')} · ${esc(l.phone || '')}</div><div class="r"><b>Job card</b><br>${esc(b.ref)}<br>${fmt.longDay(b.starts_at)} ${fmt.time(b.starts_at)}</div></div><hr>
      <table><tr><th>Vehicle</th><td><span class="plate">${esc(fmt.plate(b.vehicle_reg || ''))}</span> ${esc([b.make, b.model, b.colour].filter(Boolean).join(' '))}</td><th>Mileage</th><td>${b.mileage || ''}</td></tr>
      <tr><th>Customer</th><td>${esc(fmt.name(b))}</td><th>Phone</th><td>${esc(b.phone || '')}</td></tr>
      <tr><th>Job</th><td colspan="3">${esc(b.service_name)}</td></tr>${b.customer_notes ? `<tr><th>Customer says</th><td colspan="3">${esc(b.customer_notes)}</td></tr>` : ''}</table>
      <table><tr><th>Type</th><th>Description</th><th>Qty</th><th class="r">Each</th><th class="r">Total</th></tr>${lines.map(x => `<tr><td>${esc(x.kind)}</td><td>${esc(x.description)}</td><td>${x.qty}</td><td class="r">${fmt.money(x.unit_price)}</td><td class="r">${fmt.money(x.qty * x.unit_price)}</td></tr>`).join('')}<tr><th colspan="4" class="r">Total</th><th class="r">${fmt.money(total || b.price_final || b.price_quoted)}</th></tr></table>
      <div class="box"><b>Mechanic notes</b><br>${esc(b.staff_notes || '')}</div>
      <p style="margin-top:30px">Customer signature ____________________ Date __________</p><script>print()<\/script>`);
    w.document.close();
  }

  // ---------- NEW BOOKING / WALK-IN / MOVE ----------
  crm.newBooking = function (pre, after) {
    pre = pre || {};
    const walk = !!pre.walkIn, moving = !!pre.moveId;
    const defLoc = pre.location_id || (crm.loc !== 'all' ? crm.loc : 'garage');
    const st = { veh: null, cust: null, loc: defLoc, svc: pre.service_id || null, day: pre.day || fmt.today(), time: pre.time || null };
    const m = crm.modal(`
      <div class="drawer-h"><h3 style="margin:0">${moving ? 'Move booking' : walk ? 'Walk-in' : 'New booking'}</h3><button class="x" id="mx">×</button></div>
      <div class="drawer-b">
        <div style="${moving ? 'display:none' : ''}">
        <div class="field"><label>Registration</label><div class="plate sm"><div class="gb"><i>★</i>UK</div><input id="nreg" placeholder="AB12 CDE" autocomplete="off" value="${esc(fmt.plate(pre.reg || ''))}"></div><div id="nmatch" class="small" style="margin-top:8px"></div></div>
        <div id="ncust">
          <div class="row"><div class="field"><label>First name</label><input class="input" id="nfn"></div><div class="field"><label>Last name</label><input class="input" id="nln"></div></div>
          <div class="row"><div class="field"><label>Phone</label><input class="input" id="nph" type="tel"></div><div class="field"><label>Email</label><input class="input" id="nem" type="email"></div></div>
          <div class="row"><div class="field"><label>Make</label><input class="input" id="nmk" list="mklist"></div><div class="field"><label>Model</label><input class="input" id="nmd"></div><div class="field"><label>MOT expiry</label><input class="input" id="nmot" type="date"></div></div>
        </div></div>
        <div class="row">
          <div class="field"><label>Site</label><select class="input" id="nloc">${crm.locations.map(l => `<option value="${l.id}" ${l.id === st.loc ? 'selected' : ''}>${esc(l.short_name)}</option>`).join('')}</select></div>
          <div class="field"><label>Job</label><select class="input" id="nsvc"></select></div>
        </div>
        <div id="when" style="${walk ? 'display:none' : ''}">
          <div class="row"><div class="field" style="max-width:200px"><label>Day</label><input class="input" type="date" id="nday" value="${st.day}"></div><div class="field"><label>Time</label><div class="slots" id="nslots" style="grid-template-columns:repeat(auto-fill,minmax(68px,1fr))"></div></div></div>
          <label class="check"><input type="checkbox" id="nforce"> Squeeze in anyway (ignore the capacity check)</label>
        </div>
        <div class="row" style="margin-top:10px"><div class="field"><label>Notes</label><input class="input" id="nnotes" placeholder="${walk ? 'e.g. puncture front left, waiting' : 'Customer notes'}"></div><div class="field" style="max-width:150px"><label>Price quoted £</label><input class="input" id="npq" inputmode="decimal"></div></div>
        <div id="nerr" class="notice bad" style="display:none"></div>
      </div>
      <div class="drawer-f"><button class="btn btn-primary" id="nsave">${moving ? 'Move it' : walk ? 'Check in now' : 'Book it'}</button><button class="btn btn-ghost" id="ncancel">Cancel</button>
        <datalist id="mklist">${['Audi','BMW','Citroen','Dacia','Fiat','Ford','Honda','Hyundai','Jaguar','Kia','Land Rover','Lexus','Mazda','Mercedes-Benz','MG','Mini','Nissan','Peugeot','Renault','Seat','Skoda','Suzuki','Tesla','Toyota','Vauxhall','Volkswagen','Volvo'].map(x => `<option value="${x}">`).join('')}</datalist></div>`);
    $('#mx', m).onclick = $('#ncancel', m).onclick = () => crm.closeModal();
    const fillSvc = () => {
      const list = crm.services.filter(s => s.active && s.location_ids.includes(st.loc));
      if (!list.some(s => s.id === st.svc)) st.svc = (list.find(s => s.id === (st.loc === 'mot' ? 'mot4' : 'tyres')) || list[0] || {}).id;
      $('#nsvc', m).innerHTML = list.map(s => `<option value="${s.id}" ${s.id === st.svc ? 'selected' : ''}>${esc(s.name)} · ${esc(s.price_label || '')}</option>`).join('');
      const s = crm.svc(st.svc); if (s && s.price_from != null && !$('#npq', m).value) $('#npq', m).value = s.price_from;
    };
    const loadSlots = async () => {
      if (walk) return;
      const box = $('#nslots', m); box.innerHTML = '<div class="skeleton"></div>';
      try {
        const slots = await pub.slots(st.loc, st.svc, st.day);
        box.innerHTML = slots.map(s => `<button type="button" class="slot ${st.time === s.label ? 'on' : ''}" data-ts="${s.starts_at}" data-l="${s.label}" ${s.free ? '' : 'style="opacity:.55" title="Full — tick Squeeze in to use"'}>${s.label}</button>`).join('') || '<span class="muted small">Closed that day</span>';
        $$('.slot', box).forEach(x => x.onclick = () => { st.time = x.dataset.l; st.ts = x.dataset.ts; $$('.slot', box).forEach(y => y.classList.toggle('on', y === x)); if (x.style.opacity) $('#nforce', m).checked = true; });
        const pre = $$('.slot', box).find(x => x.dataset.l === st.time); if (pre) st.ts = pre.dataset.ts;
      } catch (e) { box.innerHTML = `<span class="error">${esc(e.message)}</span>`; }
    };
    $('#nloc', m).onchange = e => { st.loc = e.target.value; fillSvc(); loadSlots(); };
    $('#nsvc', m).onchange = e => { st.svc = e.target.value; const s = crm.svc(st.svc); if (s && s.price_from != null) $('#npq', m).value = s.price_from; loadSlots(); };
    $('#nday', m).onchange = e => { st.day = e.target.value; st.time = null; st.ts = null; loadSlots(); };
    let rt;
    const lookup = async () => {
      const reg = fmt.normReg($('#nreg', m).value); $('#nreg', m).value = fmt.plate(reg);
      st.veh = null; st.cust = null; $('#nmatch', m).innerHTML = '';
      if (reg.length < 2) return;
      try {
        const v = await staff.vehicleByReg(reg);
        if (v) {
          st.veh = v; st.cust = v.za_customers;
          $('#nmatch', m).innerHTML = `<div class="notice ok">Known vehicle: <b>${esc([v.make, v.model].filter(Boolean).join(' ') || 'details not recorded')}</b>${st.cust ? ` · owner <b>${esc(fmt.name(st.cust))}</b> ${esc(st.cust.phone || '')}` : ''} ${crm.motPill(v.mot_expiry)} ${fmt.govBtn(reg)}</div>`;
          if (st.cust) { $('#nfn', m).value = st.cust.first_name; $('#nln', m).value = st.cust.last_name; $('#nph', m).value = st.cust.phone || ''; $('#nem', m).value = st.cust.email || ''; }
          $('#nmk', m).value = v.make || ''; $('#nmd', m).value = v.model || ''; $('#nmot', m).value = v.mot_expiry || '';
        } else {
          $('#nmatch', m).innerHTML = '<span class="muted">New vehicle. Looking it up…</span>';
          const car = await pub.lookupReg(reg);
          if (fmt.normReg($('#nreg', m).value) !== reg) return;
          if (car) { st.car = car; if (car.make) $('#nmk', m).value = car.make; if (car.model) $('#nmd', m).value = car.model; if (car.mot_expiry && !$('#nmot', m).value) $('#nmot', m).value = car.mot_expiry;
            $('#nmatch', m).innerHTML = `<div class="notice ok">New vehicle: <b>${esc(fmt.carLine(car))}</b> ${crm.motPill(car.mot_expiry)}. Fill in the owner below. ${fmt.govBtn(reg)}</div>`; }
          else $('#nmatch', m).innerHTML = `<div class="gov-row"><span class="muted">New vehicle.</span>${fmt.govBtn(reg, 'Look up on GOV.UK')}<span class="muted small">Copy the make, model and MOT date into the boxes below.</span></div>`;
        }
      } catch (e) { crm.fail(e); }
    };
    $('#nreg', m).addEventListener('input', () => { clearTimeout(rt); rt = setTimeout(lookup, 350); });
    fillSvc(); loadSlots(); if (pre.reg) lookup();
    if (pre.customer) { const c = pre.customer; st.cust = c; $('#nfn', m).value = c.first_name || ''; $('#nln', m).value = c.last_name || ''; $('#nph', m).value = c.phone || ''; $('#nem', m).value = c.email || ''; }
    $('#nsave', m).onclick = async () => {
      const err = $('#nerr', m); err.style.display = 'none';
      try {
        let starts;
        if (walk) { const now = new Date(); now.setSeconds(0, 0); starts = now.toISOString(); }
        else { if (!st.ts) throw new Error('Pick a time'); starts = st.ts; }
        if (moving) {
          const s = crm.svc(st.svc); const end = new Date(new Date(starts).getTime() + (s ? s.duration_min : 60) * 60000).toISOString();
          if (!$('#nforce', m).checked) { const [busy] = await window.ZA.rpc('za_slot_busy', { p_location: st.loc, p_service: st.svc, p_from: starts, p_to: end, p_exclude: pre.moveId }) ; const loc = crm.locations.find(l => l.id === st.loc); if (busy && (busy.total >= loc.capacity || (s.max_concurrent && busy.same_service >= s.max_concurrent))) throw new Error('That time is full. Tick "Squeeze in" to move it anyway.'); }
          await staff.updateBooking(pre.moveId, { starts_at: starts, ends_at: end, location_id: st.loc, service_id: st.svc, service_name: s ? s.name : undefined });
          await window.ZA.q(sb.from('za_booking_events').insert({ booking_id: pre.moveId, from_status: null, to_status: 'confirmed', note: 'moved to ' + fmt.day(starts) + ' ' + fmt.time(starts), by_user: (await staff.session()).user.id }));
          crm.closeModal(); crm.closeDrawer(); crm.toast('Moved'); after ? after() : crm.refresh(); return;
        }
        const reg = fmt.normReg($('#nreg', m).value);
        if (reg.length < 2) throw new Error('Enter the registration');
        const r = await pub.book({
          location_id: st.loc, service_id: st.svc, starts_at: starts, reg, reg_display: fmt.plate(reg),
          customer_id: st.cust ? st.cust.id : '', first_name: $('#nfn', m).value.trim(), last_name: $('#nln', m).value.trim(),
          phone: $('#nph', m).value.trim(), email: $('#nem', m).value.trim(), make: $('#nmk', m).value.trim(), model: $('#nmd', m).value.trim(),
          mot_expiry: $('#nmot', m).value, colour: st.car ? st.car.colour || '' : '', fuel_type: st.car ? st.car.fuel_type || '' : '', year: st.car && st.car.year ? String(st.car.year) : '', notes: $('#nnotes', m).value.trim(), price_quoted: $('#npq', m).value.trim(),
          source: walk ? 'walk-in' : 'phone', status: walk ? 'arrived' : 'confirmed', force: walk || $('#nforce', m).checked
        });
        // keep vehicle details current when staff typed them
        if (st.veh) { const patch = { id: st.veh.id }; ['make', 'model'].forEach(k => { const v = $('#n' + (k === 'make' ? 'mk' : 'md'), m).value.trim(); if (v && v !== st.veh[k]) patch[k] = v; }); if ($('#nmot', m).value && $('#nmot', m).value !== st.veh.mot_expiry) patch.mot_expiry = $('#nmot', m).value; if (Object.keys(patch).length > 1) await staff.saveVehicle(patch); }
        crm.closeModal(); crm.toast(`${walk ? 'Checked in' : 'Booked'} · ${r.ref}`); after ? after() : crm.refresh();
      } catch (e) { err.textContent = e.message; err.style.display = ''; }
    };
  };

  const start = () => boot().catch(e => { console.error(e); showLogin(e.message); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start);
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' && !crm.me) boot(); });
})();
