// Teste de fumaça com Playwright: inicia o servidor, abre o jogo, cria um novo jogo,
// anda, entra num carro, dirige, testa polícia e missões. Falha em qualquer erro de console.
// Uso: npm test   (requer Playwright instalado globalmente ou no projeto)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

const PORT = 8123;
const OUT = process.env.SHOTS || '';
const server = spawn(process.execPath, ['server.mjs', String(PORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = async (n) => { if (OUT) await page.screenshot({ path: `${OUT}/${n}.png` }); };
const wait = (ms) => page.waitForTimeout(ms);
const check = (cond, msg) => { if (!cond) { errors.push('ASSERT: ' + msg); console.log('✗', msg); } else console.log('✓', msg); };

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.game);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.game && document.querySelector('[data-act=new]'));
  await shot('01-title');
  await page.click('[data-act=new]');
  await page.click('[data-act=start]');
  await wait(1500);
  check(await page.evaluate(() => game.running && !game.paused), 'jogo iniciado');
  await shot('02-start');

  // andar
  const p0 = await page.evaluate(() => ({ x: game.player.x, y: game.player.y }));
  await page.keyboard.down('KeyD'); await page.keyboard.down('ShiftLeft'); await wait(700); await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft');
  const p1 = await page.evaluate(() => ({ x: game.player.x, y: game.player.y }));
  check(Math.hypot(p1.x - p0.x, p1.y - p0.y) > 40, 'jogador se move a pé');

  // garagem: retirar carro inicial
  await page.evaluate(() => game.takeFromGarage(0));
  await wait(300);
  check(await page.evaluate(() => !!game.player.vehicle), 'entrou no carro da garagem');
  await page.keyboard.down('KeyW'); await wait(2500);
  const sp = await page.evaluate(() => game.player.vehicle.kmh);
  check(sp > 30, `carro acelera (${sp} km/h)`);
  await page.keyboard.down('KeyA'); await wait(600); await page.keyboard.up('KeyA');
  await wait(1500); await page.keyboard.up('KeyW');
  await shot('03-driving');
  await page.keyboard.down('KeyS'); await wait(1500); await page.keyboard.up('KeyS');
  await page.keyboard.press('KeyF'); await wait(300);
  check(await page.evaluate(() => !game.player.vehicle), 'saiu do carro');

  // população do mundo
  await wait(2500);
  const pop = await page.evaluate(() => ({ v: game.vehicles.length, h: game.humans.length, ai: game.vehicles.filter((v) => v.ai).length }));
  check(pop.ai > 5 && pop.h > 5, `trânsito e pedestres ativos (${pop.ai} carros IA, ${pop.h} pessoas)`);

  // polícia
  await page.evaluate(() => game.police.setLevel(3));
  await wait(6000);
  const pol = await page.evaluate(() => ({ lvl: game.police.level, cars: game.vehicles.filter((v) => v.isPolice && v.ai && v.ai.mode !== 'patrol').length }));
  check(pol.lvl >= 2 && pol.cars >= 1, `polícia persegue (nível ${pol.lvl}, ${pol.cars} viaturas)`);
  await shot('04-police');
  await page.evaluate(() => game.police.clear());

  // missão s1 completa via teleporte
  await page.evaluate(() => { const d = game.missions.byId.s1; game.missions.start(d); });
  await wait(300);
  await page.evaluate(() => { const v = game.missions.active.spawned; game.player.x = v.x; game.player.y = v.y + 30; game.enterVehicle(v); });
  await wait(300);
  for (const key of ['plaza', 'oficina']) {
    await page.evaluate((k) => { const v = game.player.vehicle; const L = game.city.locations[k]; v.x = L.x; v.y = L.y; v.vx = v.vy = 0; }, key);
    await wait(400);
  }
  await wait(500);
  const done = await page.evaluate(() => game.missions.completed.has('s1') && game.ui.current === 'complete');
  check(done, 'missão s1 concluída com tela de conclusão');
  await shot('05-mission-complete');
  await page.click('[data-act=ok]');

  // noite
  await page.evaluate(() => { game.time.total = 14 * 60; });
  await wait(800);
  await shot('06-night');

  // pausa e mapa
  await page.keyboard.press('KeyM'); await wait(400);
  check(await page.evaluate(() => game.ui.current === 'pause'), 'mapa abre');
  await shot('07-map');
  await page.keyboard.press('Escape'); await wait(300);

  // salvamento
  await page.evaluate(() => game.autosave());
  check(await page.evaluate(() => !!JSON.parse(localStorage.getItem('portobrasa_save_v1')).completed.includes('s1')), 'salvamento automático');
} catch (e) {
  errors.push('exception: ' + e.message);
}

await browser.close();
server.kill();
if (errors.length) {
  console.error('\nFALHAS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nTodos os testes passaram.');
