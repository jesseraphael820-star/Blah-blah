// The protagonist: on-foot movement, combat, carjacking and driving.
import * as THREE from 'three';
import { Human } from './human.js';
import { NPC } from './npc.js';
import { clamp, damp, dampAngle, angleDiff } from './util.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.human = new Human({ skin: 0x6e4428, shirt: 0xf4f4f2, pants: 0x2b3a5c, hair: 0x0e0e0e, shoes: 0xe8e8e8, bulk: 1.04, scale: 1.0, eyes: 0x2a1a0a });
    game.scene.add(this.human.root);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.vy = 0;
    this.heading = 0; this.grounded = true;
    this.health = 100; this.armor = 0; this.money = 0;
    this.hasPistol = false; this.ammo = 0; this.weapon = 'fist';
    this.vehicle = null; this.entering = null;
    this.punchCd = 0; this.shootCd = 0; this.hurtT = 0; this.stepT = 0;
    this.name = 'Léo';
    this.voice = { pitch: 1.0, rate: 1.05, gender: 'm' };
  }
  get alive() { return this.health > 0; }

  damage(d, from) {
    if (!this.alive) return;
    if (this.armor > 0) { const a = Math.min(this.armor, d * 0.7); this.armor -= a; d -= a; }
    this.health = Math.max(0, this.health - d);
    this.hurtT = 0.35;
    this.game.hud.flashDamage();
    if (this.health <= 0) this.game.onPlayerDead();
  }

  nearestCar(maxD = 4) {
    let best = null, bd = maxD;
    for (const c of this.game.cars) {
      if (c.dead || c.removed) continue;
      const d = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) - 1.2;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  tryEnter() {
    const car = this.nearestCar();
    if (!car) return false;
    this.entering = { car, t: 0, from: this.pos.clone(), door: car.doorPos() };
    return true;
  }

  finishEnter(car) {
    const g = this.game;
    if (car.driver && car.driverKind !== 'player') {
      // pull the driver out!
      const look = car.driver.look;
      car.group.remove(car.driver.root);
      const ped = new NPC(g, car.driverKind === 'police' ? 'cop' : 'ped', look, car.doorPos());
      ped.heading = car.heading + Math.PI / 2;
      ped.knock.set(Math.cos(car.heading) * 3, 0, -Math.sin(car.heading) * 3);
      ped.downT = 1.2;
      g.npcs.push(ped);
      if (ped.kind === 'ped') { if (Math.random() < 0.2) { ped.state = 'fight'; ped.threat = this; } else ped.scare(this, 10); }
      g.onCarjack(car);
      car.driver = null;
    }
    if (car.typeKey === 'police' && car.driverKind === 'police') g.onCarjack(car, true);
    car.ai = null; car.driverKind = 'player'; car.driver = this.human; car.siren = false;
    g.scene.remove(this.human.root);
    car.group.add(this.human.root);
    this.human.root.position.copy(car.seat); this.human.root.rotation.set(0, 0, 0);
    this.vehicle = car; this.entering = null;
    this.human.showGun(false);
    g.hud.carName(car.type.name);
    g.radioStation = true;
  }

  exitVehicle(force = false) {
    const car = this.vehicle; if (!car) return;
    if (!force && Math.abs(car.speed) > 9) return;
    const g = this.game;
    car.group.remove(this.human.root);
    g.scene.add(this.human.root);
    const d = car.doorPos();
    const p = { x: d.x, z: d.z, y: 0.2 };
    g.world.collideCircle(p, 0.4);
    this.pos.set(p.x, g.world.groundHeight(p.x, p.z), p.z);
    this.heading = car.heading;
    car.driver = null; car.driverKind = 'none'; car.input.throttle = 0; car.input.steer = 0; car.input.handbrake = true;
    this.vehicle = null; this.vel.set(0, 0, 0);
    this.human.root.rotation.set(0, 0, 0);
  }

  update(dt, input, cam) {
    const g = this.game;
    this.punchCd -= dt; this.shootCd -= dt; this.hurtT -= dt;
    if (!this.alive) {
      this.human.update(dt, { dead: true });
      this.human.root.position.copy(this.pos); this.human.root.rotation.y = this.heading;
      return;
    }
    if (this.vehicle) return this.updateDriving(dt, input);
    if (this.entering) {
      const e = this.entering; e.t += dt;
      const door = e.car.doorPos();
      const k = Math.min(1, e.t / 0.45);
      this.pos.lerpVectors(e.from, door, k); this.pos.y = g.world.groundHeight(this.pos.x, this.pos.z);
      this.heading = dampAngle(this.heading, e.car.heading, 10, dt);
      this.human.update(dt, { speed: 3, grounded: true });
      this.human.root.position.copy(this.pos); this.human.root.rotation.y = this.heading;
      if (e.car.dead) { this.entering = null; return; }
      if (k >= 1) this.finishEnter(e.car);
      return;
    }
    // weapon switching
    if (input.pressed('KeyQ') && this.hasPistol) { this.weapon = this.weapon === 'pistol' ? 'fist' : 'pistol'; this.human.showGun(this.weapon === 'pistol'); }
    const armed = this.weapon === 'pistol';
    const aiming = armed && (input.mouse.right || input.mouse.left);
    // movement
    const f = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    let mx = 0, mz = 0;
    if (input.down('KeyW')) { mx += f.x; mz += f.z; }
    if (input.down('KeyS')) { mx -= f.x; mz -= f.z; }
    if (input.down('KeyD')) { mx += r.x; mz += r.z; }
    if (input.down('KeyA')) { mx -= r.x; mz -= r.z; }
    const ml = Math.hypot(mx, mz);
    let target = 0;
    if (ml > 0) {
      mx /= ml; mz /= ml;
      target = input.down('ShiftLeft') || input.down('ShiftRight') ? 7.6 : input.down('AltLeft') || input.down('KeyC') ? 1.7 : 4.3;
      if (aiming) target = Math.min(target, 3);
    }
    const accel = this.grounded ? 12 : 2;
    this.vel.x = damp(this.vel.x, mx * target, accel, dt);
    this.vel.z = damp(this.vel.z, mz * target, accel, dt);
    if (aiming) this.heading = dampAngle(this.heading, cam.yaw, 18, dt);
    else if (ml > 0) this.heading = dampAngle(this.heading, Math.atan2(mx, mz), 10, dt);
    // jump & gravity
    if (input.pressed('Space') && this.grounded) { this.vy = 5.2; this.grounded = false; }
    this.vy -= 15 * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vy * dt;
    const gh = g.world.groundHeight(this.pos.x, this.pos.z);
    if (this.pos.y <= gh) {
      if (!this.grounded && this.vy < -9) this.damage((-this.vy - 9) * 6);
      this.pos.y = gh; this.vy = 0; this.grounded = true;
    } else if (this.grounded && this.vy <= 0 && this.pos.y - gh < 0.3) { this.pos.y = gh; this.vy = 0; }
    else this.grounded = false;
    g.world.collideCircle(this.pos, 0.38);
    // push out of cars
    for (const c of g.cars) {
      if (Math.abs(c.pos.x - this.pos.x) > 6 || Math.abs(c.pos.z - this.pos.z) > 6) continue;
      for (const [cx, cz, cr] of c.circles()) {
        const dx = this.pos.x - cx, dz = this.pos.z - cz, d = Math.hypot(dx, dz), m = cr + 0.38;
        if (d < m && d > 1e-4) { this.pos.x += (dx / d) * (m - d); this.pos.z += (dz / d) * (m - d); }
      }
    }
    // actions
    if (input.pressed('KeyF')) this.tryEnter();
    if (input.mouse.leftPressed || (armed && input.mouse.left)) {
      if (armed) this.shoot(cam);
      else if (this.punchCd <= 0) this.punch();
    }
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.stepT -= dt * speed;
    if (this.grounded && speed > 1 && this.stepT <= 0) { this.stepT = 1.6; g.audio.step(); }
    this.human.update(dt, { speed: this.grounded ? speed : 0, grounded: this.grounded, aim: aiming, lookYaw: aiming ? 0 : clamp(angleDiff(this.heading, cam.yaw), -1, 1) * 0.6 });
    this.human.root.position.copy(this.pos);
    this.human.root.rotation.y = this.heading;
    this.aiming = aiming;
  }

  punch() {
    const g = this.game;
    this.punchCd = 0.42; this.human.punch(); g.audio.whoosh();
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    setTimeout(() => {
      for (const n of g.npcs) {
        if (!n.alive || n.removed) continue;
        const dx = n.pos.x - this.pos.x, dz = n.pos.z - this.pos.z, d = Math.hypot(dx, dz);
        if (d < 1.6 && (dx * fx + dz * fz) / (d || 1) > 0.45) {
          n.hurt(14 + Math.random() * 8, this, 'hit');
          n.knock.set(fx * 4, 0, fz * 4);
          g.audio.punch();
          if (n.alive && Math.random() < 0.3) n.downT = 1.2;
          break;
        }
      }
    }, 140);
  }

  shoot(cam) {
    const g = this.game;
    if (this.shootCd > 0) return;
    if (this.ammo <= 0) { this.weapon = 'fist'; this.human.showGun(false); g.hud.help('Sem munição!', 2); return; }
    this.shootCd = 0.24; this.ammo--;
    const origin = g.camera.position.clone();
    const dir = new THREE.Vector3(); g.camera.getWorldDirection(dir);
    // spread
    dir.x += (Math.random() - 0.5) * 0.012; dir.y += (Math.random() - 0.5) * 0.012; dir.normalize();
    const hand = new THREE.Vector3(); this.human.gun.getWorldPosition(hand);
    hand.addScaledVector(new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)), 0.2);
    const hit = g.raycast(origin, dir, 90, this);
    g.fx.muzzle(hand); g.audio.gun(); g.tracer(hand, hit.point);
    if (hit.npc) { hit.npc.hurt(hit.head ? 100 : 34, this, 'shot'); hit.npc.knock.addScaledVector(dir, 2); }
    else if (hit.car) { hit.car.damage(7, g); g.fx.sparks(hit.point, 6); }
    else if (hit.hitWorld) g.fx.dust(hit.point);
    g.onGunfire(this.pos);
  }

  updateDriving(dt, input) {
    const car = this.vehicle;
    const inp = car.input;
    inp.throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    inp.steer = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
    inp.handbrake = input.down('Space');
    if (input.pressed('KeyH')) this.game.audio.horn(car.pos, this.game);
    if (input.pressed('KeyR')) { this.game.radioStation = !this.game.radioStation; this.game.hud.help(this.game.radioStation ? 'Rádio: <b>Porto Sol FM</b>' : 'Rádio desligado', 1.5); }
    if (input.pressed('KeyE') && car.sirenR) car.siren = !car.siren;
    this.human.update(dt, { sit: true, lookYaw: -inp.steer * 0.4 });
    this.pos.copy(car.pos);
    if (input.pressed('KeyF')) this.exitVehicle();
    if (car.dead) { this.exitVehicle(true); }
  }
}
