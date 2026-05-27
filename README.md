# Formed. / Between The Lines

Single-session React app for uploading a JSON or CSV message export and generating a report. Stripe checkout is intentionally held back for now and the payment paths fail closed.
Formed. is the flagship platform layer for LRC Property LLC. It is designed as a practical ecosystem for turning ideas, documents, data, and action into structured products and operating systems.

Between The Lines is the first working tool inside that ecosystem: a single-session React + Node web app for uploading a JSON or CSV message export, normalizing records, running rule-based anomaly detection, and producing a PDF-ready report view.

## Product architecture

- **LRC Property LLC**: parent company, legal layer, future payments, brand, privacy, and product ownership.
- **Formed.**: primary monetizable platform for guided business/product/document/data workflows.
- **Between The Lines**: first module; converts messy conversation exports into structured investigative-style reports.

## Routes

- `/` serves the Formed. landing page.
- `/formed` also serves the Formed. landing page.
- `/between-the-lines` serves the existing Between The Lines app.
- `/samples/sample-conversation.json` serves the sample dataset used by the report demo.
- `/create-checkout-session`, `/payment-status`, and `/api/checkout/*` are hold-only payment paths while Stripe is disabled.

## Frontend (GitLab Pages static)

The frontend remains static and can be deployed to GitLab Pages.

`index.html` exposes two optional meta tags used by `apiClient.js`:

- `btl-analysis-api-base`: base URL for analysis endpoints (`/api/config`, `/api/analyze`, `/upload`)
- `btl-payments-api-base`: reserved payment API base. Checkout remains disabled unless the hold is explicitly reversed in code and config.

If these are empty, the app uses relative paths.

## Analysis runtime

```bash
npm install
npm start
```

Open `http://localhost:3000` for Formed. or `http://localhost:3000/between-the-lines` for the report tool.

Optional: set `LOG_REQUESTS=true` to print one-line request logs in the server console.
API responses include an `X-Request-Id` header to help trace errors in logs.

## Payment hold

Stripe is not live in this repo. Do not set Stripe secrets, do not publish package release workflows, and do not start a payment runtime for production while the hold is active.

Current hold behavior:

- `PAYMENTS_ENABLED=false`
- `OWNER_APPROVED_PAYMENTS=false`
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` must be absent
- checkout creation endpoints return `503` with `mode: "hold"`
- entitlement checks return unpaid hold status
- the browser UI does not initiate checkout

Reversing the hold later should be a separate owner-approved change that restores the Stripe and database dependencies, adds production secrets outside GitHub, runs test-mode checkout first, and updates this document in the same pull request.

For deployment, set `PUBLIC_URL` to the chosen production host, keep `ENFORCE_CANONICAL_HOST=true` when canonical redirects are required, and leave all payment variables false or absent.

## Tests

```bash
npm test
```

Runs the report pipeline smoke test plus integration tests for the redirect service and hold-only payment endpoints.

## Structure

- `server.js`: Express redirect server, request IDs, health check, and payment-hold responses
- `payments-runtime.js`: dormant Stripe Checkout + webhook + entitlement runtime that stays in hold mode unless explicitly re-enabled
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

## Future monetization path

Do not activate payments until LRC explicitly reverses the current hold. The likely path later is still:

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
