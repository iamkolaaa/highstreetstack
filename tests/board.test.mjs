import test from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, progress, pickNow, groupRows, isUp, fmtDate, STATUS_ORDER } from '../lib/board.js';

const d = s => new Date(s + 'T12:00:00Z');

test('daysBetween counts whole days', () => {
  assert.equal(daysBetween(d('2026-09-15'), d('2026-10-06')), 21);
  assert.equal(daysBetween(d('2026-10-06'), d('2026-09-15')), -21);
});

test('progress mid-project', () => {
  const r = { status: 'in_progress', start: '2026-09-15', target: '2026-10-06' };
  assert.deepEqual(progress(r, d('2026-09-27')), { day: 12, total: 21, pct: 57 });
});

test('progress before start clamps to day 0', () => {
  const r = { status: 'in_progress', start: '2026-10-01', target: '2026-10-22' };
  assert.deepEqual(progress(r, d('2026-09-27')), { day: 0, total: 21, pct: 0 });
});

test('progress past target clamps to total', () => {
  const r = { status: 'in_progress', start: '2026-09-01', target: '2026-09-10' };
  assert.deepEqual(progress(r, d('2026-09-27')), { day: 9, total: 9, pct: 100 });
});

test('progress with missing or inverted target gives total 0 and pct 0', () => {
  assert.deepEqual(progress({ start: '2026-09-15', target: null }, d('2026-09-27')), { day: 12, total: 0, pct: 0 });
  assert.deepEqual(progress({ start: '2026-09-15', target: '2026-09-01' }, d('2026-09-27')), { day: 12, total: 0, pct: 0 });
});

test('pickNow returns earliest-started in_progress row or null', () => {
  const rows = [
    { id: 'b', status: 'in_progress', start: '2026-09-20' },
    { id: 'a', status: 'in_progress', start: '2026-09-10' },
    { id: 'c', status: 'live' }
  ];
  assert.equal(pickNow(rows).id, 'a');
  assert.equal(pickNow([{ id: 'c', status: 'live' }]), null);
});

test('groupRows orders groups, drops paused, warns on unknown', () => {
  const warnings = [];
  const g = groupRows([
    { id: '1', status: 'live' },
    { id: '2', status: 'paused' },
    { id: '3', status: 'nope' },
    { id: '4', status: 'in_talks' },
    { id: '5', status: 'in_progress' }
  ], m => warnings.push(m));
  assert.deepEqual(Object.keys(g), STATUS_ORDER);
  assert.deepEqual(g.in_progress.map(r => r.id), ['5']);
  assert.deepEqual(g.live.map(r => r.id), ['1']);
  assert.deepEqual(g.in_talks.map(r => r.id), ['4']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unknown status "nope"/);
});

test('isUp reads status.json safely', () => {
  assert.equal(isUp({ checked_at: 'x', up: { nlb: true } }, 'nlb'), true);
  assert.equal(isUp({ checked_at: 'x', up: {} }, 'nlb'), false);
  assert.equal(isUp(null, 'nlb'), false);
});

test('fmtDate', () => {
  assert.equal(fmtDate('2026-09-15'), '15 Sep 2026');
  assert.equal(fmtDate(null), '');
});

test('bad date strings never produce NaN', () => {
  assert.deepEqual(progress({ start: '26/09/2026', target: '2026-10-06' }, d('2026-09-27')), { day: 0, total: 0, pct: 0 });
  assert.deepEqual(progress({ start: '2026-09-15', target: 'soon' }, d('2026-09-27')), { day: 12, total: 0, pct: 0 });
  assert.equal(fmtDate('26/09/2026'), '');
  assert.equal(fmtDate('2026-13-45'), '');
});
