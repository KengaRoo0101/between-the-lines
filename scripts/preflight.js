function isPresent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message) {
  console.error(`✗ ${message}`);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

const requiredVars = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PUBLIC_URL"];
let hasFailure = false;
const allowTestKeys = String(process.env.ALLOW_TEST_KEYS || "").toLowerCase() === "true";

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

if (isPresent(process.env.STRIPE_SECRET_KEY) && process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") && !allowTestKeys) {
  hasFailure = true;
  fail("STRIPE_SECRET_KEY is a test key. Use a live key or set ALLOW_TEST_KEYS=true.");
} else if (isPresent(process.env.STRIPE_SECRET_KEY)) {
  pass("STRIPE_SECRET_KEY appears suitable for live use.");
}

if (hasFailure) {
  console.error("\nPreflight checks failed.");
  process.exit(1);
}

console.log("\nPreflight checks passed.");
