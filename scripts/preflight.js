const fs = require("node:fs");
const path = require("node:path");

let hasFailure = false;

function isPresent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message) {
  hasFailure = true;
  console.error(`✗ ${message}`);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function parseUrl(name, value) {
  try {
    return new URL(value);
  } catch {
    fail(`${name} is not a valid absolute URL.`);
    return null;
  }
}

function requireVar(name) {
  if (!isPresent(process.env[name])) {
    fail(`${name} is missing.`);
    return null;
  }

  pass(`${name} is set.`);
  return process.env[name];
}

function scanFile(filePath, pattern, message) {
  const absolutePath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) return;

  const content = fs.readFileSync(absolutePath, "utf8");
  if (pattern.test(content)) {
    fail(message);
  }
}

const allowRenderPublicUrl = String(process.env.ALLOW_RENDER_PUBLIC_URL || "").toLowerCase() === "true";
const allowTestKeys = String(process.env.ALLOW_TEST_KEYS || "").toLowerCase() === "true";
const checkPayments = process.argv.includes("--payments") || String(process.env.PAYMENTS_RUNTIME || "").toLowerCase() === "true";
const paymentsEnabled = String(process.env.PAYMENTS_ENABLED || "").toLowerCase() === "true";
const ownerApprovedPayments = String(process.env.OWNER_APPROVED_PAYMENTS || "").toLowerCase() === "true";

const publicUrlValue = requireVar("PUBLIC_URL");
const enforceCanonicalHostValue = requireVar("ENFORCE_CANONICAL_HOST");
const publicUrl = publicUrlValue ? parseUrl("PUBLIC_URL", publicUrlValue) : null;

if (publicUrl) {
  if (publicUrl.protocol !== "https:") {
    fail("PUBLIC_URL must use https:// for go-live.");
  } else {
    pass("PUBLIC_URL uses https.");
  }

  if (publicUrl.hostname === "localhost" || publicUrl.hostname === "127.0.0.1") {
    fail("PUBLIC_URL cannot be localhost for go-live.");
  } else {
    pass(`PUBLIC_URL host is ${publicUrl.hostname}.`);
  }

  if (publicUrl.hostname.endsWith(".onrender.com") && !allowRenderPublicUrl) {
    fail("PUBLIC_URL points at an onrender.com host. Use the canonical custom domain or set ALLOW_RENDER_PUBLIC_URL=true only for non-production rehearsal.");
  }
}

if (enforceCanonicalHostValue) {
  if (enforceCanonicalHostValue.toLowerCase() !== "true") {
    fail("ENFORCE_CANONICAL_HOST must be true for go-live.");
  } else {
    pass("ENFORCE_CANONICAL_HOST=true.");
  }
}

if (paymentsEnabled !== ownerApprovedPayments) {
  fail("PAYMENTS_ENABLED and OWNER_APPROVED_PAYMENTS must either both be true for live payments or both be false/absent for payment hold.");
}

if (!paymentsEnabled && !ownerApprovedPayments) {
  pass("Payment hold is active; checkout cannot start financial actions.");
  ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET"].forEach((name) => {
    if (isPresent(process.env[name])) {
      fail(`${name} must not be set while payment hold is active.`);
    }
  });
} else {
  pass("Live payments are explicitly enabled and owner-approved.");
}

if (checkPayments || paymentsEnabled || ownerApprovedPayments) {
  const frontendBaseUrlValue = process.env.FRONTEND_BASE_URL || process.env.PUBLIC_URL || "";
  const frontendBaseUrl = frontendBaseUrlValue ? parseUrl("FRONTEND_BASE_URL", frontendBaseUrlValue) : null;

  if (frontendBaseUrl) {
    if (frontendBaseUrl.protocol !== "https:") {
      fail("FRONTEND_BASE_URL must use https:// for go-live.");
    } else {
      pass("FRONTEND_BASE_URL uses https.");
    }

    if (publicUrl && frontendBaseUrl.origin !== publicUrl.origin) {
      fail("FRONTEND_BASE_URL and PUBLIC_URL must use the same origin for go-live Stripe redirects.");
    }
  }

  if (paymentsEnabled && ownerApprovedPayments) {
    const stripeSecretKey = requireVar("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = requireVar("STRIPE_WEBHOOK_SECRET");
    requireVar("DATABASE_URL");

    if (stripeSecretKey) {
      if (stripeSecretKey.startsWith("pk_")) {
        fail("STRIPE_SECRET_KEY is a publishable key. Use a server-side secret key or restricted key.");
      } else if ((stripeSecretKey.startsWith("sk_test_") || stripeSecretKey.startsWith("rk_test_")) && !allowTestKeys) {
        fail("STRIPE_SECRET_KEY is a test key. Use a live key, or set ALLOW_TEST_KEYS=true only outside production.");
      } else if (stripeSecretKey.startsWith("sk_live_") || stripeSecretKey.startsWith("rk_live_") || allowTestKeys) {
        pass("STRIPE_SECRET_KEY appears suitable for the selected environment.");
      } else {
        fail("STRIPE_SECRET_KEY does not look like sk_live_, rk_live_, or an explicitly allowed non-production test key.");
      }
    }

    if (stripeWebhookSecret) {
      if (!stripeWebhookSecret.startsWith("whsec_")) {
        fail("STRIPE_WEBHOOK_SECRET must be the whsec_ signing secret for the configured Stripe webhook endpoint.");
      } else {
        pass("STRIPE_WEBHOOK_SECRET has the expected whsec_ prefix.");
      }
    }
  }
}

scanFile("server.js", /express\.static\s*\(\s*(?:__dirname|ROOT_DIR|process\.cwd\s*\(\s*\))/m, "server.js appears to serve the repository root as static content.");
scanFile("payments-runtime.js", /express\.static\s*\(\s*(?:__dirname|ROOT_DIR|process\.cwd\s*\(\s*\))/m, "payments-runtime.js appears to serve the repository root as static content.");

["server.js", "payments-runtime.js", "render.yaml", "README.md", "DEPLOY_THIS.md", ".env.example"].forEach((filePath) => {
  scanFile(filePath, /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}/, `${filePath} appears to contain a Stripe secret-looking value.`);
});

if (fs.existsSync("render.yaml")) {
  const renderYaml = fs.readFileSync("render.yaml", "utf8");
  if (/value:\s*https:\/\/[^\s]+\.onrender\.com/i.test(renderYaml) && !allowRenderPublicUrl) {
    fail("render.yaml contains an onrender.com PUBLIC_URL value.");
  }
  if (/key:\s*ENFORCE_CANONICAL_HOST[\s\S]{0,80}value:\s*["']?false["']?/i.test(renderYaml)) {
    fail("render.yaml disables ENFORCE_CANONICAL_HOST.");
  }
  if (/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}/.test(renderYaml)) {
    fail("render.yaml appears to contain a Stripe secret value. Use sync: false or dashboard secrets instead.");
  }
}

if (hasFailure) {
  console.error("\nPreflight checks failed.");
  process.exit(1);
}

console.log("\nPreflight checks passed.");
