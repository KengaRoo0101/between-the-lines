const crypto = require("node:crypto");
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = String(process.env.PUBLIC_URL || "https://www.lrcpropertyllc.com").replace(/\/+$/, "");
const REDIRECT_TARGET_PATH = process.env.REDIRECT_TARGET_PATH || "/#paywall";
const ENABLE_REQUEST_LOGS = String(process.env.LOG_REQUESTS || "").toLowerCase() === "true";
const ENFORCE_CANONICAL_HOST = String(process.env.ENFORCE_CANONICAL_HOST || "").toLowerCase() === "true";

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
    target: REDIRECT_TARGET_URL,
    now: new Date().toISOString(),
  });
});

app.use((request, response) => {
  const method = request.method.toUpperCase();

  if (method === "GET" || method === "HEAD") {
    response.redirect(301, REDIRECT_TARGET_URL);
    return;
  }

  response.status(410).json({
    ok: false,
    message: "This service has moved under the LRC Property LLC umbrella.",
    target: REDIRECT_TARGET_URL,
    requestId: request.requestId,
  });
});

function startServer(port = PORT, host = "0.0.0.0") {
  const server = app.listen(port, host, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(`BTL redirect service running on port ${resolvedPort}; target=${REDIRECT_TARGET_URL}`);
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
