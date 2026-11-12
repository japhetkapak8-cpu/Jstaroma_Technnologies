import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES } from "../build-static.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const base = new URL(process.argv[2] || "http://127.0.0.1:8791");
if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
  throw new Error("HTTP verification must target a local preview, not production.");
}

async function verify() {
  for (const filename of PUBLIC_FILES) {
    const response = await fetch(new URL(`/${filename}`, base), { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, `Public path failed: /${filename}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path.join(root, "dist", filename)),
      `Public path did not serve its original bytes: /${filename}`);
  }
  const indexFiles = PUBLIC_FILES.filter(filename => filename === "index.html" || filename.endsWith("/index.html"));
  for (const filename of indexFiles) {
    const url = `/${filename.slice(0, -"index.html".length)}`;
    const response = await fetch(new URL(url, base), { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, `Directory page failed: ${url}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path.join(root, "dist", filename)));
  }
  for (const filename of [
    ".env", ".git/config", "README.md", "wrangler.jsonc",
    "supabase/.temp/linked-project.json",
    "supabase/functions/wantok-chat-analytics/handler.js",
    "supabase/functions/wantok-chat-analytics/index.ts",
    "supabase/wantok-chat/sql/20261108_analytics_platform.sql",
    "supabase/wantok-chat/edge-secrets.env.example",
    "admin/js/tests/wantok-chat.test.cjs", "missing-page.html"
  ]) {
    const response = await fetch(new URL(`/${filename}`, base), { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 404, `Private or missing path must return 404: /${filename}`);
  }
  console.log(`Verified ${PUBLIC_FILES.length} public files, ${indexFiles.length} directory pages and private-path 404s.`);
}

try { await verify(); }
catch (error) {
  console.error(`Static HTTP verification failed: ${error.message}`);
  process.exitCode = 1;
}
