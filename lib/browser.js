const { chromium: playwright } = require("playwright-core");

async function launchBrowser({ serverless = !!process.env.VERCEL } = {}) {
  if (!serverless) return playwright.launch({ headless: true, timeout: 10000 });
  const { default: chromium } = await import("@sparticuz/chromium");
  return playwright.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    timeout: 15000,
  });
}

module.exports = { launchBrowser };
