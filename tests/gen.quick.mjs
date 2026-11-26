import './shim.js';
import { generateWorld } from '../src/world/gen.js';
const t0 = Date.now();
const m = generateWorld();
console.log('gen ms', Date.now()-t0, 'objects', m.objects.length, 'markers', Object.keys(m.markers).length, 'doors', m.doors.length);
const counts = {}; for (const t of m.tiles) counts[t]=(counts[t]||0)+1; console.log(JSON.stringify(counts));
