// Interactive world props: chests, waystones, harvest nodes, altar, rune pillars,
// sealed door, legendary sword pedestal and portals.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { buildMesh, boxMesh, getWorldMaterial } from '../render/voxel.js';
import { chestModel, CHEST_COLORS, swordMesh } from '../render/models.js';
import { CHEST_LOOT } from '../data/items.js';
import { makeRng, dist2d } from '../core/utils.js';

const NODE_DEF = {
  wheat: { item: 'wheat', n: 1, sfx: 'harvest', label: 'ui.harvest' },
  ore: { item: 'iron_ore', n: 1, sfx: 'mine', label: 'ui.mine', bonus: ['crystal', 0.15] },
  shroom: { item: 'glowshroom', n: 1, sfx: 'harvest', label: 'ui.gather' },
  herb: { item: 'herb', n: 1, sfx: 'harvest', label: 'ui.gather' },
};

function nodeGeometry(kind) {
  return buildMesh((vb) => {
    if (kind === 'wheat') {
      vb.box(-0.3, 0, -0.3, 0.3, 1.1, 0.3, 0xd8b848, { wind: 0.3, windBase: 0, topColor: 0xf0d870 });
      vb.box(-0.34, 0.45, -0.34, 0.34, 0.58, 0.34, 0xa87a2a);
      vb.box(-0.4, 1.1, -0.4, 0.4, 1.45, 0.4, 0xf0d060, { wind: 0.5 });
    } else if (kind === 'ore') {
      vb.box(-0.9, 0, -0.7, 0.9, 1.1, 0.7, 0x6a6660);
      vb.box(-0.6, 1.0, -0.5, 0.5, 1.6, 0.4, 0x7a7670);
      for (const [x, y, z] of [[-0.5, 0.5, 0.71], [0.3, 0.8, 0.71], [0.91, 0.4, 0.1], [-0.2, 1.3, 0.41], [0.1, 1.61, -0.1]]) vb.box(x - 0.14, y - 0.1, z - 0.06, x + 0.14, y + 0.12, z + 0.06, 0xe08a4a, { emit: 1.5 + 0.2 });
    } else if (kind === 'shroom') {
      for (const [x, z, s] of [[0, 0, 1], [0.5, 0.3, 0.6], [-0.4, 0.4, 0.7]]) {
        vb.box(x - 0.1 * s, 0, z - 0.1 * s, x + 0.1 * s, 0.6 * s, z + 0.1 * s, 0xd8f0e8, { emit: 1.5 + 0.2 });
        vb.box(x - 0.38 * s, 0.6 * s, z - 0.38 * s, x + 0.38 * s, 0.85 * s, z + 0.38 * s, 0x3ae0d0, { emit: 1.5 + 0.9 });
      }
    } else {
      for (let i = 0; i < 5; i++) { const a = i * 1.26; vb.box(Math.cos(a) * 0.25 - 0.07, 0, Math.sin(a) * 0.25 - 0.07, Math.cos(a) * 0.25 + 0.07, 0.5 + (i % 2) * 0.2, Math.sin(a) * 0.25 + 0.07, 0x3aa04a, { wind: 0.6, windBase: 0 }); }
      vb.box(-0.1, 0.55, -0.1, 0.1, 0.72, 0.1, 0xf0f0f0, { wind: 0.6 });
    }
  }).geometry;
}

export class Props {
  constructor(scene) {
    this.scene = scene;
    this.chests = [];
    this.waystones = [];
    this.nodes = [];
    this.pillars = [];
    this.geos = {};
    this.anim = [];
  }
  get W() { return G.world; }

  // ---------- chests ----------
  addChest(def, y) {
    const g = chestModel(def.r);
    g.position.set(def.x, y + (def.yOff || 0), def.z);
    g.rotation.y = makeRng(Math.floor(def.x * 13 + def.z))() * Math.PI * 2;
    g.traverse((o) => { o.castShadow = true; });
    this.scene.add(g);
    const c = { def, mesh: g, open: G.state.world.chests.includes(def.id), y: g.position.y };
    if (c.open) g.userData.lid.rotation.x = -1.9;
    G.physics.addCyl(def.x, def.z, 0.7, c.y, c.y + 0.9);
    this.chests.push(c);
    this.W.addInteractable({
      kind: 'chest', x: def.x, y: c.y, z: def.z, r: 2.4,
      label: () => t('ui.openChest', { r: t('rarity.' + def.r) }),
      can: () => !c.open,
      act: () => this.openChest(c),
    });
  }
  openChest(c) {
    c.open = true;
    G.state.world.chests.push(c.def.id);
    G.audio.sfx('chest');
    const col = CHEST_COLORS[c.def.r].glow;
    const p = c.mesh.position;
    G.particles.burst(p.x, p.y + 0.8, p.z, col, 40, 6, { up: 4, size: 0.3, life: 1.1, gravity: 5 });
    this.anim.push({ t: 0, d: 0.55, fn: (k) => { c.mesh.userData.lid.rotation.x = -1.9 * (1 - Math.pow(1 - k, 3)); } });
    const table = CHEST_LOOT[c.def.r];
    const rng = Math.random;
    const rewards = { gold: Math.floor(table.gold[0] + rng() * (table.gold[1] - table.gold[0])), items: {}, xp: { common: 10, rare: 25, epic: 50, legendary: 100 }[c.def.r] };
    for (let i = 0; i < table.rolls; i++) {
      const [id, n] = table.pool[Math.floor(rng() * table.pool.length)];
      rewards.items[id] = (rewards.items[id] || 0) + n;
    }
    if (c.def.loot) {
      if (c.def.loot.gold) rewards.gold += c.def.loot.gold;
      if (c.def.loot.items) for (const [k, v] of Object.entries(c.def.loot.items)) rewards.items[k] = (rewards.items[k] || 0) + v;
      if (c.def.loot.swords) rewards.swords = c.def.loot.swords;
    }
    setTimeout(() => {
      G.prog.grant(rewards, { at: p, title: t('ui.chestOpened', { r: t('rarity.' + c.def.r) }) });
      G.bus.emit('chestOpened', { id: c.def.id, rarity: c.def.r });
    }, 350);
    G.game.autosave();
  }

  // ---------- waystones ----------
  addWaystone(def, y) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshLambertMaterial({ color: 0x4fd0ff, emissive: 0x2a8acf, emissiveIntensity: 0.4, flatShading: true }));
    crystal.position.set(def.x, y + 4.1, def.z);
    this.scene.add(crystal);
    const w = { def, y, crystal, active: G.state.world.waystones.includes(def.id) };
    this.waystones.push(w);
    this.W.addInteractable({
      kind: 'waystone', x: def.x, y, z: def.z, r: 3,
      label: () => (w.active ? t('ui.fastTravel') : t('ui.activate')),
      can: () => true,
      act: () => { if (!w.active) this.activateWaystone(w); else G.ui.openMenu('map', { travel: true }); },
    });
  }
  activateWaystone(w) {
    if (w.active) return;
    w.active = true;
    G.state.world.waystones.push(w.def.id);
    G.audio.sfx('waystone');
    G.particles.ring(w.def.x, w.y + 1.5, w.def.z, 0x4fd0ff, 4, 40);
    G.ui.toast(t('ui.waystoneOn', { name: t('way.' + w.def.id) }), 'travel');
    G.prog.addXP(15);
    G.game.autosave();
  }

  // ---------- harvest nodes ----------
  addHarvest(kind, x, z) {
    if (!this.geos[kind]) this.geos[kind] = nodeGeometry(kind);
    const y = G.physics.terrainHeight(x, z);
    const mesh = new THREE.Mesh(this.geos[kind], getWorldMaterial());
    mesh.position.set(x, y, z);
    mesh.rotation.y = (x * 13 + z * 7) % 6.28;
    mesh.castShadow = true;
    this.scene.add(mesh);
    const id = `${kind}_${Math.round(x)}_${Math.round(z)}`;
    const n = { id, kind, x, y, z, mesh };
    this.nodes.push(n);
    this.W.addInteractable({
      kind: 'node', x, y, z, r: 2.2,
      label: () => t(NODE_DEF[kind].label) + ' — ' + t('item.' + NODE_DEF[kind].item + '.name'),
      can: () => this.nodeReady(n),
      act: () => this.harvest(n),
    });
  }
  nodeReady(n) {
    const h = G.state.world.harvested[n.id];
    if (h === undefined) return true;
    const now = G.state.world.day * 24 + G.state.world.time;
    return now - h > 20; // regrows after ~20 in-game hours
  }
  harvest(n) {
    const d = NODE_DEF[n.kind];
    G.state.world.harvested[n.id] = G.state.world.day * 24 + G.state.world.time;
    G.audio.sfx(d.sfx);
    G.player.playAction(n.kind === 'ore' ? 'mine' : 'gather');
    const items = { [d.item]: d.n };
    if (d.bonus && Math.random() < d.bonus[1]) items[d.bonus[0]] = 1;
    G.prog.grant({ items, xp: 3 }, { at: n.mesh.position, quiet: true });
    G.particles.burst(n.x, n.y + 0.8, n.z, n.kind === 'ore' ? 0xc0a080 : n.kind === 'shroom' ? 0x3ae0d0 : 0xe0d070, 12, 3, { solid: n.kind === 'ore', gravity: 8 });
    G.bus.emit('harvest', { kind: n.kind });
  }

  // ---------- quest props ----------
  addAltar(x, y, z) {
    const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshLambertMaterial({ color: 0xb66cff, emissive: 0x8a3acf, emissiveIntensity: 1, flatShading: true }));
    rune.position.set(x, y + 0.8, z);
    this.scene.add(rune);
    this.altar = { x, y, z, rune };
    this.W.addInteractable({
      kind: 'altar', x, y, z, r: 3,
      label: () => t('ui.touchAltar'),
      can: () => !G.state.world.flags.altarDone,
      act: () => {
        if (G.quests.tryInteract('altar')) {
          G.state.world.flags.altarDone = true;
          G.audio.sfx('rune');
          G.particles.ring(x, y + 0.8, z, 0xd08aff, 6, 50);
          G.particles.burst(x, y + 0.8, z, 0xd08aff, 60, 8, { up: 2, life: 1.4 });
          G.ui.screenFlash(0.5, '#d08aff');
        } else G.ui.toast(t('ui.altarSilent'), 'info');
      },
    });
  }
  addPillar(i, x, y, z) {
    const g = new THREE.Group();
    g.add(boxMesh(1.2, 3.6, 1.2, 0x8a8478, { pos: [0, 1.8, 0] }));
    g.add(boxMesh(1.4, 0.4, 1.4, 0x7a7468, { pos: [0, 3.8, 0] }));
    const runeMat = new THREE.MeshLambertMaterial({ color: 0x3a4a5a, emissive: 0x4fd0ff, emissiveIntensity: 0 });
    const rune = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.9, 1.25), runeMat);
    rune.position.y = 2.2;
    g.add(rune);
    g.position.set(x, y, z);
    this.scene.add(g);
    G.physics.addCyl(x, z, 0.8, y - 1, y + 4);
    const p = { i, x, y, z, g, runeMat, on: !!G.state.world.flags['pillar' + i] };
    if (p.on) runeMat.emissiveIntensity = 1;
    this.pillars.push(p);
    this.W.addInteractable({
      kind: 'pillar', x, y, z, r: 2.6,
      label: () => t('ui.activateRune'),
      can: () => !p.on,
      act: () => {
        if (!G.quests.isActiveStep('main4', 1)) { G.ui.toast(t('ui.runeDormant'), 'info'); return; }
        p.on = true;
        G.state.world.flags['pillar' + i] = true;
        G.audio.sfx('rune');
        this.anim.push({ t: 0, d: 1, fn: (k) => { runeMat.emissiveIntensity = k; } });
        G.particles.burst(x, y + 2.2, z, 0x4fd0ff, 40, 5, { up: 3 });
        G.quests.tryInteract('pillar');
      },
    });
  }
  addPedestal(x, y, z) {
    const W = this.W;
    const top = W.box ? (() => {
      W.box(x - 1.8, y - 0.2, z - 1.8, x + 1.8, y + 0.4, z + 1.8, 0x5a5a6a);
      W.box(x - 1.1, y + 0.4, z - 1.1, x + 1.1, y + 1.3, z + 1.1, 0x6a6a7a);
      W.box(x - 1.2, y + 1.3, z - 1.2, x + 1.2, y + 1.5, z + 1.2, 0xffc85a, { emit: 1.8, vary: 0 });
      W.collider(x - 1.1, y - 1, z - 1.1, x + 1.1, y + 1.5, z + 1.1);
      return y + 1.5;
    })() : y + 1.5;
    const sword = swordMesh('aurora_blade');
    sword.rotation.z = Math.PI;
    sword.position.set(x, top + 1.7, z);
    this.scene.add(sword);
    W.glow(x, top + 1.2, z, 0xffc85a, 3, false);
    W.lightsSpots.push({ x, y: top + 2, z, color: 0xffd080, intensity: 2.6, dist: 16, always: true });
    this.pedestal = { x, y: top, z, sword };
    if (G.state.world.flags.auroraTaken) sword.visible = false;
    W.addInteractable({
      kind: 'pedestal', x, y: top, z, r: 3,
      label: () => t('ui.drawSword'),
      can: () => !G.state.world.flags.auroraTaken,
      act: () => {
        if (!G.quests.isActiveStep('main5', 2)) { G.ui.toast(t('ui.swordStuck'), 'info'); return; }
        G.state.world.flags.auroraTaken = true;
        sword.visible = false;
        G.audio.sfx('levelup');
        G.ui.screenFlash(0.7, '#ffe0a0');
        G.particles.burst(x, top + 1.5, z, 0xffd36a, 80, 9, { up: 3, life: 1.5 });
        G.quests.tryInteract('pedestal');
        G.player.playAction('victory');
      },
    });
  }
  addSeal(cells) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xd04cff, transparent: true, opacity: 0.45, depthWrite: false });
    this.seal = { meshes: [], cols: [], open: false, mat };
    for (const c of cells) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 0.6), mat);
      m.position.set(c.x, 4.5, c.z);
      this.scene.add(m);
      this.seal.meshes.push(m);
      this.seal.cols.push(G.physics.addBox(c.x - 2, -1, c.z - 0.4, c.x + 2, 20, c.z + 0.4));
    }
    const c0 = cells[Math.floor(cells.length / 2)];
    this.W.addInteractable({
      kind: 'seal', x: c0.x, y: 0, z: c0.z, r: 4,
      label: () => t('ui.sealedDoor'),
      can: () => !this.seal.open,
      act: () => G.ui.toast(t('ui.sealHint'), 'info'),
    });
  }
  openSeal() {
    if (!this.seal || this.seal.open) return;
    this.seal.open = true;
    for (const c of this.seal.cols) G.physics.remove(c);
    G.audio.sfx('rune');
    this.anim.push({ t: 0, d: 1.5, fn: (k) => { this.seal.mat.opacity = 0.45 * (1 - k); if (k >= 1) this.seal.meshes.forEach((m) => (m.visible = false)); } });
  }
  addPortal(id, x, y, z, target) {
    const mat = new THREE.MeshBasicMaterial({ color: target === 'cave' ? 0x1a0e2a : 0x8ab0ff, transparent: true, opacity: target === 'cave' ? 0.9 : 0.5 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.6), mat);
    m.position.set(x, y + 2.3, z);
    this.scene.add(m);
    this.W.addInteractable({
      kind: 'portal', x, y, z: z + (target === 'cave' ? 1.5 : 0), r: 3.2,
      label: () => t(target === 'cave' ? 'ui.enterCave' : 'ui.exitCave'),
      can: () => true,
      act: () => G.game.travelPortal(target),
    });
  }

  update(dt) {
    const t0 = G.time;
    for (const w of this.waystones) {
      w.crystal.rotation.y += dt * (w.active ? 1.5 : 0.3);
      w.crystal.position.y = w.y + 4.1 + Math.sin(t0 * 2 + w.def.x) * (w.active ? 0.2 : 0.05);
      const m = w.crystal.material;
      m.emissiveIntensity = w.active ? 1.2 + Math.sin(t0 * 3) * 0.3 : 0.15;
      m.color.setHex(w.active ? 0x6fe0ff : 0x6a7a8a);
      // auto-discover by proximity
      if (!w.active && G.player && dist2d(G.player.pos.x, G.player.pos.z, w.def.x, w.def.z) < 3.5) this.activateWaystone(w);
    }
    for (const n of this.nodes) {
      const ready = this.nodeReady(n);
      n.mesh.visible = ready;
    }
    if (this.altar) {
      this.altar.rune.rotation.y += dt;
      this.altar.rune.position.y = this.altar.y + 0.9 + Math.sin(t0 * 2) * 0.15;
      this.altar.rune.visible = !G.state.world.flags.altarDone;
    }
    if (this.pedestal) this.pedestal.sword.position.y = this.pedestal.y + 1.7 + Math.sin(t0 * 1.5) * 0.05;
    if (this.seal && !this.seal.open) {
      this.seal.mat.opacity = 0.35 + Math.sin(t0 * 3) * 0.1;
      if (G.quests.isActive('main5') && G.quests.stepIndex('main5') >= 1) this.openSeal();
    }
    for (let i = this.anim.length - 1; i >= 0; i--) {
      const a = this.anim[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.d);
      a.fn(k);
      if (k >= 1) this.anim.splice(i, 1);
    }
  }
}
