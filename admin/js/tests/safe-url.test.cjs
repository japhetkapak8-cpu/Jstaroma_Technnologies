const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const root = path.resolve(__dirname, "../../..");

test("safe achievement links accept only absolute HTTPS URLs without credentials", async () => {
  const { safeHttpsUrl } = await import(pathToFileURL(path.join(root, "js/safe-url.js")));

  assert.equal(safeHttpsUrl("https://example.com/award"), "https://example.com/award");
  assert.equal(safeHttpsUrl(" HTTPS://Example.com/award "), "https://example.com/award");

  for (const value of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://example.com/award",
    "//example.com/award",
    "https://user:password@example.com/award",
    "https://",
    "not a URL",
    "",
    null
  ]) {
    assert.equal(safeHttpsUrl(value), null);
  }
});
