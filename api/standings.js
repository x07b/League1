const { json } = require("../lib/http");
const store = require("../lib/store");
const { sourceUrl, validate } = require("../shared/standings");
const teams = require("../teams.json");
const seed = require("../data/standings.json");
const defaultUrl = require("../config").FLASHSCORE_URL;
module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Use GET." });
  try {
    const url = sourceUrl(
      new URL(req.url, "https://local").searchParams.get("url") || defaultUrl,
    );
    const saved = store.configured() ? await store.get(url) : null;
    return json(res, 200, {
      ...(saved || seed),
      standings: validate((saved || seed).standings, teams),
      sourceUrl: url,
      seed: !saved,
      driveEnabled: !!process.env.DRIVE_API_URL,
      updateEnabled: true,
      updateMode: process.env.STANDINGS_PROVIDER_URL ? "worker" : "direct",
      persistence: store.configured() ? "shared" : "browser",
      requiresToken: !!process.env.EDITOR_TOKEN,
    });
  } catch (error) {
    return json(res, 503, { error: error.message });
  }
};
