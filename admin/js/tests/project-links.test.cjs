const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../../..");
const playStoreUrl = "https://play.google.com/store/apps/details?id=com.example.app";

function createElement() {
  const listeners = new Map();
  return {
    value: "",
    checked: false,
    files: [],
    children: [],
    style: {},
    dataset: {},
    classList: { add() {}, remove() {} },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type, event) { return listeners.get(type)?.(event); },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.children = []; },
    get innerHTML() { return this.textContent || ""; },
    focus() {},
    click() { this.clicked = true; },
    remove() { this.removed = true; }
  };
}

async function loadPage(admin, client, globals = {}) {
  const html = await readFile(path.join(root, admin ? "admin/projects.html" : "index.html"), "utf8");
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)]
    .map(([, id]) => [id, createElement()]));
  const errors = [];
  const context = vm.createContext({
    console: { log() {}, warn(...args) { errors.push(args); }, error(...args) { errors.push(args); } },
    document: {
      getElementById: id => elements.get(id) || null,
      createElement,
      querySelectorAll: () => [],
      addEventListener() {},
      body: createElement()
    },
    window: { location: { replace() {} }, scrollTo() {}, confirm: () => true },
    crypto: { randomUUID: () => "unique-id" },
    requestAnimationFrame: callback => callback(),
    ...globals
  });
  if (admin) {
    elements.get("projectForm").reset = () => {
      for (const element of elements.values()) {
        element.value = "";
        element.checked = false;
      }
    };
  }
  const source = await readFile(path.join(root, admin ? "admin/js/projects.js" : "js/public-projects.js"), "utf8");
  const module = new vm.SourceTextModule(source + (admin
    ? "\nexport { loadProjects, editProject, deleteProject };"
    : "\nexport { loadProjects, openProjectModal, setupProjectGrid };"), { context });
  await module.link(() => new vm.SyntheticModule(["supabase"], function () {
    this.setExport("supabase", client);
  }, { context }));
  await module.evaluate();
  return { elements, errors, api: module.namespace, html, body: context.document.body };
}

function createClient(rows = [], failure = null) {
  const writes = [];
  const filters = [];
  return {
    writes,
    filters,
    // Skip automatic admin initialization; tests explicitly load the data.
    auth: { getSession: async () => ({ data: { session: null } }) },
    from(table) {
      assert.equal(table, "projects");
      const query = {
        select() { return query; },
        order() { return query; },
        eq(column, value) {
          filters.push({ column, value });
          return query;
        },
        insert(payload) {
          writes.push({ operation: "insert", payload });
          return query;
        },
        update(payload) {
          writes.push({ operation: "update", payload });
          return query;
        },
        delete() {
          writes.push({ operation: "delete" });
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rows, error: failure }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

function fillProject(elements, url) {
  elements.get("title").value = "App project";
  elements.get("description").value = "An app built by our team.";
  elements.get("category").value = "Programming";
  elements.get("projectUrl").value = "https://example.com";
  elements.get("githubUrl").value = "https://github.com/example/app";
  elements.get("playStoreUrl").value = url;
  elements.get("published").checked = true;
}

function addStorage(client, { uploadError = null, removeError = null } = {}) {
  const operations = [];
  client.storage = {
    from(bucket) {
      return {
        async upload(filePath, file, options) {
          operations.push({ operation: "upload", bucket, filePath, file, options });
          return { error: uploadError };
        },
        getPublicUrl(filePath) {
          return { data: { publicUrl: `https://storage.example/${bucket}/${filePath}` } };
        },
        async remove(paths) {
          operations.push({ operation: "remove", bucket, paths: Array.from(paths) });
          return { error: removeError };
        }
      };
    }
  };
  return operations;
}

const pdf = { name: "Project report.pdf", type: "application/pdf", size: 1024 };

async function submit(elements) {
  await elements.get("projectForm").dispatch("submit", { preventDefault() {} });
}

test("adding a project saves its optional Play Store link and resets the field", async () => {
  const client = createClient();
  const { elements, errors, html } = await loadPage(true, client);
  assert.match(html, /type="url"\s+id="playStoreUrl"/);
  fillProject(elements, `  ${playStoreUrl}  `);
  await submit(elements);
  assert.equal(client.writes.length, 1);
  assert.equal(client.writes[0].operation, "insert");
  const { payload } = client.writes[0];
  assert.equal(payload.play_store_url, playStoreUrl);
  assert.equal(payload.project_url, "https://example.com");
  assert.equal(payload.github_url, "https://github.com/example/app");
  assert.equal(payload.published, true);
  assert.equal(elements.get("playStoreUrl").value, "");
  assert.equal(errors.length, 0);
});

test("projects without a Play Store link remain saveable", async () => {
  const client = createClient();
  const { elements, errors } = await loadPage(true, client);
  fillProject(elements, "");
  await submit(elements);
  assert.equal(client.writes[0].payload.play_store_url, null);
  assert.equal(errors.length, 0);
});

test("editing restores, updates, and clears the Play Store link", async () => {
  const client = createClient([{
    id: "app-1", title: "App", description: "An app", play_store_url: playStoreUrl
  }]);
  const { elements, errors, api } = await loadPage(true, client);
  await api.loadProjects();
  api.editProject("app-1");
  assert.equal(elements.get("playStoreUrl").value, playStoreUrl);
  const updatedUrl = `${playStoreUrl}.updated`;
  elements.get("playStoreUrl").value = updatedUrl;
  await submit(elements);
  assert.equal(client.writes[0].operation, "update");
  assert.equal(client.writes[0].payload.play_store_url, updatedUrl);
  assert.deepEqual(client.filters[0], { column: "id", value: "app-1" });

  api.editProject("app-1");
  elements.get("playStoreUrl").value = "";
  await submit(elements);
  assert.equal(client.writes[1].payload.play_store_url, null);
  assert.equal(errors.length, 0);
});

test("editing a legacy project and cancelling does not retain another project's link", async () => {
  const client = createClient([
    { id: "app-1", play_store_url: playStoreUrl },
    { id: "legacy-1" }
  ]);
  const { elements, api } = await loadPage(true, client);
  await api.loadProjects();
  api.editProject("app-1");
  api.editProject("legacy-1");
  assert.equal(elements.get("playStoreUrl").value, "");
  api.editProject("app-1");
  elements.get("cancelEditBtn").dispatch("click");
  assert.equal(elements.get("playStoreUrl").value, "");
  assert.equal(elements.get("projectId").value, "");
});

test("database save errors are visible and preserve the entered Play Store link", async () => {
  const client = createClient([], new Error("Database unavailable"));
  const { elements, errors } = await loadPage(true, client);
  fillProject(elements, playStoreUrl);
  await submit(elements);
  assert.equal(elements.get("projectMessage").textContent, "Database unavailable");
  assert.equal(elements.get("playStoreUrl").value, playStoreUrl);
  assert.equal(elements.get("saveProjectBtn").disabled, false);
  assert.equal(errors.length, 1);
});

test("PDF and Word uploads save names, paths, URLs and explicit MIME types", async () => {
  for (const file of [
    pdf,
    { name: "Report.doc", type: "application/msword", size: 1024 },
    { name: "Report.docx", type: "", size: 10 * 1024 * 1024 }
  ]) {
    const client = createClient();
    const operations = addStorage(client);
    const { elements, errors } = await loadPage(true, client);
    fillProject(elements, "");
    elements.get("projectDocument").files = [file];
    await submit(elements);
    assert.equal(client.writes.length, 1);
    const payload = client.writes[0].payload;
    assert.equal(payload.document_name, file.name);
    assert.match(payload.document_path, /^projects\/\d+-unique-id\.(pdf|doc|docx)$/);
    assert.equal(payload.document_url, `https://storage.example/project-documents/${payload.document_path}`);
    assert.equal(operations[0].bucket, "project-documents");
    assert.match(operations[0].options.contentType, /^application\//);
    assert.equal(elements.get("currentProjectDocument").textContent, "");
    assert.equal(errors.length, 0);
  }
});

test("invalid, empty and oversized documents never upload or save", async () => {
  for (const file of [
    { ...pdf, name: "bad.exe" },
    { ...pdf, type: "text/html" },
    { ...pdf, size: 0 },
    { ...pdf, size: 10 * 1024 * 1024 + 1 }
  ]) {
    const client = createClient();
    const operations = addStorage(client);
    const { elements } = await loadPage(true, client);
    fillProject(elements, "");
    elements.get("projectDocument").files = [file];
    await submit(elements);
    assert.equal(operations.length, 0);
    assert.equal(client.writes.length, 0);
    assert.match(elements.get("projectMessage").textContent, /Please upload|no larger than 10 MB/);
    assert.equal(elements.get("saveProjectBtn").disabled, false);
  }
});

test("editing preserves, replaces and removes attachments only after a successful save", async () => {
  const project = {
    id: "doc-1", title: "Report", description: "Details",
    document_url: "https://storage.example/old.pdf",
    document_path: "projects/old.pdf", document_name: "Old.pdf"
  };
  const client = createClient([project]);
  const operations = addStorage(client);
  const { elements, api } = await loadPage(true, client);
  await api.loadProjects();
  api.editProject("doc-1");
  assert.equal(elements.get("currentProjectDocument").textContent, "Current document: Old.pdf");
  await submit(elements);
  assert.equal(client.writes[0].payload.document_url, project.document_url);
  assert.equal(operations.length, 0);

  api.editProject("doc-1");
  elements.get("projectDocument").files = [pdf];
  await submit(elements);
  assert.equal(client.writes[1].payload.document_name, pdf.name);
  assert.equal(operations[0].operation, "upload");
  assert.deepEqual(operations[1].paths, [project.document_path]);

  api.editProject("doc-1");
  elements.get("projectDocument").files = [];
  elements.get("removeProjectDocument").checked = true;
  await submit(elements);
  assert.equal(client.writes[2].payload.document_url, null);
  assert.equal(client.writes[2].payload.document_path, null);
  assert.equal(client.writes[2].payload.document_name, null);
  assert.deepEqual(operations[2].paths, [project.document_path]);
  assert.equal(elements.get("removeProjectDocument").checked, false);
});

test("cancelling and switching projects clear file selections and attachment removal", async () => {
  const client = createClient([{ id: "doc-1", document_name: pdf.name }, { id: "legacy" }]);
  const { elements, api } = await loadPage(true, client);
  await api.loadProjects();
  api.editProject("doc-1");
  elements.get("removeProjectDocument").checked = true;
  elements.get("projectDocument").value = "selected.pdf";
  api.editProject("legacy");
  assert.equal(elements.get("projectDocument").value, "");
  assert.equal(elements.get("removeProjectDocument").checked, false);
  assert.equal(elements.get("currentProjectDocument").textContent, "No document attached.");
  elements.get("cancelEditBtn").dispatch("click");
  assert.equal(elements.get("currentProjectDocument").textContent, "");
});

test("upload errors prevent saves and failed saves roll back new files, not existing documents", async () => {
  const client = createClient();
  const operations = addStorage(client, { uploadError: new Error("Upload denied") });
  const { elements } = await loadPage(true, client);
  fillProject(elements, "");
  elements.get("projectDocument").files = [pdf];
  await submit(elements);
  assert.equal(client.writes.length, 0);
  assert.equal(elements.get("projectMessage").textContent, "Upload denied");
  assert.equal(operations.length, 1);

  const failedClient = createClient([], new Error("Save denied"));
  const failedOperations = addStorage(failedClient);
  const failedPage = await loadPage(true, failedClient);
  fillProject(failedPage.elements, "");
  failedPage.elements.get("projectDocument").files = [pdf];
  failedPage.elements.get("projectImage").files = [{ name: "map.png", type: "image/png", size: 100 }];
  await submit(failedPage.elements);
  assert.equal(failedPage.elements.get("projectMessage").textContent, "Save denied");
  assert.deepEqual(failedOperations.map(item => item.operation), ["upload", "upload", "remove", "remove"]);
  for (const upload of failedOperations.slice(0, 2)) {
    const removal = failedOperations.find(item => item.operation === "remove" && item.bucket === upload.bucket);
    assert.deepEqual(removal.paths, [upload.filePath]);
  }
});

test("deleting projects cleans up documents and reports cleanup failures", async () => {
  for (const removeError of [null, new Error("Storage unavailable")]) {
    const client = createClient([{ id: "doc-1", title: "Report", document_path: "projects/old.pdf" }]);
    const operations = addStorage(client, { removeError });
    const { elements, api } = await loadPage(true, client);
    await api.loadProjects();
    await api.deleteProject("doc-1");
    assert.equal(client.writes[0].operation, "delete");
    assert.deepEqual(operations[0].paths, ["projects/old.pdf"]);
    assert.match(elements.get("projectMessage").textContent,
      removeError ? /document could not be removed/ : /deleted successfully/);
  }
});

test("failed replacement preserves the existing document and reports rollback failures", async () => {
  const project = {
    id: "doc-1", title: "Report", description: "Details",
    document_url: "https://storage.example/old.pdf",
    document_path: "projects/old.pdf", document_name: "Old.pdf"
  };
  const client = createClient([project]);
  const operations = addStorage(client, { removeError: new Error("Cleanup denied") });
  const { elements, api } = await loadPage(true, client);
  await api.loadProjects();
  api.editProject("doc-1");
  client.from = () => ({
    update() { return this; },
    eq: async () => ({ error: new Error("Save denied") })
  });
  elements.get("projectDocument").files = [pdf];
  await submit(elements);
  assert.equal(operations.length, 2);
  assert.deepEqual(operations[1].paths, [operations[0].filePath]);
  assert.notEqual(operations[1].paths[0], project.document_path);
  assert.equal(elements.get("currentProjectDocument").textContent, "Current document: Old.pdf");
  assert.match(elements.get("projectMessage").textContent, /Save denied.*could not be removed/);
});

test("selecting a replacement and removal together reports an error without uploading", async () => {
  const client = createClient();
  const operations = addStorage(client);
  const { elements } = await loadPage(true, client);
  fillProject(elements, "");
  elements.get("projectDocument").files = [pdf];
  elements.get("removeProjectDocument").checked = true;
  await submit(elements);
  assert.equal(operations.length, 0);
  assert.equal(client.writes.length, 0);
  assert.match(elements.get("projectMessage").textContent, /not both/);
});

test("image links show full-size originals and View full project exposes downloads", async () => {
  const project = {
    id: "map-1", title: "Map", image_url: "https://storage.example/map.png",
    document_url: "https://storage.example/report.pdf", document_name: pdf.name
  };
  const { elements, api } = await loadPage(false, createClient([project]));
  await api.loadProjects();
  const card = elements.get("projectsGrid").children[0];
  const imageLink = card.children[0].children[0];
  assert.equal(imageLink.href, project.image_url);
  assert.equal(imageLink.target, "_blank");
  assert.equal(imageLink.rel, "noopener noreferrer");
  api.setupProjectGrid();
  const button = card.children[1].children.at(-1);
  elements.get("projectsGrid").dispatch("click", { target: { closest: () => button } });
  assert.equal(elements.get("projectModal")["aria-hidden"], "false");
  assert.equal(elements.get("projectModalImageLink").href, project.image_url);
  assert.equal(elements.get("projectModalDownloadImage").style.display, "inline-flex");
  assert.equal(elements.get("projectModalDocument").href, project.document_url);
  assert.equal(elements.get("projectModalDownloadDocument").style.display, "inline-flex");
  api.openProjectModal({ id: "legacy" });
  assert.equal(elements.get("projectModalImageLink").href, undefined);
  assert.equal(elements.get("projectModalDocument").href, undefined);
  for (const id of ["projectModalDownloadImage", "projectModalDownloadDocument"]) {
    assert.equal(elements.get(id).style.display, "none");
    assert.equal(elements.get(id).onclick, null);
  }
});

test("cross-origin downloads use blobs, preserve file names and report errors", async () => {
  const requested = [];
  const revoked = [];
  const project = {
    image_url: "https://storage.example/map.png",
    document_url: "https://storage.example/report.pdf", document_name: pdf.name
  };
  const { elements, errors, api, body } = await loadPage(false, createClient(), {
    fetch: async url => {
      requested.push(url);
      return { ok: true, blob: async () => ({ type: url.endsWith(".png") ? "image/png" : "application/pdf" }) };
    },
    URL: { createObjectURL: () => "blob:download", revokeObjectURL: url => revoked.push(url) },
    setTimeout: callback => callback()
  });
  api.openProjectModal(project);
  await elements.get("projectModalDownloadImage").onclick();
  await elements.get("projectModalDownloadDocument").onclick();
  assert.deepEqual(requested, [project.image_url, project.document_url]);
  assert.deepEqual(body.children.map(link => link.download), ["project-image.png", pdf.name]);
  assert.ok(body.children.every(link => link.href === "blob:download" && link.clicked && link.removed));
  assert.deepEqual(revoked, ["blob:download", "blob:download"]);
  assert.equal(errors.length, 0);

  const failed = await loadPage(false, createClient(), {
    fetch: async () => ({ ok: false, status: 403 })
  });
  failed.api.openProjectModal(project);
  await failed.elements.get("projectModalDownloadImage").onclick();
  assert.match(failed.elements.get("projectDownloadMessage").textContent, /Could not download/);
  assert.equal(failed.elements.get("projectModalDownloadImage").disabled, false);
  assert.equal(failed.errors.length, 1);
});

test("published projects expose their Play Store link safely in project details", async () => {
  const project = {
    id: "app-1", title: "App", play_store_url: playStoreUrl,
    project_url: "https://example.com", github_url: "https://github.com/example/app"
  };
  const client = createClient([project]);
  const { elements, errors, api, html } = await loadPage(false, client);
  assert.match(html, /id="projectModalPlayStore"[^>]*style="display: none;"/);
  await api.loadProjects();
  assert.deepEqual(client.filters, [{ column: "published", value: true }]);
  api.openProjectModal(project);
  const link = elements.get("projectModalPlayStore");
  assert.equal(link.href, playStoreUrl);
  assert.equal(link.style.display, "inline-flex");
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
  assert.equal(elements.get("projectModalLive").href, project.project_url);
  assert.equal(elements.get("projectModalGithub").href, project.github_url);
  assert.equal(elements.get("projectModal")["aria-hidden"], "false");
  assert.equal(errors.length, 0);

  for (const value of [null, "", undefined]) {
    api.openProjectModal({ id: "legacy-1", play_store_url: value });
    assert.equal(link.style.display, "none");
    assert.equal(link.href, undefined);
  }
  api.openProjectModal(project);
  assert.equal(link.href, playStoreUrl);
  assert.equal(link.style.display, "inline-flex");
});

test("company homepage uses team wording in visible copy and contact labels", async () => {
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ");
  assert.doesNotMatch(text, /\b(?:I|my|me|myself)\b/i);
  assert.match(text, /We develop projects/);
  assert.match(text, /Contact Us/);
  assert.match(text, /Our goal/);
  assert.match(html, /aria-label="Send us an email"/);
  assert.match(html, /aria-label="Visit our GitHub profile"/);
  assert.match(html, /aria-label="Visit our LinkedIn profile"/);
});
