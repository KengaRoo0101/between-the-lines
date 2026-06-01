const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.disable("x-powered-by");

app.get("/healthz", function (_req, res) {
  res.json({ ok: true, service: "spotter-control-room", mode: "mvp" });
});

app.get("/app.js", function (_req, res) {
  res.sendFile(path.join(__dirname, "app.js"));
});

app.get("/styles.css", function (_req, res) {
  res.sendFile(path.join(__dirname, "styles.css"));
});

app.get("/", function (_req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(function (_req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, function () {
  console.log("Spotter Control Room running on port " + port);
});
