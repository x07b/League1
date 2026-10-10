const test = require("node:test");
const assert = require("node:assert/strict");
const { createWorkerServer } = require("../worker/server");
test("worker gates access before launching a browser", async () => {
  const token = process.env.STANDINGS_PROVIDER_TOKEN,
    permission = process.env.FLASHSCORE_AUTHORIZED;
  process.env.STANDINGS_PROVIDER_TOKEN = "worker-test";
  delete process.env.FLASHSCORE_AUTHORIZED;
  const server = createWorkerServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/standings`;
  try {
    assert.equal((await fetch(url, { method: "POST" })).status, 401);
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { Authorization: "Bearer worker-test" },
        })
      ).status,
      503,
    );
    assert.equal((await fetch(url)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (token === undefined) delete process.env.STANDINGS_PROVIDER_TOKEN;
    else process.env.STANDINGS_PROVIDER_TOKEN = token;
    if (permission === undefined) delete process.env.FLASHSCORE_AUTHORIZED;
    else process.env.FLASHSCORE_AUTHORIZED = permission;
  }
});
