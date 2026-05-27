function resolveBaseUrl(envKey, fallbackPath = "") {
  if (typeof window === "undefined") return fallbackPath;

  const raw = window.__BTL_CONFIG__?.[envKey] || "";
  if (!raw) return fallbackPath;
  return String(raw).replace(/\/+$/, "");
}

const ANALYSIS_API_BASE = resolveBaseUrl("analysisApiBase", "");
const PAYMENTS_API_BASE = resolveBaseUrl("paymentsApiBase", "");
const PAYMENTS_ENABLED = typeof window !== "undefined" && window.__BTL_CONFIG__?.paymentsEnabled === true;

function buildUrl(base, path) {
  if (!base) return path;
  return `${base}${path}`;
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function getConfig() {
  const response = await fetch(buildUrl(ANALYSIS_API_BASE, "/api/config"));
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "The app could not load default rules.");
  }
  return data;
}

export async function getEntitlementStatus(reportId) {
  if (!PAYMENTS_ENABLED) {
    return {
      reportId,
      paid: false,
      status: "held",
      paymentStatus: "unpaid",
      mode: "hold",
    };
  }

  const response = await fetch(
    buildUrl(PAYMENTS_API_BASE, `/api/checkout/entitlement/${encodeURIComponent(reportId)}`),
    { cache: "no-store" },
  );
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "The entitlement could not be verified.");
  }
  return data;
}

export function arePaymentsEnabled() {
  return PAYMENTS_ENABLED;
}

export async function analyzeUpload({
  file,
  rules,
  timezone,
  researchConsent,
  uploadRightsConfirmed,
}) {
  const body = new FormData();
  body.append("file", file);
  body.append("rules", JSON.stringify(rules));
  body.append("timezone", timezone);
  body.append("researchConsent", researchConsent ? "true" : "false");
  body.append("uploadRightsConfirmed", uploadRightsConfirmed ? "true" : "false");

  const response = await fetch(buildUrl(ANALYSIS_API_BASE, "/upload"), {
    method: "POST",
    body,
  });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Analysis failed.");
  }

  return data;
}

export async function analyzeInline({ filename, content, rules, timezone, researchConsent }) {
  const response = await fetch(buildUrl(ANALYSIS_API_BASE, "/api/analyze"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      content,
      rules,
      timezone,
      researchConsent,
    }),
  });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Analysis failed.");
  }

  return data;
}

export async function createCheckoutSession(reportId) {
  if (!PAYMENTS_ENABLED) {
    throw new Error("Checkout is currently on hold. No payment will be started.");
  }

  const response = await fetch(buildUrl(PAYMENTS_API_BASE, "/api/checkout/session"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reportId }),
  });
  const data = await parseJsonSafe(response);
  if (!response.ok || (!data.checkoutUrl && !data.alreadyPaid)) {
    throw new Error(data.error || "The checkout session could not be created.");
  }

  return data;
}
