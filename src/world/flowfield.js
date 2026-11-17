// Campo de fluxo (Dijkstra com fila de baldes) usado pela polícia para perseguir
// e procurar o jogador pela malha da cidade, contornando prédios.

import { T, MAP, TT } from './constants.js';

const INF = 65535;

export class FlowField {
  constructor(city, mode) {
    this.city = city;
    this.dist = new Uint16Array(MAP * MAP).fill(INF);
    this.cost = new Uint8Array(MAP * MAP);
    this.tx = -1; this.ty = -1;
    for (let i = 0; i < MAP * MAP; i++) {
      const t = city.type[i];
      let c = 0;
      if (mode === 'drive') {
        c = t === TT.ROAD ? 1 : t === TT.PARKING || t === TT.LOT || t === TT.DOCK || t === TT.PLAZA ? 2 : t === TT.SIDEWALK ? 3 : t === TT.GRASS ? 4 : 0;
      } else {
        c = t === TT.SIDEWALK || t === TT.PLAZA || t === TT.DOCK ? 1 : t === TT.ROAD || t === TT.GRASS || t === TT.PARKING || t === TT.LOT ? 1 : 0;
      }
      this.cost[i] = c;
    }
    this.buckets = [[], [], [], [], []];
  }

  compute(tx, ty, maxD = 900) {
    if (tx === this.tx && ty === this.ty) return;
    this.tx = tx; this.ty = ty;
    const d = this.dist, cost = this.cost;
    d.fill(INF);
    if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) return;
    const B = this.buckets;
    for (const b of B) b.length = 0;
    const s = ty * MAP + tx;
    d[s] = 0; B[0].push(s);
    let count = 1, cur = 0;
    while (count > 0 && cur <= maxD) {
      const b = B[cur % 5];
      while (b.length) {
        const i = b.pop(); count--;
        if (d[i] !== cur) continue;
        const x = i % MAP;
        // vizinhos 4-direções
        if (x > 0) this.relax(i - 1, cur, d, cost, B) && count++;
        if (x < MAP - 1) this.relax(i + 1, cur, d, cost, B) && count++;
        if (i >= MAP) this.relax(i - MAP, cur, d, cost, B) && count++;
        if (i < MAP * (MAP - 1)) this.relax(i + MAP, cur, d, cost, B) && count++;
      }
      cur++;
    }
  }

  relax(n, cur, d, cost, B) {
    const c = cost[n];
    if (!c) return false;
    const nd = cur + c;
    if (nd < d[n]) { d[n] = nd; B[nd % 5].push(n); return true; }
    return false;
  }

  at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) return INF;
    return this.dist[ty * MAP + tx];
  }

  // Ponto alvo seguindo o gradiente descendente `steps` tiles à frente.
  aim(wx, wy, steps = 3) {
    let tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (this.at(tx, ty) === INF) return null;
    let ax = 0, ay = 0, n = 0;
    for (let s = 0; s < steps; s++) {
      let best = this.at(tx, ty), bx = tx, by = ty;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const v = this.at(tx + dx, ty + dy);
        if (v < best) { best = v; bx = tx + dx; by = ty + dy; }
      }
      if (bx === tx && by === ty) break;
      tx = bx; ty = by;
      ax += (tx + 0.5) * T; ay += (ty + 0.5) * T; n++;
    }
    if (!n) return null;
    // média ponderada para suavizar curvas
    return { x: (tx + 0.5) * T * 0.6 + (ax / n) * 0.4, y: (ty + 0.5) * T * 0.6 + (ay / n) * 0.4 };
  }
}
