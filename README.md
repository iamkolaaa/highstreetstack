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
