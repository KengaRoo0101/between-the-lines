# Formed. / Between The Lines

Between The Lines is currently deployed as a legacy redirect service for the LRC Property LLC umbrella host. The repository also contains a guarded Stripe Checkout payments runtime, but payment collection is disabled unless both payment enablement flags and server-side secrets are explicitly configured.

## Current production shape

- `npm start` runs `server.js`, a redirect-only Express service.
- Browser-safe `GET` and `HEAD` requests redirect to the canonical `PUBLIC_URL` plus `REDIRECT_TARGET_PATH`.
- Non-browser methods are not redirected. This prevents webhook/API `POST` requests from being silently forwarded to the wrong host.
- Payment endpoints on the redirect service return a hold response; no checkout session is created from that service.
- `npm run start:payments` runs `payments-runtime.js`, the separate guarded Stripe Checkout + webhook + PostgreSQL entitlement runtime.

## Required go-live environment

Canonical host settings:

```bash
PUBLIC_URL=https://www.lrcpropertyllc.com
FRONTEND_BASE_URL=https://www.lrcpropertyllc.com
ENFORCE_CANONICAL_HOST=true
REDIRECT_TARGET_PATH=/#paywall
NODE_ENV=production
LOG_REQUESTS=true
```

Payment hold defaults:

```bash
PAYMENTS_ENABLED=false
OWNER_APPROVED_PAYMENTS=false
ALLOW_TEST_KEYS=false
```

Do not set Stripe secrets while the payment hold is active. When live payments are intentionally enabled, both `PAYMENTS_ENABLED=true` and `OWNER_APPROVED_PAYMENTS=true` must be set, and the following values must be configured only as server-side environment secrets:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
DATABASE_URL=
EXPECTED_PAYMENT_AMOUNT=1200
EXPECTED_CURRENCY=usd
```

Never commit real Stripe keys, webhook secrets, database URLs, API credentials, screenshots containing secrets, or Render dashboard secret values.

## Stripe key controls

`STRIPE_SECRET_KEY` must be a server-side Stripe secret key or restricted key. A publishable key is rejected. Test keys are rejected for production and only allowed for non-production rehearsal when explicitly permitted with `ALLOW_TEST_KEYS=true`.

`STRIPE_WEBHOOK_SECRET` must be the `whsec_` signing secret for the exact Stripe webhook endpoint being used. Do not reuse a webhook secret from a different endpoint, environment, or mode.

## Webhook handling

The payments runtime exposes:

```text
POST /api/stripe/webhook
```

That route uses `express.raw({ type: 'application/json' })` so Stripe signature verification receives the unmodified request body. The runtime verifies the Stripe signature before processing an event, records processed event IDs in PostgreSQL for idempotency, and stores report entitlements in PostgreSQL rather than memory.

Handled events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Paid access is granted only after an authoritative Stripe Checkout Session confirms `payment_status=paid`. The runtime validates the expected amount, currency, and configured Price ID before marking an entitlement as paid. Failed, expired, rejected, and non-terminal states do not unlock access.

## PUBLIC_URL and canonical host

`PUBLIC_URL` must be the canonical HTTPS production origin. Do not use localhost or a temporary Render domain for go-live unless explicitly rehearsing outside production.

`ENFORCE_CANONICAL_HOST=true` is required for go-live preflight. The redirect target is built from `PUBLIC_URL` and `REDIRECT_TARGET_PATH`, so Stripe success/cancel redirects and browser redirects must use the same canonical origin.

## Server-side secret exposure controls

The redirect service does not serve the repository root as static content. Keep server files, tests, deployment files, package metadata, environment files, and scripts private to the Node process. If static serving is reintroduced later, serve only a dedicated `public/` or `dist/` directory and deny dotfiles.

The preflight script fails if it detects repository-root static serving in runtime files or Stripe secret-looking values in source-controlled files.

## Preflight

Run before deployment:

```bash
npm run preflight
```

Run when validating the payments runtime configuration:

```bash
npm run preflight:payments
```

The checks fail on disabled canonical host enforcement, localhost/non-HTTPS `PUBLIC_URL`, temporary Render public URLs, secret-looking Stripe values in source files, repository-root static serving, mismatched payment flags, or missing/invalid live payment secrets when live payments are enabled.

## Local commands

```bash
npm install
npm start
npm run start:payments
npm test
```

The payments runtime starts in hold mode by default. It requires explicit payment enablement, Stripe secrets, and a PostgreSQL `DATABASE_URL` before it can create Checkout Sessions or process webhooks.
