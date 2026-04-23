const express = require('express');
const bodyParser = require('body-parser');
const anomalyRules = require('./anomalyRules');
const parseUpload = require('./parseUpload');
const normalizeMessages = require('./normalizeMessages');
const analyzeMessages = require('./analyzeMessages');
const buildReport = require('./buildReport');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to handle file uploads
app.use('/upload', parseUpload);

// Normalization route
app.post('/normalize', (req, res) => {
    const messages = req.body.messages;
    const normalized = normalizeMessages(messages);
    res.json(normalized);
});

// Analysis route
app.post('/analyze', (req, res) => {
    const messages = req.body.messages;
    const analysisResult = analyzeMessages(messages);
    res.json(analysisResult);
});

// Report building route
app.get('/report', (req, res) => {
    const report = buildReport();
    res.json(report);
});

// Starting the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
