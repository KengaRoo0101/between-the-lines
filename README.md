# Between The Lines

Single-session React app for uploading a JSON or CSV message export and generating a report, plus a separate Node/Express payments runtime for Stripe Checkout.

## Frontend (GitLab Pages static)

The frontend remains static and can be deployed to GitLab Pages.

`index.html` exposes two optional meta tags used by `apiClient.js`:

- `btl-analysis-api-base`: base URL for analysis endpoints (`/api/config`, `/api/analyze`, `/upload`)
- `btl-payments-api-base`: base URL for Stripe checkout + entitlement endpoints

If these are empty, the app uses relative paths.

## Analysis runtime

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Optional: set `LOG_REQUESTS=true` to print one-line request logs in the server console.
API responses include an `X-Request-Id` header to help trace errors in logs.

## Payments runtime (Stripe + PostgreSQL)

```bash
npm run start:payments
```

Required environment variables for the payments runtime:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DATABASE_URL`
- `FRONTEND_BASE_URL` (for success/cancel redirects)

Optional:

- `STRIPE_PRICE_ID` (if omitted, the runtime uses inline USD 12.00 price data)

### Webhook source of truth

Paid access is granted only by Stripe webhook events (`checkout.session.completed` and `checkout.session.async_payment_succeeded`) persisted in PostgreSQL. The redirect query string is only used to know which `report_id` to poll.

### PostgreSQL tables

The payments runtime auto-creates:

- `report_entitlements`
- `processed_webhook_events`

`processed_webhook_events` is used for idempotent webhook processing.

## Tests

```bash
npm test
```

Runs the smoke test plus API integration tests for `/api/config`, `/api/analyze`, `/upload`, and the legacy unconfigured-payments checkout route.

## Structure

- `server.js`: analysis/runtime server and API routes
- `payments-runtime.js`: separate Stripe Checkout + webhook + entitlement runtime
- `app.js`: client-side React app rendered directly in the browser
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
