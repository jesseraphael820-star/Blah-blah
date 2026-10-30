import * as THREE from 'three';
import { HALF } from './world.js';

function buildPlane(color) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.3, roughness: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ color });
  const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); g.add(me); return me; };
  add(new THREE.CylinderGeometry(1.8, 1.6, 34, 12).rotateX(Math.PI / 2), body, 0, 0, 0);
  add(new THREE.SphereGeometry(1.8, 12, 8).scale(1, 1, 2), body, 0, 0, 17);
  add(new THREE.CylinderGeometry(1.6, 0.4, 7, 10).rotateX(-Math.PI / 2), body, 0, 0.4, -20);
  add(new THREE.BoxGeometry(36, 0.4, 5), body, 0, -0.6, 1);
  add(new THREE.BoxGeometry(12, 0.3, 3), body, 0, 0.6, -21);
  add(new THREE.BoxGeometry(0.4, 6, 4), stripe, 0, 3.4, -21);
  add(new THREE.BoxGeometry(3.7, 0.5, 30), stripe, 0, -0.2, 0);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(1, 1, 4, 10).rotateX(Math.PI / 2), body, s * 8, -1.6, 2.5);
  const mk = (c) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 0 });
  const red = mk(0xff2020), green = mk(0x20ff40), white = mk(0xffffff);
  add(new THREE.SphereGeometry(0.35, 6, 4), red, -18, -0.5, 1);
  add(new THREE.SphereGeometry(0.35, 6, 4), green, 18, -0.5, 1);
  add(new THREE.SphereGeometry(0.4, 6, 4), white, 0, 6.5, -21);
  g.scale.setScalar(0.9);
  return { g, red, green, white };
}

// aviões cruzando o céu, com luzes de navegação piscando
export class Air {
  constructor(game) {
    this.g = game;
    this.planes = [];
    const cols = [0xd7263d, 0x1d4e89, 0xf0b429];
    for (let i = 0; i < 3; i++) {
      const p = buildPlane(cols[i]);
      game.scene.add(p.g);
      this.planes.push(p);
      this.reset(p, true);
    }
  }
  reset(p, any) {
    const a = Math.random() * Math.PI * 2;
    const R = HALF * 1.6;
    p.pos = new THREE.Vector3(Math.cos(a) * R, 260 + Math.random() * 250, Math.sin(a) * R);
    const b = a + Math.PI + (Math.random() - 0.5) * 0.8;
    const target = new THREE.Vector3(Math.cos(b) * R, p.pos.y, Math.sin(b) * R);
    p.dir = target.sub(p.pos).normalize();
    p.speed = 70 + Math.random() * 30;
    if (any) p.pos.addScaledVector(p.dir, Math.random() * R * 1.5);
    p.g.rotation.set(0, Math.atan2(p.dir.x, p.dir.z), 0);
  }
  update(dt) {
    const t = this.g.simTime;
    let near = 0;
    for (const p of this.planes) {
      p.pos.addScaledVector(p.dir, p.speed * dt);
      p.g.position.copy(p.pos);
      if (Math.abs(p.pos.x) > HALF * 1.8 || Math.abs(p.pos.z) > HALF * 1.8) this.reset(p, false);
      const blink = (t * 1.3) % 1 < 0.12;
      p.red.emissiveIntensity = p.green.emissiveIntensity = 4;
      p.white.emissiveIntensity = blink ? 12 : 0;
      near = Math.max(near, 1 - p.pos.distanceTo(this.g.camera.position) / 700);
    }
    this.g.audio.setPlane && this.g.audio.setPlane(Math.max(0, near));
  }
}
