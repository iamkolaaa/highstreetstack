import { api, ApiError } from './api.js';
import { MOCK } from './config.js';

/* demo mode keeps its own keys so trying the demo never touches a real driver's session */
const P = MOCK ? 'ccdemo_' : 'cc_';

/* ---------- safe localStorage ---------- */
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
export { ls };

/* ---------- session: remembered check-in code + last resolve ---------- */
export const session = {
  getCode: () => ls.get(P + 'code', ''),
  setCode: c => ls.set(P + 'code', c),
  getCtx: () => ls.get(P + 'ctx', null),
  setCtx: c => ls.set(P + 'ctx', c),
  clear() { ls.del(P + 'code'); ls.del(P + 'ctx'); }
};

/* ---------- drafts (per kind + code + date) ---------- */
const dk = (kind, code, date) => `${P}draft_${kind}_${code}_${date}`;
export const drafts = {
  load: (kind, code, date) => ls.get(dk(kind, code, date)),
  save: (kind, code, date, state) => ls.set(dk(kind, code, date), state),
  clear: (kind, code, date) => ls.del(dk(kind, code, date))
};

/* ---------- local "done today" flags (so the tick shows when offline) ---------- */
export const doneFlags = {
  get: (code, date) => ls.get(`${P}done_${code}_${date}`, {}),
  mark(code, date, kind) { const d = this.get(code, date); d[kind] = true; ls.set(`${P}done_${code}_${date}`, d); }
};

export const results = {
  get: sid => ls.get(P + 'res_' + sid),
  set: (sid, r) => ls.set(P + 'res_' + sid, r)
};

/* ---------- IndexedDB (photos + queue), with in-memory fallback ---------- */
const mem = { photos: new Map(), queue: new Map() };
const KEY = { photos: 'id', queue: 'sid' };
let dbp = null;
function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no indexedDB'));
    const r = indexedDB.open(MOCK ? 'cranecheck-demo' : 'cranecheck', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('photos', { keyPath: 'id' }); d.createObjectStore('queue', { keyPath: 'sid' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  });
  dbp.catch(() => {});
  return dbp;
}
function run(d, store, mode, fn) {
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq ? rq.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
async function idbPut(store, val) {
  try { const d = await openDb(); await run(d, store, 'readwrite', s => s.put(val)); }
  catch (e) { mem[store].set(val[KEY[store]], val); }
}
async function idbGet(store, key) {
  try { const d = await openDb(); const v = await run(d, store, 'readonly', s => s.get(key)); return v || mem[store].get(key); }
  catch (e) { return mem[store].get(key); }
}
async function idbDel(store, key) {
  mem[store].delete(key);
  try { const d = await openDb(); await run(d, store, 'readwrite', s => s.delete(key)); } catch (e) {}
}
async function idbAll(store) {
  let out = [];
  try { const d = await openDb(); out = await run(d, store, 'readonly', s => s.getAll()); } catch (e) {}
  const seen = new Set(out.map(o => o[KEY[store]]));
  for (const v of mem[store].values()) if (!seen.has(v[KEY[store]])) out.push(v);
  return out;
}

/* ---------- photos ---------- */
const photoCache = new Map();
export const photos = {
  async add({ code, kind, date, item, name, b64 }) {
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const rec = { id, code, kind, date, item, name, b64 };
    photoCache.set(id, b64);
    await idbPut('photos', rec);
    return id;
  },
  async b64(id) {
    if (photoCache.has(id)) return photoCache.get(id);
    const r = await idbGet('photos', id);
    if (r) { photoCache.set(id, r.b64); return r.b64; }
    return null;
  },
  get: id => idbGet('photos', id),
  async del(id) { photoCache.delete(id); await idbDel('photos', id); }
};

/* ---------- offline submit queue ---------- */
const notify = () => window.dispatchEvent(new CustomEvent('cc-queue'));

export function photoIdsOf(payload) {
  const ids = [];
  const a = payload.answers || {};
  Object.keys(a).forEach(k => (a[k].photos || []).forEach(p => ids.push(p)));
  ((payload.defect && payload.defect.photos) || []).forEach(p => ids.push(p));
  return ids;
}

export async function enqueue({ sid, code, payload }) {
  await idbPut('queue', { sid, code, payload, created: Date.now(), status: 'waiting', error: '', uploaded: {}, attempts: 0 });
  notify();
}
export async function listQueue(code) {
  const all = (await idbAll('queue')).sort((a, b) => a.created - b.created);
  return code ? all.filter(q => q.code === code) : all;
}
export async function discard(sid) {
  const q = await idbGet('queue', sid);
  if (q) for (const id of photoIdsOf(q.payload)) await photos.del(id);
  await idbDel('queue', sid); notify();
}

function remap(payload, map) {
  const p = JSON.parse(JSON.stringify(payload));
  Object.keys(p.answers || {}).forEach(k => { p.answers[k].photos = (p.answers[k].photos || []).map(i => map[i]).filter(Boolean); });
  if (p.defect) { p.defect.photos = (p.defect.photos || []).map(i => map[i]).filter(Boolean); if (!p.defect.photos.length) delete p.defect.photos; }
  return p;
}

async function sendOne(q) {
  const map = q.uploaded || {};
  try {
    for (const id of photoIdsOf(q.payload)) {
      if (map[id] !== undefined) continue;
      const ph = await photos.get(id);
      if (!ph) { map[id] = ''; continue; } // photo lost from storage: send without it
      const r = await api('upload_photo', { code: q.code, sid: q.sid, item: ph.item, name: ph.name, b64: ph.b64 });
      map[id] = r.file_id;
      q.uploaded = map; await idbPut('queue', q);
    }
    const body = remap(q.payload, map);
    const r = await api('submit_check', { code: q.code, sid: q.sid, ...body });
    for (const id of photoIdsOf(q.payload)) await photos.del(id);
    await idbDel('queue', q.sid);
    results.set(q.sid, { ref: r.ref, pdf_url: r.pdf_url, defects: r.defects, at: Date.now() });
    doneFlags.mark(q.code, q.payload.date, q.payload.kind);
    return { sid: q.sid, ok: true, ...r };
  } catch (e) {
    const network = !(e instanceof ApiError) || e.network;
    q.attempts = (q.attempts || 0) + 1;
    q.status = network ? 'waiting' : 'error';
    q.error = network ? '' : (e.message || 'Rejected by server');
    q.uploaded = map;
    await idbPut('queue', q);
    return { sid: q.sid, ok: false, network, error: e.message };
  }
}

let draining = null;
export function drain() {
  if (draining) return draining;
  draining = (async () => {
    const out = [];
    if (navigator.onLine === false) return out;
    const items = await listQueue();
    for (const q of items) {
      const r = await sendOne(q);
      out.push(r); notify();
      if (r.network) break;
    }
    return out;
  })().finally(() => { draining = null; notify(); });
  return draining;
}

/* resolves with the send result for sid, or { ok:false, network:true } if still waiting */
export async function sendAndWait(sid) {
  for (let i = 0; i < 2; i++) {
    const r = await drain();
    const mine = r.find(x => x.sid === sid);
    if (mine) return mine;
    const saved = results.get(sid);
    if (saved) return { sid, ok: true, ...saved };
  }
  const q = await idbGet('queue', sid);
  if (q && q.status === 'error') return { sid, ok: false, network: false, error: q.error };
  return { sid, ok: false, network: true };
}

export function initAutoDrain() {
  const go = () => { listQueue().then(q => { if (q.length) drain(); }); };
  window.addEventListener('online', go);
  setInterval(go, 60000);
  go();
}
