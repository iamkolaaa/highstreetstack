import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnquiry } from '../apps-script/enquiry.js';

const good = { name: 'Jay', biz: 'Patel Motors', email: 'jay@example.com', phone: '', msg: 'Need a site', website: '', source: 'https://highstreetstack.com/' };

test('accepts a good enquiry and builds the row', () => {
  const r = validateEnquiry(good, new Date('2026-09-26T10:00:00Z'));
  assert.equal(r.ok, true);
  assert.deepEqual(r.row.slice(1), ['Jay', 'Patel Motors', 'jay@example.com', '', 'Need a site', 'https://highstreetstack.com/']);
  assert.equal(r.row[0], '2026-09-26T10:00:00.000Z');
});

test('honeypot filled: ok but silent, no row', () => {
  const r = validateEnquiry({ ...good, website: 'http://spam' });
  assert.deepEqual(r, { ok: false, error: 'spam', silent: true });
});

test('rejects missing name or bad email', () => {
  assert.equal(validateEnquiry({ ...good, name: ' ' }).ok, false);
  assert.equal(validateEnquiry({ ...good, email: 'nope' }).ok, false);
});

test('truncates long fields', () => {
  const r = validateEnquiry({ ...good, msg: 'x'.repeat(5000) });
  assert.equal(r.row[5].length, 2000);
});
