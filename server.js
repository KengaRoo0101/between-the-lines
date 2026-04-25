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
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
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
  return Boolean(stripe && STRIPE_WEBHOOK_SECRET);
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
    event = stripe.webhooks.constructEvent(request.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    response.status(400).send(`Webhook Error: ${error.message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    markCheckoutSessionPaid(event.data.object);
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
  } catch {
    return {};
  }
}

function userSafeErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("file too large") || message.includes("request entity too large")) {
    return "That file is too large to process here. Please try a smaller JSON or CSV export.";
  }

  if (message.includes("no file")) {
    return "Choose a JSON or CSV conversation export before generating a report.";
  }

  if (message.includes("empty")) {
    return "That file looks empty. Please choose a JSON or CSV file with conversation data.";
  }

  if (message.includes("timestamp")) {
    return "We could not find readable message timestamps in that file. Please choose a conversation export with timestamps.";
  }

  if (message.includes("message array")) {
    return "We could not find conversation messages in that file. Please choose an export that contains message records.";
  }

  if (message.includes("json") || message.includes("csv") || message.includes("unexpected token") || message.includes("parse")) {
    return "We could not read that file. Please upload a valid JSON or CSV conversation export.";
  }

  return "We could not generate a report from that file. Please try another JSON or CSV conversation export.";
}

function recordAnalyticsEvent(payload = {}) {
  const name = String(payload.name || "");
  if (!ALLOWED_ANALYTICS_EVENTS.has(name)) {
    return false;
  }

  analyticsEvents.push({
    name,
    at: typeof payload.at === "string" ? payload.at : new Date().toISOString(),
    path: typeof payload.path === "string" ? payload.path : "/",
    receivedAt: new Date().toISOString(),
  });

  if (analyticsEvents.length > 250) {
    analyticsEvents.splice(0, analyticsEvents.length - 250);
  }

  return true;
}

function buildReportSections(report) {
  const findings = Array.isArray(report.groupedFindings)
    ? report.groupedFindings.flatMap((group) =>
        Array.isArray(group.items)
          ? group.items.map((item) => ({
              ...item,
              categoryLabel: group.category,
            }))
          : [],
      )
    : [];

  return {
    keyFindings: findings.slice(0, 6).map((item) => ({
      category: item.categoryLabel || item.category,
      type: item.type,
      title: item.title || item.summary || "Pattern to review",
      summary: item.summary || item.description || "",
      timestamp: item.timestamp || item.startTimestamp || item.endTimestamp || null,
      severity: item.severity || "low",
    })),
    timeline: Array.isArray(report.chronology)
      ? report.chronology.map((day) => ({
          dayKey: day.dayKey,
          dateLabel: day.dateLabel,
          totalMessages: day.totalMessages,
          messages: day.items,
        }))
      : [],
    insights: [
      ...(report.executiveSummary?.points || []),
      ...(Array.isArray(report.disclaimer) ? report.disclaimer : []),
    ],
  };
}

function analyzeConversation({ filename, content, timezone, rules }) {
  const mergedRules = mergeRules(rules || {});
  const parsedUpload = parseUpload({
    filename,
    content,
    timezone,
  });

  const normalized = normalizeMessages(parsedUpload);
  const analysis = analyzeMessages(normalized.messages, mergedRules);
  const report = buildReport({
    normalized,
    analysis,
    rules: mergedRules,
    source: {
      filename,
      timezone,
      receivedAt: new Date().toISOString(),
    },
  });

  return {
    report,
    rules: mergedRules,
    sections: buildReportSections(report),
  };
}

function getRequestTimezone(request) {
  return request.body?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

app.get("/api/config", (_request, response) => {
  response.json({ rules: defaultRules });
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
    const session = await stripe.checkout.sessions.create({
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

    const sessionStatus = paidCheckoutSessions.get(sessionId);
    response.json({
      paid: Boolean(sessionStatus?.paid),
      status: sessionStatus?.checkoutStatus || "pending",
      paymentStatus: sessionStatus?.paymentStatus || "unpaid",
    });
  } catch (error) {
    next(error);
  }
});

app.use("/samples", express.static(path.join(ROOT_DIR, "samples")));

app.use(express.static(ROOT_DIR, {
  extensions: ["html"],
  index: "index.html",
}));

app.use((request, response) => {
  if (request.accepts("html")) {
    response.status(404).sendFile(path.join(ROOT_DIR, "index.html"));
    return;
  }

  response.status(404).json({
    error: "Not found",
    requestId: request.requestId,
  });
});

app.use((error, _request, response, _next) => {
  const status = error instanceof multer.MulterError ? 400 : 400;
  response.status(status).json({
    error: userSafeErrorMessage(error),
    requestId: _request.requestId,
  });
});

function startServer(port = PORT) {
  const server = app.listen(port, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(`Between The Lines app running at http://localhost:${resolvedPort}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
