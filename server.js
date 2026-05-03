const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const LRC_UMBRELLA_REPORT_URL = "https://www.lrcpropertyllc.com/#paywall";

app.set("trust proxy", true);

app.get("/healthz", (_request, response) => {
  response.status(200).json({
    ok: true,
    service: "lrc-btl-redirect",
    target: LRC_UMBRELLA_REPORT_URL,
    now: new Date().toISOString(),
  });
});

app.use((request, response) => {
  if (request.method === "GET" || request.method === "HEAD") {
    response.redirect(301, LRC_UMBRELLA_REPORT_URL);
    return;
  }

  response.status(410).json({
    ok: false,
    message: "This service has moved under the LRC Property LLC umbrella.",
    target: LRC_UMBRELLA_REPORT_URL,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BTL redirect service running on port ${PORT}`);
});
