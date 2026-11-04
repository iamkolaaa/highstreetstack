import { BRAND } from './config.js?v=202611040819';
import { esc, href, photoSrc, priceParts, kindLabel, brandOf, waUrl, isSale, todayLagos, addDays, weekday, fmtDay } from './format.js?v=202611040819';

/* icons: 24px stroke set, returned as inline SVG strings */
const P = {
  bed: 'M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5h.01',
  bath: 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 12V6a2 2 0 0 1 3.5-1.3M7 19l-1 2M17 19l1 2',
  users: 'M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM4 10h16M8 3v4M16 3v4',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14ZM20 20l-4-4',
  chat: 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  home: 'M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6',
  chart: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3Z',
  car: 'M5 16v-4l2-5h10l2 5v4M3 16h18M7.5 16v2M16.5 16v2M7 12h10',
  boat: 'M3 17l2 3h14l2-3H3ZM12 4v10M12 5l6 8h-6M12 8L7 13h5',
  wave: 'M3 9c2 0 2-2 4.5-2S10 9 12 9s2.5-2 4.5-2S19 9 21 9M3 15c2 0 2-2 4.5-2S10 15 12 15s2.5-2 4.5-2S19 15 21 15',
  key: 'M8 15a4 4 0 1 1 3.9-4.9H21v3h-2v2h-3v-2h-4.1A4 4 0 0 1 8 15Z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  hammer: 'M14 6l4 4-8 8H6v-4l8-8ZM13 7l4 4M4 21h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17.5 6.5h.01',
  tiktok: 'M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.3 2.5 2 4.2 5 4.4',
  facebook: 'M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.7 1.8-1.7H18V3c-.4 0-1.6-.2-2.8-.2-2.8 0-4.2 1.7-4.2 4.4v2.3H8V13h3v8h3Z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14'
};
export function icon(name, cls = '') {
  if (name === 'wa') return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-3-1.1-5-4.1-5.1-4.3-.2-.2-1.2-1.6-1.2-3s.8-2.1 1-2.4c.3-.3.6-.3.8-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1 1 2 1.3 2.3 1.4.3.2.4.1.6-.1l.7-.9c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.4 0 .2 0 .8-.2 1.4Z"/></svg>`;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[name] || P.check}"/></svg>`;
}

/* toasts */
export function toast(msg, kind = '') {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, kind === 'err' ? 5200 : 3200);
}

/* bottom sheet */
let current = null;
export function openSheet(html, { title = '', onClose } = {}) {
  closeSheet();
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.innerHTML = `<div class="sheet-grip"></div><div class="sheet-in"><div class="sheet-h"><h2>${esc(title)}</h2><button type="button" class="sheet-x" aria-label="Close" data-close>&times;</button></div><div class="sheet-body">${html}</div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) closeSheet(); });
  d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
  d._onClose = onClose;
  current = d;
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  return d;
}
export function closeSheet() {
  const d = current;
  if (!d) return;
  current = null;
  try { d.close(); } catch (e) { d.removeAttribute('open'); }
  d.remove();
  if (d._onClose) d._onClose();
}

export function confirmSheet(text, { ok = 'Confirm', danger = false, title = 'Are you sure?' } = {}) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const d = openSheet(`<p>${esc(text)}</p><div class="row2"><button class="btn btn-outline" data-no type="button">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes type="button">${esc(ok)}</button></div>`, { title, onClose: () => finish(false) });
    d.querySelector('[data-yes]').onclick = () => { finish(true); closeSheet(); };
    d.querySelector('[data-no]').onclick = () => closeSheet();
  });
}

export const skeleton = (n = 3) => Array.from({ length: n }, () => '<div class="skeleton" aria-hidden="true"></div>').join('');

export async function copy(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* fall through */ }
  try {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  } catch (e) { return false; }
}

/* public chrome */
export function renderHeader(active = '') {
  const cur = k => (active === k ? ' aria-current="page"' : '');
  const links = `<a href="${href('index.html')}"${cur('home')}>Home</a>
    <a href="${href('properties.html', { kind: 'shortlet' })}"${cur('stay')}>Shortlets</a>
    <a href="${href('properties.html', { kind: 'sale' })}"${cur('buy')}>Land and homes</a>
    <a href="${href('index.html')}#about">About Mo</a>`;
  const drawer = links + `<a href="${href('index.html')}#consult" data-consult>Book a consultation</a>`;
  return `<a class="skip" href="#main">Skip to content</a>
  <header class="hdr"><div class="hdr-in">
    <a class="brand" href="${href('index.html')}" aria-label="${esc(BRAND.name)} home"><img src="assets/icon.svg" alt="" width="30" height="30"><span><b>Real Estate with Mo</b></span></a>
    <nav class="nav" aria-label="Main">${links}</nav>
    <div class="hdr-cta"><a class="btn btn-primary btn-sm" href="${href('index.html')}#consult" data-consult><span class="long">Book a consultation</span><span class="short">Book a call</span></a>
      <button class="menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="drawer">${icon('menu')}</button></div>
  </div><nav class="nav-drawer" id="drawer" aria-label="Menu">${drawer}</nav></header>`;
}

export function renderFooter() {
  return `<footer class="ftr"><div class="wrap"><div class="ftr-grid">
    <div><a class="brand" href="${href('index.html')}"><img src="assets/icon.svg" alt="" width="30" height="30"><span><b>Real Estate with Mo</b><small>Lagos</small></span></a>
      <p style="margin-top:14px;max-width:38ch">Verified land, homes and shortlets in Lagos, with Mo from first call to keys. A sister brand, ${esc(BRAND.sub)}, runs the shortlets.</p></div>
    <div><h4>Explore</h4><a href="${href('properties.html', { kind: 'shortlet' })}">Shortlets</a><a href="${href('properties.html', { kind: 'sale' })}">Land and homes for sale</a><a href="${href('index.html')}#consult">Book a consultation</a><a href="${href('privacy.html')}">Privacy</a></div>
    <div><h4>Follow</h4><a href="${esc(BRAND.instagram)}" rel="noopener" target="_blank">Instagram, RealEstateWithMo</a><a href="${esc(BRAND.instagram_eko)}" rel="noopener" target="_blank">Instagram, EkoShortlets</a><a href="${esc(BRAND.tiktok)}" rel="noopener" target="_blank">TikTok</a><a href="${esc(BRAND.facebook)}" rel="noopener" target="_blank">Facebook</a></div>
  </div><p class="legal">&copy; ${new Date().getFullYear()} ${esc(BRAND.name)}. Prices are in naira and can change.</p></div></footer>`;
}

/* Fill #hdr and #ftr, add the WhatsApp button, wire the menu. Call once per page. */
export function mountChrome(active, settings) {
  const h = document.getElementById('hdr');
  if (h) h.innerHTML = renderHeader(active);
  const f = document.getElementById('ftr');
  if (f) f.innerHTML = renderFooter();
  if (!document.querySelector('.wa-float')) {
    const a = document.createElement('a');
    a.className = 'wa-float'; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Message Mo on WhatsApp');
    a.innerHTML = icon('wa');
    document.body.appendChild(a);
  }
  setWhatsApp(settings);
  const btn = document.querySelector('.menu-btn'), dr = document.getElementById('drawer');
  if (btn && dr) btn.onclick = () => { const o = dr.classList.toggle('open'); btn.setAttribute('aria-expanded', String(o)); };
}
export function setWhatsApp(settings, text = 'Hello Mo, I found you on your website.') {
  const u = waUrl(settings, text);
  document.querySelectorAll('.wa-float, [data-wa]').forEach(a => { if (!a.hasAttribute('data-wa-text')) a.href = u; });
}

/* property card, shared by home, list, share */
export function propertyCard(p, { link, available, dates } = {}) {
  const pr = priceParts(p);
  const sale = isSale(p.kind);
  const to = link || href('property.html', { id: p.id, in: dates && dates.in, out: dates && dates.out });
  const img = p.cover ? `<img src="${esc(photoSrc(p.cover, 800))}" alt="" loading="lazy" decoding="async">` : '';
  const meta = sale
    ? `<span>${icon('pin')}${esc(p.area)}</span>`
    : `<span>${icon('pin')}${esc(p.area)}</span>${p.bedrooms ? `<span>${icon('bed')}${p.bedrooms} bed</span>` : ''}${p.max_guests ? `<span>${icon('users')}${p.max_guests} guests</span>` : ''}`;
  let av = '';
  if (available === true) av = `<span class="avail yes">${dates && dates.in ? 'Free for your dates' : 'Available'}</span>`;
  else if (available === false) av = '<span class="avail no">Booked for those dates</span>';
  return `<a class="card${available === false ? ' dim' : ''}" href="${esc(to)}">
    <div class="card-media">${img}<span class="badge badge-kind">${brandOf(p.kind) === 'eko' ? 'Shortlet' : esc(kindLabel(p.kind))}</span></div>
    <div class="card-body"><h3>${esc(p.title)}</h3><div class="card-meta">${meta}</div>
    <div class="card-foot"><span class="price">${esc(pr.main)}${pr.unit ? `<small>${esc(pr.unit)}</small>` : ''}</span>${av}</div></div></a>`;
}

/* gentle scroll reveal, skipped for reduced motion */
export function reveal(root = document) {
  const els = root.querySelectorAll('.rv:not(.in)');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}

/* day and time slot picker (inspections, consultations) */
export function allowedDates(days, { count = 14, horizon = 90 } = {}) {
  const list = Array.isArray(days) && days.length ? days.map(Number) : [1, 2, 3, 4, 5];
  const out = [];
  const t = todayLagos();
  for (let i = 1; i <= horizon && out.length < count; i++) {
    const d = addDays(t, i);
    if (list.includes(weekday(d))) out.push(d);
  }
  return out;
}
export function slotPickerHtml(dates, slots) {
  const tm = t => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
  return `<div class="field"><span class="lab">Pick a day</span><div class="chips" role="group" aria-label="Day">${dates.map(d => `<button type="button" class="chip" data-date="${d}" aria-pressed="false">${esc(fmtDay(d))}</button>`).join('')}</div></div>
  <div class="field"><span class="lab">Pick a time (Lagos time)</span><div class="slots" role="group" aria-label="Time">${slots.map(t => `<button type="button" class="chip" data-time="${esc(t)}" aria-pressed="false">${esc(tm(t))}</button>`).join('')}</div></div>`;
}
export function bindSlotPicker(root) {
  const st = { date: '', time: '' };
  root.addEventListener('click', e => {
    const a = e.target.closest('[data-date]'), b = e.target.closest('[data-time]');
    if (a) { st.date = a.dataset.date; root.querySelectorAll('[data-date]').forEach(x => x.setAttribute('aria-pressed', String(x === a))); }
    if (b) { st.time = b.dataset.time; root.querySelectorAll('[data-time]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
  });
  return { get: () => ({ ...st }) };
}

/* keep a fresh booking reply for the booked page (the phone stays in this browser tab only) */
export function stashBooking(reply, phone) {
  try { sessionStorage.setItem('rm_booked_' + reply.booking.ref, JSON.stringify({ ...reply, phone })); } catch (e) { /* private mode */ }
}
export function stashedBooking(ref) {
  try { return JSON.parse(sessionStorage.getItem('rm_booked_' + ref) || 'null'); } catch (e) { return null; }
}
