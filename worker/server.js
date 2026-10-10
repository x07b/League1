const http = require("node:http");
const { timingSafeEqual } = require("node:crypto");
const { json, body } = require("../lib/http");
const { scrapeStandings } = require("./scrape");
let busy = false;
function createWorkerServer() {
  return http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/standings")
      return json(res, 404, { error: "Not found." });
    const expected = process.env.STANDINGS_PROVIDER_TOKEN || "";
    const actual = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    if (
      !expected ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      return json(res, 401, { error: "Unauthorized." });
    if (process.env.FLASHSCORE_AUTHORIZED !== "true")
      return json(res, 503, {
        error:
          "Source permission must be configured before enabling retrieval.",
      });
    if (busy) return json(res, 429, { error: "Worker busy." });
    busy = true;
    try {
      const { url } = await body(req);
      const standings = await scrapeStandings(url);
      json(res, 200, { standings });
    } catch (error) {
      console.error(error.message);
      json(res, 502, {
        error:
          "Source unavailable, access restricted, or standings markup changed.",
      });
    } finally {
      busy = false;
    }
  });
}
if (require.main === module)
  createWorkerServer().listen(Number(process.env.PORT || 8080), "0.0.0.0", () =>
    console.log("Authorized standings worker ready."),
  );
module.exports = { createWorkerServer };
