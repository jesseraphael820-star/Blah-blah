// House interiors: furnished rooms placed outside the overworld. Walking through
// a house's front door fades into its room; the inner door leads back out.
// Beds let the hero sleep until morning.
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';
import { makeRng, shade } from '../core/utils.js';

export const INTERIOR_X0 = 840;
const ROOM_W = 12, ROOM_D = 9, H = 4.2;

const STYLES = [
  { wall: 0xe8d8b8, floor: 0x9a6a3a, rug: 0xa83a3a, blanket: 0x3a6ab0 },
  { wall: 0xdcc8e0, floor: 0x8a5a32, rug: 0x5a3a8a, blanket: 0xd0609a },
  { wall: 0xd8e4d0, floor: 0xa07440, rug: 0x3a7a4a, blanket: 0xe0b030 },
  { wall: 0xe0d0c0, floor: 0x7a5232, rug: 0x2a4a8a, blanket: 0x8a3a2a },
];

export function buildInterior(W, idx, house) {
  const B = W;
  const cx = INTERIOR_X0 + idx * 30, cz = 0;
  const s = STYLES[idx % STYLES.length];
  const rng = makeRng(900 + idx);
  const x0 = cx - ROOM_W / 2, x1 = cx + ROOM_W / 2, z0 = cz - ROOM_D / 2, z1 = cz + ROOM_D / 2;
  G.physics.regions.push({ x0: x0 - 2, x1: x1 + 2, z0: z0 - 2, z1: z1 + 2, h: 0 });
  // floor planks
  for (let x = x0; x < x1; x += 1) B.box(x, -0.6, z0, x + 1, 0, z1, (Math.round(x) % 2 ? shade(s.floor, 1.08) : s.floor), { vary: 0.06 });
  // walls with timber beams
  const wall = (ax0, az0, ax1, az1) => { B.box(ax0, 0, az0, ax1, H, az1, s.wall); B.collider(ax0, -1, az0, ax1, H + 1, az1); };
  wall(x0 - 0.4, z0 - 0.4, x1 + 0.4, z0); // back
  wall(x0 - 0.4, z1, x1 + 0.4, z1 + 0.4); // front
  wall(x0 - 0.4, z0, x0, z1); wall(x1, z0, x1 + 0.4, z1);
  for (const bx of [x0 + 0.01, x1 - 0.3]) B.box(bx, 0, z0, bx + 0.3, H, z0 + 0.3, 0x6a4428);
  B.box(x0, H - 0.35, z0, x1, H - 0.15, z1, 0x6a4428);
  B.box(x0 - 0.4, H, z0 - 0.4, x1 + 0.4, H + 0.3, z1 + 0.4, shade(s.floor, 0.7));
  B.collider(x0 - 1, H, z0 - 1, x1 + 1, H + 1, z1 + 1);
  for (let x = x0 + 1.5; x < x1; x += 3) B.box(x, H - 0.5, z0, x + 0.3, H - 0.2, z1, 0x5a3a20);
  // windows (warm daylight glow)
  for (const wx of [cx - 3, cx + 3]) B.box(wx - 0.6, 1.4, z0 + 0.01, wx + 0.6, 2.6, z0 + 0.08, 0xffe8b0, { emit: 1.5 + 0.6, vary: 0 });
  B.box(x0 + 0.01, 1.4, cz - 0.6, x0 + 0.08, 2.6, cz + 0.6, 0xffe8b0, { emit: 1.5 + 0.6, vary: 0 });
  // rug
  B.box(cx - 2.5, 0, cz - 1.6, cx + 2.5, 0.04, cz + 1.6, s.rug, { vary: 0.03 });
  B.box(cx - 2.2, 0.04, cz - 1.3, cx + 2.2, 0.05, cz + 1.3, shade(s.rug, 1.25));
  // fireplace on the back wall
  const fx = cx + 2.5;
  B.box(fx - 1.3, 0, z0, fx + 1.3, 2.2, z0 + 0.9, 0x8a8478);
  B.box(fx - 0.8, 0, z0 + 0.5, fx + 0.8, 1.2, z0 + 0.95, 0x1a1210);
  B.box(fx - 1.0, 2.2, z0, fx + 1.0, H, z0 + 0.7, 0x7a7468);
  B.box(fx - 0.5, 0.05, z0 + 0.6, fx + 0.5, 0.35, z0 + 0.85, 0xff8a2a, { emit: 2.4, vary: 0 });
  B.collider(fx - 1.3, -1, z0, fx + 1.3, 2.2, z0 + 0.95);
  W.fire(fx, 0.35, z0 + 0.75, 0.55, true);
  // bed in the back-left corner
  const bx = x0 + 1.4, bz = z0 + 1.6;
  B.box(bx - 1.1, 0, bz - 1.4, bx + 1.1, 0.55, bz + 1.6, 0x6a4428);
  B.box(bx - 1.0, 0.55, bz - 1.3, bx + 1.0, 0.8, bz + 1.5, 0xf0ece0);
  B.box(bx - 1.02, 0.8, bz - 0.4, bx + 1.02, 0.9, bz + 1.52, s.blanket);
  B.box(bx - 0.7, 0.8, bz - 1.25, bx + 0.7, 1.05, bz - 0.6, 0xffffff);
  B.box(bx - 1.15, 0, bz - 1.5, bx + 1.15, 1.6, bz - 1.35, 0x5a3a20);
  B.collider(bx - 1.1, -1, bz - 1.5, bx + 1.1, 0.9, bz + 1.6);
  // table with chairs
  B.box(cx - 0.9, 0.95, cz - 0.6, cx + 0.9, 1.1, cz + 0.6, 0x8a5a32);
  for (const [lx, lz] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]]) B.box(cx + lx - 0.06, 0, cz + lz - 0.06, cx + lx + 0.06, 0.95, cz + lz + 0.06, 0x6a4428);
  B.collider(cx - 0.9, -1, cz - 0.6, cx + 0.9, 1.1, cz + 0.6, { noCam: true });
  B.box(cx - 0.2, 1.1, cz - 0.2, cx + 0.2, 1.35, cz + 0.2, 0xffd070, { emit: 1.5 + 0.8, vary: 0 });
  W.lightsSpots.push({ x: cx, y: 1.8, z: cz, color: 0xffc070, intensity: 2.2, dist: 10, always: true });
  for (const [dx, rot] of [[-1.5, 0], [1.5, 0]]) { B.box(cx + dx - 0.3, 0, cz - 0.3, cx + dx + 0.3, 0.55, cz + 0.3, 0x7a4a28); B.box(cx + dx + (dx < 0 ? -0.3 : 0.2), 0.55, cz - 0.3, cx + dx + (dx < 0 ? -0.2 : 0.3), 1.3, cz + 0.3, 0x7a4a28); }
  // bookshelf and decor along the right wall
  B.box(x1 - 0.7, 0, cz - 1.5, x1, 2.8, cz + 1.5, 0x5a3a20);
  for (let k = 0; k < 4; k++) for (let b = 0; b < 6; b++) B.box(x1 - 0.6, 0.3 + k * 0.65, cz - 1.35 + b * 0.45, x1 - 0.15, 0.75 + k * 0.65, cz - 1.0 + b * 0.45, [0xa83a3a, 0x3a6ab0, 0x4a8a3a, 0xe0b030, 0x8a3a8a][Math.floor(rng() * 5)]);
  B.collider(x1 - 0.7, -1, cz - 1.5, x1, H + 2, cz + 1.5); // full height: can't climb on the shelf
  for (const [px, pz] of [[x0 + 0.6, z1 - 0.6], [x1 - 0.6, z1 - 0.6]]) {
    B.box(px - 0.3, 0, pz - 0.3, px + 0.3, 0.5, pz + 0.3, 0xa0603a);
    B.box(px - 0.4, 0.5, pz - 0.4, px + 0.4, 1.3, pz + 0.4, 0x4f9a3a, { wind: 0.1 });
  }
  B.box(cx - 4.2, 0, z1 - 1.2, cx - 3.0, 0.9, z1 - 0.4, 0x9a6a3a, { col: true });
  // exit door
  B.box(cx - 0.8, 0, z1 - 0.12, cx + 0.8, 2.5, z1, 0x6a4020);
  B.box(cx + 0.4, 1.2, z1 - 0.2, cx + 0.55, 1.35, z1 - 0.12, 0xd4a83a);
  const room = { idx, cx, cz, entry: { x: cx, z: z1 - 1.8 }, house, x0, x1, z0, z1 };
  W.addInteractable({
    kind: 'exit', x: cx, y: 0, z: z1 - 0.8, r: 2.2,
    label: () => t('ui.leaveHouse'),
    can: () => true,
    act: () => G.interiors.leave(room),
  });
  W.addInteractable({
    kind: 'bed', x: bx, y: 0, z: bz, r: 2.4,
    label: () => t('ui.sleep'),
    can: () => true,
    act: () => G.interiors.sleep(),
  });
  return room;
}

export class Interiors {
  constructor() { this.rooms = []; this.current = null; }
  // register a house (exterior) and its room; enabled() lets plots appear later
  add(W, house, enabled = () => true) {
    const room = buildInterior(W, this.rooms.length, house);
    this.rooms.push(room);
    W.addInteractable({
      kind: 'door', x: house.doorIn.x, y: house.y, z: house.doorIn.z, r: 2.2,
      label: () => t('ui.enterHouse'),
      can: () => enabled(),
      act: () => this.enter(room),
    });
    return room;
  }
  enter(room) {
    if (G.horses?.riding) G.horses.dismount(); // the horse waits outside
    G.ui.fade(() => {
      this.current = room;
      G.player.teleport(room.entry.x, 0, room.entry.z, Math.PI);
      G.cam.yaw = Math.PI; G.cam.dist = Math.min(G.cam.dist, 4.5);
      G.audio.sfx('open');
      G.game.onTeleport();
    });
  }
  leave(room) {
    const h = room.house;
    G.ui.fade(() => {
      this.current = null;
      G.player.teleport(h.out.x, G.physics.groundAt(h.out.x, h.out.z, h.y + 3), h.out.z, h.outYaw);
      G.cam.yaw = h.outYaw;
      G.audio.sfx('close');
      G.game.onTeleport();
    });
  }
  sleep() {
    G.ui.fade(() => {
      const W = G.state.world;
      if (W.time >= 7) W.day++;
      W.time = 7;
      const st = G.prog.stats();
      G.state.player.hp = st.maxHp; G.state.player.energy = st.maxEnergy; G.state.player.stamina = st.maxStamina;
      G.prog.addBuff('rested', 15);
      G.state.player.lastSleep = W.day * 24 + W.time;
      G.ui.toast(t('ui.slept', { n: W.day }), 'info');
      G.audio.sfx('heal');
      G.bus.emit('newDay', W.day);
      G.game.save(false);
    });
  }
  isInside(p) { return p.x >= INTERIOR_X0 - 20; }
  roomAt(p) { return this.rooms.find((r) => p.x > r.x0 - 0.2 && p.x < r.x1 + 0.2 && p.z > r.z0 - 0.2 && p.z < r.z1 + 0.2); }
  // safety net: if the hero ever ends up outside the walls of a room (or on the roof), put them back inside
  update() {
    const P = G.player;
    if (!P) return;
    if (P.pos.x > 600 && P.pos.x < INTERIOR_X0 - 25 && !G.physics.regions.some((q) => P.pos.x >= q.x0 && P.pos.x <= q.x1 && P.pos.z >= q.z0 && P.pos.z <= q.z1)) { P.respawnAt(P.s.respawn.x, P.s.respawn.z); G.game.onTeleport(); return; }
    if (P.pos.x < INTERIOR_X0 - 25) return;
    const r = this.roomAt(P.pos);
    if (r) {
      if (P.pos.y > 2.3) { P.pos.y = 2.3; if (P.vy > 0) P.vy = 0; } // head hits the ceiling
      this.current = r;
      return;
    }
    let best = this.rooms[0];
    for (const q of this.rooms) if (Math.abs(q.cx - P.pos.x) < Math.abs(best.cx - P.pos.x)) best = q;
    P.teleport(best.entry.x, 0, best.entry.z, Math.PI);
    this.current = best;
  }
}
