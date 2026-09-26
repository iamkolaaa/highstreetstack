import { readFileSync, writeFileSync } from 'node:fs';

export function targets(rows) {
  return rows.filter(r => r.live_url).map(r => ({ id: r.id, url: r.live_url }));
}

export function buildStatus(results, now = new Date()) {
  return { checked_at: now.toISOString(), up: results };
}

async function check(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    clearTimeout(t);
    return res.status >= 200 && res.status < 400;
  } catch { return false; }
}

if (process.argv[1] && process.argv[1].endsWith('ping.mjs')) {
  const dataDir = new URL('../data/', import.meta.url);
  const rows = JSON.parse(readFileSync(new URL('projects.json', dataDir), 'utf8'));
  const results = {};
  for (const t of targets(rows)) {
    results[t.id] = await check(t.url);
    console.log(t.id, t.url, results[t.id] ? 'up' : 'down');
  }
  writeFileSync(new URL('status.json', dataDir), JSON.stringify(buildStatus(results), null, 2) + '\n');
}
