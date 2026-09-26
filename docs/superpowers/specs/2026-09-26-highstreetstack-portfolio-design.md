# High Street Stack — portfolio site design

Date: 26 Sep 2026
Owner: Kola Salau (GitHub `iamkolaaa`)
Status: approved in conversation, awaiting written-spec review

## 1. Purpose

A one-page public portfolio at **highstreetstack.com** that:

1. Positions Kola as a solutions architect for local businesses without a website: site + automation + a CRM the client owns, all £0 to run.
2. Shows a live project board: what is being built now (with day X of Y), what is live, what is in talks.
3. Presents Nobody Left Behind (NLB) as a polished case study.
4. Lets a prospect send an enquiry.
5. Costs £0 to host and run. Only the domain is paid.

Audience: owners of small local businesses (garages, barbers, gyms) in Bletchley and Milton Keynes, plus anyone Kola sends the link to.

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Name | High Street Stack |
| Domains | highstreetstack.com (primary), highstreetstack.co.uk (redirects to .com). Bought by Kola at Porkbun. |
| Hosting | GitHub Pages from public repo `iamkolaaa/highstreetstack`, branch `main`, root folder |
| Visual direction | Option B: dark, monospace data, live status board. Mockup approved: https://claude.ai/artifact/Ls3pmC2GfnmYUMbjBivDHa |
| Project data | A JSON file in the same repo (`data/projects.json`). Kola edits it on github.com from phone or laptop. No Google Sheet. |
| Storage copy | The public page never says where enquiry or project data is stored. No "reads from a Google Sheet", no "data lives in" tiles. |
| NLB repo | Stays private. The site links to nlbuk.com only. No GitHub link for NLB. |
| Display name | Kola Salau, Solutions Architect |
| Contact email shown | hello@highstreetstack.com, forwarded to Kola's Gmail via Porkbun's free email forwarding |

## 3. Architecture

Plain HTML, CSS and JavaScript. No framework, no build step, no npm. One repo, five files that matter:

```
highstreetstack/
  index.html            page markup and copy
  styles.css            design tokens and layout
  app.js                loads data/projects.json, renders board + "now building", handles form
  data/projects.json    the project list (the only file Kola edits day to day)
  data/status.json      written by a GitHub Action: which live URLs answered today
  apps-script/Code.gs   enquiry receiver, deployed in Kola's own Google account
  .github/workflows/ping.yml   daily uptime check
  CNAME                 highstreetstack.com
  docs/                 specs, research, plans
```

### 3.1 Data: `data/projects.json`

One array. One object per project. Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string | slug, unique, e.g. `nlb` |
| `name` | string | shown bold |
| `client_line` | string | one line under the name, e.g. "Garage, Bletchley" |
| `type` | string | e.g. "Site + bookings + reminders" |
| `status` | enum | `live`, `in_progress`, `in_talks`, `paused` |
| `stage` | string | free text for in_talks rows, e.g. "Scoping call" |
| `start` | date or null | ISO `YYYY-MM-DD` |
| `target` | date or null | ISO |
| `went_live` | date or null | ISO, used for live rows |
| `estimate` | string | e.g. "3 weeks", shown for in_talks |
| `stack` | string | e.g. "Netlify · Stripe", shown for live rows |
| `live_url` | string or null | |
| `repo_url` | string or null | shown as "Code ↗" only when present |
| `link_label` / `link_url` | string or null | one extra link, e.g. Maps or Booksy |
| `now_note` | string | one sentence for the "now building" panel; only read from in_progress rows |
| `featured` | bool | true = has a case-study block; only NLB at launch |

Initial content: NLB (`live`, went_live `2026-08-25`, the date the handover doc verified it live), Z Autoz Ltd (`in_talks`), Find More Fitness (`in_talks`), Do It For The Art Studio (`in_talks`). No `in_progress` row is invented. Kola adds one when work starts.

Validation: `app.js` ignores rows with an unknown `status` and logs a console warning. Missing optional fields render as blank, never as "undefined".

### 3.2 Page sections, top to bottom

1. **Top bar**: domain, name and title, location, nav links (Board, Work, Stack, Contact, GitHub).
2. **Hero**: eyebrow, headline "The tech stack for the high street.", one-paragraph lede, four pills (Website, CRM you control, Automation, £0 to run). Right-hand **Now building** panel: driven by the first `in_progress` row ordered by `start`. Shows name, `now_note`, progress bar, "day X of Y", start and target dates. X = days since `start` (clamped to 0), Y = days between `start` and `target`. If there is no `in_progress` row the panel shows "Next slot open" with the contact link instead of hiding.
3. **Project board**: three groups in order In progress, Live, In talks (in_progress first so current work is top). `paused` rows are hidden. Group header shows a count. Row columns depend on status:
   - in_progress: Started, Target, Progress (Day X of Y)
   - live: Type, Went live, Stack
   - in_talks: Type, Stage, Estimate
   Dot colour: amber for in_progress, green for live when `status.json` says the URL answered in the last check, grey otherwise. Links: live URL, Code (if `repo_url`), and the one extra link.
   Footnote under the board: "Green dot means the live site answered the last daily check." Nothing about data sources.
4. **Case study**: one block per `featured` row. Copy for NLB is written into `index.html` (not JSON) because it is prose. Four tiles: Live (link), Delivered, Running cost, Monthly bill to client. No tile about where data lives. Right-hand panel is a six-step sketch of the registration flow, as in the mockup.
5. **What every client gets**: four cards: A fast website, A CRM you control, Automation, Handover. Card two says "Enquiries and bookings land in a system you own and can open from your phone" and does not name the product.
6. **Start a project**: form with name, business, email, phone (optional), message. Submit posts JSON to the Apps Script web app URL. Success replaces the button text with "Sent" and shows "Received. You'll get a reply within one working day." Failure shows "Couldn't send. Email hello@highstreetstack.com instead." Below the form: the email address as selectable text and one line on consent.
7. **Footer**: © line, "Built on GitHub Pages", link to github.com/iamkolaaa.

### 3.3 Enquiry receiver: `apps-script/Code.gs`

Runs in Kola's own Google account, £0.

- `doPost(e)`: parse JSON body; reject if `website` honeypot field is non-empty; require name and email; rate-limit to 5 posts per IP hash per hour using CacheService; append a row to sheet "Enquiries" (timestamp, name, business, email, phone, message, source page); send an email to Kola via MailApp; return `{ok:true}` with CORS headers.
- `doGet`: returns `{ok:true}` so the deployment can be checked in a browser.
- Deployed as Web app, "Execute as: me", "Who has access: Anyone". The deployment URL goes into `app.js` as `ENQUIRY_URL`.
- Kola does the deploy click in his own account. Steps are written into `apps-script/README.md`.

Until the URL is set, `app.js` treats an empty `ENQUIRY_URL` as failure and shows the email fallback. The site still launches.

### 3.4 Uptime check: `.github/workflows/ping.yml`

Daily at 07:00 UTC and on manual trigger. For each row with a `live_url`, `curl -sI --max-time 15` and record `{ "id": true|false, "checked_at": ISO }` into `data/status.json`. Commit only if the file changed. Uses the built-in `GITHUB_TOKEN`. Free on public repos.

### 3.5 Domain and DNS

1. Porkbun DNS for highstreetstack.com: four `A` records to GitHub Pages IPs (185.199.108.153, .109.153, .110.153, .111.153) and a `CNAME` for `www` to `iamkolaaa.github.io`.
2. Repo settings: custom domain `highstreetstack.com`, "Enforce HTTPS" on once the certificate issues (up to 24 h).
3. highstreetstack.co.uk: Porkbun URL forwarding, permanent redirect to https://highstreetstack.com.
4. Porkbun email forwarding: hello@highstreetstack.com to Kola's Gmail.

Kola performs steps that need his Porkbun login. Claude prepares exact values.

## 4. Visual system

From the approved mockup.

- Background `#0D1117`, panel `#131A22`, lines `#25303C`, text `#E8EDF2`, muted `#8C9AA9`.
- Accent amber `#F2B544` for "now building" and the submit button. Green `#3CD68B` for live. Grey for in talks.
- Display face Bricolage Grotesque (Google Fonts), data and body in JetBrains Mono. Real fallback stacks.
- Single dark theme by choice; `color-scheme: dark`.
- Mobile: board rows collapse to a stacked layout at 760px; form goes single column; 16px side gutter.
- `prefers-reduced-motion` disables the progress-bar transition.

## 5. Error handling

| Failure | Behaviour |
|---|---|
| `projects.json` fails to load or parse | Board shows "Board unavailable, try again shortly." Rest of page renders. |
| `status.json` missing | All live dots grey. No error shown. |
| Unknown `status` value | Row skipped, console warning. |
| Enquiry POST fails or URL empty | Inline message with the email fallback. Form values kept. |
| Fonts blocked | Fallback stacks, layout unchanged. |

## 6. Testing

- Open `index.html` via a local static server; check all five sections render with the initial JSON.
- Edit JSON to add an `in_progress` row with start today minus 5 and target today plus 16; confirm "day 5 of 21" and 24% bar.
- Remove the in_progress row; confirm "Next slot open" panel.
- Set an unknown status; confirm row skipped and warning logged.
- Submit the form with `ENQUIRY_URL` empty; confirm fallback message. Then with the real URL; confirm a row lands in the sheet and an email arrives.
- Run the ping workflow manually; confirm `status.json` updates and NLB dot turns green.
- Check at 400px width: no horizontal scroll, board rows stacked.
- Lighthouse on the live URL: performance and accessibility both 90+.

## 7. Out of scope (separate specs)

- Client questionnaires for Z Autoz, Find More Fitness, the barbers.
- The reusable client CRM template (Sheets + Apps Script) and its GDPR paperwork.
- Any client website.
- Pulling last-commit dates from GitHub (no public repos yet).
- Blog, analytics, dark/light toggle, CMS.

## 8. Inputs still needed from Kola

None block the build. Each unblocks one launch step:

1. Domains bought at Porkbun (unblocks DNS).
2. Apps Script deployed from his Google account (unblocks the live form).
3. When NLB phase 2 or any new job starts: add an `in_progress` row with real dates.
