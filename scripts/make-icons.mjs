// Renders www/assets/icon.svg into the PWA icons and the Android launcher
// icons / splash screens (needs Playwright + Chromium). Run: npm run icons
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = fs.readFileSync(path.join(root, "www/assets/icon.svg"), "utf8");
// glyph only (no rounded background) for Android adaptive foreground and splash
const glyph = svg.replace(/<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/, "");
const b = await chromium.launch();
const p = await b.newPage();
async function render(file, w, h, html) {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden">${html}</body></html>`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await p.screenshot({ path: file, omitBackground: true });
}
const img = (s, size, extra = "") => s.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block;${extra}" `);
for (const s of [192, 512]) await render(path.join(root, `www/assets/icon-${s}.png`), s, s, img(svg, s));
const res = path.join(root, "android/app/src/main/res");
if (fs.existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const L = Math.round(48 * k), F = Math.round(108 * k);
    await render(`${res}/mipmap-${d}/ic_launcher.png`, L, L, img(svg, L));
    await render(`${res}/mipmap-${d}/ic_launcher_round.png`, L, L, `<div style="width:${L}px;height:${L}px;border-radius:50%;overflow:hidden">${img(svg, L, "transform:scale(1.25)")}</div>`);
    await render(`${res}/mipmap-${d}/ic_launcher_foreground.png`, F, F, `<div style="width:${F}px;height:${F}px;display:grid;place-items:center">${img(glyph, Math.round(F * 0.62))}</div>`);
  }
  const splash = (w, h) => `<div style="width:${w}px;height:${h}px;background:#070a12;display:grid;place-items:center">${img(svg, Math.round(Math.min(w, h) * 0.28))}</div>`;
  for (const f of fs.readdirSync(res).filter((x) => x.startsWith("drawable"))) {
    const file = `${res}/${f}/splash.png`;
    if (!fs.existsSync(file)) continue;
    const d = fs.readFileSync(file);
    await render(file, d.readUInt32BE(16), d.readUInt32BE(20), splash(d.readUInt32BE(16), d.readUInt32BE(20)));
  }
  fs.writeFileSync(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B1022</color>\n</resources>\n`);
}
await b.close();
console.log("ícones gerados");
