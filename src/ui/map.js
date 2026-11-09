// Minimap (rotating, round) and full world map with fog of war, markers and fast travel.
import { G } from '../core/context.js';
import { WORLD, WAYSTONES, POIS } from '../data/world.js';
import { t } from '../core/i18n.js';
import { CAVE } from '../world/cave.js';
import { REGIONS, FACTIONS } from '../data/territory.js';

const EXP_N = 80; // fog-of-war grid
export class MapSys {
  constructor(terrainCanvas) {
    this.base = terrainCanvas; // 320x320
    this.explored = new Uint8Array(EXP_N * EXP_N);
    const s = G.state.world.explored;
    if (s) { try { const bin = atob(s); for (let i = 0; i < Math.min(bin.length, this.explored.length); i++) this.explored[i] = bin.charCodeAt(i); } catch { /* ignore */ } }
    this.fog = document.createElement('canvas'); this.fog.width = EXP_N; this.fog.height = EXP_N;
    this.fogDirty = true;
    this.mini = null;
  }
  serialize() {
    let s = '';
    for (let i = 0; i < this.explored.length; i++) s += String.fromCharCode(this.explored[i]);
    G.state.world.explored = btoa(s);
  }
  reveal(x, z, r = 22) {
    const cs = WORLD.size / EXP_N;
    const i0 = Math.floor((x - r + WORLD.half) / cs), i1 = Math.floor((x + r + WORLD.half) / cs);
    const j0 = Math.floor((z - r + WORLD.half) / cs), j1 = Math.floor((z + r + WORLD.half) / cs);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= EXP_N || j >= EXP_N) continue;
      const cx = -WORLD.half + (i + 0.5) * cs, cz = -WORLD.half + (j + 0.5) * cs;
      if ((cx - x) ** 2 + (cz - z) ** 2 > r * r) continue;
      const k = j * EXP_N + i;
      if (!this.explored[k]) { this.explored[k] = 1; this.fogDirty = true; }
    }
  }
  exploredFraction() { let n = 0; for (const v of this.explored) n += v; return n / this.explored.length; }
  updateFog() {
    if (!this.fogDirty) return;
    this.fogDirty = false;
    const c = this.fog.getContext('2d');
    const img = c.createImageData(EXP_N, EXP_N);
    for (let k = 0; k < this.explored.length; k++) { img.data[k * 4] = 12; img.data[k * 4 + 1] = 16; img.data[k * 4 + 2] = 26; img.data[k * 4 + 3] = this.explored[k] ? 0 : 235; }
    c.putImageData(img, 0, 0);
  }

  markers() {
    const out = [];
    const tr = G.state.quests.tracked;
    if (tr) { const tg = G.quests.target(tr); if (tg) out.push({ x: tg.x, z: tg.z, kind: 'quest' }); }
    for (const w of WAYSTONES) if (G.state.world.waystones.includes(w.id)) out.push({ x: w.x, z: w.z, kind: 'way', id: w.id });
    for (const n of G.entities.npcs.list) {
      const mk = G.quests.markerFor(n.id);
      if (mk && n.visible) out.push({ x: n.pos.x, z: n.pos.z, kind: mk.startsWith('turnin') ? 'turnin' : 'offer' });
      else if (n.def.shop && n.visible && !n.def.secret) out.push({ x: n.pos.x, z: n.pos.z, kind: 'shop' });
    }
    return out;
  }

  // ---- minimap ----
  drawMini(cv) {
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height, R = W / 2;
    const P = G.player.pos;
    const yaw = G.cam.yaw;
    c.save();
    c.clearRect(0, 0, W, H);
    c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#0c1018'; c.fillRect(0, 0, W, H);
    c.imageSmoothingEnabled = false;
    const under = G.sky.underground;
    const scale = under ? 2.2 : 1.6; // px per world unit
    c.translate(R, R);
    c.rotate(yaw - Math.PI); // map up = camera forward
    if (!under) {
      const k = WORLD.n / WORLD.size;
      const sx = (P.x + WORLD.half) * k, sz = (P.z + WORLD.half) * k;
      const span = (W / scale) * k;
      c.scale(scale / k, scale / k);
      c.drawImage(this.base, sx - span, sz - span, span * 2, span * 2, -span, -span, span * 2, span * 2);
      this.updateFog();
      const fk = EXP_N / WORLD.size;
      c.scale(k / fk, k / fk);
      const fsx = (P.x + WORLD.half) * fk, fsz = (P.z + WORLD.half) * fk, fsp = (W / scale) * fk;
      if (G.territory) c.drawImage(G.territory.canvas, fsx - fsp, fsz - fsp, fsp * 2, fsp * 2, -fsp, -fsp, fsp * 2, fsp * 2);
      c.drawImage(this.fog, fsx - fsp, fsz - fsp, fsp * 2, fsp * 2, -fsp, -fsp, fsp * 2, fsp * 2);
      c.setTransform(1, 0, 0, 1, 0, 0); c.translate(R, R); c.rotate(yaw - Math.PI);
    } else {
      c.fillStyle = '#2a2632';
      for (const col of G.physics.query(P.x, P.z, 80)) {
        if (col.t !== 'box' || col.y1 < 5) continue;
        c.fillRect((col.x0 - P.x) * scale, (col.z0 - P.z) * scale, (col.x1 - col.x0) * scale, (col.z1 - col.z0) * scale);
      }
    }
    // markers
    for (const m of this.markers()) {
      let dx = (m.x - P.x) * scale, dz = (m.z - P.z) * scale;
      const d = Math.hypot(dx, dz);
      const edge = R - 9;
      if (d > edge) { if (m.kind !== 'quest') continue; dx *= edge / d; dz *= edge / d; }
      this.drawMarker(c, dx, dz, m.kind, -(yaw - Math.PI));
    }
    // enemies nearby
    for (const e of G.entities.enemies.list) {
      if (e.dead) continue;
      const dx = (e.pos.x - P.x) * scale, dz = (e.pos.z - P.z) * scale;
      if (Math.hypot(dx, dz) > R - 6) continue;
      c.fillStyle = e.boss ? '#ff2a4a' : e.aggro ? '#ff5a3a' : '#c84a3a';
      c.fillRect(dx - 2, dz - 2, e.boss ? 6 : 4, e.boss ? 6 : 4);
    }
    c.restore();
    // player arrow (always up, rotates with player relative to camera)
    c.save();
    c.translate(R, R);
    c.rotate(-(G.player.yaw - yaw));
    c.fillStyle = '#ffffff'; c.strokeStyle = '#1a1424'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 5); c.lineTo(0, 2); c.lineTo(-5, 5); c.closePath(); c.stroke(); c.fill();
    c.restore();
    // north indicator
    const th = yaw - Math.PI;
    const nx = R + Math.sin(th) * (R - 10), ny = R - Math.cos(th) * (R - 10);
    c.font = 'bold 11px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#1a1424'; c.fillText('N', nx + 1, ny + 1); c.fillStyle = '#ffc83a'; c.fillText('N', nx, ny);
  }
  drawMarker(c, x, y, kind, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    const col = { quest: '#ffc83a', way: '#4fd0ff', turnin: '#ffc83a', offer: '#ffe08a', shop: '#7affb0' }[kind] || '#fff';
    c.fillStyle = '#1a1424';
    if (kind === 'quest') { c.beginPath(); c.moveTo(0, -7); c.lineTo(6, 0); c.lineTo(0, 7); c.lineTo(-6, 0); c.closePath(); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(0, -5); c.lineTo(4, 0); c.lineTo(0, 5); c.lineTo(-4, 0); c.closePath(); c.fill(); }
    else if (kind === 'way') { c.fillRect(-4, -5, 8, 10); c.fillStyle = col; c.fillRect(-2, -3, 4, 6); }
    else { c.fillRect(-4, -4, 8, 8); c.fillStyle = col; c.fillRect(-2, -2, 4, 4); if (kind === 'turnin' || kind === 'offer') { c.fillStyle = '#1a1424'; c.font = 'bold 9px monospace'; c.fillText(kind === 'turnin' ? '?' : '!', 0, 1); } }
    c.restore();
  }

  // ---- full map ----
  drawFull(cv, view) {
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#0c1018'; c.fillRect(0, 0, W, H);
    const s = Math.min(W, H) / WORLD.size * view.zoom;
    const ox = W / 2 - (view.cx + WORLD.half) * s, oz = H / 2 - (view.cz + WORLD.half) * s;
    c.drawImage(this.base, ox, oz, WORLD.size * s, WORLD.size * s);
    this.updateFog();
    if (G.territory) c.drawImage(G.territory.canvas, ox, oz, WORLD.size * s, WORLD.size * s);
    c.drawImage(this.fog, ox, oz, WORLD.size * s, WORLD.size * s);
    const toS = (x, z) => [ox + (x + WORLD.half) * s, oz + (z + WORLD.half) * s];
    // grid
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let g = -WORLD.half; g <= WORLD.half; g += 64) { const [a] = toS(g, 0); const [, b] = toS(0, g); c.beginPath(); c.moveTo(a, oz); c.lineTo(a, oz + WORLD.size * s); c.stroke(); c.beginPath(); c.moveTo(ox, b); c.lineTo(ox + WORLD.size * s, b); c.stroke(); }
    // discovered POI labels
    c.font = `600 ${Math.max(10, 11 * view.zoom)}px Nunito, sans-serif`; c.textAlign = 'center';
    for (const p of POIS) {
      if (!G.state.world.discovered.includes(p.id)) continue;
      const [x, y] = toS(p.x, p.z);
      c.fillStyle = 'rgba(10,12,20,0.75)';
      const label = t('loc.' + p.id);
      const w = c.measureText(label).width + 10;
      c.fillRect(x - w / 2, y - 22, w, 16);
      c.fillStyle = '#ffe9b8'; c.fillText(label, x, y - 10);
    }
    this.hit = [];
    // territory labels, villages and outposts (clickable)
    if (G.territory) {
      for (const r of REGIONS) {
        const own = G.territory.owner(r.id);
        const [x, y] = toS(r.c[0], r.c[1]);
        c.font = `700 ${Math.max(10, 10 * view.zoom)}px Nunito, sans-serif`;
        const label = t('terr.r.' + r.id);
        c.fillStyle = 'rgba(10,12,20,0.6)';
        const w = c.measureText(label).width + 14;
        c.fillRect(x - w / 2, y + 4, w, 15);
        c.fillStyle = FACTIONS[own].color; c.fillRect(x - w / 2, y + 4, 4, 15);
        c.fillStyle = '#f3ead7'; c.fillText(label, x + 2, y + 15);
        if (r.village) {
          c.fillStyle = '#1a1424'; c.fillRect(x - 9, y - 16, 18, 16);
          c.fillStyle = FACTIONS[own].color; c.fillRect(x - 7, y - 10, 14, 8);
          c.beginPath(); c.moveTo(x - 9, y - 9); c.lineTo(x, y - 18); c.lineTo(x + 9, y - 9); c.fill();
          this.hit.push({ x, y: y - 8, kind: 'region', r });
        }
        if (r.outpost) {
          const [ox2, oy2] = toS(r.outpost[0], r.outpost[1]);
          c.fillStyle = '#1a1424'; c.fillRect(ox2 - 1, oy2 - 14, 3, 15);
          c.fillStyle = FACTIONS[own].color; c.fillRect(ox2 + 2, oy2 - 14, 9, 6);
          this.hit.push({ x: ox2, y: oy2 - 7, kind: 'region', r });
        }
      }
    }
    for (const m of this.markers()) {
      const [x, y] = toS(m.x, m.z);
      c.save(); c.scale(1.4, 1.4); this.drawMarker(c, x / 1.4, y / 1.4, m.kind, 0); c.restore();
      if (m.kind === 'way') this.hit.push({ x, y, id: m.id, kind: 'way' });
    }
    // player
    const P = G.sky.underground ? { x: 40, z: -186 } : G.player.pos;
    const [px, py] = toS(P.x, P.z);
    c.save(); c.translate(px, py); c.rotate(-G.player.yaw + Math.PI);
    c.fillStyle = '#fff'; c.strokeStyle = '#1a1424'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.stroke(); c.fill();
    c.restore();
    return { s, ox, oz };
  }
}
export { CAVE };
