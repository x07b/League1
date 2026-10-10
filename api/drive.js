const { json, body, authorized } = require("../lib/http");
module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Use POST." });
  if (!authorized(req))
    return json(res, 401, {
      error: "Drive upload requires the editor access token in Settings.",
    });
  if (!process.env.DRIVE_API_URL || !process.env.DRIVE_SHARED_SECRET)
    return json(res, 503, {
      error: "Google Drive is not configured. Local file is preserved.",
    });
  try {
    const input = await body(req, 4000000);
    if (
      !/^(exports|assets\/(background|branding|competition|cup|teams))$/.test(
        input.folder || "",
      ) ||
      !/^image\/(png|jpeg|webp|gif)$/.test(input.mimeType || "") ||
      typeof input.filename !== "string" ||
      input.filename.length > 150 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data || "")
    )
      throw new Error(
        "Invalid upload. Use PNG, JPEG, WebP or GIF under 2.8 MB.",
      );
    const response = await fetch(process.env.DRIVE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        ...input,
        secret: process.env.DRIVE_SHARED_SECRET,
      }),
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok)
      throw new Error(
        "Google Drive did not confirm the upload. Check Apps Script configuration.",
      );
    return json(res, 200, result);
  } catch (error) {
    return json(res, 502, { error: error.message });
  }
};
