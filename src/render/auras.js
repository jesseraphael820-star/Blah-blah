// Lineage auras: the strongest genetics manifest in the world.
// Tier 3 (Ancestral, Angel, Dragon): a giant spirit copy of the person floats above
// them, a pillar of light visible from far away, rotating rune circles, orbiting
// shards, rising motes, shockwaves and a cinematic reveal the first time you meet.
// Tier 1 (other rare genetics): a subtle rune circle and motes.
import * as THREE from 'three';
import { G } from '../core/context.js';
import { Humanoid } from '../entities/character.js';
import { t } from '../core/i18n.js';

export const AURA = {
  ancestral: { tier: 3, color: 0xffc83a, color2: 0xfff2b0, giant: 4.6, pillar: 90, motes: 'gold', shards: 0x8a7a5a },
  angel:     { tier: 3, color: 0xfff0b0, color2: 0xffffff, giant: 3.8, pillar: 80, motes: 'feather', shards: null },
  dragon:    { tier: 3, color: 0xff4a2a, color2: 0xffc83a, giant: 4.0, pillar: 70, motes: 'ember', shards: 0x3a1010 },
  shadow:    { tier: 1, color: 0xb66cff, color2: 0x2a1a3a },
  elemental: { tier: 1, color: 0xff7a2a, color2: 0xffd15c },
  tech:      { tier: 1, color: 0x4fd0ff, color2: 0xb0f0ff },
  magic:     { tier: 1, color: 0xd08aff, color2: 0xffe0ff },
  ghost:     { tier: 1, color: 0x9ad8ff, color2: 0xffffff },
};

const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
let runeTex = null;
function runeTexture() {
  if (runeTex) return runeTex;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.translate(S / 2, S / 2);
  c.strokeStyle = '#fff'; c.fillStyle = '#fff';
  const ring = (r, w) => { c.lineWidth = w; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); };
  ring(122, 4); ring(110, 2); ring(70, 3); ring(40, 1.5);
  // runes between the outer rings (blocky pixel glyphs)
  for (let i = 0; i < 24; i++) {
    c.save(); c.rotate((i / 24) * Math.PI * 2); c.translate(0, -116);
    const g = (i * 7919) % 16;
    for (let b = 0; b < 4; b++) if (g & (1 << b)) c.fillRect(-4 + (b % 2) * 4, -4 + (b >> 1) * 4, 3, 3);
    c.restore();
  }
  // hexagram + spokes
  c.lineWidth = 2;
  for (const off of [0, Math.PI / 3]) { c.beginPath(); for (let k = 0; k <= 3; k++) { const a = off + (k / 3) * Math.PI * 2; c.lineTo(Math.sin(a) * 104, -Math.cos(a) * 104); } c.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(Math.sin(a) * 40, -Math.cos(a) * 40); c.lineTo(Math.sin(a) * 70, -Math.cos(a) * 70); c.stroke(); }
  runeTex = new THREE.CanvasTexture(cv);
  runeTex.colorSpace = THREE.SRGBColorSpace;
  return runeTex;
}

function pillarMaterial(color) {
  return new THREE.ShaderMaterial({
    ...add, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
      void main(){
        float fade = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.04, vUv.y);
        float bands = 0.65 + 0.35 * sin(vUv.y * 60.0 - uTime * 4.0) * sin(vUv.x * 18.85 + uTime * 0.7);
        float edge = 0.55 + 0.45 * sin(vUv.x * 6.283 * 3.0 + uTime * 1.3);
        gl_FragColor = vec4(uColor * (0.8 + 0.6 * bands), fade * bands * edge * 0.42 * uAlpha);
      }`,
  });
}

export class GeneAura {
  // owner: { pos: Vector3, model: Humanoid (or getter), look, name, gene }
  constructor(owner, gene) {
    this.o = owner; this.gene = gene;
    const A = this.A = AURA[gene];
    this.T = Math.random() * 10;
    this.g = new THREE.Group();
    G.scene.add(this.g);
    // ground rune circle (two layers turning opposite ways)
    const tex = runeTexture();
    const R = A.tier === 3 ? 4.2 : 1.6;
    this.circle = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), new THREE.MeshBasicMaterial({ map: tex, color: A.color, opacity: 0.8, ...add }));
    this.circle.rotation.x = -Math.PI / 2;
    this.circle2 = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.3, R * 1.3), new THREE.MeshBasicMaterial({ map: tex, color: A.color2, opacity: 0.55, ...add }));
    this.circle2.rotation.x = -Math.PI / 2;
    this.g.add(this.circle, this.circle2);
    if (A.tier < 3) return;
    // pillar of light (two nested beams)
    this.pillarMat = pillarMaterial(A.color);
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.6, A.pillar, 24, 1, true), this.pillarMat);
    this.pillar.position.y = A.pillar / 2;
    this.core = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, A.pillar * 0.9, 12, 1, true), pillarMaterial(A.color2));
    this.core.position.y = A.pillar * 0.45;
    this.pillar.frustumCulled = this.core.frustumCulled = false;
    this.g.add(this.pillar, this.core);
    // rotating halo rings in the air
    this.rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.9, 0.05 + (2 - i) * 0.02, 6, 48), new THREE.MeshBasicMaterial({ color: i === 1 ? A.color2 : A.color, opacity: 0.55, ...add }));
      r.userData = { tilt: 0.35 + i * 0.4, spd: (i % 2 ? -1 : 1) * (0.5 + i * 0.25), y: 2.2 + i * 1.6 };
      this.rings.push(r); this.g.add(r);
    }
    // orbiting shards (ancestral stone monoliths, dragon scales)
    this.shards = [];
    if (A.shards) for (let i = 0; i < 8; i++) {
      const sh = new THREE.Group();
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8 + (i % 3) * 0.3, 0.2), new THREE.MeshLambertMaterial({ color: A.shards }));
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.03), new THREE.MeshBasicMaterial({ color: A.color }));
      rune.position.z = 0.115;
      sh.add(st, rune);
      sh.userData = { a: (i / 8) * Math.PI * 2, r: 3.2 + (i % 2) * 0.8, y: 1 + (i % 4) * 0.9, ph: i * 1.7 };
      this.shards.push(sh); this.g.add(sh);
    }
    // the giant spirit: a translucent, glowing, giant copy of the person
    this.buildGiant();
    this.waveT = 2;
  }

  buildGiant() {
    const A = this.A;
    const look = { ...this.o.look, sword: null, scale: 1 };
    const h = this.giant = new Humanoid(look);
    const ghost = { transparent: true, depthWrite: false };
    const body = new THREE.MeshBasicMaterial({ color: A.color, opacity: 0.3, ...ghost });
    const rim = new THREE.MeshBasicMaterial({ color: A.color2, opacity: 0.4, ...ghost });
    const face = new THREE.MeshBasicMaterial({ map: h.faceTex, color: A.color2, opacity: 0.75, ...add });
    h.root.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = false;
      if (Array.isArray(m.material)) m.material = m.material.map((x) => (x.map ? face : rim));
      else m.material = m.material.color && m.material.color.getHex() === A.color2 ? rim : body;
      m.renderOrder = 5;
    });
    h.root.scale.setScalar(A.giant);
    this.g.add(h.root);
    // glowing eyes for the giant
    for (const s of [-0.12, 0.12]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff, ...add, opacity: 0.95 }));
      e.position.set(s, 0.02, 0.32);
      h.head.add(e);
    }
  }

  dispose() { G.scene.remove(this.g); }

  update(dt) {
    const o = this.o, P = G.player, A = this.A;
    this.T += dt;
    const p = o.pos;
    const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
    const hidden = G.sky.indoor || G.sky.underground || o.hideAura;
    const far = A.tier === 3 ? 420 : 60;
    this.g.visible = !hidden && d < far;
    if (!this.g.visible) return d;
    this.g.position.set(p.x, p.y + 0.05, p.z);
    const night = G.sky?.night ?? 0.5;
    this.circle.rotation.z += dt * 0.25;
    this.circle2.rotation.z -= dt * 0.45;
    const pulse = 0.75 + Math.sin(this.T * 2.2) * 0.25;
    this.circle.material.opacity = 0.55 * pulse + 0.2;
    if (A.tier < 3) {
      if (d < 50 && Math.random() < dt * 4) G.particles.glow.spawn(p.x + (Math.random() - 0.5) * 2.4, p.y + 0.2, p.z + (Math.random() - 0.5) * 2.4, 0, 0.8 + Math.random(), 0, A.color, 0.2, 1.4);
      return d;
    }
    // close: giant, rings, shards, particles in full detail; far: only the beacon
    const calm = this.o.calm ? this.o.calm() : true;
    this.full = (this.full ?? 0) + ((calm ? 1 : 0) - (this.full ?? 0)) * Math.min(1, dt * 2.5);
    const near = d < 120 && this.full > 0.02;
    this.pillarMat.uniforms.uTime.value = this.T;
    this.core.material.uniforms.uTime.value = this.T * 1.4;
    const beacon = (near ? 0.55 + night * 0.35 : Math.min(1.4, 0.8 + d / 300)) ;
    const fullK = this.o.calm ? this.full : 1;
    this.pillarMat.uniforms.uAlpha.value = beacon * fullK * (0.85 + Math.sin(this.T * 1.3) * 0.15);
    this.core.material.uniforms.uAlpha.value = beacon * fullK * 0.8;
    this.pillar.rotation.y += dt * 0.4;
    for (const r of this.rings) {
      r.visible = near;
      const u = r.userData;
      r.rotation.set(Math.PI / 2 + Math.sin(this.T * 0.6 + u.y) * u.tilt, 0, this.T * u.spd);
      r.position.y = u.y + A.giant * 0.6 + Math.sin(this.T * 0.9 + u.y) * 0.3;
      r.material.opacity = 0.35 + Math.sin(this.T * 3 + u.y) * 0.15;
    }
    for (const sh of this.shards) {
      sh.visible = near;
      const u = sh.userData, a = u.a + this.T * 0.35;
      sh.position.set(Math.sin(a) * u.r, u.y + Math.sin(this.T * 1.4 + u.ph) * 0.35, Math.cos(a) * u.r);
      sh.rotation.set(Math.sin(this.T + u.ph) * 0.3, -a, Math.cos(this.T * 0.7 + u.ph) * 0.2);
    }
    // giant spirit: hovers above, breathes, mirrors the person's movement and turns to the hero
    const gi = this.giant;
    gi.root.visible = near;
    if (near) {
      const m = o.model;
      gi.root.position.set(0, 2.4 + Math.sin(this.T * 0.8) * 0.35, 0);
      const toP = Math.atan2(P.pos.x - p.x, P.pos.z - p.z);
      const yaw = d < 30 ? toP : (m ? m.root.rotation.y : 0);
      gi.root.rotation.y += Math.atan2(Math.sin(yaw - gi.root.rotation.y), Math.cos(yaw - gi.root.rotation.y)) * Math.min(1, dt * 1.5);
      const br = 1 + Math.sin(this.T * 1.6) * 0.02, gk = A.giant * (this.o.calm ? 0.3 + this.full * 0.7 : 1);
      gi.root.scale.set(gk * br, gk * (2 - br), gk * br);
      gi.pose(this.cineT > 0 ? 'victory' : 'float', (this.T * 0.25) % 1, dt, { speed: 0 });
      gi.updateFace(dt);
    }
    this.circle.material.opacity = (0.45 + night * 0.4) * pulse + 0.15;
    // particles
    if (near) {
      const rate = d < 40 ? 22 : 8;
      for (let i = 0; i < 3; i++) if (Math.random() < dt * rate) {
        const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 3.6;
        const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
        if (A.motes === 'gold') G.particles.glow.spawn(x, p.y + 0.2, z, Math.cos(a) * 0.4, 1.4 + Math.random() * 1.8, -Math.sin(a) * 0.4, Math.random() < 0.3 ? A.color2 : A.color, 0.09 + Math.random() * 0.08, 2.2);
        else if (A.motes === 'feather') G.particles.solid.spawn(x, p.y + 6 + Math.random() * 6, z, (Math.random() - 0.5) * 0.6, -0.8, (Math.random() - 0.5) * 0.6, 0xffffff, 0.18, 4, { drag: 0.5, alpha: 0.85 });
        else G.particles.glow.spawn(x, p.y + 0.2, z, (Math.random() - 0.5) * 0.6, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? A.color : A.color2, 0.09 + Math.random() * 0.07, 1.4);
      }
      // spiral climbing the pillar
      if (Math.random() < dt * 14) { const a = this.T * 3; G.particles.glow.spawn(p.x + Math.sin(a) * 1.2, p.y + 0.5, p.z + Math.cos(a) * 1.2, Math.cos(a) * 1.2, 6, -Math.sin(a) * 1.2, A.color2, 0.13, 2.5); }
      // shockwave every few seconds
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveT = 5 + Math.random() * 3;
        G.particles.ring(p.x, p.y + 0.3, p.z, A.color, 3.5, d < 40 ? 40 : 20);
        if (d < 40) G.audio.sfxAt?.('orb', p.x, p.z, { vol: 0.25 });
      }
    }
    return d;
  }
}

// One cinematic reveal per legendary person per session: letterbox, slow motion,
// camera orbit from the ground up to the giant spirit, and a title card.
export class Cinematics {
  constructor() {
    this.seen = new Set();
    this.active = null;
    const d = document.createElement('div');
    d.id = 'cine';
    d.innerHTML = '<div class="cine-bar top"></div><div class="cine-bar bot"></div><div class="cine-card"><small></small><h1></h1><p></p><div class="cine-line"></div></div><button class="cine-skip">⏭</button>';
    document.body.appendChild(d);
    this.el = d;
    d.querySelector('.cine-skip').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.end(); });
  }
  canStart() {
    const P = G.player;
    if (this.active || G.ui.blocksGameplay() || P.dead || P.busy() || G.fishing?.active) return false;
    if (G.entities.enemies.list.some((e) => !e.dead && e.aggro && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 25)) return false;
    return G.settings.cinematics !== false;
  }
  start(key, aura, info) {
    this.seen.add(key);
    const cam = G.cam;
    this.active = { aura, t: 0, dur: 6.2, a0: Math.atan2(G.player.pos.x - aura.o.pos.x, G.player.pos.z - aura.o.pos.z) };
    aura.cineT = 6.2;
    cam.mode = 'cine';
    G.ui.overlay = 'cine';
    G.input.unlock?.();
    const col = '#' + aura.A.color.toString(16).padStart(6, '0');
    this.el.style.setProperty('--cine', col);
    this.el.querySelector('small').textContent = t('cine.presence');
    this.el.querySelector('h1').textContent = info.name;
    this.el.querySelector('p').textContent = info.sub;
    clearTimeout(this.offT);
    this.el.classList.remove('out');
    void this.el.offsetWidth;
    this.el.classList.add('on');
    document.body.classList.add('cine-on');
    G.audio.sfx('legend');
    G.cam.shake(0.25);
    G.particles.ring(aura.o.pos.x, aura.o.pos.y + 0.3, aura.o.pos.z, aura.A.color, 6, 60);
    G.particles.burst(aura.o.pos.x, aura.o.pos.y + 3, aura.o.pos.z, aura.A.color2, 60, 9, { life: 1.6 });
  }
  end() {
    if (!this.active) return;
    this.active.aura.cineT = 0;
    this.active = null;
    G.cam.mode = 'follow';
    G.cam.snap?.();
    if (G.ui.overlay === 'cine') G.ui.overlay = null;
    G.cineSlow = 0;
    this.el.classList.add('out');
    document.body.classList.remove('cine-on');
    clearTimeout(this.offT);
    this.offT = setTimeout(() => this.el.classList.remove('on', 'out'), 900);
  }
  // real-time dt (not slowed)
  update(dt) {
    const A = this.active;
    if (!A) return;
    A.t += dt;
    const k = A.t / A.dur;
    G.cineSlow = k < 0.15 ? 1 - k / 0.15 * 0.65 : k > 0.85 ? 0.35 + (k - 0.85) / 0.15 * 0.65 : 0.35;
    const p = A.aura.o.pos, gs = A.aura.A.giant;
    const cam = G.cam.cam;
    // low-angle orbit, rising from the person's feet to the spirit's face
    const ang = A.a0 + 0.6 - k * 1.3;
    const R = 9 + k * 7;
    const camY = p.y + 0.8 + k * gs * 1.4;
    const target = new THREE.Vector3(p.x, p.y + 1.4 + Math.min(1, k * 1.3) * (2.4 + gs * 1.4), p.z);
    const want = new THREE.Vector3(p.x + Math.sin(ang) * R, Math.max(camY, G.physics.terrainHeight(p.x + Math.sin(ang) * R, p.z + Math.cos(ang) * R) + 0.6), p.z + Math.cos(ang) * R);
    // keep the camera out of walls and houses
    const f = G.physics.rayFraction(target.x, target.y, target.z, want.x, want.y, want.z);
    if (f < 1) want.lerpVectors(target, want, Math.max(0.15, f - 0.06));
    if (A.t < dt * 1.5) cam.position.copy(want); else cam.position.lerp(want, 1 - Math.exp(-3 * dt));
    G.cam.lookAt.lerp(target, 1 - Math.exp(-4 * dt));
    cam.lookAt(G.cam.lookAt);
    if (A.t > A.dur) this.end();
  }
}
