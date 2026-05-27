const test = require("node:test");
const assert = require("node:assert/strict");
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

test("GET / redirects to the LRC umbrella target", async () => {
  const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
  assert.equal(response.status, 301);
  assert.equal(typeof response.headers.get("x-request-id"), "string");
  assert.match(response.headers.get("location"), /^https:\/\/www\.lrcpropertyllc\.com\/#paywall$/);
});

test("HEAD /between-the-lines redirects without a body", async () => {
  const response = await fetch(`${baseUrl}/between-the-lines`, {
    method: "HEAD",
    redirect: "manual",
  });
  assert.equal(response.status, 301);
  assert.equal(typeof response.headers.get("x-request-id"), "string");
  assert.match(response.headers.get("location"), /^https:\/\/www\.lrcpropertyllc\.com\/#paywall$/);
});

test("POST / rejects non-browser traffic with move message", async () => {
  const response = await fetch(`${baseUrl}/`, { method: "POST" });
  assert.equal(response.status, 410);
  assert.equal(typeof response.headers.get("x-request-id"), "string");

  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.message, "This service has moved under the LRC Property LLC umbrella.");
  assert.match(payload.target, /^https:\/\/www\.lrcpropertyllc\.com\/#paywall$/);
});

test("GET /healthz returns service heartbeat", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.equal(typeof response.headers.get("x-request-id"), "string");

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.service, "lrc-btl-redirect");
  assert.equal(payload.payments.available, false);
  assert.equal(payload.payments.mode, "hold");
  assert.match(payload.target, /^https:\/\/www\.lrcpropertyllc\.com\/#paywall$/);
  assert.equal(typeof payload.now, "string");
});

test("POST /create-checkout-session returns hold response", async () => {
  const response = await fetch(`${baseUrl}/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reportId: "report_1234567890" }),
  });

  assert.equal(response.status, 503);
  assert.equal(typeof response.headers.get("x-request-id"), "string");

  const payload = await response.json();
  assert.equal(payload.available, false);
  assert.equal(payload.mode, "hold");
  assert.match(payload.error, /payments are currently on hold/i);
});

test("POST /api/checkout/session returns hold response", async () => {
  const response = await fetch(`${baseUrl}/api/checkout/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reportId: "report_1234567890" }),
  });

  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.available, false);
  assert.equal(payload.mode, "hold");
  assert.match(payload.error, /payments are currently on hold/i);
});

test("GET /payment-status reports unpaid hold state", async () => {
  const response = await fetch(`${baseUrl}/payment-status?report_id=report_1234567890`);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.available, false);
  assert.equal(payload.mode, "hold");
  assert.equal(payload.reportId, "report_1234567890");
  assert.equal(payload.paid, false);
  assert.equal(payload.paymentStatus, "unpaid");
});
