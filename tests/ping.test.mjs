import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatus, targets } from '../scripts/ping.mjs';

test('targets lists only rows with a live_url', () => {
  const rows = [{ id: 'a', live_url: 'https://a.test' }, { id: 'b', live_url: null }];
  assert.deepEqual(targets(rows), [{ id: 'a', url: 'https://a.test' }]);
});

test('buildStatus shapes status.json', () => {
  const s = buildStatus({ a: true, b: false }, new Date('2026-09-26T07:00:00Z'));
  assert.deepEqual(s, { checked_at: '2026-09-26T07:00:00.000Z', up: { a: true, b: false } });
});
