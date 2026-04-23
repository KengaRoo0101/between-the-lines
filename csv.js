function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  const compactRows = rows.filter((row) => row.some((value) => String(value || "").trim()));
  if (compactRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = compactRows[0].map((value) => String(value || "").trim());
  const dataRows = compactRows.slice(1).map((row) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = (row[index] || "").trim();
    });
    return entry;
  });

  return {
    headers,
    rows: dataRows,
  };
}

module.exports = {
  parseCsv,
};
