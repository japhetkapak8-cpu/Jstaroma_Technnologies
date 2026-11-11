const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const transportFixture = require("./transport-fixture.cjs");

const root = path.resolve(__dirname, "../../..");

async function loadModule(relativePath, globals = {}, mocks = {}, transform = value => value) {
  const context = vm.createContext({
    console, Response, Request, URL, AbortSignal, fetch, ...globals
  });
  const modules = new Map();
  async function getModule(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const mock = mocks[path.relative(root, filename)];
    const module = mock
      ? new vm.SyntheticModule(Object.keys(mock), function () {
        for (const [key, value] of Object.entries(mock)) this.setExport(key, value);
      }, { context, identifier: filename })
      : new vm.SourceTextModule(transform(await readFile(filename, "utf8"), filename), {
        context, identifier: filename
      });
    modules.set(filename, module);
    return module;
  }
  const module = await getModule(path.join(root, relativePath));
  await module.link((specifier, parent) =>
    getModule(path.resolve(path.dirname(parent.identifier), specifier)));
  await module.evaluate();
  return { module: module.namespace, context };
}

function snapshot() {
  return {
    version: 1,
    generated_at: "2026-11-08T12:00:00Z",
    period: { start: "2026-10-09", end: "2026-11-07" },
    metrics: { registered_users: 100, mau: 40, dau: 0, messages: 200, calls: null, groups: 4 },
    growth: Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.parse("2026-10-09") + index * 86400000).toISOString().slice(0, 10),
      registered_users: 70 + index,
      dau: index
    })),
    retention: [
      { day: 1, eligible_users: 10, returning_users: 5 },
      { day: 7, eligible_users: 0, returning_users: 0 },
      { day: 30, eligible_users: 2, returning_users: 1 }
    ]
  };
}

function currentRecordSnapshot() {
  return {
    ...snapshot(),
    version: 2,
    metric_scope: "current_records",
    metrics: { registered_users: 100, mau: null, dau: null, messages: 200, calls: 0, groups: 4 },
    growth: null,
    retention: null
  };
}

async function backend(options = {}) {
  const events = [];
  const errors = [];
  const environment = {
    SUPABASE_URL: "https://fticsjeytmepljtkfrvm.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-website-server-key",
    ANALYTICS_ALLOWED_ORIGINS: "https://website.example, http://localhost:8080",
    WANTOK_SUPABASE_URL: "https://patrtlxmcjrzzfvvfcft.supabase.co",
    WANTOK_ANALYTICS_KEY: "test-wantok-jwt",
    WANTOK_ANALYTICS_VERIFIED: "true",
    ...options.env
  };
  const { module } = await loadModule("supabase/functions/wantok-chat-analytics/handler.js", {
    AbortSignal: {
      timeout(milliseconds) {
        assert.equal(milliseconds, 10000);
        return AbortSignal.timeout(milliseconds);
      }
    }
  });
  const handler = module.createAnalyticsHandler({
    env: key => environment[key],
    logger: { error: (...args) => errors.push(args) },
    createClient(url, key, settings) {
      events.push({ type: "client", url, key, settings });
      return {
        auth: {
          async getUser(token) {
            events.push({ type: "auth", token });
            return options.invalidToken
              ? { data: { user: null }, error: new Error("Invalid token") }
              : { data: { user: options.user ?? { id: "verified-admin-id" } }, error: null };
          }
        },
        from(table) {
          events.push({ type: "table", table });
          return {
            select(columns) {
              assert.equal(columns, "user_id");
              return {
                eq(column, value) {
                  assert.equal(column, "user_id");
                  assert.equal(value, "verified-admin-id");
                  return {
                    async maybeSingle() {
                      events.push({ type: "admin" });
                      return {
                        data: options.nonAdmin ? null : { user_id: "verified-admin-id" },
                        error: options.adminError ? new Error("Database unavailable") : null
                      };
                    }
                  };
                }
              };
            }
          };
        }
      };
    },
    async fetchImpl(url, settings) {
      events.push({ type: "wantok", url, settings });
      if (options.networkError) throw new Error("Private upstream details");
      if (url.endsWith("/wantok_admin_province_counts_v1")) {
        return new Response(JSON.stringify(options.provinces ?? {}), { status: options.provinceStatus ?? 200 });
      }
      return new Response(JSON.stringify(options.payload ?? currentRecordSnapshot()), { status: options.upstreamStatus ?? 200 });
    }
  });
  function request(settings = {}) {
    const headers = { Origin: "https://website.example", Authorization: "Bearer test-admin-token", ...settings.headers };
    for (const key of Object.keys(headers)) if (headers[key] === null) delete headers[key];
    return handler(new Request("https://website.supabase.co/functions/v1/wantok-chat-analytics", {
      method: settings.method || "POST", headers,
      ...(settings.body ? { body: settings.body } : {})
    }));
  }
  return { request, events, errors };
}

test("backend verifies Jstaroma token and admins membership before the fixed separate Wantok RPC", async () => {
  const { request, events } = await backend();
  const response = await request({ body: JSON.stringify({ table: "users", url: "https://attacker.example" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), currentRecordSnapshot());
  assert.deepEqual(events.map(event => event.type), ["client", "auth", "table", "admin", "wantok"]);
  assert.equal(events[0].url, "https://fticsjeytmepljtkfrvm.supabase.co");
  assert.equal(events[0].key, "test-website-server-key");
  assert.equal(events[1].token, "test-admin-token");
  assert.equal(events[2].table, "admins");
  const upstream = events.at(-1);
  assert.equal(upstream.url, "https://patrtlxmcjrzzfvvfcft.supabase.co/rest/v1/rpc/wantok_admin_analytics_v1");
  assert.equal(upstream.settings.body, "{}");
  assert.equal(upstream.settings.headers.apikey, "test-wantok-jwt");
  assert.equal(upstream.settings.headers.Authorization, "Bearer test-wantok-jwt");
  assert.equal(upstream.settings.redirect, "error");
  assert.ok(upstream.settings.signal);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://website.example");
});

test("missing, malformed, invalid and non-admin tokens never contact Wantok", async () => {
  for (const [options, headers, expected] of [
    [{}, { Authorization: null }, 401],
    [{}, { Authorization: "Bearer" }, 401],
    [{}, { Authorization: "Basic abc" }, 401],
    [{ invalidToken: true }, {}, 401],
    [{ nonAdmin: true }, {}, 403],
    [{ adminError: true }, {}, 503]
  ]) {
    const api = await backend(options);
    assert.equal((await api.request({ headers })).status, expected);
    assert.ok(!api.events.some(event => event.type === "wantok"));
  }
});

test("transport preparation checks server-side admin membership and never queries Wantok", async () => {
  for (const verified of ["true", "false"]) {
    const api = await backend({ env: { WANTOK_ANALYTICS_VERIFIED: verified, WANTOK_ANALYTICS_KEY: undefined } });
    const response = await api.request({ body: JSON.stringify({ action: "transport_snapshot" }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { transport: { version: 1, status: "schema_required" } });
    assert.deepEqual(api.events.map(event => event.type), ["client", "auth", "table", "admin"]);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  for (const [options, headers, expected] of [
    [{}, { Authorization: null }, 401],
    [{ invalidToken: true }, {}, 401],
    [{ nonAdmin: true }, {}, 403],
    [{ adminError: true }, {}, 503],
    [{}, { Origin: "https://not-allowed.example" }, 403]
  ]) {
    const api = await backend(options);
    const response = await api.request({ headers, body: JSON.stringify({ action: "transport_snapshot" }) });
    assert.equal(response.status, expected);
    assert.ok(!api.events.some(event => event.type === "wantok"));
  }
});

test("transport requests reject invalid filters, untrusted parameters and all mutations without writes", async () => {
  for (const [input, expected] of [
    [{ action: "transport_snapshot", date_range: { start: "invalid", end: "invalid" } }, 400],
    [{ action: "transport_snapshot", operator_id: "self", approved: true }, 400],
    [{ action: "transport_snapshot", rpc: "arbitrary_rpc" }, 400],
    [{ action: "transport_approve" }, 409],
    [{ action: "transport_reject" }, 409],
    [{ action: "transport_suspend" }, 409],
    [{ action: "transport_moderate" }, 409],
    [{ action: "transport_book" }, 409],
    [{ action: "arbitrary_rpc" }, 400],
    [{ action: null }, 400]
  ]) {
    const api = await backend();
    const response = await api.request({ body: JSON.stringify(input) });
    assert.equal(response.status, expected);
    assert.equal(typeof (await response.json()).error, "string");
    assert.deepEqual(api.events.map(event => event.type), ["client", "auth", "table", "admin"]);
  }
  const options = {};
  const api = await backend(options);
  const body = JSON.stringify({ action: "transport_snapshot" });
  assert.equal((await api.request({ body })).status, 200);
  options.nonAdmin = true;
  assert.equal((await api.request({ body })).status, 403);
  assert.equal(api.events.filter(event => event.type === "admin").length, 2);
  assert.ok(!api.events.some(event => event.type === "wantok"));
});

test("verified transport uses bounded fixed RPC parameters and rejects wrong contracts", async () => {
  const { presetRange } = (await loadModule("supabase/functions/shared/wantok-platform.js")).module;
  const range = presetRange(7);
  const source = transportFixture(range);
  source.passenger_data = ["private"];
  const api = await backend({ env: { WANTOK_TRANSPORT_VERIFIED: "true", WANTOK_ANALYTICS_VERIFIED: "false" }, payload: source });
  const response = await api.request({ body: JSON.stringify({
    action: "transport_snapshot", date_range: range, operators: { search: "Test", status: "pending" },
    trips: { status: "published" }
  }) });
  assert.equal(response.status, 200);
  const output = await response.json();
  assert.equal(output.transport.passenger_data, undefined);
  assert.equal(output.transport.metrics.seats_reserved, 4);
  const upstream = api.events.at(-1);
  assert.ok(upstream.url.endsWith("/wantok_admin_transport_snapshot_v1"));
  assert.deepEqual(JSON.parse(upstream.settings.body), {
    p_start: range.start, p_end: range.end, p_operator_search: "Test", p_operator_status: "pending",
    p_operator_page: 0, p_trip_search: "", p_trip_status: "published", p_trip_page: 0
  });
  for (const payload of [currentRecordSnapshot(), { ...source, period: { start: "2000-01-01", end: "2000-01-01" } }]) {
    const invalid = await backend({ env: { WANTOK_TRANSPORT_VERIFIED: "true" }, payload });
    assert.equal((await invalid.request({ body: JSON.stringify({ action: "transport_snapshot", date_range: range }) })).status, 503);
  }
});

test("transport decisions derive audit actor only from verified Jstaroma authentication", async () => {
  const input = {
    action: "transport_decide", kind: "operator", target_id: "00000000-0000-0000-0000-000000000001",
    expected_status: "pending", expected_updated_at: "2026-11-11T12:00:00+00:00",
    status: "approved", reason: "Application verified"
  };
  const user = { id: "verified-admin-id", email: "admin@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z" };
  const options = { env: { WANTOK_TRANSPORT_VERIFIED: "true" }, user, payload: { version: 1, status: "saved" } };
  const api = await backend(options);
  const response = await api.request({ body: JSON.stringify(input) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { version: 1, status: "saved" });
  const upstream = api.events.at(-1);
  assert.ok(upstream.url.endsWith("/wantok_admin_transport_decide_v1"));
  assert.deepEqual(JSON.parse(upstream.settings.body), {
    p_actor_id: user.id, p_actor_email: user.email, p_kind: "operator", p_target_id: input.target_id,
    p_expected_status: "pending", p_expected_updated_at: input.expected_updated_at,
    p_status: "approved", p_reason: "Application verified"
  });
  for (const override of [
    { nonAdmin: true }, { invalidToken: true }, { user: { id: user.id } },
    { user: { ...user, email_confirmed_at: null } }, { env: { WANTOK_TRANSPORT_VERIFIED: "false" } }
  ]) {
    const denied = await backend({ ...options, ...override });
    assert.ok((await denied.request({ body: JSON.stringify(input) })).status >= 400);
    assert.ok(!denied.events.some(event => event.type === "wantok"));
  }
  for (const extra of [{ actor_id: "forged" }, { actor_email: "forged@example.invalid" }, { rpc: "other" }]) {
    const denied = await backend(options);
    assert.equal((await denied.request({ body: JSON.stringify({ ...input, ...extra }) })).status, 400);
    assert.ok(!denied.events.some(event => event.type === "wantok"));
  }
  for (const code of [400, 403, 409, 500]) {
    const failed = await backend({ ...options, upstreamStatus: code });
    const response = await failed.request({ body: JSON.stringify(input) });
    assert.equal(response.status, code === 500 ? 503 : code);
    assert.match((await response.json()).error, /Decision not confirmed/);
  }
});

test("every request rechecks membership, including when Wantok is not enabled", async () => {
  const api = await backend({ env: { WANTOK_ANALYTICS_VERIFIED: "false" } });
  for (let index = 0; index < 2; index++) {
    const response = await api.request();
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(Object.values(data.metrics).every(value => value === null));
    assert.equal(data.growth, null);
    assert.equal(data.retention, null);
    assert.equal(data.generated_at, null);
  }
  assert.equal(api.events.filter(event => event.type === "admin").length, 2);
  assert.ok(!api.events.some(event => event.type === "wantok"));
  const denied = await backend({ nonAdmin: true, env: { WANTOK_ANALYTICS_VERIFIED: undefined } });
  assert.equal((await denied.request()).status, 403);
  const options = {};
  const revocable = await backend(options);
  assert.equal((await revocable.request()).status, 200);
  options.nonAdmin = true;
  assert.equal((await revocable.request()).status, 403);
  assert.equal(revocable.events.filter(event => event.type === "wantok").length, 1);
});

test("CORS, preflight and methods are restricted; CORS is not needed for token enforcement", async () => {
  const api = await backend();
  assert.equal((await api.request({ headers: { Origin: "https://attacker.example" } })).status, 403);
  const preflight = await api.request({ method: "OPTIONS", headers: { Authorization: null } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal((await api.request({ method: "GET" })).status, 405);
  assert.equal(api.events.length, 0);
  assert.equal((await api.request({ headers: { Origin: null, Authorization: null } })).status, 401);
  const unconfigured = await backend({ env: { ANALYTICS_ALLOWED_ORIGINS: "" } });
  assert.equal((await unconfigured.request()).status, 503);
  assert.equal(unconfigured.events.length, 0);
});

test("missing server settings, same projects and unsafe URLs fail closed", async () => {
  for (const env of [
    { SUPABASE_SERVICE_ROLE_KEY: "" },
    { SUPABASE_URL: "https://patrtlxmcjrzzfvvfcft.supabase.co" },
    { SUPABASE_URL: "https://unverified.supabase.co" },
    { WANTOK_SUPABASE_URL: "" },
    { WANTOK_ANALYTICS_KEY: "" },
    { WANTOK_SUPABASE_URL: "https://fticsjeytmepljtkfrvm.supabase.co/" },
    { WANTOK_SUPABASE_URL: "https://unverified.supabase.co" },
    { WANTOK_SUPABASE_URL: "https://patrtlxmcjrzzfvvfcft.supabase.co:444" },
    { WANTOK_SUPABASE_URL: "http://wantok.supabase.co" },
    { WANTOK_SUPABASE_URL: "https://user:password@wantok.supabase.co" },
    { WANTOK_SUPABASE_URL: "https://wantok.supabase.co/other" }
  ]) {
    const api = await backend({ env });
    assert.equal((await api.request()).status, 503);
    assert.ok(!api.events.some(event => event.type === "wantok"));
  }
});

test("new Supabase server secret keys are sent as apikey, not as JWT bearer tokens", async () => {
  const api = await backend({ env: { WANTOK_ANALYTICS_KEY: "sb_secret_test-only" } });
  assert.equal((await api.request()).status, 200);
  const headers = api.events.at(-1).settings.headers;
  assert.equal(headers.apikey, "sb_secret_test-only");
  assert.equal(headers.Authorization, undefined);
});

test("upstream errors, malformed aggregates and network failures are explicit and redact details", async () => {
  for (const options of [
    { upstreamStatus: 401 },
    { networkError: true },
    { payload: { users: [{ email: "private@example.test" }] } }
  ]) {
    const api = await backend(options);
    const response = await api.request();
    assert.equal(response.status, 503);
    assert.ok((await response.json()).error);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const logs = JSON.stringify(api.errors);
    assert.ok(!logs.includes("private@example") && !logs.includes("test-wantok-jwt") &&
      !logs.includes("Private upstream details"));
  }
});

test("contract rejects invalid metrics, missing sources, malformed periods, daily gaps and impossible retention", async () => {
  const { module } = await loadModule("supabase/functions/shared/wantok-chat-contract.js");
  assert.deepEqual(JSON.parse(JSON.stringify(module.validateSnapshot(module.disconnectedSnapshot()))),
    JSON.parse(JSON.stringify(module.disconnectedSnapshot())));
  for (const mutate of [
    data => { data.version = 2; },
    data => { delete data.metrics.calls; },
    data => { data.metrics.dau = -1; },
    data => { data.metrics.dau = "20"; },
    data => { data.metrics.dau = 1.5; },
    data => { data.metrics.dau = Number.MAX_SAFE_INTEGER + 1; },
    data => { data.generated_at = null; },
    data => { data.generated_at = "not a date"; },
    data => { data.generated_at = "2026-11-07T12:00:00Z"; },
    data => { data.generated_at = "2026-11-09T12:00:00Z"; },
    data => { data.generated_at = "2026-11-08T24:00:00Z"; },
    data => { data.period.start = "2026-10-10"; },
    data => { data.period.start = "2026-02-30"; },
    data => { data.growth = []; },
    data => { data.growth.pop(); },
    data => { data.growth[1].date = data.growth[0].date; },
    data => { data.growth[0].dau = null; },
    data => { data.retention = []; },
    data => { data.retention[0].day = 7; },
    data => { data.retention[0].returning_users = 11; }
  ]) {
    const data = snapshot();
    mutate(data);
    assert.throws(() => module.validateSnapshot(data), /Invalid Wantok/);
  }
});

test("only whitelisted aggregates reach the browser; verified nulls remain null", async () => {
  const payload = currentRecordSnapshot();
  payload.users = [{ email: "private@example.test" }];
  payload.secret_key = "not-for-browser";
  payload.metrics.raw_messages = ["private message"];
  payload.period.user_id = "private-user";
  const api = await backend({ payload });
  const response = await api.request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), currentRecordSnapshot());
});

test("backend refuses legacy activity snapshots and current-record responses with invented activity", async () => {
  const inputs = [
    snapshot(),
    { ...currentRecordSnapshot(), metric_scope: "period" },
    { ...currentRecordSnapshot(), metrics: { ...currentRecordSnapshot().metrics, mau: 12 } },
    { ...currentRecordSnapshot(), metrics: { ...currentRecordSnapshot().metrics, dau: 0 } },
    { ...currentRecordSnapshot(), growth: snapshot().growth },
    { ...currentRecordSnapshot(), retention: snapshot().retention }
  ];
  for (const payload of inputs) {
    const api = await backend({ payload });
    assert.equal((await api.request()).status, 503);
  }
});

async function rangedSnapshot() {
  const { module } = await loadModule("supabase/functions/shared/wantok-platform.js");
  const period = { ...module.presetRange(7) };
  return {
    ...currentRecordSnapshot(), version: 3, period,
    platform: {
      metrics: Object.fromEntries(module.PLATFORM_METRICS.map(([key]) => [
        key, module.CONNECTED_PLATFORM_KEYS.includes(key) ? 0 : null
      ])),
      series: Object.fromEntries(["registrations", "messages", "calls"].map(key => [
        key, Array.from({ length: 7 }, (_, index) => ({
          date: new Date(Date.parse(period.start) + index * 86400000).toISOString().slice(0, 10), count: 0
        }))
      ])),
      geography: { countries: null, provinces: null }, devices: null
    },
    generated_at: new Date().toISOString()
  };
}

test("bounded date filters forward whitelisted dates and report province RPC failures separately", async () => {
  const payload = await rangedSnapshot();
  const api = await backend({ payload });
  const response = await api.request({ body: JSON.stringify({
    date_range: payload.period, table: "profiles", credentials: "ignored"
  }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.platform.geography.provinces, { status: "error" });
  result.platform.geography.provinces = null;
  assert.deepEqual(result, payload);
  const upstream = api.events.find(event => event.url?.endsWith("/wantok_admin_analytics_range_v1"));
  assert.equal(upstream.url, "https://patrtlxmcjrzzfvvfcft.supabase.co/rest/v1/rpc/wantok_admin_analytics_range_v1");
  assert.deepEqual(JSON.parse(upstream.settings.body), { p_start: payload.period.start, p_end: payload.period.end });
});

test("province aggregates require admin access, use a fixed RPC and whitelist bucket data", async () => {
  const { module } = await loadModule("supabase/functions/shared/wantok-platform.js");
  const payload = await rangedSnapshot();
  const provinceCounts = {
    "Jiwaka Province": 10, "Eastern Highlands Province": 5, "Manus Province": 4,
    "Southern Highlands Province": 2, "Morobe Province": 2, "Enga Province": 2,
    "Western Highlands Province": 1, "Gulf Province": 1, "Madang Province": 1,
    "National Capital District": 1, "Western Province": 1, "East Sepik Province": 1,
    "Unknown / Not Set": 21
  };
  const provinces = { rows: module.PNG_PROVINCES.map(name => ({
    name, count: provinceCounts[name] ?? 0, privateField: "not forwarded"
  })) };
  const api = await backend({ payload, provinces });
  const response = await api.request({ body: JSON.stringify({ date_range: payload.period }) });
  const result = await response.json();
  assert.equal(result.platform.geography.provinces.total, 52);
  assert.equal(result.platform.geography.provinces.rows.length, 23);
  assert.equal(result.platform.geography.provinces.rows.find(row => row.name === "Jiwaka Province").count, 10);
  assert.ok(result.platform.geography.provinces.rows.every(row => !Object.hasOwn(row, "privateField")));
  const calls = api.events.filter(event => event.type === "wantok");
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /\/wantok_admin_province_counts_v1$/);
  assert.equal(calls[1].settings.body, "{}");
  const forbidden = await backend({ nonAdmin: true, payload, provinces });
  assert.equal((await forbidden.request({ body: JSON.stringify({ date_range: payload.period }) })).status, 403);
  assert.ok(!forbidden.events.some(event => event.type === "wantok"));
  const invalid = await backend({ payload, provinces: { rows: [...provinces.rows.slice(1), provinces.rows[1]] } });
  const bad = await invalid.request({ body: JSON.stringify({ date_range: payload.period }) });
  assert.deepEqual((await bad.json()).platform.geography.provinces, { status: "error" });
});

test("invalid ranges/JSON fail explicitly after authorization and never query Wantok", async () => {
  for (const body of [
    "{", "null", "[]", JSON.stringify({ date_range: { start: "2020-01-01", end: "2026-11-07" } }),
    JSON.stringify({ date_range: { start: "2026-02-30", end: "2026-03-01" } }),
    JSON.stringify({ date_range: { start: "2999-01-01", end: "2999-01-02" } }),
    " ".repeat(2049)
  ]) {
    const api = await backend();
    assert.equal((await api.request({ body })).status, 400);
    assert.ok(api.events.some(event => event.type === "admin"));
    assert.ok(!api.events.some(event => event.type === "wantok"));
  }
  const unauthorized = await backend({ nonAdmin: true });
  assert.equal((await unauthorized.request({ body: "{" })).status, 403);
});

test("range mismatch, old deployed SQL and invented provider statistics fail closed", async () => {
  const payload = await rangedSnapshot();
  for (const result of [
    currentRecordSnapshot(),
    { ...payload, period: { ...payload.period, start: payload.period.end } },
    { ...payload, platform: { ...payload.platform, metrics: { ...payload.platform.metrics, revenue: 500 } } }
  ]) {
    const api = await backend({ payload: result });
    assert.equal((await api.request({ body: JSON.stringify({ date_range: payload.period }) })).status, 503);
  }
});

function element(tag = "div") {
  return {
    tag, textContent: "", children: [], attributes: {}, style: {}, disabled: false, listeners: {},
    classList: { add() {}, remove() {} },
    addEventListener(event, listener) { this.listeners[event] = listener; },
    setAttribute(key, value) { this.attributes[key] = value; },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.textContent = ""; this.children = nodes; }
  };
}

async function frontend({ authorized = true, payload = snapshot(), error = null, session = true } = {}) {
  const html = await readFile(path.join(root, "admin/wantok-chat.html"), "utf8");
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, element()]));
  const requests = [];
  const errors = [];
  const documentListeners = {};
  const windowListeners = {};
  const timers = new Map();
  let timerId = 0;
  let elapsed = 0;
  let result = { data: payload, error };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: session ? { access_token: "existing-jstaroma-token" } : null }, error: null })
    },
    functions: {
      invoke: async (...args) => { requests.push(args); return result; }
    }
  };
  const document = {
    visibilityState: "visible",
    addEventListener: (event, listener) => { documentListeners[event] = listener; },
    getElementById: id => elements.get(id),
    createElement: element,
    createElementNS: (namespace, tag) => element(tag)
  };
  const { context } = await loadModule("admin/js/wantok-chat.js", {
    console: { error: (...args) => errors.push(args) },
    document,
    window: {
      addEventListener: (event, listener) => { windowListeners[event] = listener; },
      setInterval(callback, interval) {
        timers.set(++timerId, { callback, interval, next: elapsed + interval });
        return timerId;
      },
      clearInterval: id => timers.delete(id)
    }
  }, {
    "js/supabase.js": { supabase: client },
    "admin/js/admin-auth.js": {
      requireAdmin: async () => authorized ? { id: "admin" } : null,
      logoutAdmin() {}
    },
    "admin/js/wantok-platform-ui.js": {
      initializePlatform: async () => {},
      renderPlatform() {},
      getDateRange: () => null
    },
    "admin/js/wantok-transport.js": {
      initializeTransport: async () => {}
    }
  }, (source, filename) => filename.endsWith("/wantok-chat.js")
    ? source.replace("\ninitialize();", "\nglobalThis.drawTestChart = renderChart;\nglobalThis.ready = initialize();") : source);
  await context.ready;
  return {
    elements, requests, errors, timers, document, documentListeners, windowListeners,
    drawChart: context.drawTestChart, setResult: value => { result = value; },
    async advance(milliseconds) {
      elapsed += milliseconds;
      for (const timer of timers.values()) {
        if (timer.next <= elapsed) {
          timer.next += timer.interval;
          await timer.callback();
        }
      }
    }
  };
}

test("page uses existing authentication and never requests analytics when unauthorized", async () => {
  const page = await frontend({ authorized: false });
  assert.equal(page.requests.length, 0);
  assert.equal(page.timers.size, 0);
  await page.documentListeners.visibilitychange();
  await page.windowListeners.pageshow({ persisted: true });
  await page.advance(60000);
  assert.equal(page.requests.length, 0);
  assert.equal(page.timers.size, 0);
});

test("analytics refreshes at 60 seconds, resumes on visibility and stops on page exit or logout", async () => {
  const page = await frontend();
  assert.equal(page.requests.length, 1);
  assert.equal(page.timers.size, 1);
  await page.advance(59999);
  assert.equal(page.requests.length, 1);
  await page.advance(1);
  assert.equal(page.requests.length, 2);
  page.document.visibilityState = "hidden";
  await page.documentListeners.visibilitychange();
  assert.equal(page.timers.size, 0);
  await page.advance(60000);
  assert.equal(page.requests.length, 2);
  page.document.visibilityState = "visible";
  await page.documentListeners.visibilitychange();
  assert.equal(page.requests.length, 3);
  assert.equal(page.timers.size, 1);
  page.windowListeners.pagehide();
  assert.equal(page.timers.size, 0);
  await page.advance(60000);
  assert.equal(page.requests.length, 3);
  await page.windowListeners.pageshow({ persisted: true });
  assert.equal(page.requests.length, 4);
  assert.equal(page.timers.size, 1);
  page.elements.get("logoutBtn").listeners.click();
  assert.equal(page.timers.size, 0);
  await page.documentListeners.visibilitychange();
  assert.equal(page.requests.length, 4);
});

test("polling, manual and tab-reactivation refreshes never overlap and recover after errors", async () => {
  const page = await frontend();
  let release;
  page.setResult(new Promise(resolve => { release = resolve; }));
  const active = page.elements.get("refreshAnalytics").listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.requests.length, 2);
  await page.advance(60000);
  await page.documentListeners.visibilitychange();
  await page.elements.get("refreshAnalytics").listeners.click();
  assert.equal(page.requests.length, 2);
  release({ data: null, error: new Error("Unavailable") });
  await active;
  page.setResult({ data: snapshot(), error: null });
  await page.advance(60000);
  assert.equal(page.requests.length, 3);
  assert.equal(page.elements.get("registered_users").textContent, "100");
});

test("current-record totals render without period/completed-call claims or app activity metrics", async () => {
  const page = await frontend({ payload: currentRecordSnapshot() });
  assert.equal(page.elements.get("registered_users").textContent, "100");
  assert.equal(page.elements.get("messages").textContent, "200");
  assert.equal(page.elements.get("calls").textContent, "0");
  for (const id of ["mau", "dau", "registeredGrowth", "activeGrowth", "retentionStatus"]) {
    assert.equal(page.elements.get(id).textContent, "Not connected");
  }
  assert.match(page.elements.get("messagesDescription").textContent, /excluding call-type and deleted-for-everyone/);
  assert.match(page.elements.get("callsDescription").textContent, /not completed calls/);
  assert.match(page.elements.get("analyticsPeriod").textContent, /not window-limited activity/);
  assert.match(page.elements.get("activityTrackingStatus").textContent, /Chat-message activity is not app activity/);
  assert.equal(page.errors.length, 0);
});

test("page renders real counts, verified zeros, null metrics, 30 chart points and retention rates", async () => {
  const page = await frontend();
  assert.equal(page.requests[0][0], "wantok-chat-analytics");
  assert.equal(page.requests[0][1].headers.Authorization, "Bearer existing-jstaroma-token");
  assert.equal(page.elements.get("registered_users").textContent, "100");
  assert.equal(page.elements.get("dau").textContent, "0");
  assert.equal(page.elements.get("calls").textContent, "Not connected");
  assert.equal(page.elements.get("connectionLabel").textContent, "Verified aggregate source");
  const chart = page.elements.get("registeredGrowth").children[0];
  assert.equal(chart.tag, "svg");
  assert.equal(chart.children.filter(child => child.tag === "circle").length, 30);
  assert.equal(page.elements.get("registeredGrowth").children[1].tag, "details");
  const rows = page.elements.get("retentionRows").children;
  assert.equal(rows[0].children[3].textContent, "50%");
  assert.equal(rows[1].children[3].textContent, "No eligible users");
  assert.equal(page.errors.length, 0);
});

test("disconnected source displays no invented metrics, charts or retention", async () => {
  const { module } = await loadModule("supabase/functions/shared/wantok-chat-contract.js");
  const page = await frontend({ payload: module.disconnectedSnapshot() });
  for (const id of [...module.METRIC_KEYS, "registeredGrowth", "activeGrowth", "retentionStatus"]) {
    assert.equal(page.elements.get(id).textContent, "Not connected");
  }
  assert.equal(page.errors.length, 0);
});

test("growth selector switches line, pie and bar without refetching or changing retention tables", async () => {
  const page = await frontend();
  const selector = page.elements.get("growthChartType");
  const chart = id => page.elements.get(id).children[0];
  const shapes = (id, tag) => {
    const root = chart(id).tag === "svg" ? chart(id) : chart(id).children[0];
    return root.children.filter(child => child.tag === tag &&
      !(tag === "rect" && child.attributes.fill === "transparent"));
  };
  assert.equal(shapes("registeredGrowth", "polyline").length, 1);
  assert.equal(shapes("retentionChart", "circle").length, 2);
  selector.value = "bar";
  selector.listeners.change();
  assert.equal(shapes("registeredGrowth", "rect").length, 30);
  assert.equal(shapes("registeredGrowth", "polyline").length, 0);
  assert.equal(shapes("activeGrowth", "rect").length, 30);
  const bars = shapes("retentionChart", "rect");
  assert.equal(bars.length, 2);
  assert.equal(Number(bars[0].attributes.height), 72.5);
  assert.equal(Number(bars[1].attributes.height), 72.5);
  selector.value = "pie";
  selector.listeners.change();
  assert.equal(shapes("registeredGrowth", "path").length, 30);
  assert.equal(shapes("registeredGrowth", "polyline").length, 0);
  const cohorts = chart("retentionChart").children;
  assert.equal(cohorts.length, 3);
  const firstPie = cohorts[0].children[2].children[0];
  const slices = firstPie.children.filter(child => child.tag === "path");
  assert.equal(slices.length, 2);
  assert.match(slices[0].children[0].textContent, /Returned: 5 \(50%\)/);
  assert.match(slices[1].children[0].textContent, /Not returned: 5 \(50%\)/);
  assert.equal(cohorts[1].children[1].textContent, "No eligible users");
  assert.equal(cohorts[1].children.length, 2);
  assert.equal(page.elements.get("retentionRows").children[0].children[3].textContent, "50%");
  selector.value = "line";
  selector.listeners.change();
  assert.equal(shapes("registeredGrowth", "polyline").length, 1);
  assert.equal(page.requests.length, 1);
  assert.equal(page.errors.length, 0);
});

test("growth chart modes handle verified zeros, a full pie, unavailable data and non-growth charts", async () => {
  const page = await frontend({ payload: currentRecordSnapshot() });
  const selector = page.elements.get("growthChartType");
  selector.value = "pie";
  selector.listeners.change();
  assert.equal(page.elements.get("registeredGrowth").textContent, "Not connected");
  assert.equal(page.elements.get("retentionChart").textContent, "Not connected");
  page.drawChart("registrationChart", [{ date: "2026-11-01", count: 0 }], "count", "Registrations");
  let svg = page.elements.get("registrationChart").children[0].children[0];
  assert.equal(svg.children.filter(child => child.tag === "path" || child.tag === "circle").length, 0);
  assert.match(svg.children[0].textContent, /Verified zero/);
  page.drawChart("registrationChart", [{ date: "2026-11-01", count: 10 }], "count", "Registrations");
  const pie = page.elements.get("registrationChart").children[0];
  svg = pie.children[0];
  assert.equal(svg.children.filter(child => child.tag === "circle").length, 1);
  assert.match(svg.children[0].children[0].textContent, /Registrations\n2026-11-01: 10 \(100%\)/);
  assert.equal(pie.children[1].children[0].children[1].textContent, "2026-11-01: 10 (100%)");
  page.drawChart("messageTrend", [{ date: "2026-11-01", count: 10 }], "count", "Messages");
  assert.equal(page.elements.get("messageTrend").children[0].children.filter(child => child.tag === "polyline").length, 1);
  selector.value = "bar";
  page.drawChart("registrationChart", [{ date: "2026-11-01", count: 0 }], "count", "Registrations");
  const bar = page.elements.get("registrationChart").children[0].children.find(child => child.tag === "rect");
  assert.equal(Number(bar.attributes.height), 0);
  assert.ok(Number(bar.attributes.width) > 0);
  assert.equal(page.errors.length, 0);
});

test("retention pies distinguish all-returned, none-returned and no-eligible cohorts", async () => {
  const payload = snapshot();
  payload.retention[0].returning_users = payload.retention[0].eligible_users;
  payload.retention[2].returning_users = 0;
  const page = await frontend({ payload });
  page.elements.get("growthChartType").value = "pie";
  page.elements.get("growthChartType").listeners.change();
  const cohorts = page.elements.get("retentionChart").children[0].children;
  assert.match(cohorts[0].children[2].children[0].children[0].children[0].textContent, /Returned: 10 \(100%\)/);
  assert.match(cohorts[2].children[2].children[0].children[0].children[0].textContent, /Not returned: 2 \(100%\)/);
  page.setResult({ data: null, error: new Error("Unavailable") });
  await page.elements.get("refreshAnalytics").listeners.click();
  assert.equal(page.elements.get("retentionChart").textContent, "Not connected");
  page.elements.get("growthChartType").listeners.change();
  assert.equal(page.elements.get("retentionChart").textContent, "Not connected");
});

test("session, backend and validation failures clear values and display an error; refresh recovers", async () => {
  for (const options of [
    { session: false }, { error: new Error("Unavailable") }, { payload: { invalid: true } }
  ]) {
    const page = await frontend(options);
    assert.equal(page.elements.get("registered_users").textContent, "Not connected");
    assert.match(page.elements.get("analyticsStatus").textContent, /Could not load analytics/);
    assert.equal(page.errors.length, 1);
  }
  const page = await frontend();
  page.setResult({ data: null, error: new Error("Upstream unavailable") });
  await page.elements.get("refreshAnalytics").listeners.click();
  assert.equal(page.elements.get("registered_users").textContent, "Not connected");
  assert.equal(page.elements.get("registeredGrowth").children.length, 0);
  assert.equal(page.elements.get("refreshAnalytics").disabled, false);
  page.setResult({ data: snapshot(), error: null });
  await page.elements.get("refreshAnalytics").listeners.click();
  assert.equal(page.elements.get("registered_users").textContent, "100");
});

test("frontend distinguishes HTTP errors from invalid successful responses without exposing payloads", async () => {
  for (const [status, reason] of [
    [400, /date filter/], [401, /missing or expired/], [403, /access.*denied/],
    [404, /endpoint was not found/], [500, /backend failed/], [503, /source is unavailable/]
  ]) {
    const error = new Error("Private upstream message must not be displayed");
    error.context = new Response('{"private":"must not be displayed"}', { status });
    const page = await frontend({ error });
    const text = page.elements.get("analyticsStatus").textContent;
    assert.match(text, new RegExp(`HTTP ${status}`));
    assert.match(text, reason);
    assert.ok(!text.includes("Private upstream"));
    assert.equal(page.elements.get("registered_users").textContent, "Not connected");
  }
  const page = await frontend({ payload: { invalid: true } });
  assert.match(page.elements.get("analyticsStatus").textContent, /data failed validation/);
});

test("all existing admin pages link to Wantok Chat and its static dependencies exist", async () => {
  for (const page of ["dashboard", "projects", "products", "achievements", "wantok-chat"]) {
    const html = await readFile(path.join(root, `admin/${page}.html`), "utf8");
    assert.match(html, /href="wantok-chat.html"/);
  }
  const html = await readFile(path.join(root, "admin/wantok-chat.html"), "utf8");
  for (const [, relativePath] of html.matchAll(/(?:href|src)="((?:css|js)\/[^"]+)"/g)) {
    assert.ok((await readFile(path.join(root, "admin", relativePath.split(/[?#]/)[0]))).length);
  }
  const script = await readFile(path.join(root, "admin/js/wantok-chat.js"), "utf8");
  assert.ok(!/sb_secret_|service_role|WANTOK_ANALYTICS_KEY/.test(script));
  assert.match(html, /aria-current="page"/);
});
