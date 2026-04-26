async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function getConfig() {
  const response = await fetch("/api/config");
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "The app could not load default rules.");
  }
  return data;
}

export async function getPaymentStatus(sessionId) {
  const response = await fetch(`/payment-status?session_id=${encodeURIComponent(sessionId)}`, {
    cache: "no-store",
  });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "The checkout session could not be verified.");
  }
  return data;
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

  const response = await fetch("/upload", {
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
  const response = await fetch("/api/analyze", {
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

export async function createCheckoutSession() {
  const response = await fetch("/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await parseJsonSafe(response);
  if (!response.ok || !data.url) {
    throw new Error(data.error || "The checkout session could not be created.");
  }

  return data;
}
