const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../server");
const seed = require("../data/standings.json");
const { FLASHSCORE_URL } = require("../config");

test("local UPDATE scrapes the configured URL, persists across restarts, and preserves valid data on failure", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "la-ant-local-test-"),
  );
  let mode = "success",
    release,
    calls = 0;
  const scrape = async (url) => {
    calls++;
    assert.equal(url, FLASHSCORE_URL);
    if (mode === "wait")
      await new Promise((resolve) => {
        release = resolve;
      });
    if (mode === "fail") throw new Error("Source unavailable");
    return mode === "partial" ? seed.standings.slice(1) : seed.standings;
  };
  let server, origin;
  const start = async () => {
    server = createServer({
      localUpdates: true,
      localOptions: { directory, scrape },
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const post = () =>
    fetch(origin + "/api/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: FLASHSCORE_URL }),
    });
  try {
    await start();
    const first = await (await fetch(origin + "/api/standings")).json();
    assert.equal(first.seed, true);
    assert.equal(first.updateMode, "local");
    const response = await post();
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.standings.length, 16);
    assert.ok(saved.updatedAt);
    await new Promise((resolve) => server.close(resolve));
    await start();
    const restored = await (await fetch(origin + "/api/standings")).json();
    assert.deepEqual(restored.standings, saved.standings);
    assert.equal(restored.updatedAt, saved.updatedAt);
    for (mode of ["fail", "partial"]) {
      assert.equal((await post()).status, 502);
      assert.equal(
        (await (await fetch(origin + "/api/standings")).json()).updatedAt,
        saved.updatedAt,
      );
    }
    mode = "wait";
    const pending = post();
    while (!release) await new Promise((resolve) => setTimeout(resolve, 5));
    const before = calls;
    assert.equal((await post()).status, 429);
    assert.equal(calls, before);
    release();
    assert.equal((await pending).status, 200);
  } finally {
    if (server?.listening)
      await new Promise((resolve) => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
