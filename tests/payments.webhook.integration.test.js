const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const Stripe = require("stripe");

const stripe = new Stripe("sk_test_local");

function waitForServerStart(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for server to start."));
    }, 10000);

    child.stdout.on("data", (chunk) => {
      const output = String(chunk);
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (!match) return;

      clearTimeout(timeout);
      resolve(`http://127.0.0.1:${match[1]}`);
    });

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before readiness (code ${code}).`));
    });
  });
}

async function sendStripeEvent(baseUrl, secret, event) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });

  const response = await fetch(`${baseUrl}/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
    },
    body: payload,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.received, true);
}

test("Webhook events update payment-status for async and completed checkout outcomes", async () => {
  const webhookSecret = "whsec_local_test";
  const child = spawn("node", ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "0",
      PUBLIC_URL: "https://www.lrcpropertyllc.com",
      ENFORCE_CANONICAL_HOST: "false",
      STRIPE_SECRET_KEY: "sk_test_local",
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stderr = [];
  child.stderr.on("data", (chunk) => {
    stderr.push(String(chunk));
  });

  let baseUrl = "";

  try {
    baseUrl = await waitForServerStart(child);
    const sessionId = "cs_test_123";

    await sendStripeEvent(baseUrl, webhookSecret, {
      id: "evt_async_success",
      object: "event",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: sessionId,
          payment_status: "paid",
          status: "complete",
        },
      },
    });

    const paidResponse = await fetch(`${baseUrl}/payment-status?session_id=${sessionId}`);
    const paid = await paidResponse.json();
    assert.equal(paid.paid, true);
    assert.equal(paid.status, "complete");
    assert.equal(paid.paymentStatus, "paid");

    await sendStripeEvent(baseUrl, webhookSecret, {
      id: "evt_async_failed",
      object: "event",
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: sessionId,
          payment_status: "unpaid",
          status: "open",
        },
      },
    });

    const failedResponse = await fetch(`${baseUrl}/payment-status?session_id=${sessionId}`);
    const failed = await failedResponse.json();
    assert.equal(failed.paid, false);
    assert.equal(failed.status, "open");
    assert.equal(failed.paymentStatus, "unpaid");

    await sendStripeEvent(baseUrl, webhookSecret, {
      id: "evt_completed",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          payment_status: "paid",
          status: "complete",
        },
      },
    });

    const completedResponse = await fetch(`${baseUrl}/payment-status?session_id=${sessionId}`);
    const completed = await completedResponse.json();
    assert.equal(completed.paid, true);
    assert.equal(completed.status, "complete");
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }

  assert.equal(stderr.join("").trim(), "", "Server wrote to stderr during webhook test run");
});
