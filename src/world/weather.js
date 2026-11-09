// Weather state machine: clear, cloudy, rain, fog, storm (with lightning).
import * as THREE from 'three';
import { G } from '../core/context.js';
import { damp, clamp } from '../core/utils.js';
import { WorldUniforms } from '../render/voxel.js';

const STATES = {
  clear:  { cloud: 0.35, rain: 0, fog: 1, dim: 1, wind: 0.8 },
  cloudy: { cloud: 0.8, rain: 0, fog: 0.85, dim: 0.82, wind: 1.2 },
  rain:   { cloud: 0.95, rain: 1, fog: 0.6, dim: 0.62, wind: 1.6 },
  fog:    { cloud: 0.7, rain: 0, fog: 0.3, dim: 0.8, wind: 0.4 },
  storm:  { cloud: 1, rain: 1.6, fog: 0.5, dim: 0.42, wind: 2.6 },
};
const NEXT = {
  clear: [['clear', 4], ['cloudy', 3], ['fog', 1]],
  cloudy: [['clear', 3], ['rain', 3], ['cloudy', 1], ['storm', 1]],
  rain: [['cloudy', 3], ['rain', 1], ['storm', 1.2], ['clear', 1]],
  fog: [['clear', 3], ['cloudy', 2]],
  storm: [['rain', 3], ['cloudy', 1]],
};

export class Weather {
  constructor(scene, mobile) {
    this.state = G.state.world.weather || 'clear';
    this.cur = { ...STATES[this.state] };
    this.timer = 60 + Math.random() * 90;
    this.flash = 0;
    this.nextBolt = 8;
    this.wind = 1;
    // rain streaks
    const n = mobile ? 1200 : 2600;
    this.n = n;
    this.area = 36;
    this.drops = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * this.area * 2;
      this.drops[i * 3 + 1] = Math.random() * 30;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * this.area * 2;
    }
    this.linePos = new Float32Array(n * 6);
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.linePos, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    this.mat = new THREE.LineBasicMaterial({ color: 0xaac4e0, transparent: true, opacity: 0.0, fog: true });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.boltLight = new THREE.DirectionalLight(0xc8d8ff, 0);
    scene.add(this.boltLight); scene.add(this.boltLight.target);
  }

  set(state) {
    if (!STATES[state]) return;
    this.state = state;
    G.state.world.weather = state;
    G.bus.emit('weather', state);
  }

  // bolt of lightning drawn as a jagged line from the clouds to the ground
  spawnBolt(camPos) {
    const a = Math.random() * 6.28, r = 40 + Math.random() * 80;
    const x = camPos.x + Math.cos(a) * r, z = camPos.z + Math.sin(a) * r;
    const gy = G.physics.terrainHeight(x, z);
    const pts = [];
    let px = x, pz = z;
    for (let y = gy + 110; y > gy; y -= 9) { pts.push(new THREE.Vector3(px, y, pz)); px += (Math.random() - 0.5) * 6; pz += (Math.random() - 0.5) * 6; }
    pts.push(new THREE.Vector3(px, gy, pz));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 1, fog: false }));
    G.scene.add(line);
    this.bolts = this.bolts || [];
    this.bolts.push({ line, t: 0 });
    return Math.hypot(x - camPos.x, z - camPos.z);
  }

  pick() {
    const opts = NEXT[this.state];
    const tot = opts.reduce((a, o) => a + o[1], 0);
    let r = Math.random() * tot;
    for (const [s, w] of opts) { r -= w; if (r <= 0) return s; }
    return 'clear';
  }

  update(dt, camPos) {
    this.timer -= dt;
    const mode = G.settings.weatherMode || 'dynamic';
    if (mode !== 'dynamic') { if (this.state !== mode) this.set(mode); }
    else if (this.timer <= 0) {
      this.timer = 90 + Math.random() * 150;
      this.set(this.pick());
    }
    const T = STATES[this.state];
    for (const k of Object.keys(T)) this.cur[k] = damp(this.cur[k], T[k], 0.25, dt);
    const c = this.cur;
    // gusts: wind strength breathes over time
    const t = G.time;
    const gust = Math.max(0, Math.sin(t * 0.23) * Math.sin(t * 0.71 + 1.3)) * 0.9 + Math.sin(t * 1.9) * 0.08;
    this.wind = c.wind * (0.75 + gust);
    // wet ground darkens slowly during rain and dries afterwards
    this.wet = damp(this.wet || 0, c.rain > 0.3 ? 1 : 0, c.rain > 0.3 ? 0.08 : 0.03, dt);
    WorldUniforms.uWet.value = G.sky.underground ? 0 : this.wet;
    const sky = G.sky;
    sky.cloudCover = c.cloud;
    sky.dim = c.dim;
    const under = sky.underground;
    const rain = under ? 0 : c.rain;
    this.rain = rain;

    // fog
    const fog = G.scene.fog;
    const vd = G.world.viewDist;
    if (under) { fog.near = 6; fog.far = 60; }
    else { fog.near = vd * 0.25 * c.fog; fog.far = vd * (0.45 + 0.55 * c.fog); }
    fog.color.copy(sky.fogColor);
    if (this.flash > 0) fog.color.lerp(new THREE.Color(0xc8d0e0), this.flash * 0.5);

    // rain
    // above the snow line precipitation falls as snow
    const snow = camPos.y > 26;
    this.mat.color.setHex(snow ? 0xffffff : 0xaac4e0);
    this.mat.opacity = clamp(rain, 0, 1) * (snow ? 0.9 : 0.55);
    this.lines.visible = rain > 0.02;
    if (this.lines.visible) {
      const fall = snow ? 4 : 26, slant = (2 + this.wind * 2) * (snow ? 0.6 : 1);
      const len = snow ? 0.12 : 0.7;
      for (let i = 0; i < this.n; i++) {
        const k = i * 3;
        this.drops[k + 1] -= fall * dt;
        this.drops[k] += slant * dt * 0.3;
        if (this.drops[k + 1] < -2) {
          this.drops[k + 1] = 26 + Math.random() * 6;
          this.drops[k] = (Math.random() - 0.5) * this.area * 2;
          this.drops[k + 2] = (Math.random() - 0.5) * this.area * 2;
        }
        const x = camPos.x + this.drops[k], y = camPos.y - 6 + this.drops[k + 1], z = camPos.z + this.drops[k + 2];
        const o = i * 6;
        this.linePos[o] = x; this.linePos[o + 1] = y; this.linePos[o + 2] = z;
        this.linePos[o + 3] = x - slant * 0.03; this.linePos[o + 4] = y + len; this.linePos[o + 5] = z;
      }
      this.attr.needsUpdate = true;
      // ground splashes near player
      const p = G.player.pos;
      for (let s = 0; s < rain * 3; s++) {
        const sx = p.x + (Math.random() - 0.5) * 20, sz = p.z + (Math.random() - 0.5) * 20;
        const sy = Math.max(G.physics.terrainHeight(sx, sz), G.physics.waterLevel(sx, sz) - 0.1);
        G.particles.solid.spawn(sx, sy + 0.05, sz, 0, 1.2, 0, 0xc8d8ec, 0.12, 0.25, { gravity: 8, alpha: 0.7 });
      }
    }

    // lightning
    if (this.state === 'storm' && !under) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 5 + Math.random() * 10;
        this.flash = 1;
        const delay = 0.3 + Math.random() * 1.5;
        setTimeout(() => G.audio.sfx('thunder', { vol: 1.2 - delay * 0.3 }), delay * 1000);
        G.ui?.screenFlash(0.35);
        this.spawnBolt(camPos);
        G.bus.emit('stormBolt');
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.bolts) for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t += dt;
      b.line.material.opacity = b.t < 0.08 || (b.t > 0.14 && b.t < 0.2) ? 1 : Math.max(0, 1 - b.t * 3);
      if (b.t > 0.4) { G.scene.remove(b.line); b.line.geometry.dispose(); this.bolts.splice(i, 1); }
    }
    this.boltLight.intensity = this.flash * 3;
    this.boltLight.position.set(camPos.x + 30, camPos.y + 100, camPos.z + 10);
    this.boltLight.target.position.copy(camPos);
  }
}
