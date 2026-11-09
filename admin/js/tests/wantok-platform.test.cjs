const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const root = path.resolve(__dirname, "../../..");
const moduleAt = file => import(pathToFileURL(path.join(root, file)));
const platformModule = moduleAt("supabase/functions/shared/wantok-platform.js");
const contractModule = moduleAt("supabase/functions/shared/wantok-chat-contract.js");

async function platformSnapshot(days = 7) {
  const { PLATFORM_METRICS, CONNECTED_PLATFORM_KEYS, presetRange } = await platformModule;
  const period = presetRange(days, new Date("2026-11-08T12:00:00Z"));
  return {
    version: 3, metric_scope: "current_records", generated_at: "2026-11-08T12:00:00Z", period,
    metrics: { registered_users: 100, mau: null, dau: null, messages: 200, calls: 100, groups: 4 },
    growth: null, retention: null,
    platform: {
      metrics: Object.fromEntries(PLATFORM_METRICS.map(([key]) => [
        key, CONNECTED_PLATFORM_KEYS.includes(key)
          ? ["new_registrations", "period_messages", "period_calls"].includes(key) ? days : 1
          : null
      ])),
      series: Object.fromEntries(["registrations", "messages", "calls"].map(key => [
        key, Array.from({ length: days }, (_, index) => ({
          date: new Date(Date.parse(period.start) + index * 86400000).toISOString().slice(0, 10), count: 1
        }))
      ])),
      geography: { countries: null, provinces: null }, devices: null
    }
  };
}

test("date filters enforce complete UTC dates, presets, leap dates and bounded custom ranges", async () => {
  const { presetRange, validateRange } = await platformModule;
  const now = new Date("2026-11-08T23:59:59Z");
  for (const days of [7, 30, 90]) {
    const range = presetRange(days, now);
    assert.equal(range.end, "2026-11-07");
    assert.equal((Date.parse(range.end) - Date.parse(range.start)) / 86400000 + 1, days);
    assert.deepEqual(validateRange(range, now), range);
  }
  assert.deepEqual(validateRange({ start: "2024-02-29", end: "2024-02-29" }, now),
    { start: "2024-02-29", end: "2024-02-29" });
  for (const range of [
    { start: "2026-02-30", end: "2026-03-01" },
    { start: "2026-11-08", end: "2026-11-08" },
    { start: "2026-11-07", end: "2026-11-06" },
    { start: "2020-01-01", end: "2026-11-07" },
    { start: "2026-11-01T00:00:00Z", end: "2026-11-07" }
  ]) assert.throws(() => validateRange(range, now));
  assert.throws(() => presetRange(14, now));
});

test("daily/weekly/monthly registrations preserve counts and use Monday UTC boundaries", async () => {
  const { groupSeries } = await platformModule;
  const series = [
    { date: "2026-10-31", count: 2 }, { date: "2026-11-01", count: 3 },
    { date: "2026-11-02", count: 4 }
  ];
  assert.deepEqual(groupSeries(series, "daily"), series);
  assert.deepEqual(groupSeries(series, "weekly"), [
    { date: "2026-10-26", count: 5 }, { date: "2026-11-02", count: 4 }
  ]);
  assert.deepEqual(groupSeries(series, "monthly"), [
    { date: "2026-10", count: 2 }, { date: "2026-11", count: 7 }
  ]);
  assert.throws(() => groupSeries(series, "yearly"));
});

test("v3 validates exact window, safe counts, daily continuity and sums; strips extra private fields", async () => {
  const { validateSnapshot } = await contractModule;
  for (const days of [7, 30, 90]) {
    const data = await platformSnapshot(days);
    assert.deepEqual(validateSnapshot(data), data);
  }
  const input = await platformSnapshot();
  input.platform.user_ids = ["not-forwarded"];
  input.platform.series.registrations[0].email = "not-forwarded";
  input.platform.metrics.recording = "not-forwarded";
  const output = validateSnapshot(input);
  assert.equal(output.platform.user_ids, undefined);
  assert.equal(output.platform.metrics.recording, undefined);
  assert.equal(output.platform.series.registrations[0].email, undefined);
  for (const mutate of [
    data => { data.platform.metrics.online_users = 0; },
    data => { data.platform.metrics.revenue = 100; },
    data => { data.platform.metrics.completed_calls = 1; },
    data => { data.metrics.mau = 1; },
    data => { data.platform.geography.provinces = [{ name: "Jiwaka", count: 1 }]; },
    data => { data.platform.devices = [{ device: "private" }]; },
    data => { data.platform.series.registrations.pop(); },
    data => { data.platform.series.registrations[0].date = data.period.end; },
    data => { data.platform.series.registrations[0].count = -1; },
    data => { data.platform.metrics.new_registrations = 1; },
    data => { data.platform.metrics.total_audio_calls = 101; },
    data => { data.platform.metrics.voice_notes = 50; },
    data => { delete data.platform.metrics.voice_notes; }
  ]) {
    const data = await platformSnapshot();
    mutate(data);
    assert.throws(() => validateSnapshot(data));
  }
});

test("geographic privacy withholds all buckets, Unknown, totals and derived percentages for small groups", async () => {
  const { protectGeography } = await platformModule;
  for (const rows of [
    [{ code: "PG", count: 50 }, { code: "UNKNOWN", count: 3 }],
    [{ code: "PG", count: 3 }, { code: "UNKNOWN", count: 100 }],
    [{ code: "PG", count: 9 }, { code: "UNKNOWN", count: 0 }]
  ]) assert.deepEqual(protectGeography(rows), { status: "suppressed", rows: null, total: null });
  assert.deepEqual(protectGeography([{ code: "PG", count: 10 }, { code: "UNKNOWN", count: 0 }]), {
    status: "available", rows: [{ code: "PG", count: 10 }, { code: "UNKNOWN", count: 0 }], total: 10
  });
  for (const rows of [
    [{ code: "PG", count: 10 }],
    [{ code: "UNKNOWN", count: -1 }],
    [{ code: "UNKNOWN", count: 1.5 }],
    [{ code: "UNKNOWN", count: 10 }, { code: "UNKNOWN", count: 10 }]
  ]) assert.throws(() => protectGeography(rows));
});

test("CSV exports quote delimiters, escape formulas, preserve zeros and label unavailable data", async () => {
  const { csvRows } = await platformModule;
  assert.equal(csvRows([["a,b", '"quote"', 0, null, "=CMD()", " @SUM(1)"]]),
    '"a,b","""quote""","0","Not connected","\'=CMD()","\' @SUM(1)"');
  const { exportSnapshot } = await moduleAt("admin/js/wantok-platform-ui.js");
  const data = await platformSnapshot();
  const csv = exportSnapshot(data);
  assert.match(csv, /"Revenue","Not connected"/);
  assert.match(csv, /"registrations","1","count"/);
  assert.ok(!csv.includes("user_id") && !csv.includes("recording"));
  assert.throws(() => exportSnapshot({ generated_at: null }));
});

function documentFixture(html) {
  const elements = new Map();
  function create(tag = "div") {
    const classes = new Set();
    return {
      tag, children: [], attributes: {}, listeners: {}, textContent: "", value: "", disabled: false,
      style: { removeProperty(name) { delete this[name]; } },
      set id(value) { this._id = value; elements.set(value, this); },
      get id() { return this._id; },
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, force) { if (force) classes.add(value); else classes.delete(value); }
      },
      addEventListener(name, action) { this.listeners[name] = action; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; this.textContent = ""; },
      querySelectorAll(tag) {
        return this.children.flatMap(child => [child.tag === tag ? [child] : [], child.querySelectorAll(tag)]).flat();
      },
      querySelector(tag) { return this.querySelectorAll(tag)[0] || null; },
      getBoundingClientRect() { return { width: 800, height: 340 }; },
      click() { this.listeners.click?.(); }
    };
  }
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    const node = create();
    node.id = id;
  }
  elements.get("registrationInterval").value = "daily";
  const document = {
    getElementById: id => elements.get(id),
    createElement: create,
    createElementNS: (namespace, tag) => create(tag)
  };
  return { document, elements };
}

test("real public boundary files cover all 22 PNG provinces and have documented licenses", async () => {
  const { geometryPath, projectCoordinate } = await moduleAt("admin/js/wantok-maps.js");
  assert.throws(() => geometryPath({ type: "Point", coordinates: [1, 2] }));
  assert.throws(() => geometryPath({ type: "Polygon", coordinates: [] }));
  assert.throws(() => projectCoordinate([181, 10]));
  assert.throws(() => projectCoordinate([1, NaN]));
  const png = JSON.parse(await readFile(path.join(root, "admin/data/png-provinces.geojson")));
  const world = JSON.parse(await readFile(path.join(root, "admin/data/world-countries.geojson")));
  assert.equal(png.features.length, 22);
  const names = png.features.map(feature => feature.properties.shapeName);
  for (const name of ["Jiwaka Province", "Hela Province", "Morobe Province", "Western Highlands Province",
    "Eastern Highlands Province", "National Capital District"]) assert.ok(names.includes(name));
  assert.equal(new Set(names).size, 22);
  assert.equal(world.features.length, 177);
  for (const feature of [...png.features, ...world.features]) {
    assert.match(geometryPath(feature.geometry), /^M/);
    assert.ok(!geometryPath(feature.geometry).includes("NaN"));
  }
  const sources = JSON.parse(await readFile(path.join(root, "admin/data/boundary-sources.json")));
  assert.equal(sources.png.license, "CC BY 3.0 IGO");
  assert.equal(sources.world.license, "Public domain");
});

test("platform UI initializes maps, selection, zoom, filters, investor view, intervals and empty/error states", async () => {
  const html = await readFile(path.join(root, "admin/wantok-chat.html"), "utf8");
  const fixture = documentFixture(html);
  const originalDocument = global.document;
  const originalFetch = global.fetch;
  const errors = [];
  const originalError = console.error;
  global.document = fixture.document;
  global.fetch = async url => ({
    ok: true, json: async () => JSON.parse(await readFile(path.join(root, "admin", url), "utf8"))
  });
  console.error = (...args) => errors.push(args);
  try {
    const { initializePlatform, renderPlatform, getDateRange } = await moduleAt("admin/js/wantok-platform-ui.js");
    const charts = [];
    let reloads = 0;
    await initializePlatform({ reload: async () => { reloads++; }, renderChart: (...args) => charts.push(args) });
    const get = id => fixture.elements.get(id);
    assert.equal(get("applyDateRange").disabled, false);
    const svg = get("pngMap").children[2];
    assert.equal(svg.querySelectorAll("path").length, 22);
    const pathNode = svg.querySelectorAll("path")[9];
    pathNode.listeners.click();
    assert.match(get("pngMapSelection").textContent, /Jiwaka Province: Not connected/);
    const controls = get("pngMap").children[0];
    const before = svg.attributes.viewBox;
    controls.children[0].click();
    assert.notEqual(svg.attributes.viewBox, before);
    controls.children[2].click();
    assert.equal(svg.attributes.viewBox, before);
    assert.equal(get("pngLeaderboard").children[0].children[2].children.length, 23);

    const data = await platformSnapshot();
    renderPlatform(data);
    assert.equal(get("summaryMetrics-new_registrations").textContent, "7");
    const { PNG_PROVINCES } = await moduleAt("supabase/functions/shared/wantok-platform.js");
    data.platform.geography.provinces = {
      status: "available", total: 0, rows: PNG_PROVINCES.map(name => ({ name, count: 0 }))
    };
    renderPlatform(data);
    assert.equal(get("provinceStatus").textContent, "No profiles found.");
    assert.equal(get("provinceMissing").textContent, "—");
    assert.equal(get("provinceChart").children[0].children.length, 23);
    data.platform.geography.provinces = { status: "error" };
    renderPlatform(data);
    assert.match(get("provinceStatus").textContent, /unavailable/);
    assert.equal(get("provinceTotal").textContent, "Not connected");
    data.platform.geography.provinces = null;
    assert.equal(get("financeMetrics-profit").textContent, "Not connected");
    assert.equal(get("exportAnalytics").disabled, false);
    get("registrationInterval").value = "weekly";
    get("registrationInterval").listeners.change();
    assert.ok(charts.at(-1)[3].includes("weekly"));
    get("investorView").listeners.change({ target: { checked: true } });
    assert.ok(get("analyticsMain").classList.contains("investor-mode"));
    get("dateStart").value = "2020-01-01"; get("dateEnd").value = "2026-11-07";
    await get("analyticsFilters").listeners.submit({ preventDefault() {} });
    assert.equal(reloads, 0);
    assert.match(get("filterStatus").textContent, /1-366/);
    get("dateStart").value = "2026-11-01"; get("dateEnd").value = "2026-11-07";
    await get("analyticsFilters").listeners.submit({ preventDefault() {} });
    assert.equal(reloads, 1);
    assert.deepEqual(getDateRange(), { start: "2026-11-01", end: "2026-11-07" });
    for (const series of Object.values(data.platform.series)) for (const point of series) point.count = 0;
    for (const key of ["new_registrations", "period_messages", "period_calls"]) data.platform.metrics[key] = 0;
    renderPlatform(data);
    assert.match(get("registrationEmpty").textContent, /verified zero/);
    const { disconnectedSnapshot } = await contractModule;
    renderPlatform(disconnectedSnapshot());
    assert.equal(get("exportAnalytics").disabled, true);
    assert.equal(get("summaryMetrics-new_registrations").textContent, "Not connected");
    assert.ok(charts.some(chart => chart[1] === null));
    const { initializeMap } = await moduleAt("admin/js/wantok-maps.js");
    await initializeMap(get("worldMap"), "world", async () => ({ ok: false }));
    assert.equal(get("worldMap").textContent, "Map unavailable.");
    assert.match(get("worldMapStatus").textContent, /Boundary loading error/);
    assert.equal(errors.length, 2);
  }
  finally {
    global.document = originalDocument;
    global.fetch = originalFetch;
    console.error = originalError;
  }
});
