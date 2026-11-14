// Verifica que não há linha de visão direta entre os spawns T e CT.
import { World, MAP_ORDER } from '../js/maps.js';
let bad = 0;
for (const id of MAP_ORDER) { const w = new World(id); let n = 0;
  for (const a of w.spawns.T) for (const b of w.spawns.CT) if (w.los(a.x, 1.6, a.z, b.x, 1.6, b.z)) { n++; }
  console.log(id, n ? `LOS spawn-spawn: ${n}` : 'ok'); bad += n; }
process.exit(bad ? 1 : 0);
