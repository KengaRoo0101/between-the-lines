function parseTimestamp(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 1e12 ? value : value * 1000;
    return new Date(milliseconds);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function datePartsInTimeZone(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });

    return formatter.formatToParts(date).reduce((memo, part) => {
      if (part.type !== "literal") {
        memo[part.type] = part.value;
      }
      return memo;
    }, {});
  } catch {
    return {
      year: String(date.getFullYear()),
      month: String(date.getMonth() + 1).padStart(2, "0"),
      day: String(date.getDate()).padStart(2, "0"),
      hour: String(date.getHours()).padStart(2, "0"),
    };
  }
}

function dateKeyFor(date, timeZone) {
  const parts = datePartsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hourFor(date, timeZone) {
  const parts = datePartsInTimeZone(date, timeZone);
  return Number(parts.hour);
}

function summarizeWarnings(warnings) {
  const counts = warnings.reduce((memo, warning) => {
    memo[warning] = (memo[warning] || 0) + 1;
    return memo;
  }, {});

  return Object.entries(counts).map(([warning, count]) => `${warning}${count > 1 ? ` (${count})` : ""}`);
}

function normalizeMessages(parsedUpload) {
  const warnings = [];
  const dedupeKeys = new Set();
  const timeZone = parsedUpload.timezoneAssumption;
  let duplicatesRemoved = 0;

  const normalizedMessages = parsedUpload.rawMessages
    .map((message) => {
      const date = parseTimestamp(message.timestamp);
      if (!date) {
        warnings.push("Skipped rows with invalid or missing timestamps.");
        return null;
      }

      const sender = normalizeText(message.sender) || "Unknown";
      const text = normalizeText(message.text);
      if (!text) {
        warnings.push("Some rows were missing message text and were retained as empty entries.");
      }

      return {
        id: message.id ? String(message.id) : null,
        sender,
        text,
        timestamp: date.toISOString(),
        timestampMs: date.getTime(),
        dayKey: dateKeyFor(date, timeZone),
        hour: hourFor(date, timeZone),
        originalIndex: message.originalIndex,
        sourceRecord: message.originalRecord,
      };
    })
    .filter(Boolean)
    .filter((message) => {
      const dedupeKey = message.id || `${message.timestamp}|${message.sender}|${message.text}`;
      if (dedupeKeys.has(dedupeKey)) {
        duplicatesRemoved += 1;
        return false;
      }

      dedupeKeys.add(dedupeKey);
      return true;
    })
    .sort((left, right) => left.timestampMs - right.timestampMs)
    .map((message, index, allMessages) => {
      const previous = allMessages[index - 1];
      const gapFromPreviousHours = previous
        ? Number(((message.timestampMs - previous.timestampMs) / 36e5).toFixed(2))
        : 0;

      return {
        ...message,
        gapFromPreviousHours,
      };
    });

  if (normalizedMessages.length === 0) {
    throw new Error("No valid timestamped messages were found after parsing.");
  }

  const activeDays = new Set(normalizedMessages.map((message) => message.dayKey)).size;
  const participants = Array.from(new Set(normalizedMessages.map((message) => message.sender))).sort();
  const fieldsPresent = Array.from(new Set(parsedUpload.fieldsPresent)).sort();
  const fieldsMissing = ["timestamp", "sender", "text", "id"].filter((field) => !fieldsPresent.includes(field));

  return {
    messages: normalizedMessages,
    scope: {
      sourceName: parsedUpload.sourceName,
      sourceType: parsedUpload.sourceType,
      importedRows: parsedUpload.rawRowCount,
      analyzedMessages: normalizedMessages.length,
      activeDays,
      participants,
      firstMessageAt: normalizedMessages[0].timestamp,
      lastMessageAt: normalizedMessages[normalizedMessages.length - 1].timestamp,
    },
    dataQuality: {
      fieldsPresent,
      fieldsMissing,
      sourceFields: parsedUpload.sourceFields,
      timezoneAssumption: parsedUpload.timezoneAssumption,
      parseWarnings: summarizeWarnings(warnings),
      duplicatesRemoved,
    },
  };
}

module.exports = {
  normalizeMessages,
};
