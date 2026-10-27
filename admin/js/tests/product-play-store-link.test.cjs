const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../../..");
const playStoreUrl = "https://play.google.com/store/apps/details?id=com.example.app";

function createElement() {
  const listeners = new Map();
  const element = {
    value: "",
    checked: false,
    disabled: false,
    textContent: "",
    children: [],
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type, event) { return listeners.get(type)?.(event); },
    setAttribute(name, value) { this[name] = value; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    get childElementCount() { return this.children.length; },
    set innerHTML(value) {
      this.children = [];
      this._innerHTML = value;
    },
    get innerHTML() { return this._innerHTML || ""; }
  };
  return element;
}

function createClient() {
  const writes = [];
  return {
    writes,
    from(table) {
      assert.equal(table, "products");
      const query = {
        select() { return query; },
        order() { return query; },
        update(payload) {
          writes.push({ operation: "update", payload });
          return query;
        },
        insert(payload) {
          writes.push({ operation: "insert", payload: payload[0] });
          return query;
        },
        eq(column, value) {
          query.filter = { column, value };
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

async function loadAdmin(client) {
  const html = await readFile(path.join(root, "admin/products.html"), "utf8");
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)]
    .map(([, id]) => [id, createElement()]));
  for (const id of ["categoryFilter", "statusFilter"]) {
    elements.get(id).value = "All";
  }
  elements.get("productForm").reset = () => {
    for (const element of elements.values()) {
      element.value = "";
      element.checked = false;
    }
  };
  const errors = [];
  const context = vm.createContext({
    console: { log() {}, error(...args) { errors.push(args); } },
    document: {
      getElementById: id => elements.get(id) || null,
      createElement,
      addEventListener() {},
      body: createElement()
    },
    testSupabase: client,
    URL
  });
  let source = await readFile(path.join(root, "admin/js/products.js"), "utf8");
  source = source.replace("\ninitialize();", "\n");
  source += "\nsupabase = globalThis.testSupabase; export { openEditProduct, saveProduct };";
  const module = new vm.SourceTextModule(source, {
    context,
    importModuleDynamically: async () => {
      const importedModule = new vm.SyntheticModule(
        ["loadAllRows"],
        function () { this.setExport("loadAllRows", async () => []); },
        { context }
      );
      await importedModule.link(() => {});
      await importedModule.evaluate();
      return importedModule;
    }
  });
  await module.link(() => {});
  await module.evaluate();
  return { elements, errors, api: module.namespace, html };
}

async function loadPublicCard() {
  let source = await readFile(path.join(root, "js/public-products.js"), "utf8");
  source = source.replace("\nloadProducts();", "\n");
  source += "\nexport { createProductCard };";
  const context = vm.createContext({
    console,
    URL,
    Intl,
    document: {
      getElementById: () => createElement(),
      createElement,
      createTextNode: text => ({ textContent: text })
    }
  });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => new vm.SyntheticModule(
    ["supabase"],
    function () { this.setExport("supabase", {}); },
    { context }
  ));
  await module.evaluate();
  return module.namespace.createProductCard;
}

function findByClass(element, className) {
  if (element.className === className) return element;
  for (const child of element.children || []) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

test("admin saves, edits, and clears an optional product Play Store URL", async () => {
  const client = createClient();
  const { elements, errors, api, html } = await loadAdmin(client);
  assert.match(html, /id="productPlayStoreUrl"\s+type="url"/);
  elements.get("productName").value = "Example App";
  elements.get("productCategory").value = "Software";
  elements.get("productPlayStoreUrl").value = ` ${playStoreUrl} `;

  await api.saveProduct({ preventDefault() {} });

  assert.equal(client.writes[0].operation, "insert");
  assert.equal(client.writes[0].payload.play_store_url, playStoreUrl);
  assert.deepEqual(errors, []);

  api.openEditProduct({ id: "app-1", name: "Example App", play_store_url: playStoreUrl });
  assert.equal(elements.get("productPlayStoreUrl").value, playStoreUrl);
});

test("admin rejects insecure product Play Store URLs and keeps the entered value", async () => {
  const client = createClient();
  const { elements, errors, api } = await loadAdmin(client);
  elements.get("productName").value = "Example App";
  elements.get("productCategory").value = "Software";
  elements.get("productPlayStoreUrl").value = "http://play.google.com/app";

  await api.saveProduct({ preventDefault() {} });

  assert.equal(client.writes.length, 0);
  assert.match(elements.get("formStatus").textContent, /must use https/);
  assert.equal(elements.get("productPlayStoreUrl").value, "http://play.google.com/app");
  assert.equal(errors.length, 1);
});

test("published product cards use configured download links and preserve existing fallbacks", async () => {
  const createProductCard = await loadPublicCard();

  const linkedCard = createProductCard({
    name: "Example App",
    category: "Software",
    play_store_url: playStoreUrl
  });
  const download = findByClass(linkedCard, "product-primary-btn");
  assert.equal(download.href, playStoreUrl);
  assert.equal(download.target, "_blank");
  assert.equal(download.rel, "noopener noreferrer");
  assert.match(download.innerHTML, /Download on Google Play/);

  const ordinaryCard = createProductCard({ name: "Other Product" });
  assert.equal(findByClass(ordinaryCard, "product-primary-btn").href, "index.html#contact");

  const wantokCard = createProductCard({ name: "Wantok Chat" });
  const wantokButton = findByClass(wantokCard, "product-primary-btn");
  assert.equal(wantokButton.disabled, true);
  assert.equal(wantokButton.textContent, "Play Store link coming soon");
});
