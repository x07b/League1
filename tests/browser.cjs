const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const { createServer } = require("../server");
const { extractStandings } = require("../worker/extract");
const seed = require("../data/standings.json");
const teams = require("../teams.json");
const { validate } = require("../shared/standings");
fs.mkdirSync("output", { recursive: true });
function diff(a, b) {
  const left = PNG.sync.read(a),
    right = PNG.sync.read(b);
  assert.equal(left.width, right.width);
  assert.equal(left.height, right.height);
  let changed = 0;
  for (let i = 0; i < left.data.length; i += 4) {
    if (
      [0, 1, 2].some((c) => Math.abs(left.data[i + c] - right.data[i + c]) > 4)
    )
      changed++;
  }
  return changed / (left.width * left.height);
}
async function ready(page) {
  await page.waitForFunction(
    () => !document.getElementById("editBtn")?.disabled,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode()));
  });
}
async function native(page, selector) {
  await page.locator(selector).evaluate((el) =>
    Object.assign(el.style, {
      transform: "none",
      left: "0",
      top: "0",
      position: "absolute",
    }),
  );
  await page.addStyleTag({
    content:
      ".app-header,.notices{visibility:hidden}.board-stage{position:static!important}",
  });
  await page.waitForTimeout(400);
  return page.locator(selector).screenshot({ animations: "disabled" });
}
(async () => {
  const server = createServer({ localUpdates: false });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const errors = [];
  try {
    const fixture = await browser.newPage();
    await fixture.setContent(
      seed.standings
        .map(
          (t) =>
            `<div class="ui-table__row"><span class="tableCellRank">${t.rank}.</span><a class="tableCellParticipant__name">${teams[t.key].flashscore[0]}</a><span class="table__cell--value">${t.played}</span><span class="table__cell--value table__cell--points">${t.points}</span></div>`,
        )
        .join(""),
    );
    assert.deepEqual(
      validate(await fixture.evaluate(extractStandings), teams),
      validate(seed.standings, teams),
    );
    await fixture
      .locator(".ui-table__row")
      .last()
      .evaluate((el) => el.remove());
    await assert.rejects(() => fixture.evaluate(extractStandings));
    await fixture.close();
    for (const mobile of [false, true]) {
      const name = mobile ? "mobile-index.html" : "index.html",
        css = mobile ? "mobile-style.css" : "style.css",
        selector = mobile ? ".mobile-board" : ".board";
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1350 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${origin}/${name}`);
      await ready(page);
      assert.equal(
        await page.locator(mobile ? ".mobile-row" : ".dynamic-row").count(),
        16,
      );
      const screenshot = await native(page, selector);
      fs.writeFileSync(
        `output/current-${mobile ? "mobile" : "desktop"}.png`,
        screenshot,
      );
      const baseline = await context.newPage();
      await baseline.route("**/assets/**", (route) =>
        route.fulfill({
          path: decodeURIComponent(
            new URL(route.request().url()).pathname,
          ).slice(1),
        }),
      );
      await baseline.route(`**/${name}`, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: fs.readFileSync(`tests/fixtures/${name}`, "utf8"),
        }),
      );
      await baseline.route(`**/${css}`, (route) =>
        route.fulfill({
          contentType: "text/css",
          body: fs.readFileSync(`tests/fixtures/${css}`, "utf8"),
        }),
      );
      await baseline.goto(`${origin}/${name}`);
      await ready(baseline);
      const before = await native(baseline, selector);
      fs.writeFileSync(
        `output/reference-${mobile ? "mobile" : "desktop"}.png`,
        before,
      );
      const ratio = diff(before, screenshot);
      assert.ok(ratio < 0.0001, `Board screenshot changed: ${ratio}`);
      console.log(
        `${name}: original board screenshot difference ${(ratio * 100).toFixed(4)}%`,
      );
      // Compare exported canvas to the same renderer applied to the original board.
      await baseline.addScriptTag({
        url: `${origin}/vendor/html2canvas.min.js`,
      });
      const reference = await baseline
        .locator(selector)
        .evaluate(async (el, mobile) => {
          const canvas = await html2canvas(el, {
            width: mobile ? 1080 : 1920,
            height: mobile ? 1350 : 1080,
            windowWidth: 1920,
            windowHeight: 1350,
            scrollX: 0,
            scrollY: 0,
            scale: 1,
            useCORS: true,
            backgroundColor: "#031a3a",
            logging: false,
          });
          return canvas.toDataURL();
        }, mobile);
      await page.reload();
      await ready(page);
      await page.locator("#exportBtn").click();
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#exportFull").click();
      const download = await downloadPromise;
      const exportPath = `output/export-${mobile ? "mobile" : "desktop"}.png`;
      await download.saveAs(exportPath);
      const png = fs.readFileSync(exportPath);
      const exportRatio = diff(
        Buffer.from(reference.split(",")[1], "base64"),
        png,
      );
      assert.ok(
        exportRatio < 0.0001,
        `Export differs from original: ${exportRatio}`,
      );
      console.log(
        `${name}: native PNG export difference ${(exportRatio * 100).toFixed(4)}%`,
      );
      // Failed updates leave rows intact; successful updates persist and retain logos.
      const rowSel = mobile ? ".mobile-row" : ".dynamic-row";
      const beforeText = await page.locator(rowSel).allTextContents();
      await page.route("**/api/update", (route) =>
        route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: "Source unavailable" }),
        }),
      );
      await page.locator("#updateBtn").click();
      await page.getByText("Source unavailable", { exact: true }).waitFor();
      assert.deepEqual(
        await page.locator(rowSel).allTextContents(),
        beforeText,
      );
      await page.unroute("**/api/update");
      await page.route("**/api/update", (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ standings: seed.standings.slice(1) }),
        }),
      );
      await page.locator("#updateBtn").click();
      await page
        .getByText(
          "Invalid or incomplete standings: exactly 16 teams are required.",
          { exact: true },
        )
        .waitFor();
      assert.deepEqual(
        await page.locator(rowSel).allTextContents(),
        beforeText,
      );
      const changed = structuredClone(seed);
      changed.standings[0].played += 1;
      changed.updatedAt = new Date().toISOString();
      let calls = 0;
      await page.unroute("**/api/update");
      await page.route("**/api/update", async (route) => {
        calls++;
        await new Promise((r) => setTimeout(r, 100));
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(changed),
        });
      });
      await page.locator("#updateBtn").evaluate((button) => {
        button.click();
        button.click();
      });
      await page
        .getByText("Standings updated successfully.", { exact: true })
        .waitFor();
      assert.equal(calls, 1);
      await page.reload();
      await ready(page);
      assert.match(await page.locator("#lastUpdated").textContent(), /Updated/);
      await page.locator("#editBtn").click();
      await page
        .locator("#editRows tr")
        .first()
        .locator('input[name="played"]')
        .fill("6");
      await page.locator("#standingsForm button").click();
      await page
        .getByText("Standings saved successfully on this browser.", {
          exact: true,
        })
        .waitFor();
      await page.reload();
      await ready(page);
      assert.match(await page.locator("#lastUpdated").textContent(), /Manual/);
      await page.locator("#editBtn").click();
      await page.locator("#assetFolder").selectOption("team");
      await page.locator("#teamTarget").selectOption("esperance");
      await page.locator("#assetFile").setInputFiles("assets/logos/hs.png");
      await page.locator("#saveAsset").click();
      await page
        .getByText("Image saved successfully on this browser.", { exact: true })
        .waitFor();
      await page
        .locator("#editRows tr")
        .nth(0)
        .locator('input[name="rank"]')
        .fill("2");
      await page
        .locator("#editRows tr")
        .nth(1)
        .locator('input[name="rank"]')
        .fill("1");
      await page.locator("#standingsForm button").click();
      await page
        .getByText("Standings saved successfully on this browser.", {
          exact: true,
        })
        .waitFor();
      await page.reload();
      await ready(page);
      assert.ok(
        (
          await page
            .locator(`${rowSel}[data-team="esperance"] img`)
            .getAttribute("src")
        ).startsWith("blob:"),
      );
      await page.locator("#settingsBtn").click();
      await page
        .locator("#sourceUrl")
        .fill("https://www.flashscore.fr/classement/test/");
      await page.locator('#settingsForm button[type="submit"]').click();
      await page
        .getByText("Settings saved successfully.", { exact: true })
        .waitFor();
      await page.locator("#settingsBtn").click();
      assert.equal(
        await page.locator("#sourceUrl").inputValue(),
        "https://www.flashscore.fr/classement/test/",
      );
      await page.locator("#settingsDialog [data-close]").click();
      await page.locator("#exportBtn").click();
      await page.locator("#exportCount").fill("4");
      const customDownload = page.waitForEvent("download");
      await page.locator("#exportCustom").click();
      await (
        await customDownload
      ).saveAs(`output/export-custom-${mobile ? "mobile" : "desktop"}.png`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(100);
      const header = await page.locator(".app-header").boundingBox(),
        bounds = await page.locator(selector).boundingBox();
      assert.ok(
        bounds.y >= header.y + header.height - 1,
        "Toolbar overlaps board",
      );
      assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= 391);
      await page.screenshot({
        path: `output/ui-${mobile ? "mobile" : "desktop"}-390.png`,
      });
      await page
        .locator(`${selector} img`)
        .first()
        .evaluate((image) => (image.src = "/missing-image.png"));
      await page.locator("#exportBtn").click();
      await page.locator("#exportFull").click();
      await page.getByText(/Export failed: An image is missing/).waitFor();
      assert.equal(
        await page.locator(`${selector}[style*="z-index: -1"]`).count(),
        0,
      );
      await baseline.close();
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: parser fixtures, unchanged boards, PNG exports, failure recovery, persistence, editing, mobile toolbar, no unhandled browser errors.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
