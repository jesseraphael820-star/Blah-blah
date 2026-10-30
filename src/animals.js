import * as THREE from 'three';
import { clamp, angleDiff } from './util.js';
import { cityAt, groundAt, heightAt, surfaceAt } from './world.js';

const DOG_COLORS = [0x6b4a2b, 0xd8c39a, 0x222222, 0xa0522d, 0xeeeeee, 0x8a7a66];

function buildDog(color) {
  const root = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const add = (p, w, h, d, x, y, z, mm = m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm); me.position.set(x, y, z); me.castShadow = true; p.add(me); return me; };
  const body = new THREE.Group(); root.add(body);
  add(body, 0.26, 0.24, 0.62, 0, 0.42, 0);
  const head = new THREE.Group(); head.position.set(0, 0.58, 0.34); body.add(head);
  add(head, 0.2, 0.2, 0.22, 0, 0, 0.04);
  add(head, 0.12, 0.1, 0.14, 0, -0.04, 0.2);
  add(head, 0.05, 0.05, 0.03, 0, -0.01, 0.28, dark);
  add(head, 0.05, 0.1, 0.03, 0.08, 0.13, 0, m).rotation.z = -0.3;
  add(head, 0.05, 0.1, 0.03, -0.08, 0.13, 0, m).rotation.z = 0.3;
  const tail = new THREE.Group(); tail.position.set(0, 0.5, -0.31); body.add(tail);
  add(tail, 0.05, 0.05, 0.25, 0, 0.05, -0.1).rotation.x = -0.6;
  const legs = [];
  for (const [x, z] of [[0.09, 0.22], [-0.09, 0.22], [0.09, -0.22], [-0.09, -0.22]]) {
    const l = new THREE.Group(); l.position.set(x, 0.32, z); body.add(l);
    add(l, 0.07, 0.32, 0.07, 0, -0.16, 0);
    legs.push(l);
  }
  return { root, body, head, tail, legs };
}

// pássaro: duas asas planas que batem (usado pra passarinho, pombo e gaivota)
function buildBird(color, s) {
  const root = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.1 * s, 0.32 * s), m); root.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.08 * s), m); head.position.set(0, 0.05 * s, 0.18 * s); root.add(head);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.03 * s, 0.06 * s), new THREE.MeshStandardMaterial({ color: 0xf0a020 })); beak.position.set(0, 0.04 * s, 0.24 * s); root.add(beak);
  const wg = new THREE.PlaneGeometry(0.42 * s, 0.18 * s).rotateX(-Math.PI / 2);
  const wl = new THREE.Group(), wr = new THREE.Group();
  const a = new THREE.Mesh(wg, m); a.position.x = 0.21 * s; wl.add(a);
  const b = new THREE.Mesh(wg, m); b.position.x = -0.21 * s; wr.add(b);
  root.add(wl, wr);
  return { root, wl, wr };
}

// cachorros nas calçadas, passarinhos e pombos na cidade, gaivotas na praia
export class Animals {
  constructor(game) {
    this.g = game;
    this.dogs = [];
    this.birds = [];
    this.timer = 0;
  }

  update(dt) {
    const g = this.g, P = g.focus, plr = g.player;
    const c = cityAt(P.x, P.z, 60);
    const coast = P.x > 930;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 1;
      if (c && this.dogs.length < (c.kind === 'metro' ? 4 : 3)) this.spawnDog(P);
      const flying = this.birds.filter((b) => b.kind !== 'pigeon').length;
      if (flying < (coast ? 10 : c ? 8 : 4)) this.spawnBird(P, coast ? 'gull' : 'bird');
      if (c && this.birds.filter((b) => b.kind === 'pigeon').length < 8 && Math.random() < 0.3) this.spawnPigeons(P);
    }
    for (let k = this.dogs.length - 1; k >= 0; k--) if (!this.updateDog(this.dogs[k], dt, P, plr)) { g.scene.remove(this.dogs[k].m.root); this.dogs.splice(k, 1); }
    for (let k = this.birds.length - 1; k >= 0; k--) if (!this.updateBird(this.birds[k], dt, P, plr)) { g.scene.remove(this.birds[k].m.root); this.birds.splice(k, 1); }
  }

  // ------------------------------------------------ cachorros
  spawnDog(P) {
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * 6.28, r = 35 + Math.random() * 50;
      const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (surfaceAt(x, z) !== 'walk') continue;
      const m = buildDog(DOG_COLORS[Math.floor(Math.random() * DOG_COLORS.length)]);
      const s = 0.8 + Math.random() * 0.5;
      m.root.scale.setScalar(s);
      this.g.scene.add(m.root);
      this.dogs.push({ m, pos: new THREE.Vector3(x, groundAt(x, z), z), heading: a, goal: null, t: 0, phase: 0, hp: 40, barkT: 0, flee: 0 });
      return;
    }
  }
  updateDog(d, dt, P, plr) {
    const g = this.g;
    const dist = Math.hypot(d.pos.x - P.x, d.pos.z - P.z);
    if (dist > 160 && (!d.dead || dist > 60)) return false;
    if (d.dead) { d.m.body.rotation.z = Math.PI / 2; d.m.body.position.y = -0.18; d.m.root.position.copy(d.pos); return true; }
    d.t -= dt; d.barkT -= dt; d.flee -= dt;
    const px = plr.vehicle ? plr.vehicle.pos.x : plr.pos.x, pz = plr.vehicle ? plr.vehicle.pos.z : plr.pos.z;
    const dp = Math.hypot(d.pos.x - px, d.pos.z - pz);
    let speed = 0;
    if (d.flee > 0) { d.heading = Math.atan2(d.pos.x - px, d.pos.z - pz); speed = 6; }
    else {
      // late pro jogador quando chega perto
      if (dp < 7 && !plr.vehicle) {
        d.heading += clamp(angleDiff(d.heading, Math.atan2(px - d.pos.x, pz - d.pos.z)), -dt * 5, dt * 5);
        if (d.barkT <= 0) { d.barkT = 1.5 + Math.random() * 2; g.audio.bark(dp); d.m.head.rotation.x = -0.3; }
        if (plr.speed > 5 && dp < 3) d.flee = 3;
      } else {
        if (!d.goal || d.t <= 0) {
          d.t = 3 + Math.random() * 5;
          const a = Math.random() * 6.28, r = 4 + Math.random() * 10;
          const gx = d.pos.x + Math.cos(a) * r, gz = d.pos.z + Math.sin(a) * r;
          d.goal = surfaceAt(gx, gz) === 'walk' ? { x: gx, z: gz } : null;
        }
        if (d.goal) {
          const dx = d.goal.x - d.pos.x, dz = d.goal.z - d.pos.z, gd = Math.hypot(dx, dz);
          if (gd > 0.5) { d.heading += clamp(angleDiff(d.heading, Math.atan2(dx, dz)), -dt * 4, dt * 4); speed = d.t > 6 ? 3.5 : 1.3; }
        }
      }
    }
    // carro chegando: sai correndo
    for (const v of g.vehicles) if (v.speed > 5 && v.contains(d.pos.x - v.vel.x * 0.4, d.pos.z - v.vel.z * 0.4, 2)) d.flee = 2;
    for (const v of g.vehicles) if (v.speed > 6 && v.contains(d.pos.x, d.pos.z, 0.2)) { this.kill(d); g.audio.crash(3); return true; }
    d.pos.x += Math.sin(d.heading) * speed * dt; d.pos.z += Math.cos(d.heading) * speed * dt;
    g.world.col.resolveCircle(d.pos, 0.3, d.pos.y);
    d.pos.y = groundAt(d.pos.x, d.pos.z);
    // patas, rabo abanando
    d.phase += dt * (speed > 0.2 ? 4 + speed * 2 : 0);
    const sw = Math.sin(d.phase) * (speed > 0.2 ? 0.6 : 0);
    d.m.legs[0].rotation.x = sw; d.m.legs[3].rotation.x = sw; d.m.legs[1].rotation.x = -sw; d.m.legs[2].rotation.x = -sw;
    d.m.tail.rotation.y = Math.sin(g.simTime * (dp < 7 ? 14 : 5)) * 0.6;
    d.m.head.rotation.x *= Math.exp(-dt * 4);
    d.m.body.position.y = Math.abs(Math.sin(d.phase)) * 0.03 * (speed > 2 ? 1 : 0);
    d.m.root.position.copy(d.pos); d.m.root.rotation.y = d.heading;
    return true;
  }
  kill(d) { d.dead = true; d.hp = 0; }

  // golpe/tiro em área: devolve true se acertou algum bicho
  hit(x, z, r, dmg, y) {
    let any = false;
    for (const d of this.dogs) {
      if (d.dead || Math.hypot(d.pos.x - x, d.pos.z - z) > r || (y !== undefined && (y < d.pos.y || y > d.pos.y + 0.8))) continue;
      d.hp -= dmg; any = true;
      if (d.hp <= 0) this.kill(d); else d.flee = 4;
    }
    return any;
  }

  // ------------------------------------------------ pássaros
  spawnBird(P, kind) {
    const gull = kind === 'gull';
    const m = buildBird(gull ? 0xf4f4f4 : 0x4a3a2a, gull ? 2.2 : 0.8);
    this.g.scene.add(m.root);
    const cx = gull ? Math.max(P.x, 960) + Math.random() * 120 : P.x + (Math.random() - 0.5) * 140;
    const cz = P.z + (Math.random() - 0.5) * 140;
    this.birds.push({ kind, m, c: { x: cx, z: cz }, R: 15 + Math.random() * 35, a: Math.random() * 6.28, w: (Math.random() < 0.5 ? 1 : -1) * (gull ? 0.25 : 0.5) * (0.7 + Math.random() * 0.6),
      h: (gull ? 8 : 18) + Math.random() * (gull ? 18 : 30), phase: Math.random() * 6, life: 60 + Math.random() * 60, callT: Math.random() * 8 });
  }
  spawnPigeons(P) {
    for (let tries = 0; tries < 5; tries++) {
      const a = Math.random() * 6.28, r = 20 + Math.random() * 30;
      const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      if (surfaceAt(x, z) !== 'walk') continue;
      for (let k = 0; k < 4; k++) {
        const m = buildBird(0x7d8590, 0.9);
        this.g.scene.add(m.root);
        const px = x + (Math.random() - 0.5) * 2.5, pz = z + (Math.random() - 0.5) * 2.5;
        this.birds.push({ kind: 'pigeon', m, pos: new THREE.Vector3(px, groundAt(px, pz), pz), heading: Math.random() * 6.28, phase: Math.random() * 6, fly: 0, vel: new THREE.Vector3(), peck: Math.random() * 3 });
      }
      return;
    }
  }
  updateBird(b, dt, P, plr) {
    const g = this.g;
    b.phase += dt;
    if (b.kind === 'pigeon') {
      const px = plr.vehicle ? plr.vehicle.pos.x : plr.pos.x, pz = plr.vehicle ? plr.vehicle.pos.z : plr.pos.z;
      const d = Math.hypot(b.pos.x - px, b.pos.z - pz);
      if (d > 120) return false;
      // assusta e voa quando alguém chega perto
      if (!b.fly && (d < 4 || (plr.vehicle && d < 10 && plr.vehicle.speed > 3))) {
        b.fly = 1; const a = Math.atan2(b.pos.x - px, b.pos.z - pz) + (Math.random() - 0.5);
        b.vel.set(Math.sin(a) * 6, 4 + Math.random() * 2, Math.cos(a) * 6); b.heading = a;
        if (Math.random() < 0.5) g.audio.burst(0.25, 2500, 0.06 * Math.max(0, 1 - d / 20), 'bandpass');
      }
      if (b.fly) {
        b.fly += dt;
        b.pos.addScaledVector(b.vel, dt);
        b.vel.y = Math.max(1.5, b.vel.y - dt);
        const f = Math.sin(b.phase * 28);
        b.m.wl.rotation.z = f * 0.9; b.m.wr.rotation.z = -f * 0.9;
        if (b.fly > 8) return false;
      } else {
        b.peck -= dt;
        if (b.peck <= 0) { b.peck = 0.6 + Math.random() * 2.5; b.heading += (Math.random() - 0.5) * 1.5; }
        const pecking = b.peck < 0.25;
        b.m.root.rotation.x = pecking ? 0.6 : 0;
        if (!pecking && Math.random() < dt * 0.6) { b.pos.x += Math.sin(b.heading) * 0.15; b.pos.z += Math.cos(b.heading) * 0.15; }
        b.m.wl.rotation.z = -0.2; b.m.wr.rotation.z = 0.2;
        b.pos.y = groundAt(b.pos.x, b.pos.z) + 0.06;
      }
      b.m.root.position.copy(b.pos); b.m.root.rotation.y = b.heading;
      return true;
    }
    // em voo: circula devagar e às vezes plana (gaivota quase só plana)
    b.life -= dt;
    b.a += b.w * dt;
    const x = b.c.x + Math.cos(b.a) * b.R, z = b.c.z + Math.sin(b.a) * b.R;
    const ground = Math.max(heightAt(x, z), 0);
    const y = ground + b.h + Math.sin(b.phase * 0.4) * 2;
    b.m.root.position.set(x, y, z);
    b.m.root.rotation.set(0, Math.atan2(-Math.sin(b.a) * b.w, Math.cos(b.a) * b.w), -Math.sign(b.w) * 0.25, 'YXZ');
    const glide = b.kind === 'gull' ? Math.sin(b.phase * 0.5) > -0.6 : Math.sin(b.phase * 0.7) > 0.3;
    const f = glide ? 0.12 : Math.sin(b.phase * (b.kind === 'gull' ? 9 : 22));
    b.m.wl.rotation.z = f * 0.7; b.m.wr.rotation.z = -f * 0.7;
    b.callT -= dt;
    if (b.callT <= 0) {
      b.callT = 6 + Math.random() * 10;
      const d = Math.hypot(x - g.camera.position.x, z - g.camera.position.z);
      if (b.kind === 'gull') g.audio.gull(d); else g.audio.chirp(d);
    }
    return b.life > 0 && Math.hypot(x - P.x, z - P.z) < 260;
  }
}
