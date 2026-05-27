# Between The Lines hold-safe launch checklist

This checklist keeps the public service live without turning on Stripe.

- `lrcpropertyllc.com` -> LRC Property LLC company landing page
- `betweenthelines.lrcpropertyllc.com` -> Between The Lines redirect/service host if needed
- Stripe Checkout -> held back, no live checkout

## 1. Cloudflare DNS

### Company root

Create or keep one record for the root domain:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | Cloudflare Pages project hostname | Proxied / orange cloud |

Remove conflicting `A` records or old root-domain CNAME records that point at Render.

### App subdomain

Create or keep this record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `betweenthelines` | `between-the-lines-po4k.onrender.com` | Proxied / orange cloud |

## 2. Cloudflare Pages landing page

Deploy `landing/lrcpropertyllc/index.html` as the static company landing page.

Then add the custom domain:

```txt
lrcpropertyllc.com
```

## 3. Render custom domain

In the Between The Lines Render web service, add:

```txt
betweenthelines.lrcpropertyllc.com
```

Render start command should remain:

```txt
node server.js
```

The repo start script is already correct:

```json
"start": "node server.js"
```

## 4. Render environment variables

Set these in Render for the app service:

```txt
PUBLIC_URL=https://betweenthelines.lrcpropertyllc.com
PAYMENTS_ENABLED=false
OWNER_APPROVED_PAYMENTS=false
LOG_REQUESTS=true
```

Do not set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, or `STRIPE_WEBHOOK_SECRET` while the hold is active. Do not commit secret values to GitHub.

## 5. Stripe hold

Do not create or attach a live Stripe product for this deployment. Checkout endpoints should return hold responses:

```txt
POST /create-checkout-session -> 503
POST /api/checkout/session -> 503
GET /payment-status -> paid: false, mode: hold
```

Re-enable payments only in a separate owner-approved change that restores dependencies, secrets, webhook handling, and test-mode checkout verification.

## 6. Smoke tests

After deploy, test:

```txt
https://betweenthelines.lrcpropertyllc.com/healthz
https://lrcpropertyllc.com
```

Also confirm checkout creation does not return a Stripe URL.

## 7. Product positioning

Use this homepage copy without payment language:

```txt
Find what others miss.
Structured analysis. Pattern detection. Behavioral signals.
```

Value bullets:

- Timeline anomalies
- Behavioral pattern shifts
- Hidden gaps and inconsistencies
- Clean investigative report
