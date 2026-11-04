import { esc } from './format.js?v=202611040820';

const CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const LAGOS = [6.45, 3.47];

let loading = null;

/* Loads Leaflet 1.9.4 once, on first use. */
export function loadMap() {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = CSS; l.integrity = CSS_SRI; l.crossOrigin = '';
    document.head.appendChild(l);
    const s = document.createElement('script');
    s.src = JS; s.integrity = JS_SRI; s.crossOrigin = ''; s.async = true;
    s.onload = () => resolve(window.L);
    s.onerror = () => { loading = null; reject(new Error('The map could not load. Check your signal.')); };
    document.head.appendChild(s);
  });
  return loading;
}

const pinIcon = () => window.L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });

export async function mountMap(el, { center = LAGOS, zoom = 11 } = {}) {
  let L;
  try { L = await loadMap(); } catch (e) {
    el.innerHTML = `<div class="map-fallback">${esc(e.message)}</div>`;
    return null;
  }
  el.innerHTML = '';
  const map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView(center, zoom);
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(map);
  map._rmLayer = L.layerGroup().addTo(map);
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

export function setMarkers(map, markers = []) {
  if (!map || !window.L) return [];
  const L = window.L;
  map._rmLayer.clearLayers();
  const out = [];
  markers.forEach(m => {
    if (typeof m.lat !== 'number' || typeof m.lng !== 'number') return;
    const mk = L.marker([m.lat, m.lng], { icon: pinIcon(), title: m.title || '', keyboard: true });
    const pop = `<div class="map-pop"><b>${esc(m.title || '')}</b>${m.price_label ? `<span>${esc(m.price_label)}</span>` : ''}${m.href ? `<br><a href="${esc(m.href)}">View</a>` : ''}</div>`;
    mk.bindPopup(pop);
    mk.addTo(map._rmLayer);
    out.push(mk);
  });
  return out;
}

export function fitTo(map, markers = []) {
  if (!map || !window.L) return;
  const pts = markers.filter(m => typeof m.lat === 'number' && typeof m.lng === 'number').map(m => [m.lat, m.lng]);
  map.invalidateSize();
  if (!pts.length) { map.setView(LAGOS, 11); return; }
  if (pts.length === 1) { map.setView(pts[0], 14); return; }
  map.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
}

/* Tap the map to drop a pin. Returns { map, setPoint(lat, lng) }. */
export async function pickOnMap(el, { lat, lng, onPick } = {}) {
  const has = typeof lat === 'number' && typeof lng === 'number';
  const map = await mountMap(el, { center: has ? [lat, lng] : LAGOS, zoom: has ? 15 : 11 });
  if (!map) return null;
  const L = window.L;
  let mk = null;
  const put = (a, b) => {
    if (mk) mk.setLatLng([a, b]); else mk = L.marker([a, b], { icon: pinIcon(), draggable: true }).addTo(map);
    mk.off('dragend').on('dragend', () => { const p = mk.getLatLng(); onPick && onPick(+p.lat.toFixed(6), +p.lng.toFixed(6)); });
  };
  if (has) put(lat, lng);
  map.on('click', e => { const a = +e.latlng.lat.toFixed(6), b = +e.latlng.lng.toFixed(6); put(a, b); onPick && onPick(a, b); });
  return { map, setPoint(a, b) { put(a, b); map.setView([a, b], 15); } };
}
