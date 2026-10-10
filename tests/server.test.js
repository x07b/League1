const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../server");
test("production routes refresh, serve assets and keep private files inaccessible", async () => {
  const server = createServer({ localUpdates: false });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of [
      "/",
      "/index.html",
      "/mobile",
      "/mobile-index.html",
      "/fonts/alexandria.css",
      "/assets/logos/est.png",
    ])
      assert.equal((await fetch(origin + path)).status, 200, path);
    for (const path of [
      "/.env",
      "/server.js",
      "/worker/server.js",
      "/package.json",
      "/../.git/config",
    ])
      assert.equal((await fetch(origin + path)).status, 404, path);
    const head = await fetch(origin + "/index.html", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const response = await fetch(origin + "/api/standings");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).standings.length, 16);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
