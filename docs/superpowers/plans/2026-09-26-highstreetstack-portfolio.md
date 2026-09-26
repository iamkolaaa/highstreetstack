# High Street Stack Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship highstreetstack.com: a one-page dark "live status board" portfolio on GitHub Pages, driven by a JSON file in the repo, with an NLB case study, a working enquiry form, and a daily uptime check.

**Architecture:** Static site, no build step. `index.html` holds markup and prose; `styles.css` holds tokens and layout; `lib/board.js` holds pure, Node-testable logic (progress maths, grouping, validation); `app.js` fetches `data/projects.json` and `data/status.json`, renders the board and "now building" panel, and posts the enquiry form to an Apps Script web app. A GitHub Action pings live URLs daily and commits `data/status.json`.

**Tech Stack:** HTML, CSS, ES modules (browser + Node 25 `node --test`), GitHub Pages, GitHub Actions, Google Apps Script (enquiry receiver), Porkbun DNS.

**Spec:** `docs/superpowers/specs/2026-09-26-highstreetstack-portfolio-design.md`

## Global Constraints

- Running cost £0. Only the domain is paid. No npm dependencies, no paid services.
- Public page copy never names where enquiry or project data is stored (no "Google", "Sheet", "Drive", "Apps Script", "data lives in").
- NLB has no GitHub link on the site; live link is `https://nlbuk.com` only.
- Display name: "Kola Salau, Solutions Architect". Contact email shown: `hello@highstreetstack.com`.
- Single dark theme: bg `#0D1117`, panel `#131A22`, line `#25303C`, text `#E8EDF2`, muted `#8C9AA9`, amber `#F2B544`, green `#3CD68B`.
- Fonts: Bricolage Grotesque (display), JetBrains Mono (body/data), from Google Fonts with real fallback stacks.
- `status` enum: `live`, `in_progress`, `in_talks`, `paused`. Unknown values are skipped with a console warning.
- Board group order: In progress, Live, In talks. `paused` hidden.
- Mobile: no horizontal scroll at 400px; 16px side gutter; board rows stack below 760px.
- Git commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. `start` after `target`, or `target` missing on an `in_progress` row: expect "day X" with no crash and the bar at 0%; test in Task 2.
2. `today` before `start` (job scheduled to begin next week): expect "day 0 of Y", bar 0%; test in Task 2.
3. `projects.json` with a trailing comma or other syntax error: expect the "Board unavailable" message and the rest of the page intact; test in Task 4.
4. Enquiry form submitted with the honeypot filled by a bot: expect the receiver to return ok without writing a row; test in Task 5.
5. `status.json` present but missing an id: expect that live row's dot grey, no error; test in Task 2 and Task 4.

---

### Task 1: Repo scaffold and project data

**Files:**
- Create: `README.md`, `.gitignore`, `CNAME`, `data/projects.json`, `data/status.json`, `scripts/validate-data.mjs`, `tests/validate-data.test.mjs`, `package.json`

**Interfaces:**
- Produces: `data/projects.json` schema (array of rows with the fields in the spec §3.1) consumed by Tasks 2 and 4. `validateProjects(rows) -> string[]` (list of error messages, empty when valid) exported from `scripts/validate-data.mjs`.

- [ ] **Step 1: Create `package.json` (scripts only, no dependencies)**

```json
{
  "name": "highstreetstack",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "validate": "node scripts/validate-data.mjs",
    "serve": "python3 -m http.server 8080"
  }
}
```

- [ ] **Step 2: Create `.gitignore` and `CNAME`**

`.gitignore`:
```
.DS_Store
node_modules/
```

`CNAME`:
```
highstreetstack.com
```

- [ ] **Step 3: Write the failing validator test `tests/validate-data.test.mjs`**

```js
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
```

- [ ] **Step 4: Run the test, expect failure**

Run: `npm test`
Expected: FAIL, cannot find module `scripts/validate-data.mjs`.

- [ ] **Step 5: Create `scripts/validate-data.mjs`**

```js
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
```

- [ ] **Step 6: Create `data/projects.json`**

```json
[
  {
    "id": "nlb",
    "name": "Nobody Left Behind",
    "client_line": "Community fitness, Milton Keynes",
    "type": "Site + registrations + tickets",
    "status": "live",
    "stage": null,
    "start": null,
    "target": null,
    "went_live": "2026-08-25",
    "estimate": null,
    "stack": "Static site · Stripe",
    "live_url": "https://nlbuk.com",
    "repo_url": null,
    "link_label": null,
    "link_url": null,
    "now_note": null,
    "featured": true
  },
  {
    "id": "zautoz",
    "name": "Z Autoz Ltd",
    "client_line": "Garage, Bletchley",
    "type": "Site + bookings + reminders",
    "status": "in_talks",
    "stage": "Scoping call",
    "start": null,
    "target": null,
    "went_live": null,
    "estimate": "3 weeks",
    "stack": null,
    "live_url": null,
    "repo_url": null,
    "link_label": "Maps",
    "link_url": "https://maps.app.goo.gl/K7KGjkaBphMKuas86",
    "now_note": null,
    "featured": false
  },
  {
    "id": "findmore",
    "name": "Find More Fitness",
    "client_line": "Fitness community",
    "type": "Site + member sign-up",
    "status": "in_talks",
    "stage": "First contact",
    "start": null,
    "target": null,
    "went_live": null,
    "estimate": "2 weeks",
    "stack": null,
    "live_url": null,
    "repo_url": null,
    "link_label": "Instagram",
    "link_url": "https://www.instagram.com/findmorefitness/",
    "now_note": null,
    "featured": false
  },
  {
    "id": "diftas",
    "name": "Do It For The Art Studio",
    "client_line": "Barbers, Bletchley",
    "type": "Site + booking link + CRM",
    "status": "in_talks",
    "stage": "First contact",
    "start": null,
    "target": null,
    "went_live": null,
    "estimate": "2 weeks",
    "stack": null,
    "live_url": null,
    "repo_url": null,
    "link_label": "Booksy",
    "link_url": "https://booksy.com/en-gb/114393_do-it-for-the-art-studio_barber_913766_bletchley",
    "now_note": null,
    "featured": false
  }
]
```

- [ ] **Step 7: Create `data/status.json`**

```json
{ "checked_at": null, "up": {} }
```

- [ ] **Step 8: Create `README.md`**

```markdown
# High Street Stack

Portfolio site for Kola Salau, Solutions Architect. Live at https://highstreetstack.com.

## Update the project board

Edit `data/projects.json` on github.com (pencil icon works on a phone). One object per project.

| Field | Values |
|---|---|
| `status` | `live`, `in_progress`, `in_talks`, `paused` (paused rows are hidden) |
| `start`, `target`, `went_live` | `YYYY-MM-DD` or `null` |
| `now_note` | one sentence shown in the "Now building" panel (in_progress rows only) |
| `featured` | `true` gives the row a case-study block (prose lives in `index.html`) |

Commit to `main`. The site updates within about a minute.

## Run locally

```
npm test        # unit tests
npm run validate
npm run serve   # http://localhost:8080
```

## Enquiry form

See `apps-script/README.md`.
```

- [ ] **Step 9: Run tests and validator, expect pass**

Run: `npm test && npm run validate`
Expected: 3 tests pass; `projects.json ok (4 rows)`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold repo with project data and validator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pure board logic `lib/board.js`

**Files:**
- Create: `lib/board.js`, `tests/board.test.mjs`

**Interfaces:**
- Consumes: row objects from `data/projects.json`.
- Produces (all exported from `lib/board.js`):
  - `daysBetween(a, b) -> number` (whole days, `b - a`, can be negative)
  - `progress(row, today) -> { day: number, total: number, pct: number }` where `today` is a `Date`; `day` clamped to `[0, total]`, `pct` 0–100 integer, `total` is 0 when `target` missing or not after `start`
  - `pickNow(rows) -> row | null` first `in_progress` row ordered by `start` ascending
  - `groupRows(rows) -> { in_progress: row[], live: row[], in_talks: row[] }` (paused dropped; unknown status dropped and reported via `warn` callback)
  - `isUp(statusJson, id) -> boolean`
  - `fmtDate(iso) -> string` e.g. `"15 Sep 2026"`; `""` for null
  - `STATUS_ORDER = ['in_progress', 'live', 'in_talks']`

- [ ] **Step 1: Write failing tests `tests/board.test.mjs`**

```js
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
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm test`
Expected: FAIL, cannot find module `lib/board.js`.

- [ ] **Step 3: Create `lib/board.js`**

```js
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
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: all tests pass (3 from Task 1 plus 9 here).

- [ ] **Step 5: Commit**

```bash
git add lib/board.js tests/board.test.mjs
git commit -m "Add pure board logic with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Markup and styles `index.html` + `styles.css`

**Files:**
- Create: `index.html`, `styles.css`

**Interfaces:**
- Produces DOM hooks Task 4 renders into: `#now` (panel), `#now-label`, `#now-days`, `#now-name`, `#now-note`, `#now-bar`, `#now-start`, `#now-target`, `#board` (empty container), `#board-updated`, form `#enquiry` with inputs `#name #biz #email #phone #msg #website` (honeypot), button `#send`, message `#form-msg`.
- Loads `app.js` as `<script type="module" src="app.js">`.

- [ ] **Step 1: Create `styles.css`**

Copy the `<style>` block from the approved mockup (`/private/tmp/claude-501/-Users-kolasalau-Downloads-Claude-On-Mac/b75fdc63-496d-4bd8-9c77-28d1f30de890/scratchpad/highstreetstack-mockup.html`, or re-read artifact https://claude.ai/artifact/Ls3pmC2GfnmYUMbjBivDHa if the scratchpad is gone) into `styles.css` with these changes: add `.now.idle .bar, .now.idle .meta { display:none }`; add `.row .c:empty { display:none }`; add `.board .empty { padding:16px; color:var(--muted); font-size:13px }`; add `.form-msg { font-size:12px; margin-top:10px; color:var(--muted) } .form-msg.err { color:#F09595 }`; add `.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}`; keep the `@media (max-width:760px)` and `prefers-reduced-motion` blocks. Body gets `padding-inline:16px`.

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>High Street Stack · Kola Salau, Solutions Architect</title>
<meta name="description" content="Websites, automation and a CRM you own, for local businesses in Bletchley and Milton Keynes. £0 to run.">
<meta property="og:title" content="High Street Stack">
<meta property="og:description" content="The tech stack for the high street. Websites, automation and a CRM you own.">
<meta property="og:url" content="https://highstreetstack.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<div class="wrap">
  <header class="top">
    <div><b>highstreetstack.com</b> &nbsp;·&nbsp; Kola Salau, Solutions Architect &nbsp;·&nbsp; Bletchley, Milton Keynes</div>
    <nav><a href="#board">Board</a><a href="#work">Work</a><a href="#stack">Stack</a><a href="#contact">Contact</a><a href="https://github.com/iamkolaaa">GitHub</a></nav>
  </header>

  <section class="hero" aria-labelledby="h1">
    <div>
      <div class="eyebrow">Websites, automation and a CRM you own</div>
      <h1 id="h1">The tech stack for the <em>high street</em>.</h1>
      <p class="lede">I build the website, the enquiry system and the automations for local businesses that don't have one yet. It all runs on free tiers and you keep the keys.</p>
      <div class="pills"><span class="pill">Website</span><span class="pill">CRM you control</span><span class="pill">Automation</span><span class="pill">£0 to run</span></div>
    </div>
    <aside class="now idle" id="now" aria-live="polite">
      <div class="k"><span><span class="dot">●</span> <span id="now-label">Now building</span></span><span id="now-days"></span></div>
      <h2 id="now-name">Next slot open</h2>
      <p class="sub" id="now-note">Ready to start a new build. <a href="#contact">Start a project</a>.</p>
      <div class="bar"><i id="now-bar" style="width:0%"></i></div>
      <div class="meta"><span id="now-start"></span><span id="now-target"></span></div>
    </aside>
  </section>

  <section id="board-section">
    <div class="sh"><h3 id="board">Project board</h3><span id="board-updated"></span></div>
    <div class="board" id="board-list" aria-busy="true"><div class="empty">Loading board…</div></div>
    <p class="note">Green dot means the live site answered the last daily check.</p>
  </section>

  <section id="work">
    <div class="sh"><h3>Case study</h3><span>01 of 01, more as they go live</span></div>
    <div class="case">
      <div class="txt">
        <h4>Nobody Left Behind<span>Community fitness, Milton Keynes</span></h4>
        <p>A free-to-join fitness community running boxing, track and gym sessions across the week. They needed a site people could register on from Instagram, live attendee counts per session, and paid tickets for two sessions, all without a monthly bill.</p>
        <p>The site is static and hosted free. Registration and join forms post to a small backend the organisers can open from their phone. Stripe handles the two paid sessions. Sign-ups now land in one place with a timestamp and a first-timer flag.</p>
        <div class="kv">
          <div><div class="l">Live</div><div class="v"><a href="https://nlbuk.com">nlbuk.com</a></div></div>
          <div><div class="l">Delivered</div><div class="v">Aug 2026</div></div>
          <div><div class="l">Running cost</div><div class="v">£0 per month</div></div>
          <div><div class="l">Monthly bill</div><div class="v">None</div></div>
        </div>
      </div>
      <div class="shot" role="img" aria-label="Sketch of the NLB registration flow: Instagram link, form, backend, list, session card, Stripe ticket">
        <div class="fake"><span>Instagram bio link</span><b>nlbuk.com</b></div>
        <div class="fake"><span>Register for Wednesday Boxing</span><b>form</b></div>
        <div class="fake"><span>Backend</span><b>validate + save</b></div>
        <div class="fake"><span>Registrations list</span><b>row added</b></div>
        <div class="fake"><span>Session card</span><b>18 going</b></div>
        <div class="fake"><span>Paid session</span><b>Stripe ticket</b></div>
      </div>
    </div>
  </section>

  <section id="stack">
    <div class="sh"><h3>What every client gets</h3><span>Same stack, tuned per business</span></div>
    <div class="stack">
      <div><h5>A fast website</h5><p>Static, mobile-first, hosted free. Your domain, your Google Business listing linked.</p><div class="cost">£0 hosting</div></div>
      <div><h5>A CRM you control</h5><p>Enquiries and bookings land in a system you own and can open from your phone. Views for today, this week, unanswered.</p><div class="cost">£0, your account</div></div>
      <div><h5>Automation</h5><p>Email confirmations, next-day reminders, WhatsApp follow-up links.</p><div class="cost">£0 to run</div></div>
      <div><h5>Handover</h5><p>You own the accounts. I remove my access when we're done, in writing, with the GDPR paperwork.</p><div class="cost">Monthly care plan optional</div></div>
    </div>
  </section>

  <section id="contact">
    <div class="sh"><h3>Start a project</h3><span>Reply within one working day</span></div>
    <form id="enquiry" novalidate>
      <label>Your name<input id="name" name="name" type="text" autocomplete="name" placeholder="Jay Patel" required></label>
      <label>Business<input id="biz" name="biz" type="text" autocomplete="organization" placeholder="Patel Motors, Bletchley"></label>
      <label>Email<input id="email" name="email" type="email" autocomplete="email" placeholder="jay@patelmotors.co.uk" required></label>
      <label>Phone, optional<input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="07700 900123"></label>
      <label class="full">What do you need?<textarea id="msg" name="msg" placeholder="No website yet. We take bookings on WhatsApp and lose track."></textarea></label>
      <label class="sr-only" aria-hidden="true">Leave empty<input id="website" name="website" type="text" tabindex="-1" autocomplete="off"></label>
      <button type="submit" id="send">Send enquiry</button>
    </form>
    <p class="form-msg" id="form-msg" hidden></p>
    <p class="note">Or email <span id="mail">hello@highstreetstack.com</span>. Replying to an enquiry needs no marketing consent; you'll only hear from me about your project.</p>
  </section>

  <footer>
    <span>© 2026 High Street Stack · Kola Salau</span>
    <span>Built on GitHub Pages · <a href="https://github.com/iamkolaaa">github.com/iamkolaaa</a></span>
  </footer>
</div>
<script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Serve and look once**

Run: `npm run serve` then open `http://localhost:8080` in the browser pane.
Expected: hero, idle "Next slot open" panel, "Loading board…" box, case study, stack cards, form, footer. No console errors except the missing `app.js` 404 (created in Task 4).

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "Add page markup and styles

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Rendering `app.js`

**Files:**
- Create: `app.js`
- Modify: none

**Interfaces:**
- Consumes: `lib/board.js` exports; DOM ids from Task 3; `data/projects.json`, `data/status.json`.
- Produces: `window.HSS = { render }` for manual testing in the console. Exports `ENQUIRY_URL` constant (empty string until Task 5 sets it).

- [ ] **Step 1: Create `app.js`**

```js
import { progress, pickNow, groupRows, isUp, fmtDate, STATUS_ORDER } from './lib/board.js';

export const ENQUIRY_URL = '';

const GROUP_LABEL = { in_progress: 'In progress', live: 'Live', in_talks: 'In talks' };
const $ = id => document.getElementById(id);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function cell(label, value) {
  const c = el('div', 'c');
  if (!value) return c;
  c.textContent = label;
  c.appendChild(el('b', null, value));
  return c;
}

function link(href, text, cls) {
  const a = el('a', cls, text + ' ↗');
  a.href = href; a.rel = 'noopener'; a.target = '_blank';
  return a;
}

function renderNow(rows, today) {
  const row = pickNow(rows);
  const panel = $('now');
  if (!row) { panel.classList.add('idle'); return; }
  panel.classList.remove('idle');
  const p = progress(row, today);
  $('now-name').textContent = row.name;
  $('now-note').textContent = row.now_note || row.type || '';
  $('now-days').textContent = p.total > 0 ? `day ${p.day} of ${p.total}` : `day ${p.day}`;
  $('now-bar').style.width = p.pct + '%';
  $('now-start').textContent = row.start ? 'Started ' + fmtDate(row.start) : '';
  $('now-target').textContent = row.target ? 'Target ' + fmtDate(row.target) : '';
}

function renderRow(row, status, today) {
  const r = el('div', 'row ' + (row.status === 'in_progress' ? 'prog' : row.status === 'live' && isUp(status, row.id) ? 'live' : ''));
  r.appendChild(el('span', 'd'));
  const name = el('div', 'name', row.name);
  if (row.client_line) name.appendChild(el('small', null, row.client_line));
  r.appendChild(name);
  if (row.status === 'in_progress') {
    const p = progress(row, today);
    r.appendChild(cell('Started', fmtDate(row.start)));
    r.appendChild(cell('Target', fmtDate(row.target)));
    r.appendChild(cell('Progress', p.total > 0 ? `Day ${p.day} of ${p.total}` : `Day ${p.day}`));
  } else if (row.status === 'live') {
    r.appendChild(cell('Type', row.type));
    r.appendChild(cell('Went live', fmtDate(row.went_live)));
    r.appendChild(cell('Stack', row.stack));
  } else {
    r.appendChild(cell('Type', row.type));
    r.appendChild(cell('Stage', row.stage));
    r.appendChild(cell('Estimate', row.estimate));
  }
  const links = el('div', 'links');
  if (row.live_url) links.appendChild(link(row.live_url, row.live_url.replace(/^https?:\/\//, ''), row.status === 'live' && isUp(status, row.id) ? 'on' : ''));
  if (row.repo_url) links.appendChild(link(row.repo_url, 'Code'));
  if (row.link_url) links.appendChild(link(row.link_url, row.link_label || 'Link'));
  r.appendChild(links);
  return r;
}

function renderBoard(rows, status, today) {
  const box = $('board-list');
  box.innerHTML = '';
  const groups = groupRows(rows, m => console.warn(m));
  for (const key of STATUS_ORDER) {
    const list = groups[key];
    if (!list.length) continue;
    const h = el('div', 'grp', GROUP_LABEL[key]);
    h.appendChild(el('span', 'n', String(list.length)));
    box.appendChild(h);
    list.forEach(row => box.appendChild(renderRow(row, status, today)));
  }
  if (!box.children.length) box.appendChild(el('div', 'empty', 'Nothing on the board yet.'));
  box.setAttribute('aria-busy', 'false');
  $('board-updated').textContent = status && status.checked_at ? 'Checked ' + fmtDate(status.checked_at.slice(0, 10)) : '';
}

function boardUnavailable() {
  const box = $('board-list');
  box.innerHTML = '';
  box.appendChild(el('div', 'empty', 'Board unavailable, try again shortly.'));
  box.setAttribute('aria-busy', 'false');
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export async function render(today = new Date()) {
  let rows;
  try { rows = await loadJSON('data/projects.json'); }
  catch (e) { console.error(e); boardUnavailable(); return; }
  let status = null;
  try { status = await loadJSON('data/status.json'); } catch (e) { console.warn('status.json unavailable', e); }
  renderNow(rows, today);
  renderBoard(rows, status, today);
}

function setMsg(text, isError) {
  const m = $('form-msg');
  m.textContent = text;
  m.classList.toggle('err', Boolean(isError));
  m.hidden = false;
}

async function submitEnquiry(e) {
  e.preventDefault();
  const name = $('name'), email = $('email');
  if (!name.value.trim()) { setMsg('Enter your name first.', true); name.focus(); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { setMsg('Enter a valid email address.', true); email.focus(); return; }
  const btn = $('send');
  btn.disabled = true; btn.textContent = 'Sending…';
  const body = {
    name: name.value.trim(), biz: $('biz').value.trim(), email: email.value.trim(),
    phone: $('phone').value.trim(), msg: $('msg').value.trim(), website: $('website').value,
    source: location.href
  };
  try {
    if (!ENQUIRY_URL) throw new Error('no endpoint');
    const res = await fetch(ENQUIRY_URL, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' } });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'rejected');
    btn.textContent = 'Sent';
    setMsg("Received. You'll get a reply within one working day.", false);
  } catch (err) {
    console.warn('enquiry failed', err);
    btn.disabled = false; btn.textContent = 'Send enquiry';
    setMsg("Couldn't send. Email hello@highstreetstack.com instead.", true);
  }
}

$('enquiry').addEventListener('submit', submitEnquiry);
['name', 'email'].forEach(id => $(id).addEventListener('input', () => { $('form-msg').hidden = true; }));
window.HSS = { render };
render();
```

Note: `Content-Type: text/plain` is deliberate. Apps Script web apps only accept cross-origin POSTs without a preflight, and `text/plain` avoids one.

- [ ] **Step 2: Browser check with shipped data**

Run: `npm run serve`, open `http://localhost:8080`.
Expected: panel stays "Next slot open" (no in_progress row); board shows "Live 1" with NLB (grey dot, because status.json has no entry) then "In talks 3"; console has no errors.

- [ ] **Step 3: Browser check with an in_progress row**

Temporarily edit `data/projects.json`: set the NLB row to `"status": "in_progress"`, `"start"` to today minus 5 days, `"target"` to today plus 16 days, `"now_note": "Test note"`. Reload.
Expected: panel shows "Nobody Left Behind", "Test note", "day 5 of 21", bar about 24% wide, "Started …", "Target …"; board group "In progress 1" first. Revert the file with `git checkout data/projects.json`.

- [ ] **Step 4: Browser check for broken JSON and missing status**

Add a trailing comma to `data/projects.json`, reload: expect "Board unavailable, try again shortly." and every other section intact. Revert with `git checkout data/projects.json`. Then set `data/status.json` to `{ "checked_at": "2026-09-26T07:00:00Z", "up": { "nlb": true } }`, reload: expect NLB dot green with glow and the nlbuk.com link green, "Checked 26 Sep 2026" top right. Revert.

- [ ] **Step 5: Browser check for the form with no endpoint**

Submit the form empty: expect "Enter your name first." Fill name and a bad email: expect "Enter a valid email address." Fill valid values and submit: expect "Couldn't send. Email hello@highstreetstack.com instead." and the button re-enabled with values kept.

- [ ] **Step 6: Mobile check**

Resize the browser pane to 400px wide. Expected: no horizontal scroll, board rows stacked, form single column.

- [ ] **Step 7: Run unit tests, then commit**

Run: `npm test`
Expected: all pass.

```bash
git add app.js
git commit -m "Render board and now panel from projects.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Enquiry receiver (Apps Script)

**Files:**
- Create: `apps-script/Code.gs`, `apps-script/README.md`, `apps-script/enquiry.js`, `tests/enquiry.test.mjs`
- Modify: `app.js` (set `ENQUIRY_URL` once Kola deploys)

**Interfaces:**
- Produces: `apps-script/enquiry.js` exports `validateEnquiry(body) -> { ok: true, row: string[] } | { ok: false, error: string, silent?: boolean }`. `Code.gs` contains a copy of the same function (Apps Script cannot import). Web app returns JSON `{ok:true}` or `{ok:false,error}`.

- [ ] **Step 1: Write failing test `tests/enquiry.test.mjs`**

```js
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
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test`
Expected: FAIL, cannot find module `apps-script/enquiry.js`.

- [ ] **Step 3: Create `apps-script/enquiry.js`**

```js
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export function validateEnquiry(body, now = new Date()) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  if (clip(body.website, 10)) return { ok: false, error: 'spam', silent: true };
  const name = clip(body.name, 120);
  const email = clip(body.email, 200);
  if (!name) return { ok: false, error: 'name required' };
  if (!EMAIL.test(email)) return { ok: false, error: 'valid email required' };
  const row = [now.toISOString(), name, clip(body.biz, 200), email, clip(body.phone, 40), clip(body.msg, 2000), clip(body.source, 300)];
  return { ok: true, row };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Create `apps-script/Code.gs`**

```js
// High Street Stack enquiry receiver. Deploy as Web app: Execute as me, Access: Anyone.
var SHEET_NAME = 'Enquiries';
var NOTIFY_TO = Session.getEffectiveUser().getEmail();
var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function clip(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }

function validateEnquiry(body, now) {
  now = now || new Date();
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  if (clip(body.website, 10)) return { ok: false, error: 'spam', silent: true };
  var name = clip(body.name, 120);
  var email = clip(body.email, 200);
  if (!name) return { ok: false, error: 'name required' };
  if (!EMAIL.test(email)) return { ok: false, error: 'valid email required' };
  var row = [now.toISOString(), name, clip(body.biz, 200), email, clip(body.phone, 40), clip(body.msg, 2000), clip(body.source, 300)];
  return { ok: true, row };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rateLimited(key) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 3600);
  return n > 5;
}

function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['Received', 'Name', 'Business', 'Email', 'Phone', 'Message', 'Source']);
  }
  return sh;
}

function doGet() { return json({ ok: true }); }

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad json' }); }
  var v = validateEnquiry(body);
  if (!v.ok) return json(v.silent ? { ok: true } : { ok: false, error: v.error });
  var key = 'ip:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, clip(body.email, 200)));
  if (rateLimited(key)) return json({ ok: false, error: 'too many requests' });
  sheet().appendRow(v.row);
  MailApp.sendEmail({
    to: NOTIFY_TO,
    subject: 'New enquiry: ' + v.row[1] + (v.row[2] ? ' (' + v.row[2] + ')' : ''),
    body: 'Name: ' + v.row[1] + '\nBusiness: ' + v.row[2] + '\nEmail: ' + v.row[3] + '\nPhone: ' + v.row[4] + '\n\n' + v.row[5] + '\n\nSource: ' + v.row[6]
  });
  return json({ ok: true });
}
```

Note: the rate-limit key hashes the email because Apps Script does not expose the caller IP. Five posts per email per hour.

- [ ] **Step 6: Create `apps-script/README.md`**

```markdown
# Enquiry receiver

Runs in Kola's Google account. Visitors never see it. £0.

## Deploy (about 10 minutes, once)

1. Go to https://sheets.new and name the spreadsheet `HSS Enquiries`.
2. Extensions → Apps Script. Delete the sample code, paste `Code.gs`, save.
3. Deploy → New deployment → type Web app. Execute as: Me. Who has access: Anyone. Deploy.
4. Authorise when asked. On "Google hasn't verified this app" choose Advanced → Go to project.
5. Copy the Web app URL (ends in `/exec`).
6. In `app.js` set `export const ENQUIRY_URL = '<that URL>';` commit and push.

## Test

Open the URL in a browser: expect `{"ok":true}`.
Submit the site form: a row appears in the `Enquiries` tab and an email arrives.

## Change later

Edit the code, then Deploy → Manage deployments → pencil → Version: New → Deploy. Keep the same deployment so the URL stays the same.
```

- [ ] **Step 7: Commit**

```bash
git add apps-script tests/enquiry.test.mjs
git commit -m "Add enquiry receiver script and validation tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 8: After Kola deploys, set the URL and verify**

Edit `app.js` line `export const ENQUIRY_URL = '';` to the `/exec` URL. Serve locally, submit the form with real values. Expected: "Received…" message, row in the sheet, email in inbox. Then commit:

```bash
git add app.js
git commit -m "Point enquiry form at deployed receiver

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Daily uptime check workflow

**Files:**
- Create: `.github/workflows/ping.yml`, `scripts/ping.mjs`, `tests/ping.test.mjs`

**Interfaces:**
- Produces: `scripts/ping.mjs` exports `targets(rows) -> {id, url}[]` and `buildStatus(results, now) -> { checked_at, up }` where `results` is `{ [id]: boolean }`; running it as a CLI fetches each `live_url` and writes `data/status.json`.

- [ ] **Step 1: Write failing test `tests/ping.test.mjs`**

```js
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
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test`
Expected: FAIL, cannot find module `scripts/ping.mjs`.

- [ ] **Step 3: Create `scripts/ping.mjs`**

```js
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
```

- [ ] **Step 4: Run tests, then run the script for real**

Run: `npm test && node scripts/ping.mjs && cat data/status.json`
Expected: tests pass; output `nlb https://nlbuk.com up`; file shows `"nlb": true` and a fresh `checked_at`.

- [ ] **Step 5: Create `.github/workflows/ping.yml`**

```yaml
name: Daily uptime check
on:
  schedule:
    - cron: '0 7 * * *'
  workflow_dispatch:
permissions:
  contents: write
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: node scripts/ping.mjs
      - name: Commit if changed
        run: |
          git config user.name "hss-bot"
          git config user.email "actions@users.noreply.github.com"
          git add data/status.json
          git diff --cached --quiet && echo "no change" || git commit -m "Update uptime status"
          git push
```

- [ ] **Step 6: Commit**

```bash
git add .github scripts/ping.mjs tests/ping.test.mjs data/status.json
git commit -m "Add daily uptime check that writes status.json

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Publish to GitHub Pages and custom domain

**Files:**
- Create: `docs/launch-checklist.md`
- Modify: none

**Interfaces:**
- Consumes: everything above on `main`.
- Produces: public repo `iamkolaaa/highstreetstack`, Pages enabled, site at `https://iamkolaaa.github.io/highstreetstack/` then `https://highstreetstack.com`.

- [ ] **Step 1: Create the public repo and push**

```bash
gh repo create iamkolaaa/highstreetstack --public --source=. --remote=origin --description "Portfolio: High Street Stack, Kola Salau" --push
```
Expected: repo URL printed; `git log origin/main` matches local.

- [ ] **Step 2: Enable Pages from `main` root**

```bash
gh api -X POST repos/iamkolaaa/highstreetstack/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'
```
Expected: JSON with `"status":"building"` or similar. If it returns 409 (already exists) that is fine.

- [ ] **Step 3: Wait, then check the github.io URL**

Run: `sleep 90; curl -sI https://iamkolaaa.github.io/highstreetstack/ | head -1`
Expected: `HTTP/2 200` (or 301 to the custom domain once step 5 completes). Open it in the browser pane: full page renders, board loads. Note: with `CNAME` present, GitHub may immediately redirect to highstreetstack.com; that is expected once DNS exists.

- [ ] **Step 4: Run the ping workflow once**

```bash
gh workflow run "Daily uptime check" --repo iamkolaaa/highstreetstack && sleep 60 && gh run list --repo iamkolaaa/highstreetstack --limit 1
```
Expected: run status `completed` `success`; a new commit "Update uptime status" if the status changed.

- [ ] **Step 5: Write `docs/launch-checklist.md` for the steps only Kola can do**

```markdown
# Launch checklist (Kola)

## Porkbun DNS for highstreetstack.com (5 minutes)
Delete Porkbun's default A/ALIAS/CNAME records, then add:

| Type | Host | Answer |
|---|---|---|
| A | (blank) | 185.199.108.153 |
| A | (blank) | 185.199.109.153 |
| A | (blank) | 185.199.110.153 |
| A | (blank) | 185.199.111.153 |
| CNAME | www | iamkolaaa.github.io |

## GitHub (2 minutes, after DNS)
Repo → Settings → Pages → Custom domain: `highstreetstack.com` → Save. When the DNS check passes, tick "Enforce HTTPS" (certificate can take up to 24 h).

## highstreetstack.co.uk (2 minutes)
Porkbun → domain → URL forwarding → `https://highstreetstack.com`, type Permanent (301), include path.

## Email (3 minutes)
Porkbun → domain → Email forwarding → `hello` → your Gmail address.

## Enquiry form (10 minutes)
Follow `apps-script/README.md`, then send Claude the `/exec` URL.
```

- [ ] **Step 6: Set the custom domain via API once Kola confirms DNS**

```bash
gh api -X PUT repos/iamkolaaa/highstreetstack/pages -f cname=highstreetstack.com -F https_enforced=false
```
Then after the certificate issues (check with `gh api repos/iamkolaaa/highstreetstack/pages | grep https`):
```bash
gh api -X PUT repos/iamkolaaa/highstreetstack/pages -F https_enforced=true
```

- [ ] **Step 7: Commit the checklist**

```bash
git add docs/launch-checklist.md
git commit -m "Add launch checklist for DNS, domain and email

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```

---

### Task 8: Final verification

**Files:** none created.

- [ ] **Step 1: Live checks**

Open `https://highstreetstack.com` in the browser pane. Expected: HTTPS padlock, page renders, board shows Live 1 with a green NLB dot (after the first ping run), In talks 3. Console: no errors.

- [ ] **Step 2: Mobile**

Browser pane at 400px: no horizontal scroll, stacked rows, single-column form.

- [ ] **Step 3: Lighthouse**

Run in the browser pane's Chrome (or `npx lighthouse` is not allowed: no npm deps). Use Chrome DevTools Lighthouse on the live URL. Expected: Performance ≥ 90, Accessibility ≥ 90. Fix contrast or missing labels if flagged, commit, push.

- [ ] **Step 4: Copy check**

```bash
grep -inE "google|sheet|drive|apps script|data lives" index.html app.js styles.css
```
Expected: no matches in `index.html` and `styles.css`. Matches in `app.js` are allowed only inside the comment about Apps Script and the `ENQUIRY_URL` value.

- [ ] **Step 5: Tag**

```bash
git tag v1.0.0 && git push --tags
```
