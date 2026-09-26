# Launch checklist (Kola)

## Porkbun DNS for highstreetstack.com (5 minutes)
Porkbun → Domain management → highstreetstack.com → DNS. Delete Porkbun's default A / ALIAS / CNAME records, then add:

| Type | Host | Answer |
|---|---|---|
| A | (blank) | 185.199.108.153 |
| A | (blank) | 185.199.109.153 |
| A | (blank) | 185.199.110.153 |
| A | (blank) | 185.199.111.153 |
| CNAME | www | iamkolaaa.github.io |

## GitHub (2 minutes, after DNS)
Already set: custom domain `highstreetstack.com` on https://github.com/iamkolaaa/highstreetstack/settings/pages. When the DNS check there passes, tick "Enforce HTTPS" (certificate can take up to 24 h).

## highstreetstack.co.uk (2 minutes)
Porkbun → highstreetstack.co.uk → URL forwarding → `https://highstreetstack.com`, type Permanent (301), include path.

## Email (3 minutes)
Porkbun → highstreetstack.com → Email forwarding → `hello` → your Gmail address.

## Enquiry form (10 minutes)
Follow `apps-script/README.md`, then send Claude the `/exec` URL.
