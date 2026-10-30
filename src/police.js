import * as THREE from 'three';
import { clamp, angleDiff, lerp } from './util.js';
import { cityAt, HIGHWAYS, heightAt, groundAt } from './world.js';
import { Vehicle } from './vehicle.js';
import { Character } from './character.js';
import { lanePoint } from './npc.js';
import { ui } from './i18n.js';

const COP_LOOK = { skin: 0xc68642, shirt: 0x1d2f5a, pants: 0x14203d, hair: 0x111111, cap: 0x14203d, sleeves: true, uniform: true };
const COP_LINES = [
  { pt: 'Parado! Polícia!', en: 'Freeze! Police!' },
  { pt: 'Mão na cabeça!', en: 'Hands on your head!' },
  { pt: 'Encosta o carro!', en: 'Pull over!' },
  { pt: 'Central, suspeito em fuga!', en: 'Dispatch, suspect fleeing!' },
];

function buildHeli() {
  const g = new THREE.Group();
  const body = new THREE.MeshPhysicalMaterial({ color: 0x1d2f5a, metalness: 0.4, roughness: 0.35, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1620, roughness: 0.05, clearcoat: 1 });
  const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
  add(new THREE.SphereGeometry(1.3, 14, 10).scale(1, 0.9, 1.6), body, 0, 0, 0);
  add(new THREE.SphereGeometry(1.0, 12, 8).scale(1, 0.8, 1), glass, 0, 0.15, 1.2);
  add(new THREE.BoxGeometry(0.35, 0.35, 5), body, 0, 0.3, -3.6);
  add(new THREE.BoxGeometry(0.08, 1.2, 0.7), body, 0, 0.8, -6);
  add(new THREE.BoxGeometry(0.1, 0.1, 2.6), dark, 0.8, -1.2, 0);
  add(new THREE.BoxGeometry(0.1, 0.1, 2.6), dark, -0.8, -1.2, 0);
  add(new THREE.BoxGeometry(1.7, 0.08, 0.08), dark, 0, -1.05, 0.7);
  add(new THREE.BoxGeometry(1.7, 0.08, 0.08), dark, 0, -1.05, -0.7);
  const rotor = new THREE.Group();
  rotor.position.y = 1.35;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.35), dark);
  rotor.add(blade, blade.clone().rotateY(Math.PI / 2));
  g.add(rotor);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.2), dark);
  tail.position.set(0.2, 0.8, -6);
  g.add(tail);
  const red = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 0 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2040ff, emissiveIntensity: 0 });
  add(new THREE.SphereGeometry(0.12, 6, 4), red, 0.9, 0.2, 0);
  add(new THREE.SphereGeometry(0.12, 6, 4), blue, -0.9, 0.2, 0);
  const lamp = add(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 3 }), 0, -1.1, 1.4);
  void lamp;
  // cone visível do holofote
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  g.add(cone);
  return { g, rotor, tail, red, blue, cone };
}

// polícia: viaturas perseguem, policiais a pé prendem, helicóptero procura com holofote
export class Police {
  constructor(game) {
    this.g = game;
    this.cars = [];
    this.cops = [];
    this.timer = 0;
    this.lostT = 0;
    this.bustT = 0;
    this.seen = false;
    this.heli = null;
    this.lineT = 0;
    this.search = new THREE.Vector3();
    this.spot = new THREE.SpotLight(0xfff4d8, 0, 220, 0.16, 0.5, 1.2);
    this.spot.castShadow = false;
    game.scene.add(this.spot, this.spot.target);
  }

  stars() { return Math.ceil(this.g.wanted - 0.05); }

  spawnPoint(P) {
    const c = cityAt(P.x, P.z, 120);
    for (let tries = 0; tries < 14; tries++) {
      if (c) {
        const i = Math.floor(Math.random() * (c.n + 1)), j = Math.floor(Math.random() * (c.n + 1));
        const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a <= c.n && b <= c.n);
        const p = lanePoint(c, [i, j], nb[Math.floor(Math.random() * nb.length)], 0.5);
        const d = Math.hypot(p.x - P.x, p.z - P.z);
        if (d > 70 && d < 220) return p;
      } else {
        let best = null;
        for (const H of HIGHWAYS) for (let k = 0; k < H.N; k += 3) {
          const d = Math.hypot(H.px[k] - P.x, H.pz[k] - P.z);
          if (d > 90 && d < 200 && (!best || Math.random() < 0.2)) best = { x: H.px[k], z: H.pz[k], h: Math.atan2(P.x - H.px[k], P.z - H.pz[k]) };
        }
        if (best) return best;
        const a = Math.random() * 6.28;
        const x = P.x + Math.cos(a) * 120, z = P.z + Math.sin(a) * 120;
        if (heightAt(x, z) > 0.5) return { x, z, h: a + Math.PI };
      }
    }
    return null;
  }

  spawnCar() {
    const g = this.g, P = g.focus;
    const sp = this.spawnPoint(P);
    if (!sp) return;
    if (g.vehicles.some((o) => Math.abs(o.pos.x - sp.x) < 8 && Math.abs(o.pos.z - sp.z) < 8)) return;
    const v = new Vehicle('police', 0x111418, sp.x, sp.z, sp.h);
    v.driver = 'ai'; v.police = true; v.sleeping = false; v.lights = true;
    const ch = new Character(COP_LOOK);
    ch.animate(0, 0, 'drive');
    v.setRider(ch);
    v.pursuit = { stuck: 0, rev: 0, deployed: false };
    g.addVehicle(v);
    this.cars.push(v);
  }

  drive(v, dt) {
    const g = this.g, P = g.focus, pv = g.player.vehicle;
    const s = v.pursuit;
    const tx = P.x + (pv ? pv.vel.x * 0.8 : 0), tz = P.z + (pv ? pv.vel.z * 0.8 : 0);
    const dx = tx - v.pos.x, dz = tz - v.pos.z, d = Math.hypot(dx, dz);
    const diff = angleDiff(v.heading, Math.atan2(dx, dz));
    const vx = v.fwdSpeed;
    if (this.stars() === 0) {
      // perdeu o suspeito: segue patrulhando devagar
      return { throttle: vx < 8 ? 0.3 : 0, brake: 0, steer: clamp(Math.sin(g.simTime * 0.3 + v.id) * 0.3, -1, 1), handbrake: false };
    }
    if (s.rev > 0) { s.rev -= dt; return { throttle: 0, brake: 1, steer: -clamp(diff * 2, -1, 1), handbrake: false }; }
    let want = d > 40 ? 40 : d > 12 ? 18 + (pv ? pv.speed : 0) : pv ? pv.speed + 4 : 2;
    if (!pv && d < 14) want = 0;
    want *= 1 - Math.min(Math.abs(diff), 1.4) * 0.45;
    const throttle = clamp((want - vx) * 0.4, 0, 1), brake = clamp((vx - want) * 0.5, 0, 1);
    if (throttle > 0.5 && Math.abs(vx) < 0.5) s.stuck += dt; else s.stuck = Math.max(0, s.stuck - dt);
    if (s.stuck > 1.8) { s.stuck = 0; s.rev = 1.3; }
    return { throttle, brake, steer: clamp(diff * 2.4, -1, 1), handbrake: Math.abs(diff) > 1.3 && vx > 10 };
  }

  copSay(ch) {
    if ((this.lineT -= 0) > this.g.simTime) return;
    this.lineT = this.g.simTime + 5;
    this.g.voice.say('pedM', COP_LINES[Math.floor(Math.random() * COP_LINES.length)], { ambient: true, char: ch, pitch: 0.8, seed: 7 });
  }

  update(dt) {
    const g = this.g, P = g.focus, W = this.stars(), plr = g.player;
    // viaturas
    this.timer -= dt;
    const want = [0, 1, 2, 3, 4, 5][W] * (g.settings.get('quality') === 'low' ? 0.7 : 1);
    if (this.timer <= 0) { this.timer = 1.2; if (this.cars.length < want) this.spawnCar(); }
    let nearest = 1e9;
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const v = this.cars[k];
      const d = Math.hypot(v.pos.x - P.x, v.pos.z - P.z);
      if (v.driver === 'player') { this.cars.splice(k, 1); continue; }
      if ((W === 0 && d > 120) || d > 450) { g.removeVehicle(v); this.cars.splice(k, 1); continue; }
      if (v.health > 0 && v.rider) {
        v.ai = { controls: (dt2) => this.drive(v, dt2) };
        nearest = Math.min(nearest, d);
        const on = Math.sin(g.simTime * 14) > 0;
        if (v.siren) { v.siren.red.emissiveIntensity = W && on ? 6 : 0; v.siren.blue.emissiveIntensity = W && !on ? 6 : 0; }
        // policial desce se o jogador está a pé
        if (W && (!plr.vehicle || (W >= 3 && plr.vehicle.speed < 4)) && d < 22 && v.speed < 2 && !v.pursuit.deployed) {
          v.pursuit.deployed = true;
          const ch = v.rider;
          v.setRider(null);
          const dp = v.doorPoint(1);
          const cop = { ch, pos: new THREE.Vector3(dp.x, groundAt(dp.x, dp.z), dp.z), heading: v.heading, down: 0, car: v, hp: 100, shotT: 1.2 };
          g.scene.add(ch.root);
          this.cops.push(cop);
          this.copSay(ch);
        }
      } else v.ai = null;
    }
    // policiais a pé
    for (let k = this.cops.length - 1; k >= 0; k--) {
      const c = this.cops[k];
      const dx = plr.pos.x - c.pos.x, dz = plr.pos.z - c.pos.z, d = Math.hypot(dx, dz);
      let sp = 0, mode = 'ground';
      if (c.dead) {
        c.deadT -= dt;
        if (c.deadT <= 0 && d > 40) { g.scene.remove(c.ch.root); this.cops.splice(k, 1); continue; }
        c.ch.root.position.copy(c.pos); c.ch.root.rotation.y = c.heading;
        c.ch.animate(dt, 0, 'dead');
        continue;
      }
      // a partir de 3 estrelas os policiais sacam a pistola e atiram
      const armed = W >= 3;
      if (armed && c.ch.weapon !== 'pistol') c.ch.setWeapon('pistol');
      if (!armed && c.ch.weapon) { c.ch.setWeapon(null); c.ch.aim = 0; }
      c.shotT = (c.shotT ?? 1) - dt;
      if (c.down > 0) { c.down -= dt; mode = 'down'; }
      else if (W && armed && d < 26) {
        c.heading = Math.atan2(dx, dz);
        sp = d > 9 ? 5 : d < 1.1 ? 0 : plr.vehicle ? 0 : d < 3 ? 4 : 0;
        c.ch.aim = Math.min(1, c.ch.aim + dt * 4);
        if (c.shotT <= 0 && !g.dead) { c.shotT = 1.0 + Math.random() * 0.7; g.combat.npcShoot(c, plr); }
        if (d < 1.4) this.bustT += dt * 1.6;
      } else if (W && !plr.vehicle) {
        c.ch.aim = 0;
        c.heading = Math.atan2(dx, dz);
        sp = d > 1.1 ? 5.6 : 0;
        if (d < 1.4) this.bustT += dt * 1.6;
      } else if (c.car && c.car.health > 0) {
        // volta pra viatura
        const ex = c.car.pos.x - c.pos.x, ez = c.car.pos.z - c.pos.z;
        c.heading = Math.atan2(ex, ez); sp = 4;
        if (Math.hypot(ex, ez) < 2.5) { g.scene.remove(c.ch.root); c.car.setRider(c.ch); c.ch.animate(0, 0, 'drive'); c.car.pursuit.deployed = false; this.cops.splice(k, 1); continue; }
      } else if (d > 150) { g.scene.remove(c.ch.root); this.cops.splice(k, 1); continue; }
      c.pos.x += Math.sin(c.heading) * sp * dt; c.pos.z += Math.cos(c.heading) * sp * dt;
      g.world.col.resolveCircle(c.pos, 0.35, c.pos.y);
      c.pos.y = groundAt(c.pos.x, c.pos.z);
      c.ch.root.position.copy(c.pos); c.ch.root.rotation.y = c.heading;
      c.ch.animate(dt, sp, mode);
      nearest = Math.min(nearest, d);
    }
    // helicóptero a partir de 3 estrelas
    if (W >= 3 && !this.heli) {
      this.heli = buildHeli();
      this.heli.pos = new THREE.Vector3(P.x + 200, 90, P.z + 200);
      this.heli.vel = new THREE.Vector3();
      g.scene.add(this.heli.g);
      this.search.set(P.x + 30, 0, P.z + 30);
    }
    let lit = false;
    if (this.heli) {
      const H = this.heli;
      const leave = W < 3;
      const goal = leave ? new THREE.Vector3(P.x + 600, 140, P.z + 600) : new THREE.Vector3(P.x - 35 + Math.sin(g.simTime * 0.2) * 25, Math.max(heightAt(P.x, P.z), 0) + 55, P.z - 35 + Math.cos(g.simTime * 0.23) * 25);
      const acc = goal.sub(H.pos).clampLength(0, 60).multiplyScalar(0.25);
      H.vel.addScaledVector(acc, dt).multiplyScalar(Math.exp(-dt * 0.6));
      H.pos.addScaledVector(H.vel, dt);
      H.g.position.copy(H.pos);
      H.g.rotation.set(clamp(H.vel.length() * 0.012, 0, 0.3), Math.atan2(H.vel.x, H.vel.z), Math.sin(g.simTime) * 0.05, 'YXZ');
      H.rotor.rotation.y += dt * 30; H.tail.rotation.x += dt * 40;
      const on = Math.sin(g.simTime * 6) > 0;
      H.red.emissiveIntensity = on ? 5 : 0; H.blue.emissiveIntensity = on ? 0 : 5;
      // holofote varre e vai alcançando o jogador
      const sx = P.x + Math.sin(g.simTime * 0.9) * 9, sz = P.z + Math.cos(g.simTime * 0.7) * 9;
      this.search.x = lerp(this.search.x, sx, 1 - Math.exp(-dt * 0.9));
      this.search.z = lerp(this.search.z, sz, 1 - Math.exp(-dt * 0.9));
      this.search.y = heightAt(this.search.x, this.search.z);
      const src = H.pos.clone().add(new THREE.Vector3(0, -1.2, 0));
      this.spot.position.copy(src);
      this.spot.target.position.copy(this.search);
      this.spot.intensity = leave ? 0 : 60000 * (0.3 + g.env.night * 0.7);
      const L = src.distanceTo(this.search);
      H.cone.position.copy(new THREE.Vector3(0, -1.2, 0));
      H.cone.visible = !leave;
      H.cone.scale.set(L * 0.16, L, L * 0.16);
      const dirW = this.search.clone().sub(src).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirW);
      H.cone.quaternion.copy(H.g.quaternion.clone().invert().multiply(q));
      H.cone.material.opacity = 0.03 + g.env.night * 0.09;
      lit = Math.hypot(this.search.x - P.x, this.search.z - P.z) < 8;
      g.audio.setHeli && g.audio.setHeli(clamp(1 - H.pos.distanceTo(g.camera.position) / 400, 0, 1));
      if (leave && H.pos.distanceTo(P) > 700) { g.scene.remove(H.g); this.heli = null; this.spot.intensity = 0; g.audio.setHeli && g.audio.setHeli(0); }
    }
    // visto pela polícia?
    this.seen = W > 0 && (nearest < 90 || lit);
    if (W > 0) {
      if (this.seen) { this.lostT = 0; g.crimeT = 0; }
      else {
        this.lostT += dt;
        if (this.lostT > 9 + W * 3) { this.lostT = 0; g.wanted = W - 1; g.wantedFlash = 2.5; }
      }
    }
    g.audio.setSiren && g.audio.setSiren(W > 0 ? clamp(1 - nearest / 160, 0, 1) : 0, W);
    // preso: parado perto da viatura ou alcançado a pé
    if (W > 0) {
      const slow = plr.vehicle ? plr.vehicle.speed < 1 : plr.speed < 0.5;
      if (slow && nearest < 6) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 0.5);
      if (this.bustT > 3) this.busted();
    } else this.bustT = 0;
  }

  busted() {
    const g = this.g;
    this.bustT = 0;
    g.hud.big(ui('busted', g.settings.get('lang')), `-$${Math.min(g.money, 250)}`, 3500, 'fail');
    g.money = Math.max(0, g.money - 250);
    g.wanted = 0;
    if (g.player.vehicle) g.exitVehicle(true);
    g.player.vel.set(0, 0, 0);
    g.lock(true);
    setTimeout(() => { g.placePlayer(512, 418.5, Math.PI); g.lock(false); this.clear(); }, 3000);
  }

  clear() {
    for (const v of this.cars) this.g.removeVehicle(v);
    for (const c of this.cops) this.g.scene.remove(c.ch.root);
    this.cars = []; this.cops = [];
  }

  // tiro/facada/taco num policial
  hurt(c, dmg) {
    if (c.dead) return;
    c.hp -= dmg;
    c.ch.hitT = 0.4;
    this.g.addWanted(Math.max(1, 3 - this.g.wanted) * 0.5 + 0.5);
    if (c.hp <= 0) {
      c.dead = true; c.deadT = 40; c.ch.setWeapon(null); c.ch.aim = 0;
      if (c.car) c.car.pursuit.deployed = true;
      this.g.dropMoney(c.pos.x, c.pos.z, 40);
      this.g.wanted = Math.min(5, Math.max(this.g.wanted, 3));
    }
  }

  // soco num policial
  punch(x, z, fx, fz) {
    for (const c of this.cops) {
      if (c.dead) continue;
      const dx = c.pos.x - x, dz = c.pos.z - z, d = Math.hypot(dx, dz);
      if (d < 1.5 && (dx * fx + dz * fz) / (d || 1) > 0.4) { c.down = 3; this.g.addWanted(1); return true; }
    }
    return false;
  }
}
