// Echo Cave: an underground dungeon built from an ASCII layout, placed outside
// the overworld bounds and reached through the mountain entrance portal.
import { G } from '../core/context.js';
import { makeRng, shade } from '../core/utils.js';

export const CAVE = { x0: 630, z0: -60, cell: 4, rows: 30, cols: 36 };
const MAP = [
  '####################################',
  '####.....###########################',
  '###...E...##########.......#########',
  '###.......########.....o.....#######',
  '####.....#########..b.........######',
  '#####..s##########......###....#####',
  '#####...#########..........b...#####',
  '######...######.....###.......######',
  '#######...####..x...###....c..######',
  '#######....b.......#####.....#######',
  '########.......o...######...########',
  '#########...........####...#########',
  '##########...g.......##...##########',
  '##########....###.........##########',
  '#########....#####.....x...#########',
  '########..c..#####..g......#########',
  '########.....######.........########',
  '#########...########...o.....#######',
  '##########.#########.....b....######',
  '##########..########..s......######',
  '###########..######.....###########',
  '############...........#############',
  '##############...x...###############',
  '##############DDDDD#################',
  '###########...........##############',
  '##########..x.......x..#############',
  '##########.....K.......#############',
  '##########..x...P...x..#############',
  '###########...........##############',
  '####################################',
].map((r) => r.padEnd(36, '#').slice(0, 36));

export function cellCenter(r, c) {
  return { x: CAVE.x0 + c * CAVE.cell + CAVE.cell / 2, z: CAVE.z0 + r * CAVE.cell + CAVE.cell / 2 };
}

export function buildCave(W) {
  const B = W;
  const rng = makeRng(404);
  const S = CAVE.cell;
  const x1 = CAVE.x0 + CAVE.cols * S, z1 = CAVE.z0 + CAVE.rows * S;
  G.physics.regions.push({ x0: CAVE.x0, x1, z0: CAVE.z0, z1, h: 0 });
  const out = { spawns: [], chests: [], seal: [], entry: null, boss: null, pedestal: null };
  let chestN = 0;
  for (let r = 0; r < CAVE.rows; r++) {
    // walls as horizontal runs
    let c = 0;
    while (c < CAVE.cols) {
      const ch = MAP[r][c];
      if (ch === '#') {
        let e = c;
        while (e + 1 < CAVE.cols && MAP[r][e + 1] === '#') e++;
        const xa = CAVE.x0 + c * S, xb = CAVE.x0 + (e + 1) * S, za = CAVE.z0 + r * S, zb = za + S;
        const h = 9 + rng() * 4;
        // only draw walls touching floor (others are hidden inside rock)
        let touches = false;
        for (let k = c; k <= e; k++) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = k + dc;
          if (rr >= 0 && rr < CAVE.rows && cc >= 0 && cc < CAVE.cols && MAP[rr][cc] !== '#') touches = true;
        }
        if (touches) {
          B.box(xa, -1, za, xb, h, zb, shade(0x4a4450, 0.85 + rng() * 0.3), { topColor: 0x2a2630, vary: 0.12 });
          // rocky bumps
          for (let k = c; k <= e; k++) if (rng() < 0.5) {
            const bx = CAVE.x0 + k * S + rng() * 2, bz = za + rng() * 2;
            B.box(bx, h - 0.5, bz, bx + 1.5 + rng() * 1.5, h + 1 + rng() * 2, bz + 1.5 + rng(), 0x3a3440);
          }
        }
        B.collider(xa, -2, za, xb, 20, zb);
        c = e + 1;
        continue;
      }
      // floor cell
      const { x, z } = cellCenter(r, c);
      const fc = (r + c) % 2 ? 0x3a3644 : 0x34303e;
      B.box(x - S / 2, -1, z - S / 2, x + S / 2, 0, z + S / 2, shade(fc, 0.9 + rng() * 0.2), { vary: 0.1 });
      if (ch === '.' && rng() < 0.1) { // stalagmites / pebbles
        const sx = x + (rng() - 0.5) * 2.5, sz = z + (rng() - 0.5) * 2.5, sh = 0.6 + rng() * 2.2;
        B.box(sx - 0.4, 0, sz - 0.4, sx + 0.4, sh, sz + 0.4, 0x5a5262);
        B.box(sx - 0.2, sh, sz - 0.2, sx + 0.2, sh + 0.6, sz + 0.2, 0x6a6272);
        if (sh > 1.2) B.cyl(sx, sz, 0.45, 0, sh + 0.6);
      }
      if (ch === 'E') out.entry = { x, z };
      else if (ch === 'x') crystals(B, x, z, rng);
      else if (ch === 'o') G.props.addHarvest('ore', x, z);
      else if (ch === 's') G.props.addHarvest('shroom', x, z);
      else if (ch === 'c') out.chests.push({ id: 'c_cave' + (++chestN), x, z, r: chestN === 1 ? 'rare' : 'epic' });
      else if (ch === 'b') out.spawns.push({ type: 'bat', x, z, r: 8, n: 2, cave: true });
      else if (ch === 'g') out.spawns.push({ type: 'golem', x, z, r: 4, n: 1, cave: true });
      else if (ch === 'K') out.boss = { x, z };
      else if (ch === 'P') out.pedestal = { x, z };
      else if (ch === 'D') out.seal.push({ x, z });
      c++;
    }
  }
  // dust light shaft at entry
  for (let i = 0; i < 6; i++) B.glow(out.entry.x + (rng() - 0.5) * 6, 2 + rng() * 6, out.entry.z + (rng() - 0.5) * 6, 0x8aa0c8, 0.6, false);
  // place chests / portal / seal / pedestal
  for (const c of out.chests) G.props.addChest(c, 0);
  G.props.addPortal('caveOut', out.entry.x, 0, out.entry.z - 2.5, 'overworld');
  G.props.addSeal(out.seal);
  G.props.addPedestal(out.pedestal.x, 0, out.pedestal.z);
  out.spawns.push({ type: 'golem_king', x: out.boss.x, z: out.boss.z, r: 2, n: 1, boss: true, cave: true, quest: ['main5', 1] });
  return out;
}

function crystals(B, x, z, rng) {
  const cols = [0x6fe8ff, 0xb66cff, 0x7affc8];
  const col = cols[Math.floor(rng() * cols.length)];
  for (let i = 0; i < 4; i++) {
    const ox = x + (rng() - 0.5) * 3, oz = z + (rng() - 0.5) * 3, h = 0.8 + rng() * 2.2;
    B.box(ox - 0.3, 0, oz - 0.3, ox + 0.3, h, oz + 0.3, col, { emit: 1.5 + 0.8, vary: 0.1 });
    B.box(ox - 0.15, h, oz - 0.15, ox + 0.15, h + 0.5, oz + 0.15, 0xffffff, { emit: 2.4 });
  }
  B.cyl(x, z, 1.4, 0, 2.5);
  B.glow(x, 1.6, z, col, 1.6, false);
  W_lights(B, x, z, col);
}
function W_lights(B, x, z, col) {
  B.lightsSpots.push({ x, y: 2.5, z, color: col, intensity: 2.4, dist: 18, always: true });
}
