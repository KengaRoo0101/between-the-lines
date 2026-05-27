function isPresent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message) {
  console.error(`✗ ${message}`);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

const requiredVars = ["PUBLIC_URL"];
let hasFailure = false;
const paymentsEnabled = String(process.env.PAYMENTS_ENABLED || "").toLowerCase() === "true";
const ownerApprovedPayments = String(process.env.OWNER_APPROVED_PAYMENTS || "").toLowerCase() === "true";

requiredVars.forEach((name) => {
  if (!isPresent(process.env[name])) {
    hasFailure = true;
    fail(`${name} is missing.`);
  } else {
    pass(`${name} is set.`);
  }
});

if (isPresent(process.env.PUBLIC_URL)) {
  let parsedUrl;
  try {
    parsedUrl = new URL(process.env.PUBLIC_URL);
  } catch {
    hasFailure = true;
    fail("PUBLIC_URL is not a valid URL.");
  }

  if (parsedUrl) {
    if (parsedUrl.protocol !== "https:") {
      hasFailure = true;
      fail("PUBLIC_URL must use https:// in production.");
    } else {
      pass("PUBLIC_URL uses https.");
    }

    if (!isPresent(process.env.ENFORCE_CANONICAL_HOST)) {
      hasFailure = true;
      fail("ENFORCE_CANONICAL_HOST is missing (must be true in production).");
    } else {
      const enforceCanonical = String(process.env.ENFORCE_CANONICAL_HOST).toLowerCase() === "true";
      if (!enforceCanonical) {
        hasFailure = true;
        fail("ENFORCE_CANONICAL_HOST must be true for go-live.");
      } else {
        pass("ENFORCE_CANONICAL_HOST=true");
      }
    }

    if (parsedUrl.hostname === "localhost") {
      hasFailure = true;
      fail("PUBLIC_URL cannot be localhost for go-live.");
    } else {
      pass(`PUBLIC_URL host is ${parsedUrl.hostname}`);
    }
  }
}

if (paymentsEnabled || ownerApprovedPayments) {
  hasFailure = true;
  fail("Payment hold is active. Leave PAYMENTS_ENABLED and OWNER_APPROVED_PAYMENTS unset or false.");
} else {
  pass("Payment hold is active.");
}

["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET"].forEach((name) => {
  if (isPresent(process.env[name])) {
    hasFailure = true;
    fail(`${name} must not be set while the payment hold is active.`);
  }
});

if (hasFailure) {
  console.error("\nPreflight checks failed.");
  process.exit(1);
}

console.log("\nPreflight checks passed.");
