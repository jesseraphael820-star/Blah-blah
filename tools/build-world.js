const fs = require('fs');
const topo = require('world-atlas/countries-50m.json');
const { feature } = require('topojson-client');
const iso = require('i18n-iso-countries');
iso.registerLocale(require('i18n-iso-countries/langs/pt.json'));
const GW = 400, STEP = 0.9, LAT0 = 84, GH = Math.round((84 + 58) / STEP);
const feats = feature(topo, topo.objects.countries).features.filter(f => f.id !== '010' && f.properties.name !== 'Antarctica');
const OVR = { US:'Estados Unidos', RU:'Rússia', GB:'Reino Unido', CD:'RD Congo', CG:'Congo', CF:'Rep. Centro-Africana', KP:'Coreia do Norte', KR:'Coreia do Sul', IR:'Irã', SY:'Síria', VE:'Venezuela', BO:'Bolívia', TZ:'Tanzânia', LA:'Laos', VN:'Vietnã', MD:'Moldávia', MK:'Macedônia do Norte', PS:'Palestina', TW:'Taiwan', CZ:'Tchéquia', DO:'Rep. Dominicana', BA:'Bósnia', FM:'Micronésia', VA:'Vaticano', BN:'Brunei', CI:'Costa do Marfim', SZ:'Essuatíni', GM:'Gâmbia', TL:'Timor-Leste', YE:'Iêmen', RO:'Romênia', PL:'Polônia', KE:'Quênia', GL:'Groenlândia', MG:'Madagascar', SI:'Eslovênia', LV:'Letônia', EE:'Estônia', MU:'Maurício', KW:'Kuwait', AM:'Armênia', MM:'Mianmar', QA:'Catar', BJ:'Benin', NC:'Nova Caledônia' };
const DEP = { US:'AS GU MP VI PR UM', GB:'GS IO SH PN AI KY BM VG TC MS JE IM GG FK', FR:'BL MF PM WF PF TF', FI:'AX', DK:'FO', NL:'AW CW SX', AU:'HM NF CX CC', NZ:'CK NU', CN:'MO HK' };
const DEPOF = {}; for (const k in DEP) for (const d of DEP[k].split(' ')) DEPOF[d] = k;
const NONAME = { 'Kosovo':['Kosovo','XK'], 'N. Cyprus':['Chipre do Norte',null], 'Somaliland':['Somalilândia',null] };
const C = [];
for (const f of feats) {
  let a2 = f.id ? iso.numericToAlpha2(f.id) : null, name;
  if (NONAME[f.properties.name]) [name, a2] = NONAME[f.properties.name];
  else name = (a2 && (OVR[a2] || iso.getName(a2, 'pt'))) || f.properties.name;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = polys.flat().map(r => { let mn = 1e9, mxx = -1e9; for (const [x] of r) { mn = Math.min(mn, x); mxx = Math.max(mxx, x); } return mxx - mn > 180 ? r.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : r; });
  let bb = [1e9, 1e9, -1e9, -1e9], big = null, bigA = -1;
  for (const r of rings) { let a = 0; for (let i = 0; i < r.length; i++) { const [x, y] = r[i]; bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); const [x2, y2] = r[(i + 1) % r.length]; a += x * y2 - x2 * y; } if (Math.abs(a) > bigA) { bigA = Math.abs(a); big = r; } }
  C.push({ name, a2, rings, bb, big });
}
const owner = new Int16Array(GW * GH).fill(-1);
function inside(rings, x, y) { let c = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
for (let y = 0; y < GH; y++) { const lat = LAT0 - (y + .5) * STEP; for (let x = 0; x < GW; x++) { const lon = -180 + (x + .5) * STEP;
  let hit = -1; for (let k = 0; k < C.length && hit < 0; k++) { const b = C[k].bb; for (const L of [lon, lon + 360]) { if (L < b[0] || L > b[2] || lat < b[1] || lat > b[3]) continue; if (inside(C[k].rings, L, lat)) { hit = k; break; } } } owner[y * GW + x] = hit; } }
const byA2 = {}; C.forEach((c, k) => { if (c.a2 && !(c.a2 in byA2) && !DEPOF[c.a2]) byA2[c.a2] = k; });
const remap = C.map((c, k) => { if (c.name === 'Indian Ocean Ter.' || (c.a2 === 'AU' && byA2.AU !== k)) return byA2.AU; return DEPOF[c.a2] ? byA2[DEPOF[c.a2]] : k; });
const cnt = new Array(C.length).fill(0); for (const o of owner) if (o >= 0) cnt[o]++;
for (let k = 0; k < C.length; k++) if (!cnt[k] && remap[k] === k) {
  const r = C[k].big; let sx = 0, sy = 0; for (const [x, y] of r) { sx += x; sy += y; } sx /= r.length; sy /= r.length;
  const cx = Math.floor((sx + 180) / STEP), cy = Math.floor((LAT0 - sy) / STEP);
  if (cx >= 0 && cy >= 0 && cx < GW && cy < GH && owner[cy * GW + cx] < 0) { owner[cy * GW + cx] = k; cnt[k] = 1; }
}
for (let i = 0; i < owner.length; i++) if (owner[i] >= 0) owner[i] = remap[owner[i]];
cnt.fill(0); for (const o of owner) if (o >= 0) cnt[o]++;
// reindexa países sem células
const map = new Array(C.length).fill(-1), keep = []; C.forEach((c, k) => { if (cnt[k]) { map[k] = keep.length; keep.push(c); } });
const runs = []; let cur = null, len = 0;
for (const o of owner) { const v = o < 0 ? 0 : map[o] + 1; if (v === cur) len++; else { if (cur !== null) runs.push(cur, len); cur = v; len = 1; } } runs.push(cur, len);
const svgs = keep.map(c => { const p = c.a2 && `${__dirname}/node_modules/flag-icons/flags/4x3/${c.a2.toLowerCase()}.svg`; return p && fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; });
(async () => {
  const { chromium } = require('playwright'); const b = await chromium.launch(); const pg = await b.newPage();
  const flags = await pg.evaluate(async svgs => { const out = []; for (const s of svgs) { if (!s) { out.push(null); continue; }
    const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s))); await img.decode().catch(() => {});
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 32; const x = cv.getContext('2d'); x.drawImage(img, 0, 0, 48, 32); out.push(cv.toDataURL('image/png')); } return out; }, svgs);
  await b.close();
  const W = { gw: GW, gh: GH, step: STEP, lat0: LAT0, runs, countries: keep.map((c, i) => ({ n: c.name, a: c.a2 || '', f: flags[i] })) };
  fs.writeFileSync(__dirname + '/../world-data.js', 'const WORLD = ' + JSON.stringify(W) + ';\n');
  console.log('countries', keep.length, 'dropped', C.length - keep.length, 'runs', runs.length / 2, 'bytes', fs.statSync('world.js').size, 'noflag', keep.filter((c, i) => !flags[i]).map(c => c.name));
  console.log(keep.map((c, k) => c.name + ':' + cnt[C.indexOf(c)]).join(', '));
})();
