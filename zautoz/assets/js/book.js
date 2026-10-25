/* Booking wizard */
(function () {
  const { pub, fmt } = window.ZA;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const MAKES = ['Audi','BMW','Citroen','Dacia','Fiat','Ford','Honda','Hyundai','Jaguar','Kia','Land Rover','Lexus','Mazda','Mercedes-Benz','MG','Mini','Mitsubishi','Nissan','Peugeot','Porsche','Renault','Seat','Skoda','Smart','Subaru','Suzuki','Tesla','Toyota','Vauxhall','Volkswagen','Volvo'];
  const CATS = [['all','All'],['mot','MOT'],['servicing','Servicing'],['tyres','Tyres & tracking'],['diagnostics','Diagnostics'],['repairs','Repairs']];

  const st = { step: 1, services: [], locations: [], settings: {}, svc: null, loc: null, day: null, slot: null, cat: 'all', result: null, daysCache: {} };

  $('#makes').innerHTML = MAKES.map(m => `<option value="${m}">`).join('');

  // ---------- step 1 ----------
  const regEl = $('#reg');
  function onReg() {
    const pos = regEl.value.length;
    regEl.value = fmt.plate(regEl.value);
    const n = fmt.normReg(regEl.value);
    $('#reg-hint').textContent = !n ? '' : fmt.plateValid(n) ? '' : 'That doesn’t look like a standard UK plate. Double-check it, or carry on if it’s a private plate.';
    summary();
  }
  regEl.addEventListener('input', onReg);
  let lookT, lookSeq = 0;
  regEl.addEventListener('input', () => {
    clearTimeout(lookT); const n = fmt.normReg(regEl.value);
    if (st.car && st.car.reg !== n) { // clear details we filled for the previous plate
      if ($('#make').value === (st.car.make || '')) $('#make').value = '';
      if ($('#model').value === (st.car.model || '')) $('#model').value = '';
      if ($('#mot_expiry').value === (st.car.mot_expiry || '')) $('#mot_expiry').value = '';
      st.car = null; $('#reg-hint').innerHTML = ''; summary();
    }
    if (!fmt.plateValid(n)) return;
    $('#reg-hint').innerHTML = '<span class="muted">Looking up your car…</span>';
    lookT = setTimeout(() => findCar(n), 400);
  });
  async function findCar(n) {
    const my = ++lookSeq; const car = await pub.lookupReg(n);
    if (my !== lookSeq || fmt.normReg(regEl.value) !== n) return;
    if (!car) { $('#reg-hint').innerHTML = `<div class="gov-row">${fmt.govBtn(n, 'Look up ' + fmt.plate(n) + ' on GOV.UK')}<span class="muted small">Opens the official checker in a new tab. Then add the make and model below.</span></div>`; return; }
    st.car = Object.assign({}, car, { reg: n });
    if (car.make) $('#make').value = car.make;
    if (car.model) $('#model').value = car.model;
    if (car.mot_expiry && !$('#mot_expiry').value) $('#mot_expiry').value = car.mot_expiry;
    const due = car.mot_expiry ? fmt.daysUntil(car.mot_expiry) : null;
    $('#reg-hint').innerHTML = `<div class="notice ok" style="margin-top:4px"><b>✓ ${fmt.esc(fmt.carLine(car))}</b>${car.mot_expiry ? `<br><span class="small">MOT ${due < 0 ? '<b style="color:var(--bad)">expired ' + fmt.date(car.mot_expiry) + '</b>' : 'due ' + fmt.date(car.mot_expiry) + (due <= 30 ? ' <b>(soon)</b>' : '')}</span>` : ''}<div class="gov-row">${fmt.govBtn(n, 'Full MOT history on GOV.UK')}</div></div>`;
    summary();
  }
  ['make', 'model'].forEach(id => $('#' + id).addEventListener('input', summary));
  if (params.get('reg')) { regEl.value = params.get('reg'); onReg(); if (fmt.plateValid(fmt.normReg(regEl.value))) findCar(fmt.normReg(regEl.value)); }

  // ---------- data ----------
  Promise.all([pub.services(), pub.locations(), pub.settings().catch(() => ({}))]).then(([s, l, set]) => {
    st.services = s.filter(x => x.online); st.locations = l; st.settings = set;
    const want = params.get('service');
    if (want) st.svc = st.services.find(x => x.id === want) || null;
    const wantLoc = params.get('location');
    if (wantLoc) st.loc = l.find(x => x.id === wantLoc) || null;
    if (st.svc && st.loc && !st.svc.location_ids.includes(st.loc.id)) st.loc = null;
    if (st.svc && !st.loc && st.svc.location_ids.length === 1) st.loc = l.find(x => x.id === st.svc.location_ids[0]);
    if (st.svc) st.cat = 'all';
    else if (params.get('category') && CATS.some(([k]) => k === params.get('category'))) st.cat = params.get('category');
    renderCats(); renderServices(); renderSites(); summary();
    if (set.prices_are_placeholders) $('#s-note').textContent = 'Guide prices. We always confirm before starting work. Pay on collection by card, contactless or cash.';
  }).catch(e => {
    $('#services').innerHTML = `<div class="notice bad">Sorry, online booking isn’t loading right now. Please call the garage on <a href="tel:01908365050">01908 365050</a> or the MOT centre on <a href="tel:01908644514">01908 644514</a>.</div>`;
    console.error(e);
  });

  // ---------- step 2 ----------
  const ICON = {
    mot: '<path d="M4 12l5 5L20 6"/>', servicing: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    tyres: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>', diagnostics: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    repairs: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/>'
  };
  function renderCats() {
    const have = new Set(st.services.map(s => s.category));
    $('#cats').innerHTML = CATS.filter(([k]) => k === 'all' || have.has(k)).map(([k, t]) => `<button type="button" data-cat="${k}" class="${st.cat === k ? 'on' : ''}">${t}</button>`).join('');
  }
  $('#cats').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.cat = b.dataset.cat; renderCats(); renderServices(); });
  function where(s) { return s.location_ids.length > 1 ? 'Either site' : s.location_ids[0] === 'mot' ? "Pam's MOT Centre" : 'Z Autoz Garage'; }
  function dur(m) { return m < 60 ? m + ' min' : m % 60 ? (m / 60).toFixed(1).replace('.0', '') + ' hrs' : (m / 60) + (m === 60 ? ' hr' : ' hrs'); }
  function renderServices() {
    const list = st.services.filter(s => st.cat === 'all' || s.category === st.cat);
    $('#services').innerHTML = list.map(s => `
      <button type="button" class="choice ${st.svc && st.svc.id === s.id ? 'on' : ''}" data-id="${s.id}">
        <b>${fmt.esc(s.name)}</b>
        <span class="meta">${fmt.esc(s.description || '')}</span>
        <span class="meta" style="display:block;margin-top:6px">⏱ about ${dur(s.duration_min)} · ${where(s)}${s.walk_in ? ' · <span class="tag green">Walk-ins welcome</span>' : ''}</span>
        <span class="price">${fmt.esc(s.price_label || (s.price_from ? 'from ' + fmt.money(s.price_from) : 'Quote'))}</span>
      </button>`).join('') || '<p class="muted">Nothing in this group can be booked online. Please call us.</p>';
  }
  $('#services').addEventListener('click', e => {
    const b = e.target.closest('.choice'); if (!b) return;
    st.svc = st.services.find(s => s.id === b.dataset.id);
    if (st.loc && !st.svc.location_ids.includes(st.loc.id)) st.loc = null;
    if (st.svc.location_ids.length === 1) st.loc = st.locations.find(l => l.id === st.svc.location_ids[0]);
    st.day = null; st.slot = null;
    renderServices(); renderSites(); summary();
    if (st.svc.location_ids.length > 1) $('#site-pick').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  function renderSites() {
    const box = $('#site-pick');
    if (!st.svc || st.svc.location_ids.length < 2) { box.style.display = 'none'; return; }
    box.style.display = '';
    $('#sites').innerHTML = st.locations.filter(l => st.svc.location_ids.includes(l.id)).map(l => {
      const o = window.ZA.openNow(l.hours);
      return `<button type="button" class="choice ${st.loc && st.loc.id === l.id ? 'on' : ''}" data-id="${l.id}">
        <b>${fmt.esc(l.short_name)}</b><span class="meta">${fmt.esc(l.address)}, ${fmt.esc(l.postcode)}</span>
        <span class="meta" style="display:block;margin-top:6px"><span class="open-now ${o.open ? 'yes' : 'no'}">${o.text}</span></span></button>`;
    }).join('');
  }
  $('#sites').addEventListener('click', e => {
    const b = e.target.closest('.choice'); if (!b) return;
    st.loc = st.locations.find(l => l.id === b.dataset.id); st.day = null; st.slot = null; renderSites(); summary();
  });

  // ---------- step 3 ----------
  async function loadDays() {
    const key = st.loc.id + '|' + st.svc.id;
    $('#days').innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton" style="height:84px"></div>').join('');
    $('#slots').innerHTML = '';
    $('#time-help').textContent = `${st.svc.name} at ${st.loc.short_name}. Takes about ${dur(st.svc.duration_min)}.`;
    $('#call-site').textContent = st.loc.phone; $('#call-site').href = fmt.phoneHref(st.loc.phone);
    try {
      const days = st.daysCache[key] || (st.daysCache[key] = await pub.days(st.loc.id, st.svc.id, fmt.today(), 28));
      $('#days').innerHTML = days.map(d => {
        const cls = !d.open ? 'none' : d.free_slots === 0 ? 'none' : d.free_slots < 4 ? 'few' : 'lots';
        const txt = !d.open ? 'Closed' : d.free_slots === 0 ? 'Full' : d.free_slots < 4 ? d.free_slots + ' left' : 'Available';
        return `<button type="button" class="day ${st.day === d.day ? 'on' : ''}" data-day="${d.day}" ${d.free_slots ? '' : 'disabled'}>
          <small>${fmt.dayOfIso(d.day, { weekday: 'short' })}</small><b>${Number(d.day.slice(8))}</b><small>${fmt.dayOfIso(d.day, { month: 'short' })}</small><i class="${cls}">${txt}</i></button>`;
      }).join('');
      if (!st.day) { const first = days.find(d => d.free_slots > 0); if (first) st.day = first.day; }
      markDay(); if (st.day) loadSlots();
      else $('#slots').innerHTML = '<p class="muted">No online slots in the next 4 weeks. Please call us.</p>';
    } catch (e) { $('#days').innerHTML = `<div class="notice bad">${fmt.esc(e.message)}</div>`; }
  }
  function markDay() { $$('#days .day').forEach(b => b.classList.toggle('on', b.dataset.day === st.day)); const on = $('#days .day.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  $('#days').addEventListener('click', e => { const b = e.target.closest('.day'); if (!b || b.disabled) return; st.day = b.dataset.day; st.slot = null; markDay(); loadSlots(); summary(); });
  async function loadSlots() {
    $('#day-label').textContent = fmt.dayOfIso(st.day, { weekday: 'long', day: 'numeric', month: 'long' });
    $('#slots').innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"></div>').join('');
    try {
      const slots = await pub.slots(st.loc.id, st.svc.id, st.day);
      const free = slots.filter(s => s.free).length;
      $('#slot-legend').textContent = free ? `${free} time${free === 1 ? '' : 's'} free` : '';
      $('#slots').innerHTML = slots.map(s => `<button type="button" class="slot ${st.slot && st.slot.starts_at === s.starts_at ? 'on' : ''}" data-ts="${s.starts_at}" data-end="${s.ends_at}" ${s.free ? '' : 'disabled aria-label="' + s.label + ' taken"'}>${s.label}</button>`).join('') || '<p class="muted">Closed this day.</p>';
    } catch (e) { $('#slots').innerHTML = `<div class="notice bad">${fmt.esc(e.message)}</div>`; }
  }
  $('#slots').addEventListener('click', e => {
    const b = e.target.closest('.slot'); if (!b || b.disabled) return;
    st.slot = { starts_at: b.dataset.ts, ends_at: b.dataset.end };
    $$('#slots .slot').forEach(x => x.classList.toggle('on', x === b)); summary();
  });

  // ---------- summary & nav ----------
  function summary() {
    const n = fmt.normReg(regEl.value);
    const mm = [$('#make').value, $('#model').value].filter(Boolean).join(' ');
    $('#s-reg').innerHTML = n ? `<span class="plate-badge">${fmt.esc(fmt.plate(n))}</span>${mm ? '<div class="small muted" style="margin-top:4px">' + fmt.esc(mm) + '</div>' : ''}` : '—';
    $('#s-svc').textContent = st.svc ? st.svc.name : '—';
    $('#s-loc').innerHTML = st.loc ? `${fmt.esc(st.loc.short_name)}<div class="small muted">${fmt.esc(st.loc.postcode)}</div>` : '—';
    $('#s-when').textContent = st.slot ? fmt.day(st.slot.starts_at) + ', ' + fmt.time(st.slot.starts_at) : st.day ? fmt.dayOfIso(st.day) : '—';
    $('#s-price').textContent = st.svc ? (st.svc.price_label || 'Quote') : '—';
    $('#next').disabled = !canNext();
  }
  function canNext() {
    if (st.step === 1) return fmt.normReg(regEl.value).length >= 2;
    if (st.step === 2) return !!(st.svc && st.loc);
    if (st.step === 3) return !!st.slot;
    if (st.step === 4) return true;
    return false;
  }
  function go(n) {
    st.step = n;
    $$('.step').forEach(s => s.classList.toggle('on', Number(s.dataset.step) === n));
    $$('#steps span').forEach((s, i) => { s.className = i + 1 < n ? 'done' : i + 1 === n ? 'on' : ''; });
    $('#back').style.visibility = n === 1 ? 'hidden' : 'visible';
    $('#wiz-nav').style.display = n === 5 ? 'none' : 'flex';
    $('#next').textContent = n === 4 ? 'Confirm booking' : 'Continue';
    if (n === 3) loadDays();
    if (n === 2) renderServices();
    summary();
    const top = document.querySelector('.wizard').getBoundingClientRect().top + scrollY - 90;
    if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
  }
  $('#back').addEventListener('click', () => go(Math.max(1, st.step - 1)));
  $('#next').addEventListener('click', async () => {
    if (!canNext()) return;
    if (st.step < 4) {
      // skip step 2 if the service and site came pre-selected? No, always show so people can check.
      return go(st.step + 1);
    }
    await submit();
  });
  regEl.addEventListener('keydown', e => { if (e.key === 'Enter' && canNext()) go(2); });

  async function submit() {
    const err = $('#book-error'); err.style.display = 'none';
    const phone = $('#phone').value.trim(), first = $('#first_name').value.trim();
    const digits = phone.replace(/[^0-9]/g, '').replace(/^44/, '0');
    const problems = [];
    if (!first) problems.push('your first name');
    if (digits.length < 10 || digits.length > 11) problems.push('a UK phone number');
    const email = $('#email').value.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push('a valid email (or leave it blank)');
    if (problems.length) { err.textContent = 'Please add ' + problems.join(', ') + '.'; err.style.display = ''; return; }
    const btn = $('#next'); btn.disabled = true; btn.textContent = 'Booking…';
    try {
      const n = fmt.normReg(regEl.value);
      st.result = await pub.book({
        location_id: st.loc.id, service_id: st.svc.id, starts_at: st.slot.starts_at,
        reg: n, reg_display: fmt.plate(n), make: $('#make').value.trim(), model: $('#model').value.trim(),
        mot_expiry: $('#mot_expiry').value || '', colour: st.car ? st.car.colour || '' : '', fuel_type: st.car ? st.car.fuel_type || '' : '', year: st.car && st.car.year ? String(st.car.year) : '', first_name: first, last_name: $('#last_name').value.trim(),
        phone, email, notes: $('#notes').value.trim(), marketing_opt_in: $('#marketing').checked
      });
      done();
    } catch (e) {
      err.textContent = e.message; err.style.display = '';
      if (/taken|not available|too soon/i.test(e.message)) { st.slot = null; delete st.daysCache[st.loc.id + '|' + st.svc.id]; setTimeout(() => go(3), 1800); }
    } finally { btn.disabled = false; btn.textContent = 'Confirm booking'; }
  }

  function done() {
    const r = st.result;
    $('#done-title').textContent = r.status === 'confirmed' ? "You're booked in" : 'Request received';
    $('#done-where').dataset.extra = r.status === 'confirmed' ? '' : ' The garage will confirm your time shortly.';
    $('#done-ref').textContent = r.ref;
    $('#done-when').textContent = fmt.longDay(r.starts_at) + ' at ' + fmt.time(r.starts_at);
    $('#done-where').textContent = `${r.service} · ${r.location}, ${r.address}.` + ($('#done-where').dataset.extra || '');
    $('#directions').href = `https://www.google.com/maps/dir/?api=1&destination=${st.loc.lat},${st.loc.lng}`;
    $('#manage').href = `manage.html?ref=${encodeURIComponent(r.ref)}`;
    try { sessionStorage.setItem('za-manage', JSON.stringify({ ref: r.ref, phone: $('#phone').value.trim() })); } catch (_) {}
    go(5);
    try { localStorage.setItem('za-last-booking', JSON.stringify({ ref: r.ref, at: r.starts_at })); } catch (_) {}
  }

  $('#ics').addEventListener('click', () => {
    const r = st.result; if (!r) return;
    const z = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Z Autoz//Booking//EN', 'BEGIN:VEVENT',
      'UID:' + r.ref + '@zautoz', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(r.starts_at), 'DTEND:' + z(r.ends_at),
      'SUMMARY:' + r.service + ' – ' + r.location, 'LOCATION:' + r.address.replace(/,/g, '\\,'),
      'DESCRIPTION:Booking ref ' + r.ref + '. Call ' + r.phone + ' if you need to change it.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = r.ref + '.ics'; a.click();
  });

  go(params.get('reg') && params.get('service') ? 2 : 1);
})();
