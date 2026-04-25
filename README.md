# Between The Lines

Single-session React + Node web app for uploading a JSON or CSV message export, normalizing records, running rule-based anomaly detection, and producing a PDF-ready report view.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

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
