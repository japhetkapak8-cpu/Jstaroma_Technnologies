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
const growthChartType = document.getElementById("growthChartType");
const growthChartIds = new Set(["registrationChart", "registeredGrowth", "activeGrowth", "retentionChart"]);
let lastSnapshot = null;
let requestInProgress = false;
let refreshTimer = null;
let adminAuthorized = false;
let dashboardOpen = true;

function svgElement(name, attributes, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function pieChart(values, labels, label) {
  const chart = document.createElement("div");
  const svg = svgElement("svg", { viewBox: "0 0 460 230", role: "img", "aria-label": label });
  chart.append(svg);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    svg.append(svgElement("text", { x: 230, y: 115, "text-anchor": "middle" }, "Verified zero; no pie slices."));
    return chart;
  }
  const legend = document.createElement("ul");
  legend.className = "analytics-pie-legend";
  legend.setAttribute("aria-label", `${label} legend`);
  legend.tabIndex = 0;
  let angle = -Math.PI / 2;
  values.forEach((value, index) => {
    if (value === 0) return;
    const end = angle + value / total * Math.PI * 2;
    const color = `hsl(${(265 + index * 137.5) % 360} 75% 65%)`;
    const attributes = { class: "analytics-pie-slice", style: `fill: ${color}` };
    const slice = value === total
      ? svgElement("circle", { ...attributes, cx: 230, cy: 115, r: 92 })
      : svgElement("path", {
        ...attributes,
        d: `M 230 115 L ${230 + 92 * Math.cos(angle)} ${115 + 92 * Math.sin(angle)} A 92 92 0 ${end - angle > Math.PI ? 1 : 0} 1 ${230 + 92 * Math.cos(end)} ${115 + 92 * Math.sin(end)} Z`
      });
    const description = `${labels[index]}: ${numberFormat.format(value)} (${percentFormat.format(value / total)})`;
    slice.append(svgElement("title", {}, `${label}\n${description}`));
    svg.append(slice);
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "analytics-pie-swatch";
    swatch.style.backgroundColor = color;
    swatch.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = description;
    item.append(swatch, text);
    legend.append(item);
    angle = end;
  });
  chart.append(legend);
  return chart;
}

function renderChart(id, growth, key, label, options = {}) {
  const container = document.getElementById(id);
  container.replaceChildren();
  if (growth === null) {
    container.textContent = "Not connected";
    return;
  }
  const values = growth.map(point => point[key]);
  const format = options.rate ? value => percentFormat.format(value / 100) : value => numberFormat.format(value);
  const maximum = options.rate ? 100 : Math.max(...values, 1);
  const type = growthChartIds.has(id) ? growthChartType.value || "line" : "line";
  const svg = svgElement("svg", { viewBox: "0 0 460 230", role: "img", "aria-label": label });
  const gradient = svgElement("linearGradient", {
    id: `${id}AreaGradient`,
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  });
  gradient.append(
    svgElement("stop", { offset: "0%", "stop-color": "#bd7dff", "stop-opacity": "0.5" }),
    svgElement("stop", { offset: "100%", "stop-color": "#6f46db", "stop-opacity": "0.02" })
  );
  const defs = svgElement("defs", {});
  defs.append(gradient);
  svg.append(defs);
  const points = growth.map((point, index) => ({
    x: 55 + index * 380 / Math.max(growth.length - 1, 1),
    y: 180 - point[key] / maximum * 145,
    point
  }));
  const grid = svgElement("g", { class: "analytics-chart-grid", "aria-hidden": "true" });
  for (const y of [35, 83, 132, 180]) {
    grid.append(svgElement("line", { x1: 55, y1: y, x2: 435, y2: y }));
  }
  svg.append(grid);
  if (type === "line") {
    svg.append(svgElement("polygon", {
      class: "analytics-chart-area",
      fill: `url(#${id}AreaGradient)`,
      points: [
        `${points[0].x},180`,
        ...points.map(point => `${point.x},${point.y}`),
        `${points[points.length - 1].x},180`
      ].join(" "),
      "aria-hidden": "true"
    }));
    svg.append(svgElement("polyline", {
      class: "analytics-chart-line",
      points: points.map(point => `${point.x},${point.y}`).join(" "),
      pathLength: 1
    }));
    for (const { x, y, point } of points) {
      const dot = svgElement("circle", { cx: x, cy: y, r: 3 });
      dot.append(svgElement("title", {}, `${label}\n${point.date}: ${format(point[key])}`));
      svg.append(dot);
    }
    for (const [index, { x, point }] of points.entries()) {
      const left = index === 0 ? 55 : (points[index - 1].x + x) / 2;
      const right = index === points.length - 1 ? 435 : (x + points[index + 1].x) / 2;
      const target = svgElement("rect", {
        x: left, y: 25, width: right - left, height: 155,
        fill: "transparent", "aria-hidden": "true"
      });
      target.append(svgElement("title", {}, `${label}\n${point.date}: ${format(point[key])}`));
      svg.append(target);
    }
  } else if (type === "bar") {
    const slot = 380 / growth.length;
    for (const [index, { y, point }] of points.entries()) {
      const bar = svgElement("rect", {
        class: "analytics-chart-bar", x: 55 + index * slot + slot * 0.15,
        y, width: slot * 0.7, height: 180 - y, rx: Math.min(4, slot * 0.1)
      });
      bar.append(svgElement("title", {}, `${label}\n${point.date}: ${format(point[key])}`));
      svg.append(bar);
      if (point[key] === 0) {
        const target = svgElement("rect", {
          x: 55 + index * slot + slot * 0.15, y: 172, width: slot * 0.7,
          height: 8, fill: "transparent", "aria-hidden": "true"
        });
        target.append(svgElement("title", {}, `${label}\n${point.date}: ${format(point[key])}`));
        svg.append(target);
      }
    }
  }
  svg.append(
    svgElement("text", { x: 5, y: 35 }, format(maximum)),
    svgElement("text", { x: 5, y: 184 }, "0"),
    svgElement("text", { x: 55, y: 212 }, growth[0].date),
    svgElement("text", { x: 435, y: 212, "text-anchor": "end" }, growth[growth.length - 1].date)
  );
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = options.rate ? "View cohort chart values" : "View chart values";
  const table = document.createElement("table");
  table.className = "analytics-table";
  const caption = document.createElement("caption");
  caption.textContent = label;
  table.append(caption);
  const head = document.createElement("thead");
  const header = document.createElement("tr");
  for (const text of [options.rate ? "Cohort" : "UTC date", options.rate ? "Retention" : "Count"]) {
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
    for (const text of [point.date, format(point[key])]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  details.append(summary, table);
  container.append(type === "pie" ? pieChart(values, growth.map(point => point.date), label) : svg, details);
}

function renderSnapshot(snapshot) {
  lastSnapshot = snapshot;
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
  renderRetentionChart(snapshot.retention);
}

function renderRetentionChart(retention) {
  const container = document.getElementById("retentionChart");
  container.replaceChildren();
  if (retention === null) {
    container.textContent = "Not connected";
    return;
  }
  if (growthChartType.value === "pie") {
    const pies = document.createElement("div");
    pies.className = "analytics-retention-pies";
    for (const cohort of retention) {
      const panel = document.createElement("div");
      const heading = document.createElement("h3");
      heading.textContent = `Day ${cohort.day}`;
      const note = document.createElement("p");
      note.textContent = cohort.eligible_users === 0 ? "No eligible users" :
        `${percentFormat.format(cohort.returning_users / cohort.eligible_users)} returned`;
      panel.append(heading, note);
      if (cohort.eligible_users > 0) {
        panel.append(pieChart(
          [cohort.returning_users, cohort.eligible_users - cohort.returning_users],
          ["Returned", "Not returned"], `Day ${cohort.day} retention: returned versus not returned`
        ));
      }
      pies.append(panel);
    }
    container.append(pies);
    return;
  }
  const eligible = retention.filter(cohort => cohort.eligible_users > 0);
  if (eligible.length === 0) {
    container.textContent = "No eligible users";
    return;
  }
  renderChart("retentionChart", eligible.map(cohort => ({
    date: `Day ${cohort.day}`, rate: cohort.returning_users / cohort.eligible_users * 100
  })), "rate", "Retention rate by eligible registration cohort", { rate: true });
}

growthChartType.addEventListener("change", () => {
  if (lastSnapshot) renderSnapshot(lastSnapshot);
});

async function loadAnalytics() {
  if (!adminAuthorized || !dashboardOpen || requestInProgress) return;
  requestInProgress = true;
  const hero = document.getElementById("analyticsHero");
  refreshButton.disabled = true;
  document.getElementById("applyDateRange").disabled = true;
  statusElement.classList.remove("analytics-error");
  statusElement.textContent = "Loading aggregated statistics...";
  // Clear the previous snapshot on refresh so failures never look like live data.
  renderSnapshot(disconnectedSnapshot());
  document.getElementById("provinceStatus").textContent = "Loading province analytics...";
  hero.classList.add("source-loading");
  hero.classList.remove("source-connected", "source-unavailable");
  let failureDetail = "Your session could not be loaded. Sign in again.";
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error("Admin session unavailable. Please sign in again.");
    failureDetail = "The backend could not be reached. Check your connection and allowed website origin.";
    const { data, error } = await supabase.functions.invoke("wantok-chat-analytics", {
      body: getDateRange() ? { date_range: getDateRange() } : {},
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
    });
    if (error) {
      const status = error.context instanceof Response ? error.context.status : null;
      const reasons = {
        400: "The backend rejected the date filter.",
        401: "Your session is missing or expired. Sign out and sign in again.",
        403: "Administrator access or this website origin was denied.",
        404: "The analytics Edge Function endpoint was not found.",
        500: "The analytics backend failed. Check its function logs.",
        503: "The backend or aggregate source is unavailable. Check its function logs and configuration."
      };
      if (status !== null) {
        failureDetail = `HTTP ${status}. ${reasons[status] || "The analytics request failed."}`;
      }
      throw error;
    }
    failureDetail = "The backend responded, but its data failed validation. Hard-refresh the page and check frontend/backend contract versions.";
    const snapshot = validateSnapshot(data);
    failureDetail = "The backend data was valid, but dashboard rendering failed. Check the browser console.";
    renderSnapshot(snapshot);
    statusElement.textContent = snapshot.generated_at
      ? "Aggregate snapshot loaded. Any unverified metric remains Not connected."
      : "Not connected. The Wantok Chat aggregate source has not been verified and enabled.";
  }
  catch (error) {
    console.error("Could not load Wantok Chat analytics:", failureDetail,
      error instanceof Error ? error.name : "UnknownError");
    renderSnapshot(disconnectedSnapshot());
    document.getElementById("provinceStatus").textContent = "Province analytics unavailable. Check your admin session and backend, then refresh.";
    statusElement.classList.add("analytics-error");
    statusElement.textContent = `Could not load analytics. ${failureDetail} No figures are displayed.`;
  }
  finally {
    requestInProgress = false;
    refreshButton.disabled = false;
    document.getElementById("applyDateRange").disabled = false;
  }
}

function stopPolling() {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function startPolling() {
  stopPolling();
  if (!adminAuthorized || !dashboardOpen || document.visibilityState === "hidden") return;
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState !== "hidden") return loadAnalytics();
  }, 60000);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    stopPolling();
    return;
  }
  startPolling();
  return loadAnalytics();
});

window.addEventListener("pagehide", () => {
  dashboardOpen = false;
  stopPolling();
});

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  dashboardOpen = true;
  startPolling();
  return loadAnalytics();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  dashboardOpen = false;
  stopPolling();
  logoutAdmin();
});
refreshButton.addEventListener("click", loadAnalytics);

async function initialize() {
  const user = await requireAdmin();
  if (!user) return;
  adminAuthorized = true;
  await Promise.all([
    initializePlatform({ reload: loadAnalytics, renderChart }),
    loadAnalytics()
  ]);
  startPolling();
}

initialize();
