import test from 'node:test';
import assert from 'node:assert/strict';
import { daySlots, openSlots, bookableDays, londonNow, validateCall, addDays } from '../lib/slots.js';

// Thu 19 Nov 2026
test('weekday has 27 twenty-minute slots 09:00 to 17:40', () => {
  const s = daySlots('2026-11-19');
  assert.equal(s.length, 27);
  assert.equal(s[0], '09:00');
  assert.equal(s.at(-1), '17:40');
});

test('Saturday short day, Sunday closed', () => {
  assert.deepEqual(daySlots('2026-11-21').slice(0, 2), ['10:00', '10:20']);
  assert.equal(daySlots('2026-11-21').at(-1), '13:40');
  assert.deepEqual(daySlots('2026-11-22'), []);
});

test('today only offers slots 3 hours ahead', () => {
  const now = { date: '2026-11-19', minutes: 12 * 60 + 5 };
  assert.equal(openSlots('2026-11-19', now)[0], '15:20');
});

test('late evening pushes the lead time into tomorrow morning', () => {
  const now = { date: '2026-11-19', minutes: 23 * 60 };
  assert.equal(openSlots('2026-11-20', now)[0], '09:00');
  const late = { date: '2026-11-20', minutes: 23 * 60 + 30 };
  assert.equal(openSlots('2026-11-21', late)[0], '10:00');
});

test('past days and beyond two weeks are closed', () => {
  const now = { date: '2026-11-19', minutes: 600 };
  assert.deepEqual(openSlots('2026-11-18', now), []);
  assert.deepEqual(openSlots(addDays('2026-11-19', 15), now), []);
});

test('taken slots are removed', () => {
  const now = { date: '2026-11-19', minutes: 0 };
  const s = openSlots('2026-11-20', now, new Set(['2026-11-20 09:20']));
  assert.ok(!s.includes('09:20'));
  assert.ok(s.includes('09:00'));
});

test('bookable days skip Sundays', () => {
  const days = bookableDays({ date: '2026-11-19', minutes: 600 }, new Set());
  assert.ok(!days.some(d => d.date === '2026-11-22'));
  assert.equal(days[0].date, '2026-11-19');
});

test('londonNow handles BST', () => {
  assert.deepEqual(londonNow(new Date('2026-07-01T08:30:00Z')), { date: '2026-07-01', minutes: 9 * 60 + 30 });
  assert.deepEqual(londonNow(new Date('2026-12-01T08:30:00Z')), { date: '2026-12-01', minutes: 8 * 60 + 30 });
});

const good = { name: 'Jay', phone: '07700 900123', email: 'jay@example.com', date: '2026-11-20', time: '10:00', topic: 'Booking site' };
const now = { date: '2026-11-19', minutes: 600 };

test('validateCall accepts a good booking', () => {
  const r = validateCall(good, now);
  assert.equal(r.ok, true);
  assert.equal(r.call.time, '10:00');
});

test('validateCall rejects bad input', () => {
  assert.equal(validateCall({ ...good, phone: '123' }, now).error, 'valid phone required');
  assert.equal(validateCall({ ...good, email: 'x' }, now).error, 'valid email required');
  assert.equal(validateCall({ ...good, time: '10:10' }, now).error, 'time not available');
  assert.equal(validateCall({ ...good, date: '2026-11-22' }, now).error, 'time not available');
  assert.deepEqual(validateCall({ ...good, hss_ref: 'x' }, now), { ok: false, error: 'spam', silent: true });
});
