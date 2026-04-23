function formatHourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function classifyGapSeverity(hours, threshold) {
  if (hours >= threshold * 3) return "high";
  if (hours >= threshold * 2) return "medium";
  return "low";
}

function chunkByDay(messages) {
  const map = new Map();
  messages.forEach((message) => {
    const dayMessages = map.get(message.dayKey) || [];
    dayMessages.push(message);
    map.set(message.dayKey, dayMessages);
  });
  return Array.from(map.entries()).map(([dayKey, items]) => ({
    dayKey,
    items,
  }));
}

function analyzeGaps(messages, rules) {
  const gaps = [];
  for (let index = 1; index < messages.length; index += 1) {
    const previous = messages[index - 1];
    const current = messages[index];
    const hours = Number(((current.timestampMs - previous.timestampMs) / 36e5).toFixed(2));

    if (hours > rules.gapHours) {
      gaps.push({
        category: "communicationGaps",
        type: "gap",
        severity: classifyGapSeverity(hours, rules.gapHours),
        hours,
        startTimestamp: previous.timestamp,
        endTimestamp: current.timestamp,
        title: `${hours} hour gap between messages`,
        summary: `A longer pause of ${hours} hours appeared between recorded messages.`,
      });
    }
  }
  return gaps;
}

function analyzeSpikes(messages, rules) {
  const windowMs = rules.spikeWindowHours * 36e5;
  const buckets = new Map();

  messages.forEach((message) => {
    const bucketStart = Math.floor(message.timestampMs / windowMs) * windowMs;
    const bucket = buckets.get(bucketStart) || [];
    bucket.push(message);
    buckets.set(bucketStart, bucket);
  });

  const counts = Array.from(buckets.values()).map((bucket) => bucket.length);
  const average = counts.length
    ? counts.reduce((sum, count) => sum + count, 0) / counts.length
    : 0;

  return Array.from(buckets.entries())
    .map(([bucketStart, bucket]) => ({
      bucketStart,
      bucket,
      count: bucket.length,
    }))
    .filter((entry) => {
      const averageFloor = Math.max(1, average);
      return (
        entry.count >= rules.spikeMinMessages &&
        entry.count >= averageFloor * rules.spikeMultiplier
      );
    })
    .map((entry) => {
      const windowEnd = entry.bucketStart + windowMs;
      return {
        category: "activitySpikes",
        type: "spike",
        severity: entry.count >= rules.spikeMinMessages * 2 ? "high" : "medium",
        count: entry.count,
        startTimestamp: new Date(entry.bucketStart).toISOString(),
        endTimestamp: new Date(windowEnd).toISOString(),
        title: `${entry.count} messages in ${rules.spikeWindowHours} hours`,
        summary: `A busier-than-usual stretch included ${entry.count} messages within ${rules.spikeWindowHours} hours.`,
      };
    });
}

function isLateNightHour(hour, rules) {
  if (rules.lateNightStartHour > rules.lateNightEndHour) {
    return hour >= rules.lateNightStartHour || hour < rules.lateNightEndHour;
  }

  return hour >= rules.lateNightStartHour && hour < rules.lateNightEndHour;
}

function analyzeLateNight(messages, rules) {
  const clusters = [];
  let currentCluster = [];

  messages.forEach((message, index) => {
    const lateNight = isLateNightHour(message.hour, rules);
    if (!lateNight) {
      if (currentCluster.length >= rules.lateNightMinMessages) {
        clusters.push(currentCluster);
      }
      currentCluster = [];
      return;
    }

    if (currentCluster.length === 0) {
      currentCluster.push(message);
      return;
    }

    const previous = currentCluster[currentCluster.length - 1];
    const hoursBetween = (message.timestampMs - previous.timestampMs) / 36e5;
    if (hoursBetween <= 2) {
      currentCluster.push(message);
      if (index === messages.length - 1 && currentCluster.length >= rules.lateNightMinMessages) {
        clusters.push(currentCluster);
      }
      return;
    }

    if (currentCluster.length >= rules.lateNightMinMessages) {
      clusters.push(currentCluster);
    }
    currentCluster = [message];
    if (index === messages.length - 1 && currentCluster.length >= rules.lateNightMinMessages) {
      clusters.push(currentCluster);
    }
  });

  return clusters.map((cluster) => ({
    category: "timeOfDayIrregularities",
    type: "lateNight",
    severity: cluster.length >= rules.lateNightMinMessages + 3 ? "high" : "medium",
    count: cluster.length,
    startTimestamp: cluster[0].timestamp,
    endTimestamp: cluster[cluster.length - 1].timestamp,
    title: `${cluster.length} messages in a late-night cluster`,
    summary: `A cluster of ${cluster.length} messages fell inside the configured late-night window.`,
  }));
}

function analyzeSequenceChanges(messages, rules) {
  const streaks = [];
  let currentStreak = [messages[0]];

  for (let index = 1; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = currentStreak[currentStreak.length - 1];

    if (message.sender === previous.sender) {
      currentStreak.push(message);
      continue;
    }

    streaks.push(currentStreak);
    currentStreak = [message];
  }
  streaks.push(currentStreak);

  const medianLength = streaks.length
    ? streaks
        .map((streak) => streak.length)
        .sort((left, right) => left - right)[Math.floor(streaks.length / 2)]
    : 1;

  const threshold = Math.max(rules.sequenceMinRun, Math.ceil(medianLength * rules.sequenceRunMultiplier));

  return streaks
    .filter((streak) => streak.length >= threshold)
    .map((streak) => ({
      category: "sequenceChanges",
      type: "sequence",
      severity: streak.length >= threshold + 2 ? "high" : "medium",
      count: streak.length,
      sender: streak[0].sender,
      startTimestamp: streak[0].timestamp,
      endTimestamp: streak[streak.length - 1].timestamp,
      title: `${streak[0].sender} sent ${streak.length} messages in a row`,
      summary: `A run of ${streak.length} consecutive messages from ${streak[0].sender} marked a shift in the usual back-and-forth pattern.`,
    }));
}

function buildMetrics(messages, anomalies) {
  const longestGap = anomalies.communicationGaps.reduce((max, item) => Math.max(max, item.hours), 0);
  const activeDays = new Set(messages.map((message) => message.dayKey)).size;
  const hourCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: messages.filter((message) => message.hour === hour).length,
  }));
  const peakHours = hourCounts
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map((item) => formatHourLabel(item.hour));

  return {
    totalMessages: messages.length,
    activeDays,
    longestGapHours: Number(longestGap.toFixed(2)),
    flaggedIntervals:
      anomalies.communicationGaps.length +
      anomalies.activitySpikes.length +
      anomalies.timeOfDayIrregularities.length +
      anomalies.sequenceChanges.length,
    peakActivityHours: peakHours,
  };
}

function buildTimelineHighlights(messages, anomalies) {
  const highlights = [];

  if (anomalies.communicationGaps[0]) {
    const longestGap = [...anomalies.communicationGaps].sort((left, right) => right.hours - left.hours)[0];
    highlights.push({
      category: "Communication gap",
      title: longestGap.title,
      summary: longestGap.summary,
      timestamp: longestGap.endTimestamp,
    });
  }

  if (anomalies.activitySpikes[0]) {
    const largestSpike = [...anomalies.activitySpikes].sort((left, right) => right.count - left.count)[0];
    highlights.push({
      category: "Activity spike",
      title: largestSpike.title,
      summary: largestSpike.summary,
      timestamp: largestSpike.startTimestamp,
    });
  }

  if (anomalies.timeOfDayIrregularities[0]) {
    const lateNight = anomalies.timeOfDayIrregularities[0];
    highlights.push({
      category: "Time-of-day irregularity",
      title: lateNight.title,
      summary: lateNight.summary,
      timestamp: lateNight.startTimestamp,
    });
  }

  if (anomalies.sequenceChanges[0]) {
    const streak = anomalies.sequenceChanges[0];
    highlights.push({
      category: "Sequence change",
      title: streak.title,
      summary: streak.summary,
      timestamp: streak.startTimestamp,
    });
  }

  const dayGroups = chunkByDay(messages).sort((left, right) => right.items.length - left.items.length);
  if (dayGroups[0]) {
    highlights.push({
      category: "Peak day",
      title: `${dayGroups[0].items.length} messages on ${dayGroups[0].dayKey}`,
      summary: "This was the most active day in the imported dataset.",
      timestamp: dayGroups[0].items[0].timestamp,
    });
  }

  return highlights.slice(0, 6);
}

function buildVisualSummary(messages, anomalies) {
  const dailyActivity = chunkByDay(messages).map((group) => ({
    dayKey: group.dayKey,
    count: group.items.length,
  }));

  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: formatHourLabel(hour),
    count: messages.filter((message) => message.hour === hour).length,
  }));

  const categoryCounts = [
    { label: "Communication gaps", count: anomalies.communicationGaps.length },
    { label: "Activity spikes", count: anomalies.activitySpikes.length },
    { label: "Time-of-day irregularities", count: anomalies.timeOfDayIrregularities.length },
    { label: "Sequence changes", count: anomalies.sequenceChanges.length },
  ];

  return {
    dailyActivity,
    hourlyActivity,
    categoryCounts,
  };
}

function summarizeCategory(category, anomalies) {
  if (anomalies.length === 0) {
    return {
      category,
      count: 0,
      items: [],
      statement: "No stronger patterns crossed the current threshold.",
    };
  }

  return {
    category,
    count: anomalies.length,
    items: anomalies,
    statement: `${anomalies.length} pattern${anomalies.length === 1 ? "" : "s"} crossed the current threshold.`,
  };
}

function analyzeMessages(messages, rules) {
  const anomalies = {
    communicationGaps: analyzeGaps(messages, rules),
    activitySpikes: analyzeSpikes(messages, rules),
    timeOfDayIrregularities: analyzeLateNight(messages, rules),
    sequenceChanges: analyzeSequenceChanges(messages, rules),
  };

  const metrics = buildMetrics(messages, anomalies);
  const timelineHighlights = buildTimelineHighlights(messages, anomalies);
  const visualSummary = buildVisualSummary(messages, anomalies);

  return {
    anomalies,
    metrics,
    timelineHighlights,
    visualSummary,
    chronology: chunkByDay(messages),
    groupedFindings: [
      summarizeCategory("Communication gaps", anomalies.communicationGaps),
      summarizeCategory("Activity spikes", anomalies.activitySpikes),
      summarizeCategory("Time-of-day irregularities", anomalies.timeOfDayIrregularities),
      summarizeCategory("Sequence changes", anomalies.sequenceChanges),
    ],
  };
}

module.exports = {
  analyzeMessages,
};
