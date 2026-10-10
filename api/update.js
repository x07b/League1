const { json, body, authorized } = require("../lib/http");
const store = require("../lib/store");
const { sourceUrl, validate } = require("../shared/standings");
const teams = require("../teams.json");
const defaultUrl = require("../config").FLASHSCORE_URL;
function createUpdateHandler({ scrape = (url) => require("../worker/scrape").scrapeStandings(url) } = {}) {
let busy = false;
return async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Use POST." });
  if (process.env.EDITOR_TOKEN && !authorized(req))
    return json(res, 401, {
      error: "Enter the editor access token in Settings.",
    });
  if (busy) return json(res, 429, { error: "An update is already running. Please wait." });
  busy = true;
  try {
    const input = await body(req);
    const url = sourceUrl(input.url || defaultUrl);
    if (store.configured() && !(await store.lock(url)))
      return json(res, 429, {
        error:
          "An update is running or was just requested. Retry in one minute.",
      });
    let raw;
    if (process.env.STANDINGS_PROVIDER_URL) {
    const response = await fetch(process.env.STANDINGS_PROVIDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STANDINGS_PROVIDER_TOKEN || ""}`,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(40000),
    });
    if (!response.ok)
      throw new Error(
        "Unable to retrieve standings from the authorized source. Check worker logs.",
      );
    raw = await response.json();
    } else {
      raw = { standings: await scrape(url) };
    }
    const standings = validate(raw.standings, teams);
    const payload = {
      standings,
      updatedAt: new Date().toISOString(),
      sourceUrl: url,
      persistence: store.configured() ? "shared" : "browser",
    };
    if (store.configured()) await store.set(url, payload);
    return json(res, 200, payload);
  } catch (error) {
    return json(res, 502, {
      error:
        error.name === "TimeoutError"
          ? "Standings source timed out. Previous board kept."
          : error.message,
    });
  } finally { busy = false; }
};
}
module.exports = createUpdateHandler();
module.exports.createUpdateHandler = createUpdateHandler;
