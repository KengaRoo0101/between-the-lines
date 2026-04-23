const path = require("path");
const { parseCsv } = require("./csv");

const TIMESTAMP_FIELDS = [
  "timestamp",
  "time",
  "date",
  "datetime",
  "createdat",
  "created_at",
  "sentat",
  "sent_at",
  "senttime",
];

const SENDER_FIELDS = [
  "sender",
  "from",
  "author",
  "name",
  "user",
  "participant",
  "person",
];

const TEXT_FIELDS = [
  "text",
  "message",
  "content",
  "body",
  "note",
  "message_text",
  "messagebody",
];

const ID_FIELDS = [
  "id",
  "messageid",
  "message_id",
  "uuid",
];

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getCandidateValue(record, candidates) {
  const keyMap = new Map();
  Object.keys(record || {}).forEach((key) => {
    keyMap.set(normalizeKey(key), key);
  });

  for (const candidate of candidates) {
    const realKey = keyMap.get(candidate);
    if (realKey && record[realKey] !== undefined && record[realKey] !== null && record[realKey] !== "") {
      return record[realKey];
    }
  }

  return undefined;
}

function scoreRecordArray(array) {
  return array.reduce((score, record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return score;
    }

    let recordScore = 1;
    if (getCandidateValue(record, TIMESTAMP_FIELDS) !== undefined) recordScore += 6;
    if (getCandidateValue(record, SENDER_FIELDS) !== undefined) recordScore += 3;
    if (getCandidateValue(record, TEXT_FIELDS) !== undefined) recordScore += 3;
    return score + recordScore;
  }, 0);
}

function findBestArray(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return [];
  }

  seen.add(value);
  const candidates = [];

  if (Array.isArray(value)) {
    candidates.push(value);
    value.forEach((item) => {
      candidates.push(...findBestArray(item, seen));
    });
  } else {
    Object.values(value).forEach((item) => {
      candidates.push(...findBestArray(item, seen));
    });
  }

  candidates.sort((left, right) => scoreRecordArray(right) - scoreRecordArray(left));
  return candidates[0] || [];
}

function canonicalizeRecords(records) {
  const sourceFields = new Set();
  const fieldsPresent = new Set();

  const messages = records.map((record, index) => {
    Object.keys(record || {}).forEach((key) => sourceFields.add(key));

    const timestamp = getCandidateValue(record, TIMESTAMP_FIELDS);
    const sender = getCandidateValue(record, SENDER_FIELDS);
    const text = getCandidateValue(record, TEXT_FIELDS);
    const id = getCandidateValue(record, ID_FIELDS);

    if (timestamp !== undefined) fieldsPresent.add("timestamp");
    if (sender !== undefined) fieldsPresent.add("sender");
    if (text !== undefined) fieldsPresent.add("text");
    if (id !== undefined) fieldsPresent.add("id");

    return {
      id,
      sender,
      text,
      timestamp,
      originalIndex: index,
      originalRecord: record,
    };
  });

  const fieldsMissing = ["timestamp", "sender", "text", "id"].filter((field) => !fieldsPresent.has(field));

  return {
    messages,
    sourceFields: Array.from(sourceFields).sort(),
    fieldsPresent: Array.from(fieldsPresent).sort(),
    fieldsMissing,
  };
}

function parseJsonUpload(content) {
  const parsed = JSON.parse(content);
  const bestArray = Array.isArray(parsed) ? parsed : findBestArray(parsed);

  if (!Array.isArray(bestArray) || bestArray.length === 0) {
    throw new Error("Could not find a message array in the JSON file.");
  }

  return {
    records: bestArray.filter((item) => item && typeof item === "object" && !Array.isArray(item)),
    sourceType: "json",
  };
}

function parseCsvUpload(content) {
  const parsed = parseCsv(content);
  if (parsed.rows.length === 0) {
    throw new Error("The CSV file did not contain any data rows.");
  }

  return {
    records: parsed.rows,
    sourceType: "csv",
  };
}

function parseUpload({ filename, content, timezone }) {
  const extension = path.extname(filename || "").toLowerCase();
  const parser = extension === ".csv" ? parseCsvUpload : parseJsonUpload;
  const parsed = parser(content);
  const canonical = canonicalizeRecords(parsed.records);

  return {
    sourceType: parsed.sourceType,
    sourceName: filename,
    timezoneAssumption: timezone,
    rawRowCount: parsed.records.length,
    sourceFields: canonical.sourceFields,
    fieldsPresent: canonical.fieldsPresent,
    fieldsMissing: canonical.fieldsMissing,
    rawMessages: canonical.messages,
  };
}

module.exports = {
  parseUpload,
};
