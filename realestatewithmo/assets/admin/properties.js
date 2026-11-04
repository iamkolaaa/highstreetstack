/* Properties: the list (render) and the editor (renderEditor). */
import { mountUploader } from './upload.js?v=202611040819';

const KINDS = [['shortlet', 'Shortlet'], ['residential', 'Residential'], ['land', 'Land'], ['commercial', 'Commercial']];
const UNITS = [['night', 'per night'], ['total', 'total price'], ['per_plot', 'per plot'], ['per_sqm', 'per sqm']];

/* Small local copy of the Google Maps link reader (the server has the same rules for short links). */
export function latLngFromMapsUrl(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  try { s = decodeURIComponent(s); } catch (e) { /* keep as is */ }
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const tries = [
    new RegExp('!3d' + num + '!4d' + num),
    new RegExp('@' + num + ',\\s*' + num),
    new RegExp('[?&](?:q|ll|query|destination|center|daddr)=\\+?' + num + ',\\s*\\+?' + num, 'i'),
    new RegExp('^\\s*' + num + '\\s*[,\\s]\\s*' + num + '\\s*$')
  ];
  for (const re of tries) {
    const m = re.exec(s);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

const statusPill = st => '<span class="a-pill p-' + st + '">' + ({ live: 'Live', hidden: 'Hidden', archived: 'Archived' }[st] || st) + '</span>';

/* ================= list ================= */
export async function render(root, ctx) {
  const { esc, f, icons } = ctx;
  let showArchived = false;
  let all = await ctx.props(true);

  function paint() {
    const rows = all.filter(p => showArchived || p.status !== 'archived');
    const arch = all.filter(p => p.status === 'archived').length;
    root.innerHTML =
      '<div class="a-head"><h1>Properties</h1><a class="btn btn-primary a-sm" href="#property/new">' + icons.plus + '<span>New</span></a></div>' +
      (rows.length ? '<ul class="pl">' + rows.map((p, i) => row(p, i, rows.length)).join('') + '</ul>' :
        '<div class="a-empty"><h3>No properties yet</h3><p>Add your first place, or load demo listings from Settings to look around.</p><a class="btn btn-primary" href="#property/new">Add a property</a></div>') +
      (arch ? '<label class="a-check"><input type="checkbox" id="pl-arch"' + (showArchived ? ' checked' : '') + '> Show archived (' + arch + ')</label>' : '');
  }

  function row(p, i, n) {
    const cover = (p.photos && p.photos[0]) || p.cover || null;
    const img = cover ? '<img src="' + esc(f.photoSrc(cover, 240)) + '" alt="" loading="lazy" decoding="async">' : '<span class="pl-none">No photo</span>';
    const nPhotos = p.photo_count !== undefined ? p.photo_count : (p.photos || []).length;
    const noPin = p.lat === null || p.lat === undefined || p.lat === '' ? '<span class="a-tag warn">No pin yet</span>' : '';
    const movable = p.status !== 'archived';
    return '<li class="pl-row" data-id="' + esc(p.id) + '">' +
      '<a class="pl-main" href="#property/' + esc(p.id) + '"><div class="pl-img">' + img + '</div>' +
      '<div class="pl-t"><div class="pl-top">' + statusPill(p.status) + '<span class="a-kind">' + esc(f.kindLabel(p.kind)) + '</span>' + (p.demo ? '<span class="a-tag">Demo</span>' : '') + '</div>' +
      '<b>' + esc(p.title) + '</b><span class="a-muted">' + esc(p.area) + '</span>' +
      '<span class="pl-price">' + esc(f.priceLabel(p)) + '</span>' +
      '<span class="a-muted pl-sub">' + esc(nPhotos) + (nPhotos === 1 ? ' photo' : ' photos') + '</span>' + noPin + '</div></a>' +
      (movable ? '<div class="pl-mv"><button type="button" class="icon-btn" data-mv="up" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>' + icons.up + '</button>' +
        '<button type="button" class="icon-btn" data-mv="down" aria-label="Move down"' + (i === n - 1 ? ' disabled' : '') + '>' + icons.down + '</button></div>' : '') +
      '</li>';
  }

  root.addEventListener('change', e => {
    if (e.target.id === 'pl-arch') { showArchived = e.target.checked; paint(); }
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-mv]');
    if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    const live = all.filter(p => p.status !== 'archived');
    const i = live.findIndex(p => p.id === id);
    const j = b.dataset.mv === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= live.length) return;
    const before = all.slice();
    [live[i], live[j]] = [live[j], live[i]];
    all = live.concat(all.filter(p => p.status === 'archived'));
    paint();
    try {
      await ctx.api('reorder_properties', { ids: all.map(p => p.id) });
      ctx.dropPropCache();
    } catch (er) {
      all = before;
      paint();
      ctx.toast(er.message || 'Could not reorder.', 'bad');
    }
  });
  paint();
  return null;
}

/* ================= editor ================= */
const num = v => {
  const s = String(v === null || v === undefined ? '' : v).trim();
  return s === '' ? '' : Number(s.replace(/[^\d.-]/g, ''));
};

export async function renderEditor(root, ctx, param) {
  const { esc, f, icons } = ctx;
  const isNew = !param || param === 'new';
  let P;
  if (isNew) {
    P = { kind: 'shortlet', price_unit: 'night', amenities: [], featured: false, photos: [], status: 'live', lat: null, lng: null };
  } else {
    const list = await ctx.props(true);
    P = list.find(p => p.id === param);
    if (!P) {
      root.innerHTML = '<div class="a-state"><h2>Not found</h2><p>That property is gone.</p><a class="btn btn-primary" href="#properties">Back to properties</a></div>';
      return null;
    }
    P = Object.assign({}, P, { amenities: (P.amenities || []).slice(), photos: (P.photos || []).slice() });
  }
  const S = ctx.getSettings();
  let kind = P.kind || 'shortlet';
  const amen = new Set(P.amenities || []);
  let lat = P.lat === '' || P.lat === undefined ? null : P.lat;
  let lng = P.lng === '' || P.lng === undefined ? null : P.lng;
  let dirty = false;
  let alive = true;
  let uploader = null;

  const val = k => (P[k] === null || P[k] === undefined || (P[k] === 0 && (k === 'bedrooms' || k === 'bathrooms' || k === 'max_guests')) ? '' : P[k]);
  const input = (name, label, o = {}) =>
    '<label class="field' + (o.cls ? ' ' + o.cls : '') + '"><span class="a-lbl">' + label + '</span>' +
    '<input class="input" name="' + name + '" value="' + esc(val(name)) + '" ' + (o.attrs || '') + '>' + (o.help ? '<small class="a-help">' + o.help + '</small>' : '') + '</label>';

  root.innerHTML =
    '<div class="a-head"><button type="button" class="icon-btn" id="pe-back" aria-label="Back to properties">' + icons.back + '</button>' +
    '<h1>' + (isNew ? 'New property' : 'Edit property') + '</h1>' + (isNew ? '' : statusPill(P.status)) + '</div>' +
    (P.status === 'archived' ? '<div class="a-note">This property is archived and hidden everywhere. <button type="button" class="a-link" id="pe-restore">Restore it</button></div>' : '') +
    '<form id="pf" class="a-form pe" novalidate autocomplete="off">' +

    '<section class="a-card"><h2 class="a-h2">The basics</h2>' +
    '<div class="field"><span class="a-lbl">What is it?</span><div class="chips a-chips" id="pe-kind" role="radiogroup">' +
    KINDS.map(k => '<button type="button" class="chip' + (k[0] === kind ? ' on' : '') + '" role="radio" aria-checked="' + (k[0] === kind) + '" data-kind="' + k[0] + '">' + k[1] + '</button>').join('') + '</div></div>' +
    input('title', 'Title', { attrs: 'maxlength="90" required placeholder="e.g. Bright 2-bed with pool, Lekki Phase 1"' }) +
    '<label class="field"><span class="a-lbl">Area</span><input class="input" name="area" list="pe-areas" value="' + esc(val('area')) + '" maxlength="60" placeholder="Start typing or pick one">' +
    '<datalist id="pe-areas">' + ctx.AREAS.map(a => '<option value="' + esc(a) + '">').join('') + '</datalist></label>' +
    input('address', 'Address (optional)', { attrs: 'maxlength="160"' }) +
    '<label class="field"><span class="a-lbl">Short summary</span><textarea class="textarea" name="summary" rows="2" maxlength="200" data-count="200">' + esc(val('summary')) + '</textarea><small class="a-help" data-for="summary"></small></label>' +
    '<label class="field"><span class="a-lbl">Full description</span><textarea class="textarea" name="description" rows="6" maxlength="3000" data-count="3000">' + esc(val('description')) + '</textarea><small class="a-help" data-for="description"></small></label>' +
    '</section>' +

    '<section class="a-card"><h2 class="a-h2">Price</h2>' +
    '<div class="a-two">' + input('price_ngn', 'Price (₦)', { attrs: 'inputmode="numeric" placeholder="85000"', help: '<span id="pe-pp"></span>' }) +
    '<label class="field"><span class="a-lbl">Charged</span><select class="select" name="price_unit">' + UNITS.map(u => '<option value="' + u[0] + '"' + (u[0] === (P.price_unit || 'night') ? ' selected' : '') + '>' + u[1] + '</option>').join('') + '</select></label></div>' +
    input('price_note', 'Shown when there is no price', { attrs: 'maxlength="80" placeholder="Contact for pricing"' }) +
    '</section>' +

    '<section class="a-card"><h2 class="a-h2">Rooms and stays</h2>' +
    '<div class="a-three" data-only="shortlet residential commercial">' + input('bedrooms', 'Bedrooms', { attrs: 'inputmode="numeric"' }) + input('bathrooms', 'Bathrooms', { attrs: 'inputmode="numeric"' }) +
    '<span data-only="shortlet">' + input('max_guests', 'Sleeps', { attrs: 'inputmode="numeric"' }) + '</span></div>' +
    '<div data-only="shortlet"><div class="a-three">' + input('min_nights', 'Minimum nights', { attrs: 'inputmode="numeric" placeholder="' + esc(S.min_nights || 1) + '"', help: 'Empty uses ' + esc(S.min_nights || 1) }) +
    '<label class="field"><span class="a-lbl">Check-in</span><input class="input" type="time" name="check_in" value="' + esc(val('check_in')) + '"><small class="a-help">Empty uses ' + esc(S.check_in || '14:00') + '</small></label>' +
    '<label class="field"><span class="a-lbl">Check-out</span><input class="input" type="time" name="check_out" value="' + esc(val('check_out')) + '"><small class="a-help">Empty uses ' + esc(S.check_out || '11:00') + '</small></label></div></div>' +
    '<p class="a-muted" data-only="land">Land does not need rooms. Put the plot size in the description.</p>' +
    '</section>' +

    '<section class="a-card" data-only="shortlet residential commercial"><h2 class="a-h2">What is included</h2><div class="chips a-chips" id="pe-am">' +
    ctx.AMENITIES.map(a => '<button type="button" class="chip' + (amen.has(a) ? ' on' : '') + '" aria-pressed="' + amen.has(a) + '" data-am="' + esc(a) + '">' + esc(a) + '</button>').join('') + '</div></section>' +

    '<section class="a-card"><h2 class="a-h2">Photos</h2><div id="pe-ph">' +
    (isNew ? '<div class="a-note">Save the property first, then add photos. It only takes a moment.</div>' : '') + '</div></section>' +

    '<section class="a-card"><h2 class="a-h2">Location</h2>' +
    '<p class="a-muted">Tap the map where the property is, or paste a Google Maps link.</p>' +
    '<div id="pm" class="pm-box"></div>' +
    '<div class="pm-link"><input class="input" id="pm-url" inputmode="url" placeholder="Paste a Google Maps link" aria-label="Google Maps link"><button type="button" class="btn btn-outline" id="pm-go">Use link</button></div>' +
    '<p class="a-err" id="pm-err" role="alert"></p>' +
    '<div class="a-two">' + input('lat', 'Latitude', { attrs: 'inputmode="decimal"' }) + input('lng', 'Longitude', { attrs: 'inputmode="decimal"' }) + '</div>' +
    '<button type="button" class="a-link" id="pm-clear">Remove the pin</button></section>' +

    '<section class="a-card"><h2 class="a-h2">Showing it</h2>' +
    '<label class="a-switch"><input type="checkbox" name="featured"' + (P.featured ? ' checked' : '') + '><span class="a-sw"></span><span>Feature on the home page<small>Featured places come first in lists.</small></span></label>' +
    '</section>' +

    '<section class="a-card" data-only="shortlet"><h2 class="a-h2">Calendar sync</h2>' +
    (P.ical_url ? '<div class="field"><span class="a-lbl">Your calendar link (give this to Airbnb or Google Calendar)</span><div class="pm-link"><input class="input" readonly value="' + esc(P.ical_url) + '" aria-label="iCal link"><button type="button" class="btn btn-outline" id="pe-ical">Copy</button></div></div>' : '<p class="a-muted">The calendar link appears here after you save.</p>') +
    input('ical_import_url', 'Calendar link to import from (optional)', { attrs: 'inputmode="url" maxlength="500" placeholder="https://..."', help: 'Paste an Airbnb or Booking.com calendar link. Switch importing on in Settings.' }) +
    '</section>' +

    (isNew ? '' : '<section class="a-card a-danger"><h2 class="a-h2">More</h2><div class="a-row-btns">' +
      (P.status === 'archived' ? '' : '<button type="button" class="btn btn-outline" id="pe-vis">' + icons.eye + '<span>' + (P.status === 'live' ? 'Hide from the site' : 'Show on the site') + '</span></button>') +
      '<a class="btn btn-outline" href="#calendar/' + esc(P.id) + '">' + icons.calendar + '<span>Open calendar</span></a>' +
      (P.status === 'archived' ? '' : '<button type="button" class="btn btn-outline btn-warn" id="pe-arch">Archive</button>') + '</div></section>') +
    '<p class="a-err" id="pe-err" role="alert"></p>' +
    '<div class="a-savebar"><button type="submit" class="btn btn-primary a-block" id="pe-save">' + (isNew ? 'Create property' : 'Save changes') + '</button></div>' +
    '</form>';

  const reopen = () => { const fresh = root.cloneNode(false); root.replaceWith(fresh); renderEditor(fresh, ctx, P.id); };
  const form = root.querySelector('#pf');
  const el = n => form.elements[n];

  /* conditional fields by kind */
  function applyKind() {
    form.querySelectorAll('[data-only]').forEach(n => {
      n.hidden = !n.dataset.only.split(/\s+/).includes(kind);
    });
    form.querySelectorAll('#pe-kind .chip').forEach(c => {
      const on = c.dataset.kind === kind;
      c.classList.toggle('on', on);
      c.setAttribute('aria-checked', String(on));
    });
  }
  function prettyPrice() {
    const n = num(el('price_ngn').value);
    root.querySelector('#pe-pp').textContent = n === '' || isNaN(n) ? '' : f.ngn(n);
  }
  function counters() {
    form.querySelectorAll('[data-count]').forEach(t => {
      const h = form.querySelector('[data-for="' + t.name + '"]');
      if (h) h.textContent = t.value.length + ' of ' + t.dataset.count;
    });
  }
  applyKind(); prettyPrice(); counters();

  form.addEventListener('input', e => {
    dirty = true;
    if (e.target.name === 'price_ngn') prettyPrice();
    if (e.target.dataset && e.target.dataset.count) counters();
    if (e.target.name === 'lat' || e.target.name === 'lng') {
      const a = num(el('lat').value);
      const b = num(el('lng').value);
      lat = a === '' || isNaN(a) ? null : a;
      lng = b === '' || isNaN(b) ? null : b;
    }
  });
  form.addEventListener('change', e => {
    if (e.target.name === 'lat' || e.target.name === 'lng') mountPicker();
  });
  form.addEventListener('click', e => {
    const k = e.target.closest('[data-kind]');
    if (k) {
      kind = k.dataset.kind;
      dirty = true;
      if (kind === 'shortlet' && !el('price_unit').value) el('price_unit').value = 'night';
      if (kind === 'land' && el('price_unit').value === 'night') el('price_unit').value = 'per_plot';
      if ((kind === 'residential' || kind === 'commercial') && el('price_unit').value === 'night') el('price_unit').value = 'total';
      if (kind === 'shortlet' && el('price_unit').value !== 'night') el('price_unit').value = 'night';
      applyKind();
      return;
    }
    const a = e.target.closest('[data-am]');
    if (a) {
      const n = a.dataset.am;
      if (amen.has(n)) amen.delete(n); else amen.add(n);
      a.classList.toggle('on', amen.has(n));
      a.setAttribute('aria-pressed', String(amen.has(n)));
      dirty = true;
    }
  });

  /* map pin */
  const pmBox = root.querySelector('#pm');
  const pmErr = root.querySelector('#pm-err');
  function writeLatLng() {
    el('lat').value = lat === null ? '' : String(lat);
    el('lng').value = lng === null ? '' : String(lng);
  }
  let picker = null;
  async function mountPicker() {
    if (!alive) return;
    try {
      const M = await import('../map.js?v=202611040819');
      await M.loadMap();
      if (!alive) return;
      pmBox.innerHTML = '';
      const d = document.createElement('div');
      d.className = 'map';
      pmBox.appendChild(d);
      picker = await M.pickOnMap(d, {
        lat: lat === null ? undefined : lat,
        lng: lng === null ? undefined : lng,
        onPick: (la, ln) => {
          lat = Math.round(la * 1e6) / 1e6;
          lng = Math.round(ln * 1e6) / 1e6;
          dirty = true;
          writeLatLng();
          pmErr.textContent = '';
        }
      });
      if (!picker) throw new Error('no map');
    } catch (e) {
      picker = null;
      pmBox.innerHTML = '<p class="a-muted">The map could not load. You can still paste a link or type the coordinates below.</p>';
    }
  }
  async function useLink() {
    const url = root.querySelector('#pm-url').value.trim();
    pmErr.textContent = '';
    if (!url) { pmErr.textContent = 'Paste a Google Maps link first.'; return; }
    let hit = latLngFromMapsUrl(url);
    if (!hit && /^https?:\/\//i.test(url)) {
      const b = root.querySelector('#pm-go');
      b.disabled = true;
      try {
        const r = await ctx.api('resolve_map_link', { url });
        if (r && isFinite(Number(r.lat)) && isFinite(Number(r.lng))) hit = { lat: Number(r.lat), lng: Number(r.lng) };
      } catch (e) {
        pmErr.textContent = e.message || 'Could not read a location from that link.';
        b.disabled = false;
        return;
      }
      b.disabled = false;
    }
    if (!hit) { pmErr.textContent = 'Could not read a location from that link.'; return; }
    lat = hit.lat; lng = hit.lng; dirty = true;
    writeLatLng();
    if (picker && picker.setPoint) picker.setPoint(lat, lng); else mountPicker();
    ctx.toast('Pin set from your link.', 'ok');
  }
  root.querySelector('#pm-go').addEventListener('click', useLink);
  root.querySelector('#pm-url').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useLink(); } });
  root.querySelector('#pm-clear').addEventListener('click', () => { lat = null; lng = null; dirty = true; writeLatLng(); mountPicker(); });
  writeLatLng();
  mountPicker();

  /* photos */
  if (!isNew) {
    uploader = mountUploader(root.querySelector('#pe-ph'), {
      propertyId: P.id, photos: P.photos, api: ctx.api, photoSrc: f.photoSrc, esc, toast: ctx.toast, confirm: ctx.confirm,
      onChange: ph => { P.photos = ph; ctx.dropPropCache(); }
    });
  }

  const ic = root.querySelector('#pe-ical');
  if (ic) ic.addEventListener('click', () => ctx.copy(P.ical_url, 'Calendar link copied.'));

  /* header actions */
  root.querySelector('#pe-back').addEventListener('click', async () => {
    if (dirty && !(await ctx.confirm('You have changes that are not saved. Leave without saving?', { ok: 'Leave', danger: true, title: 'Leave this page?' }))) return;
    ctx.nav('#properties');
  });

  async function setStatus(status, msg) {
    try {
      const r = await ctx.api('set_property_status', { id: P.id, status });
      ctx.dropPropCache();
      ctx.toast(msg, 'ok');
      return r.property;
    } catch (e) {
      ctx.toast(e.message || 'That did not work.', 'bad');
      return null;
    }
  }
  const vis = root.querySelector('#pe-vis');
  if (vis) vis.addEventListener('click', async () => {
    const next = P.status === 'live' ? 'hidden' : 'live';
    if (await setStatus(next, next === 'live' ? 'Now showing on the site.' : 'Hidden from the site.')) reopen();
  });
  const ar = root.querySelector('#pe-arch');
  if (ar) ar.addEventListener('click', async () => {
    if (!(await ctx.confirm('Archive "' + P.title + '"? It disappears from the site and your lists. Bookings stay in the sheet.', { ok: 'Archive', danger: true, title: 'Archive this property?' }))) return;
    if (await setStatus('archived', 'Archived.')) ctx.nav('#properties');
  });
  const rs = root.querySelector('#pe-restore');
  if (rs) rs.addEventListener('click', async () => {
    if (await setStatus('hidden', 'Restored. It is hidden until you show it.')) reopen();
  });

  /* save */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = root.querySelector('#pe-err');
    err.textContent = '';
    const title = el('title').value.trim();
    const area = el('area').value.trim();
    if (title.length < 3) { err.textContent = 'Give it a title of at least 3 letters.'; el('title').focus(); return; }
    if (!area) { err.textContent = 'Add the area, for example Lekki Phase 1.'; el('area').focus(); return; }
    const price = num(el('price_ngn').value);
    if (price !== '' && (isNaN(price) || price < 0)) { err.textContent = 'The price should be a number.'; el('price_ngn').focus(); return; }
    const imp = el('ical_import_url').value.trim();
    if (imp && !/^https:\/\//i.test(imp)) { err.textContent = 'The calendar link must start with https://'; el('ical_import_url').focus(); return; }
    const payload = {
      title, area, kind,
      address: el('address').value.trim(),
      summary: el('summary').value.trim(),
      description: el('description').value.trim(),
      price_ngn: price, price_unit: el('price_unit').value, price_note: el('price_note').value.trim(),
      bedrooms: num(el('bedrooms').value), bathrooms: num(el('bathrooms').value), max_guests: num(el('max_guests').value),
      min_nights: num(el('min_nights').value), check_in: el('check_in').value, check_out: el('check_out').value,
      amenities: ctx.AMENITIES.filter(a => amen.has(a)),
      lat: lat === null ? '' : lat, lng: lng === null ? '' : lng,
      featured: el('featured').checked,
      ical_import_url: imp
    };
    if (kind === 'land') { payload.bedrooms = ''; payload.bathrooms = ''; payload.max_guests = ''; payload.amenities = []; }
    if (kind !== 'shortlet') { payload.max_guests = ''; payload.min_nights = ''; payload.check_in = ''; payload.check_out = ''; }
    if (!isNew) payload.id = P.id;
    const btn = root.querySelector('#pe-save');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const r = await ctx.api('save_property', { property: payload });
      ctx.dropPropCache();
      dirty = false;
      if (isNew) {
        ctx.toast('Created. Now add photos.', 'ok');
        ctx.nav('#property/' + encodeURIComponent(r.property.id));
      } else {
        ctx.toast('Saved.', 'ok');
        btn.disabled = false; btn.textContent = 'Save changes';
        P = Object.assign({}, P, r.property, { photos: P.photos });
      }
    } catch (er) {
      err.textContent = er.message || 'Could not save.';
      btn.disabled = false; btn.textContent = isNew ? 'Create property' : 'Save changes';
    }
  });

  return { destroy: () => { alive = false; } };
}
