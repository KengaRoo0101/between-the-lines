# Between The Lines Deploy Notes

This repo now deploys as a hardened legacy redirect service with Stripe/payment routes held closed by default.

## Redirect service

Render settings:

- Build command: `npm install`
- Start command: `npm start`
- Health check endpoint: `GET /healthz`

Required environment variables:

- `NODE_ENV=production`
- `PUBLIC_URL=https://www.lrcpropertyllc.com`
- `FRONTEND_BASE_URL=https://www.lrcpropertyllc.com`
- `ENFORCE_CANONICAL_HOST=true`
- `REDIRECT_TARGET_PATH=/#paywall`
- `LOG_REQUESTS=true`
- `PAYMENTS_ENABLED=false`
- `OWNER_APPROVED_PAYMENTS=false`
- `ALLOW_TEST_KEYS=false`

The redirect service redirects only browser-safe `GET` and `HEAD` traffic. It does not redirect webhook/API `POST` traffic. Checkout and entitlement endpoints return hold-mode responses while payments are disabled.

## Payments runtime, when explicitly enabled later

Start command:

```bash
npm run start:payments
```

Payment collection requires both of these flags:

- `PAYMENTS_ENABLED=true`
- `OWNER_APPROVED_PAYMENTS=true`

It also requires server-side host secrets, not committed files:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DATABASE_URL`
- `STRIPE_PRICE_ID` when using a Stripe dashboard Price

Stripe webhook endpoint:

```text
POST /api/stripe/webhook
```

Do not set Stripe secrets while payment hold mode is active. Rotate any key that was ever committed, pasted into chat, exposed in logs, placed in `render.yaml`, added to client HTML/config, or shared in screenshots.

## Go-live checks

Run before deploying:

```bash
npm run preflight
npm test
```

Run before enabling the payments runtime:

```bash
npm run preflight:payments
```

Do not go live if preflight fails. Do not upload `node_modules/`.
