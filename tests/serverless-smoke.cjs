// Linux-only integration check: launch the exact binary bundled for Vercel.
const assert = require("node:assert/strict");
const { launchBrowser } = require("../lib/browser");
const { extractStandings } = require("../worker/extract");
const { validate } = require("../shared/standings");
const teams = require("../teams.json");
const seed = require("../data/standings.json");

(async () => {
  assert.equal(process.platform, "linux", "Run this check on Linux (CI), not Windows.");
  const browser = await launchBrowser({ serverless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(seed.standings.map(t => `<div class="ui-table__row"><span class="tableCellRank">${t.rank}.</span><a class="tableCellParticipant__name">${teams[t.key].flashscore[0]}</a><span class="table__cell--value">${t.played}</span><span class="table__cell--value table__cell--points">${t.points}</span></div>`).join(""));
    assert.deepEqual(validate(await page.evaluate(extractStandings), teams), validate(seed.standings, teams));
    console.log(`Serverless Chromium ${browser.version()}: launch and complete-table extraction passed.`);
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
