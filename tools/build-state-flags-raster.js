// Converte os SVGs (dados) em PNG 72x48 usando <img> + canvas (SVG em <img> não executa script).
const { chromium } = require('playwright'); const fs = require('fs');
const svgs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.setContent('<html><body></body></html>');
  const res = await p.evaluate(async svgs => { const out = {};
    for (const [uf, svg] of Object.entries(svgs)) {
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      try { await img.decode(); } catch (e) { out[uf] = null; continue; }
      const cv = document.createElement('canvas'); cv.width = 72; cv.height = 48; cv.getContext('2d').drawImage(img, 0, 0, 72, 48); out[uf] = cv.toDataURL('image/png');
    } return out; }, svgs);
  await b.close(); fs.writeFileSync(process.argv[3], JSON.stringify(res));
  console.log('falharam:', Object.keys(res).filter(k => !res[k]).join(',') || 'nenhuma', '| tamanho', fs.statSync(process.argv[3]).size);
  // folha para conferir
  const b2 = await chromium.launch(); const p2 = await b2.newPage({ viewport: { width: 900, height: 420 } });
  await p2.setContent('<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:6px;padding:6px;font:11px sans-serif;color:#fff">' + Object.entries(res).map(([k, v]) => `<div style="text-align:center"><img src="${v}" width="96" height="64" style="display:block;border:1px solid #000">${k}</div>`).join('') + '</body>');
  await p2.waitForTimeout(300); await p2.screenshot({ path: process.argv[4] }); await b2.close();
})();
