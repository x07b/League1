const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const update = require("../api/update");
const standings = require("../api/standings");
const drive = require("../api/drive");
const seed = require("../data/standings.json");
const source = require("../config").FLASHSCORE_URL;
async function call(
  handler,
  { method = "POST", url = "/api/update", data = {}, token = "" } = {},
) {
  const req = Readable.from([JSON.stringify(data)]);
  req.method = method;
  req.url = url;
  req.headers = { authorization: `Bearer ${token}` };
  let status;
  let result;
  const res = {
    writeHead(s) {
      status = s;
    },
    end(value) {
      result = JSON.parse(value);
    },
  };
  await handler(req, res);
  return { status, body: result };
}
test("API success, failure recovery, distributed lock, auth and unavailable setup", async () => {
  const names = [
    "STANDINGS_PROVIDER_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "EDITOR_TOKEN",
  ];
  const original = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  const originalFetch = global.fetch;
  let stored = null,
    locked = false,
    bad = false,
    fail = false,
    storageFail = false,
    calls = 0;
  try {
    names.forEach((n) => delete process.env[n]);
    assert.equal((await call(update)).status, 503);
    assert.equal((await call(update, { method: "GET" })).status, 405);
    assert.equal(
      (await call(standings, { method: "GET", url: "/api/standings" })).body
        .seed,
      true,
    );
    assert.equal((await call(drive)).status, 401);
    process.env.STANDINGS_PROVIDER_URL = "https://worker.test/standings";
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "redis-test";
    process.env.EDITOR_TOKEN = "editor-test";
    global.fetch = async (url, options) => {
      if (url.includes("worker.test")) {
        calls++;
        if (fail) return Response.json({ error: "failed" }, { status: 502 });
        return Response.json({
          standings: bad ? seed.standings.slice(1) : seed.standings,
        });
      }
      const [command, key, value] = JSON.parse(options.body);
      if (command === "GET")
        return Response.json({ result: stored && JSON.stringify(stored) });
      if (key.endsWith(":lock")) {
        if (locked) return Response.json({ result: null });
        locked = true;
        return Response.json({ result: "OK" });
      }
      if (storageFail) return Response.json({ error: "write failed" });
      stored = JSON.parse(value);
      return Response.json({ result: "OK" });
    };
    assert.equal((await call(update)).status, 401);
    assert.equal(
      (
        await call(update, {
          token: "editor-test",
          data: { url: "https://evil.test" },
        })
      ).status,
      502,
    );
    const success = await call(update, {
      token: "editor-test",
      data: { url: source },
    });
    assert.equal(success.status, 200);
    assert.equal(success.body.standings.length, 16);
    assert.ok(success.body.updatedAt);
    assert.equal(calls, 1);
    assert.equal((await call(update, { token: "editor-test" })).status, 429);
    assert.equal(calls, 1);
    const before = structuredClone(stored);
    locked = false;
    bad = true;
    assert.equal((await call(update, { token: "editor-test" })).status, 502);
    assert.deepEqual(stored, before);
    locked = false;
    bad = false;
    fail = true;
    assert.equal((await call(update, { token: "editor-test" })).status, 502);
    assert.deepEqual(stored, before);
    locked = false;
    fail = false;
    storageFail = true;
    assert.equal((await call(update, { token: "editor-test" })).status, 502);
    assert.deepEqual(stored, before);
    assert.deepEqual(
      (await call(standings, { method: "GET", url: "/api/standings" })).body
        .standings,
      before.standings,
    );
  } finally {
    global.fetch = originalFetch;
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

test("Drive reports upstream failures and only confirms successful authenticated uploads", async () => {
  const names = ["EDITOR_TOKEN", "DRIVE_API_URL", "DRIVE_SHARED_SECRET"];
  const original = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  const originalFetch = global.fetch;
  try {
    process.env.EDITOR_TOKEN = "editor-test";
    process.env.DRIVE_API_URL = "https://script.google.com/example/exec";
    process.env.DRIVE_SHARED_SECRET = "drive-test";
    const data = {
      folder: "exports",
      filename: "board.png",
      mimeType: "image/png",
      data: "aGVsbG8=",
    };
    global.fetch = async () => Response.json({ ok: false, error: "denied" });
    assert.equal(
      (await call(drive, { token: "editor-test", data })).status,
      502,
    );
    global.fetch = async (url, options) => {
      assert.equal(JSON.parse(options.body).secret, "drive-test");
      return Response.json({ ok: true, id: "example" });
    };
    assert.equal(
      (await call(drive, { token: "editor-test", data })).status,
      200,
    );
    assert.equal(
      (
        await call(drive, {
          token: "editor-test",
          data: { ...data, folder: "../other" },
        })
      ).status,
      502,
    );
  } finally {
    global.fetch = originalFetch;
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});
