import { PLATFORM_METRICS, CONNECTED_PLATFORM_KEYS, validateRange } from "./wantok-platform.js";

export const METRIC_KEYS = Object.freeze([
  "registered_users", "mau", "dau", "messages", "calls", "groups"
]);

export function disconnectedSnapshot() {
  return {
    version: 1,
    generated_at: null,
    period: null,
    metrics: Object.fromEntries(METRIC_KEYS.map(key => [key, null])),
    growth: null,
    retention: null
  };
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function date(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
}

function invalid() {
  throw new Error("Invalid Wantok Chat aggregate snapshot.");
}

// Whitelist aggregates so unexpected upstream fields (including personal data)
// cannot be forwarded to the browser.
export function validateSnapshot(input) {
  if (!record(input) || ![1, 2, 3].includes(input.version) || !record(input.metrics)) invalid();
  if (input.version >= 2 && input.metric_scope !== "current_records") invalid();
  const metrics = {};
  for (const key of METRIC_KEYS) {
    if (input.metrics[key] !== null && !count(input.metrics[key])) invalid();
    metrics[key] = input.metrics[key];
  }
  if (input.version >= 2 &&
      (metrics.mau !== null || metrics.dau !== null ||
       input.growth !== null || input.retention !== null)) invalid();
  if (input.generated_at === null && input.period === null) {
    if (METRIC_KEYS.some(key => metrics[key] !== null) ||
        input.growth !== null || input.retention !== null) invalid();
    return disconnectedSnapshot();
  }
  if (typeof input.generated_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/.test(input.generated_at) ||
      !date(input.generated_at.slice(0, 10)) ||
      !Number.isFinite(Date.parse(input.generated_at)) ||
      !record(input.period) || !date(input.period.start) || !date(input.period.end) ||
      (input.version < 3 && (
        Date.parse(input.period.end) - Date.parse(input.period.start) !== 29 * 86400000 ||
        input.generated_at.slice(0, 10) !== new Date(Date.parse(input.period.end) + 86400000)
          .toISOString().slice(0, 10)))) invalid();
  let platform;
  if (input.version === 3) {
    validateRange(input.period, new Date(input.generated_at));
    if (!record(input.platform) || !record(input.platform.metrics) ||
        !record(input.platform.series) || !record(input.platform.geography) ||
        input.platform.geography.countries !== null || input.platform.geography.provinces !== null ||
        input.platform.devices !== null) invalid();
    const platformMetrics = {};
    for (const [key] of PLATFORM_METRICS) {
      const value = input.platform.metrics[key];
      if (CONNECTED_PLATFORM_KEYS.includes(key) ? value !== null && !count(value) : value !== null) invalid();
      platformMetrics[key] = value;
    }
    for (const [keys, total] of [
      [["new_registrations"], metrics.registered_users],
      [["period_messages"], metrics.messages],
      [["period_calls"], metrics.calls],
      [["text_messages", "voice_notes", "shared_photos"], platformMetrics.period_messages],
      [["audio_calls", "video_calls"], platformMetrics.period_calls],
      [["total_audio_calls", "total_video_calls"], metrics.calls]
    ]) {
      if (total !== null && keys.every(key => platformMetrics[key] !== null) &&
          keys.reduce((sum, key) => sum + platformMetrics[key], 0) > total) invalid();
    }
    const series = {};
    const length = (Date.parse(input.period.end) - Date.parse(input.period.start)) / 86400000 + 1;
    for (const key of ["registrations", "messages", "calls"]) {
      const points = input.platform.series[key];
      if (points === null) { series[key] = null; continue; }
      if (!Array.isArray(points) || points.length !== length) invalid();
      series[key] = points.map((point, index) => {
        const expected = new Date(Date.parse(input.period.start) + index * 86400000).toISOString().slice(0, 10);
        if (!record(point) || point.date !== expected || !count(point.count)) invalid();
        return { date: point.date, count: point.count };
      });
      const metric = { registrations: "new_registrations", messages: "period_messages", calls: "period_calls" }[key];
      if (series[key].reduce((sum, point) => sum + point.count, 0) !== platformMetrics[metric]) invalid();
    }
    platform = { metrics: platformMetrics, series, geography: { countries: null, provinces: null }, devices: null };
  }

  let growth = null;
  if (input.growth !== null) {
    if (!Array.isArray(input.growth) || input.growth.length !== 30) invalid();
    growth = input.growth.map((point, index) => {
      const expected = new Date(Date.parse(input.period.start) + index * 86400000)
        .toISOString().slice(0, 10);
      if (!record(point) || point.date !== expected ||
          !count(point.registered_users) || !count(point.dau)) invalid();
      return { date: point.date, registered_users: point.registered_users, dau: point.dau };
    });
  }
  let retention = null;
  if (input.retention !== null) {
    if (!Array.isArray(input.retention) || input.retention.length !== 3) invalid();
    retention = input.retention.map((row, index) => {
      if (!record(row) || row.day !== [1, 7, 30][index] ||
          !count(row.eligible_users) || !count(row.returning_users) ||
          row.returning_users > row.eligible_users) invalid();
      return {
        day: row.day,
        eligible_users: row.eligible_users,
        returning_users: row.returning_users
      };
    });
  }
  return {
    version: input.version,
    ...(input.version >= 2 ? { metric_scope: "current_records" } : {}),
    ...(platform ? { platform } : {}),
    generated_at: input.generated_at,
    period: { start: input.period.start, end: input.period.end },
    metrics,
    growth,
    retention
  };
}
