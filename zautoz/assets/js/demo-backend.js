/* Demo backend for the no-login show-and-tell CRM.
   Loads the demo garage from za_demo_snapshot() (anon RPC, demo rows only) and keeps every change in this browser tab.
   New website bookings are pulled in every 15 seconds so a booking made on a phone appears live. Reload = fresh start. */
(function () {
  const C = window.ZA_CONFIG;
  const D = { za_locations: [], za_services: [], za_settings: [], za_customers: [], za_vehicles: [], za_bookings: [], za_notes: [], za_booking_events: [] };
  window.__DEMO__ = D;
  async function snapshot() {
    const r = await fetch(C.supabaseUrl + '/rest/v1/rpc/za_demo_snapshot', { method: 'POST', headers: { apikey: C.supabaseKey, Authorization: 'Bearer ' + C.supabaseKey, 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error('Demo data unavailable (' + r.status + ')');
    const j = await r.json(); if (!j) throw new Error('Demo mode is switched off');
    return j;
  }
  const listeners = [];
  const seen = new Set();
  function prep(c) { c.phone_norm = normPhone(c.phone); c.email_norm = c.email ? c.email.toLowerCase() : null; return c; }
  const ready = snapshot().then(j => {
    Object.keys(D).forEach(k => { D[k] = j[k] || []; });
    D.za_settings = D.za_settings.concat([{ key: 'auto_confirm', value: true, public: false }]);
    D.za_customers.forEach(prep);
    D.za_bookings.forEach(b => seen.add(b.id));
    initStaff();
    setInterval(pull, 15000);
  });
  window.__DEMO_READY__ = ready;
  async function pull() {
    try {
      const j = await snapshot(); let n = 0;
      ['za_customers', 'za_vehicles', 'za_notes', 'za_booking_events'].forEach(t => (j[t] || []).forEach(r => { if (!D[t].some(x => x.id === r.id)) { D[t].push(t === 'za_customers' ? prep(r) : r); } }));
      (j.za_bookings || []).forEach(b => { if (!seen.has(b.id)) { seen.add(b.id); D.za_bookings.push(b); n++; } });
      if (n) { listeners.forEach(fn => fn({ eventType: 'INSERT' })); window.dispatchEvent(new CustomEvent('za-demo-new', { detail: n })); }
    } catch (_) {}
  }
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const ME = { id: '00000000-0000-4000-8000-000000000001', email: 'demo@zautoz' };
  function initStaff() {
    D.za_staff = [{ user_id: ME.id, email: ME.email, name: 'Demo owner', role: 'owner', active: true, created_at: new Date().toISOString() }, { user_id: 'x', email: 'workshop@example.com', name: 'Workshop tablet', role: 'staff', active: true, created_at: new Date().toISOString() }];
    D.za_job_lines = []; D.za_closures = [];
  }
  const normReg = r => (r || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normPhone = p => p == null ? null : p.replace(/[^0-9+]/g, '').replace(/^\+44/, '0').replace(/^44/, '0');
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const log = (...a) => (window.__MOCKLOG__ = window.__MOCKLOG__ || []).push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));

  function view(name) {
    if (name === 'za_v_bookings') return D.za_bookings.map(b => {
      const l = D.za_locations.find(x => x.id === b.location_id) || {}, c = D.za_customers.find(x => x.id === b.customer_id) || {}, v = D.za_vehicles.find(x => x.id === b.vehicle_id) || {};
      return Object.assign({}, b, { location_name: l.short_name, first_name: c.first_name, last_name: c.last_name, phone: c.phone, email: c.email, vehicle_reg: v.reg, reg_display: v.reg_display, make: v.make, model: v.model, colour: v.colour, mot_expiry: v.mot_expiry });
    });
    if (name === 'za_v_customers') return D.za_customers.filter(c => !c.deleted_at).map(c => {
      const vs = D.za_vehicles.filter(v => v.customer_id === c.id), bs = D.za_bookings.filter(b => b.customer_id === c.id);
      const fut = vs.map(v => v.mot_expiry).filter(d => d && d >= today()).sort();
      return Object.assign({}, c, { vehicle_count: vs.length, regs: vs.map(v => v.reg_display).sort().join(', ') || null, last_booking: bs.map(b => b.starts_at).sort().pop() || null, booking_count: bs.length, next_mot: fut[0] || null });
    });
    if (name === 'za_v_mot_due') return D.za_vehicles.filter(v => v.mot_expiry).map(v => {
      const c = D.za_customers.find(x => x.id === v.customer_id) || {};
      return { vehicle_id: v.id, reg: v.reg, reg_display: v.reg_display, make: v.make, model: v.model, mot_expiry: v.mot_expiry,
        days_left: Math.round((new Date(v.mot_expiry + 'T12:00:00Z') - new Date(today() + 'T12:00:00Z')) / 864e5),
        customer_id: c.id, first_name: c.first_name, last_name: c.last_name, phone: c.phone, email: c.email,
        mot_booked: D.za_bookings.some(b => b.vehicle_id === v.id && ['requested', 'confirmed'].includes(b.status) && (b.service_id || '').startsWith('mot') && b.starts_at > new Date().toISOString()),
        last_visit: null };
    });
    if (!D[name]) { D[name] = []; log('WARN unknown table', name); }
    return D[name];
  }
  function embed(rows, table, sel) {
    const m = /(\w+)\(([^)]*)\)/g; let x; const out = rows.map(r => Object.assign({}, r));
    while ((x = m.exec(sel))) {
      const rel = x[1];
      out.forEach(r => {
        if (rel === 'za_customers') r.za_customers = D.za_customers.find(c => c.id === r.customer_id) || null;
        else log('WARN embed', rel);
      });
    }
    return out;
  }
  function cmp(a, b) { return a == null ? (b == null ? 0 : -1) : b == null ? 1 : a < b ? -1 : a > b ? 1 : 0; }

  class Q {
    constructor(table) { this.t = table; this.f = []; this.op = 'select'; this.sel = '*'; this.ord = []; this.lim = null; this.one = null; this.payload = null; this.ret = false; }
    select(s) { if (this.op === 'select') this.sel = s || '*'; else this.ret = true; return this; }
    insert(p) { this.op = 'insert'; this.payload = p; return this; }
    update(p) { this.op = 'update'; this.payload = p; return this; }
    upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(k, v) { this.f.push(r => String(r[k]) === String(v)); return this; }
    neq(k, v) { this.f.push(r => String(r[k]) !== String(v)); return this; }
    in(k, v) { this.f.push(r => v.map(String).includes(String(r[k]))); return this; }
    gte(k, v) { this.f.push(r => r[k] != null && r[k] >= v); return this; }
    lte(k, v) { this.f.push(r => r[k] != null && r[k] <= v); return this; }
    gt(k, v) { this.f.push(r => r[k] != null && r[k] > v); return this; }
    lt(k, v) { this.f.push(r => r[k] != null && r[k] < v); return this; }
    is(k, v) { this.f.push(r => (r[k] ?? null) === v); return this; }
    ilike(k, p) { const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); this.f.push(r => re.test(r[k] || '')); return this; }
    or(s) { log('WARN or() not supported', s); return this; }
    order(k, o) { this.ord.push([k, !(o && o.ascending === false)]); return this; }
    limit(n) { this.lim = n; return this; }
    range(a, b) { this.lim = b + 1; return this; }
    single() { this.one = 'single'; return this; }
    maybeSingle() { this.one = 'maybe'; return this; }
    then(res, rej) { return Promise.resolve().then(() => this.run()).then(res, rej); }
    run() {
      const base = view(this.t);
      const match = r => this.f.every(fn => fn(r));
      let data;
      if (this.op === 'insert' || this.op === 'upsert') {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(p => {
          if (this.op === 'upsert') { const key = this.t === 'za_settings' ? 'key' : 'id'; const ex = base.find(r => r[key] === p[key]); if (ex) return Object.assign(ex, p); }
          const r = Object.assign({ id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, p);
          if (this.t === 'za_booking_events') r.at = r.at || r.created_at;
          if (this.t === 'za_customers') { r.first_name = r.first_name || ''; r.last_name = r.last_name || ''; r.tags = r.tags || []; r.source = r.source || 'walk-in'; }
          if (this.t === 'za_vehicles' && base.some(v => v.reg === r.reg)) throw { message: 'duplicate key value violates unique constraint "za_vehicles_reg_unique"', code: '23505' };
          base.push(r); return r;
        });
        log(this.op, this.t, rows.length); data = rows;
      } else if (this.op === 'update') {
        data = base.filter(match); data.forEach(r => Object.assign(r, this.payload, { updated_at: new Date().toISOString() }));
        if (this.t === 'za_customers' || this.t === 'za_vehicles') data.forEach(c => { if ('phone' in this.payload) c.phone_norm = normPhone(c.phone); if ('email' in this.payload) c.email_norm = c.email ? c.email.toLowerCase() : null; });
        log('update', this.t, data.length, this.payload);
      } else if (this.op === 'delete') {
        const keep = base.filter(r => !match(r)); data = base.filter(match); base.length = 0; keep.forEach(r => base.push(r)); log('delete', this.t, data.length);
      } else {
        data = base.filter(match);
        for (const [k, asc] of this.ord.slice().reverse()) data = data.slice().sort((a, b) => asc ? cmp(a[k], b[k]) : cmp(b[k], a[k]));
        if (this.lim != null) data = data.slice(0, this.lim);
        data = embed(data, this.t, this.sel);
      }
      if (this.op !== 'select' && !this.ret && !this.one) return { data: null, error: null };
      if (this.one) {
        if (!data.length) return this.one === 'single' ? { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } } : { data: null, error: null };
        return { data: JSON.parse(JSON.stringify(data[0])), error: null };
      }
      return { data: JSON.parse(JSON.stringify(data)), error: null };
    }
  }
  function wrap(fn) { return (...a) => { try { return Promise.resolve(fn(...a)).then(d => ({ data: d, error: null }), e => ({ data: null, error: e })); } catch (e) { return Promise.resolve({ data: null, error: e }); } }; }

  // RPCs
  const rpcs = {
    za_stats: () => {
      const t = today(); const vs = D.za_vehicles;
      return { customers: D.za_customers.filter(c => !c.deleted_at).length, vehicles: vs.length,
        today: D.za_bookings.filter(b => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(b.starts_at)) === t && !['cancelled', 'no_show'].includes(b.status)).length,
        requested: D.za_bookings.filter(b => b.status === 'requested').length,
        on_site: D.za_bookings.filter(b => ['arrived', 'in_progress', 'ready'].includes(b.status)).length,
        mot_due_30: vs.filter(v => v.mot_expiry >= t && v.mot_expiry <= addD(t, 30)).length,
        mot_overdue: vs.filter(v => v.mot_expiry && v.mot_expiry < t && v.mot_expiry > addD(t, -365)).length,
        week_value: (() => { const now = new Date(t + 'T12:00:00Z'); const mon = addD(t, -((now.getUTCDay() + 6) % 7)); return D.za_bookings.filter(b => b.starts_at.slice(0, 10) >= mon && b.starts_at.slice(0, 10) < addD(mon, 7) && !['cancelled', 'no_show'].includes(b.status)).reduce((s, b) => s + Number(b.price_final ?? b.price_quoted ?? 0), 0); })() };
    },
    za_search: ({ q, lim }) => {
      const s = (q || '').toLowerCase(), reg = normReg(q), ph = normPhone(q);
      return view('za_v_customers').filter(c => !s || (c.first_name + ' ' + c.last_name).toLowerCase().includes(s) || (ph && (c.phone_norm || '').includes(ph)) || (c.email_norm || '').includes(s) || (reg && D.za_vehicles.some(v => v.customer_id === c.id && v.reg.includes(reg)))).slice(0, lim || 30);
    },
    za_set_status: ({ p_booking, p_status, p_note }) => { const b = D.za_bookings.find(x => x.id === p_booking); const old = b.status; b.status = p_status; if (['collected', 'cancelled', 'no_show'].includes(p_status)) b.bay = null; D.za_booking_events.push({ id: Date.now(), booking_id: p_booking, from_status: old, to_status: p_status, note: p_note, at: new Date().toISOString() }); log('status', p_status); return null; },
    za_availability: ({ p_location, p_service, p_day }) => {
      const l = D.za_locations.find(x => x.id === p_location), s = D.za_services.find(x => x.id === p_service); if (!l || !s) return [];
      const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(p_day + 'T12:00:00Z').getUTCDay()];
      const out = [];
      (l.hours[dow] || []).forEach(([o, c]) => {
        let t = new Date(p_day + 'T' + o + ':00Z'); const fin = new Date(p_day + 'T' + c + ':00Z'); // treat London ~= UTC for the mock (GMT in winter)
        while (t.getTime() + s.duration_min * 6e4 <= fin.getTime()) { const e = new Date(t.getTime() + s.duration_min * 6e4); const busy = D.za_bookings.filter(b => b.location_id === p_location && !['cancelled', 'no_show', 'collected', 'ready'].includes(b.status) && b.starts_at < e.toISOString() && b.ends_at > t.toISOString()).length; out.push({ starts_at: t.toISOString(), ends_at: e.toISOString(), free: busy < l.capacity, label: t.toISOString().slice(11, 16) }); t = new Date(t.getTime() + l.slot_minutes * 6e4); }
      });
      return out;
    },
    za_days: (a) => Array.from({ length: a.p_n || 21 }, (_, i) => { const d = addD(a.p_from, i); const sl = rpcs.za_availability({ p_location: a.p_location, p_service: a.p_service, p_day: d }); return { day: d, free_slots: sl.filter(x => x.free).length, open: sl.length > 0 }; }),
    za_slot_busy: () => [{ total: 0, same_service: 0 }],
    za_clear_demo: () => { ['za_bookings', 'za_vehicles', 'za_customers'].forEach(t => { const k = D[t].filter(r => !r.demo); D[t].length = 0; k.forEach(r => D[t].push(r)); }); return null; },
    za_create_booking: ({ p }) => {
      const s = D.za_services.find(x => x.id === p.service_id); if (!s) throw { message: 'Unknown service' };
      let c = p.customer_id ? D.za_customers.find(x => x.id === p.customer_id) : null;
      if (!c && p.phone) c = D.za_customers.find(x => x.phone_norm === normPhone(p.phone));
      if (!c) { c = { id: uid(), first_name: p.first_name || '', last_name: p.last_name || '', phone: p.phone || null, phone_norm: normPhone(p.phone || null), email: p.email || null, source: 'phone', tags: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; D.za_customers.push(c); }
      const reg = normReg(p.reg); let v = D.za_vehicles.find(x => x.reg === reg);
      if (!v) { v = { id: uid(), reg, reg_display: p.reg_display || reg, customer_id: c.id, make: p.make || null, model: p.model || null, mot_expiry: p.mot_expiry || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; D.za_vehicles.push(v); }
      const b = { id: uid(), ref: 'ZA-DEMO' + (100 + D.za_bookings.length), location_id: p.location_id, service_id: s.id, service_name: s.name, customer_id: c.id, vehicle_id: v.id, starts_at: p.starts_at, ends_at: new Date(new Date(p.starts_at).getTime() + s.duration_min * 6e4).toISOString(), status: p.status || 'confirmed', source: p.source || 'staff', customer_notes: p.notes || null, price_quoted: p.price_quoted || s.price_from, paid: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      D.za_bookings.push(b); log('booking', b.ref); return { id: b.id, ref: b.ref, status: b.status, starts_at: b.starts_at, ends_at: b.ends_at };
    }
  };
  function addD(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  const session = { user: ME, access_token: 'mock' };
  window.supabase = { createClient: () => ({
    from: t => new Q(t),
    rpc: (n, a) => { if (!rpcs[n]) { log('WARN rpc', n); return Promise.resolve({ data: null, error: { message: 'mock: no rpc ' + n } }); } return wrap(rpcs[n])(a || {}); },
    auth: { getSession: async () => { await ready; return { data: { session } }; }, signInWithPassword: async () => ({ data: { session }, error: null }), signInWithOtp: async () => ({ error: null }), signOut: async () => ({ error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    channel: () => ({ on(a, b, cb) { if (cb) listeners.push(cb); return this; }, subscribe() { return this; } })
  }) };
})();
