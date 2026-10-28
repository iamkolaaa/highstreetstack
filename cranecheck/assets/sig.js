/* Signature pad: touch + mouse via pointer events. Output PNG base64 (no prefix), <= 600px wide. */
export function createSigPad(canvas, { onChange } = {}) {
  const ctx = canvas.getContext('2d');
  let drawing = false, dirty = false, last = null, pending = null;

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000';
    if (pending) { drawImage(pending); }
  }
  function drawImage(b64) {
    const img = new Image();
    img.onload = () => { const r = canvas.getBoundingClientRect(); ctx.drawImage(img, 0, 0, r.width, r.height); dirty = true; };
    img.src = 'data:image/png;base64,' + b64;
  }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function down(e) {
    e.preventDefault(); drawing = true; last = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    ctx.beginPath(); ctx.arc(last.x, last.y, 1.3, 0, 7); ctx.fill(); dirty = true;
  }
  function move(e) {
    if (!drawing) return; e.preventDefault();
    const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
  }
  function up(e) {
    if (!drawing) return; drawing = false; pending = null;
    if (onChange) onChange(toPNG());
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', e => { if (drawing) up(e); });
  canvas.style.touchAction = 'none';

  function toPNG() {
    if (!dirty) return '';
    const w = Math.min(600, canvas.width), h = Math.round(canvas.height * (w / canvas.width));
    const t = document.createElement('canvas'); t.width = w; t.height = h;
    const c = t.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(canvas, 0, 0, w, h);
    return t.toDataURL('image/png').split(',')[1];
  }
  function clear() {
    pending = null; dirty = false;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
    if (onChange) onChange('');
  }
  function load(b64) { if (b64) { pending = b64; drawImage(b64); } }

  size();
  return { clear, load, toPNG, isEmpty: () => !dirty, resize: size };
}
