const defaultRules = {
  gapHours: 18,
  spikeWindowHours: 3,
  spikeMinMessages: 6,
  spikeMultiplier: 2.25,
  lateNightStartHour: 23,
  lateNightEndHour: 5,
  lateNightMinMessages: 4,
  sequenceMinRun: 4,
  sequenceRunMultiplier: 2,
};

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergeRules(overrides = {}) {
  return {
    gapHours: toNumber(overrides.gapHours, defaultRules.gapHours),
    spikeWindowHours: toNumber(overrides.spikeWindowHours, defaultRules.spikeWindowHours),
    spikeMinMessages: toNumber(overrides.spikeMinMessages, defaultRules.spikeMinMessages),
    spikeMultiplier: toNumber(overrides.spikeMultiplier, defaultRules.spikeMultiplier),
    lateNightStartHour: toNumber(overrides.lateNightStartHour, defaultRules.lateNightStartHour),
    lateNightEndHour: toNumber(overrides.lateNightEndHour, defaultRules.lateNightEndHour),
    lateNightMinMessages: toNumber(overrides.lateNightMinMessages, defaultRules.lateNightMinMessages),
    sequenceMinRun: toNumber(overrides.sequenceMinRun, defaultRules.sequenceMinRun),
    sequenceRunMultiplier: toNumber(overrides.sequenceRunMultiplier, defaultRules.sequenceRunMultiplier),
  };
}

module.exports = {
  defaultRules,
  mergeRules,
};
