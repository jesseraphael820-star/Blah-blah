// Mapa de tiles com objetos, colisão, grade espacial e renderização em chunks (cache LRU).
import { TILE, hash2 } from '../core/util.js';
import { T, TILE_INFO, tileBuf, waterFrame, isWaterTile, VARIANTS, FOAM, WATER_FRAMES } from '../gfx/tiles.js';
import { makeCanvas, hexToRgb } from '../gfx/canvas.js';

const CHUNK = 32, CELL = 128;

export class GameMap {
  constructor(id, w, h, opts = {}) {
    this.id = id; this.w = w; this.h = h;
    this.tiles = new Uint8Array(w * h).fill(opts.fill ?? T.GRASS);
    this.region = new Uint8Array(w * h).fill(opts.region ?? 1);
    this.block = new Uint8Array(w * h); // bloqueio por objetos grandes (construções)
    this.objects = []; this.grid = new Map();
    this.interior = !!opts.interior; this.dark = opts.dark || 0; this.style = opts.region ?? 1;
    this.music = opts.music || null; this.name = opts.name || id;
    this.markers = {}; this.doors = []; this.lights = [];
    this.chunks = new Map(); this.chunkOrder = [];
    this.exitTo = opts.exitTo || null;
  }
  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inb(x, y) ? this.tiles[y * this.w + x] : T.VOID; }
  set(x, y, t) { if (this.inb(x, y)) this.tiles[y * this.w + x] = t; }
  reg(x, y) { return this.inb(x, y) ? this.region[y * this.w + x] : this.style; }
  tileAtPx(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)); }
  regionAtPx(px, py) { return this.reg(Math.floor(px / TILE), Math.floor(py / TILE)); }
  solidTile(tx, ty) { if (!this.inb(tx, ty)) return true; const t = this.tiles[ty * this.w + tx]; return TILE_INFO[t].solid || this.block[ty * this.w + tx] === 1; }
  walkable(tx, ty) { return !this.solidTile(tx, ty); }

  addObject(o) {
    this.objects.push(o);
    const k = this.cellKey(o.x, o.y);
    let arr = this.grid.get(k); if (!arr) this.grid.set(k, (arr = [])); arr.push(o);
    o.map = this;
    if (o.light) this.lights.push(o);
    return o;
  }
  removeObject(o) {
    const i = this.objects.indexOf(o); if (i >= 0) this.objects.splice(i, 1);
    const arr = this.grid.get(this.cellKey(o.x, o.y)); if (arr) { const j = arr.indexOf(o); if (j >= 0) arr.splice(j, 1); }
    const l = this.lights.indexOf(o); if (l >= 0) this.lights.splice(l, 1);
    o.removed = true;
  }
  cellKey(x, y) { return (Math.floor(x / CELL) & 0xffff) | ((Math.floor(y / CELL) & 0xffff) << 16); }
  objectsIn(x0, y0, x1, y1, out = []) {
    const cx0 = Math.floor(x0 / CELL) - 1, cy0 = Math.floor(y0 / CELL) - 1, cx1 = Math.floor(x1 / CELL) + 1, cy1 = Math.floor(y1 / CELL) + 2;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const arr = this.grid.get((cx & 0xffff) | ((cy & 0xffff) << 16));
      if (arr) for (const o of arr) out.push(o);
    }
    return out;
  }
  // colisão AABB contra tiles sólidos e caixas de objetos
  collides(x, y, w, h, ignore) {
    const tx0 = Math.floor(x / TILE), ty0 = Math.floor(y / TILE), tx1 = Math.floor((x + w - 0.01) / TILE), ty1 = Math.floor((y + h - 0.01) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.solidTile(tx, ty)) return true;
    tmpArr.length = 0; const near = this.objectsIn(x - 64, y - 64, x + w + 64, y + h + 64, tmpArr);
    for (const o of near) {
      if (!o.box || o === ignore || o.removed || o.passable) continue;
      const bx = o.x + o.box.x, by = o.y + o.box.y;
      if (x < bx + o.box.w && x + w > bx && y < by + o.box.h && y + h > by) return o;
    }
    return false;
  }
  // linha de visão simples (para IA)
  lineClear(x0, y0, x1, y1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
    for (let i = 1; i < steps; i++) { const t = i / steps; const tx = Math.floor((x0 + (x1 - x0) * t) / TILE), ty = Math.floor((y0 + (y1 - y0) * t) / TILE); const tt = this.get(tx, ty); if (TILE_INFO[tt].solid && !TILE_INFO[tt].water) return false; }
    return true;
  }
  findWalkableNear(tx, ty, maxR = 20) {
    for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = tx + dx, y = ty + dy;
      if (this.walkable(x, y) && this.walkable(x + 1, y) && this.walkable(x, y + 1) && !this.collides(x * TILE + 2, y * TILE + 2, 12, 12)) return [x, y];
    }
    return [tx, ty];
  }
  invalidate(tx0, ty0, tx1, ty1) {
    for (let cy = Math.floor(ty0 / CHUNK); cy <= Math.floor(ty1 / CHUNK); cy++) for (let cx = Math.floor(tx0 / CHUNK); cx <= Math.floor(tx1 / CHUNK); cx++) this.chunks.delete(cx + ',' + cy);
  }
  invalidateAll() { this.chunks.clear(); this.chunkOrder = []; }

  // ---------- Renderização ----------
  bakeChunk(cx, cy) {
    const c = makeCanvas(CHUNK * TILE, CHUNK * TILE);
    const img = c.ctx.createImageData(CHUNK * TILE, CHUNK * TILE), d = img.data, W = CHUNK * TILE;
    const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
    const foam = hexToRgb(FOAM);
    for (let ly = 0; ly < CHUNK; ly++) for (let lx = 0; lx < CHUNK; lx++) {
      const tx = tx0 + lx, ty = ty0 + ly;
      if (!this.inb(tx, ty)) continue;
      const t = this.get(tx, ty), reg = this.reg(tx, ty);
      const ox = lx * TILE, oy = ly * TILE;
      if (isWaterTile(t)) {
        // espuma/beira nas bordas com terra
        const land = [!isWaterTile(this.get(tx, ty - 1)), !isWaterTile(this.get(tx - 1, ty)), !isWaterTile(this.get(tx + 1, ty)), !isWaterTile(this.get(tx, ty + 1))];
        for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
          const n = hash2(tx * 16 + px, ty * 16 + py, 5);
          const e = Math.min(land[0] ? py : 99, land[1] ? px : 99, land[2] ? 15 - px : 99, land[3] ? 15 - py : 99);
          if (e < 99) {
            const i = ((oy + py) * W + ox + px) * 4;
            if (e === 0) { d[i] = 40; d[i + 1] = 50; d[i + 2] = 40; d[i + 3] = 110; }
            else if (e === 1 || (e === 2 && n < 0.5)) { d[i] = foam[0]; d[i + 1] = foam[1]; d[i + 2] = foam[2]; d[i + 3] = t === T.SWAMPW ? 60 : 150; }
          }
        }
        continue;
      }
      const v = Math.floor(hash2(tx, ty, 99) * VARIANTS);
      let face = false;
      if (t === T.CLIFF || t === T.WALL || t === T.CAVEW) { const s = this.get(tx, ty + 1); face = s !== t && s !== T.VOID; }
      const src = tileBuf(t, reg, v, face);
      for (let py = 0; py < 16; py++) {
        const si = py * 64, di = ((oy + py) * W + ox) * 4;
        for (let k = 0; k < 64; k++) d[di + k] = src[si + k];
      }
      // transições suaves: vizinhos com prioridade maior invadem as bordas
      const myP = TILE_INFO[t].prio;
      if (t === T.CLIFF || t === T.WALL || t === T.CAVEW || t === T.VOID) continue;
      const nb = [[0, -1], [-1, 0], [1, 0], [0, 1]];
      for (let k = 0; k < 4; k++) {
        const nx = tx + nb[k][0], ny = ty + nb[k][1], nt = this.get(nx, ny);
        if (nt === t || nt === T.VOID) continue;
        const ni = TILE_INFO[nt];
        if (ni.water) {
          // margem úmida
          for (let p = 0; p < 16; p++) {
            const px = k === 1 ? 0 : k === 2 ? 15 : p, py = k === 0 ? 0 : k === 3 ? 15 : p;
            const i = ((oy + py) * W + ox + px) * 4; d[i] *= 0.72; d[i + 1] *= 0.72; d[i + 2] *= 0.75;
          }
          continue;
        }
        if (ni.solid || ni.prio <= myP) continue;
        const nsrc = tileBuf(nt, this.reg(nx, ny), Math.floor(hash2(nx, ny, 99) * VARIANTS));
        for (let p = 0; p < 16; p++) {
          const depth = 1 + Math.floor(hash2(tx * 31 + p, ty * 17 + k, 13) * 3.2);
          for (let q = 0; q < depth; q++) {
            const px = k === 1 ? q : k === 2 ? 15 - q : p, py = k === 0 ? q : k === 3 ? 15 - q : p;
            const si = (py * 16 + px) * 4, di = ((oy + py) * W + ox + px) * 4;
            d[di] = nsrc[si]; d[di + 1] = nsrc[si + 1]; d[di + 2] = nsrc[si + 2]; d[di + 3] = 255;
          }
        }
      }
    }
    c.ctx.putImageData(img, 0, 0);
    return c;
  }
  getChunk(cx, cy) {
    const k = cx + ',' + cy;
    let c = this.chunks.get(k);
    if (!c) {
      c = this.bakeChunk(cx, cy); this.chunks.set(k, c);
      this.chunkOrder.push(k);
      if (this.chunkOrder.length > 20) { const old = this.chunkOrder.shift(); if (old !== k) this.chunks.delete(old); }
    }
    return c;
  }
  drawGround(ctx, camX, camY, vw, vh, time) {
    const tx0 = Math.max(0, Math.floor(camX / TILE)), ty0 = Math.max(0, Math.floor(camY / TILE));
    const tx1 = Math.min(this.w - 1, Math.floor((camX + vw) / TILE)), ty1 = Math.min(this.h - 1, Math.floor((camY + vh) / TILE));
    const frame = Math.floor(time * 4) % WATER_FRAMES;
    if (this.interior) { ctx.fillStyle = '#0c0a10'; ctx.fillRect(0, 0, vw, vh); }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = this.tiles[ty * this.w + tx];
      if (isWaterTile(t)) ctx.drawImage(waterFrame(t, this.reg(tx, ty), frame, tx, ty, makeCanvas), Math.round(tx * TILE - camX), Math.round(ty * TILE - camY));
    }
    const S = CHUNK * TILE;
    for (let cy = Math.floor(camY / S); cy <= Math.floor((camY + vh) / S); cy++) for (let cx = Math.floor(camX / S); cx <= Math.floor((camX + vw) / S); cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK >= this.w || cy * CHUNK >= this.h) continue;
      ctx.drawImage(this.getChunk(cx, cy), Math.round(cx * S - camX), Math.round(cy * S - camY));
    }
  }
}
const tmpArr = [];
