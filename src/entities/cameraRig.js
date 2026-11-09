// Third-person orbit camera with collision, lock-on framing, dialogue and menu framing, shake.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { clamp, damp, dampAngle, angleDiff } from '../core/utils.js';

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.dist = 7.5;
    this.distNow = 7.5;
    this.target = new THREE.Vector3();
    this.shakeAmt = 0;
    this.mode = 'follow';
    this.focus = null;   // {pos, yaw} for dialogue
    this.tmp = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.override = null;
  }
  shake(a) { if (G.settings.shake) this.shakeAmt = Math.min(1, this.shakeAmt + a); }
  snap() { this.snapNext = true; }

  update(dt) {
    const I = G.input;
    const p = G.player;
    const sens = 0.0026 * (G.settings.sensitivity || 1);
    if (this.mode === 'follow' && !G.ui.blocksCamera()) {
      this.yaw -= I.look.dx * sens;
      this.pitch += I.look.dy * sens * (G.settings.invertY ? -1 : 1);
      this.dist = clamp(this.dist * Math.pow(1.12, I.wheel), 2.2, 18);
    }
    this.pitch = clamp(this.pitch, -0.35, 1.25);
    // lock-on: rotate camera behind player toward target
    if (p.lockTarget && this.mode === 'follow') {
      const ty = Math.atan2(p.lockTarget.pos.x - p.pos.x, p.lockTarget.pos.z - p.pos.z);
      this.yaw = dampAngle(this.yaw, ty, 5, dt);
    }
    const head = this.tmp.set(p.pos.x, p.model.root.position.y + 1.55, p.pos.z);
    if (this.mode === 'follow') {
      if (this.snapNext) this.target.copy(head);
      else this.target.x = damp(this.target.x, head.x, 14, dt), this.target.y = damp(this.target.y, head.y, 10, dt), this.target.z = damp(this.target.z, head.z, 14, dt);
      const cp = Math.cos(this.pitch);
      this.distSmooth = damp(this.distSmooth ?? this.dist, this.dist, 10, dt);
      const d = this.distSmooth;
      this.desired.set(this.target.x - Math.sin(this.yaw) * cp * d, this.target.y + Math.sin(this.pitch) * d, this.target.z - Math.cos(this.yaw) * cp * d);
      const f = G.physics.rayFraction(this.target.x, this.target.y, this.target.z, this.desired.x, this.desired.y, this.desired.z);
      const want = Math.max(1.2, d * f - 0.2);
      this.distNow = want < this.distNow ? want : damp(this.distNow, want, 4, dt);
      if (this.snapNext) this.distNow = want;
      this.cam.position.set(this.target.x - Math.sin(this.yaw) * cp * this.distNow, this.target.y + Math.sin(this.pitch) * this.distNow, this.target.z - Math.cos(this.yaw) * cp * this.distNow);
      // never below terrain
      const gy = G.physics.terrainHeight(this.cam.position.x, this.cam.position.z) + 0.4;
      if (this.cam.position.y < gy) this.cam.position.y = gy;
      this.lookAt.copy(this.target);
      if (p.lockTarget) this.lookAt.lerp(this.tmp.copy(p.lockTarget.pos).setY(p.lockTarget.pos.y + 1), 0.25);
      this.cam.lookAt(this.lookAt);
    } else if (this.mode === 'dialogue' && this.focus) {
      // over-the-shoulder framing of the speaker
      const a = this.focus.pos, b = p.pos;
      const mid = this.tmp.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.4, (a.z + b.z) / 2);
      const dir = Math.atan2(a.x - b.x, a.z - b.z);
      const side = dir + 0.55;
      const d = 4.2 + a.distanceTo(b) * 0.4;
      this.desired.set(b.x - Math.sin(side) * d * 0.7, b.y + 2.3, b.z - Math.cos(side) * d * 0.7);
      this.cam.position.lerp(this.desired, 1 - Math.exp(-4 * dt));
      this.lookAt.lerp(mid, 1 - Math.exp(-5 * dt));
      this.cam.lookAt(this.lookAt);
      this.target.copy(head);
      this.yaw = dampAngle(this.yaw, dir, 2, dt);
    } else if (this.mode === 'menu') {
      // front view of player, shifted so the menu panel doesn't cover them
      const fy = p.yaw;
      const d = G.mobile ? 5.2 : 4.6;
      const side = G.mobile ? 0 : 1.5; // push the hero to the right of the menu panel
      const rx = Math.cos(fy), rz = -Math.sin(fy);
      const py = p.model.root.position.y;
      this.desired.set(p.pos.x + Math.sin(fy) * d - rx * side, py + 1.5, p.pos.z + Math.cos(fy) * d - rz * side);
      this.cam.position.lerp(this.desired, 1 - Math.exp(-6 * dt));
      this.lookAt.lerp(this.tmp.set(p.pos.x - rx * side, py + (G.mobile ? 1.6 : 1.0), p.pos.z - rz * side), 1 - Math.exp(-6 * dt));
      this.cam.lookAt(this.lookAt);
    }
    this.snapNext = false;
    // shake
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * this.shakeAmt * 0.35;
      this.cam.position.x += (Math.random() - 0.5) * s;
      this.cam.position.y += (Math.random() - 0.5) * s;
      this.cam.position.z += (Math.random() - 0.5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
  }
}
