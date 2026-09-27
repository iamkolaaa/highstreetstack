# White-label CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the High Street Stack CRM: one static web app plus one Supabase schema, deployable per client, with the first tenant being a demo for Do It For The Art Studio (barbers) at diftas-crm.highstreetstack.com.

**Architecture:** New repo `hss-crm`. Pure logic in `lib/` (Node-tested). Static app in `app/` using supabase-js from a CDN, branded per tenant from `app/tenants.json` by hostname. Database schema, row-level security, demo seed and cron in `supabase/migrations/`. An `intake` Edge Function receives website enquiries and bookings. Hosted on Cloudflare Pages from the GitHub repo. A GitHub Action keeps free projects awake and triggers the daily reminder run.

**Tech Stack:** HTML/CSS/ES modules, Node 25 `node --test`, Supabase (Postgres, Auth, Edge Functions, pg_cron), Cloudflare Pages + Turnstile, Resend (email), Porkbun DNS.

**Spec:** `docs/superpowers/specs/2026-09-27-white-label-crm-design.md` (in the highstreetstack repo)

## Global Constraints

- £0 per client to run. No paid services. Supabase free tier, Cloudflare free, Resend free, GitHub free.
- Supabase region `eu-west-2` (London) for every project.
- No secrets in the repo. Anon keys are public and allowed in `tenants.json`; service role keys, Turnstile secret and Resend key live only in Supabase Edge Function secrets.
- Every table has row-level security enabled; only rows readable by users present in `staff`.
- Phone-first: every screen usable at 390px, tap targets 44px, no horizontal scroll.
- Public copy never names Supabase, Cloudflare or Resend. The client sees their own brand only.
- Git commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Hostname not in `tenants.json` (someone opens the Pages default URL): expect a plain "No business configured for this address" page, no crash, no login form; test in Task 2.
2. A logged-in user whose email is not in `staff`: expect an empty app with "Ask the owner to add you" and zero rows returned by RLS; test in Task 3 (SQL) and Task 6 (browser).
3. Intake POST with a booking time in the past or malformed phone: expect 400 with a field error, no rows written; test in Task 2 and Task 4.
4. Demo reset pressed twice quickly: expect exactly one set of seed rows, no duplicates; test in Task 3.
5. Reminder cron running twice in one day (manual trigger plus schedule): expect one reminder per job, not two; test in Task 3.

---

### Task 1: Repo scaffold and tenant config

**Files:**
- Create in `/Users/kolasalau/Downloads/Claude On Mac/hss-crm/`: `package.json`, `.gitignore`, `README.md`, `app/tenants.json`, `scripts/validate-tenants.mjs`, `tests/tenants.test.mjs`, `scripts/serve.mjs`

**Interfaces:**
- Produces: `app/tenants.json` shape `{ "<hostname>": { slug, name, short_name, logo, colour, supabase_url, supabase_anon_key, demo, trade, features: { staff_booking: bool, vehicle_reg: bool } } }`. `validateTenants(obj) -> string[]`.

- [ ] **Step 1: `package.json`**

```json
{
  "name": "hss-crm",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "validate": "node scripts/validate-tenants.mjs",
    "serve": "node scripts/serve.mjs"
  }
}
```

- [ ] **Step 2: `.gitignore`**

```
.DS_Store
node_modules/
.superpowers/
.claude/
supabase/.temp/
.env*
```

- [ ] **Step 3: Failing test `tests/tenants.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTenants } from '../scripts/validate-tenants.mjs';

test('shipped tenants.json is valid', () => {
  const t = JSON.parse(readFileSync(new URL('../app/tenants.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateTenants(t), []);
});

test('rejects missing supabase_url, bad colour, and secret-looking keys', () => {
  const errs = validateTenants({
    'x.test': { slug: 'x', name: 'X', short_name: 'X', logo: '', colour: 'red', supabase_url: '', supabase_anon_key: 'eyJ.service_role.zzz', demo: true, trade: 'barber', features: {} }
  });
  assert.ok(errs.some(e => e.includes('supabase_url')));
  assert.ok(errs.some(e => e.includes('colour')));
  assert.ok(errs.some(e => e.includes('service_role')));
});
```

- [ ] **Step 4: Run, expect module-not-found**

Run: `cd "/Users/kolasalau/Downloads/Claude On Mac/hss-crm" && npm test`
Expected: FAIL, cannot find `scripts/validate-tenants.mjs`.

- [ ] **Step 5: `scripts/validate-tenants.mjs`**

```js
import { readFileSync } from 'node:fs';

const HEX = /^#[0-9a-fA-F]{6}$/;
const TRADES = ['barber', 'garage', 'fitness', 'general'];

export function validateTenants(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['tenants.json must be an object keyed by hostname'];
  for (const [host, t] of Object.entries(obj)) {
    const w = `tenant ${host}`;
    if (!t.slug || !/^[a-z0-9-]+$/.test(t.slug)) errors.push(`${w}: slug must be lowercase letters, digits, dashes`);
    if (!t.name) errors.push(`${w}: missing name`);
    if (!t.short_name) errors.push(`${w}: missing short_name`);
    if (!HEX.test(t.colour || '')) errors.push(`${w}: colour must be a 6-digit hex like #1F7A4D`);
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(t.supabase_url || '')) errors.push(`${w}: supabase_url must look like https://xxxx.supabase.co`);
    if (!t.supabase_anon_key) errors.push(`${w}: missing supabase_anon_key`);
    if ((t.supabase_anon_key || '').includes('service_role')) errors.push(`${w}: key looks like a service_role key; never ship that`);
    if (typeof t.demo !== 'boolean') errors.push(`${w}: demo must be true or false`);
    if (!TRADES.includes(t.trade)) errors.push(`${w}: trade must be one of ${TRADES.join(', ')}`);
    if (!t.features || typeof t.features !== 'object') errors.push(`${w}: features must be an object`);
  }
  return errors;
}

if (process.argv[1] && process.argv[1].endsWith('validate-tenants.mjs')) {
  const t = JSON.parse(readFileSync(new URL('../app/tenants.json', import.meta.url), 'utf8'));
  const errors = validateTenants(t);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`tenants.json ok (${Object.keys(t).length} tenants)`);
}
```

- [ ] **Step 6: `app/tenants.json`** (Supabase URL and anon key are filled in Task 3 once the project exists; use the placeholder format that passes validation until then)

```json
{
  "diftas-crm.highstreetstack.com": {
    "slug": "diftas",
    "name": "Do It For The Art Studio",
    "short_name": "DIFTA",
    "logo": "",
    "colour": "#111111",
    "supabase_url": "https://PLACEHOLDER.supabase.co",
    "supabase_anon_key": "PLACEHOLDER",
    "demo": true,
    "trade": "barber",
    "features": { "staff_booking": true, "vehicle_reg": false }
  },
  "localhost:8081": {
    "slug": "diftas",
    "name": "Do It For The Art Studio",
    "short_name": "DIFTA",
    "logo": "",
    "colour": "#111111",
    "supabase_url": "https://PLACEHOLDER.supabase.co",
    "supabase_anon_key": "PLACEHOLDER",
    "demo": true,
    "trade": "barber",
    "features": { "staff_booking": true, "vehicle_reg": false }
  }
}
```

- [ ] **Step 7: `scripts/serve.mjs`** — copy `scripts/serve.mjs` from the highstreetstack repo, change `ROOT` to `fileURLToPath(new URL('../app/', import.meta.url))` and default `PORT` to 8081.

- [ ] **Step 8: `README.md`**

```markdown
# High Street Stack CRM

One codebase, one Supabase project per client, branded per client. See `docs/runbook.md` for setting up a new client.

npm test · npm run validate · npm run serve (http://localhost:8081)
```

- [ ] **Step 9: Run tests and validator, expect pass**

Run: `npm test && npm run validate`
Expected: 2 tests pass; `tenants.json ok (2 tenants)`.

- [ ] **Step 10: Commit**

```bash
git init -b main && git add -A && git commit -m "Scaffold CRM repo with tenant config and validator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pure logic: tenant resolution, dates, validation

**Files:**
- Create: `lib/tenant.js`, `lib/dates.js`, `lib/validate.js`, `tests/tenant.test.mjs`, `tests/dates.test.mjs`, `tests/validate.test.mjs`

**Interfaces:**
- `resolveTenant(tenants, hostname) -> tenant | null` (exact match, then match ignoring port)
- `londonDayKey(date) -> 'YYYY-MM-DD'` in Europe/London; `isToday(iso, now)`; `fmtTime(iso)` -> `'14:30'`; `fmtDay(iso)` -> `'Sat 27 Sep'`; `groupByDay(jobs) -> [{ day, label, jobs }]`
- `validateEnquiry(body) -> { ok, errors: {field: msg}, value }`; `validateBooking(body, now) -> same` (name, phone UK-ish, email optional, starts_at ISO and in the future, service, staff optional); `normalisePhone(s)` -> `+44…` or original trimmed
- `waLink(phone, text)` -> `https://wa.me/44…?text=…`

- [ ] **Step 1: Failing tests**

`tests/tenant.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTenant } from '../lib/tenant.js';
const T = { 'a.example.com': { slug: 'a' }, 'localhost:8081': { slug: 'local' } };
test('exact hostname match', () => assert.equal(resolveTenant(T, 'a.example.com').slug, 'a'));
test('host with port matches host:port entry', () => assert.equal(resolveTenant(T, 'localhost:8081').slug, 'local'));
test('unknown host returns null', () => assert.equal(resolveTenant(T, 'nope.example.com'), null));
test('case-insensitive', () => assert.equal(resolveTenant(T, 'A.Example.COM').slug, 'a'));
```

`tests/dates.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { londonDayKey, isToday, fmtTime, fmtDay, groupByDay } from '../lib/dates.js';
test('londonDayKey handles BST: 23:30Z on 26 Sep is 27 Sep in London', () => {
  assert.equal(londonDayKey(new Date('2026-09-26T23:30:00Z')), '2026-09-27');
});
test('isToday compares London days', () => {
  assert.equal(isToday('2026-09-26T23:30:00Z', new Date('2026-09-27T08:00:00Z')), true);
  assert.equal(isToday('2026-09-26T10:00:00Z', new Date('2026-09-27T08:00:00Z')), false);
});
test('fmtTime and fmtDay in London time', () => {
  assert.equal(fmtTime('2026-09-27T13:30:00Z'), '14:30');
  assert.equal(fmtDay('2026-09-27T13:30:00Z'), 'Sun 27 Sep');
});
test('groupByDay sorts and groups', () => {
  const g = groupByDay([
    { id: 2, starts_at: '2026-09-28T09:00:00Z' },
    { id: 1, starts_at: '2026-09-27T09:00:00Z' },
    { id: 3, starts_at: '2026-09-27T11:00:00Z' }
  ]);
  assert.deepEqual(g.map(x => x.day), ['2026-09-27', '2026-09-28']);
  assert.deepEqual(g[0].jobs.map(j => j.id), [1, 3]);
});
```

`tests/validate.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnquiry, validateBooking, normalisePhone, waLink } from '../lib/validate.js';
const now = new Date('2026-09-27T10:00:00Z');
test('normalisePhone converts UK mobiles to +44', () => {
  assert.equal(normalisePhone('07700 900123'), '+447700900123');
  assert.equal(normalisePhone('+44 7700 900123'), '+447700900123');
  assert.equal(normalisePhone('not a phone'), 'not a phone');
});
test('validateEnquiry requires name and one contact method', () => {
  assert.equal(validateEnquiry({ name: 'Jay', phone: '07700900123', message: 'hi' }).ok, true);
  const r = validateEnquiry({ name: '', phone: '', email: '', message: 'hi' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.name);
  assert.ok(r.errors.contact);
});
test('validateBooking rejects past times and bad phones', () => {
  const past = validateBooking({ name: 'Jay', phone: '07700900123', service: 'Skin fade', starts_at: '2026-09-26T10:00:00Z' }, now);
  assert.equal(past.ok, false); assert.ok(past.errors.starts_at);
  const bad = validateBooking({ name: 'Jay', phone: '12', service: 'Skin fade', starts_at: '2026-09-28T10:00:00Z' }, now);
  assert.equal(bad.ok, false); assert.ok(bad.errors.phone);
  const good = validateBooking({ name: 'Jay', phone: '07700900123', service: 'Skin fade', starts_at: '2026-09-28T10:00:00Z', staff: 'Marcus' }, now);
  assert.equal(good.ok, true); assert.equal(good.value.phone, '+447700900123');
});
test('validateBooking clips long fields and strips formulas', () => {
  const r = validateBooking({ name: '=1+1', phone: '07700900123', service: 'x'.repeat(300), starts_at: '2026-09-28T10:00:00Z' }, now);
  assert.equal(r.value.name, "'=1+1"); assert.equal(r.value.service.length, 120);
});
test('waLink builds a wa.me link with encoded text', () => {
  assert.equal(waLink('+447700900123', 'Hi Jay, see you tomorrow'), 'https://wa.me/447700900123?text=Hi%20Jay%2C%20see%20you%20tomorrow');
});
```

- [ ] **Step 2: Run, expect module-not-found for all three**

Run: `npm test`
Expected: FAIL on `lib/tenant.js`, `lib/dates.js`, `lib/validate.js`.

- [ ] **Step 3: `lib/tenant.js`**

```js
export function resolveTenant(tenants, hostname) {
  if (!tenants || !hostname) return null;
  const h = hostname.toLowerCase();
  if (tenants[h]) return tenants[h];
  const bare = h.split(':')[0];
  return tenants[bare] || null;
}
```

- [ ] **Step 4: `lib/dates.js`**

```js
const TZ = 'Europe/London';
const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });

export function londonDayKey(date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function isToday(iso, now = new Date()) { return londonDayKey(new Date(iso)) === londonDayKey(now); }
export function fmtTime(iso) { return timeFmt.format(new Date(iso)); }
export function fmtDay(iso) { return dayFmt.format(new Date(iso)).replace(',', ''); }
export function groupByDay(jobs) {
  const sorted = [...jobs].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const map = new Map();
  for (const j of sorted) {
    const day = londonDayKey(new Date(j.starts_at));
    if (!map.has(day)) map.set(day, { day, label: fmtDay(j.starts_at), jobs: [] });
    map.get(day).jobs.push(j);
  }
  return [...map.values()];
}
```

- [ ] **Step 5: `lib/validate.js`**

```js
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const safe = v => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);
const field = (v, n) => safe(clip(v, n));

export function normalisePhone(s) {
  const raw = clip(s, 40);
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^07\d{9}$/.test(digits)) return '+44' + digits.slice(1);
  if (/^\+447\d{9}$/.test(digits)) return digits;
  if (/^447\d{9}$/.test(digits)) return '+' + digits;
  return raw;
}
function validPhone(p) { return /^\+44\d{10}$/.test(p) || /^\+\d{8,15}$/.test(p) || /^0\d{9,10}$/.test(p.replace(/\s/g, '')); }

export function validateEnquiry(body) {
  const errors = {};
  const v = {
    name: field(body.name, 120), phone: normalisePhone(body.phone), email: clip(body.email, 200).toLowerCase(),
    message: field(body.message, 2000), source_page: clip(body.source_page, 300), consent_marketing: Boolean(body.consent_marketing)
  };
  if (!v.name) errors.name = 'Enter your name';
  if (!v.phone && !v.email) errors.contact = 'Enter a phone number or email';
  if (v.phone && !validPhone(v.phone)) errors.phone = 'Enter a valid phone number';
  if (v.email && !EMAIL.test(v.email)) errors.email = 'Enter a valid email';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function validateBooking(body, now = new Date()) {
  const base = validateEnquiry({ ...body, message: body.notes || '' });
  const errors = { ...base.errors };
  const starts = new Date(body.starts_at || '');
  const v = { ...base.value, service: field(body.service, 120), staff: field(body.staff, 80), starts_at: isNaN(starts) ? null : starts.toISOString(), vehicle_reg: field(body.vehicle_reg, 12).toUpperCase() };
  delete errors.contact; if (!v.phone) errors.phone = 'Enter a phone number';
  else if (!validPhone(v.phone)) errors.phone = 'Enter a valid phone number';
  if (!v.service) errors.service = 'Choose a service';
  if (!v.starts_at) errors.starts_at = 'Choose a date and time';
  else if (starts <= now) errors.starts_at = 'Choose a time in the future';
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function waLink(phone, text) {
  const n = normalisePhone(phone).replace(/^\+/, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 6: Run tests, expect all pass**

Run: `npm test`
Expected: pass, 0 fail (2 + 4 + 4 + 5 = 15 tests).

- [ ] **Step 7: Commit**

```bash
git add lib tests && git commit -m "Add tenant, date and validation logic with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Supabase project, schema, RLS, demo seed, cron

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_demo.sql`, `supabase/migrations/0003_reminders.sql`, `docs/db-checks.sql`
- Modify: `app/tenants.json` (real URL and anon key)

**Interfaces:**
- Tables per spec §3 plus `reminders(id, job_id, kind, due_on date, sent_at, unique(job_id, kind, due_on))`.
- Functions: `seed_demo()`, `reset_demo()` (idempotent via a `demo` boolean column on customers/jobs), `queue_reminders()` (inserts tomorrow's reminders, ON CONFLICT DO NOTHING), `is_staff()` used by every RLS policy.
- Cron: `queue_reminders()` daily 07:00 UTC.

- [ ] **Step 1: Create the project through the Supabase connector**

Call `get_cost` with the organization id Kola gives (ask him if unknown), confirm the free cost with `confirm_cost`, then `create_project` name `hss-diftas-demo`, region `eu-west-2`. Wait until status is `ACTIVE_HEALTHY`. Record project ref, URL and anon key. Put URL and anon key into both `app/tenants.json` entries and run `npm run validate`.

- [ ] **Step 2: `0001_schema.sql`**

```sql
create extension if not exists pgcrypto;

create table staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  source text,
  consent_marketing boolean not null default false,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on customers (lower(name));
create index on customers (phone);

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  message text,
  source_page text,
  status text not null default 'new' check (status in ('new','contacted','won','lost')),
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on enquiries (status, created_at desc);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'booked' check (status in ('booked','done','cancelled','no_show')),
  price numeric(10,2),
  deposit_paid boolean not null default false,
  staff text,
  vehicle_reg text,
  notes text,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index on jobs (starts_at);

create table activity (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  kind text not null check (kind in ('call','whatsapp','email','note','system')),
  body text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value text not null
);
insert into settings (key, value) values
  ('business_name', ''), ('reminder_hours_before', '24'), ('retention_months', '24'), ('owner_email', '');

create table reminders (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null check (kind in ('day_before','follow_up')),
  due_on date not null,
  sent_at timestamptz,
  unique (job_id, kind, due_on)
);

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and role = 'owner');
$$;

alter table staff enable row level security;
alter table customers enable row level security;
alter table enquiries enable row level security;
alter table jobs enable row level security;
alter table activity enable row level security;
alter table settings enable row level security;
alter table reminders enable row level security;

create policy staff_read on staff for select using (is_staff());
create policy staff_owner_write on staff for all using (is_owner()) with check (is_owner());
create policy customers_staff on customers for all using (is_staff()) with check (is_staff());
create policy enquiries_staff on enquiries for all using (is_staff()) with check (is_staff());
create policy jobs_staff on jobs for all using (is_staff()) with check (is_staff());
create policy activity_staff on activity for all using (is_staff()) with check (is_staff());
create policy settings_read on settings for select using (is_staff());
create policy settings_owner_write on settings for all using (is_owner()) with check (is_owner());
create policy reminders_staff on reminders for select using (is_staff());

-- First owner bootstrap: the first user to sign in becomes owner if staff is empty.
create or replace function bootstrap_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from staff) then
    insert into staff (user_id, email, display_name, role)
    values (new.id, new.email, coalesce(split_part(new.email, '@', 1), 'Owner'), 'owner');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function bootstrap_owner();
```

- [ ] **Step 3: `0002_demo.sql`**

```sql
create or replace function reset_demo() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from jobs where demo; delete from enquiries where demo; delete from customers where demo;
end $$;

create or replace function seed_demo() returns void
language plpgsql security definer set search_path = public as $$
declare c1 uuid; c2 uuid; c3 uuid; c4 uuid; d date := (now() at time zone 'Europe/London')::date;
begin
  perform reset_demo();
  insert into customers (name, phone, email, source, demo) values ('Jay Patel', '+447700900101', 'jay@example.com', 'website', true) returning id into c1;
  insert into customers (name, phone, source, demo) values ('Marcus Cole', '+447700900102', 'instagram', true) returning id into c2;
  insert into customers (name, phone, source, demo) values ('Tomi Adeyemi', '+447700900103', 'walk-in', true) returning id into c3;
  insert into customers (name, phone, email, source, demo) values ('Sam Wright', '+447700900104', 'sam@example.com', 'website', true) returning id into c4;
  insert into enquiries (customer_id, message, source_page, status, demo) values
    (c1, 'Do you do skin fades on Saturdays? Looking for around 11am.', 'https://demo/booking', 'new', true),
    (c4, 'Can I book a beard trim and hot towel for two people?', 'https://demo/', 'new', true),
    (c2, 'Cheers for last time. Same again next week?', 'https://demo/', 'contacted', true);
  insert into jobs (customer_id, title, starts_at, ends_at, status, price, staff, demo) values
    (c2, 'Skin fade', (d + time '10:00') at time zone 'Europe/London', (d + time '10:45') at time zone 'Europe/London', 'booked', 25, 'Deji', true),
    (c3, 'Beard trim', (d + time '12:30') at time zone 'Europe/London', (d + time '13:00') at time zone 'Europe/London', 'booked', 12, 'Deji', true),
    (c1, 'Skin fade + beard', (d + 1 + time '11:00') at time zone 'Europe/London', (d + 1 + time '12:00') at time zone 'Europe/London', 'booked', 35, 'Kwame', true),
    (c4, 'Kids cut', (d - 3 + time '16:00') at time zone 'Europe/London', (d - 3 + time '16:30') at time zone 'Europe/London', 'done', 15, 'Kwame', true),
    (c3, 'Skin fade', (d - 10 + time '09:30') at time zone 'Europe/London', (d - 10 + time '10:15') at time zone 'Europe/London', 'no_show', 25, 'Deji', true);
end $$;

grant execute on function seed_demo() to authenticated;
grant execute on function reset_demo() to authenticated;
```

- [ ] **Step 4: `0003_reminders.sql`**

```sql
create extension if not exists pg_cron;

create or replace function queue_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with tomorrow as (
    select id from jobs
    where status = 'booked'
      and (starts_at at time zone 'Europe/London')::date = ((now() at time zone 'Europe/London')::date + 1)
  )
  insert into reminders (job_id, kind, due_on)
  select id, 'day_before', (now() at time zone 'Europe/London')::date from tomorrow
  on conflict (job_id, kind, due_on) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

select cron.schedule('queue-reminders', '0 7 * * *', $$select queue_reminders()$$);

-- Retention: purge soft-deleted customers older than retention_months.
create or replace function purge_deleted() returns integer
language plpgsql security definer set search_path = public as $$
declare months integer; n integer;
begin
  select coalesce(nullif(value, '')::int, 24) into months from settings where key = 'retention_months';
  delete from customers where deleted_at is not null and deleted_at < now() - (months || ' months')::interval;
  get diagnostics n = row_count;
  return n;
end $$;
select cron.schedule('purge-deleted', '30 7 * * 0', $$select purge_deleted()$$);
```

- [ ] **Step 5: Apply the three migrations through the connector's `apply_migration`, in order**

Expected: each returns success. Then `execute_sql`: `select count(*) from information_schema.tables where table_schema='public'` → 7. `select count(*) from cron.job` → 2.

- [ ] **Step 6: DB checks `docs/db-checks.sql`, run each through `execute_sql`**

```sql
-- RLS: anon sees nothing
set role anon; select count(*) from customers; reset role;            -- expect 0 rows or permission error
-- Demo seed is idempotent
select seed_demo(); select seed_demo();
select count(*) from customers where demo;                           -- expect 4
select count(*) from jobs where demo;                                -- expect 5
-- Reminder queue is idempotent
select queue_reminders(); select queue_reminders();
select count(*) from reminders;                                      -- expect 1 (the job tomorrow)
```

Expected: values as commented.

- [ ] **Step 7: Enable magic-link auth and set the site URL**

In the Supabase dashboard (Chrome): Authentication → URL configuration → Site URL `https://diftas-crm.highstreetstack.com`, additional redirect `http://localhost:8081`. Authentication → Providers → Email: enable, "Confirm email" off for the demo.

- [ ] **Step 8: Commit**

```bash
git add supabase docs app/tenants.json && git commit -m "Add schema, RLS, demo seed and reminder cron; wire diftas demo project

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `intake` Edge Function

**Files:**
- Create: `supabase/functions/intake/index.ts`, `supabase/functions/intake/validate.js` (copy of `lib/validate.js`), `tests/intake-parity.test.mjs`

**Interfaces:**
- POST JSON `{ kind: 'enquiry'|'booking', turnstile_token, ...fields }` → `200 {ok:true}` or `400 {ok:false, errors}`; CORS `*`; OPTIONS preflight allowed.
- Secrets: `TURNSTILE_SECRET`, `RESEND_API_KEY` (optional), `NOTIFY_TO`, `FROM_EMAIL`.

- [ ] **Step 1: Parity test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('intake validate.js is byte-identical to lib/validate.js', () => {
  const a = readFileSync(new URL('../lib/validate.js', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../supabase/functions/intake/validate.js', import.meta.url), 'utf8');
  assert.equal(a, b);
});
```

- [ ] **Step 2: Run, expect failure (file missing)**. Then `cp lib/validate.js supabase/functions/intake/validate.js`; run, expect pass.

- [ ] **Step 3: `index.ts`**

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateEnquiry, validateBooking } from './validate.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function turnstileOk(token: string, ip: string | null) {
  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (!secret) return true; // demo tenants without Turnstile
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip ?? undefined })
  });
  const d = await r.json(); return Boolean(d.success);
}

async function notify(subject: string, text: string) {
  const key = Deno.env.get('RESEND_API_KEY'); const to = Deno.env.get('NOTIFY_TO'); const from = Deno.env.get('FROM_EMAIL');
  if (!key || !to || !from) return;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject, text }) });
  } catch (e) { console.error('notify failed', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  if (body.hss_ref) return json({ ok: true }); // honeypot
  if (!(await turnstileOk(body.turnstile_token ?? '', req.headers.get('cf-connecting-ip')))) return json({ ok: false, error: 'verification failed' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const kind = body.kind === 'booking' ? 'booking' : 'enquiry';
  const v = kind === 'booking' ? validateBooking(body) : validateEnquiry(body);
  if (!v.ok) return json({ ok: false, errors: v.errors }, 400);
  const val: any = v.value;

  let customerId: string | null = null;
  if (val.phone) { const { data } = await db.from('customers').select('id').eq('phone', val.phone).is('deleted_at', null).limit(1); customerId = data?.[0]?.id ?? null; }
  if (!customerId && val.email) { const { data } = await db.from('customers').select('id').eq('email', val.email).is('deleted_at', null).limit(1); customerId = data?.[0]?.id ?? null; }
  if (!customerId) {
    const { data, error } = await db.from('customers').insert({ name: val.name, phone: val.phone || null, email: val.email || null, source: 'website', consent_marketing: val.consent_marketing }).select('id').single();
    if (error) return json({ ok: false, error: 'could not save' }, 500); customerId = data.id;
  }
  if (kind === 'booking') {
    const { error } = await db.from('jobs').insert({ customer_id: customerId, title: val.service, starts_at: val.starts_at, staff: val.staff || null, vehicle_reg: val.vehicle_reg || null, notes: val.message || null });
    if (error) return json({ ok: false, error: 'could not save' }, 500);
    await notify(`New booking: ${val.name}, ${val.service}`, `${val.name} booked ${val.service} at ${val.starts_at}${val.staff ? ' with ' + val.staff : ''}.\nPhone: ${val.phone}`);
  } else {
    const { error } = await db.from('enquiries').insert({ customer_id: customerId, message: val.message || null, source_page: val.source_page || null });
    if (error) return json({ ok: false, error: 'could not save' }, 500);
    await notify(`New enquiry: ${val.name}`, `${val.name}\n${val.phone || val.email}\n\n${val.message}`);
  }
  return json({ ok: true });
});
```

- [ ] **Step 4: Deploy through the connector's `deploy_edge_function`** with files `index.ts` and `validate.js`, `verify_jwt: false`. Set secrets in the dashboard (Chrome): `NOTIFY_TO` = Kola's Gmail. Leave `TURNSTILE_SECRET` unset for the demo.

- [ ] **Step 5: Live test**

```bash
U=https://<ref>.supabase.co/functions/v1/intake
curl -s -X POST $U -H 'content-type: application/json' -d '{"kind":"enquiry","name":"Curl Test","phone":"07700900199","message":"hello"}'
curl -s -X POST $U -H 'content-type: application/json' -d '{"kind":"booking","name":"Curl Test","phone":"07700900199","service":"Skin fade","starts_at":"2026-01-01T10:00:00Z"}'
```
Expected: first `{"ok":true}`; second `400` with `errors.starts_at`. `execute_sql`: `select name, source from customers where name='Curl Test'` → one row, source `website`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions tests/intake-parity.test.mjs && git commit -m "Add intake Edge Function for website enquiries and bookings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: App shell, branding, login

**Files:**
- Create: `app/index.html`, `app/styles.css`, `app/app.js`, `app/lib/` (symlink-free copies of `lib/*.js` made by `scripts/sync-lib.mjs`), `scripts/sync-lib.mjs`, `tests/lib-sync.test.mjs`

**Interfaces:**
- `app.js` exports nothing; on load: fetch `tenants.json`, `resolveTenant`, apply `--brand` colour and name, create supabase client (UMD from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`), check session, render login or app. Global `window.HSS = { db, tenant, nav }` for screens.
- Login: email field → `signInWithOtp({ email, options: { emailRedirectTo: location.origin } })`, message "Check your email for the link". Also a "Use a password" toggle → `signInWithPassword`.

- [ ] **Step 1: `scripts/sync-lib.mjs`** copies `lib/*.js` to `app/lib/`. Test `tests/lib-sync.test.mjs` asserts each file in `app/lib` equals its `lib` twin (same pattern as intake parity). Run test (fail), run script, run test (pass).

- [ ] **Step 2: `app/index.html`** — one page, sections: `#unconfigured` (hidden), `#login` (hidden), `#app` with header (logo/name, tab bar: Today, Enquiries, Jobs, Customers, Settings) and `<main id="view">`. Demo banner `#demo-banner`. Google Fonts: IBM Plex Sans. Script `app.js` as module after supabase UMD script.

- [ ] **Step 3: `app/styles.css`** — tokens: `--brand` (set from tenant), `--bg #F6F4EE`, `--card #fff`, `--ink #1B1F24`, `--muted #5F6B78`, `--line #DDD8CC`, dark-mode variants. Bottom tab bar fixed on phones with `env(safe-area-inset-bottom)`. Cards for list rows, 44px buttons, `.btn-call` and `.btn-wa` pill buttons.

- [ ] **Step 4: `app/app.js`** — implement per Interfaces. Unknown host → show `#unconfigured` with text "No business configured for this address." Not signed in → `#login`. Signed in but `select from staff` returns 0 rows → `#app` with message "Ask the owner to add you as staff." Otherwise load the Today screen.

- [ ] **Step 5: Browser checks** on `http://localhost:8081` (tenant entry exists) and `http://127.0.0.1:8081` (no entry): first shows login, second shows the unconfigured message. Send a magic link to Kola's Gmail; Kola clicks it; app loads with "Demo data" banner. First sign-in makes him owner (trigger). `execute_sql`: `select role from staff` → owner.

- [ ] **Step 6: Commit**

```bash
git add app scripts tests && git commit -m "Add app shell with tenant branding and magic-link login

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Screens

**Files:**
- Create: `app/screens/today.js`, `app/screens/enquiries.js`, `app/screens/jobs.js`, `app/screens/customers.js`, `app/screens/settings.js`, `app/screens/ui.js` (shared row/button builders), `tests/ui.test.mjs`

**Interfaces:**
- Each screen exports `render(root, ctx)` where `ctx = { db, tenant, nav, now }`.
- `ui.js` exports pure builders used by screens: `jobRow(job, customer)`, `enquiryRow(e, customer)`, `contactButtons(customer, text)` returning DOM; and pure `reminderText(tenant, job, customer)` -> string, tested.

- [ ] **Step 1: Failing test `tests/ui.test.mjs`** for `reminderText`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderText } from '../app/screens/ui.js';
test('reminderText names business, service, day and time', () => {
  const t = reminderText({ short_name: 'DIFTA' }, { title: 'Skin fade', starts_at: '2026-09-28T10:00:00Z', staff: 'Deji' }, { name: 'Jay Patel' });
  assert.equal(t, 'Hi Jay, reminder of your Skin fade with Deji at DIFTA on Mon 28 Sep at 11:00. Reply to change. See you then!');
});
```
`ui.js` must import `fmtDay`/`fmtTime` from `../lib/dates.js` and keep DOM code behind `typeof document !== 'undefined'` guards so Node can import it.

- [ ] **Step 2: Run (fail), implement `ui.js`, run (pass).**

- [ ] **Step 3: Screens**
  - **Today**: jobs where `starts_at` is today (London), ordered; unanswered enquiries (`status='new'`); each row has Call (`tel:`) and WhatsApp (`waLink`) buttons; job rows have Done and No-show buttons that `update` status.
  - **Enquiries**: tabs New / Contacted / Won / Lost; tap "Mark contacted"; "Book" opens a job form prefilled with the customer.
  - **Jobs**: next 14 days grouped by `groupByDay`; "Add job" form: customer search (by name/phone), title, date, time, staff (dropdown from `settings.staff_names` if `features.staff_booking`), price, deposit; vehicle reg field only when `features.vehicle_reg`.
  - **Customers**: search box (ilike on name or phone), profile with jobs, enquiries, activity; "Add note"; "Delete customer" sets `deleted_at` (owner only).
  - **Settings** (owner): business name, owner email, reminder hours, retention months, staff names (comma list), invite staff by email (`insert into staff` requires the user to exist: show the instruction "Ask them to sign in once, then add them here"), Export CSV (customers + jobs, built client-side), Demo section with Seed demo / Reset demo buttons calling `rpc('seed_demo')` / `rpc('reset_demo')`.

- [ ] **Step 4: Browser checks** with the seeded demo: Today shows 2 jobs and 2 new enquiries; Mark contacted moves an enquiry; Add job creates a row (verify by `execute_sql`); Customers search "Jay" finds Jay Patel; Settings → Reset demo empties the lists; Seed demo repopulates; at 390px no horizontal scroll, tab bar visible.

- [ ] **Step 5: Commit**

```bash
git add app tests && git commit -m "Add Today, Enquiries, Jobs, Customers and Settings screens

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Deploy to Cloudflare Pages and DNS

**Files:**
- Create: `docs/runbook.md`, `.github/workflows/keepalive.yml`
- Modify: `README.md`

- [ ] **Step 1: Push the repo**

```bash
gh repo create iamkolaaa/hss-crm --private --source=. --remote=origin --push
```

- [ ] **Step 2: Cloudflare Pages via the dashboard (Chrome, Kola logged in)**: Workers & Pages → Create → Pages → Connect to Git → `iamkolaaa/hss-crm` → build command empty, output directory `app` → Deploy. Then Custom domains → add `diftas-crm.highstreetstack.com`.

- [ ] **Step 3: DNS in Porkbun** (Speedy DNS drawer, the one that works): CNAME `diftas-crm` → `<project>.pages.dev`. Verify: `dig +short diftas-crm.highstreetstack.com @maceio.ns.porkbun.com`.

- [ ] **Step 4: `keepalive.yml`**

```yaml
name: Keep Supabase projects awake and queue reminders
on:
  schedule: [{ cron: '15 7 * * *' }]
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          node -e '
            const t = JSON.parse(require("fs").readFileSync("app/tenants.json","utf8"));
            const seen = new Set();
            (async () => { for (const x of Object.values(t)) { if (seen.has(x.supabase_url) || x.supabase_url.includes("PLACEHOLDER")) continue; seen.add(x.supabase_url);
              const r = await fetch(x.supabase_url + "/rest/v1/settings?select=key&limit=1", { headers: { apikey: x.supabase_anon_key } });
              console.log(x.slug, r.status); } })();'
```
Run once with `gh workflow run`; expect `diftas 401` or `200` (either proves the project answered).

- [ ] **Step 5: `docs/runbook.md`** — the per-client runbook from spec §5 with exact clicks, plus "Turn demo into live": set `demo: false`, Reset demo, add real staff, point the client's site at the intake URL, add Turnstile secret, add Resend.

- [ ] **Step 6: Live check** at `https://diftas-crm.highstreetstack.com`: HTTPS, login, magic link, Today screen with demo data on Kola's phone.

- [ ] **Step 7: Commit and push**

```bash
git add -A && git commit -m "Add keep-alive workflow and client runbook

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push
```

---

### Task 8: Final review

- [ ] Dispatch the fresh reviewer (code-reviewer.md) over the whole repo with the Review Focus list; fix Critical and Important with RED→GREEN tests; ledger the rest; tag `v0.1.0`.
