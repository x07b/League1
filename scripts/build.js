const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "dist");
// Only this explicitly resolved generated directory is replaced.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of [
  "index.html",
  "mobile-index.html",
  "style.css",
  "mobile-style.css",
  "controls.css",
  "script.js",
  "drive-api.js",
  "teams.json",
  "shared",
  "data",
  "fonts",
])
  fs.cpSync(path.join(root, file), path.join(out, file), { recursive: true });
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
for (const file of [
  "background.png",
  "cup.png",
  "shadow.png",
  "logo.png",
  "ligue live DS.png",
  "tartib.png",
  "mobile-banner.png",
  "logos",
])
  fs.cpSync(path.join(root, "assets", file), path.join(out, "assets", file), {
    recursive: true,
  });
fs.mkdirSync(path.join(out, "vendor"), { recursive: true });
fs.copyFileSync(
  require.resolve("html2canvas/dist/html2canvas.min.js"),
  path.join(out, "vendor/html2canvas.min.js"),
);
// Recompress without resizing, quantization, or changing the source artwork.
async function optimize() {
  const sharp = require("sharp");
  let before = 0,
    after = 0;
  const dirs = ["assets", "assets/logos"];
  for (const dir of dirs)
    for (const name of fs.readdirSync(path.join(out, dir))) {
      if (!name.endsWith(".png")) continue;
      const source = path.join(root, dir, name),
        destination = path.join(out, dir, name);
      const original = fs.readFileSync(source);
      const colorChunks = [];
      let profiled = false;
      for (let offset = 8; offset < original.length;) {
        const length = original.readUInt32BE(offset);
        const type = original.toString("ascii", offset + 4, offset + 8);
        if (type === "iCCP") profiled = true;
        if (["gAMA", "cHRM", "sRGB"].includes(type))
          colorChunks.push(original.subarray(offset, offset + length + 12));
        offset += length + 12;
      }
      // Retain ICC originals, and preserve PNG gamma/chromaticity chunks verbatim.
      // Pixel-lossless re-encoding alone can otherwise change browser colors.
      let compressed = profiled
        ? original
        : await sharp(original, { limitInputPixels: 100000000 })
            .png({ compressionLevel: 9, adaptiveFiltering: true })
            .toBuffer();
      if (!profiled && colorChunks.length)
        compressed = Buffer.concat([
          compressed.subarray(0, 33),
          ...colorChunks,
          compressed.subarray(33),
        ]);
      before += original.length;
      if (compressed.length < original.length)
        fs.writeFileSync(destination, compressed);
      after += fs.statSync(destination).size;
    }
  console.log(
    `Built desktop and mobile static site in dist/. Lossless PNG compression: ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB. Original pixel dimensions retained.`,
  );
}
optimize().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
