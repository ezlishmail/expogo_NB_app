// One-off asset generator: pads the landscape wordmark logo into the square
// canvases Expo needs (icon, Android adaptive foreground, splash). Not part of
// the app build — run manually from .asset-gen/ when the logo changes.
const sharp = require("sharp");
const path = require("path");

const SRC = path.resolve(__dirname, "../logo.png");
const OUT = path.resolve(__dirname, "../mobile/assets");
const CREAM = { r: 245, g: 240, b: 235, alpha: 1 }; // #F5F0EB
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

async function make({ size, widthPct, bg, out }) {
  const logo = await sharp(SRC).resize({ width: Math.round(size * widthPct) }).toBuffer();
  const meta = await sharp(logo).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([
      {
        input: logo,
        left: Math.round((size - meta.width) / 2),
        top: Math.round((size - meta.height) / 2),
      },
    ])
    .png()
    .toFile(path.join(OUT, out));
  console.log("wrote", out, `${size}x${size}`);
}

(async () => {
  // App icon (iOS + Android legacy): logo centered on cream.
  await make({ size: 1024, widthPct: 0.74, bg: CREAM, out: "icon.png" });
  // Android adaptive foreground: smaller, transparent (safe zone ~66%);
  // backgroundColor is set in app.json.
  await make({ size: 1024, widthPct: 0.56, bg: CLEAR, out: "adaptive-icon.png" });
  // Splash: logo centered on cream, shown with resizeMode "contain".
  await make({ size: 1024, widthPct: 0.66, bg: CREAM, out: "splash.png" });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
