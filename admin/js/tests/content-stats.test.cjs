const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const adminRoot = path.resolve(__dirname, "../..");

function createClient(tables, options = {}) {
  const requests = [];
  return {
    requests,
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "admin" } } } })
    },
    from(table) {
      const request = { table };
      requests.push(request);
      const query = {
        select(columns, settings) {
          Object.assign(request, { columns, ...settings });
          return query;
        },
        eq(column, value) {
          request.filter = { column, value };
          return query;
        },
        order(column, settings) {
          (request.orders ||= []).push({ column, ...settings });
          return query;
        },
        range(start, end) {
          Object.assign(request, { start, end });
          return query;
        },
        then(resolve, reject) {
          let rows = tables[table] || [];
          if (request.filter) {
            rows = rows.filter(row =>
              row[request.filter.column] === request.filter.value);
          }
          const error = options.fail?.(request);
          const count = request.count === "exact" && !options.missingCount ? rows.length : null;
          const start = request.start || 0;
          const limit = options.limit || 1000;
          const data = request.head ? null : options.emptyPage?.(request) ? [] :
            rows.slice(start, Math.min((request.end ?? 999) + 1, start + limit));
          return Promise.resolve({ data, count, error }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

function createElement() {
  return {
    value: "",
    textContent: "",
    children: [],
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.children = []; }
  };
}

async function loadPage(page, client, authorized = true) {
  const html = await readFile(path.join(adminRoot, `${page}.html`), "utf8");
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)]
    .map(([, id]) => [id, createElement()]));
  for (const id of ["categoryFilter", "statusFilter", "achievementTypeFilter"]) {
    if (elements.has(id)) elements.get(id).value = "All";
  }
  const errors = [];
  const context = vm.createContext({
    console: { log() {}, error(...args) { errors.push(args); } },
    document: {
      getElementById: id => elements.get(id) || null,
      createElement,
      addEventListener() {}
    }
  });
  const modules = new Map();
  async function getModule(filename) {
    if (modules.has(filename)) return modules.get(filename);
    let module;
    if (filename.endsWith("/supabase.js")) {
      module = new vm.SyntheticModule(["supabase"], function () {
        this.setExport("supabase", client);
      }, { context, identifier: filename });
    }
    else if (filename.endsWith("/admin-auth.js")) {
      module = new vm.SyntheticModule(["requireAdmin", "logoutAdmin"], function () {
        this.setExport("requireAdmin", async () => authorized ? { id: "admin" } : null);
        this.setExport("logoutAdmin", () => {});
      }, { context, identifier: filename });
    }
    else {
      let source = await readFile(filename, "utf8");
      if (filename.endsWith(`/${page}.js`)) {
        source = source.replace(
          page === "dashboard" ? "\ninit();" : "\ninitialize();",
          `\nglobalThis.ready = ${page === "dashboard" ? "init" : "initialize"}();`
        );
        if (page !== "dashboard") {
          source += page === "products"
            ? "\nexport { loadProducts as reload, filterProducts as filter };"
            : "\nexport { loadAchievements as reload, filterAchievements as filter };";
        }
      }
      module = new vm.SourceTextModule(source, {
        context,
        identifier: filename,
        importModuleDynamically: async (specifier, parent) => {
          const dependency = await getModule(path.resolve(path.dirname(parent.identifier), specifier));
          if (dependency.status === "unlinked") await dependency.link(linker);
          if (dependency.status === "linked") await dependency.evaluate();
          return dependency;
        }
      });
    }
    modules.set(filename, module);
    return module;
  }
  const linker = (specifier, parent) =>
    getModule(path.resolve(path.dirname(parent.identifier), specifier));
  const module = await getModule(path.join(adminRoot, "js", `${page}.js`));
  await module.link(linker);
  await module.evaluate();
  await context.ready;
  return { elements, errors, module };
}

function records(total) {
  return Array.from({ length: total }, (_, id) => ({
    id,
    name: `Product ${id}`,
    title: `Achievement ${id}`,
    published: [true, false, null][id % 3],
    featured: id % 2 === 0
  }));
}

function assertStats(elements, ids, expected) {
  assert.deepEqual(ids.map(id => String(elements.get(id).textContent)), expected.map(String));
}

test("dashboard loads all three tables with exact counts, including more than 1000 records", async () => {
  const client = createClient({
    projects: records(4),
    achievements: records(1205),
    products: records(7)
  });
  const { elements, errors } = await loadPage("dashboard", client);
  assertStats(elements, ["totalProjects", "publishedProjects", "draftProjects"], [4, 2, 2]);
  assertStats(elements, ["totalAchievements", "publishedAchievements", "draftAchievements"], [1205, 402, 803]);
  assertStats(elements, ["totalProducts", "publishedProducts", "draftProducts"], [7, 3, 4]);
  assert.equal(errors.length, 0);
  assert.equal(client.requests.length, 6);
  assert.ok(client.requests.every(query => query.head && query.count === "exact"));
});

test("dashboard shows genuine empty tables as zero", async () => {
  const { elements } = await loadPage("dashboard", createClient({}));
  for (const suffix of ["Projects", "Achievements", "Products"]) {
    assertStats(elements, [`total${suffix}`, `published${suffix}`, `draft${suffix}`], [0, 0, 0]);
  }
});

test("dashboard isolates count failures and never presents them as zero", async () => {
  const client = createClient({ projects: records(2), products: records(3) }, {
    fail: query => query.table === "achievements" && query.filter ? new Error("Database unavailable") : null
  });
  const { elements, errors } = await loadPage("dashboard", client);
  assertStats(elements, ["totalAchievements", "publishedAchievements", "draftAchievements"], ["Error", "Error", "Error"]);
  assert.equal(elements.get("achievementsStatsStatus").hidden, false);
  assert.match(elements.get("achievementsStatsStatus").textContent, /Could not load achievements/);
  assertStats(elements, ["totalProducts", "publishedProducts", "draftProducts"], [3, 1, 2]);
  assert.equal(errors.length, 1);
});

test("missing exact counts are reported as errors", async () => {
  const { elements, errors } = await loadPage("dashboard", createClient({}, { missingCount: true }));
  assert.equal(elements.get("totalProducts").textContent, "Error");
  assert.equal(errors.length, 3);
});

test("dashboard does not query content before admin authorization", async () => {
  const client = createClient({});
  await loadPage("dashboard", client, false);
  assert.equal(client.requests.length, 0);
});

for (const page of ["products", "achievements"]) {
  const ids = page === "products"
    ? ["totalProducts", "publishedProducts", "draftProducts"]
    : ["achievementTotal", "achievementPublishedCount", "achievementDrafts"];
  const statusId = page === "products" ? "productsStatus" : "achievementStatus";
  const searchId = page === "products" ? "productSearch" : "achievementSearch";

  test(`${page} management counts all pages, preserves counts when filtering, and refreshes after changes`, async () => {
    const tables = { [page]: records(1205) };
    const client = createClient(tables, { limit: 400 });
    const { elements, errors, module } = await loadPage(page, client);
    assertStats(elements, ids, [1205, 402, 803]);
    if (page === "products") {
      assert.equal(String(elements.get("featuredProducts").textContent), "603");
    }
    assert.equal(errors.length, 0);
    assert.deepEqual(client.requests.map(query => query.start), [0, 400, 800, 1200]);
    assert.ok(client.requests.every(query =>
      query.count === "exact" && query.orders.at(-1).column === "id"));
    elements.get(searchId).value = "no matching content";
    module.namespace.filter();
    assertStats(elements, ids, [1205, 402, 803]);
    tables[page] = [{ id: 1, published: false }];
    await module.namespace.reload();
    assertStats(elements, ids, [1, 0, 1]);
    tables[page] = [];
    await module.namespace.reload();
    assertStats(elements, ids, [0, 0, 0]);
  });

  test(`${page} management reports a later-page failure instead of partial totals`, async () => {
    const client = createClient({ [page]: records(1205) }, {
      fail: query => query.start > 0 ? new Error("Later page failed") : null
    });
    const { elements, errors } = await loadPage(page, client);
    assertStats(elements, ids, ["Error", "Error", "Error"]);
    assert.match(elements.get(statusId).textContent, /Later page failed/);
    assert.equal(errors.length, 1);
  });

  test(`${page} management reports an unexpectedly empty page instead of incomplete totals`, async () => {
    const client = createClient({ [page]: records(1205) }, {
      emptyPage: query => query.start > 0
    });
    const { elements, errors } = await loadPage(page, client);
    assertStats(elements, ids, ["Error", "Error", "Error"]);
    assert.match(elements.get(statusId).textContent, /before all rows were returned/);
    assert.equal(errors.length, 1);
  });
}
