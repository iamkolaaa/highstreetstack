const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n)
const digits = v => (String(v).match(/\d/g) || []).length

/** Fields for the NLB Insider page. Returns a payload FormSubmit can email, or a message to show. */
export function validateNlbEnquiry(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Something went wrong. Try again.' }
  if (clip(body.hss_ref, 10)) return { ok: false, error: 'spam', silent: true }
  const name = clip(body.name, 120)
  const email = clip(body.email, 200)
  const phone = clip(body.phone, 40)
  const social = clip(body.social, 120)
  const website = clip(body.website, 300)
  const availability = clip(body.availability, 500)
  if (!name) return { ok: false, error: 'Enter your name.' }
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  if (digits(phone) < 7) return { ok: false, error: 'Enter a phone number we can call.' }
  if (!social) return { ok: false, error: 'Enter a social media handle.' }
  if (!availability) return { ok: false, error: 'Tell us when you are free for a short call.' }
  if (body.confirm !== true) return { ok: false, error: 'Tick the box to confirm you are happy to receive a short call.' }
  return {
    ok: true,
    payload: {
      name, email, phone, social, website: website || 'None given', availability,
      confirm: 'Yes. Happy to receive a short call to confirm the booking.',
      _subject: 'NLB Insider website enquiry',
      _template: 'table',
      _captcha: 'false',
    },
  }
}
