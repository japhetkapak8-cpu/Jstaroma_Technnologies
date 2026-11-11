import { supabase } from "../../js/supabase.js";
import { presetRange, validateRange, groupSeries } from "../../supabase/functions/shared/wantok-platform.js";
import { TRANSPORT_METRICS, validateTransport } from "../../supabase/functions/shared/wantok-transport.js";

const CHARTS = [
  ["bookings", "Booking trends"], ["registrations", "New PMV operator registrations"],
  ["routes", "Most popular routes (confirmed bookings)"], ["places", "Trips by origin and destination"],
  ["occupancy", "Seat occupancy rate"], ["operators", "Trips by operator"],
  ["outcomes", "Completed versus cancelled trips"], ["cancellations", "Booking cancellation trends"]
];
const number = new Intl.NumberFormat();
const time = value => value ? new Date(value).toLocaleString() : "Not set";

function node(tag, value, className) {
  const element = document.createElement(tag);
  if (value !== undefined) element.textContent = String(value);
  if (className) element.className = className;
  return element;
}
function table(caption, headings, rows) {
  const element = node("table", undefined, "analytics-table");
  element.append(node("caption", caption));
  const head = node("thead");
  const header = node("tr");
  for (const label of headings) {
    const cell = node("th", label);
    cell.scope = "col";
    header.append(cell);
  }
  head.append(header);
  const body = node("tbody");
  for (const values of rows) {
    const row = node("tr");
    for (const value of values) {
      const cell = node("td");
      cell.append(value instanceof Node ? value : node("span", value));
      row.append(cell);
    }
    body.append(row);
  }
  if (!rows.length) {
    const row = node("tr");
    const cell = node("td", "No records match these filters.");
    cell.colSpan = headings.length;
    row.append(cell);
    body.append(row);
  }
  element.append(head, body);
  return element;
}

export async function initializeTransport({ renderChart } = {}) {
  const get = id => document.getElementById(id);
  const root = get("transportConsole");
  if (!root) return;
  const status = get("transportStatus");
  const button = get("transportRefresh");
  const preset = get("transportDatePreset");
  const start = get("transportDateStart");
  const end = get("transportDateEnd");
  const period = get("transportPeriod");
  const dialog = get("transportDecisionDialog");
  const metrics = get("transportMetrics");
  const charts = get("transportCharts");
  let busy = false;
  let open = true;
  let snapshot = null;
  let connected = false;
  let decision = null;
  let timer = null;
  const filters = {
    operators: { search: "", status: "", page: 0 },
    trips: { search: "", status: "", page: 0 }
  };
  const metricValues = new Map();
  for (const [key, label] of TRANSPORT_METRICS) {
    const card = node("article", undefined, "dashboard-stat");
    const body = node("div");
    const value = node("strong", "Not connected");
    metricValues.set(key, value);
    body.append(node("span", label), value, node("small", "Current stored records"));
    card.append(body);
    metrics.append(card);
  }
  for (const [key, label] of CHARTS) {
    const card = node("article", undefined, "admin-card analytics-panel");
    const chart = node("div", "Not connected", "analytics-chart");
    chart.id = `transportChart_${key}`;
    card.append(node("h3", label), chart);
    charts.append(card);
  }
  function setPreset(days) {
    const range = presetRange(days);
    start.value = range.start;
    end.value = range.end;
  }
  setPreset(30);
  start.max = end.max = presetRange(7).end;
  for (const control of [preset, start, end]) control.disabled = false;
  preset.addEventListener("change", () => {
    if (preset.value !== "custom") setPreset(Number(preset.value));
  });
  for (const control of [start, end]) control.addEventListener("change", () => { preset.value = "custom"; });

  function setControls(ready) {
    for (const kind of ["Operator", "Trip"]) {
      get(`transport${kind}Controls`).disabled = !ready;
      get(`transport${kind}Previous`).disabled = !ready;
      get(`transport${kind}Next`).disabled = !ready;
    }
  }
  function clear() {
    snapshot = null;
    setControls(false);
    for (const value of metricValues.values()) value.textContent = "Not connected";
    for (const [key] of CHARTS) get(`transportChart_${key}`).textContent = "Not connected";
    for (const id of ["transportOperatorRows", "transportTripRows", "transportAuditRows"]) {
      get(id).replaceChildren(node("p", "Not connected. No verified records loaded."));
    }
    get("transportBookingSummary").textContent = "Not connected.";
    get("transportSourceBadge").textContent = "Not connected";
    get("transportOperatorPage").textContent = "";
    get("transportTripPage").textContent = "";
  }
  function bars(key, rows) {
    const container = get(`transportChart_${key}`);
    container.replaceChildren();
    if (!rows.length) { container.textContent = "No records in the selected period (verified empty)."; return; }
    const list = node("ul", undefined, "transport-bars");
    const max = Math.max(...rows.map(row => row.count), 1);
    for (const row of rows) {
      const item = node("li");
      item.append(node("span", `${row.label}: ${number.format(row.count)}`));
      const bar = node("span", undefined, "transport-bar");
      bar.style.width = `${row.count / max * 100}%`;
      bar.setAttribute("aria-hidden", "true");
      item.append(bar);
      list.append(item);
    }
    container.append(list);
  }
  function renderCharts() {
    if (!snapshot) return;
    const interval = get("transportBookingInterval").value || "daily";
    for (const key of ["bookings", "registrations", "cancellations"]) {
      const series = snapshot.daily.map(point => ({ date: point.date, count: point[key] }));
      renderChart(`transportChart_${key}`, groupSeries(series, key === "bookings" ? interval : "daily"),
        "count", `${key === "bookings" ? interval : "daily"} transport ${key}`);
    }
    bars("routes", snapshot.routes.map(row => ({ label: row.label, count: row.bookings })));
    bars("places", [
      ...snapshot.origins.map(row => ({ label: `Origin: ${row.label}`, count: row.count })),
      ...snapshot.destinations.map(row => ({ label: `Destination: ${row.label}`, count: row.count }))
    ]);
    bars("operators", snapshot.by_operator);
    bars("outcomes", Object.entries(snapshot.outcomes).map(([label, count]) => ({ label, count })));
    const { reserved, capacity } = snapshot.occupancy;
    const occupancy = get("transportChart_occupancy");
    occupancy.replaceChildren();
    if (capacity) {
      const label = `${(reserved / capacity * 100).toFixed(1)}% occupancy: ${number.format(reserved)} confirmed passenger-seat segments / ${number.format(capacity)} capacity-seat segments.`;
      occupancy.append(node("p", label));
      const meter = node("meter");
      meter.min = 0;
      meter.max = capacity;
      meter.value = reserved;
      meter.className = "transport-occupancy";
      meter.setAttribute("aria-label", label);
      occupancy.append(meter);
    } else occupancy.textContent = "No capacity-seat segments in the selected period (verified zero denominator).";
  }
  function action(kind, row, next) {
    const control = node("button", next === "approved" ? "Approve" : next === "rejected" ? "Reject" : next === "completed" ? "Complete trip" : "Cancel trip");
    control.type = "button";
    control.addEventListener("click", () => {
      if (busy || !snapshot) return;
      decision = {
        kind, target_id: row.id, expected_status: row.status,
        expected_updated_at: row.updated_at, status: next
      };
      get("transportDecisionHeading").textContent = `${control.textContent}: ${kind === "operator" ? row.business_name : `${row.departure} to ${row.destination}`}`;
      get("transportDecisionWarning").textContent = next === "rejected"
        ? "Rejecting cancels all of this operator's published trips and confirmed reservations. This is not a suspension."
        : next === "cancelled" ? "Cancelling this trip cancels confirmed reservations and sends existing booking notices."
          : "This decision changes the authoritative Wantok transport status and records your administrator ID.";
      get("transportDecisionReason").value = "";
      get("transportDecisionError").textContent = "";
      dialog.showModal();
    });
    return control;
  }
  function statusLabel(value) { return node("span", value, `transport-status transport-status-${value}`); }
  function renderOperators() {
    const rows = snapshot.operators.rows.map(row => {
      const details = node("details");
      details.append(node("summary", "Vehicles and saved routes"));
      for (const vehicle of row.vehicles) details.append(node("p",
        `${vehicle.vehicle_type} / ${vehicle.registration_number} / ${vehicle.passenger_capacity} seats`));
      for (const route of row.routes) details.append(node("p", `${route.name}: ${route.stops.join(" -> ")}`));
      if (!row.vehicles.length && !row.routes.length) details.append(node("p", "No registered vehicles or saved routes."));
      const controls = node("div", undefined, "transport-actions");
      controls.append(statusLabel(row.status));
      if (row.status !== "approved") controls.append(action("operator", row, "approved"));
      if (row.status !== "rejected") controls.append(action("operator", row, "rejected"));
      if (row.review_note) controls.append(node("p", `Review: ${row.review_note} (${time(row.reviewed_at)})`));
      return [
        `${row.business_name}${row.display_name ? ` / ${row.display_name}` : ""}`,
        `${row.contact_phone} / ${row.province} / ${row.operating_area}`,
        details, time(row.created_at), controls
      ];
    });
    get("transportOperatorRows").replaceChildren(table("PMV operator directory and applications",
      ["Operator", "Contact / area", "Vehicles / routes", "Registered", "Status / review"], rows));
  }
  function renderTrips() {
    const rows = snapshot.trips.rows.map(row => {
      const details = node("details");
      details.append(node("summary", "Stops, connections and segment seats"));
      const stops = node("ol");
      for (const stop of row.stops) stops.append(node("li",
        `${stop.location} | arrive ${time(stop.arrival_at)} | depart ${time(stop.departure_at)}`));
      details.append(stops);
      for (const segment of row.segments) details.append(node("p",
        `Segment ${segment.position}: ${segment.reserved} reserved / ${segment.remaining} remaining / ${row.capacity} capacity`));
      const controls = node("div", undefined, "transport-actions");
      controls.append(statusLabel(row.status));
      if (row.status === "published") controls.append(action("trip", row, "cancelled"), action("trip", row, "completed"));
      return [
        `${row.departure} -> ${row.destination}`, row.operator_name,
        row.vehicle ? `${row.vehicle.vehicle_type} / ${row.vehicle.registration_number}` : "No vehicle assigned",
        `${time(row.departure_at)} (${row.departure_timezone}; displayed in your local timezone)`,
        `${row.bookings} confirmed bookings / ${row.seats_reserved} passengers / ${row.remaining_seats ?? "unknown"} through-seats remaining`,
        details, controls
      ];
    });
    get("transportTripRows").replaceChildren(table("Transport trips (current records)",
      ["Journey", "Operator", "Vehicle", "Departure", "Reservations", "Details", "Status / moderation"], rows));
  }
  function render(data) {
    snapshot = data;
    for (const [key, value] of metricValues) value.textContent = number.format(data.metrics[key]);
    get("transportSourceBadge").textContent = "Verified transport source";
    period.textContent = `Charts: ${data.period.start} to ${data.period.end} UTC. Current-record KPIs and lists as of ${time(data.generated_at)}. Refreshes every 60 seconds while visible.`;
    get("transportBookingSummary").textContent = `${number.format(data.metrics.total_bookings)} reservations across all statuses; ${number.format(data.metrics.seats_reserved)} confirmed passenger seats. Passenger identities are not loaded.`;
    setControls(true);
    for (const [kind, page] of [["Operator", data.operators], ["Trip", data.trips]]) {
      get(`transport${kind}Page`).textContent = `${page.total} records / page ${page.page + 1}`;
      get(`transport${kind}Previous`).disabled = page.page === 0;
      get(`transport${kind}Next`).disabled = (page.page + 1) * 25 >= page.total;
    }
    renderOperators();
    renderTrips();
    renderCharts();
    get("transportAuditRows").replaceChildren(table("Latest transport admin decisions",
      ["When", "Administrator (Jstaroma)", "Target", "Transition", "Reason"],
      data.audit.map(row => [time(row.created_at), row.actor_id, `${row.target_kind} ${row.target_id}`,
        `${row.old_status} -> ${row.new_status}`, row.reason])));
  }
  async function invoke(body) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) throw new Error("Admin session unavailable. Sign in again.");
    const { data, error } = await supabase.functions.invoke("wantok-chat-analytics", {
      body, headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
    });
    if (error) {
      const code = error.context instanceof Response ? error.context.status : null;
      throw new Error(code === 401 || code === 403 ? "Administrator access denied. Verify membership, confirmed admin email and self-review rules."
        : code === 400 || code === 409 ? "Request not confirmed. Refresh and verify current status, decision reason and future boardings before retrying."
          : "Transport backend unavailable. Verify the reviewed SQL, Edge Function, website origin and connection.");
    }
    return data;
  }
  async function refresh(event) {
    event?.preventDefault();
    if (busy || !open || dialog.open) return;
    busy = true;
    button.disabled = true;
    root.setAttribute("aria-busy", "true");
    clear();
    status.classList.remove("analytics-error");
    status.textContent = "Checking the authorized transport connection...";
    try {
      const range = validateRange({ start: start.value, end: end.value });
      const data = await invoke({ action: "transport_snapshot", date_range: range, ...filters });
      if (!open) return;
      if (data?.transport?.version === 1 && data.transport.status === "schema_required") {
        connected = false;
        status.textContent = "Schema required or integration not enabled. Admin authorization verified; management remains disabled until the reviewed transport SQL is installed and enabled.";
        return;
      }
      const verified = validateTransport(data?.transport);
      if (verified.period.start !== range.start || verified.period.end !== range.end ||
          verified.operators.page !== filters.operators.page || verified.trips.page !== filters.trips.page) {
        throw new Error("Unexpected transport response period or page.");
      }
      render(verified);
      connected = true;
      status.textContent = "Verified transport snapshot loaded. Decisions and reservations use the existing backend rules.";
    }
    catch (error) {
      console.error("Wantok Transport refresh failed.", error instanceof Error ? error.name : "UnknownError");
      clear();
      status.classList.add("analytics-error");
      status.textContent = error instanceof Error ? error.message : "Transport refresh failed. No figures are displayed.";
    }
    finally {
      busy = false;
      button.disabled = !open;
      root.setAttribute("aria-busy", "false");
    }
  }
  get("transportFilters").addEventListener("submit", refresh);
  get("transportBookingInterval").addEventListener("change", renderCharts);
  for (const [kind, key] of [["Operator", "operators"], ["Trip", "trips"]]) {
    get(`transport${kind}Filters`).addEventListener("submit", event => {
      event.preventDefault();
      if (busy || !snapshot) return;
      filters[key] = { search: get(`transport${kind}Search`).value.trim(), status: get(`transport${kind}Status`).value, page: 0 };
      return refresh();
    });
    for (const [direction, offset] of [["Previous", -1], ["Next", 1]]) {
      get(`transport${kind}${direction}`).addEventListener("click", () => {
        if (busy || !snapshot) return;
        filters[key].page += offset;
        return refresh();
      });
    }
  }
  get("transportDecisionCancel").addEventListener("click", () => { if (!busy) { decision = null; dialog.close(); } });
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); else decision = null; });
  get("transportDecisionForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !decision || !open) return;
    const reason = get("transportDecisionReason").value.trim();
    if (!reason) { get("transportDecisionError").textContent = "A reason is required."; return; }
    busy = true;
    get("transportDecisionConfirm").disabled = true;
    get("transportDecisionCancel").disabled = true;
    let message;
    try {
      const result = await invoke({ action: "transport_decide", ...decision, reason });
      if (result?.version !== 1 || result.status !== "saved") throw new Error("Unexpected decision response.");
      message = "Decision saved and audited. Review the refreshed status below.";
    }
    catch (error) {
      console.error("Wantok Transport decision not confirmed.", error instanceof Error ? error.name : "UnknownError");
      message = `Decision not confirmed. ${error instanceof Error ? error.message : "Refresh and verify the status before retrying."}`;
    }
    finally {
      busy = false;
      get("transportDecisionConfirm").disabled = false;
      get("transportDecisionCancel").disabled = false;
      decision = null;
      dialog.close();
    }
    get("transportDecisionStatus").textContent = message;
    await refresh();
  });
  function stopTimer() { if (timer !== null) { window.clearInterval(timer); timer = null; } }
  function startTimer() {
    stopTimer();
    if (open && document.visibilityState !== "hidden") {
      timer = window.setInterval(() => { if (connected && !dialog.open) return refresh(); }, 60000);
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopTimer();
    else { startTimer(); if (connected) return refresh(); }
  });
  window.addEventListener("pagehide", () => { open = false; stopTimer(); button.disabled = true; });
  window.addEventListener("pageshow", event => {
    if (event.persisted) { open = true; startTimer(); return refresh(); }
  });
  get("logoutBtn").addEventListener("click", () => { open = false; connected = false; stopTimer(); clear(); button.disabled = true; });
  await refresh();
  startTimer();
}
