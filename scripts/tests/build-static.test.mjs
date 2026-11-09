import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { assertNoSecrets, buildStatic, PUBLIC_FILES } from "../build-static.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "jstaroma-static-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const filename of PUBLIC_FILES) {
    const destination = path.join(directory, filename);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(root, filename), destination);
  }
  return directory;
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), `${filename}/`));
    else files.push(filename);
  }
  return files.sort();
}

async function digest(directory) {
  const hash = createHash("sha256");
  for (const filename of await listFiles(directory)) {
    hash.update(filename);
    hash.update(await readFile(path.join(directory, filename)));
  }
  return hash.digest("hex");
}

test("build preserves every public page/dependency byte-for-byte and is reproducible", async t => {
  const directory = await fixture(t);
  const { files } = await buildStatic(directory);
  assert.equal(files, PUBLIC_FILES.length);
  assert.deepEqual(await listFiles(path.join(directory, "dist")), PUBLIC_FILES);
  for (const filename of PUBLIC_FILES) {
    assert.deepEqual(await readFile(path.join(directory, "dist", filename)), await readFile(path.join(root, filename)));
  }
  const first = await digest(path.join(directory, "dist"));
  await writeFile(path.join(directory, "dist", "stale.env"), "must not survive");
  await buildStatic(directory);
  assert.equal(await digest(path.join(directory, "dist")), first);
  assert.equal(PUBLIC_FILES.filter(filename => filename.endsWith(".html")).length, 15);
  for (const file of [
    "admin/wantok-chat.html", "admin/js/wantok-maps.js", "admin/css/wantok-chat.css",
    "admin/images/wantok-chat-logo.png",
    "admin/data/png-provinces.geojson", "admin/data/world-countries.geojson",
    "supabase/functions/shared/wantok-chat-contract.js", "supabase/functions/shared/wantok-platform.js"
  ]) assert.ok(PUBLIC_FILES.includes(file));
});

test("allowlist never copies private functions, SQL, secrets, tests, config or git metadata", async t => {
  const directory = await fixture(t);
  const forbidden = [
    ".env", ".git/config", "supabase/.temp/linked-project.json",
    "supabase/functions/wantok-chat-analytics/handler.js",
    "supabase/functions/wantok-chat-analytics/index.ts",
    "supabase/functions/shared/.env",
    "supabase/functions/shared/credentials.js",
    "supabase/wantok-chat/edge-secrets.env.example",
    "supabase/wantok-chat/sql/private.sql",
    "admin/js/tests/secret.test.cjs", "admin/css/private.env",
    "admin/data/credentials.json", "README.md", "wrangler.jsonc"
  ];
  for (const filename of forbidden) {
    await mkdir(path.dirname(path.join(directory, filename)), { recursive: true });
    await writeFile(path.join(directory, filename), "private fixture");
  }
  await buildStatic(directory);
  const published = await listFiles(path.join(directory, "dist"));
  for (const filename of forbidden) assert.ok(!published.includes(filename));
  for (const filename of published) assertNoSecrets((await readFile(path.join(directory, "dist", filename))).toString(), filename);
});

test("missing dependencies and injected secrets fail before replacing the previous build", async t => {
  const directory = await fixture(t);
  await buildStatic(directory);
  const before = await digest(path.join(directory, "dist"));
  await writeFile(path.join(directory, "index.html"), '<script src="private.js"></script>');
  await assert.rejects(buildStatic(directory), /Missing public dependency/);
  assert.equal(await digest(path.join(directory, "dist")), before);
  await cp(path.join(root, "index.html"), path.join(directory, "index.html"));
  await writeFile(path.join(directory, "script.js"), 'const key = "sb_secret_TEST_ONLY_NOT_A_REAL_KEY";');
  await assert.rejects(buildStatic(directory), /potential secret/);
  assert.equal(await digest(path.join(directory, "dist")), before);
});

test("secret scanner rejects privileged tokens and private keys but permits the existing publishable key", () => {
  const jwt = [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from('{"role":"service_role"}').toString("base64url"),
    "testsignature"
  ].join(".");
  for (const content of [
    jwt, "-----BEGIN PRIVATE KEY-----", 'WANTOK_ANALYTICS_KEY = "test-only-value"',
    'CLOUDFLARE_API_TOKEN: "test-only-value"'
  ]) assert.throws(() => assertNoSecrets(content, "test.js"));
  assert.doesNotThrow(() => assertNoSecrets('const key = "sb_publishable_test";', "supabase.js"));
});

test("source and output symlinks are refused without following or deleting their target", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "script.js");
  await rm(source);
  await symlink(path.join(root, "script.js"), source);
  await assert.rejects(buildStatic(directory), /without symlinks/);
  await rm(source);
  await cp(path.join(root, "script.js"), source);
  await symlink(root, path.join(directory, "dist"));
  await assert.rejects(buildStatic(directory), /regular directory/);
  assert.ok((await lstat(path.join(directory, "dist"))).isSymbolicLink());
});

test("Wrangler targets the confirmed existing Worker and only generated static assets", async () => {
  const config = JSON.parse(await readFile(path.join(root, "wrangler.jsonc"), "utf8"));
  assert.equal(config.name, "jstaroma-technologies");
  assert.equal(config.assets.directory, "./dist");
  assert.equal(config.assets.html_handling, "auto-trailing-slash");
  assert.equal(config.assets.not_found_handling, "404-page");
  assert.equal(config.main, undefined);
  assert.match(await readFile(path.join(root, ".gitignore"), "utf8"), /^\/dist\/$/m);
});
