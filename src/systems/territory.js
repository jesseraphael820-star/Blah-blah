// Territory war + village growth.
// - The map is split into regions (see data/territory.js). Raiders hold outposts
//   guarded by a Golem and a few raiders. Defeat the guard, then hold the banner
//   circle to conquer the region: it turns gold on the map and a friendly Golem
//   now protects it.
// - Aurora grows over time and with every conquest: new houses rise on empty
//   plots and new villagers move in.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { REGIONS, FACTIONS, PLOTS, VILLAGER_NAMES, regionAt } from '../data/territory.js';
import { WORLD } from '../data/world.js';
import { VoxelBuilder, boxMesh, colorMat } from '../render/voxel.js';
import { makeEnemyModel } from '../entities/enemyModels.js';
import { house } from '../world/structures.js';
import { dist2d, makeRng, hash2 } from '../core/utils.js';
import { HAIR_COLORS, SKIN_TONES, CLOTH_COLORS, EYE_COLORS } from '../ui/menu.js';

const N = 80; // overlay resolution

// friendly golem that guards conquered land (and the village gate)
class GuardGolem {
  constructor(x, z) {
    this.m = makeEnemyModel({ model: 'golem', color: 0x8a96a8, crystal: 0xffc83a, scale: 1.35, boss: false });
    G.scene.add(this.m.group);
    this.pos = new THREE.Vector3(x, G.physics.groundAt(x, z, 200), z);
    this.home = this.pos.clone();
    this.yaw = Math.random() * 6; this.cd = 0; this.st = 'idle'; this.ph = 0;
    G.physics.addCyl(x, z, 1.2, this.pos.y, this.pos.y + 3);
  }
  update(dt) {
    const P = G.player.pos;
    if (Math.abs(P.x - this.pos.x) > 110 || Math.abs(P.z - this.pos.z) > 110) { this.m.group.visible = false; return; }
    this.m.group.visible = true;
    this.cd -= dt;
    const foe = G.combat.nearestEnemy(this.pos, 13, null);
    if (foe) {
      this.yaw = Math.atan2(foe.pos.x - this.pos.x, foe.pos.z - this.pos.z);
      if (this.cd <= 0) { this.cd = 2.4; this.st = 'windup'; this.ph = 0; }
    }
    if (this.st === 'windup') { this.ph += dt / 0.7; if (this.ph >= 1) { this.st = 'attack'; this.ph = 0; if (foe) { foe.takeDamage(28 + G.state.player.level * 3, { knock: 6 }); G.particles.ring(foe.pos.x, foe.pos.y + 0.3, foe.pos.z, 0xffc83a, 3, 24); G.audio.sfxAt('slam', this.pos.x, this.pos.z, { vol: 0.6 }); } } }
    else if (this.st === 'attack') { this.ph += dt / 0.4; if (this.ph >= 1) this.st = 'idle'; }
    this.m.base(dt, null);
    this.m.animate(dt, this.st, Math.min(1, this.ph), 0);
    this.m.group.position.copy(this.pos);
    this.m.group.rotation.y = this.yaw;
  }
}

export class Territory {
  constructor() {
    const S = G.state;
    S.terr = S.terr || { owners: {}, captured: [] };
    S.village = S.village || { residents: [], lastGrowDay: S.world.day };
    for (const r of REGIONS) if (!S.terr.owners[r.id]) S.terr.owners[r.id] = r.owner;
    this.canvas = document.createElement('canvas'); this.canvas.width = N; this.canvas.height = N;
    this.cells = new Uint8Array(N * N);
    const cs = WORLD.size / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -WORLD.half + (i + 0.5) * cs, z = -WORLD.half + (j + 0.5) * cs;
      // jitter borders a little so they look hand drawn
      const jx = (hash2(i, j) - 0.5) * cs * 0.9, jz = (hash2(j + 7, i) - 0.5) * cs * 0.9;
      this.cells[j * N + i] = REGIONS.indexOf(regionAt(x + jx, z + jz));
    }
    this.outposts = [];
    this.guards = [];
    for (const r of REGIONS) {
      if (!r.outpost) continue;
      const [x, z] = r.outpost;
      const y = G.physics.groundAt(x, z, 200);
      // banner pole + cloth (cloth color follows the owner)
      const pole = boxMesh(0.2, 6, 0.2, 0x4a3020, { pos: [x, y + 3, z] });
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.08), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      cloth.position.set(x + 1, y + 5.2, z); cloth.castShadow = true;
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      emblem.position.set(x + 1, y + 5.2, z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.5, depthWrite: false }));
      ring.position.set(x, y + 0.12, z);
      G.scene.add(pole, cloth, emblem, ring);
      G.physics.addCyl(x, z, 0.3, y, y + 6);
      const op = { r, x, z, y, cloth, emblem, ring, phase: 'idle', defenders: [], progress: 0, cdT: 0 };
      this.outposts.push(op);
      G.world.addInteractable({
        kind: 'outpost', x, y, z, r: 4,
        label: () => t('terr.challenge'),
        can: () => this.owner(r.id) === 'raiders' && op.phase === 'idle',
        act: () => this.spawnDefenders(op),
      });
      if (this.owner(r.id) === 'aurora') this.guards.push(new GuardGolem(x + 3, z + 3));
      this.paintBanner(op);
    }
    // the village gate always has a guardian golem
    this.guards.push(new GuardGolem(46, 6));
    // capture progress UI
    this.capEl = document.createElement('div');
    this.capEl.className = 'capture hidden';
    this.capEl.innerHTML = '<b></b><div class="bar"><i></i></div><small></small>';
    document.getElementById('hud').appendChild(this.capEl);
    // territory label under the minimap
    this.label = document.createElement('div');
    this.label.className = 'hud-terr panel-glass';
    document.querySelector('.hud-tr').insertBefore(this.label, document.querySelector('.hud-gold'));
    this.redraw();
    // rebuild houses that already grew in this save
    this.plotMeshes = [];
    for (const res of S.village.residents) this.buildPlot(res, false);
    G.bus.on('newDay', () => this.naturalGrowth());
    this.curRegion = null;
  }
  owner(id) { return G.state.terr.owners[id]; }
  ownedCount(f = 'aurora') { return REGIONS.filter((r) => this.owner(r.id) === f).length; }
  conquered() { return G.state.terr.captured.length; }

  paintBanner(op) {
    const f = FACTIONS[this.owner(op.r.id)];
    op.cloth.material.color.setHex(f.banner);
    op.emblem.material.color.setHex(f.trim);
    op.ring.material.color.setHex(this.owner(op.r.id) === 'aurora' ? 0x5fd08a : 0xffc83a);
    op.ring.visible = this.owner(op.r.id) === 'raiders' && op.phase === 'open';
  }

  // ---------- map overlay ----------
  redraw() {
    const c = this.canvas.getContext('2d');
    const img = c.createImageData(N, N);
    const own = REGIONS.map((r) => FACTIONS[this.owner(r.id)].hex);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, ri = this.cells[k], col = own[ri];
      const border = (i > 0 && this.cells[k - 1] !== ri) || (j > 0 && this.cells[k - N] !== ri) || (i < N - 1 && this.cells[k + 1] !== ri) || (j < N - 1 && this.cells[k + N] !== ri);
      img.data[k * 4] = (col >> 16) & 255; img.data[k * 4 + 1] = (col >> 8) & 255; img.data[k * 4 + 2] = col & 255;
      img.data[k * 4 + 3] = border ? 220 : 72;
    }
    c.putImageData(img, 0, 0);
  }

  // ---------- war ----------
  spawnDefenders(op) {
    if (op.phase !== 'idle') return;
    const tier = op.r.tier || 1;
    const E = G.entities.enemies;
    const g = E.spawn('golem_guard', op.x, op.z + 2, { homeR: 6 });
    g.maxHp = g.hp = Math.round(g.def.hp * (0.8 + 0.35 * tier));
    g.def.dmg = Math.round(g.def.dmg * (0.85 + 0.2 * tier));
    g.level = g.def.level + (tier - 1) * 3;
    g.home.set(op.x, 0, op.z);
    op.golem = g;
    op.defenders = [g];
    for (let i = 0; i < 1 + tier; i++) {
      const a = (i / (1 + tier)) * Math.PI * 2;
      const e = E.spawn('raider', op.x + Math.cos(a) * 5, op.z + Math.sin(a) * 5, { homeR: 7 });
      e.level += (tier - 1) * 2; e.maxHp = e.hp = Math.round(e.hp * (0.9 + 0.25 * tier));
      e.home.set(op.x, 0, op.z);
      op.defenders.push(e);
    }
    op.phase = 'defended';
    G.audio.sfx('roar', { vol: 0.8 });
    G.ui.toast(t('terr.alarm', { region: t('terr.r.' + op.r.id) }), 'boss');
  }
  capture(op) {
    const r = op.r, tier = r.tier || 1;
    G.state.terr.owners[r.id] = 'aurora';
    G.state.terr.captured.push(r.id);
    op.phase = 'done';
    this.paintBanner(op);
    this.redraw();
    this.guards.push(new GuardGolem(op.x + 3, op.z + 3));
    G.audio.sfx('quest');
    G.ui.screenFlash(0.35, '#ffe08a');
    G.particles.ring(op.x, op.y + 1, op.z, 0xffc83a, 8, 60, { speed: 10 });
    G.ui.banner(`<small>${t('terr.conquered')}</small><h2>${t('terr.r.' + r.id)}</h2><div class="bn-rewards">${t('terr.conqueredInfo')}</div>`, 'level', 4.5);
    G.prog.grant({ gold: 120 + tier * 80, xp: 180 + tier * 120, rep: { aurora: 15 } }, { at: G.player.pos });
    G.state.ach.stats.territories = this.conquered();
    setTimeout(() => this.grow(true), 2500);
    G.game.autosave();
  }

  // ---------- village growth ----------
  naturalGrowth() {
    const V = G.state.village;
    const day = G.state.world.day;
    if (day - V.lastGrowDay < 2) return;
    const built = V.residents.length;
    if ((G.state.rep.aurora || 0) >= built * 12 || this.conquered() > built) this.grow(false);
  }
  grow(fromConquest) {
    const V = G.state.village;
    const i = V.residents.length;
    if (i >= PLOTS.length) return;
    const rng = makeRng(1000 + i * 31 + G.state.created % 1000);
    const name = VILLAGER_NAMES[Math.floor(rng() * VILLAGER_NAMES.length)];
    const res = {
      plot: i, name, hair: ['short', 'long', 'spiky', 'ponytail', 'bun', 'braid', 'messy'][Math.floor(rng() * 7)],
      pal: { skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)], hair: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)], shirt: CLOTH_COLORS[Math.floor(rng() * CLOTH_COLORS.length)], pants: CLOTH_COLORS[Math.floor(rng() * CLOTH_COLORS.length)], shoes: 0x2a1f16, eye: EYE_COLORS[Math.floor(rng() * EYE_COLORS.length)] },
      pitch: 0.85 + rng() * 0.6, hat: rng() < 0.3 ? 'straw' : 'none', day1: ['market', 'pE', 'pW', 'pS'][Math.floor(rng() * 4)], day2: ['market', 'innDoor', 'forge', 'pN'][Math.floor(rng() * 4)],
    };
    V.residents.push(res);
    V.lastGrowDay = G.state.world.day;
    this.buildPlot(res, true);
    G.ui.toast(t('terr.newResident', { name }), 'unlock');
    G.game.autosave();
  }
  // builds the plot house at runtime (its own mesh) and moves the villager in
  buildPlot(res, celebrate) {
    const [x, z, rot] = PLOTS[res.plot];
    const W = G.world;
    const vb = new VoxelBuilder();
    const proxy = {
      houses: null, lightsSpots: W.lightsSpots,
      ground: (a, b) => W.ground(a, b),
      box: (x0, y0, z0, x1, y1, z1, c, o = {}) => { vb.box(x0, y0, z0, x1, y1, z1, c, o); if (o.col) W.collider(x0, y0, z0, x1, y1, z1, o); },
      collider: (...a) => W.collider(...a), cyl: (...a) => W.cyl(...a), flag() {}, smoke: (...a) => W.smoke(...a), glow() {}, fire: (...a) => W.fire(...a), dynamic: (...a) => W.dynamic(...a),
    };
    const roofs = [0xb04a32, 0x4a7a4a, 0x2a4a8a, 0x8a5a3a, 0x7a3a5a, 0xc0802a];
    const h = house(proxy, x, z, rot, { w: 7, d: 6, roof: roofs[res.plot % roofs.length] });
    const mesh = new THREE.Mesh(vb.build(), G.worldMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    G.scene.add(mesh);
    this.plotMeshes.push(mesh);
    res.door = [h.out.x, h.out.z];
    res.link = 'plaza';
    G.entities.npcs.addResident(res);
    if (celebrate) { G.particles.burst(x, h.y + 3, z, 0xffe08a, 50, 6, { up: 4 }); G.audio.sfxAt('chest', x, z, { range: 200 }); }
  }
  population() { return 8 + G.state.village.residents.length; }
  prosperity() {
    const v = (G.state.rep.aurora || 0) + this.conquered() * 25 + G.state.village.residents.length * 10;
    return v >= 200 ? 5 : v >= 130 ? 4 : v >= 70 ? 3 : v >= 30 ? 2 : 1;
  }

  // info shown when clicking a village or region on the map
  info(r) {
    const owner = this.owner(r.id);
    const rows = [[t('terr.owner'), `<span style="color:${FACTIONS[owner].color}">${t('terr.f.' + owner)}</span>`]];
    if (r.village === 'aurora') {
      rows.push([t('terr.residents'), this.population()], [t('terr.houses'), 11 + G.state.village.residents.length], [t('terr.prosperity'), '★'.repeat(this.prosperity()) + '☆'.repeat(5 - this.prosperity())],
        [t('terr.shops'), 4], [t('terr.guards'), t('terr.guardsAurora')], [t('terr.lands'), `${this.ownedCount('aurora')} / ${REGIONS.length}`],
        [t('terr.nextGrowth'), G.state.village.residents.length >= PLOTS.length ? t('terr.full') : t('terr.growHint')]);
    } else if (r.village === 'camp') {
      rows.push([t('terr.residents'), 1], [t('terr.shops'), 1], [t('terr.relation'), t('terr.ally')]);
    } else if (r.outpost) {
      const op = this.outposts.find((o) => o.r === r);
      rows.push([t('terr.difficulty'), '⚔'.repeat(r.tier || 1)], [t('terr.status'), owner === 'aurora' ? t('terr.st_ours') : t('terr.st_' + op.phase)], [t('terr.reward'), `${120 + (r.tier || 1) * 80} Gold`]);
    } else rows.push([t('terr.residents'), r.id === 'farm' ? 1 : 0]);
    return { title: t('terr.r.' + r.id), rows };
  }

  update(dt) {
    const P = G.player.pos;
    for (const g of this.guards) g.update(dt);
    // current region label
    if (!G.sky.underground) {
      const r = regionAt(P.x, P.z);
      const o = this.owner(r.id);
      if (r !== this.curRegion) {
        if (this.curRegion) G.ui.toast(r.village ? t('terr.r.' + r.id) : t('terr.entering', { region: t('terr.r.' + r.id), owner: t('terr.f.' + o) }), o === 'raiders' ? 'warn' : 'info');
        this.curRegion = r;
      }
      this.label.innerHTML = `<i style="background:${FACTIONS[o].color}"></i><span>${t('terr.r.' + r.id)}</span>`;
      this.label.classList.remove('hidden');
    } else this.label.classList.add('hidden');
    // outposts
    let capShow = null;
    for (const op of this.outposts) {
      if (this.owner(op.r.id) !== 'raiders') continue;
      const d = dist2d(P.x, P.z, op.x, op.z);
      op.cloth.rotation.y = Math.sin(G.time * 2 + op.x) * 0.25;
      if (op.phase === 'idle' && d < 26 && !G.player.dead) this.spawnDefenders(op);
      if (op.phase === 'defended') {
        if (op.golem && !op.golem.dead && op.golem.aggro && !G.ui.bossTarget) G.ui.setBoss(op.golem);
        if (op.defenders.every((e) => e.dead || !G.entities.enemies.list.includes(e))) {
          const killed = op.defenders.every((e) => e.dead || e.hp <= 0);
          if (killed || op.golem.hp <= 0) { op.phase = 'open'; op.progress = 0; this.paintBanner(op); G.ui.toast(t('terr.holdFlag'), 'info'); }
          else op.phase = 'idle';
        } else if (d > 120) {
          for (const e of op.defenders) e.despawn = true;
          op.phase = 'idle';
        }
      }
      if (op.phase === 'open') {
        op.ring.visible = true;
        op.ring.material.opacity = 0.35 + Math.sin(G.time * 4) * 0.15;
        if (d < 6 && !G.player.dead) op.progress = Math.min(1, op.progress + dt / 6);
        else op.progress = Math.max(0, op.progress - dt / 15);
        if (d < 30) capShow = op;
        if (op.progress >= 1) this.capture(op);
      }
    }
    this.capEl.classList.toggle('hidden', !capShow);
    if (capShow) {
      this.capEl.querySelector('b').textContent = t('terr.capturing', { region: t('terr.r.' + capShow.r.id) });
      this.capEl.querySelector('i').style.width = (capShow.progress * 100).toFixed(0) + '%';
      this.capEl.querySelector('small').textContent = dist2d(P.x, P.z, capShow.x, capShow.z) < 6 ? t('terr.holding') : t('terr.stepIn');
    }
  }
}
export { regionAt, REGIONS, FACTIONS };
