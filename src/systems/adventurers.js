// Adventurers: people of the Wild Lands with their own strength and genetics
// (lineage). Become friends with them and, once friends, ask them to join you:
// they follow you and fight by your side. Rankings show the strongest people
// and the strongest genetics.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { Humanoid } from '../entities/character.js';
import { GeneAura, AURA } from '../render/auras.js';
import { makeRng, dist2d, dampAngle, shade } from '../core/utils.js';

// genetics: power multiplier, look, combat style
export const GENES = {
  human:      { mult: 1.0, icon: '🧑', color: '#c8b8a0', ranged: false },
  beast:      { mult: 1.12, icon: '🐺', color: '#c8955a', ranged: false },
  magic:      { mult: 1.25, icon: '✨', color: '#b66cff', ranged: true, proj: 0xb66cff },
  ghost:      { mult: 1.22, icon: '👻', color: '#cfe8ff', ranged: true, proj: 0xcfe8ff },
  tech:       { mult: 1.3, icon: '⚙️', color: '#4fd0ff', ranged: true, proj: 0x4fd0ff },
  elemental:  { mult: 1.32, icon: '🔥', color: '#ff8a2a', ranged: true, proj: 0xff6a1a },
  shadow:     { mult: 1.36, icon: '🌑', color: '#8a5aa8', ranged: false },
  dragon:     { mult: 1.45, icon: '🐉', color: '#e8414e', ranged: true, proj: 0xff4a2a },
  angel:      { mult: 1.5, icon: '😇', color: '#fff0b0', ranged: true, proj: 0xfff0b0 },
  ancestral:  { mult: 1.7, icon: '🗿', color: '#ffc83a', ranged: false },
};
export const PLAYER_GENE = 'aurora';
export const CLASSES = [
  { id: 'weak', min: 0, color: '#a9b2c3' },
  { id: 'medium', min: 120, color: '#5fe0a0' },
  { id: 'strong', min: 260, color: '#4aa8ff' },
  { id: 'elite', min: 450, color: '#b66cff' },
  { id: 'legendary', min: 700, color: '#ffc83a' },
];
export function classOf(power) { let c = CLASSES[0]; for (const k of CLASSES) if (power >= k.min) c = k; return c; }
export const FRIEND_TIERS = [{ id: 'stranger', min: 0 }, { id: 'known', min: 20 }, { id: 'friend', min: 50 }, { id: 'best', min: 85 }];
export function friendTier(v) { let f = FRIEND_TIERS[0]; for (const k of FRIEND_TIERS) if (v >= k.min) f = k; return f; }

const NAMES = ['Kaelen', 'Mirela', 'Duarte', 'Yara', 'Tobias', 'Nina', 'Orion', 'Selene', 'Bruma', 'Ícaro', 'Valquíria', 'Thoran', 'Zéfiro', 'Lumi', 'Ragnar', 'Aurélio', 'Nyx', 'Cael'];
// fixed so each save has the same people: [gene, level, spot x, z]
const ROSTER = [
  ['ancestral', 24, 8, 10], ['angel', 18, 40, 60], ['dragon', 20, 255, 115], ['tech', 14, 14, -2], ['magic', 12, -6, -8],
  ['ghost', 11, 112, -80], ['shadow', 16, -150, 20], ['elemental', 13, 85, -10], ['beast', 9, -100, 120], ['human', 4, -70, 80],
  ['human', 7, 160, 90], ['beast', 5, -30, 130], ['magic', 8, -220, 175], ['tech', 6, 200, 160], ['ghost', 15, -175, -185],
  ['human', 3, 50, 30], ['angel', 10, 30, -60], ['ancestral', 28, -60, -250],
];

function lookFor(gene, rng) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const skin = pick([0xf8d8b8, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524]);
  const base = { pal: { skin, hair: pick([0x2a1a10, 0x5a3a22, 0xd0a050, 0x3a3a3a, 0xb83a2a]), eye: pick([0x2b4a7a, 0x3a2a1a, 0x3a7a3a]), shirt: pick([0x3f7fbf, 0x4a9a4a, 0x8a5a32, 0x7a4ab0]), pants: pick([0x4a3b2a, 0x2a2a3a, 0x5a6a7a]), shoes: 0x2a1f16 }, hairStyle: pick(['short', 'long', 'spiky', 'ponytail', 'messy', 'braid']), hat: 'none', acc: 'none' };
  const P = base.pal;
  switch (gene) {
    case 'magic': Object.assign(P, { shirt: 0x5a2a8a, pants: 0x2a1a4a, trim: 0xffc83a }); base.hat = 'wizard'; break;
    case 'ghost': Object.assign(P, { skin: 0xdce8f4, hair: 0xf0f4ff, shirt: 0xcfe0f0, pants: 0xb8c8dc, shoes: 0xa8b8cc, eye: 0x6ac8ff }); base.glow = 0x9ad8ff; base.ghost = true; break;
    case 'angel': Object.assign(P, { shirt: 0xfff8e8, pants: 0xf0e8d0, shoes: 0xe8d8a8, hair: 0xffe08a, trim: 0xffc83a }); base.acc = 'wings'; base.glow = 0xffe8a0; base.halo = true; break;
    case 'ancestral': Object.assign(P, { skin: 0xc8a878, shirt: 0x8a6a2a, pants: 0x5a4a2a, trim: 0xffc83a, hair: 0xe8e8e8, eye: 0xffc83a }); base.hat = 'crown'; base.beard = true; base.armor = 'guardian'; base.crownGlow = true; break;
    case 'tech': Object.assign(P, { shirt: 0x5a6a7a, pants: 0x3a4a5a, trim: 0x4fd0ff, eye: 0x4fd0ff }); base.acc = 'backpack'; base.glasses = true; base.armor = 'chain'; base.visor = true; break;
    case 'elemental': Object.assign(P, { shirt: 0xc8461a, pants: 0x5a1e10, trim: 0xffd15c, hair: 0xff8a2a }); base.glow = 0xff7a2a; break;
    case 'shadow': Object.assign(P, { shirt: 0x1e1a28, pants: 0x141018, shoes: 0x0a080c, trim: 0x8a3aaa, eye: 0xff3a6a }); base.hat = 'hood'; base.acc = 'cape'; base.capeColor = 0x2a1a3a; break;
    case 'dragon': Object.assign(P, { shirt: 0x8a1e1e, pants: 0x3a1010, trim: 0xffc83a, hair: 0x6a0a0a, eye: 0xffc83a }); base.armor = 'knight'; base.horns = true; break;
    case 'beast': Object.assign(P, { hair: 0x8a5a2a, shirt: 0x6a4a2a, pants: 0x4a3a20 }); base.hairStyle = 'messy'; base.ears = true; break;
    default: break;
  }
  return base;
}

class Adventurer {
  constructor(i, data, saved) {
    this.i = i;
    this.gene = data[0];
    this.baseLevel = data[1];
    const rng = makeRng(5000 + i * 97);
    this.name = NAMES[i % NAMES.length];
    this.home = { x: data[2], z: data[3] };
    this.look = lookFor(this.gene, rng);
    this.m = new Humanoid(this.look);
    G.scene.add(this.m.root);
    this.pos = new THREE.Vector3(this.home.x, G.physics.groundAt(this.home.x, this.home.z, 200), this.home.z);
    if (AURA[this.gene]) { const self = this; this.aura = new GeneAura({ pos: this.pos, get model() { return self.m; }, look: this.look, name: this.name }, this.gene); }
    this.yaw = rng() * 6.28;
    this.def = { pitch: 0.8 + rng() * 0.6, scale: 1 };
    this.id = 'adv_' + i;
    this.lk = 'adventurer';
    this.talking = false;
    this.s = saved; // { friend, lastTalk, follow, helpUntil }
    this.wait = rng() * 4;
    this.atkCd = 0; this.atkT = 0;
    G.world.addInteractable({
      kind: 'adventurer', x: 0, y: 0, z: 0, r: 3, dynamic: true, pos: () => this.pos,
      label: () => t('ui.talkTo', { name: this.name }),
      can: () => !this.talking,
      act: () => G.adventurers.talk(this),
    });
  }
  get visible() { return true; }
  get model() { return this.m; }
  get role() { return `${GENES[this.gene].icon} ${t('gene.' + this.gene)} · ${t('cls.' + this.cls().id)}`; }
  level() { return Math.min(40, this.baseLevel + Math.floor((G.state.world.day - 1) / 3)); }
  power() { return Math.round(this.level() * 10 * GENES[this.gene].mult + this.baseLevel * 3); }
  cls() { return classOf(this.power()); }
  following() { return this.s.helpUntil > G.prog.hours(); }

  update(dt) {
    const P = G.player;
    const dP = dist2d(P.pos.x, P.pos.z, this.pos.x, this.pos.z);
    const follow = this.following();
    if (!follow && dP > 110) { this.m.root.visible = false; return; }
    this.m.root.visible = true;
    let move = 0, pose = 'idle';
    this.atkCd -= dt;
    if (this.talking) { this.yaw = dampAngle(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), 6, dt); pose = this.m.face.talking ? 'talk' : 'idle'; }
    else if (follow) {
      // fight alongside the hero
      const foe = G.combat.nearestEnemy(this.pos, 14, null);
      if (foe && foe.aggro !== undefined) {
        const d = dist2d(foe.pos.x, foe.pos.z, this.pos.x, this.pos.z);
        this.yaw = dampAngle(this.yaw, Math.atan2(foe.pos.x - this.pos.x, foe.pos.z - this.pos.z), 10, dt);
        const g = GENES[this.gene];
        const reach = g.ranged ? 11 : 2.6;
        if (d > reach) move = 6.5;
        else if (this.atkCd <= 0) {
          this.atkCd = g.ranged ? 1.6 : 1.1; this.atkT = 0.45;
          const dmg = 6 + this.power() * 0.06;
          if (g.ranged) G.combat.spawnProjectile({ friendly: true, x: this.pos.x, y: this.pos.y + 1.4, z: this.pos.z, target: foe, speed: 20, dmg, color: g.proj, size: 0.3, homing: 4, homingTarget: foe });
          else { foe.takeDamage(dmg, { knock: 4 }); G.particles.burst(foe.pos.x, foe.pos.y + 1, foe.pos.z, 0xffffff, 8, 3); G.audio.sfxAt('hit', foe.pos.x, foe.pos.z, { vol: 0.5 }); }
        }
        if (!foe.aggro) foe.aggro = true;
      } else {
        const side = this.i % 2 ? 1 : -1;
        const tx = P.pos.x - Math.sin(P.yaw) * 2.5 + Math.cos(P.yaw) * side * 2, tz = P.pos.z - Math.cos(P.yaw) * 2.5 - Math.sin(P.yaw) * side * 2;
        const d = dist2d(tx, tz, this.pos.x, this.pos.z);
        if (d > 40) this.pos.set(tx, G.physics.groundAt(tx, tz, P.pos.y + 3), tz);
        else if (d > 1.2) { this.yaw = dampAngle(this.yaw, Math.atan2(tx - this.pos.x, tz - this.pos.z), 8, dt); move = Math.min(P.mounted ? 16 : 9, d * 2.2); }
      }
    } else {
      // wander near home
      if (this.target) {
        const d = dist2d(this.target.x, this.target.z, this.pos.x, this.pos.z);
        this.yaw = dampAngle(this.yaw, Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z), 5, dt);
        move = 1.8;
        if (d < 0.6) { this.target = null; this.wait = 3 + Math.random() * 6; }
      } else {
        this.wait -= dt;
        if (this.wait <= 0) { const a = Math.random() * 6.28, r = Math.random() * 7; this.target = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; }
        if (dP < 6) this.yaw = dampAngle(this.yaw, Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), 3, dt);
      }
    }
    if (move > 0) {
      const blocked = G.physics.move(this.pos, Math.sin(this.yaw) * move * dt, Math.cos(this.yaw) * move * dt, 0.38, 1.8, false);
      if (blocked && !follow) this.target = null;
      pose = move > 5 ? 'run' : 'walk';
    }
    const wl = G.physics.waterLevel(this.pos.x, this.pos.z);
    const gy = G.physics.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.2);
    this.pos.y = wl - gy > 1.25 ? wl - 1.15 : gy;
    if (this.atkT > 0) { this.atkT -= dt; pose = GENES[this.gene].ranged ? 'cast_ball' : 'attack1'; }
    this.m.root.position.copy(this.pos);
    this.m.root.rotation.y = this.yaw;
    this.m.pose(pose, this.atkT > 0 ? 1 - this.atkT / 0.45 : 0, dt, { speed: move });
    this.m.updateFace(dt);
    if (this.look.glow && Math.random() < dt * 3) G.particles.trail(this.pos.x + (Math.random() - 0.5) * 0.6, this.pos.y + 1 + Math.random(), this.pos.z + (Math.random() - 0.5) * 0.6, this.look.glow, 0.12, 0.8);
  }
}

export class Adventurers {
  constructor() {
    const S = G.state;
    S.advs = S.advs || {};
    this.list = ROSTER.map((r, i) => {
      if (!S.advs[i]) S.advs[i] = { friend: 0, lastTalk: -99, helpUntil: 0 };
      return new Adventurer(i, r, S.advs[i]);
    });
  }
  update(dt) {
    for (const a of this.list) {
      a.update(dt);
      if (!a.aura) continue;
      const d = a.aura.update(dt);
      // first close encounter with a legendary lineage: cinematic reveal
      if (a.aura.A.tier === 3 && d < 34 && !G.cinematics.seen.has(a.id) && G.cinematics.canStart()) {
        const g = GENES[a.gene];
        G.cinematics.start(a.id, a.aura, { name: a.name, sub: `${g.icon} ${t('gene.' + a.gene)} · ${t('cls.' + a.cls().id)} · ⚡${a.power()}` });
      }
    }
  }
  companions() { return this.list.filter((a) => a.following()); }

  addFriend(a, n) {
    const before = friendTier(a.s.friend).id;
    a.s.friend = Math.min(100, a.s.friend + n);
    const now = friendTier(a.s.friend).id;
    if (now !== before) { G.ui.toast(t('adv.tierUp', { name: a.name, tier: t('friend.' + now) }), 'unlock'); G.audio.sfx('achievement'); }
  }
  statsLines(a) {
    const c = a.cls(), g = GENES[a.gene];
    return [t('adv.statLine', { power: a.power(), level: a.level(), cls: t('cls.' + c.id) }), t('adv.geneLine', { icon: g.icon, gene: t('gene.' + a.gene), mult: Math.round((g.mult - 1) * 100), desc: t('gene.' + a.gene + 'Desc') }), t('adv.friendLine', { tier: t('friend.' + friendTier(a.s.friend).id), n: a.s.friend })];
  }
  talk(a) {
    const D = G.dialogue;
    const tier = friendTier(a.s.friend).id;
    const greet = t('adv.greet_' + tier, { name: a.name, player: G.state.appearance.name });
    const day = G.state.world.day;
    const menu = () => [
      { label: t('adv.chat'), act: () => {
        const lines = [t('adv.talk_' + a.gene)];
        if (a.s.lastTalk !== day) { a.s.lastTalk = day; this.addFriend(a, 8); lines.push(t('adv.likedChat')); }
        D.open(a, lines, menu());
      } },
      { label: t('adv.stats'), act: () => D.open(a, this.statsLines(a), menu()) },
      { label: t('adv.gift'), act: () => {
        if (!G.prog.spendGold(50)) { D.open(a, [t('adv.noGold')], menu()); return; }
        this.addFriend(a, 12); G.audio.sfx('coin');
        D.open(a, [t('adv.thanksGift')], menu());
      } },
      a.following()
        ? { label: t('adv.dismiss'), act: () => { a.s.helpUntil = 0; D.open(a, [t('adv.bye')], null); } }
        : { label: t('adv.askHelp'), act: () => {
          if (a.s.friend < 50) { D.open(a, [t('adv.notFriends', { n: a.s.friend })], menu()); return; }
          if (this.companions().length >= 2) { D.open(a, [t('adv.tooMany')], menu()); return; }
          a.s.helpUntil = G.prog.hours() + 8;
          G.audio.sfx('questStart');
          D.open(a, [t('adv.joins', { player: G.state.appearance.name })], null);
          G.ui.toast(t('adv.joined', { name: a.name }), 'unlock');
        } },
      { label: t('dlg.bye'), act: () => D.open(a, [t('adv.bye')], null) },
    ];
    D.open(a, [greet], menu());
  }

  // rankings
  ranking() {
    const rows = this.list.map((a) => ({ name: a.name, power: a.power(), gene: a.gene, level: a.level(), me: false }));
    rows.push({ name: G.state.appearance.name, power: G.training.powerRating(), gene: G.state.player.gene || PLAYER_GENE, level: G.state.player.level, me: true });
    return rows.sort((x, y) => y.power - x.power);
  }
  geneRanking() {
    const by = {};
    for (const a of this.list) { const b = by[a.gene] = by[a.gene] || { gene: a.gene, best: 0, sum: 0, n: 0, top: '' }; const p = a.power(); b.sum += p; b.n++; if (p > b.best) { b.best = p; b.top = a.name; } }
    return Object.values(by).map((b) => ({ ...b, avg: Math.round(b.sum / b.n), mult: GENES[b.gene].mult })).sort((x, y) => y.best - x.best);
  }
}
