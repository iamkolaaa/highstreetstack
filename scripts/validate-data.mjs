import { readFileSync } from 'node:fs';

export const STATUSES = ['live', 'in_progress', 'in_talks', 'paused'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DATE_FIELDS = ['start', 'target', 'went_live'];

export function validateProjects(rows) {
  const errors = [];
  if (!Array.isArray(rows)) return ['projects.json must be an array'];
  const seen = new Set();
  rows.forEach((r, i) => {
    const where = `row ${i} (${r && r.id ? r.id : 'no id'})`;
    if (!r || typeof r !== 'object') { errors.push(`${where}: not an object`); return; }
    if (!r.id || typeof r.id !== 'string') errors.push(`${where}: missing id`);
    else if (seen.has(r.id)) errors.push(`${where}: duplicate id "${r.id}"`);
    else seen.add(r.id);
    if (!r.name) errors.push(`${where}: missing name`);
    if (!STATUSES.includes(r.status)) errors.push(`${where}: unknown status "${r.status}"`);
    for (const f of DATE_FIELDS) {
      if (r[f] != null && !(typeof r[f] === 'string' && ISO.test(r[f]))) errors.push(`${where}: ${f} must be YYYY-MM-DD or null`);
    }
    if (r.status === 'in_progress' && !r.start) errors.push(`${where}: in_progress rows need a start date`);
  });
  return errors;
}

if (process.argv[1] && process.argv[1].endsWith('validate-data.mjs')) {
  const rows = JSON.parse(readFileSync(new URL('../data/projects.json', import.meta.url), 'utf8'));
  const errors = validateProjects(rows);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`projects.json ok (${rows.length} rows)`);
}
