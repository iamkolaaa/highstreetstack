(function () {
  const { fmt } = ZA, P = ZAP, esc = fmt.esc;

  // ---------- quick plate form ----------
  const regEl = document.getElementById('reg'), hint = document.getElementById('reghint');
  const chipDefs = [['mot4', 'MOT', P.icons.mot], ['servicing', 'Service', P.icons.servicing], ['tyres', 'Tyres', P.icons.tyres], ['diagnostics', 'Diagnostics', P.icons.diagnostics], ['repairs', 'Repair', P.icons.repairs]];
  let picked = 'mot4';
  const chips = document.getElementById('chips');
  chips.innerHTML = chipDefs.map(([v, t, i]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${v === picked}">${i}${t}</button>`).join('');
  chips.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    picked = b.dataset.v;
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
  });
  regEl.addEventListener('input', () => {
    const raw = fmt.normReg(regEl.value).slice(0, 8);
    regEl.value = fmt.plate(raw);
    if (!raw) hint.textContent = '', hint.className = 'hint';
    else if (!fmt.plateValid(raw)) hint.textContent = "That doesn't look like a standard UK reg, but you can still carry on.", hint.className = 'hint warn';
    else hint.textContent = '', hint.className = 'hint';
    clearTimeout(lookT);
    if (fmt.plateValid(raw)) lookT = setTimeout(async () => {
      const car = await ZA.pub.lookupReg(raw);
      if (car && fmt.normReg(regEl.value) === raw) { hint.innerHTML = '<b>✓ ' + esc(fmt.carLine(car)) + '</b>' + (car.mot_expiry ? ' · MOT due ' + esc(fmt.date(car.mot_expiry)) : ''); hint.className = 'hint ok'; }
    }, 450);
  });
  let lookT;
  document.getElementById('quick').addEventListener('submit', e => {
    e.preventDefault();
    const q = new URLSearchParams(), reg = fmt.normReg(regEl.value);
    if (reg) q.set('reg', reg);
    // category chips (not a real service id) are passed as category; mot4 is a service id
    if (picked === 'mot4') q.set('service', 'mot4'); else q.set('category', picked);
    location.href = 'book.html?' + q.toString();
  });

  // ---------- services ----------
  const svcEl = document.getElementById('svc-list');
  P.placeholderNote(document.getElementById('price-note'));
  ZA.pub.services().then(list => {
    if (!list.length) { svcEl.outerHTML = '<p class="muted">Services will appear here soon. Call us on 01908 365050.</p>'; return; }
    const by = {}; list.forEach(s => (by[s.category] = by[s.category] || []).push(s));
    const html = P.catOrder.filter(c => by[c]).map(c => `<div class="cat-block"><h3><span class="svc-card"><span class="ico ${c === 'mot' ? 'mot' : ''}">${P.icons[c] || P.icons.other}</span></span>${esc(P.catNames[c] || c)}</h3>
      <div class="grid g3">${by[c].map(card).join('')}</div></div>`).join('');
    svcEl.className = ''; svcEl.innerHTML = html;
  }).catch(() => { svcEl.className = ''; svcEl.innerHTML = P.errorBox('our services'); });

  function card(s) {
    const site = P.site(s), href = P.bookHref(s);
    const inner = `<h4>${esc(s.name)}</h4>
      <p>${esc(s.description || '')}</p>
      <div class="price">${esc(P.price(s))}${s.duration_min ? ` <span class="muted small" style="font-weight:500">· ${P.duration(s.duration_min)}</span>` : ''}</div>
      <div class="tags"><span class="tag ${site.cls}">${site.text}</span>${s.walk_in ? '<span class="tag green">Walk-ins welcome</span>' : ''}</div>
      <span class="go">${href ? 'Book this ' + P.icons.arrow : 'Call to book'}</span>`;
    return href ? `<a class="card hover svc-card" href="${href}">${inner}</a>`
      : `<div class="card svc-card">${inner}</div>`;
  }

  // ---------- MOT checker ----------
  const md = document.getElementById('motdate'), mr = document.getElementById('motresult');
  function earliest(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    let ty = y, tm = m - 1; if (tm < 1) { tm = 12; ty--; }
    const dim = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    const base = `${ty}-${String(tm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`;
    return fmt.addDays(base, 1);
  }
  md.addEventListener('input', () => {
    const v = md.value; if (!v) { return; }
    const left = fmt.daysUntil(v), ear = earliest(v), earDays = fmt.daysUntil(ear);
    let cls, head, body;
    if (left < 0) {
      cls = 'bad'; head = 'MOT expired ' + Math.abs(left) + (Math.abs(left) === 1 ? ' day' : ' days') + ' ago';
      body = '<p><b>Driving without a valid MOT can mean a fine of up to £1,000</b> (unless you are driving to a pre-booked test). Book as soon as you can.</p>';
    } else if (left <= 30) {
      cls = 'warn'; head = left === 0 ? 'Your MOT expires today' : left + (left === 1 ? ' day' : ' days') + ' left';
      body = `<p>Due soon. You can test now and still keep your renewal date of <b>${fmt.date(v)}</b>.</p>`;
    } else {
      cls = 'ok'; head = left + ' days left';
      body = `<p>You're fine for now. The earliest you can test and keep the same renewal date is <b>${fmt.longDay(ear + 'T12:00:00Z')}</b> (in ${earDays} days).</p>`;
    }
    if (left >= 0 && left <= 30) body += `<p>Earliest test date was ${fmt.date(ear)}.</p>`;
    mr.className = 'mot-result ' + cls;
    mr.innerHTML = `<div class="big">${head}</div><p>Expires ${fmt.longDay(v + 'T12:00:00Z')}.</p>${body}
      <a class="btn btn-primary" href="book.html?service=mot4">Book my MOT</a>
      <p class="small" style="margin-top:12px"><a href="https://www.gov.uk/check-mot-history" target="_blank" rel="noopener" style="color:#ffb48a">Official GOV.UK MOT history checker</a></p>`;
  });

  // ---------- locations + map ----------
  const locEl = document.getElementById('loc-list');
  ZA.pub.locations().then(locs => {
    locEl.innerHTML = locs.map(l => {
      const st = ZA.openNow(l.hours || {}), isMot = l.id === 'mot';
      return `<article class="card loc-card ${isMot ? 'mot' : ''}"><div class="bar"></div>
        <div class="top"><h3>${esc(l.name)}</h3><p class="muted" style="margin:0 0 6px">${esc(l.tagline || '')}</p>
        <span class="open-now ${st.open ? 'yes' : 'no'}">● ${esc(st.text)}</span>
        <dl><dt>Address</dt><dd>${esc(l.address)}, ${esc(l.postcode)}</dd>
        <dt>Phone</dt><dd><a href="${fmt.phoneHref(l.phone)}">${esc(fmt.phone(l.phone))}</a></dd>
        ${l.email ? `<dt>Email</dt><dd><a href="mailto:${esc(l.email)}">${esc(l.email)}</a></dd>` : ''}</dl></div>
        <details class="hrs"><summary>Opening hours</summary>${ZA.hoursList(l.hours || {})}</details>
        <div class="actions">
          <a class="btn btn-sm ${isMot ? 'btn-green' : 'btn-primary'}" href="book.html?location=${encodeURIComponent(l.id)}">Book here</a>
          <a class="btn btn-sm btn-dark" href="${fmt.phoneHref(l.phone)}">Call</a>
          <a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}">Directions</a>
        </div></article>`;
    }).join('');
    initMap(locs);
  }).catch(() => {
    locEl.innerHTML = '<div style="grid-column:1/-1">' + P.errorBox('our locations') + '</div>';
    initMap([
      { id: 'garage', name: 'Z Autoz Garage', address: 'Unit 8 Sinclair Court, Bletchley', postcode: 'MK1 1RB', lat: 51.9965, lng: -0.7385 },
      { id: 'mot', name: "Pam's MOT Centre", address: '14 Horwood Court, Bletchley', postcode: 'MK1 1RD', lat: 51.9945, lng: -0.7350 }
    ].filter(() => false));
  });

  function initMap(locs) {
    const mapEl = document.getElementById('map');
    if (!window.L || !locs.length) { mapEl.closest('.map-wrap').hidden = true; return; }
    const map = L.map('map', { scrollWheelZoom: false });
    const layers = {
      map: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }),
      sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics' })
    };
    let cur = 'map'; layers.map.addTo(map);
    document.querySelectorAll('.map-toggle button').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.s === cur) return;
      map.removeLayer(layers[cur]); cur = b.dataset.s; layers[cur].addTo(map);
      document.querySelectorAll('.map-toggle button').forEach(x => x.classList.toggle('on', x === b));
    }));
    const pts = [];
    locs.forEach(l => {
      if (l.lat == null || l.lng == null) return;
      const col = l.id === 'mot' ? '#149a43' : '#e8421f';
      const icon = L.divIcon({ className: '', html: `<div class="marker-pin" style="background:${col}"></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
      L.marker([l.lat, l.lng], { icon, title: l.name }).addTo(map)
        .bindPopup(`<b>${esc(l.name)}</b><br>${esc(l.address)}, ${esc(l.postcode)}<br><a href="${fmt.phoneHref(l.phone)}">${esc(fmt.phone(l.phone))}</a><br><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}">Directions</a>`);
      pts.push([l.lat, l.lng]);
    });
    if (pts.length) map.fitBounds(pts, { padding: [60, 60], maxZoom: 16 });
  }
})();
