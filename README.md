# High Street Stack

Portfolio site for High Street Stack: web development, automation and solutions architecture, Milton Keynes. Live at https://highstreetstack.com.

## Work cards and uptime dots

The work cards are written straight into `index.html`. Each card has a `data-project` id.

`data/projects.json` lists the sites the daily uptime check visits (`.github/workflows/ping.yml`). The result goes to `data/status.json`, and a card gets a green dot when its id is marked up there. To add a project: add a card to `index.html` and a row with the same `id` and a `live_url` to `projects.json`.

## Run locally

```
npm test        # unit tests
npm run validate
npm run serve   # http://localhost:8080
```

## Enquiry form

See `apps-script/README.md`.
