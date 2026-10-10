const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "dist");
const handlers = Object.fromEntries(
  ["update", "standings", "drive"].map((name) => [
    `/api/${name}`,
    require(`./api/${name}`),
  ]),
);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".otf": "font/otf",
  ".woff2": "font/woff2",
};
function createServer({
  localUpdates = !process.env.VERCEL && !process.env.STANDINGS_PROVIDER_URL,
  localOptions,
} = {}) {
  const routes = { ...handlers };
  if (localUpdates) {
    const local = require("./lib/local-standings").createLocalStandings(
      localOptions,
    );
    routes["/api/update"] = local.update;
    routes["/api/standings"] = local.get;
  }
  return http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://local").pathname,
      );
      if (routes[pathname]) return await routes[pathname](req, res);
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      const route =
        { "/": "/index.html", "/mobile": "/mobile-index.html" }[pathname] ||
        pathname;
      const file = path.resolve(root, "." + route);
      if (
        !file.startsWith(root + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile()
      ) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(500);
      res.end("Request failed");
    }
  });
}
if (require.main === module) {
  if (!fs.existsSync(root)) throw new Error("Run npm run build first.");
  const port = Number(process.env.PORT || 8000);
  createServer().listen(port, "127.0.0.1", () =>
    console.log(`LA ANT MATCH: http://localhost:${port}`),
  );
}
module.exports = { createServer };
