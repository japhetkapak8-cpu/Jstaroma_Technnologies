import { PLATFORM_METRICS, presetRange, validateRange, groupSeries, csvRows } from "../../supabase/functions/shared/wantok-platform.js";
import { initializeMap, renderProvinceMap } from "./wantok-maps.js";

const GROUPS = {
  summaryMetrics: ["online_users", "new_registrations", "monthly_growth", "total_audio_calls", "total_video_calls", "crash_free_sessions"],
  growthMetrics: ["returning_users", "inactive_users"],
  engagementMetrics: ["period_messages", "period_calls", "text_messages", "voice_notes", "shared_photos", "audio_calls", "video_calls", "missed_calls", "completed_calls", "average_call_duration"],
  performanceMetrics: ["crash_free_sessions", "startup_time", "network_errors", "installations"],
  financeMetrics: ["database_usage", "media_storage", "livekit_minutes", "livekit_bandwidth", "hosting_cost", "revenue", "expenses", "profit"],
  safetyMetrics: ["account_reports", "blocks", "moderation_actions", "safety_incidents"]
};
const BASE_LABELS = {
  registered_users: "Registered accounts (current)",
  mau: "MAU", dau: "DAU", messages: "Visible message records (current)",
  calls: "All call records (current)", groups: "Group records (current)"
};
const METRIC_ICONS = {
  online_users: "fa-circle-dot",
  new_registrations: "fa-user-plus",
  monthly_growth: "fa-chart-line",
  total_audio_calls: "fa-phone",
  total_video_calls: "fa-video",
  crash_free_sessions: "fa-shield-heart",
  returning_users: "fa-arrow-rotate-left",
  inactive_users: "fa-user-clock",
  period_messages: "fa-comments",
  period_calls: "fa-phone-volume",
  text_messages: "fa-message",
  voice_notes: "fa-microphone",
  shared_photos: "fa-images",
  audio_calls: "fa-phone",
  video_calls: "fa-video",
  missed_calls: "fa-phone-slash",
  completed_calls: "fa-phone",
  average_call_duration: "fa-stopwatch",
  startup_time: "fa-rocket",
  network_errors: "fa-wifi",
  installations: "fa-download",
  database_usage: "fa-database",
  media_storage: "fa-hard-drive",
  livekit_minutes: "fa-clock",
  livekit_bandwidth: "fa-gauge-high",
  hosting_cost: "fa-server",
  revenue: "fa-arrow-trend-up",
  expenses: "fa-receipt",
  profit: "fa-scale-balanced",
  account_reports: "fa-flag",
  blocks: "fa-ban",
  moderation_actions: "fa-shield-halved",
  safety_incidents: "fa-triangle-exclamation"
};
let range = null;
let lastSnapshot = null;
let drawChart;
let initialized = false;

export function getDateRange() { return range; }

function sourceTable(snapshot) {
  const table = document.createElement("table");
  table.className = "analytics-table";
  const caption = document.createElement("caption");
  caption.textContent = "Aggregate metrics, source definitions and connection status";
  table.append(caption);
  const header = document.createElement("thead");
  const row = document.createElement("tr");
  for (const text of ["Metric", "Source", "Status"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = text;
    row.append(cell);
  }
  header.append(row);
  table.append(header);
  const body = document.createElement("tbody");
  for (const [key, label, source] of PLATFORM_METRICS) {
    const entry = document.createElement("tr");
    const available = snapshot?.platform?.metrics[key] != null;
    for (const text of [label, source, available ? "Verified aggregate loaded" : "Not connected"]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      entry.append(cell);
    }
    body.append(entry);
  }
  table.append(body);
  document.getElementById("sourceRegistry").replaceChildren(table);
}

function registrationChart() {
  const series = lastSnapshot?.platform?.series.registrations;
  const interval = document.getElementById("registrationInterval").value;
  drawChart("registrationChart", series ? groupSeries(series, interval) : null, "count", `${interval} registrations (surviving accounts)`);
}

export function exportSnapshot(snapshot) {
  if (!snapshot?.generated_at) throw new Error("No verified snapshot to export.");
  const rows = [["Metric", "Value", "Unit", "Scope", "Snapshot UTC"]];
  for (const [key, label] of Object.entries(BASE_LABELS)) {
    rows.push([label, snapshot.metrics[key], "count", "Current records; MAU/DAU disconnected", snapshot.generated_at]);
  }
  for (const [key, label, source, unit] of PLATFORM_METRICS) {
    rows.push([label, snapshot.platform?.metrics[key] ?? null, unit, source, snapshot.generated_at]);
  }
  rows.push(["Selected UTC start", snapshot.period.start], ["Selected UTC end", snapshot.period.end]);
  for (const [key, series] of Object.entries(snapshot.platform?.series || {})) {
    for (const point of series || []) rows.push([key, point.count, "count", point.date, snapshot.generated_at]);
  }
  return csvRows(rows);
}

export function renderPlatform(snapshot) {
  if (!initialized) return;
  lastSnapshot = snapshot;
  const provinces = snapshot.platform?.geography?.provinces ?? null;
  renderProvinceMap(provinces);
  const available = provinces?.status === "available";
  const number = new Intl.NumberFormat();
  const unknown = available ? provinces.rows.find(row => row.name === "Unknown / Not Set").count : null;
  document.getElementById("provinceTotal").textContent = available ? number.format(provinces.total) : "Not connected";
  document.getElementById("provinceKnown").textContent = available ? number.format(provinces.total - unknown) : "Not connected";
  document.getElementById("provinceMissing").textContent = available
    ? provinces.total ? new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(unknown / provinces.total) : "—"
    : "Not connected";
  document.getElementById("provinceStatus").textContent = available
    ? provinces.total ? "Current profile counts loaded." : "No profiles found."
    : provinces?.status === "error" ? "Province data unavailable. Check the Wantok province RPC deployment and refresh." : "Province analytics: Not connected.";
  const chart = document.getElementById("provinceChart");
  chart.replaceChildren();
  if (available) {
    const list = document.createElement("ul");
    const maximum = Math.max(...provinces.rows.map(row => row.count), 1);
    for (const row of provinces.rows) {
      const item = document.createElement("li");
      item.title = `Profiles by province\n${row.name}: ${number.format(row.count)}`;
      const name = document.createElement("span");
      name.textContent = row.name;
      const track = document.createElement("span");
      track.className = "province-chart-track";
      track.setAttribute("aria-hidden", "true");
      const bar = document.createElement("span");
      bar.style.width = `${row.count / maximum * 100}%`;
      track.append(bar);
      const count = document.createElement("strong");
      count.textContent = number.format(row.count);
      item.append(name, track, count);
      list.append(item);
    }
    chart.append(list);
  } else chart.textContent = provinces?.status === "error" ? "Province data unavailable." : "Not connected";
  for (const [container, keys] of Object.entries(GROUPS)) {
    for (const key of keys) {
      const value = snapshot.platform?.metrics[key] ?? null;
      const element = document.getElementById(`${container}-${key}`);
      element.textContent = value === null ? "Not connected" : new Intl.NumberFormat().format(value);
      element.classList.toggle("metric-unavailable", value === null);
    }
  }
  registrationChart();
  for (const [key, id] of [["messages", "messageTrend"], ["calls", "callTrend"]]) {
    drawChart(id, snapshot.platform?.series[key] ?? null, "count", `Daily ${key} records`);
  }
  for (const [key, id] of [["registrations", "registrationEmpty"], ["messages", "messagesEmpty"], ["calls", "callsEmpty"]]) {
    const series = snapshot.platform?.series[key];
    document.getElementById(id).textContent = series?.every(point => point.count === 0)
      ? "No records in the selected UTC period (verified zero)." : "";
  }
  sourceTable(snapshot);
  const ready = Boolean(snapshot.generated_at);
  document.getElementById("exportAnalytics").disabled = !ready;
  document.getElementById("investorSummary").textContent = ready
    ? `${snapshot.metrics.registered_users === null ? "Not connected:" : new Intl.NumberFormat().format(snapshot.metrics.registered_users)} currently stored accounts. Snapshot ${snapshot.generated_at}. Selected UTC period ${snapshot.period.start} to ${snapshot.period.end}. App-active users, revenue, profitability and performance are Not connected; no estimates are substituted.`
    : "Not connected. No investment conclusions can be drawn from unavailable metrics.";
}

export async function initializePlatform({ reload, renderChart }) {
  drawChart = renderChart;
  initialized = true;
  for (const [container, keys] of Object.entries(GROUPS)) {
    const parent = document.getElementById(container);
    for (const key of keys) {
      const [, label, source] = PLATFORM_METRICS.find(metric => metric[0] === key);
      const card = document.createElement("article");
      card.className = "dashboard-stat platform-stat";
      const icon = document.createElement("span");
      icon.className = "stat-icon blue analytics-stat-icon";
      icon.setAttribute("aria-hidden", "true");
      const glyph = document.createElement("i");
      glyph.className = `fa-solid ${METRIC_ICONS[key] || "fa-chart-simple"}`;
      icon.append(glyph);
      const body = document.createElement("div");
      const title = document.createElement("span");
      title.textContent = label;
      const value = document.createElement("strong");
      value.id = `${container}-${key}`;
      value.textContent = "Not connected";
      const detail = document.createElement("small");
      detail.textContent = source;
      detail.title = source;
      body.append(title, value, detail);
      card.append(icon, body);
      parent.append(card);
    }
  }
  const preset = document.getElementById("datePreset");
  const start = document.getElementById("dateStart");
  const end = document.getElementById("dateEnd");
  range = presetRange(30);
  const syncDates = () => { start.value = range.start; end.value = range.end; };
  syncDates();
  start.max = end.max = presetRange(7).end;
  preset.addEventListener("change", () => {
    if (preset.value !== "custom") {
      const dates = presetRange(Number(preset.value));
      start.value = dates.start;
      end.value = dates.end;
    }
  });
  for (const input of [start, end]) input.addEventListener("change", () => { preset.value = "custom"; });
  document.getElementById("applyDateRange").disabled = false;
  document.getElementById("analyticsFilters").addEventListener("submit", async event => {
    event.preventDefault();
    const status = document.getElementById("filterStatus");
    try {
      const requested = validateRange({ start: start.value, end: end.value });
      range = requested;
      status.classList.remove("analytics-error");
      status.textContent = "Totals are current records; filters affect period registrations, messages and calls only.";
      document.getElementById("applyDateRange").disabled = true;
      await reload();
    }
    catch (error) {
      console.error("Could not apply analytics filter:", error);
      status.classList.add("analytics-error");
      status.textContent = error.message;
    }
    finally { document.getElementById("applyDateRange").disabled = false; }
  });
  document.getElementById("registrationInterval").addEventListener("change", registrationChart);
  document.getElementById("investorView").addEventListener("change", event => {
    document.getElementById("analyticsMain").classList.toggle("investor-mode", event.target.checked);
  });
  document.getElementById("exportAnalytics").addEventListener("click", () => {
    try {
      const blob = new Blob([exportSnapshot(lastSnapshot)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "wantok-aggregate-analytics.csv";
      link.click();
      URL.revokeObjectURL(url);
    }
    catch (error) {
      console.error("Analytics export failed:", error);
      document.getElementById("filterStatus").textContent = "Could not export aggregates. Load a verified snapshot first.";
    }
  });
  sourceTable(null);
  await Promise.all(["world", "png"].map(kind => initializeMap(document.getElementById(`${kind}Map`), kind)));
}
