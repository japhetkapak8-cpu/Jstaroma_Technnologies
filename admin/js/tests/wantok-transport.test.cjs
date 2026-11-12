const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const fixture = require("./transport-fixture.cjs");

const root = path.resolve(__dirname, "../../..");
const disconnected = () => ({ data: { transport: { version: 1, status: "schema_required" } }, error: null });

class TestNode {}
function element(tag = "div") {
  const classes = new Set();
  return Object.assign(new TestNode(), {
    tag, children: [], listeners: {}, attributes: {}, textContent: "", value: "", disabled: true,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    open: false, style: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) }
  });
}

async function frontend(options = {}) {
  const html = await readFile(path.join(root, "admin/wantok-chat.html"), "utf8");
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, element()]));
  if (options.absent) elements.delete("transportConsole");
  const requests = [];
  const errors = [];
  const events = {};
  const timers = new Map();
  const chartCalls = [];
  let session = true;
  let result = options.result ?? disconnected();
  const context = vm.createContext({
    Node: TestNode, Response, console: { error: (...args) => errors.push(args) },
    document: {
      getElementById: id => elements.get(id),
      visibilityState: "visible",
      addEventListener: (name, callback) => { events[name] = callback; },
      createElement(tag) {
        const el = element(tag);
        Object.defineProperty(el, "id", { set(id) { elements.set(id, el); } });
        return el;
      }
    },
    window: {
      addEventListener: (name, callback) => { events[name] = callback; },
      setInterval(callback) { timers.set(1, callback); return 1; },
      clearInterval(id) { timers.delete(id); }
    }
  });
  const client = {
    auth: { getSession: async () => ({ data: { session: session ? { access_token: "synthetic-token" } : null }, error: null }) },
    functions: { invoke: async (...args) => { requests.push(args); return typeof result === "function" ? result(args[1].body) : result; } }
  };
  const modules = new Map();
  async function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const module = filename === "js/supabase.js"
      ? new vm.SyntheticModule(["supabase"], function () { this.setExport("supabase", client); }, { context })
      : new vm.SourceTextModule(await readFile(path.join(root, filename), "utf8"), { context, identifier: filename });
    modules.set(filename, module);
    return module;
  }
  const module = await load("admin/js/wantok-transport.js");
  await module.link((specifier, parent) => load(path.normalize(path.join(path.dirname(parent.identifier), specifier))));
  await module.evaluate();
  await module.namespace.initializeTransport({ renderChart: (...args) => chartCalls.push(args) });
  return {
    elements, requests, errors, events, timers, chartCalls,
    setResult: value => { result = value; }, setSession: value => { session = value; },
    refresh: () => elements.get("transportFilters").listeners.submit({ preventDefault() {} })
  };
}

test("transport preparation uses the existing Edge Function and session; no fabricated data", async () => {
  const page = await frontend();
  assert.equal(page.requests.length, 1);
  const [name, options] = page.requests[0];
  assert.equal(name, "wantok-chat-analytics");
  assert.equal(options.headers.Authorization, "Bearer synthetic-token");
  assert.equal(options.body.action, "transport_snapshot");
  assert.equal((Date.parse(options.body.date_range.end) - Date.parse(options.body.date_range.start)) / 86400000 + 1, 30);
  assert.equal(page.elements.get("transportMetrics").children.length, 10);
  for (const card of page.elements.get("transportMetrics").children) {
    assert.equal(card.children[0].children[1].textContent, "Not connected");
  }
  assert.equal(page.elements.get("transportCharts").children.length, 8);
  assert.ok(page.elements.get("transportCharts").children.every(card => /Not connected/.test(card.children[1].textContent)));
  assert.match(page.elements.get("transportStatus").textContent, /Schema required.*authorization verified/);
  assert.equal(page.elements.get("transportRefresh").disabled, false);
  assert.equal(page.elements.get("transportConsole").attributes["aria-busy"], "false");
  assert.equal(page.errors.length, 0);
  assert.equal((await frontend({ absent: true })).requests.length, 0);
});

test("transport date presets and custom validation never send invalid ranges", async () => {
  const page = await frontend();
  const preset = page.elements.get("transportDatePreset");
  for (const days of [7, 30, 90]) {
    preset.value = String(days);
    preset.listeners.change();
    await page.refresh();
    const range = page.requests.at(-1)[1].body.date_range;
    assert.equal((Date.parse(range.end) - Date.parse(range.start)) / 86400000 + 1, days);
  }
  const start = page.elements.get("transportDateStart");
  start.value = "2024-02-29";
  page.elements.get("transportDateEnd").value = "2024-02-29";
  start.listeners.change();
  assert.equal(preset.value, "custom");
  await page.refresh();
  assert.equal(page.requests.at(-1)[1].body.date_range.start, "2024-02-29");
  const before = page.requests.length;
  start.value = "invalid";
  await page.refresh();
  assert.equal(page.requests.length, before);
  assert.match(page.elements.get("transportStatus").textContent, /valid UTC/);
});

test("missing sessions, denied access, network failures and old chat responses are explicit errors", async () => {
  const page = await frontend();
  page.setSession(false);
  await page.refresh();
  assert.equal(page.requests.length, 1);
  assert.match(page.elements.get("transportStatus").textContent, /session unavailable/);
  page.setSession(true);
  for (const code of [401, 403, 404, 503]) {
    page.setResult({ data: null, error: { context: new Response("{}", { status: code }) } });
    await page.refresh();
    assert.match(page.elements.get("transportStatus").textContent, code < 404 ? /access denied/ : /backend unavailable/);
    assert.equal(page.elements.get("transportStatus").classList.contains("analytics-error"), true);
  }
  for (const data of [{ version: 3, metrics: { registered_users: 100 } }, { transport: { version: 1, status: "available", total_bookings: 100 } }]) {
    page.setResult({ data, error: null });
    await page.refresh();
    assert.match(page.elements.get("transportStatus").textContent, /Unexpected transport response/);
  }
  page.setResult(disconnected());
  await page.refresh();
  assert.match(page.elements.get("transportStatus").textContent, /Schema required/);
  assert.equal(page.elements.get("transportStatus").classList.contains("analytics-error"), false);
  assert.equal(page.elements.get("transportRefresh").disabled, false);
});

test("transport suppresses overlapping requests and stops on page exit and logout", async () => {
  const page = await frontend();
  let release;
  page.setResult(new Promise(resolve => { release = resolve; }));
  const active = page.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.elements.get("transportConsole").attributes["aria-busy"], "true");
  assert.equal(page.elements.get("transportRefresh").disabled, true);
  assert.match(page.elements.get("transportStatus").textContent, /Checking/);
  await page.refresh();
  assert.equal(page.requests.length, 2);
  release(disconnected());
  await active;
  page.events.pagehide();
  await page.refresh();
  assert.equal(page.requests.length, 2);
  page.setResult(disconnected());
  await page.events.pageshow({ persisted: true });
  assert.equal(page.requests.length, 3);
  page.elements.get("logoutBtn").listeners.click();
  await page.refresh();
  assert.equal(page.requests.length, 3);
  assert.equal(page.elements.get("transportRefresh").disabled, true);
});

test("same-page navigation and disabled database controls preserve all seven sections", async () => {
  const html = await readFile(path.join(root, "admin/wantok-chat.html"), "utf8");
  for (const id of ["transportOverview", "transportApprovals", "transportOperators", "transportTrips", "transportBookings", "transportAnalytics", "transportSafety"]) {
    assert.match(html, new RegExp(`href="#${id}"`));
    assert.match(html, new RegExp(`<section id="${id}"`));
  }
  assert.equal((html.match(/<fieldset id="transport(?:Operator|Trip)Controls" disabled/g) || []).length, 2);
  assert.doesNotMatch(html, /<option[^>]*>Suspended<\/option>/);
  const source = await readFile(path.join(root, "admin/js/wantok-chat.js"), "utf8");
  assert.ok(source.indexOf("const user = await requireAdmin();") < source.indexOf("    initializeTransport({ renderChart }),"));
});

test("available transport renders real multi-passenger totals, lists, chart grouping and decisions", async () => {
  const page = await frontend({ result: body => ({ data: { transport: fixture(body.date_range) }, error: null }) });
  assert.equal(page.errors.length, 0);
  assert.match(page.elements.get("transportStatus").textContent, /Verified transport snapshot/);
  assert.equal(page.elements.get("transportMetrics").children[6].children[0].children[1].textContent, "4");
  assert.equal(page.elements.get("transportOperatorControls").disabled, false);
  assert.equal(page.elements.get("transportTripControls").disabled, false);
  assert.equal(page.elements.get("transportOperatorNext").disabled, true);
  assert.equal(page.chartCalls.length, 3);
  page.elements.get("transportBookingInterval").value = "weekly";
  page.elements.get("transportBookingInterval").listeners.change();
  assert.ok(page.chartCalls.at(-3)[1].length <= 6);
  assert.match(page.elements.get("transportChart_occupancy").children[0].textContent, /66.7%/);
  const find = (root, text) => root.children.flatMap(child => [child, ...findAll(child)]).find(el => el.tag === "button" && el.textContent === text);
  const findAll = root => root.children.flatMap(child => [child, ...findAll(child)]);
  assert.equal(find(page.elements.get("transportTripRows"), "Cancel trip").className, "transport-action-cancel");
  assert.equal(find(page.elements.get("transportTripRows"), "Complete trip").className, "transport-action-complete");
  const approve = find(page.elements.get("transportOperatorRows"), "Approve");
  assert.ok(approve);
  approve.listeners.click();
  assert.equal(page.elements.get("transportDecisionDialog").open, true);
  const submit = page.elements.get("transportDecisionForm").listeners.submit;
  await submit({ preventDefault() {} });
  assert.match(page.elements.get("transportDecisionError").textContent, /reason is required/);
  page.elements.get("transportDecisionReason").value = "Application verified";
  page.setResult(body => body.action === "transport_decide"
    ? { data: { version: 1, status: "saved" }, error: null }
    : { data: { transport: fixture(body.date_range) }, error: null });
  await submit({ preventDefault() {} });
  const decision = page.requests.find(([, options]) => options.body.action === "transport_decide")[1].body;
  assert.equal(decision.reason, "Application verified");
  assert.equal(decision.expected_status, "pending");
  assert.equal(decision.actor_id, undefined);
  assert.match(page.elements.get("transportDecisionStatus").textContent, /saved and audited/);
  assert.equal(page.elements.get("transportDecisionDialog").open, false);
});

test("transport contract strips personal extras and rejects invalid totals, dates and segment capacity", async () => {
  const { pathToFileURL } = require("node:url");
  const { validateTransport, transportInput } = await import(pathToFileURL(path.join(root, "supabase/functions/shared/wantok-transport.js")));
  const { presetRange } = await import(pathToFileURL(path.join(root, "supabase/functions/shared/wantok-platform.js")));
  const source = fixture(presetRange(7));
  source.passenger_user_id = "private";
  source.trips.rows[0].passengers = ["private"];
  source.operators.rows[0].user_id = "private";
  const result = validateTransport(source);
  assert.equal(result.passenger_user_id, undefined);
  assert.equal(result.trips.rows[0].passengers, undefined);
  assert.equal(result.operators.rows[0].user_id, undefined);
  for (const mutate of [
    d => { d.metrics.seats_reserved = -1; },
    d => { d.metrics.pending_operators = 2; },
    d => { d.daily.pop(); },
    d => { d.daily[0].date = "invalid"; },
    d => { d.occupancy.reserved = 100; },
    d => { d.trips.rows[0].segments[0].remaining = 2; },
    d => { d.trips.rows[0].remaining_seats = 3; },
    d => { d.operators.rows[0].status = "suspended"; },
    d => { d.operators.total = 26; }
  ]) {
    const invalid = structuredClone(source);
    mutate(invalid);
    assert.throws(() => validateTransport(invalid));
  }
  assert.throws(() => transportInput({ action: "transport_snapshot", operators: { page: -1 } }));
  assert.throws(() => transportInput({ action: "transport_snapshot", operators: { status: "suspended" } }));
});

test("available data clears on failures, paused dialogs prevent polling and literal filters return empty states", async () => {
  const page = await frontend({ result: body => ({ data: { transport: fixture(body.date_range) }, error: null }) });
  const before = page.requests.length;
  page.elements.get("transportDecisionDialog").open = true;
  await page.timers.get(1)();
  assert.equal(page.requests.length, before);
  page.elements.get("transportDecisionDialog").open = false;
  page.setResult({ data: null, error: { context: new Response("{}", { status: 503 }) } });
  await page.refresh();
  assert.equal(page.elements.get("transportMetrics").children[6].children[0].children[1].textContent, "Not connected");
  assert.equal(page.elements.get("transportOperatorControls").disabled, true);
  assert.equal(page.elements.get("transportTripControls").disabled, true);
  page.setResult(body => {
    const data = fixture(body.date_range);
    if (body.operators.search) data.operators = { page: 0, total: 0, rows: [] };
    return { data: { transport: data }, error: null };
  });
  await page.timers.get(1)();
  page.elements.get("transportOperatorSearch").value = "%_ literal";
  page.elements.get("transportOperatorStatus").value = "pending";
  await page.elements.get("transportOperatorFilters").listeners.submit({ preventDefault() {} });
  assert.equal(page.requests.at(-1)[1].body.operators.search, "%_ literal");
  assert.equal(page.elements.get("transportOperatorPage").textContent, "0 records / page 1");
  assert.equal(page.elements.get("transportOperatorNext").disabled, true);
});
