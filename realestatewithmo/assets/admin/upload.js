/* Photo resize and sequential upload, plus the photo grid used by the property editor. */

const MAX_SIDE = 1600;
const QUALITY = 0.82;
const MAX_BYTES = 2000000; // decoded size cap, the server allows 2.2MB
export const MAX_PHOTOS = 20;

async function toBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* try the Image route */ }
    try { return await createImageBitmap(file); } catch (e) { /* try the Image route */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function canvasBlob(canvas, q) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no blob'))), 'image/jpeg', q);
  });
}

function blobBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

/* Returns { data, bytes, width, height } where data is base64 JPEG without the data: prefix. */
export async function resizeToJpeg(file, maxSide = MAX_SIDE, quality = QUALITY) {
  let bmp;
  try { bmp = await toBitmap(file); } catch (e) { throw new Error('Choose JPEG or PNG for this one.'); }
  const w0 = bmp.width || bmp.naturalWidth;
  const h0 = bmp.height || bmp.naturalHeight;
  if (!w0 || !h0) throw new Error('Choose JPEG or PNG for this one.');
  let side = maxSide;
  let q = quality;
  for (let i = 0; i < 5; i++) {
    const scale = Math.min(1, side / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    try { g.drawImage(bmp, 0, 0, w, h); } catch (e) { throw new Error('Choose JPEG or PNG for this one.'); }
    const blob = await canvasBlob(canvas, q);
    if (blob.size <= MAX_BYTES || i === 4) {
      if (bmp.close) bmp.close();
      return { data: await blobBase64(blob), bytes: blob.size, width: w, height: h };
    }
    q = Math.max(0.5, q - 0.1);
    side = Math.round(side * 0.85);
  }
  throw new Error('That photo is too large.');
}

const IC = {
  star: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>'
};

const pid = p => (p && (p.id || p.url)) || '';

/* opts: { propertyId, photos, api, photoSrc, esc, toast, confirm, onChange(photos) } */
export function mountUploader(el, opts) {
  const { propertyId, api, photoSrc, esc, toast, confirm, onChange } = opts;
  let photos = Array.isArray(opts.photos) ? opts.photos.slice() : [];
  let busy = false;
  let progress = null; // { done, total, name, pct }

  function set(next) {
    photos = Array.isArray(next) ? next : photos;
    if (onChange) onChange(photos);
    draw();
  }

  function draw() {
    const tiles = photos.map((p, i) => {
      const src = esc(photoSrc(p, 480));
      return '<li class="ph" data-i="' + i + '">' +
        '<img src="' + src + '" alt="Photo ' + (i + 1) + '" loading="lazy" decoding="async">' +
        (i === 0 ? '<span class="ph-cover">Cover</span>' : '') +
        '<div class="ph-bar">' +
        '<button type="button" class="ph-b' + (i === 0 ? ' on' : '') + '" data-a="cover" aria-label="Make this the cover photo" ' + (busy ? 'disabled' : '') + '>' + IC.star + '</button>' +
        '<button type="button" class="ph-b" data-a="left" aria-label="Move earlier" ' + (busy || i === 0 ? 'disabled' : '') + '>' + IC.left + '</button>' +
        '<button type="button" class="ph-b" data-a="right" aria-label="Move later" ' + (busy || i === photos.length - 1 ? 'disabled' : '') + '>' + IC.right + '</button>' +
        '<button type="button" class="ph-b ph-x" data-a="del" aria-label="Remove photo" ' + (busy ? 'disabled' : '') + '>' + IC.x + '</button>' +
        '</div></li>';
    }).join('');
    const prog = progress
      ? '<div class="up-prog" role="status"><div class="up-line"><span>Uploading ' + Math.min(progress.done + 1, progress.total) + ' of ' + progress.total +
        '</span><span class="muted">' + esc(progress.name) + '</span></div><div class="up-track"><div class="up-fill" style="width:' + progress.pct + '%"></div></div></div>'
      : '';
    el.innerHTML =
      '<div class="up">' +
      '<label class="btn btn-outline up-add' + (busy || photos.length >= MAX_PHOTOS ? ' is-off' : '') + '">' +
      '<input type="file" accept="image/*" multiple ' + (busy || photos.length >= MAX_PHOTOS ? 'disabled' : '') + ' hidden>' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
      '<span>Add photos</span></label>' +
      '<p class="muted small">' + photos.length + ' of ' + MAX_PHOTOS + ' photos. The first one is the cover. Photos are shrunk on your phone before they upload.</p>' +
      prog +
      (photos.length ? '<ul class="ph-grid">' + tiles + '</ul>' : '<p class="empty">No photos yet. Add a few good ones and they show up on the site.</p>') +
      '</div>';
  }

  async function upload(files) {
    const room = MAX_PHOTOS - photos.length;
    let list = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    if (!list.length) { toast('Pick photos to upload.', 'bad'); return; }
    if (list.length > room) {
      toast('Only ' + room + ' more fit. Taking the first ' + room + '.', 'bad');
      list = list.slice(0, room);
    }
    if (room <= 0) return;
    busy = true;
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      progress = { done: i, total: list.length, name: f.name, pct: Math.round((i / list.length) * 100) };
      draw();
      try {
        const r = await resizeToJpeg(f);
        progress.pct = Math.round(((i + 0.5) / list.length) * 100);
        draw();
        const base = (f.name || 'photo').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 40) || 'photo';
        const res = await api('upload_photo', { property_id: propertyId, name: base + '.jpg', data: r.data });
        if (res && Array.isArray(res.photos)) { photos = res.photos; if (onChange) onChange(photos); }
        ok++;
      } catch (e) {
        toast((f.name ? f.name + ': ' : '') + ((e && e.message) || 'Upload failed.'), 'bad');
      }
    }
    busy = false;
    progress = null;
    draw();
    if (ok) toast(ok === 1 ? 'Photo added.' : ok + ' photos added.', 'ok');
  }

  el.addEventListener('change', e => {
    const inp = e.target;
    if (inp && inp.type === 'file') {
      const files = Array.from(inp.files || []);
      inp.value = '';
      if (files.length && !busy) upload(files);
    }
  });

  el.addEventListener('click', async e => {
    const b = e.target.closest('button[data-a]');
    if (!b || busy) return;
    const li = b.closest('.ph');
    const i = Number(li.dataset.i);
    const p = photos[i];
    const a = b.dataset.a;
    try {
      if (a === 'cover') {
        if (i === 0) { toast('That is already the cover.', 'ok'); return; }
        busy = true; draw();
        const r = await api('set_cover', { property_id: propertyId, id: pid(p) });
        busy = false; set(r.photos);
        toast('Cover photo changed.', 'ok');
      } else if (a === 'left' || a === 'right') {
        const j = a === 'left' ? i - 1 : i + 1;
        if (j < 0 || j >= photos.length) return;
        const next = photos.slice();
        [next[i], next[j]] = [next[j], next[i]];
        busy = true; draw();
        const r = await api('reorder_photos', { property_id: propertyId, ids: next.map(pid) });
        busy = false; set(r.photos || next);
      } else if (a === 'del') {
        const yes = await confirm('Remove this photo?', { ok: 'Remove', danger: true });
        if (!yes) return;
        busy = true; draw();
        const r = await api('delete_photo', { property_id: propertyId, id: pid(p) });
        busy = false; set(r.photos);
        toast('Photo removed.', 'ok');
      }
    } catch (err) {
      busy = false; draw();
      toast((err && err.message) || 'That did not work. Try again.', 'bad');
    }
  });

  draw();
  return { getPhotos: () => photos.slice(), setPhotos: p => set(p) };
}
