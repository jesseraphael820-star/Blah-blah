// Quest engine: availability, step tracking (kill / collect / deliver / reach /
// interact / boss / chest / talk), rewards, markers and tracked objective.
import { G } from '../core/context.js';
import { QUESTS, QUEST_ORDER } from '../data/quests.js';
import { t } from '../core/i18n.js';
import { dist2d } from '../core/utils.js';
import { NODES } from '../data/npcs.js';
import { LOC } from '../data/world.js';

const BOSS_FLAG = { alpha_wolf: 'alphaDead', stone_guardian: 'guardianDead', golem_king: 'golemKingDead', primordial_shadow: 'shadowDead' };

export class Quests {
  constructor() {
    this.checkT = 0;
    G.bus.on('enemyKilled', (e) => this.onKill(e));
    G.bus.on('inventory', () => this.checkCollect());
    G.bus.on('chestOpened', (c) => this.onChest(c.id));
  }
  get s() { return G.state.quests; }
  def(id) { return QUESTS[id]; }
  isActive(id) { return !!this.s.active[id]; }
  isDone(id) { return this.s.done.includes(id); }
  stepIndex(id) { return this.s.active[id] ? this.s.active[id].step : -1; }
  isActiveStep(id, i) { return this.isActive(id) && this.s.active[id].step === i; }
  step(id) { const a = this.s.active[id]; return a ? QUESTS[id].steps[a.step] : null; }
  progress(id) { return this.s.active[id]?.progress || 0; }

  available(id) {
    const q = QUESTS[id];
    if (this.isActive(id) || this.isDone(id)) return false;
    if (q.req?.quests && !q.req.quests.every((r) => this.isDone(r))) return false;
    if (q.req?.level && G.state.player.level < q.req.level) return false;
    return true;
  }
  availableFrom(npc) { return QUEST_ORDER.filter((id) => QUESTS[id].giver === npc && this.available(id)); }

  start(id) {
    if (!this.available(id)) return;
    const q = QUESTS[id];
    this.s.active[id] = { step: 0, progress: 0 };
    if (q.onAccept) G.prog.grant(q.onAccept, { quiet: true });
    if (!this.s.tracked || q.type === 'main') this.s.tracked = id;
    G.audio.sfx('questStart');
    G.ui.questBanner(t('ui.questStarted'), t(`q.${id}.title`), q.type);
    this.enterStep(id);
    G.game.autosave();
  }

  enterStep(id) {
    const st = this.step(id);
    if (!st) return;
    // steps that may already be satisfied
    if (st.type === 'collect') this.checkCollect();
    if (st.type === 'chest' && G.state.world.chests.includes(st.chest)) this.advance(id);
    if (st.type === 'boss' && G.state.world.flags[BOSS_FLAG[st.enemy]] && st.enemy !== 'golem_king') { /* bosses respawn for active quest */ }
    if (st.type === 'interact' && st.target === 'pillar') {
      const n = [0, 1, 2].filter((i) => G.state.world.flags['pillar' + i]).length;
      this.s.active[id].progress = n;
      if (n >= st.n) this.advance(id);
    }
  }

  advance(id) {
    const a = this.s.active[id];
    if (!a) return;
    const q = QUESTS[id];
    const st = q.steps[a.step];
    if (st?.grant) G.prog.grant(st.grant, {});
    a.step++;
    a.progress = 0;
    if (a.step >= q.steps.length) { this.complete(id); return; }
    G.audio.sfx('pickup');
    G.ui.objectiveUpdated(id);
    this.enterStep(id);
    G.game.autosave();
  }

  complete(id) {
    const q = QUESTS[id];
    delete this.s.active[id];
    this.s.done.push(id);
    if (this.s.tracked === id) this.s.tracked = this.pickTracked();
    G.audio.sfx('quest');
    G.ui.questBanner(t('ui.questComplete'), t(`q.${id}.title`), q.type, q.rewards);
    G.prog.grant(q.rewards, { at: G.player.pos });
    if (q.type === 'side') G.state.ach.stats.sideDone = (G.state.ach.stats.sideDone || 0) + 1;
    if (id === 'main6') { G.state.ach.stats.storyDone = 1; G.ui.showEnding(); }
    G.bus.emit('questCompleted', id);
    G.game.autosave();
  }
  pickTracked() {
    const ids = Object.keys(this.s.active);
    return ids.find((i) => QUESTS[i].type === 'main') || ids[0] || null;
  }
  abandon(id) {
    if (!this.isActive(id) || QUESTS[id].type === 'main') return;
    delete this.s.active[id];
    if (this.s.tracked === id) this.s.tracked = this.pickTracked();
  }

  // ---------- event hooks ----------
  onKill(e) {
    if (e.boss) {
      const f = BOSS_FLAG[e.type];
      if (f) G.state.world.flags[f] = true;
      const st = G.state.ach.stats;
      if (!st.bosses.includes(e.type)) st.bosses.push(e.type);
    }
    for (const id of Object.keys(this.s.active)) {
      const st = this.step(id);
      if (!st) continue;
      if ((st.type === 'kill' && st.enemy.includes(e.type)) || (st.type === 'boss' && st.enemy === e.type)) {
        const a = this.s.active[id];
        a.progress++;
        if (a.progress >= st.n) this.advance(id);
        else G.ui.objectiveUpdated(id);
      }
    }
  }
  checkCollect() {
    for (const id of Object.keys(this.s.active)) {
      const st = this.step(id);
      if (!st || st.type !== 'collect') continue;
      const c = G.inv.count(st.item);
      const a = this.s.active[id];
      if (c !== a.progress) { a.progress = Math.min(c, st.n); G.ui.objectiveUpdated(id); }
      if (c >= st.n) this.advance(id);
    }
  }
  onChest(cid) {
    for (const id of Object.keys(this.s.active)) {
      const st = this.step(id);
      if (st && st.type === 'chest' && st.chest === cid) this.advance(id);
    }
  }
  tryInteract(target) {
    for (const id of Object.keys(this.s.active)) {
      const st = this.step(id);
      if (st && st.type === 'interact' && st.target === target) {
        const a = this.s.active[id];
        a.progress++;
        if (a.progress >= st.n) this.advance(id);
        else G.ui.objectiveUpdated(id);
        return true;
      }
    }
    return false;
  }
  // talk/deliver steps waiting at this NPC
  talkSteps(npc) {
    const out = [];
    for (const id of Object.keys(this.s.active)) {
      const st = this.step(id);
      if (st && (st.type === 'talk' || st.type === 'deliver') && st.npc === npc) out.push({ id, st, idx: this.stepIndex(id) });
    }
    return out;
  }
  completeTalk(id) {
    const st = this.step(id);
    if (!st) return false;
    if (st.type === 'deliver') {
      if (G.inv.count(st.item) < st.n) return false;
      G.inv.remove(st.item, st.n);
    }
    this.advance(id);
    return true;
  }

  markerFor(npc) {
    const ts = this.talkSteps(npc);
    if (ts.length) return QUESTS[ts[0].id].type === 'main' ? 'turnin' : 'turninSide';
    const av = this.availableFrom(npc);
    if (av.length) return QUESTS[av[0]].type === 'main' ? 'offerMain' : 'offerSide';
    return null;
  }

  // ---------- objective text & target ----------
  objectiveText(id) {
    const st = this.step(id);
    if (!st) return '';
    const a = this.s.active[id];
    const base = t(`q.${id}.s${a.step}`);
    if (st.n && st.n > 1) return `${base} (${Math.min(a.progress, st.n)}/${st.n})`;
    return base;
  }
  target(id) {
    const st = this.step(id);
    if (!st) return null;
    const underground = G.sky.underground;
    if (st.npc) {
      const n = G.entities.npcs.get(st.npc);
      if (n) return { x: n.pos.x, z: n.pos.z, y: n.pos.y };
    }
    if (st.at === 'caveBoss' || st.at === 'cavePedestal') {
      if (!underground) return { x: LOC.caveEntrance.x, z: LOC.caveEntrance.z };
      const c = G.cave;
      const p = st.at === 'caveBoss' ? c.boss : c.pedestal;
      return { x: p.x, z: p.z };
    }
    if (Array.isArray(st.at)) {
      if (underground) return { x: G.cave.entry.x, z: G.cave.entry.z };
      return { x: st.at[0], z: st.at[1] };
    }
    return null;
  }

  update(dt) {
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 0.3;
    const P = G.player.pos;
    for (const id of Object.keys(this.s.active)) {
      const st = this.step(id);
      if (!st || st.type !== 'reach') continue;
      if (st.night && !G.sky.isNight()) continue;
      if (st.minY && P.y < st.minY) continue;
      if (dist2d(P.x, P.z, st.at[0], st.at[1]) < st.r) this.advance(id);
    }
  }
}
export { NODES };
