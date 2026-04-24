import React, { useEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

const MODE_OPTIONS = [
  {
    id: "documentation",
    label: "Operational Review",
    description: "Structured wording for projects, documentation, and formal review.",
  },
  {
    id: "general",
    label: "General Review",
    description: "Neutral wording focused on timing, gaps, and changes in rhythm.",
  },
  {
    id: "selfReview",
    label: "Self Pattern Review",
    description: "Reflective wording for looking back at your own communication patterns.",
  },
  {
    id: "relationship",
    label: "Relationship Review",
    description: "Gentle wording for reviewing changes in rhythm between people.",
  },
];

const SOURCE_EXAMPLES = [
  "WhatsApp export",
  "iMessage / Messages on Mac",
  "Email thread",
  "JSON",
  "CSV",
];

const SAMPLE_SOURCE = {
  name: "sample-conversation.json",
  path: "/samples/sample-conversation.json",
};

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/data-retention", label: "Data retention" },
];

const HERO_USE_CASES = [
  {
    title: "Business / Documentation",
    text: "We can help you see where work slowed down, where handoffs broke, and where the thread changed direction.",
  },
  {
    title: "General",
    text: "We can help you find the key moments without rereading the full conversation.",
  },
  {
    title: "Self Review",
    text: "We can help you look more clearly at your own patterns, where you paused, pushed, or changed tone.",
  },
  {
    title: "Relationship",
    text: "We can help you see where the rhythm changed between you, pauses, shifts, and moments that mattered.",
  },
];

const INTAKE_STEPS = [
  {
    step: "01",
    title: "Export the thread",
    text: "Save the conversation you want to review, keeping timestamps, sender names, and message text together.",
  },
  {
    step: "02",
    title: "Upload or preview",
    text: "Upload a JSON or CSV export, or open the sample report first if you want to see the flow before using your own file.",
  },
  {
    step: "03",
    title: "Read the pattern",
    text: "Start with the highlighted moments, inspect the chronology, and download the report if you need a record.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "This helped me see where communication was breaking down across a project thread. Instead of rereading everything, I could spot the delays and handoff problems right away.",
    name: "Jordan Lee",
    context: "Operations Lead",
  },
  {
    quote:
      "We used it to review a messy internal conversation, and it made the pacing issues obvious. It gave us something concrete to talk about.",
    name: "Maya Patel",
    context: "Team Manager",
  },
  {
    quote:
      "It gave me a cleaner way to understand a long work conversation without relying on memory or instinct. I could actually point to where things changed.",
    name: "Daniel Cho",
    context: "Legal Analyst",
  },
  {
    quote:
      "It showed me where the conversation actually shifted, not just where I felt hurt. That changed how I read the whole exchange.",
    name: "Taylor M.",
  },
  {
    quote:
      "The pauses and timing made the pattern much clearer than rereading the messages over and over.",
    name: "Chris A.",
  },
  {
    quote:
      "It helped me stop guessing. I could see where the rhythm changed between us, and that gave me a more grounded starting point.",
    name: "Jordan K.",
  },
];

const ANALYTICS_EVENTS = new Set([
  "landing_page_view",
  "click_upload",
  "click_sample",
  "upload_started",
  "upload_completed",
  "report_viewed",
  "feedback_clicked",
]);
const ANALYTICS_ENDPOINT = "/api/analytics";
const REPORT_SESSION_KEY = "btl-report-session";

const EXPORT_GUIDE_ITEMS = [
  {
    title: "WhatsApp",
    text:
      "Open the chat on your phone, use Export Chat, and choose without media for a smaller text record. If the export is a .txt file, convert it to CSV or JSON with timestamp, sender, and message text before uploading.",
  },
  {
    title: "iMessage / Messages on Mac",
    text:
      "On Mac, Messages can print or save a conversation as a PDF for your records. For analysis here, use a Messages export tool or cleaned table that gives you CSV or JSON rows with sender, time, and text.",
  },
  {
    title: "Email thread",
    text:
      "Open the full thread and save or print the conversation first. For upload, structure the thread as one row or object per message with sent time, sender, and body text.",
  },
  {
    title: "JSON",
    text:
      "Upload an array, or a nested export containing an array, of message objects. Common fields such as timestamp, time, date, sender, from, author, text, message, content, or body are recognized.",
  },
  {
    title: "CSV",
    text:
      "Use one message per row. Include a timestamp column, a sender/from column, and a text/message/body column. An id column is optional but helps with deduping repeated rows.",
  },
];

function trackEvent(name) {
  if (!ANALYTICS_EVENTS.has(name) || typeof window === "undefined") return;

  const payload = {
    name,
    at: new Date().toISOString(),
    path: window.location.pathname,
  };

  const queue = Array.isArray(window.__BTL_ANALYTICS__) ? window.__BTL_ANALYTICS__ : [];
  queue.push(payload);
  window.__BTL_ANALYTICS__ = queue;

  if (typeof window.plausible === "function") {
    window.plausible(name);
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", name);
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: name });
  }

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const eventBlob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(ANALYTICS_ENDPOINT, eventBlob);
      if (!sent) {
        fetch(ANALYTICS_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } else {
      fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics should never interrupt the review flow.
  }

  window.dispatchEvent(new CustomEvent("btl-analytics", { detail: payload }));
}

function normalizeSamplePayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.messages)) return payload.messages;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.records)) return payload.records;
  }
  return payload;
}

function persistReportSession(payload) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(REPORT_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures. Checkout can still proceed, but restore may not work.
  }
}

function readReportSession() {
  if (typeof window === "undefined") return null;

  try {
    const value = window.sessionStorage.getItem(REPORT_SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function clearReportSession() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(REPORT_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function cleanupPaymentQuery() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has("paid") && !url.searchParams.has("session_id")) return;

  url.searchParams.delete("paid");
  url.searchParams.delete("session_id");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

const MODE_COPY = {
  general: {
    label: "General Review",
    standoutLead:
      "Most of this conversation follows a readable rhythm until a few moments clearly break from it.",
    nowWhat: {
      clarity:
        "Read the flagged moment together with the messages just before and after it before deciding what it means.",
      context:
        "Compare the timing with nearby days, travel, missing exports, or other known context before drawing conclusions.",
      record:
        "Download the PDF, keep the original export, and note the timezone used for this report if you want a clean reference point.",
    },
  },
  relationship: {
    label: "Relationship Review",
    standoutLead:
      "Seen in relationship context, the thread feels mostly steady until a few moments noticeably change the rhythm.",
    nowWhat: {
      clarity:
        "Start with one concrete moment instead of the whole thread, so the conversation stays specific and easier to hear.",
      context:
        "Pair what the timeline shows with what you already know about schedules, stress, travel, or missing parts of the conversation.",
      record:
        "Save the PDF and the original export together if you want a calmer, more grounded way to revisit the timeline later.",
    },
  },
  selfReview: {
    label: "Self Pattern Review",
    standoutLead:
      "Looking back at this thread, the strongest signals come from changes in pace rather than any single line.",
    nowWhat: {
      clarity:
        "Re-read the moment that stands out most and ask what you were trying to communicate there, in timing as well as words.",
      context:
        "Notice whether your pace changed because of workload, mood, travel, or the platform itself before making the moment carry too much meaning.",
      record:
        "Download the PDF beside the original export if you want a snapshot of how this exchange felt at this point in time.",
    },
  },
  documentation: {
    label: "Operational Review",
    standoutLead:
      "From a business or documentation angle, the clearest markers in this file come from when the rhythm changes, pauses, or compresses.",
    nowWhat: {
      clarity:
        "Use each flagged moment as a timestamped waypoint and pair it with the surrounding messages in order.",
      context:
        "Note any missing sections, timezone assumptions, or external events that could change how the timeline reads.",
      record:
        "Download the PDF, keep the original export untouched, and store both with the timezone and source name.",
    },
  },
};

const MOMENT_PROMPTS = {
  gap: {
    general: [
      "I wonder what changed just before this pause.",
      "I wonder whether the same gap also appears in the wider thread.",
    ],
    relationship: [
      "I wonder what was happening for each person around this pause.",
      "I wonder whether this break matches something already known about the week.",
    ],
    selfReview: [
      "I wonder what I remember about my own pace here.",
      "I wonder whether more surrounding context would change how this pause reads.",
    ],
    documentation: [
      "I wonder whether any missing context, attachment, or timezone detail belongs next to this gap.",
      "I wonder whether it helps to note the exact start and end times of this pause.",
    ],
  },
  spike: {
    general: [
      "I wonder what made the pace tighten here.",
      "I wonder whether this burst resolves something or opens something new.",
    ],
    relationship: [
      "I wonder what brought the conversation into a faster rhythm here.",
      "I wonder whether this burst felt mutual or one-sided in context.",
    ],
    selfReview: [
      "I wonder what I was trying to move forward in this burst.",
      "I wonder whether the faster pace helped clarity or created pressure.",
    ],
    documentation: [
      "I wonder whether this burst lines up with any outside event worth noting.",
      "I wonder whether keeping the surrounding messages together clarifies the sequence.",
    ],
  },
  sequence: {
    general: [
      "I wonder what shifted in the back-and-forth rhythm here.",
      "I wonder whether this kind of run is common elsewhere in the file.",
    ],
    relationship: [
      "I wonder how this stretch felt on each side of the conversation.",
      "I wonder whether the usual back-and-forth had already started changing before this run.",
    ],
    selfReview: [
      "I wonder what I was hoping to communicate by staying with the thread this long.",
      "I wonder whether this run felt more urgent, more explanatory, or more unresolved.",
    ],
    documentation: [
      "I wonder whether this uninterrupted run matters more with the messages immediately around it.",
      "I wonder whether a note about sequence, not just content, would be useful here.",
    ],
  },
  timing: {
    general: [
      "I wonder what made this late-hour timing feel different from the broader pattern.",
      "I wonder whether the surrounding day helps explain why this cluster landed here.",
    ],
    relationship: [
      "I wonder whether this timing felt ordinary to both people or different from usual.",
      "I wonder whether this cluster aligns with a change in comfort, availability, or routine.",
    ],
    selfReview: [
      "I wonder what my own availability or state was at this hour.",
      "I wonder whether the timing matters here as much as the messages themselves.",
    ],
    documentation: [
      "I wonder whether the hour, timezone, or surrounding day should be documented alongside this cluster.",
      "I wonder whether this timing marker matters more when paired with another record.",
    ],
  },
  busyDay: {
    general: [
      "I wonder what made this day denser than the rest of the file.",
      "I wonder whether this day changes the overall picture or is an isolated spike.",
    ],
    relationship: [
      "I wonder whether this day reflects ease, tension, logistics, or simply availability.",
      "I wonder whether the pace of this day feels different from the days around it.",
    ],
    selfReview: [
      "I wonder what I was responding to on this day.",
      "I wonder whether this density felt constructive, stressful, or just practical.",
    ],
    documentation: [
      "I wonder whether this day should be saved as a reference point in the overall timeline.",
      "I wonder whether the density here matters more when paired with the gap before or after it.",
    ],
  },
};

const DEFAULT_STATUS = {
  tone: "neutral",
  eyebrow: "Analytical lens",
  title: "Choose the analytic lens that best fits the conversation you want to review.",
  detail: "You can upload first and change it later.",
};

function datePartsInTimeZone(value, timeZone) {
  const date = new Date(value);

  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
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
    };
  }
}

function dayKeyForValue(value, timeZone) {
  const parts = datePartsInTimeZone(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDate(value, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

function formatDateTime(value, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

function formatTime(value, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatAverage(value) {
  const digits = value >= 10 ? 0 : 1;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function joinReadable(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function countInclusiveDays(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / 86400000) + 1);
}

function formatDuration(hours) {
  if (!hours && hours !== 0) return "Not available";

  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} min`;
  }

  if (hours < 24) {
    const rounded = hours >= 10 ? Math.round(hours) : Number(hours.toFixed(1));
    return `${rounded} hr${rounded === 1 ? "" : "s"}`;
  }

  const days = hours / 24;
  const rounded = days >= 10 ? Math.round(days) : Number(days.toFixed(1));
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}

function formatDetailedDuration(hours) {
  if (!hours && hours !== 0) return "Not available";

  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  if (hours < 24) {
    const rounded = hours >= 10 ? Math.round(hours) : Number(hours.toFixed(1));
    return `${rounded} hour${rounded === 1 ? "" : "s"}`;
  }

  const totalHours = Math.round(hours);
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  if (remainingHours === 0) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return `${days} day${days === 1 ? "" : "s"} ${remainingHours} hr`;
}

function formatGapMarker(hours) {
  if (hours >= 36) {
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} later`;
  }

  const rounded = hours >= 10 ? Math.round(hours) : Number(hours.toFixed(1));
  return `${rounded} hour${rounded === 1 ? "" : "s"} later`;
}

function formatRatio(value) {
  if (!value || !Number.isFinite(value)) return null;
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}x`;
}

function formatShare(part, whole) {
  if (!whole) return "0%";
  const percent = Math.round((part / whole) * 100);
  return `${percent}%`;
}

function strengthLabel(severity) {
  if (severity === "high") return "Stronger";
  if (severity === "medium") return "Noticeable";
  return "Light";
}

function classifyGapSeverity(hours, threshold) {
  if (hours >= threshold * 3) return "high";
  if (hours >= threshold * 2) return "medium";
  return "low";
}

function getModeCopy(mode) {
  return MODE_COPY[mode] || MODE_COPY.general;
}

function getPrompts(kind, mode) {
  const promptSet = MOMENT_PROMPTS[kind] || MOMENT_PROMPTS.gap;
  return promptSet[mode] || promptSet.general;
}


function flattenChronology(chronology) {
  const messages = [];

  chronology.forEach((group) => {
    group.items.forEach((item, index) => {
      messages.push({
        ...item,
        dayKey: group.dayKey,
        dayLabel: group.dateLabel,
        dayIndex: index,
      });
    });
  });

  return messages;
}

function buildGapRecords(messages) {
  const gaps = [];

  for (let index = 1; index < messages.length; index += 1) {
    gaps.push({
      hours: messages[index].gapFromPreviousHours,
      startTimestamp: messages[index - 1].timestamp,
      endTimestamp: messages[index].timestamp,
      startMessage: messages[index - 1],
      endMessage: messages[index],
    });
  }

  return gaps.filter((gap) => gap.hours > 0);
}

function buildWindowStats(messages, windowHours) {
  const windowMs = windowHours * 36e5;
  const buckets = new Map();

  messages.forEach((message) => {
    const timestampMs = new Date(message.timestamp).getTime();
    const bucketStart = Math.floor(timestampMs / windowMs) * windowMs;
    const bucket = buckets.get(bucketStart) || [];
    bucket.push(message);
    buckets.set(bucketStart, bucket);
  });

  const entries = Array.from(buckets.entries()).map(([startTimestamp, bucket]) => ({
    startTimestamp,
    endTimestamp: startTimestamp + windowMs,
    count: bucket.length,
  }));

  return {
    averageCount: average(entries.map((entry) => entry.count)),
    busiest: entries.slice().sort((left, right) => right.count - left.count)[0] || null,
  };
}

function buildStreakStats(messages) {
  if (!messages.length) {
    return {
      streaks: [],
      medianLength: 1,
    };
  }

  const streaks = [];
  let currentStreak = [messages[0]];

  for (let index = 1; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = currentStreak[currentStreak.length - 1];

    if (message.sender === previous.sender) {
      currentStreak.push(message);
      continue;
    }

    streaks.push({
      sender: currentStreak[0].sender,
      count: currentStreak.length,
      startTimestamp: currentStreak[0].timestamp,
      endTimestamp: currentStreak[currentStreak.length - 1].timestamp,
      dayKey: currentStreak[0].dayKey,
    });
    currentStreak = [message];
  }

  streaks.push({
    sender: currentStreak[0].sender,
    count: currentStreak.length,
    startTimestamp: currentStreak[0].timestamp,
    endTimestamp: currentStreak[currentStreak.length - 1].timestamp,
    dayKey: currentStreak[0].dayKey,
  });

  return {
    streaks,
    medianLength: median(streaks.map((item) => item.count)) || 1,
  };
}

function isLateNightHour(hour, rules) {
  if (rules.lateNightStartHour > rules.lateNightEndHour) {
    return hour >= rules.lateNightStartHour || hour < rules.lateNightEndHour;
  }

  return hour >= rules.lateNightStartHour && hour < rules.lateNightEndHour;
}

function buildLateNightStats(messages, rules) {
  const lateMessages = messages.filter((message) =>
    isLateNightHour(new Date(message.timestamp).getHours(), rules),
  );

  return {
    count: lateMessages.length,
    share: messages.length ? lateMessages.length / messages.length : 0,
  };
}

function getFindingItems(report, key) {
  const group = report.groupedFindings.find((item) => normalizeKey(item.category) === key);
  return group ? group.items.slice() : [];
}

function buildFlagRanges(report) {
  return report.groupedFindings.flatMap((group) =>
    group.items.map((item) => ({
      startMs: new Date(item.startTimestamp).getTime(),
      endMs: new Date(item.endTimestamp || item.startTimestamp).getTime(),
      severity: item.severity || "low",
    })),
  );
}

function getMessageFlagSeverity(message, flagRanges, rules) {
  let weight = 0;

  if (message.gapFromPreviousHours > rules.gapHours) {
    weight = Math.max(weight, 1);
  }

  const messageMs = new Date(message.timestamp).getTime();

  flagRanges.forEach((range) => {
    if (messageMs < range.startMs || messageMs > range.endMs) {
      return;
    }

    if (range.severity === "high") {
      weight = Math.max(weight, 3);
      return;
    }

    if (range.severity === "medium") {
      weight = Math.max(weight, 2);
      return;
    }

    weight = Math.max(weight, 1);
  });

  if (weight >= 3) return "high";
  if (weight === 2) return "medium";
  if (weight === 1) return "low";
  return "";
}

function dedupeMoments(items) {
  const seen = new Set();
  const unique = [];

  items.forEach((item) => {
    if (!item) return;
    const key = `${item.kind}-${item.anchorId}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });

  return unique;
}

function buildGapMoment(item, context) {
  if (!item) return null;

  const severity = item.severity || classifyGapSeverity(item.hours, context.rules.gapHours);
  const ratio = context.typicalGapHours ? item.hours / context.typicalGapHours : 0;
  const ratioText = formatRatio(ratio);
  const anchorTimestamp = item.endTimestamp || item.startTimestamp;

  return {
    kind: "gap",
    label: "Longest gap",
    title: "This is the clearest pause in the thread",
    anchorId: `moment-gap-${slugify(anchorTimestamp)}`,
    dayKey: dayKeyForValue(anchorTimestamp, context.timeZone),
    cardValue: formatDuration(item.hours),
    cardSummary: "The thread pauses here longer than anywhere else.",
    cardNote: `From ${formatDate(item.startTimestamp, context.timeZone)} to ${formatDate(
      item.endTimestamp,
      context.timeZone,
    )}.`,
    windowLabel: `${formatDateTime(item.startTimestamp, context.timeZone)} to ${formatDateTime(
      item.endTimestamp,
      context.timeZone,
    )}`,
    whatHappened: `No recorded messages appear for ${formatDetailedDuration(item.hours)} before the thread picks back up.`,
    baselineContext: context.typicalGapHours
      ? `Most gaps in this file are closer to ${formatDetailedDuration(context.typicalGapHours)}.`
      : "Most of the thread moves in shorter intervals than this.",
    whyItStandsOut: ratioText
      ? `That pause is about ${ratioText} longer than the usual gap in this file.`
      : `It is well beyond the flagged gap threshold of ${formatDetailedDuration(context.rules.gapHours)}.`,
    strength: strengthLabel(severity),
    severity,
    prompts: getPrompts("gap", context.mode),
    magnitude: item.hours,
  };
}

function buildSpikeMoment(item, context) {
  if (!item) return null;

  const ratio = item.count / Math.max(1, context.windowStats.averageCount);
  const ratioText = formatRatio(ratio);

  return {
    kind: "spike",
    label: "Biggest shift",
    title: "Here the pattern tightens fast",
    anchorId: `moment-spike-${slugify(item.startTimestamp)}`,
    dayKey: dayKeyForValue(item.startTimestamp, context.timeZone),
    cardValue: `${formatNumber(item.count)} messages / ${context.rules.spikeWindowHours} hrs`,
    cardSummary: "The pace changes most sharply here.",
    cardNote: `The busiest ${context.rules.spikeWindowHours}-hour window in the file.`,
    windowLabel: `${formatDateTime(item.startTimestamp, context.timeZone)} to ${formatDateTime(
      item.endTimestamp,
      context.timeZone,
    )}`,
    whatHappened: `${formatNumber(item.count)} messages land inside a ${context.rules.spikeWindowHours}-hour window.`,
    baselineContext: `Comparable ${context.rules.spikeWindowHours}-hour windows in this file average about ${formatAverage(
      context.windowStats.averageCount || 0,
    )} messages.`,
    whyItStandsOut: ratioText
      ? `That pace is about ${ratioText} the usual window volume for this file.`
      : "That window is much denser than the broader pace of the thread.",
    strength: strengthLabel(item.severity || "medium"),
    severity: item.severity || "medium",
    prompts: getPrompts("spike", context.mode),
    magnitude: ratio,
  };
}

function buildSequenceMoment(item, context) {
  if (!item) return null;

  const ratio = item.count / Math.max(1, context.streakStats.medianLength);
  const ratioText = formatRatio(ratio);

  return {
    kind: "sequence",
    label: "Biggest shift",
    title: "One side carries the thread longer here",
    anchorId: `moment-sequence-${slugify(item.startTimestamp)}`,
    dayKey: dayKeyForValue(item.startTimestamp, context.timeZone),
    cardValue: `${formatNumber(item.count)} in a row`,
    cardSummary: "One side carries more of the exchange here.",
    cardNote: `${item.sender} sends the longest uninterrupted run.`,
    windowLabel: `${formatDateTime(item.startTimestamp, context.timeZone)} to ${formatDateTime(
      item.endTimestamp,
      context.timeZone,
    )}`,
    whatHappened: `${item.sender} sends ${formatNumber(item.count)} messages in a row without the speaker switching.`,
    baselineContext: `Most runs in this file switch after about ${formatAverage(
      context.streakStats.medianLength,
    )} message${context.streakStats.medianLength === 1 ? "" : "s"}.`,
    whyItStandsOut: ratioText
      ? `That run is about ${ratioText} the usual streak length for this file.`
      : "That run is longer than the usual back-and-forth in this file.",
    strength: strengthLabel(item.severity || "medium"),
    severity: item.severity || "medium",
    prompts: getPrompts("sequence", context.mode),
    magnitude: ratio,
  };
}

function buildTimingMoment(item, context) {
  if (!item) return null;

  return {
    kind: "timing",
    label: "Unusual timing",
    title: "This is the clearest timing shift",
    anchorId: `moment-timing-${slugify(item.startTimestamp)}`,
    dayKey: dayKeyForValue(item.startTimestamp, context.timeZone),
    cardValue: `${formatNumber(item.count)} late-hour messages`,
    cardSummary: "This is where the timing changes most clearly.",
    cardNote: `Late-hour cluster between ${formatTime(item.startTimestamp, context.timeZone)} and ${formatTime(
      item.endTimestamp,
      context.timeZone,
    )}.`,
    windowLabel: `${formatDateTime(item.startTimestamp, context.timeZone)} to ${formatDateTime(
      item.endTimestamp,
      context.timeZone,
    )}`,
    whatHappened: `${formatNumber(item.count)} messages land inside the late-hour window in one cluster.`,
    baselineContext: context.peakHours.length
      ? `The broader file is most active around ${joinReadable(context.peakHours)}. Even within that pattern, this cluster is unusually concentrated.`
      : "Most of the broader file does not cluster this tightly in late hours.",
    whyItStandsOut: `It is the strongest late-hour cluster in the file and clears the review threshold of ${formatNumber(
      context.rules.lateNightMinMessages,
    )} messages.`,
    strength: strengthLabel(item.severity || "medium"),
    severity: item.severity || "medium",
    prompts: getPrompts("timing", context.mode),
    magnitude: item.count,
  };
}

function buildBusyDayMoment(day, context) {
  if (!day) return null;

  const dayGroup = context.report.chronology.find((group) => group.dayKey === day.dayKey);
  if (!dayGroup) return null;

  return {
    kind: "busyDay",
    label: "Peak day",
    title: "One day carries more of the thread",
    anchorId: `moment-busy-day-${slugify(day.dayKey)}`,
    dayKey: day.dayKey,
    cardValue: `${formatNumber(day.count)} messages`,
    cardNote: `on ${dayGroup.dateLabel}`,
    windowLabel: dayGroup.dateLabel,
    whatHappened: `${formatNumber(day.count)} messages appear on ${dayGroup.dateLabel}.`,
    baselineContext: `Across the covered date range, this file averages about ${formatAverage(
      context.averageMessagesPerDay,
    )} messages per day.`,
    whyItStandsOut: `That day accounts for ${formatShare(day.count, context.totalMessages)} of the total messages in the file.`,
    strength: "Noticeable",
    severity: "medium",
    prompts: getPrompts("busyDay", context.mode),
    magnitude: day.count / Math.max(1, context.averageMessagesPerDay),
  };
}

function buildWindowFallbackMoment(windowEntry, context) {
  if (!windowEntry) return null;

  const ratio = windowEntry.count / Math.max(1, context.windowStats.averageCount);
  const ratioText = formatRatio(ratio);
  const startTimestamp = new Date(windowEntry.startTimestamp).toISOString();
  const endTimestamp = new Date(windowEntry.endTimestamp).toISOString();

  return {
    kind: "windowFallback",
    label: "Rhythm shift",
    title: "One short window stands apart",
    anchorId: `moment-window-${slugify(startTimestamp)}`,
    dayKey: dayKeyForValue(startTimestamp, context.timeZone),
    cardValue: `${formatNumber(windowEntry.count)} messages / ${context.rules.spikeWindowHours} hrs`,
    cardNote: "the busiest short window in the file",
    windowLabel: `${formatDateTime(startTimestamp, context.timeZone)} to ${formatDateTime(
      endTimestamp,
      context.timeZone,
    )}`,
    whatHappened: `${formatNumber(windowEntry.count)} messages landed in the busiest ${context.rules.spikeWindowHours}-hour window in the file.`,
    baselineContext: `Comparable ${context.rules.spikeWindowHours}-hour windows average about ${formatAverage(
      context.windowStats.averageCount || 0,
    )} messages here.`,
    whyItStandsOut: ratioText
      ? `It is about ${ratioText} the usual short-window pace in this file.`
      : "It is the busiest short window in the file.",
    strength: "Light",
    severity: "low",
    prompts: getPrompts("spike", context.mode),
    magnitude: ratio,
  };
}

function buildSequenceFallbackMoment(streak, context) {
  if (!streak) return null;

  const ratio = streak.count / Math.max(1, context.streakStats.medianLength);
  const ratioText = formatRatio(ratio);

  return {
    kind: "sequenceFallback",
    label: "Rhythm shift",
    title: "One run carries more of the thread",
    anchorId: `moment-sequence-fallback-${slugify(streak.startTimestamp)}`,
    dayKey: dayKeyForValue(streak.startTimestamp, context.timeZone),
    cardValue: `${formatNumber(streak.count)} in a row`,
    cardNote: `${streak.sender} has the longest uninterrupted run in the file`,
    windowLabel: `${formatDateTime(streak.startTimestamp, context.timeZone)} to ${formatDateTime(
      streak.endTimestamp,
      context.timeZone,
    )}`,
    whatHappened: `${streak.sender} sent ${formatNumber(streak.count)} messages in a row, which is the longest uninterrupted run in this file.`,
    baselineContext: `Most runs in this file switch after about ${formatAverage(
      context.streakStats.medianLength,
    )} message${context.streakStats.medianLength === 1 ? "" : "s"}.`,
    whyItStandsOut: ratioText
      ? `That makes it about ${ratioText} the usual run length in this file.`
      : "It is the longest uninterrupted run in the file.",
    strength: "Light",
    severity: "low",
    prompts: getPrompts("sequence", context.mode),
    magnitude: ratio,
  };
}

function buildStartHereCards(context) {
  const cards = [];

  if (context.longestGapMoment) {
    cards.push({
      label: "Longest gap",
      value: context.longestGapMoment.cardValue,
      summary: context.longestGapMoment.cardSummary,
      note: context.longestGapMoment.cardNote,
      targetId: context.longestGapMoment.anchorId,
      timelineDayKey: context.longestGapMoment.dayKey,
      inspectTargetId: `timeline-${context.longestGapMoment.dayKey}`,
    });
  } else {
    cards.push({
      label: "Longest gap",
      value: "No readable gap",
      summary: "No longer pause stands out in this file.",
      note: "This file does not include enough timing data to calculate one.",
      targetId: "what-stands-out",
      timelineDayKey: null,
      inspectTargetId: "full-timeline",
    });
  }

  if (context.primaryShiftMoment) {
    cards.push({
      label: "Biggest shift",
      value: context.primaryShiftMoment.cardValue,
      summary: context.primaryShiftMoment.cardSummary,
      note: context.primaryShiftMoment.cardNote,
      targetId: context.primaryShiftMoment.anchorId,
      timelineDayKey: context.primaryShiftMoment.dayKey,
      inspectTargetId: `timeline-${context.primaryShiftMoment.dayKey}`,
    });
  } else {
    cards.push({
      label: "Biggest shift",
      value: "No major shift flagged",
      summary: "The rhythm stays closer to the broader pattern.",
      note: "No change in pace stands out more than the rest.",
      targetId: "typical-pattern",
      timelineDayKey: null,
      inspectTargetId: "full-timeline",
    });
  }

  if (context.timingMoment) {
    cards.push({
      label: "Unusual timing",
      value: context.timingMoment.cardValue,
      summary: context.timingMoment.cardSummary,
      note: context.timingMoment.cardNote,
      targetId: context.timingMoment.anchorId,
      timelineDayKey: context.timingMoment.dayKey,
      inspectTargetId: `timeline-${context.timingMoment.dayKey}`,
    });
  } else {
    cards.push({
      label: "Unusual timing",
      value: context.peakHours.length ? context.peakHours.join(" · ") : "No timing flag",
      summary: context.peakHours.length
        ? "These are the busiest hours in the file."
        : "No late-hour timing change stands apart.",
      note: context.peakHours.length
        ? "These are the peak activity hours in the file."
        : "No late-hour cluster crossed the review threshold.",
      targetId: "typical-pattern",
      timelineDayKey: null,
      inspectTargetId: "full-timeline",
    });
  }

  return cards;
}

function buildReportLead(context) {
  const count = [context.longestGapMoment, context.primaryShiftMoment, context.timingMoment].filter(Boolean).length;

  if (count >= 3) return "Mostly steady. Three clear breaks.";
  if (count === 2) return "Mostly steady. Two clear breaks.";
  if (count === 1) return "Mostly steady. One clear break.";
  return "Mostly steady from start to finish.";
}

function buildStandoutParagraph(context) {
  const details = [];

  if (context.longestGapMoment) {
    details.push(`a ${context.longestGapMoment.cardValue} pause`);
  }

  if (context.primaryShiftMoment) {
    if (context.primaryShiftMoment.kind === "spike") {
      details.push(`a short burst of ${context.primaryShiftMoment.cardValue}`);
    } else if (context.primaryShiftMoment.kind === "sequence") {
      details.push(`${context.primaryShiftMoment.cardValue} from one sender without the usual switch`);
    }
  }

  if (context.timingMoment) {
    details.push("a concentrated late-hour cluster");
  }

  if (!details.length) {
    return "The rhythm stays steady from start to finish.";
  }

  return `Mostly steady overall. The clearest changes are ${joinReadable(details)}.`;
}

function buildMethodologyCards(rules) {
  return [
    {
      title: "Gaps",
      text: `Longer pauses are surfaced when adjacent messages are more than ${formatDetailedDuration(rules.gapHours)} apart.`,
    },
    {
      title: "Bursts",
      text: `Short bursts are surfaced in ${rules.spikeWindowHours}-hour windows when message count rises above the broader baseline.`,
    },
    {
      title: "Late-hour timing",
      text: `Timing patterns are surfaced when at least ${formatNumber(rules.lateNightMinMessages)} messages land inside the late-hour window.`,
    },
    {
      title: "Back-and-forth rhythm",
      text: `Rhythm shifts are surfaced when one sender holds the thread longer than the usual run length.`,
    },
  ];
}

function buildInterpretationCards() {
  return [
    {
      title: "Interpretation boundary",
      text: "This report highlights timing and activity patterns. It does not determine intent or verify events.",
    },
    {
      title: "Use rights",
      text: "Only upload files you have the right to use.",
    },
    {
      title: "Privacy in this implementation",
      text: "Files are sent to the local app server for analysis during the current session. This implementation does not write uploaded files to disk.",
    },
  ];
}

function buildPresentation(report, rules, mode) {
  const modeCopy = getModeCopy(mode);
  const timeZone = report.metadata.timezone;
  const messages = flattenChronology(report.chronology);
  const totalMessages = report.metrics.totalMessages;
  const inclusiveDays = countInclusiveDays(report.metadata.firstMessageAt, report.metadata.lastMessageAt);
  const averageMessagesPerDay = totalMessages / inclusiveDays;
  const allGaps = buildGapRecords(messages);
  const typicalGapHours = median(allGaps.map((gap) => gap.hours)) || 0;
  const windowStats = buildWindowStats(messages, rules.spikeWindowHours);
  const streakStats = buildStreakStats(messages);
  const lateNightStats = buildLateNightStats(messages, rules);
  const peakHours = report.metrics.peakActivityHours;
  const flagRanges = buildFlagRanges(report);

  const communicationGaps = getFindingItems(report, "communicationgaps").sort((left, right) => right.hours - left.hours);
  const activitySpikes = getFindingItems(report, "activityspikes").sort((left, right) => right.count - left.count);
  const timeOfDayIrregularities = getFindingItems(report, "timeofdayirregularities").sort(
    (left, right) => right.count - left.count,
  );
  const sequenceChanges = getFindingItems(report, "sequencechanges").sort((left, right) => right.count - left.count);

  const rawLongestGap = allGaps.slice().sort((left, right) => right.hours - left.hours)[0] || null;
  const longestGapMoment = buildGapMoment(communicationGaps[0] || rawLongestGap, {
    report,
    rules,
    mode,
    modeCopy,
    typicalGapHours,
    timeZone,
  });

  const spikeMoment = buildSpikeMoment(activitySpikes[0], {
    report,
    rules,
    mode,
    windowStats,
    timeZone,
  });

  const sequenceMoment = buildSequenceMoment(sequenceChanges[0], {
    report,
    rules,
    mode,
    streakStats,
    timeZone,
  });

  const timingMoment = buildTimingMoment(timeOfDayIrregularities[0], {
    report,
    rules,
    mode,
    peakHours,
    timeZone,
  });

  const busyDay = report.visualSummary.dailyActivity
    .slice()
    .sort((left, right) => right.count - left.count)[0];

  const busyDayMoment = buildBusyDayMoment(busyDay, {
    report,
    rules,
    mode,
    averageMessagesPerDay,
    totalMessages,
  });

  const fallbackWindowMoment = !spikeMoment
    ? buildWindowFallbackMoment(windowStats.busiest, {
        rules,
        mode,
        windowStats,
        timeZone,
      })
    : null;

  const fallbackSequenceMoment = !sequenceMoment
    ? buildSequenceFallbackMoment(
        streakStats.streaks.slice().sort((left, right) => right.count - left.count)[0],
        {
          mode,
        streakStats,
        timeZone,
      },
    )
    : null;

  const primaryShiftMoment = [spikeMoment, sequenceMoment]
    .filter(Boolean)
    .sort((left, right) => right.magnitude - left.magnitude)[0] || null;

  const secondaryShiftMoment =
    primaryShiftMoment && primaryShiftMoment.kind === "spike" ? sequenceMoment : spikeMoment;

  const keyMoments = dedupeMoments([
    longestGapMoment,
    primaryShiftMoment,
    timingMoment,
    secondaryShiftMoment,
    busyDayMoment,
    fallbackWindowMoment,
    fallbackSequenceMoment,
  ]).slice(0, 5);

  const context = {
    modeCopy,
    longestGapMoment,
    primaryShiftMoment,
    timingMoment,
    averageMessagesPerDay,
    typicalGapHours,
    peakHours,
  };

  return {
    report,
    rules,
    modeCopy,
    reportLead: buildReportLead(context),
    fileSummary: [
      {
        label: "File name",
        value: report.metadata.sourceName,
      },
      {
        label: "Date range",
        value: `${formatDate(report.metadata.firstMessageAt, timeZone)} to ${formatDate(
          report.metadata.lastMessageAt,
          timeZone,
        )}`,
      },
      {
        label: "Total messages",
        value: formatNumber(report.metrics.totalMessages),
      },
    ],
    startHereCards: buildStartHereCards(context),
    standoutParagraph: buildStandoutParagraph(context),
    typicalPattern: {
      averageMessagesPerDay: `${formatAverage(averageMessagesPerDay)} / day`,
      typicalGapDuration: typicalGapHours ? formatDetailedDuration(typicalGapHours) : "Not enough data",
      peakActivityHours: peakHours.length ? peakHours.join(" · ") : "No clear peak window",
    },
    keyMoments,
    nowWhat: [
      {
        title: "If you want clarity",
        text: modeCopy.nowWhat.clarity,
      },
      {
        title: "If you want context",
        text: modeCopy.nowWhat.context,
      },
      {
        title: "If you want a record",
        text: modeCopy.nowWhat.record,
      },
    ],
    methodologyCards: buildMethodologyCards(rules),
    interpretationCards: buildInterpretationCards(),
    interpretationFootnote:
      "Between The Lines uses neutral pattern language. It is not a cheating detector, a surveillance tool, or legal advice, and it does not infer identity or intent.",
    flagRanges,
    lateNightStats,
    timelineSummary: `${formatNumber(report.metrics.totalMessages)} messages across ${formatNumber(
      report.metrics.activeDays,
    )} active days.`,
  };
}

function SectionHeader({ kicker, title, copy, action }) {
  return html`
    <div className="section-header">
      <div>
        ${kicker ? html`<p className="section-kicker">${kicker}</p>` : null}
        <h2>${title}</h2>
        ${copy ? html`<p className="section-copy">${copy}</p>` : null}
      </div>
      ${action || null}
    </div>
  `;
}

function easeOutCubic(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

function animateScrollToElement(target, duration = 260) {
  if (!target) return;

  const targetTop = window.scrollY + target.getBoundingClientRect().top - 18;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, targetTop);
    return;
  }

  const startTop = window.scrollY;
  const delta = targetTop - startTop;
  const startTime = performance.now();

  function step(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(progress);

    window.scrollTo(0, startTop + delta * eased);

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  }

  window.requestAnimationFrame(step);
}

function SelectorGroup({ title, copy, options, value, onChange, disabled, className = "" }) {
  return html`
    <section className=${`selector-group ${className}`.trim()}>
      <div className="selector-copy">
        <h3>${title}</h3>
        ${copy ? html`<p>${copy}</p>` : null}
      </div>

      <div className="selector-grid">
        ${options.map(
          (option) => html`
            <button
              key=${option.id}
              type="button"
              className=${`selector-button ${value === option.id ? "active" : ""}`}
              aria-pressed=${value === option.id}
              disabled=${disabled}
              onClick=${() => onChange(option.id)}
            >
              <div className="selector-button-title">
                <strong>${option.label}</strong>
              </div>
              <span>${option.description}</span>
            </button>
          `,
        )}
      </div>
    </section>
  `;
}

function ExportGuide({ className = "helper-disclosure export-guide-card" }) {
  return html`
    <details id="export-guide" className=${className}>
      <summary id="export-guide-summary">How do I export my messages?</summary>
      <p className="helper-intro">
        The upload works best when each message has a timestamp, sender, and message body. Platform exports that come out as text or PDF may need to be saved as CSV or JSON before upload.
      </p>
      <div className="helper-grid">
        ${EXPORT_GUIDE_ITEMS.map(
          (item) => html`
            <article key=${item.title}>
              <strong>${item.title}</strong>
              <p>${item.text}</p>
            </article>
          `,
        )}
      </div>
    </details>
  `;
}

function HeroUseCases() {
  return html`
    <div className="hero-purpose-card">
      <div className="hero-usecases-header">
        <h2 className="hero-purpose-title">How we can help</h2>
      </div>

      <div className="hero-usecases-grid">
        ${HERO_USE_CASES.map(
          (item) => html`
            <article key=${item.title} className="hero-usecase-card">
              <strong>${item.title}</strong>
              <p>${item.text}</p>
            </article>
          `,
        )}
      </div>
    </div>
  `;
}

function LegalLinks({ className = "", includeDisclaimer = false }) {
  const items = includeDisclaimer
    ? [...LEGAL_LINKS, { href: "/disclaimer", label: "Disclaimer" }]
    : LEGAL_LINKS;

  return html`
    <nav className=${`footer-links ${className}`.trim()} aria-label="Legal links">
      ${items.map(
        (item) => html`
          <a key=${item.href} href=${item.href} target="_blank" rel="noreferrer">
            ${item.label}
          </a>
        `,
      )}
    </nav>
  `;
}

function ConsentChecklist({
  hasUploadRightsConsent,
  hasResearchConsent,
  consentError,
  onUploadRightsChange,
  onResearchConsentChange,
}) {
  return html`
    <div className="consent-panel">
      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked=${hasUploadRightsConsent}
          onChange=${(event) => onUploadRightsChange(event.target.checked)}
        />
        <span>
          I confirm I have the right to upload this data and agree to the
          <a href="/terms" target="_blank" rel="noreferrer"> Terms </a>
          and
          <a href="/privacy" target="_blank" rel="noreferrer"> Privacy Policy</a>.
        </span>
      </label>

      <label className="consent-checkbox consent-checkbox-optional">
        <input
          type="checkbox"
          checked=${hasResearchConsent}
          onChange=${(event) => onResearchConsentChange(event.target.checked)}
        />
        <span>
          I agree to allow anonymized pattern data to be used to improve research, safety tools, and communication
          insights. My private messages and identifying details will not be sold.
        </span>
      </label>

      ${consentError
        ? html`
            <p className="consent-error" role="alert">${consentError}</p>
          `
        : null}
    </div>
  `;
}

function HeroSection({
  onOpenFile,
  onUseSample,
  disabled,
  hasUploadRightsConsent,
  hasResearchConsent,
  consentError,
  onUploadRightsChange,
  onResearchConsentChange,
}) {
  return html`
    <section className="hero-card no-print" data-reveal>
      <div className="hero-copy-block">
        <h1>Between The Lines</h1>
        <p className="hero-subhead">
          Upload a conversation export and see the gaps, spikes, and shifts that are easy to miss when a thread gets long.
        </p>

        <div className="hero-entry-panel">
          <p className="hero-entry-note">Start with your own JSON or CSV export, or preview the sample report first.</p>

          <${ConsentChecklist}
            hasUploadRightsConsent=${hasUploadRightsConsent}
            hasResearchConsent=${hasResearchConsent}
            consentError=${consentError}
            onUploadRightsChange=${onUploadRightsChange}
            onResearchConsentChange=${onResearchConsentChange}
          />

          <div className="hero-actions">
            <button type="button" className="primary-button" disabled=${disabled} onClick=${onOpenFile}>
              Upload file
            </button>
            <button type="button" className="secondary-button" disabled=${disabled} onClick=${onUseSample}>
              View sample report
            </button>
          </div>

          <p className="support-line">No account needed / Local session analysis / PDF-ready report</p>
        </div>
      </div>

      <div className="hero-sidecar">
        <${HeroUseCases} />
      </div>
    </section>
  `;
}

function StartGuidanceSection({ onOpenFile, onUseSample, disabled }) {
  return html`
    <section className="panel start-panel no-print" data-reveal>
      <${SectionHeader}
        title="Get started in a minute"
        copy="Bring a saved conversation export, or use the sample to preview the report before uploading your own file."
      />

      <ol className="intake-steps" aria-label="Get started in a minute">
        ${INTAKE_STEPS.map(
          (item) => html`
            <li key=${item.step} className="intake-step-card">
              <span className="intake-step-number">${item.step}</span>
              <div>
                <h3>${item.title}</h3>
                <p>${item.text}</p>
              </div>
            </li>
          `,
        )}
      </ol>

      <div className="intake-entry-grid">
        <article className="intake-entry-card">
          <span className="entry-kicker">Upload</span>
          <h3>Your conversation export</h3>
          <p>Use a JSON or CSV file with timestamps, sender names, and message text.</p>
          <button type="button" className="primary-button entry-action" disabled=${disabled} onClick=${onOpenFile}>
            Upload file
          </button>
        </article>

        <article className="intake-entry-card sample-entry-card">
          <span className="entry-kicker">Sample</span>
          <h3>Preview the report</h3>
          <p>Open the sample dataset to see the highlighted moments, chronology, and download flow.</p>
          <button type="button" className="secondary-button entry-action" disabled=${disabled} onClick=${onUseSample}>
            View sample report
          </button>
        </article>
      </div>

      <div className="start-guidance-footer">
        <div className="start-guidance-formats">
          <p className="start-guidance-note">Common starting points</p>
          <div className="example-row">
            ${SOURCE_EXAMPLES.map(
              (example) => html`
                <span key=${example} className="example-chip">${example}</span>
              `,
            )}
          </div>
          <p className="start-guidance-subnote">
            Direct uploads should be JSON or CSV. The export helper explains how to prepare other sources.
          </p>
        </div>

        <div className="start-guidance-help">
          <p className="start-guidance-note">Need help exporting?</p>
          <${ExportGuide} />
        </div>
      </div>
    </section>
  `;
}

function TestimonialsSection() {
  return html`
    <section className="panel testimonials-panel no-print" data-reveal>
      <div className="compact-section-heading">
        <h2>Testimonials</h2>
      </div>

      <div className="testimonials-grid">
        ${TESTIMONIALS.map(
          (item) => html`
            <article key=${item.quote} className="testimonial-card">
              <p className="testimonial-quote">"${item.quote}"</p>
              <div className="testimonial-meta">
                <strong>${item.name}</strong>
                ${item.context ? html`<span>${item.context}</span>` : null}
              </div>
            </article>
          `,
        )}
      </div>
    </section>
  `;
}

function SetupSection({
  mode,
  status,
  isProcessing,
  onModeChange,
}) {
  const showSetupStatus = status?.tone === "error";

  return html`
    <section id="analysis-options" className="panel setup-panel no-print" data-reveal>
      ${showSetupStatus
        ? html`
            <div className="setup-status tone-error" aria-live="polite">
              <strong>${status.title}</strong>
              <p>${status.detail}</p>
            </div>
          `
        : null}

      <details className="advanced-disclosure">
        <summary>
          <div className="advanced-summary-copy">
            <p className="section-kicker">How we guide the review</p>
            <strong>Analytical lens</strong>
          </div>
          <span className="advanced-summary-note">We can help you look at the same conversation through different analytic frames.</span>
        </summary>

        <div className="advanced-disclosure-body">
          <${SelectorGroup}
            title="Analytical lens"
            copy="Choose the analytic lens that best fits the conversation you want to review."
            options=${MODE_OPTIONS}
            value=${mode}
            disabled=${isProcessing}
            onChange=${onModeChange}
          />

          <p className="setup-note">You can change the analytic lens any time. The underlying analysis stays the same.</p>
        </div>
      </details>
    </section>
  `;
}

function LoadingState({ source }) {
  return html`
    <section className="panel loading-panel no-print" data-reveal>
      <div className="loading-mark" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <p className="section-kicker">Preparing report</p>
      <h2>Looking between the lines...</h2>
      <p className="section-copy">${source ? `Reading ${source.name}.` : "Preparing the sample report."}</p>
    </section>
  `;
}

function PaywallCard({ onUnlock, onBack, isStartingCheckout, checkoutError }) {
  return html`
    <section className="panel paywall no-print" data-reveal>
      <div className="label">REPORT READY</div>

      <h2 className="headline">Your analysis is complete.</h2>

      <p className="subhead">
        The full report reveals where patterns shift, where communication breaks, and what stands out beneath the surface.
      </p>

      <div className="divider" aria-hidden="true"></div>

      <div className="preview-points">
        <div>• Timeline with key gaps and spikes</div>
        <div>• Pattern shifts and behavioral changes</div>
        <div>• Highlighted moments worth reviewing</div>
      </div>

      <div className="price-block">
        <div className="price">$12</div>
        <div className="price-note">one-time report</div>
      </div>

      <div className="paywall-actions">
        <button
          type="button"
          className="primary-button"
          onClick=${onUnlock}
          disabled=${isStartingCheckout}
        >
          ${isStartingCheckout ? "Starting checkout..." : "Unlock full report — $12"}
        </button>

        <button type="button" className="secondary-button" onClick=${onBack} disabled=${isStartingCheckout}>
          Back
        </button>
      </div>

      ${checkoutError
        ? html`
            <div className="setup-status tone-error" aria-live="polite">
              <strong>Checkout could not be started.</strong>
              <p>${checkoutError}</p>
            </div>
          `
        : null}

      <p className="trust-line">Private. Your data is not sold. Optional anonymized research only.</p>

      <p className="paywall-legal-copy">
        Payments are processed by Stripe. Digital reports are generally non-refundable once generated, except where
        required by law.
      </p>
      <${LegalLinks} className="paywall-links" />
    </section>
  `;
}

function InspectAction({ label = "Inspect", onClick, className = "" }) {
  return html`
    <button type="button" className=${`inspect-action no-print ${className}`.trim()} onClick=${onClick}>
      <span className="inspect-icon" aria-hidden="true"></span>
      ${label}
    </button>
  `;
}

function StartHereCard({ card, index, onInspect }) {
  return html`
    <article className="jump-card">
      <div className="jump-card-topbar">
        <div className="jump-card-top">
          <span className="jump-card-index">${index + 1}</span>
          <span className="jump-card-label">${card.label}</span>
        </div>
        <${InspectAction}
          className="inspect-action-corner"
          label="Inspect"
          onClick=${() => onInspect(card.inspectTargetId, card.timelineDayKey)}
        />
      </div>
      <a href=${`#${card.targetId}`} className="jump-card-main">
        <strong>${card.value}</strong>
        <p>${card.summary}</p>
        <small>${card.note}</small>
      </a>
    </article>
  `;
}

function MomentCard({ moment, onInspect }) {
  return html`
    <article id=${moment.anchorId} className=${`moment-card severity-${moment.severity || "low"}`}>
      <div className="moment-topline">
        <span>${moment.label}</span>
        ${moment.strength ? html`<span className="strength-pill">${moment.strength}</span>` : null}
      </div>

      <h3>${moment.title}</h3>
      <p className="moment-window">${moment.windowLabel}</p>

      <dl className="moment-grid">
        <div>
          <dt>What happened</dt>
          <dd>${moment.whatHappened}</dd>
        </div>
        <div>
          <dt>Baseline context</dt>
          <dd>${moment.baselineContext}</dd>
        </div>
        <div>
          <dt>Why it stands out</dt>
          <dd>${moment.whyItStandsOut}</dd>
        </div>
      </dl>

      <div className="wonder-block">
        <p className="wonder-label">i wonder...</p>
        <ul>
          ${moment.prompts.map(
            (prompt) => html`
              <li key=${prompt}>${prompt}</li>
            `,
          )}
        </ul>
      </div>

      <${InspectAction}
        label="View in timeline"
        onClick=${() => onInspect(`timeline-${moment.dayKey}`, moment.dayKey)}
      />
    </article>
  `;
}

function FullTimeline({ chronology, rules, flagRanges, expanded, highlightedDayKey }) {
  return html`
    <div className=${`timeline-content ${expanded ? "is-open" : ""}`}>
      ${chronology.map(
        (group) => html`
          <section
            key=${group.dayKey}
            id=${`timeline-${group.dayKey}`}
            className=${`timeline-day ${highlightedDayKey === group.dayKey ? "is-highlighted" : ""}`}
          >
            <div className="timeline-day-header">
              <div>
                <p className="timeline-day-key">${group.dayKey}</p>
                <h3>${group.dateLabel}</h3>
              </div>
              <span>${formatNumber(group.totalMessages)} messages</span>
            </div>

            <div className="timeline-list">
              ${group.items.map((item, index) => {
                const severity = getMessageFlagSeverity(item, flagRanges, rules);
                return html`
                  <div key=${`${group.dayKey}-${index}-${item.timestamp}`} className="timeline-entry">
                    ${item.gapFromPreviousHours > rules.gapHours
                      ? html`<div className="gap-marker">— ${formatGapMarker(item.gapFromPreviousHours)} —</div>`
                      : null}

                    <article className=${`timeline-message ${severity ? `flag-${severity}` : ""}`}>
                      <div className="timeline-message-meta">
                        <strong>${item.sender}</strong>
                        <span>${item.timeLabel}</span>
                      </div>
                      <p>${item.text || "No message text provided."}</p>
                    </article>
                  </div>
                `;
              })}
            </div>
          </section>
        `,
      )}
    </div>
  `;
}

function ReportView({ presentation, timelineExpanded, highlightedTimelineDay, onInspect, onToggleTimeline, onPrint, onReset }) {
  return html`
    <section className="report-shell">
      <section id="report-top" className="panel report-masthead" data-reveal>
        <div className="report-topbar">
          <div>
            <p className="section-kicker">Report reveal</p>
            <h2>Between The Lines report</h2>
            <p className="report-lede">${presentation.reportLead}</p>
          </div>

          <div className="report-actions no-print">
            <button type="button" className="primary-button" onClick=${onPrint}>
              Print report
            </button>
            <button type="button" className="secondary-button" onClick=${onReset}>
              New upload
            </button>
          </div>
        </div>

        <div className="report-summary-grid">
          ${presentation.fileSummary.map(
            (item) => html`
              <article key=${item.label} className="report-summary-card">
                <div className="metric-label">${item.label}</div>
                <div className="metric-value">${item.value}</div>
              </article>
            `,
          )}
        </div>
      </section>

      <section id="key-findings" className="panel report-section" data-reveal>
        <${SectionHeader} kicker="Key findings" title="Key findings" copy="Start with these moments." />
        <div className="start-grid">
          ${presentation.startHereCards.map(
            (card, index) => html`
              <${StartHereCard} key=${card.label} card=${card} index=${index} onInspect=${onInspect} />
            `,
          )}
        </div>
      </section>

      <section id="key-moments" className="panel report-section" data-reveal>
        <${SectionHeader} kicker="Investigative detail" title="Inspect the moments" copy="Inspect the clearest changes." />
        <div className="moments-stack">
          ${presentation.keyMoments.map(
            (moment) => html`
              <${MomentCard} key=${moment.anchorId} moment=${moment} onInspect=${onInspect} />
            `,
          )}
        </div>
      </section>

      <section id="typical-pattern" className="panel report-section" data-reveal>
        <${SectionHeader} kicker="Typical pattern" title="Typical pattern" />
        <div className="pattern-grid">
          <article className="pattern-card">
            <span>avg messages/day</span>
            <strong>${presentation.typicalPattern.averageMessagesPerDay}</strong>
          </article>
          <article className="pattern-card">
            <span>typical gap duration</span>
            <strong>${presentation.typicalPattern.typicalGapDuration}</strong>
          </article>
          <article className="pattern-card">
            <span>peak activity hours</span>
            <strong>${presentation.typicalPattern.peakActivityHours}</strong>
          </article>
        </div>
      </section>

      <section id="insights" className="panel report-section" data-reveal>
        <${SectionHeader} kicker="Insights" title="Insights" />
        <p className="standout-paragraph">${presentation.standoutParagraph}</p>
        <div className="next-grid">
          ${presentation.nowWhat.map(
            (item) => html`
              <article key=${item.title} className="next-card">
                <h3>${item.title}</h3>
                <p>${item.text}</p>
              </article>
            `,
          )}
        </div>
      </section>

      <section id="full-timeline" className="panel report-section" data-reveal>
        <${SectionHeader}
          kicker="Timeline"
          title="Timeline"
          action=${html`
            <button
              type="button"
              className="secondary-button timeline-toggle no-print"
              aria-expanded=${timelineExpanded}
              onClick=${onToggleTimeline}
            >
              ${timelineExpanded ? "Hide full timeline" : "Show full timeline"}
            </button>
          `}
        />
        <div className="timeline-summary">
          <span>${presentation.timelineSummary}</span>
          <span>${timelineExpanded ? "Expanded" : "Collapsed by default"}</span>
        </div>

        <${FullTimeline}
          chronology=${presentation.report.chronology}
          rules=${presentation.rules}
          flagRanges=${presentation.flagRanges}
          expanded=${timelineExpanded}
          highlightedDayKey=${highlightedTimelineDay}
        />
      </section>

      <section id="methodology" className="panel report-section" data-reveal>
        <${SectionHeader} kicker="Methodology" title="Methodology" />
        <div className="method-grid">
          ${presentation.methodologyCards.map(
            (item) => html`
              <article key=${item.title} className="method-card">
                <h3>${item.title}</h3>
                <p>${item.text}</p>
              </article>
            `,
          )}
        </div>
      </section>

      <section id="interpretation-boundary" className="panel report-section" data-reveal>
        <${SectionHeader} kicker="Interpretation boundary" title="Interpretation boundary" />
        <div className="boundary-grid">
          ${presentation.interpretationCards.map(
            (item) => html`
              <article key=${item.title} className="boundary-card">
                <h3>${item.title}</h3>
                <p>${item.text}</p>
              </article>
            `,
          )}
        </div>
        <p className="boundary-footnote">${presentation.interpretationFootnote}</p>
      </section>
    </section>
  `;
}

function SiteFooter({ onFeedbackClick }) {
  return html`
    <footer className="site-footer no-print">
      <div className="footer-divider" aria-hidden="true"></div>
      <div className="site-footer-copy">
        <p className="footer-parent-brand">Operated by LRC Property LLC</p>
        <p className="footer-legal">Riverside County, California</p>
        <p className="footer-legal">
          Contact:
          <a className="footer-inline-link" href="mailto:lrcpropertyllc@outlook.com"> lrcpropertyllc@outlook.com</a>
        </p>
        <p className="footer-legal">© 2026 LRC Property LLC. All rights reserved.</p>
        <p className="footer-legal">Patent pending. For informational purposes only. Not professional advice.</p>
        <${LegalLinks} includeDisclaimer=${true} />
        <nav className="footer-links footer-links-secondary" aria-label="Feedback links">
          <a
            href="#"
            onClick=${(event) => {
              event.preventDefault();
              onFeedbackClick?.();
            }}
          >
            Send feedback
          </a>
        </nav>
      </div>
    </footer>
  `;
}

function App() {
  const [defaultRules, setDefaultRules] = useState(null);
  const [source, setSource] = useState(null);
  const [result, setResult] = useState(null);
  const [isReportUnlocked, setIsReportUnlocked] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [mode, setMode] = useState("general");
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasUploadRightsConsent, setHasUploadRightsConsent] = useState(false);
  const [hasResearchConsent, setHasResearchConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [highlightedTimelineDay, setHighlightedTimelineDay] = useState("");
  const [pendingInspectTarget, setPendingInspectTarget] = useState(null);

  const fileInputRef = useRef(null);
  const hasTrackedLandingView = useRef(false);
  const lastTrackedReportId = useRef("");

  useEffect(() => {
    if (hasTrackedLandingView.current) return;
    hasTrackedLandingView.current = true;
    trackEvent("landing_page_view");
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((data) => {
        setDefaultRules(data.rules);
        setStatus(DEFAULT_STATUS);
      })
      .catch(() => {
        setStatus({
          tone: "error",
          eyebrow: "App not ready",
          title: "The app could not load its default rules.",
          detail: "Refresh the page and try again.",
        });
      });
  }, []);

  useEffect(() => {
    if (!hasUploadRightsConsent && !consentError) return;
    if (hasUploadRightsConsent) {
      setConsentError("");
    }
  }, [hasUploadRightsConsent, consentError]);

  useEffect(() => {
    const snapshot = readReportSession();
    if (!snapshot?.result) {
      cleanupPaymentQuery();
      return;
    }

    if (snapshot.source) {
      setSource(snapshot.source);
    }

    if (typeof snapshot.mode === "string" && MODE_OPTIONS.some((option) => option.id === snapshot.mode)) {
      setMode(snapshot.mode);
    }

    setResult(snapshot.result);

    const isFreeReport = Boolean(snapshot.source?.isSample);
    if (isFreeReport || snapshot.isReportUnlocked) {
      setIsReportUnlocked(true);
    }

    const paidState = new URLSearchParams(window.location.search).get("paid");
    if (paidState === "cancelled" && !isFreeReport) {
      setCheckoutError("Checkout was cancelled. Your report is still ready when you want to unlock it.");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const params = new URLSearchParams(window.location.search);
    const paidState = params.get("paid");
    const sessionId = params.get("session_id");
    const snapshot = readReportSession();

    if (paidState !== "success" || !sessionId || !snapshot?.result || snapshot.source?.isSample) {
      if (paidState === "cancelled" || paidState === "success") {
        cleanupPaymentQuery();
      }
      return undefined;
    }

    let cancelled = false;
    const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

    setIsStartingCheckout(true);
    setCheckoutError("");

    (async () => {
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const response = await fetch(`/payment-status?session_id=${encodeURIComponent(sessionId)}`, {
            cache: "no-store",
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(data.error || "The checkout session could not be verified.");
          }

          if (data.paid) {
            if (cancelled) return;

            setIsReportUnlocked(true);
            setStatus({
              tone: "ready",
              eyebrow: "Payment complete",
              title: "Your full report is unlocked.",
              detail: "Start with the three cards near the top of the report.",
            });
            persistReportSession({
              ...snapshot,
              isReportUnlocked: true,
            });
            return;
          }

          if (attempt < 11) {
            await delay(1000);
          }
        }

        throw new Error("Payment confirmation is still processing. Refresh in a moment.");
      } catch (error) {
        if (cancelled) return;
        setCheckoutError(String(error?.message || error || "The checkout session could not be verified."));
      } finally {
        if (cancelled) return;
        setIsStartingCheckout(false);
        cleanupPaymentQuery();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = result
      ? `Between The Lines - ${result.report.metadata.sourceName}`
      : "Between The Lines";
  }, [result]);

  useEffect(() => {
    if (!result) {
      lastTrackedReportId.current = "";
      return;
    }

    if (!isReportUnlocked) return;

    const reportId = `${result.report.metadata.sourceName}:${result.report.metadata.receivedAt}`;
    if (lastTrackedReportId.current === reportId) return;

    lastTrackedReportId.current = reportId;
    trackEvent("report_viewed");
  }, [result, isReportUnlocked]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!elements.length) return undefined;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    elements.forEach((element) => {
      if (element.classList.contains("is-visible")) return;
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [result, timelineExpanded]);

  useEffect(() => {
    if (!isReportUnlocked) return undefined;
    if (!result) return undefined;

    const timeout = window.setTimeout(() => {
      document.querySelector("#report-top")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 160);

    return () => window.clearTimeout(timeout);
  }, [result, isReportUnlocked]);

  useEffect(() => {
    if (!pendingInspectTarget) return undefined;
    if (pendingInspectTarget.dayKey && !timelineExpanded) return undefined;

    const target = document.getElementById(pendingInspectTarget.targetId);
    if (!target) return undefined;

    if (pendingInspectTarget.dayKey) {
      setHighlightedTimelineDay(pendingInspectTarget.dayKey);
    }

    animateScrollToElement(target, 260);
    setPendingInspectTarget(null);

    if (!pendingInspectTarget.dayKey) return undefined;

    const timeout = window.setTimeout(() => {
      setHighlightedTimelineDay((current) => (current === pendingInspectTarget.dayKey ? "" : current));
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [pendingInspectTarget, timelineExpanded]);

  async function analyzeSource(nextSource) {
    if (!defaultRules) return false;

    if (nextSource.file && !nextSource.isSample) {
      trackEvent("upload_started");
    }

    setCheckoutError("");
    setSource(nextSource);
    setIsProcessing(true);
    setIsReportUnlocked(false);
    setTimelineExpanded(false);
    setHighlightedTimelineDay("");
    setStatus({
      tone: "processing",
      eyebrow: "Reading the timeline",
      title: "Looking between the lines...",
      detail: `Preparing the report for ${nextSource.name}.`,
    });

    try {
      let response;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (nextSource.file) {
        const body = new FormData();
        body.append("file", nextSource.file);
        body.append("rules", JSON.stringify(defaultRules));
        body.append("timezone", timezone);
        body.append("researchConsent", hasResearchConsent ? "true" : "false");
        body.append("uploadRightsConfirmed", nextSource.isSample ? "false" : "true");

        response = await fetch("/upload", {
          method: "POST",
          body,
        });
      } else {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: nextSource.name,
            content: nextSource.content,
            rules: defaultRules,
            timezone,
            researchConsent: hasResearchConsent,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      const safeSource = {
        name: nextSource.name,
        isSample: Boolean(nextSource.isSample),
      };

      if (nextSource.file && !nextSource.isSample) {
        trackEvent("upload_completed");
      }

      setSource(safeSource);
      setResult(data);
      setIsReportUnlocked(Boolean(nextSource.isSample));
      persistReportSession({
        result: data,
        source: safeSource,
        mode,
        isReportUnlocked: Boolean(nextSource.isSample),
      });
      setStatus({
        tone: "ready",
        eyebrow: "Report ready",
        title: "Your report is ready to read.",
        detail: "Start with the three cards near the top of the report.",
      });
      return true;
    } catch (error) {
      setStatus({
        tone: "error",
        eyebrow: "We hit a problem",
        title: "The report could not be generated.",
        detail: String(error?.message || error || "Please try another JSON or CSV conversation export."),
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!hasUploadRightsConsent) {
      setConsentError("Confirm that you have the right to upload this data before using your own file.");
      setStatus({
        tone: "error",
        eyebrow: "Consent required",
        title: "Confirm your upload rights before continuing.",
        detail: "Check the consent box above the upload button, then choose your file again.",
      });
      event.target.value = "";
      return;
    }

    try {
      setConsentError("");
      await analyzeSource({
        name: file.name,
        file,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        eyebrow: "We could not read that file",
        title: "The selected file could not be opened.",
        detail: "Choose a JSON or CSV conversation export and try again.",
      });
    } finally {
      event.target.value = "";
    }
  }

  async function handleUseSample() {
    if (!defaultRules) return;

    console.log("Sample button clicked");
    trackEvent("click_sample");

    try {
      const response = await fetch(SAMPLE_SOURCE.path);
      if (!response.ok) {
        throw new Error("The sample report could not be loaded.");
      }

      const data = await response.json();
      console.log(data);
      const normalized = normalizeSamplePayload(data);
      const normalizedContent = JSON.stringify(normalized);
      const sampleFile = new File([normalizedContent], SAMPLE_SOURCE.name, { type: "application/json" });

      console.log("Sample loaded");
      console.log("Sample analysis started");

      const success = await analyzeSource({
        name: SAMPLE_SOURCE.name,
        file: sampleFile,
        isSample: true,
      });

      if (!success) {
        const message = "The sample report could not be analyzed.";
        window.alert(message);
      }
    } catch (error) {
      const message = String(error?.message || error || "Please upload a file instead.");
      console.error("Sample loading failed", error);
      setStatus({
        tone: "error",
        eyebrow: "Sample unavailable",
        title: "The sample report could not be loaded.",
        detail: message,
      });
      window.alert(message);
    }
  }

  function handleOpenFile() {
    if (!hasUploadRightsConsent) {
      setConsentError("Confirm that you have the right to upload this data before using your own file.");
      setStatus({
        tone: "error",
        eyebrow: "Consent required",
        title: "Confirm your upload rights before continuing.",
        detail: "Sample reports stay free to preview. For your own file, confirm the checkbox first.",
      });
      return;
    }

    trackEvent("click_upload");
    fileInputRef.current?.click();
  }

  function handleFeedbackClick() {
    trackEvent("feedback_clicked");
  }

  function handleModeChange(nextMode) {
    setMode(nextMode);
  }

  function handleReset() {
    setResult(null);
    setSource(null);
    setIsReportUnlocked(false);
    setIsStartingCheckout(false);
    setCheckoutError("");
    setIsProcessing(false);
    setTimelineExpanded(false);
    setHighlightedTimelineDay("");
    setPendingInspectTarget(null);
    setStatus(DEFAULT_STATUS);
    clearReportSession();
  }

  function handlePrint() {
    window.print();
  }

  async function handleUnlockReport() {
    setCheckoutError("");
    setIsStartingCheckout(true);

    const snapshot = readReportSession();
    if (!snapshot?.result) {
      setIsStartingCheckout(false);
      setCheckoutError("Your report is not ready yet. Run the analysis again before starting checkout.");
      return;
    }

    persistReportSession({
      ...snapshot,
      mode,
      isReportUnlocked: false,
    });

    try {
      const response = await fetch("/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        throw new Error(data.error || "The checkout session could not be created.");
      }

      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(String(error?.message || error || "The checkout session could not be created."));
      setIsStartingCheckout(false);
    }
  }

  function handleInspect(targetId, dayKey = "") {
    setTimelineExpanded(true);
    setPendingInspectTarget({
      targetId,
      dayKey,
    });
  }

  const configReady = Boolean(defaultRules);
  const reportPresentation = result ? buildPresentation(result.report, result.rules, mode) : null;

  return html`
    <div className="app-shell">
      <input
        ref=${fileInputRef}
        className="visually-hidden-input"
        type="file"
        accept=".json,.csv,application/json,text/csv"
        onChange=${handleFileSelected}
      />

      <header className="site-header no-print">
        <div className="brand-lockup">
          <span className="brand-mark brand-inspect" aria-hidden="true">
            <span className="inspect-icon"></span>
          </span>
          <div>
            <p className="brand-name">Between The Lines</p>
            <p className="brand-tagline">When something feels off, see the pattern.</p>
          </div>
        </div>
      </header>

      <main className="page-stack">
        ${reportPresentation
          ? html`
              ${isReportUnlocked
                ? html`
                    <${ReportView}
                      presentation=${reportPresentation}
                      timelineExpanded=${timelineExpanded}
                      highlightedTimelineDay=${highlightedTimelineDay}
                      onInspect=${handleInspect}
                      onToggleTimeline=${() => setTimelineExpanded((current) => !current)}
                      onPrint=${handlePrint}
                      onReset=${handleReset}
                    />

                    <${SetupSection}
                      mode=${mode}
                      status=${status}
                      isProcessing=${isProcessing}
                      onModeChange=${handleModeChange}
                    />
                  `
                : html`
                    <${PaywallCard}
                      onUnlock=${handleUnlockReport}
                      onBack=${handleReset}
                      isStartingCheckout=${isStartingCheckout}
                      checkoutError=${checkoutError}
                    />
                  `}
            `
          : html`
              <${HeroSection}
                onOpenFile=${handleOpenFile}
                onUseSample=${handleUseSample}
                disabled=${!configReady || isProcessing}
                hasUploadRightsConsent=${hasUploadRightsConsent}
                hasResearchConsent=${hasResearchConsent}
                consentError=${consentError}
                onUploadRightsChange=${setHasUploadRightsConsent}
                onResearchConsentChange=${setHasResearchConsent}
              />

              <${StartGuidanceSection}
                onOpenFile=${handleOpenFile}
                onUseSample=${handleUseSample}
                disabled=${!configReady || isProcessing}
              />

              <${TestimonialsSection} />

              <${SetupSection}
                mode=${mode}
                status=${status}
                isProcessing=${isProcessing}
                onModeChange=${handleModeChange}
              />

              ${isProcessing && !result ? html`<${LoadingState} source=${source} />` : null}
            `}
      </main>

      <${SiteFooter} onFeedbackClick=${handleFeedbackClick} />
    </div>
  `;
}

createRoot(document.querySelector("#root")).render(html`<${App} />`);
