import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp, lerp, smoothstep } from './util.js';

export const WEATHERS = {
  clear: { pt: 'Ensolarado', en: 'Sunny', icon: '☀', cloud: 0.12, rain: 0, fog: 0.00042, wind: 3 },
  cloudy: { pt: 'Nublado', en: 'Cloudy', icon: '☁', cloud: 0.68, rain: 0, fog: 0.0007, wind: 6.5 },
  rain: { pt: 'Chuva', en: 'Rain', icon: '🌧', cloud: 0.93, rain: 0.7, fog: 0.0016, wind: 9 },
  storm: { pt: 'Tempestade', en: 'Storm', icon: '⛈', cloud: 1, rain: 1, fog: 0.0022, wind: 16 },
  fog: { pt: 'Neblina', en: 'Fog', icon: '🌫', cloud: 0.5, rain: 0, fog: 0.0058, wind: 1.5 },
};
export const PERIODS = [
  { id: 'dawn', pt: 'Madrugada', en: 'Late night', from: 0, to: 5, jump: 2.5 },
  { id: 'morning', pt: 'Manhã', en: 'Morning', from: 5, to: 11, jump: 8 },
  { id: 'noon', pt: 'Começo da tarde', en: 'Early afternoon', from: 11, to: 14, jump: 12.5 },
  { id: 'afternoon', pt: 'Tarde', en: 'Afternoon', from: 14, to: 18, jump: 16.5 },
  { id: 'night', pt: 'Noite', en: 'Night', from: 18, to: 24, jump: 20.5 },
];
export const periodAt = (t) => PERIODS.find((p) => t >= p.from && t < p.to) || PERIODS[0];
const AUTO = [['clear', 4], ['cloudy', 3], ['rain', 1.6], ['storm', 0.7], ['fog', 0.8]];

function cloudTexture() {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 70;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}

export class Environment {
  constructor(scene, renderer, world, settings) {
    this.scene = scene; this.renderer = renderer; this.world = world; this.s = settings;
    this.time = 16.6;
    this.weather = 'clear';
    const w = WEATHERS.clear;
    this.p = { cloud: w.cloud, rain: w.rain, fog: w.fog, wind: w.wind };
    this.nextChange = 3;
    this.windAng = 0.7;
    this.wind = new THREE.Vector2();
    this.windSpeed = 3;
    this.wetness = 0;
    this.night = 0;
    this.flash = 0;
    this.drawDist = 1;
    this.onThunder = null;
    this.t = 0;

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x5a4a32, 0.8);
    scene.add(this.hemi);

    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    const u = this.sky.material.uniforms;
    u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
    scene.add(this.sky);
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(this.sky.geometry, this.sky.material);
    this.envSky.scale.setScalar(100);
    this.envScene.add(this.envSky);
    this.envCloud = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 8), new THREE.MeshBasicMaterial({ color: 0x777777, side: THREE.BackSide, transparent: true, opacity: 0 }));
    this.envScene.add(this.envCloud);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTimer = 0;

    scene.fog = new THREE.FogExp2(0xbfd1e5, 0.0005);

    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
    this.clouds.position.y = 650;
    this.clouds.renderOrder = -1;
    scene.add(this.clouds);

    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.acos(Math.random() * 0.95);
      sp.set([Math.cos(a) * Math.sin(e) * 3300, Math.cos(e) * 3300, Math.sin(a) * Math.sin(e) * 3300], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(this.stars);

    this.RN = 4000;
    const rp = new Float32Array(this.RN * 6);
    this.rainV = new Float32Array(this.RN * 3);
    for (let i = 0; i < this.RN; i++) this.spawnDrop(i, rp, new THREE.Vector3(), true);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb8c4d0, transparent: true, opacity: 0.35, depthWrite: false }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    this.sunDir = new THREE.Vector3();
    this.fogCol = new THREE.Color();
  }

  spawnDrop(i, arr, c, any) {
    const x = c.x + (Math.random() - 0.5) * 80, z = c.z + (Math.random() - 0.5) * 80;
    const y = c.y + (any ? Math.random() * 45 - 12 : 30 + Math.random() * 6);
    arr[i * 6] = x; arr[i * 6 + 1] = y; arr[i * 6 + 2] = z;
    arr[i * 6 + 3] = x; arr[i * 6 + 4] = y + 0.6; arr[i * 6 + 5] = z;
  }

  setWeather(name, instant = false) {
    this.weather = name;
    if (instant) Object.assign(this.p, WEATHERS[name]);
  }

  get windStrength() { return this.windSpeed / 8; }

  update(dt, cam, focus) {
    this.t += dt;
    const ts = this.s.get('timeScale');
    this.time = (this.time + (dt / 60) * ts) % 24;
    const forced = this.s.get('weather');
    if (forced !== 'auto') this.weather = forced;
    else {
      this.nextChange -= (dt / 60) * Math.max(ts, 0.5);
      if (this.nextChange <= 0) {
        this.nextChange = 2 + Math.random() * 4;
        let tot = AUTO.reduce((a, b) => a + b[1], 0), r = Math.random() * tot;
        for (const [n, w] of AUTO) { r -= w; if (r <= 0) { this.weather = n; break; } }
      }
    }
    const W = WEATHERS[this.weather];
    const k = 1 - Math.exp(-dt * 0.06);
    for (const key of ['cloud', 'rain', 'fog', 'wind']) this.p[key] = lerp(this.p[key], W[key], k);

    // vento com rajadas
    this.windAng += Math.sin(this.t * 0.013) * dt * 0.02;
    const gust = 1 + 0.35 * Math.sin(this.t * 0.7) * Math.sin(this.t * 0.23 + 1.3) + 0.15 * Math.sin(this.t * 2.1);
    this.windSpeed = this.p.wind * gust;
    this.wind.set(Math.cos(this.windAng) * this.windSpeed, Math.sin(this.windAng) * this.windSpeed);
    this.world.windU.uWind.value.set(Math.cos(this.windAng), Math.sin(this.windAng), this.windSpeed / 8);

    // sol e lua
    const a = ((this.time - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(a), Math.sin(a) * 0.92, -0.38).normalize();
    const elev = this.sunDir.y;
    this.night = 1 - smoothstep(-0.12, 0.08, elev);
    const cl = this.p.cloud;
    const warm = 1 - smoothstep(0.02, 0.35, elev);
    const sunCol = new THREE.Color(1, 0.97, 0.92).lerp(new THREE.Color(1, 0.55, 0.28), warm);
    let lightDir = this.sunDir, li;
    if (elev > -0.04) li = 3.2 * smoothstep(-0.04, 0.14, elev) * (1 - 0.72 * cl);
    else { lightDir = this.sunDir.clone().negate(); lightDir.y = Math.abs(lightDir.y) + 0.3; lightDir.normalize(); sunCol.setRGB(0.55, 0.65, 1); li = 0.35 * (1 - cl * 0.7); }
    this.sun.color.copy(sunCol);
    this.sun.intensity = li;
    this.sun.position.copy(focus).addScaledVector(lightDir, 400);
    this.sun.target.position.copy(focus);
    this.sun.castShadow = this.s.get('shadows') && li > 0.05;
    this.flash *= Math.exp(-dt * 7);
    const day = 1 - this.night;
    this.hemi.intensity = (lerp(0.1, 0.95, day) * (1 - 0.25 * cl)) + this.flash * 4;
    this.hemi.color.setRGB(lerp(0.25, 0.75, day), lerp(0.3, 0.84, day), lerp(0.55, 1, day)).lerp(new THREE.Color(0.7, 0.7, 0.72), cl * 0.6);
    this.hemi.groundColor.setRGB(0.32 * day + 0.04, 0.27 * day + 0.04, 0.2 * day + 0.06);

    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir).multiplyScalar(1).setY(Math.max(this.sunDir.y, -0.25));
    u.turbidity.value = lerp(2.5, 16, cl);
    u.rayleigh.value = lerp(1.4, 0.35, cl) + warm * 1.2;
    u.mieCoefficient.value = lerp(0.004, 0.02, cl);
    this.sky.position.copy(cam);

    // névoa casa com o horizonte
    const fc = this.fogCol;
    fc.setRGB(0.68, 0.78, 0.9).lerp(new THREE.Color(0.95, 0.62, 0.42), warm * day * (1 - cl));
    fc.lerp(new THREE.Color(0.55, 0.58, 0.62), cl * 0.85);
    fc.multiplyScalar(lerp(0.035, 1, day) * (1 - 0.35 * cl * (this.p.rain > 0.5 ? 1 : 0.4)));
    fc.r += this.flash * 0.5; fc.g += this.flash * 0.5; fc.b += this.flash * 0.6;
    this.scene.fog.color.copy(fc);
    this.drawDist = this.s.get('drawDist');
    this.scene.fog.density = this.p.fog / this.drawDist;

    this.clouds.position.set(cam.x, 650, cam.z);
    const cm = this.clouds.material;
    cm.opacity = 0.15 + 0.85 * cl;
    cm.color.setRGB(1, 1, 1).lerp(new THREE.Color(0.45, 0.47, 0.5), smoothstep(0.6, 1, cl)).lerp(new THREE.Color(1, 0.7, 0.55), warm * day * 0.6).multiplyScalar(lerp(0.06, 1, day) + this.flash);
    cm.map.offset.x += (this.wind.x * dt) / 9000 * 1.5;
    cm.map.offset.y -= (this.wind.y * dt) / 9000 * 1.5;

    this.stars.position.copy(cam);
    this.stars.material.opacity = this.night * (1 - cl);

    // chuva inclinada pelo vento
    const rain = this.p.rain;
    this.rain.visible = rain > 0.02;
    if (this.rain.visible) {
      const arr = this.rain.geometry.attributes.position.array;
      const n = Math.floor(this.RN * rain);
      const fall = 24, wx = this.wind.x * 0.9, wz = this.wind.y * 0.9;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        arr[o] += wx * dt; arr[o + 1] -= fall * dt; arr[o + 2] += wz * dt;
        if (arr[o + 1] < cam.y - 14 || Math.abs(arr[o] - cam.x) > 42 || Math.abs(arr[o + 2] - cam.z) > 42) this.spawnDrop(i, arr, cam, false);
        arr[o + 3] = arr[o] - wx * 0.035; arr[o + 4] = arr[o + 1] + fall * 0.035; arr[o + 5] = arr[o + 2] - wz * 0.035;
      }
      this.rain.geometry.setDrawRange(0, n * 2);
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.material.opacity = 0.2 + 0.25 * day;
    }
    this.wetness = clamp(this.wetness + (rain > 0.15 ? rain * 0.05 : -0.008) * dt, 0, 1);
    for (const wm of this.world.wetMats) wm.m.roughness = lerp(wm.dry, wm.wet, this.wetness);

    if (this.weather === 'storm' && rain > 0.85 && Math.random() < dt * 0.09) {
      this.flash = 1;
      const delay = 0.6 + Math.random() * 3;
      setTimeout(() => this.onThunder && this.onThunder(), delay * 1000);
    }

    // luzes artificiais e água
    const lit = smoothstep(0.25, 0.75, this.night + cl * 0.35);
    this.world.lampMat.emissiveIntensity = lit * 6;
    for (const m of this.world.facadeMats) m.emissiveIntensity = lit * 1.4;
    if (this.world.signMat) this.world.signMat.emissiveIntensity = 0.25 + lit * 1.5;
    this.lightsOn = lit > 0.3 || this.p.fog > 0.003 || rain > 0.5;
    const wu = this.world.waterU;
    wu.uSunDir.value.copy(lightDir);
    wu.uSunCol.value.copy(sunCol).multiplyScalar(li / 3.2);
    wu.uSky.value.setRGB(0.25, 0.45, 0.8).lerp(new THREE.Color(0.5, 0.52, 0.55), cl).multiplyScalar(lerp(0.03, 1, day));
    wu.uHorizon.value.copy(fc);
    wu.uFogCol.value.copy(fc);
    wu.uFogD.value = this.scene.fog.density;
    wu.uNight.value = this.night;
    wu.uRain.value = rain;
    this.renderer.toneMappingExposure = lerp(0.95, 0.62, day);

    this.envTimer -= dt;
    if (this.envTimer <= 0) {
      this.envTimer = 3;
      this.envCloud.material.opacity = smoothstep(0.4, 1, cl) * 0.85;
      this.envCloud.material.color.setRGB(0.6, 0.62, 0.65).multiplyScalar(lerp(0.02, 1, day));
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = lerp(0.12, 1, day);
    }
  }

  clock() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
