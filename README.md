# Formed. / Between The Lines

Formed. is the flagship platform layer for LRC Property LLC. It is designed as a practical ecosystem for turning ideas, documents, data, and action into structured products and operating systems.

Between The Lines is the first working tool inside that ecosystem: a single-session React + Node web app for uploading a JSON or CSV message export, normalizing records, running rule-based anomaly detection, and producing a PDF-ready report view.

## Product architecture

- **LRC Property LLC**: parent company, legal layer, payments, brand, privacy, and product ownership.
- **Formed.**: primary monetizable platform for guided business/product/document/data workflows.
- **Between The Lines**: first module; converts messy conversation exports into structured investigative-style reports.

## Routes

- `/` serves the Formed. landing page.
- `/formed` also serves the Formed. landing page.
- `/between-the-lines` serves the existing Between The Lines app.
- `/samples/sample-conversation.json` serves the sample dataset used by the report demo.
- `/api/*`, `/upload`, `/create-checkout-session`, and `/payment-status` power the Between The Lines module.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000` for Formed. or `http://localhost:3000/between-the-lines` for the report tool.

Optional: set `LOG_REQUESTS=true` to print one-line request logs in the server console.
API responses include an `X-Request-Id` header to help trace errors in logs.

## Tests

```bash
npm test
```

Runs the pipeline smoke test plus API integration tests for Formed root routing, Between The Lines routing, `/api/config`, `/api/analyze`, `/upload`, and the unconfigured-payments checkout path.

## Launch preflight

```bash
npm run preflight
```

Checks that `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PUBLIC_URL` are set and that `PUBLIC_URL` is valid HTTPS.
For go-live it also requires `ENFORCE_CANONICAL_HOST=true`, a non-localhost `PUBLIC_URL`, and a non-test Stripe secret key (unless `ALLOW_TEST_KEYS=true`).

## Custom domain setup

If you bought a domain and want checkout redirects to use it:

1. Add your domain in Render custom domains for this service.
2. Point your DNS records to Render using Render’s dashboard instructions.
3. Set `PUBLIC_URL=https://www.lrcpropertyllc.com` or the chosen production host in your environment variables.
4. Set `ENFORCE_CANONICAL_HOST=true` if canonical redirects are later re-enabled in `server.js`.
5. Keep alternate hostnames redirected to the canonical host so Stripe success/cancel URLs stay consistent.
6. Redeploy so Stripe success/cancel URLs use the new host.

For production checks, use `GET /healthz` to verify the service is up.

## Structure

- `server.js`: Express server, Formed routing, Between The Lines routing, API routes, payments, and analytics
- `formed.html`: Formed. platform landing page
- `formed.css`: Formed. landing page styling
- `app.js`: client-side React app for Between The Lines rendered directly in the browser
- `apiClient.js`: browser API helper functions used by the app
- `index.html`: Between The Lines app shell that loads `app.js`
- `styles.css`: Between The Lines styling and print styles
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

## Monetization path

Start with the smallest revenue surface that does not distort the product:

1. Free Formed. landing page and free sample report.
2. Paid Between The Lines full report/export.
3. Paid Formed. document packets, checklists, and guided setup flows.
4. Subscription tier for saved projects, repeat reports, templates, and platform history.
5. Higher-priced services layer for implementation support.

Financial actions, paid subscriptions, purchases, and live payment executions require explicit user approval before they are caused or executed.

## Data trust model

Collect only what is needed to produce the requested output, improve product quality, and understand what users find useful. Raw sensitive uploads should not become the default monetization asset. Future data value should come from consented, aggregated, anonymized insight patterns and product analytics.

## PDF export

Use the in-app **Print / Export PDF** action. The browser print flow is tuned for “Save as PDF”.
