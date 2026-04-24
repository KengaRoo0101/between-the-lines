const path = require("path");
const crypto = require("crypto");

const express = require("express");
const multer = require("multer");
const Stripe = require("stripe");

const { defaultRules, mergeRules } = require("./src/config/anomalyRules");
const { parseUpload } = require("./src/lib/parseUpload");
const { normalizeMessages } = require("./src/lib/normalizeMessages");
const { analyzeMessages } = require("./src/lib/analyzeMessages");
const { buildReport } = require("./src/lib/buildReport");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const PUBLIC_URL = String(process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const ACCESS_COOKIE = "btl_tester_access";
const ACCESS_TOKEN_INPUT = "between-the-lines-tester-access";
const ACCESS_PASSWORD = process.env.BTL_TESTER_PASSWORD || process.env.TESTER_PASSWORD || "";
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
const parseUrlencoded = express.urlencoded({ extended: false, limit: "16kb" });

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return cookies;
      const key = part.slice(0, separator);
      const value = part.slice(separator + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function accessToken() {
  if (!ACCESS_PASSWORD) return "";
  return crypto.createHmac("sha256", ACCESS_PASSWORD).update(ACCESS_TOKEN_INPUT).digest("hex");
}

function tokensMatch(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hasTesterAccess(request) {
  const cookies = parseCookies(request.headers.cookie);
  return Boolean(ACCESS_PASSWORD && tokensMatch(cookies[ACCESS_COOKIE], accessToken()));
}

function renderAccessGate({ error = "", redirectTo = "/" } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Between The Lines Access</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0b0d;
        --card: rgba(17, 17, 20, 0.94);
        --ink: #f5f1ea;
        --muted: #b3ada4;
        --line: rgba(245, 241, 234, 0.14);
        --amber: #c7a45b;
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        color: var(--ink);
        font-family: "Avenir Next", "Aptos", "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #060608 0%, var(--bg) 100%);
      }

      main {
        width: min(100%, 420px);
        padding: 28px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--card);
      }

      h1 {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
        font-size: 2rem;
        line-height: 1;
      }

      p {
        margin: 12px 0 0;
        color: var(--muted);
        line-height: 1.55;
      }

      form {
        display: grid;
        gap: 14px;
        margin-top: 22px;
      }

      label {
        display: grid;
        gap: 8px;
        color: var(--muted);
        font-size: 0.9rem;
      }

      input {
        width: 100%;
        min-height: 50px;
        padding: 0 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.04);
        color: var(--ink);
        font: inherit;
      }

      button {
        min-height: 52px;
        border: 0;
        border-radius: 999px;
        background: var(--amber);
        color: #0d0d10;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .error {
        color: #e3a28b;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Between The Lines</h1>
      <p>Tester access is required before entering this preview.</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/tester-access">
        <input type="hidden" name="redirectTo" value="${escapeHtml(redirectTo)}" />
        <label>
          Shared password
          <input name="password" type="password" autocomplete="current-password" required autofocus />
        </label>
        <button type="submit">Enter</button>
      </form>
    </main>
  </body>
</html>`;
}

function setAccessCookie(request, response) {
  const secure = request.secure || request.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${ACCESS_COOKIE}=${encodeURIComponent(accessToken())}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=604800",
  ];

  if (secure) {
    parts.push("Secure");
  }

  response.setHeader("Set-Cookie", parts.join("; "));
}

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

function requireTesterAccess(request, response, next) {
  if (!ACCESS_PASSWORD) {
    next();
    return;
  }

  if (hasTesterAccess(request)) {
    next();
    return;
  }

  const redirectTo = request.originalUrl && request.originalUrl !== "/tester-access" ? request.originalUrl : "/";
  response.status(200).send(renderAccessGate({ redirectTo }));
}

app.get("/tester-access", (request, response) => {
  if (!ACCESS_PASSWORD) {
    response.redirect(303, "/");
    return;
  }

  const redirectTo = typeof request.query?.redirectTo === "string" ? request.query.redirectTo : "/";
  response.status(200).send(renderAccessGate({
    redirectTo: redirectTo.startsWith("/") ? redirectTo : "/",
  }));
});

app.post("/tester-access", parseUrlencoded, (request, response) => {
  const submittedPassword = String(request.body?.password || "");
  const redirectTo = String(request.body?.redirectTo || "/");

  if (!ACCESS_PASSWORD) {
    response.status(503).send(renderAccessGate({
      error: "Tester access is not configured.",
      redirectTo,
    }));
    return;
  }

  if (tokensMatch(submittedPassword, ACCESS_PASSWORD)) {
    setAccessCookie(request, response);
    response.redirect(303, redirectTo.startsWith("/") ? redirectTo : "/");
    return;
  }

  response.status(401).send(renderAccessGate({
    error: "That password did not work.",
    redirectTo,
  }));
});

app.use(requireTesterAccess);

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

  response.status(404).json({ error: "Not found" });
});

app.use((error, _request, response, _next) => {
  const status = error instanceof multer.MulterError ? 400 : 400;
  response.status(status).json({
    error: userSafeErrorMessage(error),
  });
});

app.listen(PORT, () => {
  console.log(`Between The Lines app running at http://localhost:${PORT}`);
});
