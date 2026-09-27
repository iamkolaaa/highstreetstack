# High Street Stack CRM — white-label client CRM design

Date: 27 Sep 2026
Owner: Kola Salau
Status: APPROVED by Kola on 27 Sep 2026 ("Go")

## 1. Purpose

A small CRM that Kola sets up for each client and charges a monthly fee for. It must:

1. Cost Kola £0 per client to run. Clients only pay Supabase if they outgrow the free tier.
2. Look like the client's own product: their name, logo and colours, on their own address (for example crm.zautoz.co.uk).
3. Hold UK customer data properly: London region, encrypted, a signed data-processing agreement, per-user login, nothing public.
4. Be one codebase. A fix for one client ships to every client.
5. Be usable on a phone by a non-technical owner: today's jobs, unanswered enquiries, tap to call or WhatsApp.
6. Receive enquiries and bookings straight from the client's website.

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Database | Supabase, Postgres, London region (eu-west-2) | Free tier 500 MB, built-in login, row-level security, DPA with UK addendum |
| Project per client | One Supabase project per client | Hard data separation; a client can take their project with them |
| Account holder | Kola's Supabase account to start; can be transferred to the client later | Kola's account is already connected; free plan allows 2 active projects, so from client three onward either the client signs up for their own account (£0) or Kola upgrades to Pro (£20/month) |
| Front-end | One static web app, no framework, hosted on Cloudflare Pages | Free, supports many custom domains on one deployment, private repo allowed. GitHub Pages allows only one custom domain per repo |
| Tenant lookup | The app reads the hostname (crm.zautoz.co.uk) and looks up that client's Supabase URL, public key and branding in a `tenants.json` file in the app | Anon keys are designed to be public; all protection is row-level security in the database |
| Login | Supabase email magic link, plus optional password | No passwords to forget; owner taps a link on their phone |
| Website intake | The client's site posts to a Supabase Edge Function `intake` with Cloudflare Turnstile check | Server-side validation, spam control, no key exposure |
| Notifications | Email via Resend free tier (3,000 a month) from the Edge Function; WhatsApp as pre-filled `wa.me` links, never automated | Free; WhatsApp automation costs money and needs Meta approval |
| Reminders | Supabase cron (pg_cron) runs daily at 08:00 London: day-before booking reminders, MOT-due nudges for garages | Free, inside the database |
| Keep-alive | The existing daily GitHub Action pings each project's REST endpoint | Free projects pause after 7 idle days |

## 3. Data model (same for every client)

```
customers   id, name, phone, email, notes, source, consent_marketing, created_at, deleted_at
enquiries   id, customer_id, message, source_page, status (new/contacted/won/lost), created_at
jobs        id, customer_id, title, starts_at, ends_at, status (booked/done/cancelled/no_show),
            price, deposit_paid, staff, vehicle_reg (garages), notes, created_at
activity    id, customer_id, kind (call/whatsapp/email/note), body, created_at, created_by
settings    key, value  (business name, reminder hours, retention months, opening hours)
staff       user_id, display_name, role (owner/staff)
```

Row-level security: only signed-in users listed in `staff` can read or write. The `intake` Edge Function uses the service key server-side and only inserts. Soft delete for customers, hard purge after `retention_months` via cron.

## 4. Screens (phone first)

1. **Today**: jobs due today, unanswered enquiries, each with Call and WhatsApp buttons.
2. **Enquiries**: list by status, one-tap "mark contacted", convert to job.
3. **Jobs**: day and week list, add job, mark done or no-show.
4. **Customers**: search, profile with history, add note.
5. **Settings**: business details, staff invites, reminder toggles, export all data as CSV, "delete customer" for data requests.

Branding: logo, primary colour, business name from `tenants.json`. Everything else identical across clients.

## 5. Per-client setup runbook (Kola, about 30 minutes)

1. Create Supabase project in London. Note URL and anon key.
2. Run the schema migration and seed `settings`.
3. Deploy the `intake` Edge Function with the client's Turnstile secret and Resend key.
4. Add the client to `tenants.json`, deploy the app.
5. Add custom domain on Cloudflare Pages; client adds one CNAME record.
6. Invite the owner by email; they log in with a magic link.
7. Point the client website form at the intake function.
8. Send the GDPR pack: privacy notice paragraph, DPA links (Supabase, Cloudflare, Resend), retention setting.

## 6. Out of scope for v1

Online payments, calendar sync, SMS, automated WhatsApp, multi-location, invoicing, reports beyond simple counts.

## 7. Decisions from Kola, 27 Sep 2026

1. Supabase projects live in Kola's account. Client-owned accounts are an option later.
2. Kola already has a Cloudflare account. Pages and Turnstile use it.
3. First tenant: Do It For The Art Studio (barbers). Built as a demo first, on a free subdomain, with sample data, for the reveal. Staff-based bookings are in v1 because barbers book per barber.
4. Transactional email needs a sender: Resend free tier (3,000 a month), sending from highstreetstack.com. Kola signs up; Claude adds the DNS records. Until then, magic-link emails use Supabase's built-in sender, which is limited to a few per hour and is fine for the demo.

## 8. Demo mode

Each tenant has a `demo: true|false` flag. Demo tenants get a "Demo data" banner, seeded sample customers and jobs, and a "Reset demo" button in Settings. Turning demo off wipes the sample rows. This is how Kola shows the reveal without touching real data.
