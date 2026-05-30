const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const Stripe = require("stripe");

const { defaultRules, mergeRules } = require("./anomalyRules");
const { parseUpload } = require("./parseUpload");
const { normalizeMessages } = require("./normalizeMessages");
const { analyzeMessages } = require("./analyzeMessages");
const { buildReport } = require("./buildReport");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const PUBLIC_URL = String(process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const ENFORCE_CANONICAL_HOST = String(process.env.ENFORCE_CANONICAL_HOST || "").toLowerCase() === "true";
const CANONICAL_HOST = (() => {
  try {
    return new URL(PUBLIC_URL).host.toLowerCase();
  } catch {
    return "";
  }
})();
const ALLOWED_ANALYTICS_EVENTS = new Set([
  "landing_page_view",
  "click_upload",
  "click_sample",
  "upload_started",
  "upload_completed",
  "report_viewed",
  "feedback_clicked",
]);
const analyticsEvents = [];
let stripeClient = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const paidCheckoutSessions = new Map();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
});
const parseJson = express.json({ limit: "6mb" });
const ENABLE_REQUEST_LOGS = String(process.env.LOG_REQUESTS || "").toLowerCase() === "true";

function paymentsReady() {
  return Boolean(stripeClient && STRIPE_WEBHOOK_SECRET);
}

function requirePayments(response) {
  if (paymentsReady()) return true;

  response.status(503).json({
    error: "Payments are not configured yet. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET before trying checkout.",
  });
  return false;
}

function markCheckoutSessionPaid(session) {
  if (!session?.id) return;

  paidCheckoutSessions.set(session.id, {
    paid: true,
    paidAt: new Date().toISOString(),
    paymentStatus: session.payment_status || "",
    checkoutStatus: session.status || "",
  });
}

function markCheckoutSessionUnpaid(session) {
  if (!session?.id) return;

  paidCheckoutSessions.set(session.id, {
    paid: false,
    paidAt: null,
    paymentStatus: session.payment_status || "unpaid",
    checkoutStatus: session.status || "open",
  });
}

app.post("/stripe-webhook", express.raw({ type: "application/json" }), (request, response) => {
  if (!paymentsReady()) {
    response.status(503).send("Payments are not configured.");
    return;
  }

  const signature = request.headers["stripe-signature"];
  if (!signature) {
    response.status(400).send("Missing Stripe signature.");
    return;
  }

  let event;

  try {
    event = stripeClient.webhooks.constructEvent(request.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    response.status(400).send(`Webhook Error: ${error.message}`);
    return;
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    markCheckoutSessionPaid(event.data.object);
  }

  if (event.type === "checkout.session.async_payment_failed") {
    markCheckoutSessionUnpaid(event.data.object);
  }

  response.json({ received: true });
});

app.use(parseJson);

app.use((request, response, next) => {
  const requestId = crypto.randomUUID();
  request.requestId = requestId;
  response.set("X-Request-Id", requestId);
  next();
});

if (ENFORCE_CANONICAL_HOST && CANONICAL_HOST && !CANONICAL_HOST.includes("localhost")) {
  app.use((request, response, next) => {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      next();
      return;
    }

    const requestHost = String(request.get("host") || "").toLowerCase();
    if (!requestHost || requestHost === CANONICAL_HOST) {
      next();
      return;
    }

    const redirectUrl = `${PUBLIC_URL}${request.originalUrl || "/"}`;
    response.redirect(301, redirectUrl);
  });
}

if (ENABLE_REQUEST_LOGS) {
  app.use((request, response, next) => {
    const startedAt = Date.now();

    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      console.log(`[${new Date().toISOString()}] [${request.requestId}] ${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`);
    });

    next();
  });
}

function parseRules(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
const crypto = require("node:crypto");
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = String(process.env.PUBLIC_URL || "https://www.lrcpropertyllc.com").replace(/\/+$/, "");
const REDIRECT_TARGET_PATH = process.env.REDIRECT_TARGET_PATH || "/#paywall";
const ENABLE_REQUEST_LOGS = String(process.env.LOG_REQUESTS || "").toLowerCase() === "true";
const ENFORCE_CANONICAL_HOST = String(process.env.ENFORCE_CANONICAL_HOST || "").toLowerCase() === "true";
const PAYMENT_HOLD_MESSAGE = "Payments are currently on hold. No checkout session was created.";

function safeUrl(value, fallback) {
  try {
    return new URL(value).toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

const CANONICAL_BASE_URL = safeUrl(PUBLIC_URL, "https://www.lrcpropertyllc.com");
const CANONICAL_HOST = new URL(CANONICAL_BASE_URL).host.toLowerCase();
const REDIRECT_TARGET_URL = new URL(REDIRECT_TARGET_PATH, `${CANONICAL_BASE_URL}/`).toString();

app.disable("x-powered-by");
app.set("trust proxy", true);

app.use((request, response, next) => {
  const requestId = crypto.randomUUID();
  request.requestId = requestId;
  response.set("X-Request-Id", requestId);
  response.set("X-Content-Type-Options", "nosniff");
  response.set("Referrer-Policy", "no-referrer");
  response.set("Cache-Control", "no-store");
  next();
});

if (ENABLE_REQUEST_LOGS) {
  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      console.log(
        `[${new Date().toISOString()}] [${request.requestId}] ${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`,
      );
    });
    next();
  });
}

app.get("/healthz", (_request, response) => {
  response.status(200).json({
    ok: true,
    service: "lrc-btl-redirect",
    canonicalHost: CANONICAL_HOST,
    enforceCanonicalHost: ENFORCE_CANONICAL_HOST,
    payments: {
      available: false,
      mode: "hold",
    },
    target: REDIRECT_TARGET_URL,
    now: new Date().toISOString(),
  });
});

app.get("/healthz", (_request, response) => {
  response.status(200).json({
    ok: true,
    service: "between-the-lines",
    now: new Date().toISOString(),
  });
});

app.get("/api/analytics", (_request, response) => {
  response.json({
    events: analyticsEvents,
  });
});

app.post("/api/analytics", (request, response) => {
  if (!recordAnalyticsEvent(request.body)) {
    response.status(400).json({
      error: "Invalid analytics event.",
    });
    return;
  }

  response.status(204).end();
});

app.post("/api/analyze", (request, response, next) => {
  try {
    const filename = request.body?.filename || "messages.json";
    const content = request.body?.content || "";
    const result = analyzeConversation({
      filename,
      content,
      timezone: getRequestTimezone(request),
      rules: parseRules(request.body?.rules),
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/upload", upload.single("file"), (request, response, next) => {
  try {
    if (!request.file) {
      throw new Error("No file was uploaded.");
    }

    const result = analyzeConversation({
      filename: request.file.originalname || "messages.json",
      content: request.file.buffer.toString("utf-8"),
      timezone: getRequestTimezone(request),
      rules: parseRules(request.body?.rules),
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/create-checkout-session", async (_request, response, next) => {
  if (!requirePayments(response)) return;

  try {
    const session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Between The Lines Full Report",
            },
            unit_amount: 1200,
          },
          quantity: 1,
        },
      ],
      success_url: `${PUBLIC_URL}/?paid=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/?paid=cancelled`,
    });

    response.json({
      url: session.url,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/payment-status", async (request, response, next) => {
  if (!requirePayments(response)) return;

  try {
    const sessionId = String(request.query?.session_id || "");
    response.set("Cache-Control", "no-store");

    if (!sessionId) {
      response.status(400).json({
        error: "A checkout session id is required.",
      });
      return;
    }

    let sessionStatus = paidCheckoutSessions.get(sessionId);

    if (!sessionStatus) {
      try {
        const liveSession = await stripeClient.checkout.sessions.retrieve(sessionId);
        if (liveSession?.id) {
          sessionStatus = {
            paid: liveSession.payment_status === "paid",
            paidAt: null,
            paymentStatus: liveSession.payment_status || "unpaid",
            checkoutStatus: liveSession.status || "pending",
          };
          paidCheckoutSessions.set(liveSession.id, sessionStatus);
        }
      } catch {
        sessionStatus = null;
      }
    }

    response.json({
      paid: Boolean(sessionStatus?.paid),
      status: sessionStatus?.checkoutStatus || "pending",
      paymentStatus: sessionStatus?.paymentStatus || "unpaid",
    });
  } catch (error) {
    next(error);
  }
});
function sendCheckoutHold(request, response) {
  response.status(503).json({
    ok: false,
    available: false,
    mode: "hold",
    error: PAYMENT_HOLD_MESSAGE,
    requestId: request.requestId,
  });
}

function sendEntitlementHold(request, response) {
  const reportId = request.params.reportId || request.query.report_id || "";
  response.status(200).json({
    ok: true,
    available: false,
    mode: "hold",
    reportId,
    paid: false,
    status: "held",
    paymentStatus: "unpaid",
    requestId: request.requestId,
  });
}

app.post("/create-checkout-session", sendCheckoutHold);
app.post("/api/checkout/session", sendCheckoutHold);
app.post("/api/stripe/webhook", sendCheckoutHold);
app.get("/payment-status", sendEntitlementHold);
app.get("/api/checkout/entitlement/:reportId", sendEntitlementHold);

app.use((request, response) => {
  const method = request.method.toUpperCase();

  if (method === "GET" || method === "HEAD") {
    response.redirect(301, REDIRECT_TARGET_URL);
    return;
  }

  response.status(404).json({
    error: "Not found",
  response.status(410).json({
    ok: false,
    message: "This service has moved under the LRC Property LLC umbrella.",
    target: REDIRECT_TARGET_URL,
    requestId: request.requestId,
  });
});

app.use((error, _request, response, _next) => {
  const status = error instanceof multer.MulterError ? 400 : 400;
  response.status(status).json({
    error: userSafeErrorMessage(error),
    requestId: _request.requestId,
function startServer(port = PORT, host = "0.0.0.0") {
  const server = app.listen(port, host, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(`BTL redirect service running on port ${resolvedPort}; target=${REDIRECT_TARGET_URL}`);
  });
  return server;
}

function startServer(port = PORT) {
  const server = app.listen(port, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(`Between The Lines app running at http://localhost:${resolvedPort}`);
  });
  return server;
}

function setStripeClientForTesting(client) {
  stripeClient = client;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  setStripeClientForTesting,
};
