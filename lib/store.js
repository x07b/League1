const configured = () =>
  !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
async function command(...args) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new Error("Persistent storage unavailable. Previous standings kept.");
  const data = await response.json();
  if (data.error) throw new Error("Persistent storage rejected the request.");
  return data.result;
}
const key = (url) =>
  "la-ant:standings:" +
  require("node:crypto").createHash("sha256").update(url).digest("hex");
async function get(url) {
  const value = await command("GET", key(url));
  return value ? JSON.parse(value) : null;
}
async function set(url, value) {
  await command("SET", key(url), JSON.stringify(value));
}
async function lock(url) {
  return (
    (await command("SET", key(url) + ":lock", "1", "NX", "EX", 60)) === "OK"
  );
}
module.exports = { configured, get, set, lock };
