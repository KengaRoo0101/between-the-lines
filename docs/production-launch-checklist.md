# Between The Lines production launch checklist

This locks the intended production structure:

- `lrcpropertyllc.com` -> LRC Property LLC company landing page
- `betweenthelines.lrcpropertyllc.com` -> Between The Lines app on Render
- Stripe Checkout -> paid full-report unlock

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
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
LOG_REQUESTS=true
```

Do not commit secret values to GitHub.

## 5. Stripe product

Create one product:

```txt
Product: Between The Lines Full Report
Pricing: One-time payment
Starting price: $12.00 or your selected launch price
```

Copy the Stripe `price_...` value into `STRIPE_PRICE_ID` in Render.

## 6. Stripe webhook

Endpoint:

```txt
https://betweenthelines.lrcpropertyllc.com/stripe-webhook
```

Events:

```txt
checkout.session.completed
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET` in Render.

## 7. Smoke tests

After deploy, test:

```txt
https://betweenthelines.lrcpropertyllc.com/healthz
https://betweenthelines.lrcpropertyllc.com/samples/sample-conversation.json
https://lrcpropertyllc.com
```

Then run one test checkout with Stripe test mode before switching to live keys.

## 8. Product positioning

Use this homepage/payment copy:

```txt
Find what others miss.
Structured analysis. Pattern detection. Behavioral signals.
Unlock Full Report
```

Value bullets:

- Timeline anomalies
- Behavioral pattern shifts
- Hidden gaps and inconsistencies
- Clean investigative report
