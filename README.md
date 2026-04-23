# Signal Report

Single-session React + Node web app for uploading a JSON or CSV message export, normalizing the records, running rule-based anomaly detection, and formatting a PDF-ready report.

## Run

```bash
node server.js
```

Open `http://localhost:3000`.

## Structure

- `server.js`: Node server and JSON API
- `src/config/anomalyRules.js`: default rule thresholds
- `src/lib/parseUpload.js`: JSON/CSV parsing and field mapping
- `src/lib/normalizeMessages.js`: normalization, sorting, deduping, data-quality notes
- `src/lib/analyzeMessages.js`: anomaly detection and visual summary data
- `src/lib/buildReport.js`: report section builder
- `samples/`: sample JSON and CSV datasets

## PDF export

Use the in-app `Export PDF` button. It opens the browser print flow with print styles tuned for Save as PDF.
