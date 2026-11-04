import { api, errMsg } from './api.js?v=202611040820';
import { BRAND } from './config.js?v=202611040820';
import { esc, href, todayLagos, addDays, waUrl, param, photoSrc } from './format.js?v=202611040820';
import { mountChrome, setWhatsApp, openSheet, toast, propertyCard, skeleton, icon, reveal, allowedDates, slotPickerHtml, bindSlotPicker, stashBooking } from './ui.js?v=202611040820';

/* a short link like /?s=K7M3QX goes straight to the share page */
const code = param('s');
if (code) location.replace(href('share.html', { s: code }));

mountChrome('home');

let settings = null;
document.querySelectorAll('[data-wa-text]').forEach(a => { a.href = waUrl(null, a.dataset.waText); });
const sitePromise = api('site');

/* stats, extras and socials come from config so there is one source for the facts */
document.getElementById('stats').innerHTML = BRAND.stats.map(([n, l]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('');
document.getElementById('ekoList').innerHTML = [['home', 'Apartments'], ['wave', 'Beach houses'], ['shield', 'Personal security'], ['car', 'Car rental'], ['boat', 'Boat cruise'], ['wave', 'Jet ski']]
  .map(([i, t]) => `<li>${icon(i)}${esc(t)}</li>`).join('');
document.getElementById('socials').innerHTML = [
  ['instagram', 'RealEstateWithMo', BRAND.instagram], ['instagram', 'EkoShortlets', BRAND.instagram_eko], ['tiktok', 'TikTok', BRAND.tiktok], ['facebook', 'Facebook', BRAND.facebook]
].map(([i, t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${icon(i)}${esc(t)}</a>`).join('');

/* quick search */
const qIn = document.getElementById('qIn'), qOut = document.getElementById('qOut'), qG = document.getElementById('qGuests');
const today = todayLagos();
qIn.min = today; qOut.min = addDays(today, 1);
for (let i = 1; i <= 10; i++) qG.insertAdjacentHTML('beforeend', `<option value="${i}">${i} guest${i === 1 ? '' : 's'}</option>`);
qIn.addEventListener('change', () => {
  if (!qIn.value) return;
  qOut.min = addDays(qIn.value, 1);
  if (!qOut.value || qOut.value <= qIn.value) qOut.value = addDays(qIn.value, 2);
});
document.getElementById('quick').addEventListener('submit', e => {
  e.preventDefault();
  if (!!qIn.value !== !!qOut.value) return toast('Pick your check-in and check-out dates.', 'err');
  if (qIn.value && qOut.value <= qIn.value) return toast('Pick a check-out date after the check-in date.', 'err');
  location.href = href('properties.html', { kind: 'shortlet', in: qIn.value, out: qOut.value, guests: qG.value });
});

/* live data */
const featured = document.getElementById('featured'), listings = document.getElementById('listings');
featured.innerHTML = skeleton(3);
listings.innerHTML = skeleton(3);

sitePromise.then(r => {
  settings = r.settings;
  setWhatsApp(settings);
  document.querySelectorAll('[data-wa-text]').forEach(a => { a.href = waUrl(settings, a.dataset.waText); });
  featured.innerHTML = r.featured.length ? r.featured.map(p => propertyCard(p)).join('') : '<div class="empty"><h3>New stays are coming</h3><p>Message Mo for what is free right now.</p></div>';
  listings.innerHTML = r.listings.length ? r.listings.map(p => propertyCard(p)).join('') : '<div class="empty" style="grid-column:1/-1"><h3>Listings are being updated</h3><p>Message Mo for the latest land and homes.</p></div>';
  const c = r.counts || {};
  document.getElementById('kinds').innerHTML = [['shortlet', 'Shortlets'], ['land', 'Land'], ['residential', 'Residential'], ['commercial', 'Commercial']]
    .map(([k, l]) => `<a class="chip" href="${esc(href('properties.html', { kind: k }))}">${esc(l)}${c[k] != null ? ` (${c[k]})` : ''}</a>`).join('');
  const first = r.featured[0] && r.featured[0].cover;
  if (first) {
    const bg = document.getElementById('heroBg');
    const img = new Image();
    img.onload = () => { bg.style.backgroundImage = `url("${img.src}")`; bg.classList.add('on'); };
    img.src = photoSrc(first, 1600);
  }
  reveal();
  if (location.hash === '#consult') openConsult();
}).catch(e => {
  const msg = `<div class="empty" style="grid-column:1/-1"><h3>Could not load listings</h3><p>${esc(errMsg(e))}</p></div>`;
  featured.innerHTML = msg; listings.innerHTML = msg;
});
reveal();

/* consultation sheet */
async function openConsult() {
  if (!settings) { try { settings = (await sitePromise).settings; } catch (e) { return toast(errMsg(e), 'err'); } }
  const dates = allowedDates(settings.consult_days);
  const slots = settings.consult_slots && settings.consult_slots.length ? settings.consult_slots : ['10:00', '12:00', '15:00', '17:00'];
  const d = openSheet(`<form id="cf" novalidate>
    <p class="muted" style="margin-top:0">Free. Pick a time and Mo will confirm it on WhatsApp.</p>
    <div class="field"><span class="lab">How would you like to talk?</span><div class="chips" id="cm"><button type="button" class="chip" data-mode="online" aria-pressed="true">Online call</button><button type="button" class="chip" data-mode="in_person" aria-pressed="false">In person</button></div></div>
    <div id="cs">${slotPickerHtml(dates, slots)}</div>
    <div class="field"><label for="cn">Your name</label><input class="input" id="cn" autocomplete="name" maxlength="80"></div>
    <div class="field"><label for="cp">Phone (WhatsApp)</label><input class="input" id="cp" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567"></div>
    <div class="field"><label for="ct">What would you like to talk about? (optional)</label><textarea class="textarea" id="ct" maxlength="600" placeholder="Buying land, a shortlet to let, a building project"></textarea></div>
    <input class="hp" name="website" id="cw" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="form-err" id="ce" hidden></div>
    <button class="btn btn-primary btn-block" type="submit">Request this time</button></form>`, { title: 'Book a consultation' });
  let mode = 'online';
  d.querySelector('#cm').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode;
    d.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  const pick = bindSlotPicker(d.querySelector('#cs'));
  const form = d.querySelector('#cf'), err = d.querySelector('#ce'), btn = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const s = pick.get(), name = d.querySelector('#cn').value.trim(), phone = d.querySelector('#cp').value.trim();
    const fail = m => { err.textContent = m; err.hidden = false; };
    err.hidden = true;
    if (!s.date || !s.time) return fail('Pick a date and time slot.');
    if (!name) return fail('Add your name.');
    if (!phone) return fail('Add a phone number we can reach you on WhatsApp.');
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      const r = await api('create_booking', { kind: 'consultation', mode, slot_date: s.date, slot_time: s.time, name, phone, note: d.querySelector('#ct').value.trim(), website: d.querySelector('#cw').value });
      stashBooking(r, phone);
      location.href = href('booked.html', { ref: r.booking.ref });
    } catch (x) {
      fail(errMsg(x)); btn.disabled = false; btn.textContent = 'Request this time';
    }
  });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-consult]');
  if (!t) return;
  e.preventDefault();
  const dr = document.getElementById('drawer');
  if (dr) dr.classList.remove('open');
  openConsult();
});
window.addEventListener('hashchange', () => { if (location.hash === '#consult') openConsult(); });
