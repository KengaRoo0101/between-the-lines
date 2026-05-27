# Between The Lines Deploy Notes

This folder is the product.

Render settings:

- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `BTL_TESTER_PASSWORD`
- Environment variable: `PUBLIC_URL=https://www.lrcpropertyllc.com`
- Environment variable: `ENFORCE_CANONICAL_HOST=true` to redirect browser GET/HEAD requests to `PUBLIC_URL`
- Environment variable: `LOG_REQUESTS=true` for launch-day request logs
- Environment variable: `PAYMENTS_ENABLED=false`
- Environment variable: `OWNER_APPROVED_PAYMENTS=false`
- Do not set Stripe secrets while the payment hold is active.
- Health check endpoint: `GET /healthz`
- Traceability: API responses include `X-Request-Id`
- Run `npm run preflight` before going live. It should fail if Stripe secrets are present during the hold.

Do not upload `node_modules/`.
