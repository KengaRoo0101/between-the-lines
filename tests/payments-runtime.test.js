const test = require("node:test");
const assert = require("node:assert/strict");

const { app, paymentsAllowed } = require("../payments-runtime");

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
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

test("payments runtime is held by default", () => {
  assert.equal(paymentsAllowed(), false);
});

test("payments runtime health reports hold mode without Stripe dependencies", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.available, false);
  assert.equal(payload.mode, "hold");
});

test("payments runtime does not create checkout sessions during hold", async () => {
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
  assert.match(payload.error, /checkout is currently on hold/i);
});

test("payments runtime entitlement stays unpaid during hold", async () => {
  const response = await fetch(`${baseUrl}/api/checkout/entitlement/report_1234567890`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.available, false);
  assert.equal(payload.mode, "hold");
  assert.equal(payload.paid, false);
  assert.equal(payload.paymentStatus, "unpaid");
});
