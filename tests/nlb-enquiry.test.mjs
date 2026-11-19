import test from 'node:test'
import assert from 'node:assert/strict'
import { validateNlbEnquiry } from '../nlb/enquiry.js'

const good = {
  name: 'Ada Lovelace', email: 'ada@example.com', website: 'https://ada.example',
  social: '@ada', phone: '07700 900123', availability: 'Weekday evenings', confirm: true, hss_ref: '',
}

test('builds the email payload for a complete enquiry', () => {
  const r = validateNlbEnquiry(good)
  assert.equal(r.ok, true)
  assert.equal(r.payload.name, 'Ada Lovelace')
  assert.equal(r.payload.email, 'ada@example.com')
  assert.equal(r.payload.website, 'https://ada.example')
  assert.equal(r.payload.social, '@ada')
  assert.equal(r.payload.phone, '07700 900123')
  assert.equal(r.payload.availability, 'Weekday evenings')
  assert.match(r.payload.confirm, /short call/)
  assert.equal(r.payload._subject, 'NLB Insider website enquiry')
})

test('website is optional', () => {
  const r = validateNlbEnquiry({ ...good, website: '  ' })
  assert.equal(r.ok, true)
  assert.equal(r.payload.website, 'None given')
})

test('requires the call confirmation', () => {
  const r = validateNlbEnquiry({ ...good, confirm: false })
  assert.equal(r.ok, false)
  assert.match(r.error, /short call/)
})

test('rejects a missing handle, a short phone and a bad email', () => {
  assert.equal(validateNlbEnquiry({ ...good, social: ' ' }).ok, false)
  assert.equal(validateNlbEnquiry({ ...good, phone: '123' }).ok, false)
  assert.equal(validateNlbEnquiry({ ...good, email: 'ada' }).ok, false)
})

test('honeypot is silent', () => {
  assert.deepEqual(validateNlbEnquiry({ ...good, hss_ref: 'bot' }), { ok: false, error: 'spam', silent: true })
})
