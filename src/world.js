// City generation, lighting, sky, day/night cycle and collision queries.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import { mulberry32, clamp, lerp } from './util.js';

export const N = 8, CELL = 80, ROAD = 16, HALF = 8, ORIGIN = -320, LANE = 4;
export const nodeCoord = (k) => ORIGIN + k * CELL;
export const BOUND = { x0: -392, x1: 392, z0: -392, z1: 372 };
export const SAND_Z = 328, SHORE_Z = 365;

class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
  quad(a, b, c, d, n, uv) {
    const o = this.p.length / 3;
    for (const v of [a, b, c, d]) { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); }
    this.u.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  boxSides(x0, x1, y0, y1, z0, z1, tile, uo = 0) {
    const v0 = y0 / tile, v1 = y1 / tile, wx = (x1 - x0) / tile, wz = (z1 - z0) / tile;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [uo, v0, uo + wx, v1]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [uo, v0, uo + wx, v1]);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [uo, v0, uo + wz, v1]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [uo, v0, uo + wz, v1]);
  }
  top(x0, x1, y, z0, z1, tile) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [x0 / tile, z1 / tile, x1 / tile, z0 / tile]);
  }
  box(x0, x1, y0, y1, z0, z1, tile) { this.boxSides(x0, x1, y0, y1, z0, z1, tile); this.top(x0, x1, y1, z0, z1, tile); }
  get empty() { return this.p.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

const SPECIAL = {
  '1,1': 'bento', '5,1': 'garage', '6,5': 'gang', '3,6': 'hospital', '2,2': 'police',
  '3,3': 'park', '6,7': 'park', '0,4': 'park', '4,1': 'shops', '2,7': 'property',
};

export class World {
  constructor(scene, renderer, quality) {
    this.scene = scene; this.renderer = renderer; this.quality = quality;
    this.rand = mulberry32(1337);
    this.hour = 9.5;
    this.blocks = [];
    this.parkSpots = [];
    this.loc = {};
    this.nightMats = [];
    this.night = 0;
    T.setAniso(renderer.capabilities.getMaxAnisotropy());
    this.initLights();
    this.initSky();
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildProps();
    this.initWeather();
    this.updateSun(true);
  }

  // ------------------------------------------------------------ weather
  initWeather() {
    this.weather = 'clear';
    this.wx = { cloud: 0, rain: 0, fog: 0 }; this.wxTarget = { cloud: 0, rain: 0, fog: 0 };
    this.wet = 0; this.weatherHours = 3 + Math.random() * 3;
    const n = 3500, pos = new Float32Array(n * 6);
    this.rainSeed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.rainSeed[i * 3] = Math.random() * 70 - 35; this.rainSeed[i * 3 + 1] = Math.random() * 30; this.rainSeed[i * 3 + 2] = Math.random() * 70 - 35; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0, depthWrite: false }));
    this.rainMesh.frustumCulled = false; this.rainMesh.visible = false;
    this.scene.add(this.rainMesh);
    this.rainFall = 0;
  }
  setWeather(name) {
    const T = { clear: { cloud: 0, rain: 0, fog: 0 }, cloudy: { cloud: 0.65, rain: 0, fog: 0.1 }, rain: { cloud: 1, rain: 1, fog: 0.35 }, fog: { cloud: 0.45, rain: 0, fog: 1 } };
    this.weather = T[name] ? name : 'clear';
    Object.assign(this.wxTarget, T[this.weather]);
  }
  nextWeather() { const order = ['clear', 'cloudy', 'rain', 'fog']; this.setWeather(order[(order.indexOf(this.weather) + 1) % order.length]); }
  updateWeather(dt, cam) {
    const gameHours = dt / 60;
    this.weatherHours -= gameHours;
    if (this.weatherHours <= 0) {
      this.weatherHours = 2 + Math.random() * 4;
      const r = Math.random();
      this.setWeather(r < 0.45 ? 'clear' : r < 0.7 ? 'cloudy' : r < 0.9 ? 'rain' : 'fog');
    }
    for (const k of ['cloud', 'rain', 'fog']) this.wx[k] = lerp(this.wx[k], this.wxTarget[k], 1 - Math.exp(-dt * 0.25));
    this.wet = clamp(this.wet + (this.wx.rain > 0.3 ? dt * 0.05 : -dt * 0.008), 0, 1);
    for (const m of this.wetMats) { m.roughness = lerp(m.userData.dry, 0.22, this.wet); m.color.setScalar(lerp(1, 0.62, this.wet) * (m.userData.tint || 1)); }
    const rm = this.rainMesh, rain = this.wx.rain;
    rm.visible = rain > 0.02; rm.material.opacity = rain * 0.45;
    if (rm.visible) {
      this.rainFall += dt * 26;
      const a = rm.geometry.attributes.position.array, S = this.rainSeed, n = S.length / 3;
      const cx = cam.x, cy = cam.y, cz = cam.z;
      for (let i = 0; i < n; i++) {
        const x = cx + ((S[i * 3] - cx * 0) % 70), z = cz + S[i * 3 + 2];
        let y = (S[i * 3 + 1] - this.rainFall) % 30; if (y < 0) y += 30;
        y += cy - 12;
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z;
        a[i * 6 + 3] = x + 0.08; a[i * 6 + 4] = y + 0.9; a[i * 6 + 5] = z + 0.04;
      }
      rm.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------ lighting
  initLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6b5a40, 0.7);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 3);
    this.sun.castShadow = true;
    const sz = this.quality === 'high' ? 4096 : 2048;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun); s.add(this.sun.target);
    s.fog = new THREE.Fog(0xc9d3dc, 140, 720);
  }

  initSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.85;
    this.sky.material.fog = false;
    this.scene.add(this.sky);
    this.envScene = new THREE.Scene();
    this.envSky = new Sky(); this.envSky.scale.setScalar(50);
    this.envSky.material.uniforms = u; // share uniforms
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = null;
    this.lastEnvHour = -10;
    // stars
    const g = new THREE.BufferGeometry(); const p = [];
    for (let i = 0; i < 1800; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      p.push(Math.sin(ph) * Math.cos(th) * 3000, Math.cos(ph) * 3000, Math.sin(ph) * Math.sin(th) * 3000);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
  }

  updateSun(force = false) {
    const ang = ((this.hour - 6) / 24) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.85, Math.sin(ang), 0.45).normalize();
    this.sunDir = sunDir;
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(sunDir);
    const elev = sunDir.y;
    const day = clamp((elev + 0.08) * 4, 0, 1);
    this.night = 1 - clamp((elev + 0.02) * 6, 0, 1);
    const low = clamp(1 - elev * 3, 0, 1);
    if (elev > -0.05) {
      this.lightDir = sunDir.clone();
      this.sun.color.setRGB(1, lerp(0.95, 0.62, low), lerp(0.86, 0.42, low));
      this.sun.intensity = 3.2 * day;
    } else {
      this.lightDir = new THREE.Vector3(-sunDir.x, -sunDir.y, sunDir.z).normalize();
      this.sun.color.setRGB(0.55, 0.65, 1);
      this.sun.intensity = 0.35;
    }
    if (this.lightDir.y < 0.12) this.lightDir.y = 0.12;
    const W = this.wx || { cloud: 0, rain: 0, fog: 0 };
    this.sun.intensity *= 1 - W.cloud * 0.78;
    u.turbidity.value = 6 + W.cloud * 12; u.rayleigh.value = 1.6 + W.cloud * 1.5; u.mieCoefficient.value = 0.006 + W.cloud * 0.02;
    this.hemi.intensity = lerp(0.12, 0.75, day) * (1 - W.cloud * 0.25);
    this.hemi.color.setRGB(lerp(0.25, 0.81, day), lerp(0.3, 0.89, day), lerp(0.5, 1, day));
    const fogDay = new THREE.Color(0xc8d0d6).lerp(new THREE.Color(0xe0b48a), low * day * 0.7);
    fogDay.lerp(new THREE.Color(0x9aa1a7), Math.max(W.cloud, W.fog) * 0.85);
    this.scene.fog.color.copy(fogDay.lerp(new THREE.Color(0x0b1222), this.night));
    this.scene.fog.near = lerp(140, 12, W.fog) * (1 - W.rain * 0.4);
    this.scene.fog.far = lerp(720, 170, W.fog) * (1 - W.rain * 0.45);
    this.stars.material.opacity = this.night;
    this.renderer.toneMappingExposure = lerp(0.62, 1.05, this.night);
    for (const m of this.nightMats) m.material.emissiveIntensity = m.base * this.night;
    if (this.glowMat) this.glowMat.opacity = this.night * 0.85;
    if (force || Math.abs(this.hour - this.lastEnvHour) > 0.35) {
      this.lastEnvHour = this.hour;
      if (this.envRT) this.envRT.dispose();
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 100);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = lerp(0.15, 1.0, day);
    }
  }

  update(dt, focus, timeScale = 1, cam = focus) {
    this.hour = (this.hour + (dt / 60) * timeScale) % 24;
    this.updateWeather(dt, cam);
    this.updateSun();
    const ld = this.lightDir;
    this.sun.position.set(focus.x + ld.x * 250, ld.y * 250, focus.z + ld.z * 250);
    this.sun.target.position.set(focus.x, 0, focus.z);
    // snap shadow camera to texels to avoid shimmering
    this.sky.position.set(focus.x, 0, focus.z);
    this.stars.position.set(focus.x, 0, focus.z);
    if (this.waterTex) { this.waterTex.offset.x += dt * 0.01; this.waterTex.offset.y += dt * 0.006; }
  }

  // ------------------------------------------------------------ ground
  buildGround() {
    const grass = T.makeGrass(); grass.repeat.set(400, 400);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.03, SAND_Z + 2 - 1600); ground.receiveShadow = true;
    this.scene.add(ground);

    // beach with slope into ocean
    const sand = T.makeSand(); sand.repeat.set(160, 48);
    const sg = new THREE.PlaneGeometry(3200, 200, 1, 60);
    sg.rotateX(-Math.PI / 2);
    const pa = sg.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const z = pa.getZ(i) + SAND_Z + 100;
      pa.setZ(i, z); pa.setY(i, this.sandHeight(z));
    }
    sg.computeVertexNormals();
    const sandMesh = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
    sandMesh.receiveShadow = true; this.scene.add(sandMesh);

    this.waterTex = T.makeWaterNormal(); this.waterTex.repeat.set(120, 60);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1600), new THREE.MeshPhysicalMaterial({
      color: 0x0f4d63, roughness: 0.06, metalness: 0.0, normalMap: this.waterTex, normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true, opacity: 0.93, clearcoat: 1, clearcoatRoughness: 0.1,
    }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.42, SHORE_Z + 800);
    water.receiveShadow = true;
    this.scene.add(water);

    // distant hills
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x6f7d48, flatShading: true, roughness: 1 });
    const r = mulberry32(5);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (1.05 + r() * 0.9);
      const d = 750 + r() * 350;
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
      h.position.set(Math.cos(a) * d, 0, Math.sin(a) * d * 0.9);
      h.rotation.y = r() * 3; h.scale.set(140 + r() * 160, 25 + r() * 70, 140 + r() * 160);
      this.scene.add(h);
    }
  }

  get waterLevel() { return -0.42; }
  sandHeight(z) { return z < SHORE_Z ? 0 : -(z - SHORE_Z) * 0.06; }

  // ------------------------------------------------------------ roads
  buildRoads() {
    const roadT = T.makeRoad(), interT = T.makeIntersection();
    const rb = new GeoBuilder(), ib = new GeoBuilder();
    const y = 0.01;
    for (let k = 0; k <= N; k++) for (let l = 0; l <= N; l++) {
      const cx = nodeCoord(k), cz = nodeCoord(l);
      ib.quad([cx - HALF, y + 0.004, cz + HALF], [cx + HALF, y + 0.004, cz + HALF], [cx + HALF, y + 0.004, cz - HALF], [cx - HALF, y + 0.004, cz - HALF], [0, 1, 0], [0, 0, 1, 1]);
      if (k < N) { // segment along +x
        const x0 = cx + HALF, x1 = cx + CELL - HALF;
        // u across width (z), v along length (x)
        const o = rb.p.length / 3;
        for (const v of [[x0, y, cz + HALF], [x1, y, cz + HALF], [x1, y, cz - HALF], [x0, y, cz - HALF]]) { rb.p.push(...v); rb.n.push(0, 1, 0); }
        rb.u.push(0, 0, 0, 4, 1, 4, 1, 0); rb.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      if (l < N) { // segment along +z
        const z0 = cz + HALF, z1 = cz + CELL - HALF;
        rb.quad([cx - HALF, y, z1], [cx + HALF, y, z1], [cx + HALF, y, z0], [cx - HALF, y, z0], [0, 1, 0], [0, 4, 1, 0]);
      }
    }
    const roads = new THREE.Mesh(rb.build(), new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.92 }));
    const inters = new THREE.Mesh(ib.build(), new THREE.MeshStandardMaterial({ map: interT, roughness: 0.92 }));
    roads.receiveShadow = inters.receiveShadow = true;
    this.wetMats = [roads.material, inters.material];
    for (const m of this.wetMats) m.userData.dry = m.roughness;
    this.scene.add(roads, inters);
  }

  // ------------------------------------------------------------ blocks
  buildBlocks() {
    const rand = this.rand;
    this.facadeMats = T.FACADE_STYLES.map((s, i) => {
      const t = T.makeFacade(s, 100 + i);
      const m = new THREE.MeshStandardMaterial({
        map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 0,
        roughness: s.metal ? 0.18 : 0.82, metalness: s.metal ? 0.55 : 0.0, envMapIntensity: s.metal ? 1.4 : 0.6,
      });
      this.nightMats.push({ material: m, base: 1.6 });
      return m;
    });
    this.styleBuilders = T.FACADE_STYLES.map(() => new GeoBuilder());
    this.roofBuilder = new GeoBuilder();
    this.slabBuilder = new GeoBuilder();
    this.grassBuilder = new GeoBuilder();
    this.lotBuilder = new GeoBuilder();
    this.detailBuilder = new GeoBuilder();
    this.trees = []; this.palms = []; this.lamps = [];
    this.signs = [];

    for (let i = 0; i < N; i++) {
      this.blocks.push([]);
      for (let j = 0; j < N; j++) {
        const x0 = nodeCoord(i) + HALF, z0 = nodeCoord(j) + HALF;
        const b = { i, j, x0, x1: x0 + 64, z0, z1: z0 + 64, cx: x0 + 32, cz: z0 + 32, colliders: [] };
        const d = Math.max(Math.abs(i - 3.5), Math.abs(j - 3.5));
        b.type = SPECIAL[`${i},${j}`] || (j === 7 ? 'residential' : d <= 1.5 ? 'downtown' : d <= 2.5 ? 'commercial' : 'residential');
        this.blocks[i].push(b);
        this.genBlock(b, rand);
      }
    }

    const roofMat = new THREE.MeshStandardMaterial({ map: T.makeRoof(), roughness: 0.95 });
    this.styleBuilders.forEach((gb, i) => {
      if (gb.empty) return;
      const m = new THREE.Mesh(gb.build(), this.facadeMats[i]);
      m.castShadow = m.receiveShadow = true; this.scene.add(m);
    });
    const roofs = new THREE.Mesh(this.roofBuilder.build(), roofMat);
    roofs.receiveShadow = true; roofs.castShadow = true; this.scene.add(roofs);
    const dmat = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.8, metalness: 0.2 });
    const det = new THREE.Mesh(this.detailBuilder.build(), dmat);
    det.castShadow = true; det.receiveShadow = true; this.scene.add(det);

    const sw = T.makeSidewalk();
    const slabMat = new THREE.MeshStandardMaterial({ map: sw, roughness: 0.9 });
    const slab = new THREE.Mesh(this.slabBuilder.build(), slabMat); slab.receiveShadow = true; this.scene.add(slab);
    slabMat.userData.dry = slabMat.roughness; this.wetMats.push(slabMat);
    const gt = T.makeGrass();
    const grass = new THREE.Mesh(this.grassBuilder.build(), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    grass.receiveShadow = true; this.scene.add(grass);
    const lt = T.makeIntersection(); // reuse asphalt-ish
    const lots = new THREE.Mesh(this.lotBuilder.build(), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.9, color: 0xbbbbbb }));
    lots.receiveShadow = true; this.scene.add(lots);
    lots.material.userData.dry = 0.9; lots.material.userData.tint = 0.73; this.wetMats.push(lots.material);
  }

  addBuilding(b, x0, x1, z0, z1, h, style) {
    const gb = this.styleBuilders[style];
    gb.boxSides(x0, x1, 0, h, z0, z1, 16, Math.floor(this.rand() * 4) * 0.25);
    this.roofBuilder.top(x0, x1, h, z0, z1, 8);
    // parapet
    const p = 0.5, ph = 1.0;
    this.detailBuilder.box(x0, x1, h, h + ph, z0, z0 + p, 4);
    this.detailBuilder.box(x0, x1, h, h + ph, z1 - p, z1, 4);
    this.detailBuilder.box(x0, x0 + p, h, h + ph, z0, z1, 4);
    this.detailBuilder.box(x1 - p, x1, h, h + ph, z0, z1, 4);
    // rooftop clutter
    const n = h > 10 ? 1 + Math.floor(this.rand() * 3) : 0;
    for (let k = 0; k < n; k++) {
      const w = 2 + this.rand() * 4, d = 2 + this.rand() * 4, hh = 1 + this.rand() * 2.5;
      const cx = lerp(x0 + 2 + w / 2, x1 - 2 - w / 2, this.rand()), cz = lerp(z0 + 2 + d / 2, z1 - 2 - d / 2, this.rand());
      this.detailBuilder.box(cx - w / 2, cx + w / 2, h, h + hh, cz - d / 2, cz + d / 2, 4);
    }
    b.colliders.push({ x0, x1, z0, z1, h: h + ph });
  }

  collider(b, x, z, r, h = 3) { b.colliders.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r, h }); }

  genBlock(b, rand) {
    const SH = 0.15;
    // sidewalk slab with curb
    this.slabBuilder.box(b.x0, b.x1, -0.1, SH, b.z0, b.z1, 4);
    const ix0 = b.x0 + 4, ix1 = b.x1 - 4, iz0 = b.z0 + 4, iz1 = b.z1 - 4;
    const gtop = (x0, x1, z0, z1) => this.grassBuilder.top(x0, x1, SH + 0.01, z0, z1, 8);
    const lot = (x0, x1, z0, z1) => this.lotBuilder.top(x0, x1, SH + 0.01, z0, z1, 16);
    const stucco = [0, 1, 7, 8, 3];
    const q = [[ix0, ix0 + 26, iz0, iz0 + 26], [ix1 - 26, ix1, iz0, iz0 + 26], [ix0, ix0 + 26, iz1 - 26, iz1], [ix1 - 26, ix1, iz1 - 26, iz1]];
    const step4 = (a, c) => Math.round((a + rand() * (c - a)) / 4) * 4;

    switch (b.type) {
      case 'downtown': {
        if (rand() < 0.45) {
          const h = step4(48, 112);
          this.addBuilding(b, ix0 + 3, ix1 - 3, iz0 + 3, iz1 - 3, h, rand() < 0.5 ? 4 : 6);
          this.addBuilding(b, ix0, ix1, iz0, iz1, 8, 5);
        } else {
          this.addBuilding(b, ix0, ix0 + 26, iz0, iz1, step4(28, 84), [4, 6, 5, 3][Math.floor(rand() * 4)]);
          this.addBuilding(b, ix1 - 26, ix1, iz0, iz1, step4(24, 72), [4, 6, 5, 2][Math.floor(rand() * 4)]);
        }
        break;
      }
      case 'commercial': {
        q.forEach(([x0, x1, z0, z1]) => {
          if (rand() < 0.18) { lot(x0, x1, z0, z1); this.parkSpots.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, h: rand() * 6 }); return; }
          const ins = rand() * 2;
          this.addBuilding(b, x0 + ins, x1 - ins, z0 + ins, z1 - ins, step4(8, 32), [0, 1, 2, 3, 5, 7, 8][Math.floor(rand() * 7)]);
        });
        break;
      }
      case 'residential': {
        gtop(ix0, ix1, iz0, iz1);
        q.forEach(([x0, x1, z0, z1]) => {
          const w = 12 + rand() * 5, d = 10 + rand() * 5;
          const cx = (x0 + x1) / 2 + (rand() - 0.5) * 4, cz = (z0 + z1) / 2 + (rand() - 0.5) * 4;
          this.addBuilding(b, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, rand() < 0.6 ? 4 : 8, stucco[Math.floor(rand() * stucco.length)]);
          if (rand() < 0.7) this.addPalm(b, x0 + 2 + rand() * 3, z0 + 2 + rand() * 3);
          else this.addTree(b, x1 - 3, z1 - 3);
        });
        break;
      }
      case 'park': {
        gtop(ix0, ix1, iz0, iz1);
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * Math.PI * 2, r = 20 + rand() * 4;
          if (k % 2) this.addPalm(b, b.cx + Math.cos(a) * r, b.cz + Math.sin(a) * r);
          else this.addTree(b, b.cx + Math.cos(a) * r, b.cz + Math.sin(a) * r);
        }
        // fountain
        this.detailBuilder.box(b.cx - 5, b.cx + 5, SH, 0.9, b.cz - 5, b.cz + 5, 4);
        this.detailBuilder.box(b.cx - 0.6, b.cx + 0.6, 0.9, 3.2, b.cz - 0.6, b.cz + 0.6, 4);
        const water = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 9.2), new THREE.MeshPhysicalMaterial({ color: 0x2e7f9a, roughness: 0.05, normalMap: T.makeWaterNormal(), clearcoat: 1 }));
        water.rotation.x = -Math.PI / 2; water.position.set(b.cx, 0.86, b.cz); this.scene.add(water);
        this.collider(b, b.cx, b.cz, 5, 0.9);
        break;
      }
      case 'bento': {
        gtop(ix0, ix1, iz0, iz1);
        this.addBuilding(b, b.cx - 9, b.cx + 9, b.cz - 10, b.cz + 6, 8, 8);
        this.addPalm(b, b.cx - 14, b.cz + 14); this.addPalm(b, b.cx + 14, b.cz + 14);
        this.addBuilding(b, ix0, ix0 + 16, iz0, iz0 + 14, 4, 0);
        this.addBuilding(b, ix1 - 16, ix1, iz0, iz0 + 14, 4, 1);
        lot(b.cx - 4, b.cx + 4, b.cz + 6, iz1 + 4);
        this.loc.bento = new THREE.Vector3(b.cx, SH, b.cz + 12);
        this.loc.safehouse = new THREE.Vector3(b.cx + 4, SH, b.cz + 22);
        this.addSign('CASA DO BENTO', b.cx, 6.5, b.cz + 6.05, 0, { bg: '#2d1d10', fg: '#f6d27a' });
        this.parkSpots.push({ x: b.cx, z: b.cz + 18, h: 0 });
        break;
      }
      case 'garage': {
        lot(ix0, ix1, iz0, iz1);
        this.addBuilding(b, ix0, ix1, iz0, iz0 + 22, 10, 3);
        this.addBuilding(b, ix0, ix0 + 10, iz0 + 22, iz1 - 10, 6, 2);
        this.addSign('OFICINA DO DUDA', b.cx, 8, iz0 + 22.05, 0, { bg: '#111', fg: '#ff7a2a', border: '#ff7a2a' });
        this.loc.garage = new THREE.Vector3(b.cx + 4, SH, iz0 + 34);
        this.loc.duda = new THREE.Vector3(b.cx + 12, SH, iz0 + 26);
        this.loc.paint = new THREE.Vector3(ix0 + 17, SH, iz0 + 28);
        this.addSign('PINTURA & REPARO', ix0 + 17, 5, iz0 + 22.06, 0, { bg: '#0d2a4a', fg: '#ffd24a' });
        this.parkSpots.push({ x: b.cx + 16, z: iz1 - 6, h: Math.PI / 2 });
        break;
      }
      case 'gang': {
        lot(ix0, ix1, iz0, iz1);
        this.addBuilding(b, ix0, ix0 + 14, iz0, iz1, 12, 9);
        this.addBuilding(b, ix1 - 14, ix1, iz0, iz1, 16, 9);
        this.addBuilding(b, ix0 + 14, ix1 - 14, iz0, iz0 + 10, 8, 9);
        for (const [x, z, ry] of [[ix0 + 14.05, b.cz, Math.PI / 2], [ix1 - 14.05, b.cz + 6, -Math.PI / 2], [b.cx, iz0 + 10.05, 0]]) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ map: T.makeGraffiti('CORVOS', x | 0), transparent: true, roughness: 0.9 }));
          m.position.set(x, 3, z); m.rotation.y = ry; this.scene.add(m);
        }
        this.loc.gang = new THREE.Vector3(b.cx, SH, b.cz + 4);
        break;
      }
      case 'hospital': {
        gtop(ix0, ix1, iz0, iz1);
        this.addBuilding(b, ix0 + 4, ix1 - 4, iz0 + 2, iz0 + 30, 24, 5);
        this.addSign('HOSPITAL', b.cx, 20, iz0 + 30.05, 0, { bg: '#fff', fg: '#d01818' });
        this.loc.hospital = new THREE.Vector3(b.cx, SH, iz0 + 38);
        break;
      }
      case 'shops': {
        this.addBuilding(b, ix0, ix1, iz0, iz0 + 24, 28, 5);
        const stores = [['clothes', 'MODA SOL', 1, { bg: '#1d1d3a', fg: '#ff8fd0' }], ['food', 'LANCHONETE MARÉ', 7, { bg: '#7a1a10', fg: '#ffe27a' }], ['gym', 'ACADEMIA FERRO', 3, { bg: '#151515', fg: '#7ad0ff' }]];
        stores.forEach(([key, name, style, colors], k) => {
          const x0 = ix0 + 1 + k * 18.3, x1 = x0 + 16.5;
          this.addBuilding(b, x0, x1, iz1 - 16, iz1, 8, style);
          this.addSign(name, (x0 + x1) / 2, 5.6, iz1 + 0.06, 0, colors);
          this.detailBuilder.box(x0 + 3, x1 - 3, 3.4, 3.6, iz1, iz1 + 1.6, 4); // awning
          this.loc[key] = new THREE.Vector3((x0 + x1) / 2, SH, iz1 + 2);
        });
        lot(ix0, ix1, iz0 + 24, iz1 - 16);
        break;
      }
      case 'property': {
        gtop(ix0, ix1, iz0, iz1);
        this.addBuilding(b, ix0 + 6, ix1 - 6, iz0 + 2, iz0 + 28, 20, 6);
        this.addSign('EDIFÍCIO MARÉ', b.cx, 16, iz0 + 28.06, 0, { bg: '#0f3b3b', fg: '#e8fff8' });
        this.loc.property = new THREE.Vector3(b.cx, SH, iz0 + 31);
        this.addPalm(b, ix0 + 3, iz1 - 3); this.addPalm(b, ix1 - 3, iz1 - 3);
        this.parkSpots.push({ x: b.cx + 10, z: iz0 + 38, h: 0 });
        break;
      }
      case 'police': {
        lot(ix0, ix1, iz0, iz1);
        this.addBuilding(b, ix0 + 2, ix1 - 2, iz0, iz0 + 28, 16, 3);
        this.addSign('POLÍCIA', b.cx, 12, iz0 + 28.05, 0, { bg: '#0f2a66', fg: '#fff' });
        this.loc.police = new THREE.Vector3(b.cx, SH, iz0 + 36);
        this.policeSpots = [{ x: b.cx - 10, z: iz1 - 8, h: 0 }, { x: b.cx + 10, z: iz1 - 8, h: 0 }];
        break;
      }
    }
    // street lamps along the sidewalk
    for (let t = 12; t < 64; t += 26) {
      this.lamps.push({ x: b.x0 + t, z: b.z0 + 1, ry: Math.PI }, { x: b.x0 + t, z: b.z1 - 1, ry: 0 });
      this.lamps.push({ x: b.x0 + 1, z: b.z0 + t, ry: -Math.PI / 2 }, { x: b.x1 - 1, z: b.z0 + t, ry: Math.PI / 2 });
    }
    // sidewalk palms on beach row
    if (b.j === 7) for (let t = 6; t < 64; t += 20) this.addPalm(b, b.x0 + t, b.z1 - 1.6);
  }

  addSign(text, x, y, z, ry, opts) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshStandardMaterial({ map: T.makeSign(text, opts), emissive: 0xffffff, emissiveMap: null, roughness: 0.6 }));
    m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = 0;
    this.nightMats.push({ material: m.material, base: 0.8 });
    m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m);
  }

  addPalm(b, x, z) { this.palms.push({ x, z, s: 0.85 + this.rand() * 0.4, ry: this.rand() * 6.28, tilt: (this.rand() - 0.5) * 0.25 }); if (b) this.collider(b, x, z, 0.3, 8); }
  addTree(b, x, z) { this.trees.push({ x, z, s: 0.8 + this.rand() * 0.5, ry: this.rand() * 6.28 }); if (b) this.collider(b, x, z, 0.35, 6); }

  buildProps() {
    // beach palms
    for (let x = -380; x < 380; x += 22 + this.rand() * 18) this.addPalm(null, x, 342 + this.rand() * 12);
    // outskirts trees
    for (let k = 0; k < 400; k++) {
      let x = (this.rand() * 2 - 1) * 390, z = (this.rand() * 2 - 1) * 390;
      if (Math.max(Math.abs(x), Math.abs(z)) < 338 || z > 300) continue;
      this.addTree(null, x, z);
    }
    const dummy = new THREE.Object3D();
    // palms
    const trunkG = new THREE.CylinderGeometry(0.14, 0.26, 8, 7, 4); trunkG.translate(0, 4, 0);
    const tp = trunkG.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + Math.pow(y / 8, 2) * 0.8); }
    trunkG.computeVertexNormals();
    const leaves = [];
    for (let k = 0; k < 9; k++) {
      const lg = new THREE.PlaneGeometry(1.3, 4.5, 1, 6);
      lg.translate(0, 2.25, 0);
      const p = lg.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -Math.pow(y / 4.5, 2) * 1.8); }
      lg.rotateX(-Math.PI / 2 + 0.35);
      lg.rotateY((k / 9) * Math.PI * 2);
      lg.translate(0.8, 8, 0);
      leaves.push(lg);
    }
    const crownG = mergeGeometries(leaves); crownG.computeVertexNormals();
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x8a7457, roughness: 1 });
    const leafM = new THREE.MeshStandardMaterial({ map: T.makeLeaf(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    const tI = new THREE.InstancedMesh(trunkG, trunkM, this.palms.length);
    const cI = new THREE.InstancedMesh(crownG, leafM, this.palms.length);
    this.palms.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z); dummy.rotation.set(p.tilt, p.ry, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix();
      tI.setMatrixAt(i, dummy.matrix); cI.setMatrixAt(i, dummy.matrix);
    });
    tI.castShadow = cI.castShadow = true; tI.receiveShadow = cI.receiveShadow = true;
    this.scene.add(tI, cI);

    // round trees
    const tr = new THREE.CylinderGeometry(0.18, 0.3, 3.2, 6); tr.translate(0, 1.6, 0);
    const fo = new THREE.IcosahedronGeometry(2.4, 1);
    const fp = fo.attributes.position; const r = mulberry32(9);
    for (let i = 0; i < fp.count; i++) fp.setXYZ(i, fp.getX(i) * (0.85 + r() * 0.3), fp.getY(i) * (0.8 + r() * 0.3), fp.getZ(i) * (0.85 + r() * 0.3));
    fo.computeVertexNormals(); fo.translate(0, 4.4, 0);
    const trI = new THREE.InstancedMesh(tr, trunkM, this.trees.length);
    const foI = new THREE.InstancedMesh(fo, new THREE.MeshStandardMaterial({ color: 0x4f7a2e, roughness: 0.9, flatShading: true }), this.trees.length);
    const col = new THREE.Color();
    this.trees.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, t.ry, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix();
      trI.setMatrixAt(i, dummy.matrix); foI.setMatrixAt(i, dummy.matrix);
      foI.setColorAt(i, col.setHSL(0.24 + r() * 0.08, 0.45, 0.28 + r() * 0.1));
    });
    trI.castShadow = foI.castShadow = true; foI.receiveShadow = true;
    this.scene.add(trI, foI);

    // street lamps
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 6.5, 6); pole.translate(0, 3.25, 0);
    const arm = new THREE.BoxGeometry(0.1, 0.1, 2.2); arm.translate(0, 6.4, 1.05);
    const head = new THREE.BoxGeometry(0.4, 0.16, 0.7); head.translate(0, 6.35, 2.05);
    const lampG = mergeGeometries([pole, arm, head]);
    const bulbG = new THREE.BoxGeometry(0.3, 0.05, 0.55); bulbG.translate(0, 6.26, 2.05);
    const lampM = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.7, roughness: 0.4 });
    const bulbM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc77a, emissiveIntensity: 0 });
    this.nightMats.push({ material: bulbM, base: 6 });
    const lI = new THREE.InstancedMesh(lampG, lampM, this.lamps.length);
    const bI = new THREE.InstancedMesh(bulbG, bulbM, this.lamps.length);
    this.glowMat = new THREE.MeshBasicMaterial({ map: T.makeGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: true });
    const glowG = new THREE.PlaneGeometry(12, 12); glowG.rotateX(-Math.PI / 2);
    const gI = new THREE.InstancedMesh(glowG, this.glowMat, this.lamps.length);
    this.lamps.forEach((l, i) => {
      dummy.position.set(l.x, 0.15, l.z); dummy.rotation.set(0, l.ry, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      lI.setMatrixAt(i, dummy.matrix); bI.setMatrixAt(i, dummy.matrix);
      dummy.position.set(l.x + Math.sin(l.ry) * 2, 0.06, l.z + Math.cos(l.ry) * 2); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      gI.setMatrixAt(i, dummy.matrix);
      const b = this.blockAt(l.x, l.z); if (b) this.collider(b, l.x, l.z, 0.15, 6);
    });
    lI.castShadow = true;
    this.scene.add(lI, bI, gI);
  }

  // ------------------------------------------------------------ queries
  blockAt(x, z) {
    const i = Math.floor((x - ORIGIN) / CELL), j = Math.floor((z - ORIGIN) / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return null;
    const b = this.blocks[i][j];
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return null;
    return b;
  }
  groundHeight(x, z) {
    if (this.blockAt(x, z)) return 0.15;
    if (z > SHORE_Z) return this.sandHeight(z);
    return 0;
  }
  // resolve circle against static colliders. Mutates p (has x,z). returns normal or null
  collideCircle(p, r, zMax = BOUND.z1) {
    let hit = null;
    const i0 = Math.max(0, Math.floor((p.x - r - ORIGIN) / CELL)), i1 = Math.min(N - 1, Math.floor((p.x + r - ORIGIN) / CELL));
    const j0 = Math.max(0, Math.floor((p.z - r - ORIGIN) / CELL)), j1 = Math.min(N - 1, Math.floor((p.z + r - ORIGIN) / CELL));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      for (const c of this.blocks[i][j].colliders) {
        if (p.y !== undefined && p.y > c.h) continue;
        const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1);
        let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let nx, nz, pen;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d; }
        else {
          const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, bb = c.z1 - p.z;
          const m = Math.min(l, rr, t, bb);
          if (m === l) { nx = -1; nz = 0; pen = l + r; } else if (m === rr) { nx = 1; nz = 0; pen = rr + r; }
          else if (m === t) { nx = 0; nz = -1; pen = t + r; } else { nx = 0; nz = 1; pen = bb + r; }
        }
        p.x += nx * pen; p.z += nz * pen;
        hit = hit || { x: 0, z: 0 }; hit.x += nx; hit.z += nz;
      }
    }
    if (p.x < BOUND.x0 + r) { p.x = BOUND.x0 + r; hit = { x: 1, z: 0 }; }
    if (p.x > BOUND.x1 - r) { p.x = BOUND.x1 - r; hit = { x: -1, z: 0 }; }
    if (p.z < BOUND.z0 + r) { p.z = BOUND.z0 + r; hit = { x: 0, z: 1 }; }
    if (p.z > zMax - r) { p.z = zMax - r; hit = { x: 0, z: -1 }; }
    if (hit) { const l = Math.hypot(hit.x, hit.z) || 1; hit.x /= l; hit.z /= l; }
    return hit;
  }
  pointInBuilding(x, y, z) {
    const i = Math.floor((x - ORIGIN) / CELL), j = Math.floor((z - ORIGIN) / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    for (const c of this.blocks[i][j].colliders) if (y < c.h && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return true;
    return false;
  }
  lineBlocked(a, b, step = 1.5) {
    const d = a.distanceTo(b), n = Math.ceil(d / step);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (this.pointInBuilding(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t))) return true;
    }
    return false;
  }
  randomSidewalkPoint(near, minD, maxD, rand = Math.random) {
    for (let tries = 0; tries < 30; tries++) {
      const a = rand() * Math.PI * 2, r = minD + rand() * (maxD - minD);
      let x = near.x + Math.cos(a) * r, z = near.z + Math.sin(a) * r;
      const i = Math.floor((x - ORIGIN) / CELL), j = Math.floor((z - ORIGIN) / CELL);
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const b = this.blocks[i][j];
      // snap to sidewalk ring
      const side = Math.floor(rand() * 4);
      if (side === 0) { z = b.z0 + 2; x = clamp(x, b.x0 + 2, b.x1 - 2); }
      else if (side === 1) { z = b.z1 - 2; x = clamp(x, b.x0 + 2, b.x1 - 2); }
      else if (side === 2) { x = b.x0 + 2; z = clamp(z, b.z0 + 2, b.z1 - 2); }
      else { x = b.x1 - 2; z = clamp(z, b.z0 + 2, b.z1 - 2); }
      const p = { x, z };
      if (this.collideCircle({ x, z }, 0.5)) continue;
      return { x: p.x, z: p.z, block: b };
    }
    return null;
  }
  // random lane position: returns {x,z,dir:[dx,dz]}
  randomLanePoint(near, minD, maxD, rand = Math.random) {
    for (let tries = 0; tries < 40; tries++) {
      const k = Math.floor(rand() * (N + 1)), seg = Math.floor(rand() * N);
      const along = nodeCoord(seg) + HALF + 6 + rand() * (CELL - ROAD - 12);
      const horiz = rand() < 0.5, sgn = rand() < 0.5 ? 1 : -1;
      let x, z, dir;
      if (horiz) { dir = [sgn, 0]; z = nodeCoord(k); x = along; }
      else { dir = [0, sgn]; x = nodeCoord(k); z = along; }
      // right offset = (-dz, dx)
      x += -dir[1] * LANE; z += dir[0] * LANE;
      const d = Math.hypot(x - near.x, z - near.z);
      if (d < minD || d > maxD) continue;
      return { x, z, dir };
    }
    return null;
  }
}
