// Jogada automatizada: percorre as 25 missões principais e as secundárias usando os sistemas reais do jogo
// (diálogos, viagens, combate, itens, alavancas, capturas, cenas) e relata travamentos e erros.
import { createRequire } from 'node:module';
import { createServer } from '../server.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.argv[2] || '/tmp';
const ENDING = Number(process.argv[3] || 0);
const srv = createServer().listen(0); const port = srv.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); if (m.type() === 'warning' && !/AudioContext/.test(m.text())) errs.push('warn: ' + m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__game && window.__game.G.mode === 'title', null, { timeout: 30000 });
await page.evaluate(() => { localStorage.clear(); window.__game.G.settings.textSpeed = 3; window.__game.newGame(); });

await page.evaluate((ENDING) => {
  const g = window.__game, G = g.G;
  window.__bot = { log: [], stalls: [], lastKey: '', same: 0, phase: 'main', ending: ENDING, shots: [] };
  const B = window.__bot;
  const near = (map, x, y) => { g.changeMap(map, [x, y + 18], { sfx: false }); };
  const findEnt = (pred) => G.entities.find((e) => !e.removed && !e.dead && pred(e));
  function satisfy(id, i, o) {
    const p = G.player;
    switch (o.t) {
      case 'talk': {
        let e = o.npc ? g.npcEntity(o.npc) : findEnt((x) => x.questVillager === o.dlg);
        if (!e) { if (o.dlg && !o.npc) return 'wait-dlg-entity'; return 'no-entity'; }
        if (e.mapId === '__hidden') return 'npc-hidden:' + o.npc;
        if (!o.npc && !e.questVillager) return 'wait';
        near(e.mapId, e.x, e.y); p.face(e.x, e.y);
        const dl = o.npc ? g.questDialogueFor(o.npc) : e.questVillager;
        if (o.npc && !dl) return 'no-dialogue-for:' + o.npc;
        g.doInteract({ kind: 'talk', target: e }); return 'talk';
      }
      case 'goto': g.changeMap(o.map || 'world', o.at, { sfx: false }); return 'goto';
      case 'kill': case 'killAll': {
        if (o.kind && !o.tag) { g.runActions({ spawn: { e: 'animal:' + o.kind, at: [p.x + 40, p.y], map: p.mapId, tag: 'botk' } }); const e = findEnt((x) => x.tag === 'botk'); if (e) e.die(p); return 'kill-kind'; }
        const es = G.entities.filter((e) => e.tag === o.tag && !e.dead && !e.removed);
        if (!es.length) return 'no-targets:' + o.tag;
        const e = es[0]; if (e.mapId !== p.mapId) near(e.mapId, e.x, e.y);
        for (const x of es) { if (x.noKill) { x.hp = x.maxHp * 0.31; x.takeDamage(20, p, 0); } else x.die(p); }
        return 'kill';
      }
      case 'collect': g.addItem(o.item, o.n || 1); return 'collect';
      case 'interact': {
        for (const m of Object.values(G.maps)) for (const ob of m.objects) if (ob.qid === o.id && !ob.removed) { near(m.id, ob.x, ob.y); g.doInteract({ kind: 'qprop', target: ob }); return 'interact'; }
        const c = findEnt((x) => x.catchId === o.id); if (c) { near(c.mapId, c.x, c.y); g.doInteract({ kind: 'catch', target: c }); return 'catch'; }
        return 'no-object:' + o.id;
      }
      case 'capture': {
        const T = G.world.objects.filter((ob) => ob.isFlag);
        for (const f of T) { const own = G.territory[f.territory]; if (own === 'drakmor') { near('world', f.x, f.y); g.setOwner(f.territory, 'varden'); G.stats.captures++; g.emit('capture', f.territory); return 'capture:' + f.territory; } }
        return 'no-capture-target';
      }
      case 'flag': {
        if (o.flag === 'tomb_gate_open') { const m = g.getMap('ruins_tomb'); for (const ob of [...m.objects]) if (ob.kind === 'lever' && !G.flags[ob.lever]) { near('ruins_tomb', ob.x, ob.y); g.doInteract({ kind: 'lever', target: ob }); } return 'levers'; }
        if (o.flag.startsWith('yield_')) { const e = findEnt((x) => x.tag === o.flag.slice(6)); if (!e) return 'no-yield-target'; near(e.mapId, e.x, e.y); e.hp = e.maxHp * 0.31; e.takeDamage(30, p, 0); return 'yield'; }
        if (o.flag === 'nevoa_owned') { const h = findEnt((x) => x.tag === 'sqnevoa'); if (!h) return 'no-nevoa'; g.addItem('apple', 2); near(h.mapId, h.x, h.y); g.doInteract({ kind: 'tame', target: h }); return 'tame'; }
        if (o.flag === 'child_found') { const e = findEnt((x) => x.questVillager === 'sq_child_found'); if (!e) return 'no-child'; near(e.mapId, e.x, e.y); g.doInteract({ kind: 'talk', target: e }); return 'child'; }
        return 'wait-flag:' + o.flag;
      }
      case 'dummy': g.changeMap('world', 'varden_training', { sfx: false }); for (let k = 0; k < (o.n || 1); k++) g.emit('dummyHit', {}); return 'dummy';
      case 'mount': { const h = G.activeHorse; if (!h) return 'no-horse'; near(h.mapId, h.x, h.y); g.doInteract({ kind: 'mount', target: h }); g.dismount(); return 'mount'; }
      case 'fish': g.emit('fished'); return 'fish';
    }
    return 'unknown';
  }
  window.__botStep = () => {
    const doc = document;
    if (G.mode === 'ending') { const b = doc.querySelector('#ending .btn'); if (b) b.click(); return 'ending'; }
    if (G.mode === 'credits') { const b = doc.querySelector('#credits .btn'); if (b) b.click(); return 'credits'; }
    if (G.mode === 'dead') { g.emit('respawn'); return 'dead'; }
    if (G.card) G.card.t = G.card.dur;
    if (G.fade) G.fade.t = G.fade.dur;
    if (G.dialogue) {
      if (G.dialogue.choices) { const n = G.dialogue.id === 'final_choice' ? B.ending : 0; g.chooseOption(n); }
      else { G.dialogue.shown = 1e9; G.dialogue.typing = false; g.advance(); }
      return 'dlg';
    }
    if (G.cut) { if (!G.cut.waiting) G.cut.t = 999; if (G.playerGoal) { G.player.x = G.playerGoal.x; G.player.y = G.playerGoal.y; G.playerGoal = null; } return 'cut'; }
    if (G.mode === 'menu' || G.mode === 'shop') { G.mode = 'play'; document.getElementById('menu').classList.add('hidden'); return 'menu'; }
    if (G.mode !== 'play') return 'mode:' + G.mode;
    const p = G.player; p.hp = p.maxHp; p.invuln = 1;
    // missão alvo
    let id = null;
    const act = Object.keys(G.quests).filter((k) => G.quests[k].state === 'active');
    if (B.phase === 'main') id = act.find((k) => g.QUESTS[k].type === 'main');
    else id = act.find((k) => g.QUESTS[k].type === 'side');
    if (!id) {
      if (B.phase === 'main') { if (G.quests.m25 && G.quests.m25.state === 'done' && G.flags.gameComplete) { B.phase = 'side'; return 'to-side'; } return 'waiting-next'; }
      // iniciar próxima secundária
      const next = Object.keys(g.QUESTS).find((k) => g.QUESTS[k].type === 'side' && !G.quests[k] && !B.skip?.[k]);
      if (!next) return 'done';
      const q = g.QUESTS[next]; const e = g.npcEntity(q.giver);
      if (!e || e.mapId === '__hidden' || !g.sideOfferFor(q.giver)) { B.skip = B.skip || {}; B.skip[next] = 1; B.stalls.push(`${next}: oferta indisponível (giver ${q.giver} em ${e && e.mapId})`); return 'skip'; }
      g.changeMap(e.mapId, [e.x, e.y + 18], { sfx: false });
      g.doInteract({ kind: 'talk', target: e }); return 'offer:' + next;
    }
    const q = g.QUESTS[id], st = G.quests[id], S = q.stages[st.stage];
    const os = S.obj || [];
    let idx = os.findIndex((o, i) => !g.objDone(id, i) && (!o.req || o.req.every((j) => g.objDone(id, j))));
    if (idx < 0) idx = os.findIndex((o, i) => !g.objDone(id, i));
    if (idx < 0) return 'stage-complete-wait';
    const key = `${id}:${st.stage}:${idx}`;
    if (key === B.lastKey) B.same++; else { B.same = 0; B.lastKey = key; B.log.push(key); }
    const r = satisfy(id, idx, os[idx]);
    if (B.same > 60) { B.stalls.push(`${key} (${os[idx].t}) → ${r}`); st.c[idx] = 999; if (os[idx].t === 'flag') G.flags[os[idx].flag] = true; g.emit('flagsChanged'); B.same = 0; }
    return key + ' ' + r;
  };
}, ENDING);

const t0 = Date.now();
let last = '', n = 0, shot = 0;
const shotsAt = { 'm2:2': 'wolves', 'm5:4': 'horse', 'm7:2': 'tomb', 'm12:3': 'battle', 'm13:2': 'siege', 'm19:4': 'betrayal', 'm20:3': 'refuge', 'm24:3': 'liberation', 'm25:4': 'vargan' };
while (Date.now() - t0 < 900000) {
  const r = await page.evaluate(() => window.__botStep());
  n++;
  if (r !== last && !/^dlg|^cut/.test(r)) { last = r; if (process.env.VERBOSE) console.log(r); }
  const k = (r.match(/^(\w+:\d+):/) || [])[1];
  if (k && shotsAt[k]) { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/play_${shotsAt[k]}.png` }); delete shotsAt[k]; }
  if (r === 'done') break;
  await page.waitForTimeout(r.startsWith('dlg') || r.startsWith('cut') ? 15 : 60);
}
const res = await page.evaluate(() => { const G = window.__game.G; const Q = window.__game.QUESTS; return { done: Object.keys(G.quests).filter((k) => G.quests[k].state === 'done'), active: Object.keys(G.quests).filter((k) => G.quests[k].state === 'active'), stalls: window.__bot.stalls, ending: G.ending, ach: Object.keys(G.achievements), territory: G.territory, level: G.player.level, total: Object.keys(Q).length }; });
console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(0)}s, passos ${n}`);
console.log(`Concluídas ${res.done.length}/${res.total}: ${res.done.join(' ')}`);
console.log('Ativas:', res.active.join(' '));
console.log('Final:', res.ending, '· Nível', res.level, '· Conquistas:', res.ach.join(', '));
console.log('Travamentos:\n  ' + (res.stalls.join('\n  ') || 'nenhum'));
console.log('Erros:\n  ' + ([...new Set(errs)].slice(0, 30).join('\n  ') || 'nenhum'));
await page.screenshot({ path: `${OUT}/play_end.png` });
await browser.close(); srv.close();
process.exit(res.stalls.length || errs.length ? 1 : 0);
