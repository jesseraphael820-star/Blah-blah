// Drives the real Orbit app in Chromium and captures each stage as a screenshot.
const { chromium } = require('playwright');
const path = require('path');
const out = p => path.join(__dirname, '..', 'assets', p);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const log = [];
  page.on('console', m => log.push(m.text()));
  // stage: structure only (CSS blocked)
  await page.route('**/style.css', r => r.abort());
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.screenshot({ path: out('app_00_wire.png') });
  await page.unroute('**/style.css');
  await page.reload();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('app_01_empty.png') });
  const tasks = [['Definir a ideia do app', 'ideia'], ['Esboçar o layout', 'plano'], ['Listar requisitos', 'plano'],
    ['Escrever tasks.js', 'codigo'], ['Construir a interface', 'codigo'], ['Rodar node --test', 'testes'], ['Validar no navegador', 'testes']];
  let n = 2;
  for (const [t, s] of tasks) {
    await page.fill('#title', t);
    await page.selectOption('#stage', s);
    await page.click('button');
    await page.waitForTimeout(120);
    await page.screenshot({ path: out(`app_${String(n++).padStart(2, '0')}.png`) });
  }
  for (const id of [1, 2, 3, 4, 5, 6, 7]) {
    await page.click(`.card[data-id="${id}"]`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: out(`app_${String(n++).padStart(2, '0')}.png`) });
  }
  const pct = await page.textContent('#pct');
  console.log('final progress shown in UI:', pct, 'console errors:', log.length);
  await b.close();
})();
