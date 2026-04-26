# Between The Lines

Single-session React + Node web app for uploading a JSON or CSV message export, normalizing records, running rule-based anomaly detection, and producing a PDF-ready report view.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Optional: set `LOG_REQUESTS=true` to print one-line request logs in the server console.
API responses include an `X-Request-Id` header to help trace errors in logs.

## Tests

```bash
npm test
```

Runs the pipeline smoke test plus API integration tests for `/api/config`, `/api/analyze`, `/upload`, and the unconfigured-payments checkout path.

## Launch preflight

```bash
npm run preflight
```

Checks that `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PUBLIC_URL` are set and that `PUBLIC_URL` is valid HTTPS.
For go-live it also requires `ENFORCE_CANONICAL_HOST=true`, a non-localhost `PUBLIC_URL`, and a non-test Stripe secret key (unless `ALLOW_TEST_KEYS=true`).

## Custom domain setup

If you bought a domain and want checkout redirects to use it:

1. Add your domain in Render custom domains for this service.
2. Point your DNS records to Render (per Render’s dashboard instructions).
3. Set `PUBLIC_URL=https://www.lrcpropertyllc.com` in your environment variables.
4. Set `ENFORCE_CANONICAL_HOST=true` if you want the app to 301-redirect browser GET/HEAD traffic to `PUBLIC_URL`.
5. Keep `lrcpropertyllc.com` as a redirect to `www.lrcpropertyllc.com` so one canonical host is used.
6. Redeploy so Stripe success/cancel URLs use the new host.

For production checks, use `GET /healthz` to verify the service is up.

## Stripe webhook events

For payment status updates, configure these webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

## Structure

- `server.js`: Express server and API routes (`/api/config`, `/api/analyze`, `/upload`, payments, analytics)
- `app.js`: client-side React app (ES module) rendered directly in the browser
- `apiClient.js`: browser API helper functions used by the app
- `index.html`: static shell that loads `app.js`
- `styles.css`: global styling and print styles
- `anomalyRules.js`: default thresholds and rule-override merge
- `parseUpload.js`: JSON/CSV parsing and field mapping
- `normalizeMessages.js`: normalization, sorting, deduping, and data-quality notes
- `analyzeMessages.js`: rule-based anomaly detection and visual summary data
- `buildReport.js`: final report payload assembly
- `csv.js`: lightweight CSV parser
- `samples/`: sample datasets used for preview mode

## Data flow

1. `parseUpload` reads JSON/CSV and maps source fields.
2. `normalizeMessages` cleans and deduplicates rows.
3. `analyzeMessages` applies threshold rules to detect patterns.
4. `buildReport` creates the final report object consumed by the UI.

## PDF export

Use the in-app **Print / Export PDF** action. The browser print flow is tuned for “Save as PDF”.
