// Special powers with levels 1-5: energy ball, magic ray, energy burst,
// protective shield, fire wave, frost nova and short teleport.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { POWERS, POWER_MAX, powerUpgradeCost } from '../data/items.js';
import { angleDiff, dist2d } from '../core/utils.js';
import { t } from '../core/i18n.js';

export class Powers {
  constructor() { this.cd = {}; }
  get inv() { return G.state.inv; }
  level(id) { return this.inv.powerLevels[id] || 1; }
  owned(id) { return this.inv.owned.powers.includes(id); }
  cooldownLeft(id) { return Math.max(0, (this.cd[id] || 0) - G.time); }
  cooldownFrac(id) { const p = POWERS[id]; const l = this.cooldownLeft(id); return p ? l / this.cdFor(id) : 0; }
  cdFor(id) { return POWERS[id].cd * (1 - (this.level(id) - 1) * 0.06); }
  costFor(id) { return Math.round(POWERS[id].cost * (1 - (this.level(id) - 1) * 0.04)); }
  dmgFor(id) {
    const st = G.prog.stats();
    return POWERS[id].dmg * (1 + (this.level(id) - 1) * 0.28) * st.powMul;
  }

  unlock(id) {
    if (this.owned(id)) return false;
    this.inv.owned.powers.push(id);
    this.inv.powerLevels[id] = 1;
    const slot = this.inv.powerSlots.indexOf(null);
    if (slot >= 0) this.inv.powerSlots[slot] = id;
    G.bus.emit('powerUnlocked', id);
    return true;
  }
  equip(id, slot) {
    const s = this.inv.powerSlots;
    const cur = s.indexOf(id);
    if (cur >= 0) s[cur] = s[slot];
    s[slot] = id;
  }
  canUpgrade(id) {
    const l = this.level(id);
    if (l >= POWER_MAX) return { ok: false, reason: 'max' };
    const c = powerUpgradeCost(l);
    if (G.state.player.level < c.level) return { ok: false, reason: 'level', c };
    if (G.state.player.gold < c.gold) return { ok: false, reason: 'gold', c };
    if (G.inv.count('essence') < c.essence) return { ok: false, reason: 'essence', c };
    return { ok: true, c };
  }
  upgrade(id) {
    const r = this.canUpgrade(id);
    if (!r.ok) { G.audio.sfx('error'); return false; }
    G.prog.spendGold(r.c.gold);
    G.inv.remove('essence', r.c.essence);
    this.inv.powerLevels[id] = this.level(id) + 1;
    G.audio.sfx('levelup');
    G.ui.toast(t('ui.powerUpgraded', { name: t('power.' + id + '.name'), n: this.level(id) }), 'power');
    G.game.autosave();
    return true;
  }

  cast(slot) {
    const id = this.inv.powerSlots[slot];
    const P = G.player;
    if (!id) { G.ui.toast(t('ui.noPowerSlot'), 'info'); return; }
    if (P.busy() || P.swimming) return;
    if (this.cooldownLeft(id) > 0) { G.audio.sfx('error', { vol: 0.4 }); return; }
    const cost = this.costFor(id);
    if (G.state.player.energy < cost) { G.ui.toast(t('ui.noEnergy'), 'warn'); G.audio.sfx('error', { vol: 0.5 }); return; }
    G.state.player.energy -= cost;
    this.cd[id] = G.time + this.cdFor(id);
    G.state.ach.stats.powersUsed++;
    G.events?.track('powers', 1);
    const target = P.lockTarget || G.combat.nearestEnemy(P.pos, 22, P.yaw, 0.9);
    if (target && id !== 'blink') P.yaw = Math.atan2(target.pos.x - P.pos.x, target.pos.z - P.pos.z);
    const def = POWERS[id];
    const lvl = this.level(id);
    const dmg = this.dmgFor(id);
    const yaw = P.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const origin = new THREE.Vector3(P.pos.x + fx * 0.8, P.pos.y + 1.3, P.pos.z + fz * 0.8);
    const delay = (ms, fn) => setTimeout(fn, ms);
    switch (id) {
      case 'energy_ball': {
        P.startCast('cast_ball', 0.45);
        delay(150, () => {
          const n = lvl >= 4 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const sp = (i - (n - 1) / 2) * 0.18;
            const dir = new THREE.Vector3(Math.sin(yaw + sp), 0, Math.cos(yaw + sp));
            if (target) dir.y = (target.pos.y + 1 - origin.y) / Math.max(1, dist2d(origin.x, origin.z, target.pos.x, target.pos.z));
            G.combat.spawnProjectile({
              friendly: true, x: origin.x, y: origin.y, z: origin.z, dir, speed: 24, dmg: dmg / (n > 1 ? 1.6 : 1), color: def.color, size: 0.38 + lvl * 0.04,
              homing: 3 + lvl, homingTarget: target,
              onExplode: lvl >= 3 ? (pos) => { for (const e of G.combat.enemiesInRadius(pos.x, pos.z, 2.8)) e.takeDamage(dmg * 0.35, { power: true }); G.particles.ring(pos.x, pos.y, pos.z, def.color, 2.5, 20); } : null,
            });
          }
          G.audio.sfx('orb');
        });
        break;
      }
      case 'magic_ray': {
        P.startCast('cast_ray', 0.7);
        delay(220, () => {
          const range = 22 + lvl * 2;
          G.combat.beamVisual(origin, yaw, range, def.color, 0.45 + lvl * 0.05);
          for (const e of G.combat.enemies()) {
            if (e.dead) continue;
            const px = e.pos.x - origin.x, pz = e.pos.z - origin.z;
            const along = px * fx + pz * fz, perp = Math.abs(px * fz - pz * fx);
            if (along > 0 && along < range && perp < 1.2 + e.radius) { e.takeDamage(dmg, { power: true, knock: 4 }); G.particles.burst(e.pos.x, e.pos.y + 1, e.pos.z, def.color, 14, 4); }
          }
          G.audio.sfx('ray');
          G.cam.shake(0.15);
        });
        break;
      }
      case 'energy_burst': {
        P.startCast('cast_burst', 0.75);
        delay(330, () => {
          const r = 5.5 + lvl * 0.6;
          G.particles.ring(P.pos.x, P.pos.y + 0.5, P.pos.z, def.color, r, 60, { speed: r * 2, size: 0.4 });
          G.particles.burst(P.pos.x, P.pos.y + 1, P.pos.z, 0xffffff, 40, 8, { up: 3 });
          for (const e of G.combat.enemiesInRadius(P.pos.x, P.pos.z, r, P.pos.y)) e.takeDamage(dmg, { power: true, knock: 12 });
          G.audio.sfx('explosion');
          G.cam.shake(0.5);
          G.ui.screenFlash(0.25, '#ffe26a');
        });
        break;
      }
      case 'shield': {
        P.startCast('cast_shield', 0.5);
        P.shield = 30 + lvl * 18 + G.prog.stats().spi * 4;
        P.shieldT = 6 + lvl;
        G.audio.sfx('shield');
        G.particles.burst(P.pos.x, P.pos.y + 1, P.pos.z, def.color, 30, 3, { gravity: 0 });
        break;
      }
      case 'fire_wave': {
        P.startCast('cast_fire', 0.6);
        delay(150, () => {
          const range = 7 + lvl * 0.6;
          for (let i = 0; i < 70; i++) {
            const a = yaw + (Math.random() - 0.5) * 1.3, s = 8 + Math.random() * 8;
            G.particles.glow.spawn(origin.x, origin.y - 0.3, origin.z, Math.sin(a) * s, Math.random() * 2, Math.cos(a) * s, Math.random() < 0.5 ? 0xff6a1a : 0xffc83a, 0.45, 0.45 + Math.random() * 0.3, { drag: 2 });
          }
          for (const e of G.combat.enemies()) {
            if (e.dead) continue;
            const d = dist2d(P.pos.x, P.pos.z, e.pos.x, e.pos.z);
            const a = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
            if (d < range + e.radius && Math.abs(angleDiff(yaw, a)) < 0.7) { e.takeDamage(dmg, { power: true, knock: 3 }); e.status.burn = 4; e.status.burnDps = dmg * 0.3; }
          }
          G.audio.sfx('fire');
        });
        break;
      }
      case 'frost_nova': {
        P.startCast('cast_frost', 0.6);
        delay(240, () => {
          const r = 6.5 + lvl * 0.5;
          G.particles.ring(P.pos.x, P.pos.y + 0.3, P.pos.z, def.color, r, 70, { speed: r * 1.8 });
          for (let i = 0; i < 30; i++) G.particles.solid.spawn(P.pos.x + (Math.random() - 0.5) * r * 2, P.pos.y + 0.2, P.pos.z + (Math.random() - 0.5) * r * 2, 0, 3 + Math.random() * 3, 0, 0xe8faff, 0.3, 1, { gravity: 6 });
          for (const e of G.combat.enemiesInRadius(P.pos.x, P.pos.z, r, P.pos.y)) { e.takeDamage(dmg, { power: true }); e.status.frozen = e.boss ? 1 + lvl * 0.2 : 2.2 + lvl * 0.4; }
          G.audio.sfx('freeze');
          G.cam.shake(0.25);
        });
        break;
      }
      case 'blink': {
        P.startCast('cast_blink', 0.3);
        const dist = 7 + lvl;
        G.particles.burst(P.pos.x, P.pos.y + 1, P.pos.z, def.color, 30, 4);
        const mv = G.input.moveVector();
        let by = yaw;
        if (Math.hypot(mv.x, mv.y) > 0.2) { const cy = G.cam.yaw; by = Math.atan2(Math.sin(cy) * mv.y - Math.cos(cy) * mv.x, Math.cos(cy) * mv.y + Math.sin(cy) * mv.x); P.yaw = by; }
        const steps = 16;
        for (let i = 0; i < steps; i++) {
          const blocked = G.physics.move(P.pos, Math.sin(by) * dist / steps, Math.cos(by) * dist / steps, P.radius, P.height, false);
          if (blocked) break;
        }
        P.invuln = 0.4;
        G.particles.burst(P.pos.x, P.pos.y + 1, P.pos.z, def.color, 30, 4);
        G.audio.sfx('blink');
        G.cam.snap();
        break;
      }
      default: break;
    }
    G.bus.emit('powerUsed', id);
  }
}
