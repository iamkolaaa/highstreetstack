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

## Limits

Five enquiries per email address per hour. Google's free daily email quota applies (100 recipients per day).

## Call bookings (highstreetstack.com/call/)

The same script takes 20-minute call bookings. Each booking:

- adds a row to the `Calls` tab (set Status to `Cancelled` to free the slot),
- puts a 20-minute event in your main Google Calendar,
- emails you, and sends a Telegram message if `TG_TOKEN` and `TG_CHAT` are set under Project Settings → Script properties.

The page hides times already booked and times that clash with anything in your main calendar. All-day events don't block.

Opening hours are `HOURS` near the bottom of `Code.gs` and in `lib/slots.js`. Change both together. Default: Mon–Fri 09:00–18:00, Sat 10:00–14:00, UK time, earliest slot 3 hours ahead, up to 14 days out.

After pasting the new `Code.gs`, deploy a new version (see "Change later") and allow the Calendar permission when Google asks.
