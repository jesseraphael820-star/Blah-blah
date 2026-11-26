// Teste com entrada real de teclado: movimento, combate, menus, diálogo, idiomas e capturas de tela.
import { createRequire } from 'node:module';
import { createServer } from '../server.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const srv = createServer().listen(0); const port = srv.address().port;
const out = process.argv[2] || '/tmp';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
let fails = 0; const check = (c, m) => { if (!c) { fails++; console.error('✗', m); } else console.log('✓', m); };
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__game && window.__game.G.mode === 'title', null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out + '/title.png' });
// novo jogo pela interface
await page.click('#title .menu .btn:nth-child(2)');
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/newgame.png' });
await page.fill('#title input[type=text]', 'Lia');
await page.click('#title .btn.gold');
await page.waitForTimeout(500);
const skip = async () => { for (let i = 0; i < 60; i++) { const busy = await page.evaluate(() => { const G = window.__game.G; if (G.cut && !G.cut.waiting) G.cut.t = 999; if (G.card) G.card.t = G.card.dur; if (G.fade) G.fade.t = G.fade.dur; return !!(G.cut || G.card); }); if (!busy) break; await page.waitForTimeout(50); } };
await skip(); await page.waitForTimeout(400);
check(await page.evaluate(() => window.__game.G.name === 'Lia'), 'nome do personagem aplicado');
// conversa com Kael via tecla E
await page.evaluate(() => { const G = window.__game.G, k = window.__game.npcEntity('kael'); G.player.x = k.x; G.player.y = k.y + 16; G.player.dir = 3; });
await page.waitForTimeout(200);
await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
check(await page.evaluate(() => window.__game.G.mode === 'dialogue'), 'E abre diálogo com Kael');
await page.screenshot({ path: out + '/dialogue.png' });
for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(120); }
await page.keyboard.press('Digit1'); await page.waitForTimeout(150);
for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(120); }
check(await page.evaluate(() => window.__game.G.mode === 'play' && window.__game.G.quests.m1.stage >= 1), 'diálogo concluído avança a missão');
// sair da casa andando para baixo
await page.evaluate(() => { const g = window.__game; const [x, y] = g.markerPos(g.G.map.id, 'entry'); g.G.player.x = x; g.G.player.y = y - 20; });
const y0 = await page.evaluate(() => window.__game.G.player.y);
await page.keyboard.down('KeyS'); await page.waitForTimeout(1500); await page.keyboard.up('KeyS');
const st = await page.evaluate(() => ({ map: window.__game.G.map.id, y: window.__game.G.player.y }));
check(st.map === 'world', `andar para baixo sai da casa (mapa ${st.map})`);
const x0 = await page.evaluate(() => window.__game.G.player.x);
await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD');
check(await page.evaluate((x0) => window.__game.G.player.x > x0 + 15, x0), 'D move para a direita');
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/village.png' });
// combate: ataque, combo, rolagem
await page.evaluate(() => { window.__game.runActions({ give: 'w_iron_sword' }); window.__game.runActions({ give: 's_wood' }); });
await page.keyboard.press('KeyJ'); await page.waitForTimeout(60);
check(await page.evaluate(() => window.__game.G.player.state === 'attack'), 'J ataca');
await page.waitForTimeout(500);
await page.keyboard.press('Space'); await page.waitForTimeout(60);
check(await page.evaluate(() => window.__game.G.player.state === 'roll'), 'Espaço rola');
await page.waitForTimeout(500);
await page.keyboard.down('KeyK'); await page.waitForTimeout(100);
check(await page.evaluate(() => window.__game.G.player.state === 'block'), 'K bloqueia');
await page.keyboard.up('KeyK');
// inimigo + dano
await page.evaluate(() => { const G = window.__game.G; window.__game.runActions({ spawn: { e: 'bandit', at: [G.player.x + 14, G.player.y], map: G.player.mapId, tag: 'tst' } }); G.player.dir = 2; });
const hp0 = await page.evaluate(() => window.__game.G.entities.find((e) => e.tag === 'tst').hp);
for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(200); }
const hp1 = await page.evaluate(() => { const e = window.__game.G.entities.find((x) => x.tag === 'tst'); return e ? e.hp : -1; });
check(hp1 < hp0, `golpes causam dano (${hp0} → ${hp1})`);
await page.screenshot({ path: out + '/combat.png' });
await page.evaluate(() => { for (const e of window.__game.G.entities) if (e.tag === 'tst') e.removed = true; });
// menus
await page.keyboard.press('KeyI'); await page.waitForTimeout(300);
check(await page.evaluate(() => window.__game.G.mode === 'menu'), 'I abre inventário');
await page.screenshot({ path: out + '/menu_inventory.png' });
for (const tab of ['equipment', 'map', 'quests', 'characters', 'factions', 'achievements', 'settings', 'saveload']) {
  const idx = ['inventory', 'equipment', 'map', 'quests', 'characters', 'factions', 'achievements', 'settings', 'saveload'].indexOf(tab);
  await page.click(`#menu .tab:nth-child(${idx + 1})`); await page.waitForTimeout(250);
  if (['map', 'factions', 'settings', 'equipment'].includes(tab)) await page.screenshot({ path: out + `/menu_${tab}.png` });
}
await page.evaluate(() => { window.__game.G.flags.unlock_stratmap = true; });
await page.click('#menu .tab:nth-child(3)'); await page.waitForTimeout(200);
await page.click('#menu .maptools .btn:nth-child(2)'); await page.waitForTimeout(400);
await page.screenshot({ path: out + '/menu_political.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
check(await page.evaluate(() => window.__game.G.mode === 'play'), 'Esc fecha menu');
// idiomas: alternar todos e verificar textos
for (const l of ['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'ru', 'pl', 'tr', 'ar', 'hi', 'pt']) {
  const r = await page.evaluate((l) => { const G = window.__game.G; G.settings.lang = l; window.__game.emit('settingsChanged'); return { dir: document.documentElement.dir, txt: document.querySelector('#tracker .qt')?.textContent }; }, l);
  await page.waitForTimeout(300);
  const txt = await page.evaluate(() => document.querySelector('#tracker .qt')?.textContent || '');
  if (l === 'ar') check(r.dir === 'rtl', 'árabe ativa RTL');
  if (l === 'ja' || l === 'ar') { await page.screenshot({ path: out + `/lang_${l}.png` }); }
  check(txt.length > 0, `idioma ${l}: "${txt}"`);
}
// noite + chuva
await page.evaluate(() => { const G = window.__game.G; window.__game.changeMap('world', 'varden_plaza'); G.hour = 22; G.weatherForce = { rain: 1, storm: 1, wind: 0.8 }; });
await page.waitForTimeout(2500);
await page.screenshot({ path: out + '/night_rain.png' });
await page.evaluate(() => { const G = window.__game.G; G.hour = 12; G.weatherForce = null; window.__game.changeMap('world', 'ancient_oak'); });
await page.waitForTimeout(800);
await page.screenshot({ path: out + '/forest.png' });
for (const [k, m] of [['north', 'frostheim_plaza'], ['swamp', 'ravencross_plaza'], ['coast', 'solaria_plaza'], ['ash', 'cinzamar_plaza'], ['mountains', 'drakmor_plaza'], ['ruins', 'ruins_center']]) {
  await page.evaluate((m) => window.__game.changeMap('world', m), m); await page.waitForTimeout(700); await page.screenshot({ path: out + `/region_${k}.png` });
}
// salvar e carregar
const ok = await page.evaluate(() => { const g = window.__game; return g.save('1'); });
check(ok, 'salvar no espaço 1');
await page.evaluate(() => window.__game.loadGame('1')); await page.waitForTimeout(800);
check(await page.evaluate(() => window.__game.G.mode === 'play' && window.__game.G.name === 'Lia'), 'carregar restaura o jogo');
console.log(errs.length ? 'Erros:\n' + [...new Set(errs)].join('\n') : 'Sem erros no console');
await browser.close(); srv.close();
process.exit(fails || errs.length ? 1 : 0);
