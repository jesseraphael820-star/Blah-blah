// Time of day, world events (meteor shower, traveling merchant, golden slime,
// night raids), discovery of locations, daily rewards and daily challenges.
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { HOUR_SECONDS } from '../world/sky.js';
import { POIS, LOC } from '../data/world.js';
import { CHALLENGES, DAILY_REWARDS } from '../data/quests.js';
import { dist2d, makeRng } from '../core/utils.js';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const yesterday = () => { const d = new Date(Date.now() - 864e5); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export class WorldEvents {
  constructor() {
    this.active = null;
    this.activeUntil = 0;
    this.nextEventIn = 3 + Math.random() * 3; // game hours
    this.discT = 0;
    this.starT = 0;
    this.raid = [];
    this.ensureChallenges();
  }
  get W() { return G.state.world; }
  gameHours() { return this.W.day * 24 + this.W.time; }

  // ---------- daily ----------
  canClaimDaily() { return G.state.daily.lastClaim !== today(); }
  claimDaily() {
    if (!this.canClaimDaily()) return;
    const d = G.state.daily;
    d.streak = d.lastClaim === yesterday() ? d.streak + 1 : 1;
    d.lastClaim = today();
    const r = DAILY_REWARDS[(d.streak - 1) % 7];
    G.prog.grant(r, { title: t('ui.dailyClaimed', { n: d.streak }) });
    G.audio.sfx('chest');
    G.game.autosave();
  }
  ensureChallenges() {
    const d = G.state.daily;
    if (d.challengesDay === today() && d.challenges.length) return;
    const rng = makeRng(Date.now() / 864e5 | 0);
    const pool = CHALLENGES.slice();
    const out = [];
    while (out.length < 3 && pool.length) {
      const c = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      if (out.some((o) => CHALLENGES.find((x) => x.id === o.id).stat === c.stat)) continue;
      out.push({ id: c.id, p: 0, claimed: false });
    }
    d.challenges = out;
    d.challengesDay = today();
  }
  challenges() { return G.state.daily.challenges.map((c) => ({ ...CHALLENGES.find((x) => x.id === c.id), ...c })); }
  track(stat, n) {
    for (const c of G.state.daily.challenges) {
      const def = CHALLENGES.find((x) => x.id === c.id);
      if (def && def.stat === stat && !c.claimed) {
        const before = c.p;
        c.p += n;
        if (before < def.n && c.p >= def.n) G.ui.toast(t('ui.challengeDone', { name: t('challenge.' + def.id, { n: def.n }) }), 'ach');
      }
    }
  }
  claimChallenge(i) {
    const c = G.state.daily.challenges[i];
    const def = CHALLENGES.find((x) => x.id === c.id);
    if (!c || c.claimed || c.p < def.n) return;
    c.claimed = true;
    G.prog.grant({ gold: def.gold, xp: def.xp }, { title: t('ui.challengeClaimed') });
    G.audio.sfx('quest');
  }

  // ---------- world events ----------
  startEvent(kind) {
    this.active = kind;
    const dur = { meteor: 2, merchant: 6, golden: 1.5, raid: 2 }[kind];
    this.activeUntil = this.gameHours() + dur;
    G.state.ach.stats.events++;
    G.audio.sfx('event');
    G.ui.banner(`<small>${t('ui.event')}</small><h2>${t('event.' + kind)}</h2><div class="bn-rewards">${t('event.' + kind + 'Desc')}</div>`, 'event', 4.5);
    const P = G.player.pos;
    if (kind === 'golden') {
      const a = Math.random() * 6.28;
      let x = P.x + Math.cos(a) * 22, z = P.z + Math.sin(a) * 22;
      if (G.physics.waterLevel(x, z) > G.physics.terrainHeight(x, z)) { x = P.x - Math.cos(a) * 22; z = P.z - Math.sin(a) * 22; }
      G.entities.enemies.spawn('golden_slime', x, z, { homeR: 20 });
    }
    if (kind === 'raid') {
      this.raid = [];
      const V = LOC.village;
      for (let i = 0; i < 5; i++) {
        const a = -1.2 + i * 0.4;
        const e = G.entities.enemies.spawn(i === 2 ? 'shadow_wolf' : 'wolf', V.x + Math.cos(a) * 50, V.z - Math.sin(a) * 50 - 10, { raid: true, homeR: 6 });
        e.home.set(V.x, 0, V.z);
        this.raid.push(e);
      }
      G.audio.sfx('howl', { vol: 1.3 });
    }
  }
  endEvent() {
    if (this.active === 'raid') {
      for (const e of this.raid) if (!e.dead) e.despawn = true;
    }
    this.active = null;
  }
  pickEvent() {
    const night = G.sky.isNight();
    const P = G.player.pos;
    const opts = [];
    if (night) opts.push('meteor');
    if (!night && this.W.time > 7 && this.W.time < 15) opts.push('merchant');
    opts.push('golden');
    if (night && dist2d(P.x, P.z, LOC.village.x, LOC.village.z) < 110 && G.state.quests.done.includes('main1')) opts.push('raid');
    return opts[Math.floor(Math.random() * opts.length)];
  }

  update(dt) {
    const W = this.W;
    // time flows
    const prev = W.time;
    W.time += dt / HOUR_SECONDS;
    if (W.time >= 24) { W.time -= 24; W.day++; G.bus.emit('newDay', W.day); }
    // events
    if (!G.sky.underground) {
      if (this.active) {
        if (this.gameHours() >= this.activeUntil) this.endEvent();
        else if (this.active === 'meteor') {
          this.starT -= dt;
          if (this.starT <= 0) {
            this.starT = 5 + Math.random() * 4;
            const a = Math.random() * 6.28, r = 12 + Math.random() * 30;
            const P = G.player.pos;
            const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
            if (G.physics.terrainHeight(x, z) > 0.5 && Math.abs(x) < 310 && Math.abs(z) < 310) G.pickups.spawnStar(x, z);
          }
        } else if (this.active === 'raid') {
          if (this.raid.length && this.raid.every((e) => e.dead)) {
            this.raid = [];
            G.prog.grant({ gold: 120, xp: 150, rep: { aurora: 12 } }, { title: t('event.raidWon') });
            this.endEvent();
          }
        }
      } else {
        this.nextEventIn -= dt / HOUR_SECONDS;
        if (this.nextEventIn <= 0) { this.nextEventIn = 5 + Math.random() * 5; this.startEvent(this.pickEvent()); }
      }
    }
    // discovery & fog of war
    this.discT -= dt;
    if (this.discT <= 0) {
      this.discT = 0.5;
      const P = G.player.pos;
      if (!G.sky.underground) G.mapSys.reveal(P.x, P.z);
      for (const p of POIS) {
        if (W.discovered.includes(p.id)) continue;
        const inCave = p.id === 'cave' && G.sky.underground;
        if (inCave || dist2d(P.x, P.z, p.x, p.z) < p.r) {
          W.discovered.push(p.id);
          G.audio.sfx('discover');
          G.ui.discoverBanner(p.id);
          G.prog.grant({ xp: p.xp, gold: p.gold }, { quiet: true });
        }
      }
    }
    if (prev < 6 && W.time >= 6 && G.sky.isNight() === false) this.ensureChallenges();
  }
}
