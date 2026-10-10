const { sourceUrl, validate } = require("../shared/standings");
const { extractStandings } = require("./extract");
const teams = require("../teams.json");

async function scrapeStandings(url) {
  const target = sourceUrl(url);
  const { chromium } = require("playwright");
  let browser, timer;
  try {
    browser = await chromium.launch({ headless: true, timeout: 5000 });
    timer = setTimeout(() => browser.close().catch(() => {}), 35000);
    const page = await browser.newPage({ locale: "fr-FR" });
    console.log("Opening Flashscore...");
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20000 });
    const consent = page.locator("#onetrust-accept-btn-handler");
    if (await consent.isVisible()) await consent.click({ timeout: 2000 });
    await page.locator(".ui-table__row").nth(15).waitFor({ timeout: 10000 });
    const standings = validate(await page.evaluate(extractStandings), teams);
    console.log(`Found ${standings.length} standings rows.\nCLASSEMENT:`);
    for (const team of standings)
      console.log(
        `${String(team.rank).padStart(2)} | MJ=${team.played} | PTS=${team.points} | ${team.key} | LOGO OK`,
      );
    return standings;
  } catch (error) {
    if (error.message.includes("Executable doesn't exist")) {
      throw new Error("Chromium is not installed. Run: npm run setup:browser");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { scrapeStandings };
