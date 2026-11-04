import { api, errMsg } from './api.js?v=202611040819';
import { AREAS } from './config.js?v=202611040819';
import { esc, href, param, todayLagos, addDays, priceLabel } from './format.js?v=202611040819';
import { mountChrome, setWhatsApp, toast, propertyCard, skeleton } from './ui.js?v=202611040819';
import { mountMap, setMarkers, fitTo } from './map.js?v=202611040819';

mountChrome('');

const KINDS = [['', 'All'], ['shortlet', 'Shortlets'], ['sale', 'For sale'], ['land', 'Land'], ['residential', 'Residential'], ['commercial', 'Commercial']];
const $ = id => document.getElementById(id);
const chipsEl = $('kindChips'), fArea = $('fArea'), fGuests = $('fGuests'), fIn = $('fIn'), fOut = $('fOut');
const results = $('results'), countEl = $('count');

const st = { kind: param('kind'), area: param('area'), guests: param('guests'), in: param('in'), out: param('out'), view: param('view') === 'map' ? 'map' : 'list' };
if (!KINDS.some(k => k[0] === st.kind)) st.kind = '';

const today = todayLagos();
fIn.min = today; fOut.min = addDays(today, 1);
AREAS.forEach(a => fArea.insertAdjacentHTML('beforeend', `<option>${esc(a)}</option>`));
for (let i = 1; i <= 12; i++) fGuests.insertAdjacentHTML('beforeend', `<option value="${i}">${i}+ guest${i === 1 ? '' : 's'}</option>`);
fArea.value = st.area; fGuests.value = st.guests; fIn.value = st.in; fOut.value = st.out;
chipsEl.innerHTML = KINDS.map(([k, l]) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="${st.kind === k}">${esc(l)}</button>`).join('');

let map = null, items = [], seq = 0;

function syncUrl() {
  const q = new URLSearchParams();
  Object.entries(st).forEach(([k, v]) => { if (v && !(k === 'view' && v === 'list')) q.set(k, v); });
  try { if (new URLSearchParams(location.search).has('mock')) q.set('mock', ''); } catch (e) { /* ignore */ }
  const s = q.toString().replace(/mock=(&|$)/, 'mock$1');
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

async function load() {
  const my = ++seq;
  syncUrl();
  const datesOk = st.in && st.out && st.out > st.in;
  const params = {};
  if (st.kind) params.kind = st.kind;
  if (st.area) params.area = st.area;
  if (st.guests) params.guests = Number(st.guests);
  if (datesOk) { params.check_in = st.in; params.check_out = st.out; }
  results.innerHTML = skeleton(3);
  countEl.textContent = 'Searching...';
  let r;
  try { r = await api('properties', params); } catch (e) {
    if (my !== seq) return;
    results.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Could not load properties</h3><p>${esc(errMsg(e))}</p></div>`;
    countEl.textContent = '';
    return;
  }
  if (my !== seq) return;
  setWhatsApp(r.settings);
  items = r.properties.slice();
  if (datesOk) items.sort((a, b) => (b.available === true) - (a.available === true));
  const free = datesOk ? items.filter(p => p.available).length : 0;
  countEl.textContent = items.length ? `${items.length} place${items.length === 1 ? '' : 's'}${datesOk ? `, ${free} free for your dates` : ''}` : '';
  results.innerHTML = items.length
    ? items.map(p => propertyCard(p, { available: datesOk ? p.available : undefined, dates: datesOk ? { in: st.in, out: st.out } : null })).join('')
    : '<div class="empty" style="grid-column:1/-1"><h3>Nothing matches yet</h3><p>Try other dates or clear a filter, or message Mo and she will find something for you.</p></div>';
  if (map) drawMarkers();
}

function drawMarkers() {
  const m = items.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number').map(p => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.title, price_label: priceLabel(p), href: href('property.html', { id: p.id, in: st.in, out: st.out }) }));
  setMarkers(map, m);
  fitTo(map, m);
  const miss = items.length - m.length;
  $('mapNote').textContent = miss > 0 ? `${miss} listing${miss === 1 ? '' : 's'} not on the map yet. They show in the list.` : '';
}

async function setView(v) {
  st.view = v;
  $('vList').setAttribute('aria-pressed', String(v === 'list'));
  $('vMap').setAttribute('aria-pressed', String(v === 'map'));
  $('mapWrap').hidden = v !== 'map';
  results.hidden = v === 'map';
  syncUrl();
  if (v === 'map') {
    if (!map) {
      map = await mountMap($('map'));
      if (!map) return;
    }
    drawMarkers();
  }
}

chipsEl.addEventListener('click', e => {
  const b = e.target.closest('[data-kind]');
  if (!b) return;
  st.kind = b.dataset.kind;
  chipsEl.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
  load();
});
fArea.onchange = () => { st.area = fArea.value; load(); };
fGuests.onchange = () => { st.guests = fGuests.value; load(); };
fIn.onchange = () => {
  st.in = fIn.value;
  if (st.in) {
    fOut.min = addDays(st.in, 1);
    if (!fOut.value || fOut.value <= st.in) { fOut.value = addDays(st.in, 2); st.out = fOut.value; }
  }
  load();
};
fOut.onchange = () => {
  if (fIn.value && fOut.value && fOut.value <= fIn.value) { toast('Pick a check-out date after the check-in date.', 'err'); fOut.value = ''; }
  st.out = fOut.value;
  load();
};
$('fClear').onclick = () => {
  Object.assign(st, { kind: '', area: '', guests: '', in: '', out: '' });
  fArea.value = ''; fGuests.value = ''; fIn.value = ''; fOut.value = '';
  chipsEl.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.kind === '')));
  load();
};
$('filters').addEventListener('submit', e => e.preventDefault());
$('vList').onclick = () => setView('list');
$('vMap').onclick = () => setView('map');

load().then(() => { if (st.view === 'map') setView('map'); });
