import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Explicit public files only. New public assets must be reviewed and added here.
export const PUBLIC_FILES = Object.freeze([
  "_headers",
  "index.html", "achievements.html", "products.html",
  "style.css", "index.css", "script.js",
  ...["account-deletion", "child-safety", "privacy", "terms"].map(directory => `${directory}/index.html`),
  ...["achievements.css", "legal.css", "products.css"].map(file => `css/${file}`),
  ...["legal.js", "public-achievements.js", "public-products.js", "public-projects.js", "supabase.js"]
    .map(file => `js/${file}`),
  ...["index", "dashboard", "achievements", "projects", "products", "wantok-chat"]
    .map(page => `admin/${page}.html`),
  ...["admin.css", "achievements.css", "admin-products.css", "wantok-chat.css"]
    .map(file => `admin/css/${file}`),
  ...[
    "admin-auth.js", "login.js", "dashboard.js", "content-data.js",
    "achievements.js", "projects.js", "products.js", "wantok-chat.js",
    "wantok-maps.js", "wantok-platform-ui.js", "wantok-transport.js"
  ].map(file => `admin/js/${file}`),
  "admin/images/wantok-chat-logo.png",
  ...["boundary-sources.json", "png-provinces.geojson", "world-countries.geojson"]
    .map(file => `admin/data/${file}`),
  "jstaroma-slides/index.html",
  "jstaroma-slides/slides.css",
  "jstaroma-slides/gis-maps/index.html",
  "jstaroma-slides/gis-maps/gis-maps.css",
  "jstaroma-slides/gis-maps/gis-maps.js",
  "supabase/functions/shared/wantok-chat-contract.js",
  "supabase/functions/shared/wantok-platform.js",
  "supabase/functions/shared/wantok-transport.js"
].sort());

export function assertNoSecrets(content, filename) {
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(content) ||
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content) ||
      /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(content) ||
      /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/.test(content) ||
      /\b(?:SUPABASE_SERVICE_ROLE_KEY|WANTOK_ANALYTICS_KEY|CLOUDFLARE_API_TOKEN)\s*[:=]\s*["'][^"']+["']/.test(content)) {
    throw new Error(`Refusing to publish potential secret material in ${filename}.`);
  }
  for (const [token] of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g)) {
    const payload = Buffer.from(token.split(".")[1], "base64url").toString();
    if (/"role"\s*:\s*"service_role"/.test(payload)) {
      throw new Error(`Refusing to publish a service-role token in ${filename}.`);
    }
  }
}

export function validatePublicPaths(files) {
  function resolveReference(filename, reference) {
    reference = reference.trim();
    if (!reference || reference.startsWith("#") || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) return;
    const url = new URL(reference, `https://static.invalid/${filename}`);
    const target = decodeURIComponent(url.pathname).slice(1);
    const resolved = target.endsWith("/") || !target ? `${target}index.html` : target;
    if (!files.has(resolved)) {
      throw new Error(`Missing public dependency: ${filename} -> ${reference} (${resolved}).`);
    }
  }
  for (const [filename, buffer] of files) {
    const source = buffer.toString("utf8");
    if (filename.endsWith(".html")) {
      for (const [, , reference] of source.matchAll(/\b(?:src|href|poster)\s*=\s*(["'])(.*?)\1/gs)) {
        resolveReference(filename, reference);
      }
    }
    if (filename.endsWith(".css")) {
      for (const [, reference] of source.matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/g)) {
        resolveReference(filename, reference);
      }
    }
    if (filename.endsWith(".js")) {
      for (const [, reference] of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)) {
        resolveReference(filename, reference);
      }
    }
  }
  // Map filenames are constructed at runtime relative to the admin document.
  for (const filename of ["admin/data/png-provinces.geojson", "admin/data/world-countries.geojson"]) {
    if (!files.has(filename)) throw new Error(`Missing public map: ${filename}.`);
    const data = JSON.parse(files.get(filename).toString());
    if (data.type !== "FeatureCollection" || !Array.isArray(data.features) ||
        (filename.includes("png-provinces") && data.features.length !== 22)) {
      throw new Error(`Invalid public map: ${filename}.`);
    }
  }
}

async function readPublicFile(root, filename) {
  const segments = filename.split("/");
  let location = root;
  for (const [index, segment] of segments.entries()) {
    location = path.join(location, segment);
    const info = await lstat(location);
    if (info.isSymbolicLink() ||
        (index === segments.length - 1 ? !info.isFile() : !info.isDirectory())) {
      throw new Error(`Public asset must be a regular file without symlinks: ${filename}.`);
    }
  }
  return readFile(location);
}

async function assertSafeOutput(directory) {
  let info;
  try { info = await lstat(directory); }
  catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("Refusing to replace dist: output must be a regular directory.");
  }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Refusing to replace dist containing symlinks.");
    if (entry.isDirectory()) await assertSafeOutput(path.join(directory, entry.name));
  }
}

export async function buildStatic(root = repositoryRoot) {
  root = path.resolve(root);
  const output = path.join(root, "dist");
  const files = new Map();
  for (const filename of PUBLIC_FILES) {
    const content = await readPublicFile(root, filename);
    assertNoSecrets(content.toString("utf8"), filename);
    files.set(filename, content);
  }
  validatePublicPaths(files);
  await assertSafeOutput(output);
  // Delete only this build's named output directory, never the repository root.
  await rm(output, { recursive: true, force: true });
  for (const [filename, content] of files) {
    const destination = path.join(output, filename);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  return { output, files: PUBLIC_FILES.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildStatic();
    console.log(`Built and validated ${result.files} public files in ${result.output}.`);
  }
  catch (error) {
    console.error(`Static build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
