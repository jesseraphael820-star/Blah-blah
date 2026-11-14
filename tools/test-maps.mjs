// Valida navegação dos mapas: spawns -> bombsites conectados. Uso: node tools/test-maps.mjs [-v]
import { World, MAP_ORDER } from '../js/maps.js';
let ok = true;
for (const id of MAP_ORDER) {
  const w = new World(id);
  const T = w.spawns.T, CT = w.spawns.CT;
  const chk = (n, a, b) => { const p = w.findPath(a.x, a.z, b.x, b.z); if (!p) { ok = false; console.log(`FALHA ${id}: ${n}`); } return p; };
  for (const s of [...T, ...CT]) if (!w.isFree(s.x, s.z)) { ok = false; console.log(`FALHA ${id}: spawn bloqueado`, s); }
  for (const k of ['A', 'B']) { if (!w.isFree(w.sites[k].x, w.sites[k].z)) { ok = false; console.log(`FALHA ${id}: site ${k} bloqueado`); } chk('T->' + k, T[2], w.sites[k]); chk('CT->' + k, CT[2], w.sites[k]); }
  chk('T->CT', T[0], CT[4]);
  // toda célula livre deve ser alcançável
  let unreachable = 0; for (const k of w.free) { const c = w.cellPos(k); if (!w.findPath(T[2].x, T[2].z, c.x, c.z)) unreachable++; }
  if (unreachable) { ok = false; console.log(`FALHA ${id}: ${unreachable} células isoladas`); }
  console.log(`${id}: ${w.boxes.length} blocos, ${w.free.length} células livres`);
  if (process.argv.includes('-v')) { for (let j = 0; j < 60; j++) { let r = ''; for (let i = 0; i < 60; i++) r += w.blocked[i + j * 60] ? '#' : '.'; console.log(r); } }
}
console.log(ok ? 'OK' : 'ERROS'); process.exit(ok ? 0 : 1);
