const fs = require("fs");
const path = require("path");

const { defaultRules } = require("../anomalyRules");
const { parseUpload } = require("../parseUpload");
const { normalizeMessages } = require("../normalizeMessages");
const { analyzeMessages } = require("../analyzeMessages");
const { buildReport } = require("../buildReport");

function buildReportFromFixture({ filename, relativePath }) {
  const fixturePath = path.join(__dirname, "..", relativePath);
  const content = fs.readFileSync(fixturePath, "utf-8");
  const timezone = "UTC";

  const parsedUpload = parseUpload({ filename, content, timezone });
  const normalized = normalizeMessages(parsedUpload);
  const analysis = analyzeMessages(normalized.messages, defaultRules);
  const report = buildReport({
    normalized,
    analysis,
    rules: defaultRules,
    source: {
      filename,
      timezone,
      receivedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    },
  });

  return report;
}

function assertReportShape(report, label) {
  if (!report?.metadata?.sourceName) {
    throw new Error(`Smoke test failed (${label}): metadata.sourceName missing.`);
  }

  if (!Array.isArray(report.groupedFindings)) {
    throw new Error(`Smoke test failed (${label}): groupedFindings missing.`);
  }

  if (!Array.isArray(report.chronology) || report.chronology.length === 0) {
    throw new Error(`Smoke test failed (${label}): chronology is empty.`);
  }
}

function runSmokeTest() {
  const jsonReport = buildReportFromFixture({
    filename: "sample-conversation.json",
    relativePath: "samples/sample-conversation.json",
  });
  assertReportShape(jsonReport, "json");

  const csvReport = buildReportFromFixture({
    filename: "sample-conversation.csv",
    relativePath: "sample-conversation.csv",
  });
  assertReportShape(csvReport, "csv");

  console.log("Smoke test passed for JSON and CSV fixtures.");
}

runSmokeTest();
