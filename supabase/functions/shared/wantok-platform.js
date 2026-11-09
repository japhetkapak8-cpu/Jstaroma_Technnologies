export const PLATFORM_METRICS = Object.freeze([
  ["online_users", "Currently online users", "Verified presence service", "count"],
  ["new_registrations", "New registrations", "Wantok auth.users.created_at (surviving accounts)", "count"],
  ["monthly_growth", "Monthly user growth rate", "Verified historical account snapshots", "percent"],
  ["text_messages", "Text messages", "Wantok messages.message_type = text", "count"],
  ["voice_notes", "Voice notes", "Wantok messages.message_type = audio", "count"],
  ["shared_photos", "Shared photos", "Wantok messages.message_type = image", "count"],
  ["period_messages", "Messages in selected period", "Wantok visible messages.created_at", "count"],
  ["period_calls", "Call records in selected period", "Wantok calls.created_at", "count"],
  ["audio_calls", "Audio call records", "Wantok calls.call_type = audio", "count"],
  ["video_calls", "Video call records", "Wantok calls.call_type = video", "count"],
  ["total_audio_calls", "Total audio call records", "Wantok calls.call_type = audio (current records)", "count"],
  ["total_video_calls", "Total video call records", "Wantok calls.call_type = video (current records)", "count"],
  ["missed_calls", "Missed call records", "Wantok calls.status = missed", "count"],
  ["completed_calls", "Completed calls", "Verified app completion semantics", "count"],
  ["average_call_duration", "Average call duration", "Verified completed-call timestamps", "seconds"],
  ["returning_users", "Returning users", "Verified app activity tracking", "count"],
  ["inactive_users", "Inactive users", "Verified app activity tracking", "count"],
  ["crash_free_sessions", "Crash-free sessions", "Firebase Crashlytics aggregate export", "percent"],
  ["startup_time", "Startup performance", "Firebase Performance Monitoring aggregate export", "milliseconds"],
  ["network_errors", "Network errors", "Firebase Performance Monitoring aggregate export", "count"],
  ["installations", "Installations", "Google Play Console aggregate export", "count"],
  ["database_usage", "Database usage", "Supabase management usage export", "bytes"],
  ["media_storage", "Media storage", "Supabase storage usage export", "bytes"],
  ["livekit_minutes", "LiveKit usage", "LiveKit billing usage export", "minutes"],
  ["livekit_bandwidth", "LiveKit bandwidth", "LiveKit billing usage export", "bytes"],
  ["hosting_cost", "Monthly hosting costs", "Reconciled billing ledger with currency", "currency"],
  ["revenue", "Revenue", "Reconciled financial ledger with currency", "currency"],
  ["expenses", "Expenses", "Reconciled financial ledger with currency", "currency"],
  ["profit", "Profitability", "Reconciled revenue minus expenses", "currency"],
  ["account_reports", "Account reports", "Verified moderation report aggregates", "count"],
  ["blocks", "Blocking events", "Verified block-event aggregates", "count"],
  ["moderation_actions", "Moderation activity", "Verified moderation action aggregates", "count"],
  ["safety_incidents", "Outstanding safety incidents", "Verified incident workflow aggregates", "count"]
]);

export const CONNECTED_PLATFORM_KEYS = Object.freeze([
  "new_registrations", "text_messages", "voice_notes", "shared_photos",
  "audio_calls", "video_calls", "total_audio_calls", "total_video_calls", "period_messages", "period_calls"
]);

export const PNG_PROVINCES = Object.freeze([
  "Autonomous Region of Bougainville", "Central Province", "Chimbu (Simbu) Province",
  "East New Britain Province", "East Sepik Province", "Eastern Highlands Province",
  "Enga Province", "Gulf Province", "Hela Province", "Jiwaka Province", "Madang Province",
  "Manus Province", "Milne Bay Province", "Morobe Province", "National Capital District",
  "New Ireland Province", "Northern (Oro) Province", "Southern Highlands Province",
  "West New Britain Province", "West Sepik (Sandaun) Province", "Western Highlands Province",
  "Western Province", "Unknown / Not Set"
]);

export function validateProvinceAggregate(input) {
  if (!input || !Array.isArray(input.rows) || input.rows.length !== PNG_PROVINCES.length) {
    throw new Error("Invalid province aggregate.");
  }
  const found = new Map();
  for (const row of input.rows) {
    if (!row || !PNG_PROVINCES.includes(row.name) || found.has(row.name) ||
        !Number.isSafeInteger(row.count) || row.count < 0) {
      throw new Error("Invalid province bucket.");
    }
    found.set(row.name, row.count);
  }
  const rows = PNG_PROVINCES.map(name => ({ name, count: found.get(name) }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!Number.isSafeInteger(total)) throw new Error("Invalid province total.");
  return { rows, total };
}

export function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateRange(value, now = new Date()) {
  if (!value || !validDate(value.start) || !validDate(value.end)) {
    throw new Error("Choose valid UTC start and end dates.");
  }
  const days = (Date.parse(value.end) - Date.parse(value.start)) / 86400000 + 1;
  if (days < 1 || days > 366 || value.end >= now.toISOString().slice(0, 10)) {
    throw new Error("Choose 1-366 complete UTC days ending before today.");
  }
  return { start: value.start, end: value.end };
}

export function presetRange(days, now = new Date()) {
  if (![7, 30, 90].includes(days)) throw new Error("Unsupported date preset.");
  const today = Date.parse(now.toISOString().slice(0, 10));
  return {
    start: new Date(today - days * 86400000).toISOString().slice(0, 10),
    end: new Date(today - 86400000).toISOString().slice(0, 10)
  };
}

export function groupSeries(series, granularity) {
  if (!["daily", "weekly", "monthly"].includes(granularity)) throw new Error("Invalid chart interval.");
  const grouped = new Map();
  for (const point of series) {
    let label = point.date;
    if (granularity === "monthly") label = label.slice(0, 7);
    if (granularity === "weekly") {
      const day = new Date(point.date);
      day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
      label = day.toISOString().slice(0, 10);
    }
    grouped.set(label, (grouped.get(label) || 0) + point.count);
  }
  return Array.from(grouped, ([date, count]) => ({ date, count }));
}

export function csvRows(rows) {
  return rows.map(row => row.map(value => {
    let text = String(value ?? "Not connected");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}

// Geography is a fixed snapshot, never arbitrarily filtered. If a bucket is
// small, withhold the entire distribution to prevent subtraction disclosures.
export function protectGeography(rows) {
  if (!Array.isArray(rows) || rows.length > 300) throw new Error("Invalid geographic aggregates.");
  const seen = new Set();
  const safe = rows.map(row => {
    if (!row || typeof row.code !== "string" || !/^[A-Z0-9_-]{2,40}$/.test(row.code) ||
        seen.has(row.code) || !Number.isSafeInteger(row.count) || row.count < 0) {
      throw new Error("Invalid geographic bucket.");
    }
    seen.add(row.code);
    return { code: row.code, count: row.count };
  });
  if (!seen.has("UNKNOWN")) throw new Error("Unknown geographic bucket is required.");
  if (safe.some(row => row.count > 0 && row.count < 10)) {
    return { status: "suppressed", rows: null, total: null };
  }
  const total = safe.reduce((sum, row) => sum + row.count, 0);
  if (!Number.isSafeInteger(total)) throw new Error("Invalid geographic total.");
  return { status: "available", rows: safe, total };
}
