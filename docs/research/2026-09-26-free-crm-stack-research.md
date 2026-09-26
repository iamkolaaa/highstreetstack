# Free, client-owned CRM stack for tiny UK businesses — research (26 Sep 2026)

Researched by a Claude subagent with web verification. Limits are as published in Sept 2026; re-check before quoting to a client.

## Ranked shortlist

1. **Google Sheets + Apps Script (+ Cloudflare Turnstile)** — £0 forever, lives in the client's own Google Drive, no third-party automation tool, takes form posts directly. Gap: a free Gmail account has no Art. 28 processor contract with Google.
2. **Zoho CRM Free (or Bigin Free for a one-person shop)** — real CRM, good phone app, native web forms, 3 users, EU data centre for UK sign-ups (UK DC launching 2026), DPA on request; automation thin (5 workflow tasks).
3. **Brevo Free** — EU-hosted, DPA in ToS, forms + 300 emails/day + deal pipeline + mobile app; 1 user, 50 open deals, 1 pipeline.
   Dev-heavy alternative with the best residency story: Supabase (London) + Cloudflare Workers/Turnstile, but you build the UI and must stop the project auto-pausing.

## Comparison (free tiers, verified Sept 2026)

| Stack | Limits that matter | Residency | DPA | Owner / phone | Free-tier risk |
|---|---|---|---|---|---|
| Sheets + Apps Script [1][2] | 20M cells/sheet; consumer acct: 100 email recipients/day, 90 min trigger runtime/day, 6 min/exec, 20k UrlFetch/day | Global (no choice on consumer acct) | Only for Workspace (paid, ~£5.90/user/mo ex VAT) [3][4] | Client's Google acct; Sheets app OK | Very low |
| Airtable Free [5][6] | 1,000 records/base, 5 editors, 1 GB, 1,000 API calls/mo, no interfaces | US-East-1; EU only on Enterprise | On request | Client acct; good app | High (cut 1,200→1,000 Feb 2026) |
| Notion Free [7][8] | 10 guests, 5 MB uploads, 7-day history, no DB automations, 1,000-block cap once 2+ members | US; EU Enterprise only | Std terms | Good app | Medium |
| Supabase Free [9][10][11] | 500 MB DB, 50k MAU, 500k edge invocations, 2 projects, paused after 1 week inactivity | London eu-west-2 selectable | Yes incl. UK Addendum | No UI (build one) | Medium |
| Firebase Spark [12][13][14] | Firestore 1 GiB, 50k reads/20k writes/day; Functions may require Blaze (card) | europe-west2 London | Google Cloud CDPA | No UI | Low |
| Cloudflare Workers + D1 [15][16][17][18] | 100k req/day; D1 5M rows read/100k written per day, 5 GB; Turnstile 20 widgets | D1 "weur" hint only | Yes incl. UK Addendum | No UI | Low |
| Baserow Cloud Free [19][20] | 3,000 rows, 2 GB, 2,000 automation credits/mo | Amsterdam | Paid plans only (reported) | Web app | Medium |
| NocoDB Cloud Free [21] | 1,000 records, 3 editors, 100 automation runs, 1,000 API calls/mo | Not published | Not published | Web app | Medium-high |
| HubSpot Free [22][23][24] | ~2 users, branded forms, one auto follow-up per form, no workflows | DC by sign-up IP; free can't change | DPA in ToS | Good app | Medium |
| Zoho CRM Free [25][26][27] | 3 users, 5,000 records, 1 GB, workflows 5 tasks, web forms | US/NL/IE by IP; UK DC announced 2026 | On request | Excellent app | Low |
| Bigin Free [28] | 1 user, 500 records, 1 pipeline, 3 workflows, web forms, 1 booking page | As Zoho | As Zoho | Excellent app | Low |
| Brevo Free [29][30][31] | 300 emails/day, 100k contacts, 1 user, 50 open deals | EU only | In ToS | Good app | Low |
| Make Free [32] | 1,000 credits/mo, 2 active scenarios, 15-min interval | EU | Yes | — | Medium |
| Zapier Free [33] | 100 tasks/mo, two-step only, 15-min polling | US | Yes | — | Medium |
| n8n [34] | No free cloud; Community edition only if self-hosted | — | — | — | — |
| Formspree Free [35] | 50 submissions/mo, no Sheets integration | US | — | — | — |
| Web3Forms Free [36] | 250/mo, no webhooks | — | — | — | — |
| Netlify Forms [37][38] | Legacy free: 100/mo, all sites paused at 100%; credit-based Free says "unlimited" | US | Yes | — | Medium |
| Google Forms [39] | Unlimited responses | As Google | As Google | — | Very low |

## Architecture for #1 (Sheets + Apps Script)

**Ownership.** Client creates or uses their own Google account. Freelancer is added as Editor and removed at handover. Sheet, bound Apps Script, web-app deployment and triggers are created and authorised FROM THE CLIENT'S ACCOUNT (triggers run as their creator and die if that account loses access).

**Data model (one spreadsheet).** Tabs: `Contacts`, `Enquiries`, `Jobs/Bookings`, `Notes`, `Settings` (owner email, retention months). Turnstile secret in Script Properties, not a cell. Dropdowns for Status (New / Contacted / Booked / Done). Filter views "Today", "This week", "Unanswered".

**Form → CRM.** Static site form + Cloudflare Turnstile (client's own Cloudflare account) + honeypot. JS fetch POST to the Apps Script Web App URL ("Execute as: me", "Access: Anyone"). `doPost()` verifies Turnstile via siteverify, rate-limits by IP hash with CacheService, validates, appends a row (timestamp, source page, consent flag, status New), emails owner via MailApp, optional acknowledgement to customer. Zero-code fallback: embedded Google Form linked to the same sheet.

**Reminders.** Time-driven trigger 08:00 Europe/London: bookings due tomorrow + enquiries unanswered >24h → email reminders; writes a pre-filled `https://wa.me/44…?text=` link into a WhatsApp column so the owner taps to send from their phone. SMS has no free tier; skip. WhatsApp Cloud API charges per template message [40].

**On the phone.** Google Sheets app with filter views; optional HtmlService page from the same script giving a tap-friendly "today's jobs / new enquiries" list with status buttons. New bookings via a Google Form shortcut on the home screen.

## GDPR must-dos (freelancer as processor)

- Service agreement with Art. 28 processor terms (scope, confidentiality, deletion on exit, sub-processors: Google, Cloudflare). Remove own access at handover; confirm in writing.
- Privacy notice on the site names processors, purposes, retention, international transfers (UK-US data bridge / SCCs). Link Google DPA [3] only if Workspace; otherwise document the consumer-account gap and the client's decision. Cloudflare DPA [17].
- Forms: replying to an enquiry needs no consent (contract / legitimate interest); marketing follow-ups need an unticked opt-in (PECR). Privacy link under the form; collect only what's needed.
- Retention trigger deletes enquiries older than N months; DSAR = filter + delete.
- Security: 2-step verification on client's Google account; share only with named accounts; HTTPS only; breach procedure written. Check whether client must pay the ICO fee.

## Gotchas

- Consumer Gmail: no DPA, no residency control. Fix inside Google = Workspace Business Starter (~£5.90/user/mo). Otherwise put personal data in Zoho/Brevo and keep Sheets as a reporting mirror.
- Apps Script: 6-min execution cap; "unverified app" warning when client authorises their own script; web-app URL changes if you create a new deployment instead of updating; MailApp counts against client's daily recipients.
- Airtable caps + Feb 2026 cuts make it unsuitable for a walk-away install.
- Supabase free pauses after a week idle; Netlify legacy free pauses all sites at 100 submissions; Formspree free won't write to Sheets; Web3Forms free has no webhooks; Make/Zapier free are 15-min polling; n8n cloud has no free plan.
- HubSpot free can't choose region; Zoho DPA by email; Zoho/HubSpot assign region by sign-up IP, so sign up from the UK.

## Sources
[1] https://developers.google.com/apps-script/guides/services/quotas
[2] https://support.google.com/drive/answer/37603
[3] https://support.google.com/google-workspace-individual/answer/10757067 ; https://workspace.google.com/terms/dpa_terms.html
[4] https://refractiv.co.uk/news/google-workspace-cost-uk-pricing/
[5] https://support.airtable.com/docs/airtable-plans
[6] https://support.airtable.com/docs/gdpr-at-airtable ; https://www.getpricepulse.com/companies/airtable-pricing.html
[7] https://www.notion.com/pricing ; https://www.notion.com/help/understanding-block-usage
[8] https://www.notion.com/help/data-residency
[9] https://supabase.com/pricing
[10] https://supabase.com/docs/guides/platform/regions
[11] https://supabase.com/legal/dpa
[12] https://firebase.google.com/pricing
[13] https://firebase.google.com/docs/firestore/locations
[14] https://firebase.google.com/support/privacy
[15] https://developers.cloudflare.com/workers/platform/pricing/
[16] https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/d1/configuration/data-location/
[17] https://www.cloudflare.com/cloudflare-customer-dpa/
[18] https://developers.cloudflare.com/turnstile/plans/
[19] https://baserow.io/pricing
[20] https://baserow.io/faq ; https://baserow.io/blog/gdpr-compliant-database
[21] https://nocodb.com/pricing
[22] https://www.spotdev.co.uk/blog/is-hubspot-free
[23] https://knowledge.hubspot.com/account-security/hubspot-cloud-infrastructure-and-data-hosting-frequently-asked-questions
[24] https://legal.hubspot.com/dpa ; https://legal.hubspot.com/terms-of-service
[25] https://www.zoho.com/crm/free-crm.html
[26] https://help.zoho.com/portal/en/kb/vault/frequently-asked-questions-faqs/data-security-and-privacy/articles/where-are-your-data-centers-hosted ; https://datacentrereview.com/2026/04/zoho-confirms-launch-plans-for-uk-data-centre/
[27] https://www.zoho.com/gdpr.html
[28] https://www.bigin.com/pricing.html
[29] https://help.brevo.com/hc/en-us/articles/208580669
[30] https://help.brevo.com/hc/en-us/articles/360001005510
[31] https://help.brevo.com/hc/en-us/articles/15403782599570
[32] https://www.make.com/en/pricing
[33] https://zapier.com/pricing
[34] https://n8n.io/pricing/
[35] https://formspree.io/plans
[36] https://web3forms.com/pricing
[37] https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/billing-faq-for-legacy-plans
[38] https://docs.netlify.com/manage/forms/usage-and-billing/ ; https://www.netlify.com/pricing/
[39] https://support.google.com/docs/answer/139706
[40] https://developers.facebook.com/docs/whatsapp/pricing

Note: Brevo's and Web3Forms' own pricing pages blocked automated fetches; figures from Brevo help centre and a third-party mirror. HubSpot free seat count from a UK partner blog.
