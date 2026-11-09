const assert = require("node:assert/strict");
const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const root = path.resolve(__dirname, "../../..");

async function main() {
  const { PLATFORM_METRICS, CONNECTED_PLATFORM_KEYS, PNG_PROVINCES } = await import(pathToFileURL(
    path.join(root, "supabase/functions/shared/wantok-platform.js")
  ));
  let fail = false;
  let unauthorized = false;
  let chartData = false;
  let jiwakaCount = 10;
  const ranges = [];
  const server = http.createServer(async (request, response) => {
    try {
      if (request.url === "/mock-analytics") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const input = JSON.parse(Buffer.concat(chunks).toString());
        const period = input.date_range;
        ranges.push(period);
        response.setHeader("Content-Type", "application/json");
        if (fail) { response.writeHead(503); response.end('{"error":"Unavailable test source"}'); return; }
        const days = (Date.parse(period.end) - Date.parse(period.start)) / 86400000 + 1;
        const output = {
          version: 3, metric_scope: "current_records", period, generated_at: new Date().toISOString(),
          metrics: { registered_users: 100, mau: null, dau: null, messages: 200, calls: 40, groups: 4 },
          growth: null, retention: null,
          platform: {
            metrics: Object.fromEntries(PLATFORM_METRICS.map(([key]) => [key,
              CONNECTED_PLATFORM_KEYS.includes(key) ? (chartData && key === "new_registrations" ? 5 : 0) : null])),
            series: Object.fromEntries(["registrations", "messages", "calls"].map(key => [
              key, Array.from({ length: days }, (_, index) => ({
                date: new Date(Date.parse(period.start) + index * 86400000).toISOString().slice(0, 10),
                count: chartData && key === "registrations" && index < 2 ? index + 2 : 0
              }))
            ])),
            geography: { countries: null, provinces: {
              status: "available", rows: PNG_PROVINCES.map(name => ({
                name, count: name === "Jiwaka Province" ? jiwakaCount : name === "Eastern Highlands Province" ? 5 :
                  name === "Manus Province" ? 4 : name === "Southern Highlands Province" || name === "Morobe Province" ||
                  name === "Enga Province" ? 2 : ["Western Highlands Province", "Gulf Province", "Madang Province",
                    "National Capital District", "Western Province", "East Sepik Province"].includes(name) ? 1 :
                    name === "Unknown / Not Set" ? 21 : 0
              }))
            } }, devices: null
          }
        };
        response.end(JSON.stringify(output));
        return;
      }
      const url = new URL(request.url, "http://localhost");
      const filename = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (!filename.startsWith(`${root}/`) || !/\.(html|js|css|geojson)$/.test(filename)) {
        response.writeHead(404); response.end(); return;
      }
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".geojson": "application/json" };
      response.setHeader("Content-Type", types[path.extname(filename)]);
      response.end(await readFile(filename));
    }
    catch (error) {
      response.writeHead(500); response.end("Test server error");
      console.error(error);
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ acceptDownloads: true });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error));
    await page.route("**/*", async route => {
      const url = route.request().url();
      if (!url.startsWith(origin)) {
        await route.fulfill({ status: 200, contentType: "text/css", body: "" }); return;
      }
      if (url.endsWith("/js/supabase.js")) {
        await route.fulfill({ contentType: "text/javascript", body: `
          export const supabase = {
            auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } }, error: null }) },
            functions: { invoke: async (name, options) => {
              const response = await fetch("/mock-analytics", { method: "POST", body: JSON.stringify(options.body) });
              return response.ok ? { data: await response.json(), error: null } : { data: null, error: new Error("Unavailable test source") };
            } }
          };
        ` }); return;
      }
      if (url.endsWith("/admin-auth.js")) {
        await route.fulfill({ contentType: "text/javascript", body: `
          export const requireAdmin = async () => {
            ${unauthorized ? 'window.location.replace("index.html"); return null;' : 'return { id: "test-admin" };'}
          };
          export const logoutAdmin = () => window.location.replace("index.html");
        ` }); return;
      }
      await route.continue();
    });
    await page.goto(`${origin}/admin/wantok-chat.html`);
    await page.waitForFunction(() => document.getElementById("registered_users").textContent === "100");
    assert.equal(await page.locator("#pngMap path").count(), 22);
    assert.equal(await page.locator("#worldMap path").count(), 177);
    await page.waitForFunction(() => document.getElementById("provinceTotal").textContent === "52");
    assert.equal(await page.locator("#provinceKnown").textContent(), "31");
    assert.equal(await page.locator("#provinceMissing").textContent(), "40.4%");
    assert.equal(await page.locator("#provinceChart li").count(), 23);
    assert.equal(await page.locator('#pngMap path[aria-label="Jiwaka Province: 10 profiles"]').count(), 1);
    assert.notEqual(await page.locator('#pngMap path[aria-label="Jiwaka Province: 10 profiles"]').evaluate(node => node.style.fill), "");
    assert.match(await page.locator("#provinceChart").innerText(), /Unknown \/ Not Set\s+21/);
    assert.equal(await page.locator("#pngLeaderboard tbody tr").count(), 23);
    assert.equal(await page.locator("#mau").textContent(), "Not connected");
    assert.equal(await page.locator("#summaryMetrics-new_registrations").textContent(), "0");
    assert.match(await page.locator("#registrationEmpty").textContent(), /verified zero/);
    assert.equal(await page.locator("#financeMetrics-revenue").textContent(), "Not connected");
    assert.equal(await page.locator("#growthSection #retentionRows").count(), 1);
    assert.equal(await page.locator("#growthSection #engagementSection").count(), 0);
    const map = page.locator("#pngMap svg");
    const before = await map.getAttribute("viewBox");
    await page.locator("#pngMap button").filter({ hasText: "Zoom in" }).click();
    assert.notEqual(await map.getAttribute("viewBox"), before);
    await page.locator("#pngMap button").filter({ hasText: "Reset map" }).click();
    await page.locator('#pngMap path[aria-label="Jiwaka Province: 10 profiles"]').focus();
    await page.keyboard.press("Enter");
    assert.match(await page.locator("#pngMapSelection").textContent(), /Jiwaka Province: 10 profiles/);

    await page.selectOption("#datePreset", "7");
    chartData = true;
    await page.click("#applyDateRange");
    await page.waitForFunction(() => document.querySelectorAll("#registrationChart circle").length === 7);
    assert.equal((Date.parse(ranges.at(-1).end) - Date.parse(ranges.at(-1).start)) / 86400000 + 1, 7);
    const firstDate = ranges.at(-1).start;
    const lineTarget = page.locator('#registrationChart rect[fill="transparent"]').first();
    assert.equal(await lineTarget.locator("title").textContent(), `daily registrations (surviving accounts)\n${firstDate}: 2`);
    await lineTarget.hover();
    assert.equal(await page.locator("#messageTrend circle").first().locator("title").textContent(),
      `Daily messages records\n${firstDate}: 0`);

    await page.selectOption("#growthChartType", "pie");
    assert.equal(await page.locator("#registrationChart .analytics-pie-slice").count(), 2);
    assert.equal(await page.locator("#registrationChart .analytics-pie-legend li").count(), 2);
    assert.equal(await page.locator("#registrationChart .analytics-pie-legend li").first().innerText(), `${firstDate}: 2 (40%)`);
    assert.equal(await page.locator("#registrationChart .analytics-pie-slice").first().locator("title").textContent(),
      `daily registrations (surviving accounts)\n${firstDate}: 2 (40%)`);
    assert.equal(await page.locator("#registrationChart .analytics-pie-slice").first().evaluate(element => element.style.fill),
      await page.locator("#registrationChart .analytics-pie-swatch").first().evaluate(element => element.style.backgroundColor));
    const pieSvg = page.locator("#registrationChart svg");
    const pieBox = await pieSvg.boundingBox();
    const piePoint = { x: pieBox.x + pieBox.width * 277 / 460, y: pieBox.y + pieBox.height * 100 / 230 };
    await page.mouse.move(piePoint.x, piePoint.y);
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)
      .querySelector("title")?.textContent, piePoint), `daily registrations (surviving accounts)\n${firstDate}: 2 (40%)`);

    await page.selectOption("#growthChartType", "bar");
    const firstBar = page.locator("#registrationChart .analytics-chart-bar").first();
    assert.equal(await firstBar.locator("title").textContent(), `daily registrations (surviving accounts)\n${firstDate}: 2`);
    await firstBar.hover();
    assert.equal(await page.locator('#registrationChart rect[fill="transparent"]').count(), 5);
    await page.selectOption("#growthChartType", "line");
    await page.selectOption("#registrationInterval", "weekly");
    assert.ok(await page.locator("#registrationChart circle").count() <= 2);
    const downloadEvent = page.waitForEvent("download");
    await page.click("#exportAnalytics");
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), "wantok-aggregate-analytics.csv");
    await page.check("#investorView");
    assert.equal(await page.locator("#geographySection").isVisible(), false);
    await page.uncheck("#investorView");

    await page.selectOption("#growthChartType", "pie");
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
      assert.ok(sizes.scroll <= sizes.width, `Horizontal page overflow at ${width}: ${sizes.scroll}`);
    }
    jiwakaCount = 11;
    await page.click("#refreshAnalytics");
    await page.waitForFunction(() => document.getElementById("provinceTotal").textContent === "53");
    assert.equal(await page.locator('#pngMap path[aria-label="Jiwaka Province: 11 profiles"]').count(), 1);
    fail = true;
    await page.click("#refreshAnalytics");
    await page.waitForFunction(() => document.getElementById("analyticsStatus").textContent.includes("Could not load analytics"));
    assert.equal(await page.locator("#summaryMetrics-new_registrations").textContent(), "Not connected");
    assert.equal(await page.locator("#registrationChart svg").count(), 0);
    assert.equal(await page.locator("#provinceTotal").textContent(), "Not connected");
    assert.equal(await page.locator("#exportAnalytics").isDisabled(), true);
    fail = false;
    await page.click("#refreshAnalytics");
    await page.waitForFunction(() => document.getElementById("registered_users").textContent === "100");
    unauthorized = true;
    const previousRequests = ranges.length;
    await page.goto(`${origin}/admin/wantok-chat.html`);
    await page.waitForURL(`${origin}/admin/index.html`);
    assert.equal(ranges.length, previousRequests);
    assert.deepEqual(pageErrors, []);
    console.log("PASS: authenticated desktop/mobile rendering, real maps, keyboard selection, zoom, date filters, intervals, CSV, investor view, failure/recovery and unauthorized gating");
  }
  finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
