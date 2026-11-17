// Teste de todas as missões: executa cada etapa (teleportando o jogador para os
// objetivos) e verifica conclusão, recompensa e ausência de erros.
// Uso: node tests/missions.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }

const PORT = 8124;
const server = spawn(process.execPath, ['server.mjs', String(PORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => window.game);
await page.evaluate(() => { localStorage.clear(); game.newGame('duda'); });
await page.waitForTimeout(500);

// Auxiliares executados dentro da página
await page.evaluate(() => {
  const g = window.game;
  window.T = {
    place(x, y) {
      const v = g.player.vehicle;
      if (v) { v.x = x; v.y = y; v.vx = 0; v.vy = 0; v.updateCircles(); }
      else { g.player.x = x; g.player.y = y; }
      g.camera.snap(x, y);
    },
  };
});

const results = [];
const ids = await page.evaluate(() => game.missions.defs.map((d) => d.id));
for (const id of ids) {
  const r = await page.evaluate(async (id) => {
    const g = window.game, M = g.missions;
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const d = M.byId[id];
    if (g.ui.open) g.ui.close();
    g.police.clear();
    if (g.player.vehicle) { g.player.vehicle.vx = g.player.vehicle.vy = 0; g.exitVehicle(); }
    g.player.health = g.player.maxHealth;
    // garante pré-requisitos
    const before = g.money;
    M.start(d);
    const log = [];
    let guard = 0;
    while (M.active && M.active.def === d && guard++ < 40) {
      const a = M.active, s = M.step, i = a.i;
      const pv = () => g.player.vehicle;
      const VehicleCls = g.vehicles[0]?.constructor;
      const spawnCar = (model) => {
        const V = VehicleCls || (a.spawned && a.spawned.constructor);
        const v = new V(model || 'brisa', g.player.x + 40, g.player.y, 0);
        g.addVehicle(v);
        g.player.x = v.x; g.player.y = v.y + 25;
        g.enterVehicle(v);
      };
      log.push(s.t);
      switch (s.t) {
        case 'enter': {
          let v = s.use === 'target' ? a.target : a.spawned;
          if (g.player.vehicle && g.player.vehicle !== v) { g.player.vehicle.vx = g.player.vehicle.vy = 0; g.exitVehicle(); }
          if (v) { g.player.x = v.x; g.player.y = v.y + v.m.w; g.enterVehicle(v); }
          else spawnCar(s.model);
          break;
        }
        case 'goto': case 'dropoff': {
          if (s.mode === 'foot' && pv()) { pv().vx = pv().vy = 0; g.exitVehicle(); }
          if ((s.mode === 'vehicle' || s.t === 'dropoff') && !pv()) spawnCar();
          T.place(s.at.x, s.at.y);
          break;
        }
        case 'pickup': {
          if (!pv()) spawnCar('taxi');
          const h = a.passenger;
          T.place(h.x + 30, h.y);
          break;
        }
        case 'race': {
          if (!pv()) spawnCar();
          for (const p of s.pts) { T.place(p.x, p.y); await sleep(120); }
          break;
        }
        case 'collect': {
          if (s.mode === 'foot' && pv()) { pv().vx = pv().vy = 0; g.exitVehicle(); }
          for (const p of s.pts) { T.place(p.x, p.y); await sleep(150); }
          break;
        }
        case 'lose': g.police.clear(); break;
        case 'speed': {
          if (!pv()) spawnCar('faisca');
          const v = pv(); const sp = s.kmh / 0.4 + 15;
          v.vx = Math.cos(v.a) * sp; v.vy = Math.sin(v.a) * sp;
          break;
        }
        case 'chase': {
          if (!pv()) spawnCar('raio');
          a.target.hp = a.target.maxHp * 0.3;
          break;
        }
      }
      // espera a etapa avançar
      for (let k = 0; k < 60 && M.active && M.active.def === d && M.active.i === i; k++) await sleep(100);
      if (M.active && M.active.def === d && M.active.i === i) { return { id, ok: false, stuckAt: `${i}:${s.t}`, obj: M.objective(), log }; }
    }
    await sleep(200);
    const ok = M.completed.has(id) && g.ui.current === 'complete';
    const reward = g.money - before;
    if (g.ui.open) { if (d.final) { g.ui.handlers.ok(); await sleep(100); } g.ui.close(); }
    return { id, ok, reward, log };
  }, id);
  results.push(r);
  console.log(r.ok ? '✓' : '✗', r.id, r.ok ? `+$${r.reward}` : `travou em ${r.stuckAt} (${r.obj})`, r.log.join('→'));
}

// salvar/carregar
const saved = await page.evaluate(() => { game.autosave(); return JSON.parse(localStorage.getItem('portobrasa_save_v1')); });
const loadOk = await page.evaluate(() => { game.quitToTitle(); game.continueGame(); return game.missions.completed.size; });
console.log(loadOk === saved.completed.length ? '✓' : '✗', `salvar/carregar (${loadOk} missões)`);

await browser.close();
server.kill();
const failed = results.filter((r) => !r.ok);
if (failed.length || errors.length || loadOk !== saved.completed.length) {
  console.error('FALHAS:', failed.map((f) => f.id), errors);
  process.exit(1);
}
console.log(`\nTodas as ${results.length} missões concluídas com sucesso.`);
