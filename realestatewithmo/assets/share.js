import { api, errMsg } from './api.js?v=202611040820';
import { esc, href, param, priceLabel, priceParts, fmtRange, photoSrc, isSale, kindLabel, waUrl } from './format.js?v=202611040820';
import { mountChrome, setWhatsApp, propertyCard, icon, reveal } from './ui.js?v=202611040820';
import { mountMap, setMarkers, fitTo } from './map.js?v=202611040820';

mountChrome('');
const root = document.getElementById('root');
const code = param('s');

function problem(msg) {
  const wa = waUrl(null, 'Hello Mo, my link has expired. Could you send me a fresh one?');
  root.innerHTML = `<div class="empty" style="margin-top:20px"><h3>${esc(msg)}</h3><p><a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(wa)}">${icon('wa')}Message Mo</a></p><p><a href="${esc(href('properties.html'))}">Or browse everything</a></p></div>`;
}

async function init() {
  if (!code) return problem('This link has expired. Message Mo for a fresh one.');
  let r;
  try { r = await api('share', { code }); } catch (e) { return problem(errMsg(e)); }
  const { share, featured: f, picks, settings } = r;
  setWhatsApp(settings, `Hello Mo, I am looking at the place you picked for me: ${f.title}.`);
  const dates = share.check_in && share.check_out ? { in: share.check_in, out: share.check_out } : null;
  const link = p => href('property.html', { id: p.id, in: dates && dates.in, out: dates && dates.out, share: code });
  const pr = priceParts(f);
  const sale = isSale(f.kind);
  const av = dates && typeof f.available === 'boolean'
    ? (f.available ? `<span class="badge badge-ok">Free for your dates</span>` : `<span class="badge badge-no">Now booked for those dates</span>`) : '';
  const meta = sale
    ? `<span>${icon('pin')}${esc(f.area)}</span><span>${esc(kindLabel(f.kind))}</span>`
    : `<span>${icon('pin')}${esc(f.area)}</span>${f.bedrooms ? `<span>${icon('bed')}${f.bedrooms} bed</span>` : ''}${f.bathrooms ? `<span>${icon('bath')}${f.bathrooms} bath</span>` : ''}${f.max_guests ? `<span>${icon('users')}${f.max_guests} guests</span>` : ''}`;
  const img = f.cover ? `<img src="${esc(photoSrc(f.cover, 1200))}" alt="${esc(f.title)}" fetchpriority="high" decoding="async">` : '';
  const others = picks.filter(p => p.id !== f.id);
  const all = [f, ...others];
  const everythingKind = sale ? 'sale' : 'shortlet';
  document.title = `Picked for you | Real Estate with Mo`;
  root.innerHTML = `<div class="wrap-narrow" style="padding:0;max-width:760px">
    <p class="eyebrow">${share.client_name ? 'For ' + esc(share.client_name) : 'Just for you'}</p>
    <h1 style="font-size:clamp(2rem,8vw,3.2rem)">Mo picked this <em class="gold">for you</em></h1>
    ${dates ? `<p class="muted">Your dates: <b style="color:var(--ink)">${esc(fmtRange(dates.in, dates.out))}</b></p>` : ''}
    ${share.note ? `<div class="note-card"><p>${esc(share.note)}</p><div class="by"><img src="assets/mo.jpg" alt="" width="36" height="36"><span>Mo</span></div></div>` : ''}
    <article class="feat rv"><div class="card-media">${img}<span class="badge badge-kind">${sale ? esc(kindLabel(f.kind)) : 'Shortlet'}</span>${av ? `<span class="r" style="position:absolute;top:12px;right:12px">${av}</span>` : ''}</div>
      <div class="feat-body"><h2 style="font-size:1.8rem;margin-bottom:.2em">${esc(f.title)}</h2><div class="card-meta">${meta}</div>
        ${f.summary ? `<p class="muted">${esc(f.summary)}</p>` : ''}
        <p class="price" style="font-size:1.6rem;margin:6px 0 16px">${esc(pr.main)}${pr.unit ? `<small>${esc(pr.unit)}</small>` : ''}</p>
        <a class="btn btn-primary btn-block" href="${esc(link(f))}">${sale ? 'See details and book a visit' : 'See photos and book'}</a>
        <a class="btn btn-wa btn-block" style="margin-top:10px" data-wa target="_blank" rel="noopener" href="#">${icon('wa')}Ask Mo a question</a></div></article></div>
    ${others.length ? `<section style="margin-top:56px"><div class="sec-head rv"><div><p class="eyebrow">More from Mo</p><h2 class="section-title">Mo's other <em>picks</em></h2></div></div><div class="grid rv" id="picks">${others.map(p => propertyCard(p, { link: link(p), available: dates ? p.available : undefined, dates })).join('')}</div></section>` : ''}
    <section style="margin-top:56px"><div class="sec-head rv"><div><p class="eyebrow">Where they are</p><h2 class="section-title">On the <em>map</em></h2></div></div><div class="map rv" id="smap"></div></section>
    <section class="center rv" style="margin-top:56px"><a class="btn btn-outline" href="${esc(href('properties.html', { kind: everythingKind, in: dates && dates.in, out: dates && dates.out }))}">See everything available</a></section>`;
  document.querySelectorAll('[data-wa]').forEach(a => { a.href = waUrl(settings, `Hello Mo, I am looking at the place you picked for me: ${f.title}.`); });
  reveal();
  const pins = all.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number').map(p => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.title, price_label: priceLabel(p), href: link(p) }));
  const el = document.getElementById('smap');
  if (!pins.length) { el.parentElement.remove(); return; }
  const run = async () => { const m = await mountMap(el); if (m) { setMarkers(m, pins); fitTo(m, pins); } };
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); run(); } }, { rootMargin: '300px' }); io.observe(el); } else run();
}
init();
