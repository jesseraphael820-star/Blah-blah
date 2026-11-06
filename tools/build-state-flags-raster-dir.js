// Converte uma pasta de SVGs (dados) em PNG 72x48 usando <img> + canvas (SVG em <img> não executa script).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const dir = process.argv[2], out = process.argv[3];
const svgs = {};
for (const f of fs.readdirSync(dir)) if (f.endsWith('.svg')) svgs[f.slice(0, -4)] = fs.readFileSync(path.join(dir, f), 'utf8');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); await p.setContent('<html><body></body></html>');
  const res = await p.evaluate(async svgs => {
    const out = {};
    for (const [k, svg] of Object.entries(svgs)) {
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      try { await img.decode(); } catch (e) { continue; }
      const cv = document.createElement('canvas'); cv.width = 72; cv.height = 48;
      cv.getContext('2d').drawImage(img, 0, 0, 72, 48); out[k] = cv.toDataURL('image/png');
    }
    return out;
  }, svgs);
  fs.writeFileSync(out, JSON.stringify(res));
  console.log(Object.keys(res).length, 'de', Object.keys(svgs).length, 'convertidas;', fs.statSync(out).size, 'bytes');
  const keys = Object.keys(res).sort(); const p2 = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p2.setContent('<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:4px;padding:4px;font:9px sans-serif;color:#fff">' + keys.map(k => `<div style="text-align:center"><img src="${res[k]}" width="54" height="36" style="display:block">${k}</div>`).join('') + '</body>');
  await p2.waitForTimeout(400); await p2.screenshot({ path: out.replace('.json', '.png'), fullPage: true });
  await b.close();
})();
