function formatDateTime(value, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

function formatDate(value, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildExecutiveSummary(normalized, analysis, timeZone) {
  const summaryPoints = [];
  summaryPoints.push(
    `${formatNumber(analysis.metrics.totalMessages)} messages were mapped across ${formatNumber(
      analysis.metrics.activeDays,
    )} active days.`,
  );

  if (analysis.metrics.longestGapHours > 0) {
    summaryPoints.push(
      `The longest gap between recorded messages lasted ${analysis.metrics.longestGapHours} hours.`,
    );
  }

  if (analysis.metrics.flaggedIntervals > 0) {
    summaryPoints.push(
      `${analysis.metrics.flaggedIntervals} intervals stood out for gaps, spikes, or shifts under the current settings.`,
    );
  } else {
    summaryPoints.push("No stronger gaps, spikes, or shifts stood out under the current settings.");
  }

  if (analysis.metrics.peakActivityHours.length > 0) {
    summaryPoints.push(`Activity clustered most around ${analysis.metrics.peakActivityHours.join(", ")}.`);
  }

  return {
    intro: `This timeline covers uploaded messaging data from ${formatDate(
      normalized.scope.firstMessageAt,
      timeZone,
    )} through ${formatDate(normalized.scope.lastMessageAt, timeZone)} and highlights patterns over time.`,
    points: summaryPoints.slice(0, 4),
  };
}

function buildMethodology(rules) {
  return [
    `Communication gaps are flagged when the elapsed time between adjacent messages exceeds ${rules.gapHours} hours.`,
    `Activity spikes are flagged in ${rules.spikeWindowHours}-hour windows when message volume reaches at least ${rules.spikeMinMessages} messages and exceeds the dataset baseline by ${rules.spikeMultiplier}x.`,
    `Time-of-day irregularities are flagged when at least ${rules.lateNightMinMessages} messages occur inside the configured late-night window of ${rules.lateNightStartHour}:00 to ${rules.lateNightEndHour}:00.`,
    `Sequence changes are flagged when one sender appears in an uninterrupted run of at least ${rules.sequenceMinRun} messages or exceeds the median run length by ${rules.sequenceRunMultiplier}x.`,
    "Indicators are based on timestamps and sequence structure only; message meaning is not interpreted.",
  ];
}

function buildDisclaimer() {
  return [
    "This report reflects only the uploaded records and the configured threshold rules.",
    "Missing exports, deleted messages, attachment-only rows, timezone differences, or source formatting issues can change the observed patterns.",
    "Flagged items are indicators for review, not determinations of intent, context, or causation.",
  ];
}

function buildReport({ normalized, analysis, rules, source }) {
  const timeZone = source.timezone;

  return {
    metadata: {
      title: "Conversation Timeline",
      sourceName: source.filename,
      sourceType: normalized.scope.sourceType.toUpperCase(),
      generatedAt: source.receivedAt,
      firstMessageAt: normalized.scope.firstMessageAt,
      lastMessageAt: normalized.scope.lastMessageAt,
      participants: normalized.scope.participants,
      timezone: source.timezone,
    },
    metrics: analysis.metrics,
    executiveSummary: buildExecutiveSummary(normalized, analysis, timeZone),
    dataQuality: normalized.dataQuality,
    scope: normalized.scope,
    groupedFindings: analysis.groupedFindings,
    timelineHighlights: analysis.timelineHighlights,
    visualSummary: analysis.visualSummary,
    chronology: analysis.chronology.map((group) => ({
      dayKey: group.dayKey,
      dateLabel: formatDate(group.items[0].timestamp, timeZone),
      totalMessages: group.items.length,
      items: group.items.map((message) => ({
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp,
        timeLabel: formatDateTime(message.timestamp, timeZone),
        gapFromPreviousHours: message.gapFromPreviousHours,
      })),
    })),
    methodology: buildMethodology(rules),
    disclaimer: buildDisclaimer(),
  };
}

module.exports = {
  buildReport,
};
