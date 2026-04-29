const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { startServer } = require("../server");

let server;
let baseUrl;

test.before(async () => {
  server = startServer(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("GET / serves the Formed platform landing page", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.equal(typeof response.headers.get("x-request-id"), "string");

  const html = await response.text();
  assert.match(html, /<title>Formed\. by LRC Property LLC<\/title>/);
  assert.match(html, /Move from stuck to structured\./);
});

test("GET /between-the-lines serves the Between The Lines app shell", async () => {
  const response = await fetch(`${baseUrl}/between-the-lines`);
  assert.equal(response.status, 200);
  assert.equal(typeof response.headers.get("x-request-id"), "string");

  const html = await response.text();
  assert.match(html, /<title>Between The Lines<\/title>/);
  assert.match(html, /<div id="root"><\/div>/);
});

test("GET /api/config returns default rules", async () => {
  const response = await fetch(`${baseUrl}/api/config`);
  assert.equal(response.status, 200);
  assert.equal(typeof response.headers.get("x-request-id"), "string");

  const payload = await response.json();
  assert.equal(typeof payload.rules, "object");
  assert.equal(typeof payload.rules.gapHours, "number");
  assert.equal(typeof payload.rules.spikeMultiplier, "number");
});

test("GET /healthz returns service heartbeat", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.equal(typeof response.headers.get("x-request-id"), "string");

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.service, "formed-platform");
  assert.equal(typeof payload.now, "string");
});

test("Unknown API route returns JSON 404 and requestId", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-real-route`, {
    headers: {
      Accept: "application/json",
    },
  });
  assert.equal(response.status, 404);
  assert.equal(typeof response.headers.get("x-request-id"), "string");

  const payload = await response.json();
  assert.equal(payload.error, "Not found");
  assert.equal(typeof payload.requestId, "string");
});

test("POST /api/analyze returns report payload from sample JSON", async () => {
  const samplePath = path.join(__dirname, "..", "samples", "sample-conversation.json");
  const content = fs.readFileSync(samplePath, "utf-8");

  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: "sample-conversation.json",
      content,
      timezone: "UTC",
    }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.report.metadata.sourceName, "sample-conversation.json");
  assert.equal(Array.isArray(payload.report.groupedFindings), true);
  assert.equal(Array.isArray(payload.sections.keyFindings), true);
});

test("POST /upload accepts CSV fixture and returns report payload", async () => {
  const samplePath = path.join(__dirname, "..", "sample-conversation.csv");
  const content = fs.readFileSync(samplePath);
  const boundary = `----BTLBoundary${Date.now()}`;
  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name=\"file\"; filename=\"sample-conversation.csv\"\r\n` +
        `Content-Type: text/csv\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.report.metadata.sourceType, "CSV");
  assert.equal(payload.report.scope.analyzedMessages > 0, true);
});

test("POST /create-checkout-session returns 503 when Stripe is not configured", async () => {
  const response = await fetch(`${baseUrl}/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.match(payload.error, /payments are not configured/i);
});
