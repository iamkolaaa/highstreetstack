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
