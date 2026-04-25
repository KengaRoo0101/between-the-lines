const fs = require("fs");
const path = require("path");

const { defaultRules } = require("../anomalyRules");
const { parseUpload } = require("../parseUpload");
const { normalizeMessages } = require("../normalizeMessages");
const { analyzeMessages } = require("../analyzeMessages");
const { buildReport } = require("../buildReport");

function runSmokeTest() {
  const filename = "sample-conversation.json";
  const samplePath = path.join(__dirname, "..", "samples", filename);
  const content = fs.readFileSync(samplePath, "utf-8");
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

  if (!report?.metadata?.sourceName) {
    throw new Error("Smoke test failed: metadata.sourceName missing.");
  }

  if (!Array.isArray(report.groupedFindings)) {
    throw new Error("Smoke test failed: groupedFindings missing.");
  }

  if (!Array.isArray(report.chronology) || report.chronology.length === 0) {
    throw new Error("Smoke test failed: chronology is empty.");
  }

  console.log("Smoke test passed.");
}

runSmokeTest();
