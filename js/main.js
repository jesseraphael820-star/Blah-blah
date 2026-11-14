// Motor: renderer, cenas de lobby / inspeção 3D, loop principal e troca de modos.
import * as THREE from '../vendor/three.min.js';
import { QUALITY } from './maps.js';
import { mapTexture, softSprite, skyTexture } from './textures.js';
import { buildCharacter } from './models.js';
import { Controls } from './controls.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { loadSave, save } from './save.js';
import { initAudio, setVolume, sfx } from './audio.js';
import { RARITY } from './data.js';

loadSave();
const canvas = document.getElementById('gl');
const isTouch = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

const engine = {
  renderer, q: QUALITY[save.settings.graphics], mode: 'lobby', game: null, hudRoot: document.getElementById('hud'),
  applyGraphics() {
    this.q = QUALITY[save.settings.graphics] || QUALITY.medio;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.q.pr)); renderer.setSize(innerWidth, innerHeight, false);
    renderer.shadowMap.enabled = this.q.shadow > 0; renderer.shadowMap.type = this.q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (this.game) this.game.q = this.q;
  },
  openSettings() { ui.show('settings'); },
  startGame(opts) {
    initAudio(); setVolume(save.settings.volume); this.applyGraphics();
    ui.hide(); lobby.cam.clearViewOffset();
    this.game = new Game(this, opts, { onEnd: r => this.endGame(r) });
    this.mode = 'game'; this.controls.setEnabled(true);
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  },
  endGame(result) {
    this.controls.setEnabled(false); this.game.destroy(); this.game = null; this.mode = 'lobby'; lobby.refresh();
    ui.finishMatch(result);
  },
  inspect(obj, rarity) { inspect.set(obj, rarity); this.mode = obj ? 'inspect' : 'lobby'; },
  lobbyRefresh() { lobby.refresh(); },
};
engine.controls = new Controls(document.getElementById('touch'), a => engine.game?.action(a));
engine.controls.setEnabled(false);

// ---------- Lobby 3D ----------
const lobby = (() => {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  scene.background = new THREE.Color(0x10151c); scene.fog = new THREE.Fog(0x1a222c, 9, 46);
  scene.add(new THREE.HemisphereLight(0xa8c4f0, 0x4a3a30, 2.2)); const fill = new THREE.DirectionalLight(0xffe2c0, 2.6); fill.position.set(2, 3, 6); scene.add(fill);
  const key = new THREE.SpotLight(0xffd9a8, 260, 30, 0.5, 0.5, 1.6); key.position.set(4, 6.5, 5); key.target.position.set(0, 1, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x4aa8ff, 2.4); rim.position.set(-5, 4, -6); scene.add(rim);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: (() => { const t = mapTexture('concreteDark').clone(); t.repeat.set(40, 40); t.needsUpdate = true; return t; })(), roughness: 0.6, metalness: 0.2 }));
  fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 16, 10), new THREE.MeshBasicMaterial({ map: skyTexture('#070b12', '#1b2a3d', '#d0703a'), side: THREE.BackSide, fog: false })); scene.add(sky);
  const prop = (w, h, d, tex, x, z, ry = 0, y = 0) => { const t = mapTexture(tex).clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(Math.max(w, d) / 2.6)), Math.max(1, Math.round(h / 2.6))); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: tex.startsWith('cont') ? 0.4 : 0 })); m.position.set(x, y + h / 2, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  prop(6, 2.6, 2.5, 'contBlue', -5.5, -6, 0.25); prop(6, 2.6, 2.5, 'contRed', -5.2, -6.2, 0.2, 2.6); prop(6, 2.6, 2.5, 'contGreen', 5, -8, -0.35); prop(6, 2.6, 2.5, 'contYellow', 11, -5, -1.2);
  prop(1.2, 1.2, 1.2, 'wood', 2.6, -1.6, 0.4); prop(0.9, 0.9, 0.9, 'wood', 2.5, -1.5, 0.9, 1.2); prop(1.4, 1.4, 1.4, 'wood', -2.9, -2.4, -0.3); prop(3.4, 1.0, 0.8, 'sandbag', -1.2, -3.6, 0.1); prop(3, 1.0, 0.8, 'sandbag', 4.4, -3.2, -0.5);
  prop(14, 12, 6, 'concreteDark', -14, -22, 0.2); prop(10, 16, 8, 'plasterBlue', 2, -30, 0); prop(16, 9, 6, 'brickDark', 18, -20, -0.4); prop(0.3, 7, 0.3, 'metal', 7, -4, 0); prop(0.3, 7, 0.3, 'metal', -8, -9, 0);
  for (const [x, z] of [[7, -4], [-8, -9]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); b.position.set(x, 7, z + 0.3); scene.add(b); const l = new THREE.PointLight(0xffb060, 60, 18, 1.8); l.position.set(x, 6.5, z + 0.5); scene.add(l); }
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.14, 40), new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.35, metalness: 0.8 })); plat.position.y = 0.07; plat.receiveShadow = true; scene.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.025, 8, 60), new THREE.MeshBasicMaterial({ color: 0xff8a1e })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; scene.add(ring);
  let ch = null, t = 0;
  cam.position.set(0, 1.3, 4.5); cam.lookAt(0, 1.0, 0);
  return {
    scene, cam,
    refresh() {
      if (ch) scene.remove(ch);
      const sk = save.equipped.skins, fav = Object.keys(sk)[0] || 'm4a4';
      ch = buildCharacter('CT', fav, sk[fav] || 'padrao', true); ch.position.y = 0.14; ch.rotation.y = -0.45; scene.add(ch);
    },
    update(dt) {
      t += dt; if (!ch) return; const u = ch.userData;
      u.body.position.y = Math.sin(t * 1.6) * 0.008; u.body.rotation.y = Math.sin(t * 0.5) * 0.06; u.head.rotation.y = Math.sin(t * 0.37) * 0.25; ch.rotation.y = -0.45 + Math.sin(t * 0.25) * 0.12;
      ring.material.color.setHSL(0.07, 1, 0.5 + Math.sin(t * 2) * 0.1);
    },
    render() {
      const w = innerWidth, h = innerHeight; cam.aspect = w / h; cam.setViewOffset(w, h, -w * 0.1, 0, w, h); cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    },
  };
})();

// ---------- Inspeção 3D de itens ----------
const inspect = (() => {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  scene.background = new THREE.Color(0x0b0f15);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x30343c, 1.5));
  const k = new THREE.DirectionalLight(0xffffff, 3); k.position.set(2, 3, 4); scene.add(k);
  const r = new THREE.DirectionalLight(0x66aaff, 2); r.position.set(-3, 1, -3); scene.add(r);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: 0xff8a1e, transparent: true, opacity: 0.35, depthWrite: false })); glow.scale.setScalar(2.6); glow.position.z = -1; scene.add(glow);
  const pivot = new THREE.Group(); scene.add(pivot);
  cam.position.set(0, 0, 3.2);
  let obj = null, yaw = -0.6, pitch = 0.15, drag = false, idle = 0, t = 0, zoom = 1;
  const zone = document.getElementById('inspect-zone');
  zone.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; zone.setPointerCapture(e.pointerId); });
  zone.addEventListener('pointermove', e => { if (!drag) return; yaw += (e.clientX - drag.x) * 0.012; pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - drag.y) * 0.008)); drag = { x: e.clientX, y: e.clientY }; idle = 0; });
  for (const ev of ['pointerup', 'pointercancel']) zone.addEventListener(ev, () => { drag = false; });
  zone.addEventListener('wheel', e => { zoom = Math.max(0.6, Math.min(1.8, zoom - e.deltaY * 0.001)); });
  return {
    set(o, rarity) {
      if (obj) pivot.remove(obj); obj = o; zone.style.display = o ? 'block' : 'none'; if (!o) return;
      const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3()), sc = 0.85 / Math.max(s.x, s.y, s.z);
      o.position.sub(c); const holder = new THREE.Group(); holder.add(o); holder.scale.setScalar(sc); pivot.add(holder); obj = holder;
      glow.material.color.set(RARITY[rarity]?.color || '#ff8a1e'); yaw = -0.9; pitch = 0.12; idle = 2; zoom = 1;
    },
    render(dt) {
      t += dt; idle += dt; if (idle > 1.5 && !drag) yaw += dt * 0.5;
      pivot.rotation.set(pitch, yaw + Math.PI / 2, 0); pivot.position.y = Math.sin(t * 1.3) * 0.02; pivot.scale.setScalar(zoom);
      pivot.traverse(m => { if (m.material?.userData?.fancy) m.material.emissiveIntensity = 0.25 + Math.sin(t * 3) * 0.15; });
      const w = innerWidth, h = innerHeight; cam.aspect = w / h; cam.setViewOffset(w, h, -w * 0.29, h * 0.13, w, h); cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    },
  };
})();

const ui = new UI(engine);
engine.ui = ui;

function resize() { engine.applyGraphics(); engine.game?.onResize(); engine.controls.applyLayout(); }
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
addEventListener('pointerdown', () => { initAudio(); setVolume(save.settings.volume); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && engine.game && !engine.game.paused && engine.game.phase !== 'over') engine.game.hud.togglePause(true); });
window.addEventListener('contextmenu', e => { if (engine.mode === 'game') e.preventDefault(); });

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (engine.mode === 'game' && engine.game) { engine.game.update(dt); engine.game?.render(); }
  else if (engine.mode === 'inspect') inspect.render(dt);
  else { lobby.update(dt); lobby.render(); }
}
resize(); lobby.refresh(); ui.boot();
requestAnimationFrame(frame);
window.__engine = engine; // depuração / testes
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
export { sfx };
