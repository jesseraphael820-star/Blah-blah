// Teste de celular: detecção de dispositivo, joystick e botões de toque.
import { createRequire } from 'node:module';
import { createServer } from '../server.js';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const srv = createServer().listen(0); const port = srv.address().port;
const out = process.argv[2] || '/tmp';
const browser = await chromium.launch();
let fails = 0; const check = (c, m) => { if (!c) fails++; console.log(c ? '✓' : '✗', m); };
const errs = [];
// PC
const pc = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await pc.goto(`http://localhost:${port}/`); await pc.waitForFunction(() => window.__game && window.__game.G.mode === 'title');
check(await pc.evaluate(() => window.__game.G.device.type === 'pc'), 'PC detectado como pc');
check(await pc.evaluate(() => !document.body.classList.contains('touch-ui')), 'PC sem controles de toque');
// Celular deitado
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__game && window.__game.G.mode === 'title');
check(await page.evaluate(() => window.__game.G.device.type === 'mobile'), 'celular detectado: ' + await page.evaluate(() => window.__game.G.device.type));
await page.screenshot({ path: out + '/mobile_title.png' });
await page.evaluate(() => { window.__game.G.settings.textSpeed = 3; window.__game.newGame(); });
for (let i = 0; i < 60; i++) { await page.evaluate(() => { const G = window.__game.G; if (G.cut && !G.cut.waiting) G.cut.t = 999; if (G.card) G.card.t = G.card.dur; if (G.fade) G.fade.t = G.fade.dur; }); await page.waitForTimeout(40); }
await page.evaluate(() => { const g = window.__game; g.changeMap('world', 'varden_plaza'); g.runActions({ give: 'w_iron_sword' }); });
await page.waitForTimeout(500);
check(await page.evaluate(() => !document.getElementById('touch').classList.contains('hidden')), 'controles de toque visíveis no jogo');
const x0 = await page.evaluate(() => window.__game.G.player.x);
const z = await page.locator('.tzone').boundingBox();
const sx = z.x + 80, sy = z.y + z.height - 80;
await page.evaluate(([sx, sy]) => { const el = document.querySelector('.tzone'); const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); ev('pointerdown', sx, sy); ev('pointermove', sx + 50, sy); window.__ev = ev; }, [sx, sy]);
await page.waitForTimeout(800);
await page.screenshot({ path: out + '/mobile_play.png' });
await page.evaluate(([sx, sy]) => window.__ev('pointerup', sx + 50, sy), [sx, sy]);
const x1 = await page.evaluate(() => window.__game.G.player.x);
check(x1 > x0 + 20, `joystick move o personagem (${x0.toFixed(0)} → ${x1.toFixed(0)})`);
await page.locator('.tbtn[data-a=attack]').dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch' });
await page.waitForTimeout(50);
check(await page.evaluate(() => window.__game.G.player.state === 'attack'), 'botão ⚔ ataca');
await page.locator('.tbtn[data-a=attack]').dispatchEvent('pointerup', { pointerId: 9, pointerType: 'touch' });
await page.waitForTimeout(500);
await page.locator('.tbtn[data-a=menu]').dispatchEvent('pointerdown', { pointerId: 10, pointerType: 'touch' });
await page.waitForTimeout(150);
check(await page.evaluate(() => window.__game.G.mode === 'menu'), 'botão ☰ abre menu');
await page.screenshot({ path: out + '/mobile_menu.png' });
// celular em pé: aviso de girar
const p2 = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
await p2.goto(`http://localhost:${port}/`); await p2.waitForFunction(() => window.__game && window.__game.G.mode === 'title'); await p2.waitForTimeout(300);
check(await p2.evaluate(() => !document.querySelector('.trotate').classList.contains('hidden')), 'aviso para girar o celular em pé');
console.log(errs.length ? 'Erros: ' + errs.join('\n') : 'Sem erros');
await browser.close(); srv.close(); process.exit(fails || errs.length ? 1 : 0);
