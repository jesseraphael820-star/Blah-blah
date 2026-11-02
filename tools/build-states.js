// Gera a grade de estados/províncias (admin-1) para cada país de world-data.js
const fs = require('fs');
const iso = require('i18n-iso-countries');
const OUT = process.argv[2] || __dirname + '/../world-data.js';
const src = fs.readFileSync(OUT, 'utf8');
const WORLD = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const { gw: GW, gh: GH, step: STEP, lat0: LAT0 } = WORLD;
const owner = new Int16Array(GW * GH); let k = 0;
for (let r = 0; r < WORLD.runs.length; r += 2) for (let j = 0; j < WORLD.runs[r + 1]; j++) owner[k++] = WORLD.runs[r] - 1;
const byA2 = {}; WORLD.countries.forEach((c, i) => { if (c.a) byA2[c.a] = i; });
const geo = JSON.parse(fs.readFileSync(__dirname + '/ne_10m_admin_1_states_provinces.geojson', 'utf8'));
const S = [];
for (const f of geo.features) {
  const p = f.properties;
  let a2 = p.iso_a2 && p.iso_a2 !== '-99' ? p.iso_a2 : iso.alpha3ToAlpha2(p.adm0_a3);
  if (p.adm0_a3 === 'KOS') a2 = 'XK';
  if (!(a2 in byA2) || !f.geometry) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = polys.flat().map(r => { let mn = 1e9, mx = -1e9; for (const [x] of r) { mn = Math.min(mn, x); mx = Math.max(mx, x); } return mx - mn > 180 ? r.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : r; });
  const bb = [1e9, 1e9, -1e9, -1e9];
  for (const r of rings) for (const [x, y] of r) { bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); }
  S.push({ name: p.name_pt || p.name || p.name_en, c: byA2[a2], rings, bb, lon: p.longitude, lat: p.latitude });
}
const per = {}; S.forEach((s, i) => (per[s.c] = per[s.c] || []).push(i));
function inside(rings, x, y) { let c = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const st = new Int32Array(GW * GH).fill(-1);
for (let y = 0; y < GH; y++) { const lat = LAT0 - (y + .5) * STEP; for (let x = 0; x < GW; x++) {
  const i = y * GW + x, o = owner[i]; if (o < 0 || !per[o]) continue;
  const lon = -180 + (x + .5) * STEP;
  outer: for (const si of per[o]) { const b = S[si].bb; for (const L of [lon, lon + 360]) { if (L < b[0] || L > b[2] || lat < b[1] || lat > b[3]) continue; if (inside(S[si].rings, L, lat)) { st[i] = si; break outer; } } }
} }
// células sem estado: estado mais próximo do mesmo país (pelo ponto de rótulo)
for (let i = 0; i < st.length; i++) {
  const o = owner[i]; if (o < 0 || st[i] >= 0 || !per[o]) continue;
  const lon = -180 + (i % GW + .5) * STEP, lat = LAT0 - (((i / GW) | 0) + .5) * STEP; let bd = 1e18;
  for (const si of per[o]) { const d = (S[si].lon - lon) ** 2 + (S[si].lat - lat) ** 2; if (d < bd) { bd = d; st[i] = si; } }
}
const cnt = new Map(); for (const v of st) if (v >= 0) cnt.set(v, (cnt.get(v) || 0) + 1);
// países com 1 estado só não ganham divisão
const statesOf = {}; for (const [si] of cnt) (statesOf[S[si].c] = statesOf[S[si].c] || []).push(si);
const keep = new Map(), list = [];
for (const c in statesOf) if (statesOf[c].length > 1) for (const si of statesOf[c]) { keep.set(si, list.length + 1); list.push({ n: S[si].name, c: +c }); }
const runs = []; let cur = null, len = 0;
for (const v of st) { const t = v >= 0 && keep.has(v) ? keep.get(v) : 0; if (t === cur) len++; else { if (cur !== null) runs.push(cur, len); cur = t; len = 1; } } runs.push(cur, len);
WORLD.states = { runs, list };
fs.writeFileSync(OUT, 'const WORLD = ' + JSON.stringify(WORLD) + ';\n');
console.log('states', list.length, 'countries with states', Object.keys(statesOf).filter(c => statesOf[c].length > 1).length, 'runs', runs.length / 2, 'bytes', fs.statSync(OUT).size);
const br = byA2.BR; console.log(list.filter(s => s.c === br).map(s => s.n).join(', '));
