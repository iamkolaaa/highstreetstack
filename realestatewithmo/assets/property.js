import { api, errMsg } from './api.js?v=202611040820';
import { esc, href, param, ngn, priceLabel, priceParts, fmtRange, fmtTime, nights as nightsBetween, todayLagos, addDays, photoSrc, kindLabel, brandOf, isSale, waUrl } from './format.js?v=202611040820';
import { mountChrome, setWhatsApp, openSheet, closeSheet, toast, icon, allowedDates, slotPickerHtml, bindSlotPicker, stashBooking } from './ui.js?v=202611040820';
import { renderCalendar } from './calendar.js?v=202611040820';
import { mountMap, setMarkers, fitTo } from './map.js?v=202611040820';

mountChrome('');
const root = document.getElementById('root');
const idParam = param('id');
const shareCode = param('share');

let prop = null, settings = null, cal = null, sel = null, guests = Number(param('guests')) || 2;

function fail(msg) {
  root.innerHTML = `<div class="empty" style="margin-top:30px"><h3>${esc(msg)}</h3><p><a class="btn btn-primary" href="${esc(href('properties.html'))}">See other places</a></p></div>`;
}

async function load() {
  if (!idParam) return fail('That property is not available.');
  let r;
  try { r = await api('property', /^p_/.test(idParam) ? { id: idParam } : { slug: idParam }); } catch (e) { return fail(errMsg(e)); }
  prop = r.property; settings = r.settings;
  setWhatsApp(settings, `Hello Mo, I am interested in ${prop.title}.`);
  document.title = `${prop.title} | Real Estate with Mo`;
  const a = param('in'), b = param('out');
  if (!isSale(prop.kind) && a && b && b > a && a >= todayLagos() && free(a, b)) sel = { from: a, to: b };
  guests = Math.min(Math.max(1, guests), prop.max_guests || 12);
  draw();
}

const ranges = () => (prop.unavailable || []).map(u => ({ from: u.from, to: u.to, kind: 'booked' }));
function free(a, b) { return !ranges().some(r => a < r.to && r.from < b); }

function gallery() {
  const ph = prop.photos && prop.photos.length ? prop.photos : (prop.cover ? [prop.cover] : []);
  if (!ph.length) return '<div class="card-media" style="border-radius:14px"></div>';
  return `<div class="gallery" id="gal"><div class="gallery-track" id="track" tabindex="0" aria-label="Photos, swipe to browse">${ph.map((p, i) => `<div><img src="${esc(photoSrc(p, 1600))}" alt="${esc(prop.title)}, photo ${i + 1}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`).join('')}</div>
  ${ph.length > 1 ? `<button class="gallery-btn prev" type="button" aria-label="Previous photo">&#8249;</button><button class="gallery-btn next" type="button" aria-label="Next photo">&#8250;</button><span class="gallery-count" id="gcount">1 / ${ph.length}</span>` : ''}</div>
  ${ph.length > 1 ? `<div class="gallery-dots" id="dots">${ph.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}`;
}

function wireGallery() {
  const t = document.getElementById('track');
  if (!t) return;
  const n = t.children.length;
  const go = i => t.scrollTo({ left: t.clientWidth * Math.max(0, Math.min(n - 1, i)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const idx = () => Math.round(t.scrollLeft / t.clientWidth);
  t.addEventListener('scroll', () => {
    const i = idx();
    document.querySelectorAll('#dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    const c = document.getElementById('gcount'); if (c) c.textContent = `${i + 1} / ${n}`;
  }, { passive: true });
  const p = document.querySelector('.gallery-btn.prev'), x = document.querySelector('.gallery-btn.next');
  if (p) p.onclick = () => go(idx() - 1);
  if (x) x.onclick = () => go(idx() + 1);
  t.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(idx() + 1); if (e.key === 'ArrowLeft') go(idx() - 1); });
}

function quote() {
  if (!sel || !sel.to) return null;
  const n = nightsBetween(sel.from, sel.to);
  const hasPrice = prop.price_unit === 'night' && Number(prop.price_ngn) > 0;
  return { n, total: hasPrice ? n * Number(prop.price_ngn) : null };
}

function boxHtml() {
  const pr = priceParts(prop);
  const sale = isSale(prop.kind);
  const price = `<div class="price" style="margin-bottom:4px">${esc(pr.main)}${pr.unit ? `<small>${esc(pr.unit)}</small>` : ''}</div>`;
  if (sale) {
    return `<div class="book-box">${price}<p class="muted" style="margin:6px 0 16px">Want to see it? Mo will take you round. Inspections run on set days and slots.</p>
      <button class="btn btn-primary btn-block" type="button" id="inspect">Request an inspection</button>
      <a class="btn btn-wa btn-block" style="margin-top:10px" data-wa target="_blank" rel="noopener" href="#">${icon('wa')}Ask Mo on WhatsApp</a></div>`;
  }
  const min = prop.min_nights || 1;
  return `<div class="book-box" id="avail">${price}
    <p class="muted" style="margin:0 0 14px;font-size:.88rem">${min > 1 ? `Minimum ${min} nights. ` : ''}Check-in from ${esc(fmtTime(prop.check_in))}, check-out by ${esc(fmtTime(prop.check_out))}.</p>
    <div id="cal"></div><div id="quote"></div>
    <button class="btn btn-primary btn-block" type="button" id="book" style="margin-top:14px">Request to book</button>
    <p class="hint" style="margin:10px 0 0;text-align:center">Nothing to pay now. Mo confirms on WhatsApp.</p></div>`;
}

function quoteHtml() {
  const q = quote();
  if (!q) return '<p class="muted center" style="margin:14px 0 0;font-size:.9rem">Tap your check-in day, then your check-out day.</p>';
  return `<div class="summary"><div><span>Dates</span><span>${esc(fmtRange(sel.from, sel.to))}</span></div>${q.total != null ? `<div><span>${ngn(prop.price_ngn)} x ${q.n} night${q.n === 1 ? '' : 's'}</span><span>${ngn(q.total)}</span></div><div class="total"><span>Total</span><span>${ngn(q.total)}</span></div>` : '<div class="total"><span>Price</span><span>Mo will confirm</span></div>'}</div>`;
}

function draw() {
  const sale = isSale(prop.kind);
  const eko = brandOf(prop.kind) === 'eko';
  const amen = (prop.amenities || []).map(a => `<li>${icon('check')}${esc(a)}</li>`).join('');
  const facts = sale
    ? `<div class="fact"><b>${esc(kindLabel(prop.kind))}</b><span>Type</span></div><div class="fact"><b>${esc(prop.area)}</b><span>Area</span></div>`
    : `<div class="fact"><b>${prop.bedrooms || '-'}</b><span>Bedrooms</span></div><div class="fact"><b>${prop.bathrooms || '-'}</b><span>Bathrooms</span></div><div class="fact"><b>${prop.max_guests || '-'}</b><span>Guests</span></div>`;
  const desc = String(prop.description || prop.summary || '').split(/\n{2,}/).filter(Boolean).map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('');
  const hasPin = typeof prop.lat === 'number' && typeof prop.lng === 'number';
  root.innerHTML = `<p style="margin:0 0 14px"><a href="${esc(href('properties.html', { kind: sale ? 'sale' : 'shortlet' }))}">&larr; ${sale ? 'All land and homes' : 'All shortlets'}</a></p>
  <div class="prop-top"><div>${gallery()}
    <p class="eyebrow" style="margin-top:22px">${eko ? 'EkoShortletWithMo' : 'Real Estate with Mo'}</p>
    <h1 class="prop-title" style="font-size:clamp(1.9rem,6vw,2.8rem)">${esc(prop.title)}</h1>
    <p class="muted" style="margin:0">${icon('pin', '')}<span style="vertical-align:middle"> ${esc(prop.area)}${prop.address ? ', ' + esc(prop.address) : ''}</span></p>
    <div class="facts">${facts}</div>
    <div class="prose">${desc}</div>
    ${amen ? `<h2 style="font-size:1.5rem;margin-top:1.4em">What is included</h2><ul class="amen">${amen}</ul>` : ''}
    ${hasPin ? `<h2 style="font-size:1.5rem">Location</h2><div class="map" id="pmap"></div><p class="hint" style="margin-top:8px">The exact address is shared once Mo confirms. <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${prop.lat},${prop.lng}">Open in Google Maps</a></p>` : ''}
  </div><aside class="prop-side">${boxHtml()}</aside></div>
  <div class="sticky-cta"><span class="price">${esc(priceLabel(prop))}</span><button class="btn btn-primary" type="button" id="cta">${sale ? 'Request inspection' : 'Request to book'}</button></div>`;
  document.body.classList.add('has-cta');
  setWhatsApp(settings, `Hello Mo, I am interested in ${prop.title}.`);
  document.querySelectorAll('[data-wa]').forEach(a => { a.href = waUrl(settings, `Hello Mo, I am interested in ${prop.title}.`); });
  wireGallery();
  if (sale) {
    document.getElementById('inspect').onclick = openInspect;
    document.getElementById('cta').onclick = openInspect;
  } else {
    const q = document.getElementById('quote'); q.innerHTML = quoteHtml();
    cal = renderCalendar(document.getElementById('cal'), {
      mode: 'select', minDate: todayLagos(), maxDate: addDays(todayLagos(), (settings && settings.max_advance_days) || 365), ranges: ranges(), selected: sel,
      onSelect: s => { sel = s; q.innerHTML = quoteHtml(); }
    });
    const start = () => {
      if (!sel || !sel.to) { toast('Pick your check-in and check-out dates.', 'err'); document.getElementById('avail').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      openBook();
    };
    document.getElementById('book').onclick = start;
    document.getElementById('cta').onclick = start;
  }
  if (hasPin) lazyMap();
}

function lazyMap() {
  const el = document.getElementById('pmap');
  const run = async () => {
    const m = await mountMap(el, { center: [prop.lat, prop.lng], zoom: 14 });
    if (!m) return;
    const mk = [{ id: prop.id, lat: prop.lat, lng: prop.lng, title: prop.title, price_label: priceLabel(prop) }];
    setMarkers(m, mk); fitTo(m, mk);
  };
  if (!('IntersectionObserver' in window)) return run();
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); run(); } }, { rootMargin: '300px' });
  io.observe(el);
}

function formFields(extra = '') {
  return `${extra}<div class="field"><label for="fn">Your name</label><input class="input" id="fn" autocomplete="name" maxlength="80"></div>
    <div class="field"><label for="fp">Phone (WhatsApp)</label><input class="input" id="fp" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567"></div>
    <div class="field"><label for="ft">Anything Mo should know? (optional)</label><textarea class="textarea" id="ft" maxlength="600"></textarea></div>
    <input class="hp" id="fw" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="form-err" id="fe" hidden></div>`;
}

function wireSubmit(d, label, build, afterFail) {
  const form = d.querySelector('form'), err = d.querySelector('#fe'), btn = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const bad = m => { err.textContent = m; err.hidden = false; };
    err.hidden = true;
    const name = d.querySelector('#fn').value.trim(), phone = d.querySelector('#fp').value.trim();
    const body = build();
    if (typeof body === 'string') return bad(body);
    if (!name) return bad('Add your name.');
    if (!phone) return bad('Add a phone number we can reach you on WhatsApp.');
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      const r = await api('create_booking', { ...body, property_id: prop.id, name, phone, note: d.querySelector('#ft').value.trim(), share_code: shareCode || undefined, website: d.querySelector('#fw').value });
      stashBooking(r, phone);
      location.href = href('booked.html', { ref: r.booking.ref });
    } catch (x) {
      bad(errMsg(x)); btn.disabled = false; btn.textContent = label;
      if (afterFail) afterFail(x);
    }
  });
}

function openBook() {
  const max = prop.max_guests || 12, min = prop.min_nights || 1, q = quote();
  if (q.n < min) return toast(`This place needs at least ${min} nights.`, 'err');
  const maxN = (settings && settings.max_nights) || 30;
  if (q.n > maxN) return toast(`Stays over ${maxN} nights are arranged on WhatsApp.`, 'err');
  const hold = (settings && settings.hold_hours) || 24;
  const d = openSheet(`<form novalidate>
    <div class="summary"><div><span>Place</span><span>${esc(prop.title)}</span></div><div><span>Dates</span><span>${esc(fmtRange(sel.from, sel.to))}</span></div>${q.total != null ? `<div class="total"><span>Total</span><span>${ngn(q.total)}</span></div>` : ''}</div>
    <div class="field"><span class="lab">Guests</span><div class="stepper" role="group" aria-label="Guests"><button type="button" id="gm" aria-label="Fewer guests">&minus;</button><output id="gv" aria-live="polite">${guests}</output><button type="button" id="gp" aria-label="More guests">+</button></div><span class="hint" style="margin:4px 0 0">Sleeps up to ${max}.</span></div>
    ${formFields()}
    <p class="hint">Mo holds these dates for ${hold} hours while she confirms. You pay nothing now.</p>
    <button class="btn btn-primary btn-block" type="submit">Send request</button></form>`, { title: 'Request to book' });
  const gv = d.querySelector('#gv'), gm = d.querySelector('#gm'), gp = d.querySelector('#gp');
  const upd = () => { gv.textContent = guests; gm.disabled = guests <= 1; gp.disabled = guests >= max; };
  gm.onclick = () => { guests--; upd(); }; gp.onclick = () => { guests++; upd(); }; upd();
  wireSubmit(d, 'Send request', () => ({ kind: 'stay', check_in: sel.from, check_out: sel.to, guests }), async x => {
    if (/no longer free/.test(errMsg(x))) {
      try { const r = await api('property', { id: prop.id }); prop = r.property; sel = null; closeSheet(); draw(); toast('Those dates were just taken. Pick different dates.', 'err'); } catch (e) { /* keep the sheet */ }
    }
  });
}

function openInspect() {
  const dates = allowedDates(settings && settings.inspection_days);
  const slots = settings && settings.inspection_slots && settings.inspection_slots.length ? settings.inspection_slots : ['10:00', '12:00', '14:00', '16:00'];
  const d = openSheet(`<form novalidate><p class="muted" style="margin-top:0">${esc(prop.title)}. Pick a day and time and Mo will confirm on WhatsApp.</p>
    <div id="sp">${slotPickerHtml(dates, slots)}</div>${formFields()}<button class="btn btn-primary btn-block" type="submit">Request inspection</button></form>`, { title: 'Request an inspection' });
  const pick = bindSlotPicker(d.querySelector('#sp'));
  wireSubmit(d, 'Request inspection', () => { const s = pick.get(); return !s.date || !s.time ? 'Pick a date and time slot.' : { kind: 'inspection', slot_date: s.date, slot_time: s.time }; });
}

load();
