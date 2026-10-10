// Used only by the local Node server, never by Vercel's api/ functions.
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { json, body, authorized } = require("./http");
const { sourceUrl, validate } = require("../shared/standings");
const { FLASHSCORE_URL } = require("../config");
const teams = require("../teams.json");
const seed = require("../data/standings.json");

function createLocalStandings({
  directory = path.resolve(__dirname, "../.local-data"),
  scrape = (url) => require("../worker/scrape").scrapeStandings(url),
} = {}) {
  let busy = false;
  const filename = (url) =>
    path.join(
      directory,
      createHash("sha256").update(url).digest("hex") + ".json",
    );

  async function get(req, res) {
    if (req.method !== "GET") return json(res, 405, { error: "Use GET." });
    try {
      const url = sourceUrl(
        new URL(req.url, "http://local").searchParams.get("url") ||
          FLASHSCORE_URL,
      );
      let saved;
      try {
        saved = JSON.parse(await fs.readFile(filename(url), "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      return json(res, 200, {
        ...(saved || seed),
        standings: validate((saved || seed).standings, teams),
        seed: !saved,
        sourceUrl: url,
        updateEnabled: true,
        updateMode: "local",
        driveEnabled: !!process.env.DRIVE_API_URL,
        requiresToken: !!process.env.EDITOR_TOKEN,
      });
    } catch (error) {
      return json(res, 503, { error: error.message });
    }
  }

  async function update(req, res) {
    if (req.method !== "POST") return json(res, 405, { error: "Use POST." });
    if (process.env.EDITOR_TOKEN && !authorized(req))
      return json(res, 401, {
        error: "Enter the editor access token in Settings.",
      });
    if (busy)
      return json(res, 429, {
        error: "An update is already running. Please wait.",
      });
    busy = true;
    try {
      const input = await body(req);
      const url = sourceUrl(input.url || FLASHSCORE_URL);
      const standings = validate(await scrape(url), teams);
      const payload = {
        standings,
        sourceUrl: url,
        updatedAt: new Date().toISOString(),
      };
      await fs.mkdir(directory, { recursive: true });
      const target = filename(url);
      const temporary = target + "." + randomUUID() + ".tmp";
      try {
        await fs.writeFile(temporary, JSON.stringify(payload, null, 2) + "\n");
        await fs.rename(temporary, target);
      } finally {
        await fs.rm(temporary, { force: true });
      }
      console.log("Standings saved. DONE.");
      return json(res, 200, payload);
    } catch (error) {
      console.error("UPDATE ERROR:", error.message);
      return json(res, 502, {
        error: `Flashscore update failed: ${error.message}. Previous standings kept.`,
      });
    } finally {
      busy = false;
    }
  }
  return { get, update };
}
module.exports = { createLocalStandings };
