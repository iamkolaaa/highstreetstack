const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export function validateEnquiry(body, now = new Date()) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  if (clip(body.website, 10)) return { ok: false, error: 'spam', silent: true };
  const name = clip(body.name, 120);
  const email = clip(body.email, 200);
  if (!name) return { ok: false, error: 'name required' };
  if (!EMAIL.test(email)) return { ok: false, error: 'valid email required' };
  const row = [now.toISOString(), name, clip(body.biz, 200), email, clip(body.phone, 40), clip(body.msg, 2000), clip(body.source, 300)];
  return { ok: true, row };
}
