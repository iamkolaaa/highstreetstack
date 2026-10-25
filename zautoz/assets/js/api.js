/* Z Autoz shared data layer. Needs supabase-js v2 UMD loaded first. */
(function () {
  const C = window.ZA_CONFIG;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, storageKey: 'za-auth', autoRefreshToken: true }
  });
  const TZ = C.tz;

  function err(e) {
    if (!e) return null;
    const m = (e.message || String(e)).replace(/^.*?ERROR:\s*/, '');
    return new Error(m);
  }
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw err(error);
    return data;
  }
  async function q(promise) {
    const { data, error, count } = await promise;
    if (error) throw err(error);
    return count != null && data == null ? count : data;
  }

  // ---------- formatting ----------
  const fmt = {
    // London-local YYYY-MM-DD for a Date
    isoDay(d) {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      const g = t => p.find(x => x.type === t).value;
      return `${g('year')}-${g('month')}-${g('day')}`;
    },
    today() { return fmt.isoDay(new Date()); },
    addDays(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    time(ts) { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); },
    day(ts, opts) { return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: TZ }, opts || { weekday: 'short', day: 'numeric', month: 'short' })).format(new Date(ts)); },
    longDay(ts) { return fmt.day(ts, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); },
    dayOfIso(iso, opts) { return fmt.day(iso + 'T12:00:00Z', opts); },
    date(d) { if (!d) return '—'; return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(d).length === 10 ? d + 'T12:00:00Z' : d)); },
    money(n) { return n == null || n === '' ? '—' : '£' + Number(n).toFixed(Number(n) % 1 ? 2 : 0); },
    // UK plate display: AB12CDE -> AB12 CDE
    plate(r) {
      const s = (r || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (/^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(s)) return s.slice(0, 4) + ' ' + s.slice(4);
      if (/^[A-Z][0-9]{1,3}[A-Z]{3}$/.test(s)) return s.replace(/^([A-Z][0-9]{1,3})/, '$1 ');
      if (/^[A-Z]{3}[0-9]{1,3}[A-Z]$/.test(s)) return s.replace(/^([A-Z]{3})/, '$1 ');
      return s;
    },
    normReg(r) { return (r || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); },
    plateValid(r) {
      const s = fmt.normReg(r);
      return /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(s) || /^[A-Z][0-9]{1,3}[A-Z]{3}$/.test(s) ||
        /^[A-Z]{3}[0-9]{1,3}[A-Z]$/.test(s) || /^[0-9]{1,4}[A-Z]{1,3}$/.test(s) || /^[A-Z]{1,3}[0-9]{1,4}$/.test(s);
    },
    phone(p) { return (p || '').replace(/\s+/g, ' ').trim(); },
    phoneHref(p) { return 'tel:' + (p || '').replace(/[^0-9+]/g, ''); },
    whatsapp(p, text) {
      let n = (p || '').replace(/[^0-9]/g, '');
      if (n.startsWith('0')) n = '44' + n.slice(1);
      return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
    },
    daysUntil(iso) { if (!iso) return null; return Math.round((new Date(iso + 'T12:00:00Z') - new Date(fmt.today() + 'T12:00:00Z')) / 864e5); },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    name(c) { return [c && c.first_name, c && c.last_name].filter(Boolean).join(' ') || 'No name'; },
    // "Ford Focus · Blue · Petrol · 2019"
    carLine(car) { if (!car) return ''; return [[car.make, car.model].filter(Boolean).join(' '), car.colour, car.fuel_type ? car.fuel_type[0].toUpperCase() + car.fuel_type.slice(1).toLowerCase() : '', car.year].filter(Boolean).join(' · '); }
  };

  // ---------- public API ----------
  const pub = {
    locations: () => q(sb.from('za_locations').select('*').eq('active', true).order('sort')),
    services: () => q(sb.from('za_services').select('*').eq('active', true).order('sort')),
    settings: async () => Object.fromEntries((await q(sb.from('za_settings').select('key,value'))).map(r => [r.key, r.value])),
    days: (location, service, from, n) => rpc('za_days', { p_location: location, p_service: service, p_from: from, p_n: n || 21 }),
    slots: (location, service, day) => rpc('za_availability', { p_location: location, p_service: service, p_day: day }),
    book: (payload) => rpc('za_create_booking', { p: payload }),
    lookup: (ref, phone) => rpc('za_lookup_booking', { p_ref: ref, p_phone: phone }),
    cancel: (ref, phone) => rpc('za_cancel_booking', { p_ref: ref, p_phone: phone }),
    // Registration -> make/model/colour/fuel/year/MOT via edge function za-vehicle. Returns car or null; never throws.
    lookupReg: (() => {
      const memo = new Map();
      return async (reg) => {
        reg = fmt.normReg(reg); if (reg.length < 2) return null;
        if (memo.has(reg)) return memo.get(reg);
        const p = fetch(C.supabaseUrl + '/functions/v1/za-vehicle', { method: 'POST', headers: { apikey: C.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ reg }) })
          .then(r => r.json()).then(j => (j && j.found ? j.car : null)).catch(() => null);
        memo.set(reg, p); const car = await p; if (!car) memo.delete(reg); return car;
      };
    })()
  };

  // ---------- staff API ----------
  const staff = {
    session: async () => (await sb.auth.getSession()).data.session,
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }).then(r => { if (r.error) throw err(r.error); return r.data; }),
    magic: (email) => sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.href.split('#')[0] } }).then(r => { if (r.error) throw err(r.error); }),
    signOut: () => sb.auth.signOut(),
    me: async () => { const s = await staff.session(); if (!s) return null; const r = await q(sb.from('za_staff').select('*').eq('user_id', s.user.id).maybeSingle()); return r; },
    stats: () => rpc('za_stats'),
    search: (text, lim) => rpc('za_search', { q: text || '', lim: lim || 50 }),
    bookingsBetween: (fromIso, toIso, loc) => {
      let x = sb.from('za_v_bookings').select('*').gte('starts_at', fromIso).lt('starts_at', toIso).order('starts_at');
      if (loc && loc !== 'all') x = x.eq('location_id', loc);
      return q(x);
    },
    bookingsWhere: (filter) => {
      let x = sb.from('za_v_bookings').select('*');
      Object.entries(filter || {}).forEach(([k, v]) => { x = Array.isArray(v) ? x.in(k, v) : x.eq(k, v); });
      return q(x.order('starts_at', { ascending: false }).limit(200));
    },
    booking: (id) => q(sb.from('za_v_bookings').select('*').eq('id', id).single()),
    updateBooking: (id, patch) => q(sb.from('za_bookings').update(patch).eq('id', id).select().single()),
    setStatus: (id, status, note) => rpc('za_set_status', { p_booking: id, p_status: status, p_note: note || null }),
    events: (bookingId) => q(sb.from('za_booking_events').select('*').eq('booking_id', bookingId).order('at')),
    lines: (bookingId) => q(sb.from('za_job_lines').select('*').eq('booking_id', bookingId).order('sort')),
    addLine: (row) => q(sb.from('za_job_lines').insert(row).select().single()),
    delLine: (id) => q(sb.from('za_job_lines').delete().eq('id', id)),
    customer: (id) => q(sb.from('za_v_customers').select('*').eq('id', id).single()),
    saveCustomer: (row) => row.id
      ? q(sb.from('za_customers').update(row).eq('id', row.id).select().single())
      : q(sb.from('za_customers').insert(row).select().single()),
    deleteCustomer: (id) => q(sb.from('za_customers').update({ deleted_at: new Date().toISOString() }).eq('id', id)),
    vehiclesOf: (customerId) => q(sb.from('za_vehicles').select('*').eq('customer_id', customerId).order('created_at')),
    vehicleByReg: (reg) => q(sb.from('za_vehicles').select('*, za_customers(*)').eq('reg', fmt.normReg(reg)).maybeSingle()),
    vehicle: (id) => q(sb.from('za_vehicles').select('*, za_customers(*)').eq('id', id).single()),
    saveVehicle: (row) => {
      if (row.reg) { row.reg = fmt.normReg(row.reg); row.reg_display = row.reg_display || fmt.plate(row.reg); }
      return row.id ? q(sb.from('za_vehicles').update(row).eq('id', row.id).select().single())
        : q(sb.from('za_vehicles').insert(row).select().single());
    },
    vehicles: (text) => {
      let x = sb.from('za_vehicles').select('*, za_customers(id,first_name,last_name,phone)').order('updated_at', { ascending: false }).limit(100);
      if (text) x = x.ilike('reg', '%' + fmt.normReg(text) + '%');
      return q(x);
    },
    historyOfVehicle: (vehicleId) => q(sb.from('za_v_bookings').select('*').eq('vehicle_id', vehicleId).order('starts_at', { ascending: false })),
    historyOfCustomer: (customerId) => q(sb.from('za_v_bookings').select('*').eq('customer_id', customerId).order('starts_at', { ascending: false })),
    notes: (col, id) => q(sb.from('za_notes').select('*').eq(col, id).order('created_at', { ascending: false })),
    addNote: (row) => q(sb.from('za_notes').insert(row).select().single()),
    motDue: (fromDays, toDays) => q(sb.from('za_v_mot_due').select('*').gte('days_left', fromDays).lte('days_left', toDays).order('mot_expiry')),
    closures: () => q(sb.from('za_closures').select('*').gte('day', fmt.today()).order('day')),
    addClosure: (row) => q(sb.from('za_closures').insert(row).select().single()),
    delClosure: (id) => q(sb.from('za_closures').delete().eq('id', id)),
    saveService: (row) => q(sb.from('za_services').upsert(row).select().single()),
    allServices: () => q(sb.from('za_services').select('*').order('sort')),
    saveLocation: (row) => q(sb.from('za_locations').update(row).eq('id', row.id).select().single()),
    saveSetting: (key, value) => q(sb.from('za_settings').upsert({ key, value }).select().single()),
    clearDemo: () => rpc('za_clear_demo'),
    staffList: () => q(sb.from('za_staff').select('*').order('created_at')),
    onBookings: (cb) => sb.channel('za-bookings').on('postgres_changes', { event: '*', schema: 'public', table: 'za_bookings' }, cb).subscribe()
  };

  window.ZA = { sb, pub, staff, fmt, rpc, q };
})();
