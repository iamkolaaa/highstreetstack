/* Resize a photo to 1280px long edge, JPEG 0.72, return base64 without the data: prefix. */
const MAX_B64 = 1400000;

async function toBitmap(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image.')); i.src = url; });
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

export async function resizeToB64(file, maxEdge = 1280, quality = 0.72) {
  const bmp = await toBitmap(file);
  const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  let q = quality, out = c.toDataURL('image/jpeg', q).split(',')[1];
  while (out.length > MAX_B64 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q).split(',')[1]; }
  return out;
}

export const dataUrl = b64 => 'data:image/jpeg;base64,' + b64;

export function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
}
