import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProjects } from '../scripts/validate-data.mjs';

test('shipped projects.json is valid', () => {
  const rows = JSON.parse(readFileSync(new URL('../data/projects.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateProjects(rows), []);
});

test('rejects unknown status and duplicate ids', () => {
  const rows = [
    { id: 'a', name: 'A', status: 'live' },
    { id: 'a', name: 'B', status: 'weird' }
  ];
  const errors = validateProjects(rows);
  assert.ok(errors.some(e => e.includes('duplicate id "a"')));
  assert.ok(errors.some(e => e.includes('unknown status "weird"')));
});

test('rejects bad date formats', () => {
  const errors = validateProjects([{ id: 'x', name: 'X', status: 'in_progress', start: '26/09/2026', target: '2026-10-06' }]);
  assert.ok(errors.some(e => e.includes('start')));
});
