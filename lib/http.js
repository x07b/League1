const { timingSafeEqual } = require("node:crypto");
function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}
async function body(req, limit = 65536) {
  if (req.body) {
    if (JSON.stringify(req.body).length > limit)
      throw new Error("Request too large.");
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > limit) throw new Error("Request too large.");
  }
  return text ? JSON.parse(text) : {};
}
function authorized(req) {
  const expected = process.env.EDITOR_TOKEN;
  const actual = String(req.headers.authorization || "").replace(
    /^Bearer /,
    "",
  );
  return (
    !!expected &&
    Buffer.byteLength(expected) === Buffer.byteLength(actual) &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  );
}
module.exports = { json, body, authorized };
