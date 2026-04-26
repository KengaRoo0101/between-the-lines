# Between The Lines Deploy Notes

This folder is the product.

Render settings:

- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `BTL_TESTER_PASSWORD`
- Environment variable: `PUBLIC_URL=https://www.lrcpropertyllc.com`
- Environment variable: `ENFORCE_CANONICAL_HOST=true` to redirect browser GET/HEAD requests to `PUBLIC_URL`
- Environment variable: `LOG_REQUESTS=true` for launch-day request logs
- Health check endpoint: `GET /healthz`
- Traceability: API responses include `X-Request-Id`
- Run `npm run preflight` before going live (`ALLOW_TEST_KEYS=true` only for non-production rehearsals)

Do not upload `node_modules/`.
