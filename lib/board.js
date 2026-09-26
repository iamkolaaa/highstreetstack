export const STATUS_ORDER = ['in_progress', 'live', 'in_talks'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY = 86400000;

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function utcNoon(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
}

export function daysBetween(a, b) {
  return Math.round((utcNoon(b) - utcNoon(a)) / DAY);
}

export function progress(row, today) {
  const start = parseISO(row.start);
  const target = parseISO(row.target);
  if (!start) return { day: 0, total: 0, pct: 0 };
  const total = target && target > start ? daysBetween(start, target) : 0;
  let day = Math.max(0, daysBetween(start, today));
  if (total > 0) day = Math.min(day, total);
  const pct = total > 0 ? Math.round((day / total) * 100) : 0;
  return { day, total, pct };
}

export function pickNow(rows) {
  const list = rows.filter(r => r.status === 'in_progress')
    .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  return list[0] || null;
}

export function groupRows(rows, warn = () => {}) {
  const g = { in_progress: [], live: [], in_talks: [] };
  for (const r of rows) {
    if (r.status === 'paused') continue;
    if (!(r.status in g)) { warn(`row "${r.id}": unknown status "${r.status}", skipped`); continue; }
    g[r.status].push(r);
  }
  return g;
}

export function isUp(status, id) {
  return Boolean(status && status.up && status.up[id] === true);
}

export function fmtDate(iso) {
  const d = parseISO(iso);
  if (!d) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
