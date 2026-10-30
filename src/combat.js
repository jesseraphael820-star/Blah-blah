import * as THREE from 'three';
import { clamp, angleDiff } from './util.js';
import { heightAt } from './world.js';
import { GUNS } from './shops.js';
import { ui } from './i18n.js';

// dano, alcance e cadência de cada arma
export const WEAPONS = {
  fist: { icon: '👊', melee: true },
  bat: { icon: '🏏', melee: true, dmg: 45, range: 2.0, rate: 0.55 },
  knife: { icon: '🔪', melee: true, dmg: 60, range: 1.6, rate: 0.45 },
  pistol: { icon: '🔫', dmg: 34, range: 70, rate: 0.28, spread: 0.012, pellets: 1 },
  shotgun: { icon: '💥', dmg: 15, range: 35, rate: 0.95, spread: 0.07, pellets: 8 },
};
const ORDER = ['fist', 'bat', 'knife', 'pistol', 'shotgun'];

// armas do jogador, tiros (raio contra pedestres, policiais, carros e prédios), tiros dos NPCs e dinheiro no chão
export class Combat {
  constructor(game) {
    this.g = game;
    this.current = 'fist';
    this.cool = 0;
    this.pickups = [];
    this.tracers = [];
    this.target = null;
    this.billGeo = new THREE.BoxGeometry(0.32, 0.04, 0.16);
    this.billMat = new THREE.MeshStandardMaterial({ color: 0x3fae49, emissive: 0x1d6b25, emissiveIntensity: 0.6 });
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.9 });
    this.cross = document.getElementById('crosshair');
    this.hud = document.getElementById('weapon');
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3(); this._o = new THREE.Vector3();
    game.dropMoney = (x, z, n) => this.dropMoney(x, z, n);
  }

  get data() { return this.g.shops.data; }
  owned() { return ORDER.filter((k) => k === 'fist' || this.data.weapons[k]); }

  equip(k) {
    if (k !== 'fist' && !this.data.weapons[k]) return;
    this.current = k;
    this.g.player.char.setWeapon(k);
    this.g.audio.click();
  }
  cycle(dir) {
    const list = this.owned();
    const i = list.indexOf(this.current);
    this.equip(list[(i + dir + list.length) % list.length]);
  }

  // ------------------------------------------------ jogador
  update(dt, inp) {
    const g = this.g, p = g.player, ch = p.char, W = WEAPONS[this.current];
    this.cool -= dt;
    if (ch.weapon !== this.current && !(this.current === 'fist' && !ch.weapon)) ch.setWeapon(this.current);
    const free = !g.locked && !p.vehicle && p.down <= 0 && !g.shops.open;
    if (free && !p.swim) {
      if (inp.weaponNext) this.cycle(1);
      if (inp.weaponPrev) this.cycle(-1);
      if (inp.weaponSlot >= 0 && ORDER[inp.weaponSlot]) this.equip(ORDER[inp.weaponSlot]);
    }
    const gun = !W.melee;
    const aiming = free && !p.swim && gun && (inp.aim || (inp.fire && g.input.scheme === 'touch'));
    ch.aim = aiming ? Math.min(1, ch.aim + dt * 6) : Math.max(0, ch.aim - dt * 6);
    this.cross.classList.toggle('hidden', !aiming);
    // trava no alvo mais perto da mira (controle/toque) ou segue o centro da tela (mouse)
    this.target = aiming ? this.pickTarget() : null;
    this.cross.classList.toggle('lock', !!this.target);
    if (aiming) {
      const cam = g.camera;
      cam.getWorldDirection(this._d);
      if (this.target && g.input.scheme !== 'keyboard') this._d.copy(this.target.pos).setY(this.target.pos.y + 1.2).sub(this.eye()).normalize();
      p.heading += clamp(angleDiff(p.heading, Math.atan2(this._d.x, this._d.z)), -dt * 18, dt * 18);
      ch.aimPitch = clamp(this._d.y, -0.8, 0.8);
    }
    // ataque
    const pressed = gun ? (W === WEAPONS.pistol ? inp.punch : inp.fire || inp.punch) : inp.punch;
    if (free && !p.swim && this.current !== 'fist' && pressed && this.cool <= 0) {
      if (W.melee) this.melee(W);
      else if (aiming || g.input.scheme !== 'keyboard' || inp.punch) this.shoot(W, aiming);
    }
    this.updatePickups(dt);
    this.updateTracers(dt);
    const ammo = W.melee ? '' : `<small>${this.data.ammo[this.current] || 0}</small>`;
    this.hud.innerHTML = this.current === 'fist' ? '' : `${W.icon}${ammo}`;
  }

  eye() { const p = this.g.player; return this._o.set(p.pos.x, p.pos.y + 1.45, p.pos.z); }

  // alvo mais alinhado com a câmera, até 45 m
  pickTarget() {
    const g = this.g, cam = g.camera, p = g.player;
    cam.getWorldDirection(this._d);
    let best = null, bs = 0.93;
    const consider = (o, hostile) => {
      const dx = o.pos.x - p.pos.x, dy = o.pos.y + 1.1 - (p.pos.y + 1.45), dz = o.pos.z - p.pos.z, d = Math.hypot(dx, dy, dz);
      if (d > 45 || d < 0.5) return;
      const dot = (dx * this._d.x + dy * this._d.y + dz * this._d.z) / d + (hostile ? 0.03 : 0);
      if (dot > bs) { bs = dot; best = o; }
    };
    for (const q of g.peds.list) if (q.state !== 'dead') consider(q, q.gang && q.state === 'attack');
    for (const c of g.police.cops) if (!c.dead) consider(c, true);
    for (const a of g.animals ? g.animals.dogs : []) if (!a.dead) consider(a, false);
    return best;
  }

  melee(W) {
    const g = this.g, p = g.player, ch = p.char;
    this.cool = W.rate;
    ch.swingT = 0.42;
    g.audio.swing();
    setTimeout(() => {
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      let hit = false;
      for (const q of g.peds.list) {
        const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < W.range && (dx * fx + dz * fz) / (d || 1) > 0.3) { g.peds.damage(q, W.dmg, fx, fz); hit = true; this.blood(q.pos.x, q.pos.y + 1.2, q.pos.z, 4); }
      }
      for (const c of g.police.cops) {
        const dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < W.range && (dx * fx + dz * fz) / (d || 1) > 0.3) { g.police.hurt(c, W.dmg); hit = true; }
      }
      if (g.animals) hit = g.animals.hit(p.pos.x + fx, p.pos.z + fz, 1.4, W.dmg) || hit;
      if (hit) { g.audio.punch(); g.input.rumble(0.5, 0.4, 120); g.cam.shake = Math.max(g.cam.shake, 0.1); }
    }, 170);
  }

  shoot(W, aiming) {
    const g = this.g, p = g.player, d = this.data;
    if (!(d.ammo[this.current] > 0)) { this.cool = 0.4; g.audio.click(); g.hud.hint(ui('noAmmo', g.settings.get('lang')), 1500); return; }
    d.ammo[this.current]--;
    this.cool = W.rate;
    const o = this.eye().clone();
    // direção: centro da tela mirando com mouse, senão o alvo travado, senão pra frente
    const dir = new THREE.Vector3();
    const tgt = this.target || (!aiming ? this.autoTarget() : null);
    if (aiming && g.input.scheme === 'keyboard') {
      // raio da câmera até o que está no centro, depois da arma até esse ponto
      g.camera.getWorldDirection(dir);
      const far = g.camera.position.clone().addScaledVector(dir, 60);
      dir.copy(far).sub(o).normalize();
    } else if (tgt) dir.set(tgt.pos.x, tgt.pos.y + 1.1, tgt.pos.z).sub(o).normalize();
    else dir.set(Math.sin(p.heading), 0, Math.cos(p.heading));
    if (tgt && !aiming) p.heading = Math.atan2(dir.x, dir.z);
    p.char.aim = Math.max(p.char.aim, 0.9);
    const muzzle = o.clone().addScaledVector(dir, 0.75).add(new THREE.Vector3(Math.cos(p.heading) * -0.15, -0.1, Math.sin(p.heading) * 0.15));
    g.fx.sprite(muzzle.x, muzzle.y, muzzle.z, { color: 0xffd080, op: 1, add: true, size: this.current === 'shotgun' ? 0.7 : 0.45, life: 0.06, grow: 1 });
    g.audio.gun(this.current);
    g.input.rumble(this.current === 'shotgun' ? 0.8 : 0.4, 0.5, 90);
    g.cam.shake = Math.max(g.cam.shake, this.current === 'shotgun' ? 0.18 : 0.06);
    for (let k = 0; k < W.pellets; k++) {
      const dd = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * W.spread * 2, (Math.random() - 0.5) * W.spread * 2, (Math.random() - 0.5) * W.spread * 2)).normalize();
      this.ray(o, dd, W.range, W.dmg, true, muzzle);
    }
    // tiro chama atenção: pedestres fogem, polícia vem
    g.peds.scare(p.pos.x, p.pos.z, 40);
    if (g.wanted < 1) g.addWanted(0.35);
  }

  // alvo automático mais perto à frente (atirar sem mirar)
  autoTarget() {
    const g = this.g, p = g.player, fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    let best = null, bd = 25;
    const list = [...g.peds.list.filter((q) => q.state !== 'dead'), ...g.police.cops.filter((c) => !c.dead)];
    for (const q of list) {
      const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.8) { bd = d; best = q; }
    }
    return best;
  }

  // raio em passos: para no primeiro prédio/chão/pessoa/carro
  ray(o, dir, range, dmg, byPlayer, from) {
    const g = this.g, pos = this._v.copy(o), colList = [];
    let hitPoint = null;
    for (let s = 0.6; s < range; s += 0.35) {
      pos.copy(o).addScaledVector(dir, s);
      if (pos.y < heightAt(pos.x, pos.z) + 0.05) { hitPoint = pos.clone(); this.dust(hitPoint); break; }
      for (const b of g.world.col.query(pos.x, pos.z, 0.1, colList)) if (pos.x > b.x0 && pos.x < b.x1 && pos.z > b.z0 && pos.z < b.z1 && pos.y < b.y1 && pos.y > b.y0) { hitPoint = pos.clone(); break; }
      if (hitPoint) { this.dust(hitPoint); break; }
      if (byPlayer) {
        let done = false;
        for (const q of g.peds.list) {
          if (q.state === 'dead' || Math.abs(q.pos.x - pos.x) > 0.45 || Math.abs(q.pos.z - pos.z) > 0.45 || pos.y < q.pos.y || pos.y > q.pos.y + 1.85) continue;
          const head = pos.y > q.pos.y + 1.55;
          g.peds.damage(q, head ? dmg * 2.5 : dmg, dir.x, dir.z);
          this.blood(pos.x, pos.y, pos.z, head ? 8 : 5);
          done = true; break;
        }
        if (!done) for (const c of g.police.cops) {
          if (c.dead || Math.abs(c.pos.x - pos.x) > 0.45 || Math.abs(c.pos.z - pos.z) > 0.45 || pos.y < c.pos.y || pos.y > c.pos.y + 1.85) continue;
          g.police.hurt(c, pos.y > c.pos.y + 1.55 ? dmg * 2.5 : dmg);
          this.blood(pos.x, pos.y, pos.z, 5);
          done = true; break;
        }
        if (!done && g.animals && g.animals.hit(pos.x, pos.z, 0.5, dmg, pos.y)) done = true;
        if (done) { hitPoint = pos.clone(); break; }
      }
      let carHit = null;
      for (const v of g.vehicles) if (v !== g.player.vehicle && v.contains(pos.x, pos.z, 0) && pos.y < v.pos.y + v.t.height + 0.2 && pos.y > v.pos.y) { carHit = v; break; }
      if (carHit) {
        hitPoint = pos.clone();
        carHit.health -= dmg * 0.9;
        carHit.sleeping = false;
        g.fx.sparks(pos.x, pos.y, pos.z, 4);
        if (byPlayer && carHit.police) g.addWanted(0.5);
        break;
      }
    }
    const end = hitPoint || o.clone().addScaledVector(dir, range);
    this.tracer(from || o, end);
    return hitPoint;
  }

  // NPC atira no jogador (gangue, polícia): chance de acerto cai com distância e com o jogador correndo
  npcShoot(shooter, plr) {
    const g = this.g;
    const o = new THREE.Vector3(shooter.pos.x, shooter.pos.y + 1.45, shooter.pos.z);
    const tp = plr.vehicle ? plr.vehicle.pos : plr.pos;
    const t = new THREE.Vector3(tp.x, tp.y + 1.1, tp.z);
    const d = o.distanceTo(t);
    const moving = plr.vehicle ? plr.vehicle.speed : plr.speed;
    const chance = clamp(0.6 - d * 0.018 - moving * 0.03, 0.08, 0.6);
    const hit = Math.random() < chance;
    const aim = t.clone().add(hit ? new THREE.Vector3() : new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3));
    const dir = aim.sub(o).normalize();
    const fx = Math.sin(shooter.heading), fz = Math.cos(shooter.heading);
    const muzzle = o.clone().add(new THREE.Vector3(fx * 0.7, -0.05, fz * 0.7));
    g.fx.sprite(muzzle.x, muzzle.y, muzzle.z, { color: 0xffd080, op: 1, add: true, size: 0.4, life: 0.06, grow: 1 });
    g.audio.gun('pistol', o.distanceTo(g.camera.position));
    const wall = this.ray(o, dir, d + 0.5, 0, false, muzzle);
    if (hit && (!wall || wall.distanceTo(o) > d - 0.6)) {
      if (plr.vehicle) { plr.vehicle.health -= 15; plr.health -= 2; g.fx.sparks(t.x, t.y, t.z, 4); }
      else { plr.health -= 8; this.blood(t.x, t.y + 0.2, t.z, 3); }
      g.input.rumble(0.5, 0.5, 120);
      g.cam.shake = Math.max(g.cam.shake, 0.1);
      g.hud.flash && g.hud.flash();
    }
  }

  // ------------------------------------------------ efeitos
  tracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const line = new THREE.Line(geo, this.tracerMat.clone());
    this.g.scene.add(line);
    this.tracers.push({ line, t: 0.07 });
  }
  updateTracers(dt) {
    for (let k = this.tracers.length - 1; k >= 0; k--) {
      const T = this.tracers[k];
      T.t -= dt;
      T.line.material.opacity = Math.max(0, T.t / 0.07);
      if (T.t <= 0) { this.g.scene.remove(T.line); T.line.geometry.dispose(); T.line.material.dispose(); this.tracers.splice(k, 1); }
    }
  }
  blood(x, y, z, n) {
    for (let k = 0; k < n; k++) this.g.fx.sprite(x, y, z, { color: 0x7a0a0a, op: 0.9, size: 0.12, life: 0.5, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 2, g: 9, grow: 1.8 });
  }
  dust(p) {
    for (let k = 0; k < 4; k++) this.g.fx.sprite(p.x, p.y, p.z, { color: 0xb8a890, op: 0.6, size: 0.18, life: 0.6, vx: (Math.random() - 0.5), vy: Math.random(), vz: (Math.random() - 0.5), g: 2, grow: 2 });
    this.g.fx.sparks(p.x, p.y, p.z, 2);
  }

  // ------------------------------------------------ dinheiro no chão
  dropMoney(x, z, n) {
    const m = new THREE.Mesh(this.billGeo, this.billMat);
    m.position.set(x, heightAt(x, z) + 0.3, z);
    this.g.scene.add(m);
    this.pickups.push({ m, n, t: 60 });
  }
  updatePickups(dt) {
    const g = this.g, p = g.player;
    for (let k = this.pickups.length - 1; k >= 0; k--) {
      const P = this.pickups[k];
      P.t -= dt;
      P.m.rotation.y += dt * 3;
      P.m.position.y += Math.sin(g.simTime * 4 + k) * 0.002;
      const d = Math.hypot(P.m.position.x - p.pos.x, P.m.position.z - p.pos.z);
      if (d < 1.3 && !p.vehicle) {
        g.money += P.n;
        g.audio.cash();
        g.hud.hint(`~g~+$${P.n}~w~`, 1200);
        P.t = 0;
      }
      if (P.t <= 0) { g.scene.remove(P.m); this.pickups.splice(k, 1); }
    }
  }
}

export { GUNS };
