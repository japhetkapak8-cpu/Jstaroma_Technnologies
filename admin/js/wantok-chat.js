import { supabase } from "../../js/supabase.js";
import { requireAdmin, logoutAdmin } from "./admin-auth.js";
import { initializePlatform, renderPlatform, getDateRange } from "./wantok-platform-ui.js";
import {
  METRIC_KEYS, disconnectedSnapshot, validateSnapshot
} from "../../supabase/functions/shared/wantok-chat-contract.js";

const refreshButton = document.getElementById("refreshAnalytics");
const statusElement = document.getElementById("analyticsStatus");
const numberFormat = new Intl.NumberFormat();
const percentFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

function svgElement(name, attributes, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderChart(id, growth, key, label) {
  const container = document.getElementById(id);
  container.replaceChildren();
  if (growth === null) {
    container.textContent = "Not connected";
    return;
  }
  const values = growth.map(point => point[key]);
  const maximum = Math.max(...values, 1);
  const svg = svgElement("svg", { viewBox: "0 0 460 230", role: "img", "aria-label": label });
  svg.append(svgElement("title", {}, label));
  const points = growth.map((point, index) => ({
    x: 55 + index * 380 / Math.max(growth.length - 1, 1),
    y: 180 - point[key] / maximum * 145,
    point
  }));
  svg.append(svgElement("polyline", {
    points: points.map(point => `${point.x},${point.y}`).join(" "),
    pathLength: 1
  }));
  for (const { x, y, point } of points) {
    const dot = svgElement("circle", { cx: x, cy: y, r: 3 });
    dot.append(svgElement("title", {}, `${point.date}: ${numberFormat.format(point[key])}`));
    svg.append(dot);
  }
  svg.append(
    svgElement("text", { x: 5, y: 35 }, numberFormat.format(maximum)),
    svgElement("text", { x: 5, y: 184 }, "0"),
    svgElement("text", { x: 55, y: 212 }, growth[0].date),
    svgElement("text", { x: 435, y: 212, "text-anchor": "end" }, growth[growth.length - 1].date)
  );
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "View daily chart values";
  const table = document.createElement("table");
  table.className = "analytics-table";
  const caption = document.createElement("caption");
  caption.textContent = label;
  table.append(caption);
  const head = document.createElement("thead");
  const header = document.createElement("tr");
  for (const text of ["UTC date", "Count"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = text;
    header.append(cell);
  }
  head.append(header);
  table.append(head);
  const body = document.createElement("tbody");
  for (const point of growth) {
    const row = document.createElement("tr");
    for (const text of [point.date, numberFormat.format(point[key])]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  details.append(summary, table);
  container.append(svg, details);
}

function renderSnapshot(snapshot) {
  renderPlatform(snapshot);
  for (const key of METRIC_KEYS) {
    document.getElementById(key).textContent = snapshot.metrics[key] === null
      ? "Not connected" : numberFormat.format(snapshot.metrics[key]);
  }
  const hasData = METRIC_KEYS.some(key => snapshot.metrics[key] !== null) ||
    snapshot.growth !== null || snapshot.retention !== null;
  const hero = document.getElementById("analyticsHero");
  hero.classList.remove("source-loading", "source-connected", "source-unavailable");
  hero.classList.add(hasData ? "source-connected" : "source-unavailable");
  document.getElementById("connectionLabel").textContent = hasData
    ? "Verified aggregate source" : "Not connected";
  document.getElementById("analyticsUpdated").textContent = snapshot.generated_at
    ? `Snapshot generated: ${new Date(snapshot.generated_at).toLocaleString()}`
    : "No verified snapshot loaded.";
  const currentRecords = snapshot.version >= 2 || snapshot.generated_at === null;
  document.getElementById("messagesDescription").textContent = currentRecords
    ? "Stored messages excluding call-type and deleted-for-everyone records"
    : "Messages sent in the period";
  document.getElementById("callsDescription").textContent = currentRecords
    ? "All stored call records, across all statuses; not completed calls"
    : "Completed calls in the period";
  document.getElementById("analyticsPeriod").textContent = snapshot.period
    ? snapshot.version === 3
      ? `Selected UTC window: ${snapshot.period.start} to ${snapshot.period.end} (inclusive). Base overview totals are current records; registration, message and call breakdowns use the selected period.`
      : currentRecords
      ? `Reference UTC window: ${snapshot.period.start} to ${snapshot.period.end} (inclusive). Counts are current totals, not window-limited activity.`
      : `UTC period: ${snapshot.period.start} to ${snapshot.period.end} (inclusive). DAU: ${snapshot.period.end}.`
    : "Counts will be current stored-record totals. MAU, DAU and retention require verified app activity tracking.";
  document.getElementById("activityTrackingStatus").textContent = currentRecords
    ? "MAU, DAU, activity trends and retention are Not connected. Chat-message activity is not app activity. Historical account totals are not reconstructed from surviving accounts."
    : "Activity and historical charts are displayed only when their data source is verified.";
  renderChart("registeredGrowth", snapshot.growth, "registered_users", "Daily registered user totals");
  renderChart("activeGrowth", snapshot.growth, "dau", "Daily active users");
  document.getElementById("retentionStatus").textContent = snapshot.retention === null
    ? "Not connected" : "Verified eligible and returning user counts.";
  const rows = document.getElementById("retentionRows");
  rows.replaceChildren();
  for (const day of [1, 7, 30]) {
    const data = snapshot.retention?.find(row => row.day === day);
    const row = document.createElement("tr");
    const cells = data
      ? [numberFormat.format(data.eligible_users), numberFormat.format(data.returning_users),
        data.eligible_users === 0 ? "No eligible users" :
          percentFormat.format(data.returning_users / data.eligible_users)]
      : ["Not connected", "Not connected", "Not connected"];
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = `Day ${day}`;
    row.append(heading);
    for (const text of cells) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    }
    rows.append(row);
  }
}

async function loadAnalytics() {
  const hero = document.getElementById("analyticsHero");
  refreshButton.disabled = true;
  document.getElementById("applyDateRange").disabled = true;
  statusElement.classList.remove("analytics-error");
  statusElement.textContent = "Loading aggregated statistics...";
  // Clear the previous snapshot on refresh so failures never look like live data.
  renderSnapshot(disconnectedSnapshot());
  hero.classList.add("source-loading");
  hero.classList.remove("source-connected", "source-unavailable");
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error("Admin session unavailable. Please sign in again.");
    const { data, error } = await supabase.functions.invoke("wantok-chat-analytics", {
      body: getDateRange() ? { date_range: getDateRange() } : {},
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
    });
    if (error) throw error;
    const snapshot = validateSnapshot(data);
    renderSnapshot(snapshot);
    statusElement.textContent = snapshot.generated_at
      ? "Aggregate snapshot loaded. Any unverified metric remains Not connected."
      : "Not connected. The Wantok Chat aggregate source has not been verified and enabled.";
  }
  catch (error) {
    console.error("Could not load Wantok Chat analytics:", error);
    renderSnapshot(disconnectedSnapshot());
    statusElement.classList.add("analytics-error");
    statusElement.textContent = "Could not load analytics. Check your admin session and backend deployment, then refresh. No figures are displayed.";
  }
  finally {
    refreshButton.disabled = false;
    document.getElementById("applyDateRange").disabled = false;
  }
}

document.getElementById("logoutBtn").addEventListener("click", logoutAdmin);
refreshButton.addEventListener("click", loadAnalytics);

async function initialize() {
  const user = await requireAdmin();
  if (!user) return;
  await Promise.all([
    initializePlatform({ reload: loadAnalytics, renderChart }),
    loadAnalytics()
  ]);
}

initialize();
