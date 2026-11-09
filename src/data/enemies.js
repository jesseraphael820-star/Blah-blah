// Enemy archetypes. Names in lang: enemy.<id>
// attacks: kind melee|leap|projectile|slam|summon|volley|teleport|beam|charge
export const ENEMIES = {
  slime: {
    model: 'slime', color: 0x6fbf4a, level: 1, hp: 32, dmg: 6, speed: 2.4, xp: 12, gold: [2, 5], radius: 0.6,
    aggro: 10, drops: [['slime_gel', 0.6, 1], ['apple', 0.15, 1]],
    attacks: [{ kind: 'leap', range: 2.4, windup: 0.55, cd: 1.6, mult: 1 }],
  },
  wolf: {
    model: 'wolf', color: 0x8a8f96, level: 3, hp: 58, dmg: 10, speed: 5.6, xp: 24, gold: [4, 9], radius: 0.7,
    aggro: 16, drops: [['wolf_pelt', 0.5, 1]],
    attacks: [{ kind: 'melee', range: 2.1, windup: 0.4, cd: 1.3, mult: 1 }, { kind: 'leap', range: 6, minRange: 3.5, windup: 0.6, cd: 4, mult: 1.4 }],
  },
  shadow_wolf: {
    model: 'wolf', color: 0x3a2a4a, eye: 0xff3a6a, level: 6, hp: 95, dmg: 15, speed: 6.4, xp: 45, gold: [8, 16], radius: 0.75, night: true,
    aggro: 20, drops: [['wolf_pelt', 0.5, 1], ['stardust', 0.08, 1], ['essence', 0.1, 1]],
    attacks: [{ kind: 'melee', range: 2.2, windup: 0.35, cd: 1.1, mult: 1 }, { kind: 'leap', range: 7, minRange: 3.5, windup: 0.5, cd: 3.5, mult: 1.4 }],
  },
  sprite: {
    model: 'sprite', color: 0x9a5ad8, level: 5, hp: 64, dmg: 11, speed: 3.2, xp: 36, gold: [6, 12], radius: 0.6, fly: 1.4,
    aggro: 18, keepDist: 7, drops: [['essence', 0.2, 1], ['glowshroom', 0.25, 1]],
    attacks: [{ kind: 'projectile', range: 14, windup: 0.6, cd: 2.2, mult: 1, color: 0xc070ff, speed: 12 }],
  },
  bat: {
    model: 'bat', color: 0x4a3a5a, level: 5, hp: 36, dmg: 8, speed: 6, xp: 26, gold: [3, 8], radius: 0.5, fly: 2.2,
    aggro: 16, drops: [['crystal', 0.12, 1]],
    attacks: [{ kind: 'charge', range: 2.2, windup: 0.3, cd: 1.4, mult: 1 }],
  },
  golem: {
    model: 'golem', color: 0x7a7468, level: 8, hp: 210, dmg: 22, speed: 2.2, xp: 80, gold: [14, 28], radius: 1.1, heavy: true,
    aggro: 14, drops: [['iron_ore', 0.5, 2], ['crystal', 0.35, 1], ['stone_core', 0.2, 1]],
    attacks: [{ kind: 'melee', range: 3, windup: 0.8, cd: 2, mult: 1 }, { kind: 'slam', range: 4.5, windup: 1.1, cd: 5, mult: 1.3, radius: 4.5 }],
  },
  sentinel: {
    model: 'sentinel', color: 0x9a9384, level: 10, hp: 230, dmg: 24, speed: 3, xp: 110, gold: [18, 34], radius: 0.9, heavy: true,
    aggro: 15, drops: [['stone_core', 0.35, 1], ['essence', 0.3, 1]],
    attacks: [{ kind: 'melee', range: 2.8, windup: 0.6, cd: 1.6, mult: 1 }, { kind: 'charge', range: 9, minRange: 4, windup: 0.8, cd: 5, mult: 1.3 }],
  },
  golden_slime: {
    model: 'slime', color: 0xffcc33, level: 4, hp: 120, dmg: 4, speed: 4.2, xp: 60, gold: [150, 260], radius: 0.7, flee: true,
    aggro: 14, drops: [['stardust', 0.5, 1], ['essence', 0.5, 1]], attacks: [],
  },
  // ---------- raiders (territory war) ----------
  raider: {
    model: 'sentinel', color: 0x7a3a2a, eye: 0xffaa3a, scale: 0.82, level: 5, hp: 95, dmg: 12, speed: 4.2, xp: 42, gold: [8, 16], radius: 0.7,
    aggro: 18, drops: [['potion_small', 0.2, 1], ['iron_ore', 0.2, 1]],
    attacks: [{ kind: 'melee', range: 2.4, windup: 0.5, cd: 1.4, mult: 1 }, { kind: 'charge', range: 8, minRange: 4, windup: 0.7, cd: 5, mult: 1.2 }],
  },
  golem_guard: {
    model: 'golem', color: 0x6a3a3a, crystal: 0xff5a3a, scale: 1.45, level: 8, hp: 460, dmg: 20, speed: 2.6, xp: 220, gold: [60, 90], radius: 1.6, heavy: true, guardian: true,
    aggro: 20, drops: [['stone_core', 0.8, 1], ['essence', 0.5, 1], ['crystal', 0.5, 1]],
    attacks: [
      { kind: 'melee', range: 3.4, windup: 0.8, cd: 1.8, mult: 1 },
      { kind: 'slam', range: 6, windup: 1.1, cd: 6, mult: 1.3, radius: 6 },
      { kind: 'volley', range: 20, windup: 1, cd: 7, mult: 0.7, n: 2, speed: 15, rock: true },
    ],
  },
  // ---------- bosses ----------
  alpha_wolf: {
    model: 'wolf', boss: true, scale: 2.2, color: 0x2e2a36, eye: 0xff2a2a, level: 7, hp: 760, dmg: 20, speed: 6.5, xp: 450, gold: [180, 220], radius: 1.4,
    aggro: 30, drops: [['wolf_pelt', 1, 3], ['essence', 1, 2]],
    attacks: [
      { kind: 'melee', range: 3.6, windup: 0.45, cd: 1.2, mult: 1 },
      { kind: 'leap', range: 12, minRange: 5, windup: 0.7, cd: 4, mult: 1.5, radius: 3 },
      { kind: 'summon', range: 30, windup: 1.2, cd: 16, summon: 'wolf', n: 2, phase: 1 },
    ],
  },
  stone_guardian: {
    model: 'sentinel', boss: true, scale: 2.6, color: 0xb8a878, eye: 0x4fd0ff, level: 11, hp: 1500, dmg: 30, speed: 3, xp: 900, gold: [380, 420], radius: 2,
    aggro: 30, drops: [['stone_core', 1, 2], ['essence', 1, 3]],
    attacks: [
      { kind: 'melee', range: 4.5, windup: 0.7, cd: 1.6, mult: 1 },
      { kind: 'slam', range: 7, windup: 1.2, cd: 6, mult: 1.4, radius: 7 },
      { kind: 'beam', range: 20, windup: 1.3, cd: 8, mult: 1.2, color: 0x4fd0ff, phase: 1 },
    ],
  },
  golem_king: {
    model: 'golem', boss: true, scale: 2.1, color: 0x5a5a6a, crystal: 0x6fe8ff, level: 13, hp: 2100, dmg: 34, speed: 2.6, xp: 1200, gold: [500, 600], radius: 2.2,
    aggro: 30, drops: [['crystal', 1, 4], ['essence', 1, 3]],
    attacks: [
      { kind: 'melee', range: 4.8, windup: 0.8, cd: 1.8, mult: 1 },
      { kind: 'slam', range: 8, windup: 1.2, cd: 5, mult: 1.4, radius: 8 },
      { kind: 'volley', range: 24, windup: 1, cd: 6, mult: 0.8, color: 0x8a8070, n: 3, speed: 16, rock: true },
      { kind: 'summon', range: 30, windup: 1.4, cd: 18, summon: 'bat', n: 3, phase: 1 },
    ],
  },
  primordial_shadow: {
    model: 'shadow', boss: true, scale: 1.8, color: 0x1a1024, eye: 0xff5fd2, level: 16, hp: 3400, dmg: 36, speed: 4.5, xp: 2500, gold: [900, 1000], radius: 1.4, fly: 0.8,
    aggro: 40, drops: [['essence', 1, 6], ['stardust', 1, 3]],
    attacks: [
      { kind: 'melee', range: 3.4, windup: 0.5, cd: 1.3, mult: 1 },
      { kind: 'volley', range: 26, windup: 0.8, cd: 4, mult: 0.7, color: 0xd04cff, n: 5, speed: 14 },
      { kind: 'teleport', range: 30, windup: 0.4, cd: 7, mult: 0 },
      { kind: 'slam', range: 6, windup: 1.0, cd: 7, mult: 1.3, radius: 6.5, phase: 1 },
      { kind: 'summon', range: 30, windup: 1.4, cd: 18, summon: 'shadow_wolf', n: 2, phase: 1 },
    ],
  },
};

// Spawn zones in the overworld. 'quest' zones only spawn while that flag condition is true.
export const SPAWNS = [
  { type: 'slime', x: -105, z: 40, r: 22, n: 5 },
  { type: 'slime', x: -40, z: 140, r: 20, n: 3 },
  { type: 'slime', x: 90, z: 120, r: 22, n: 3 },
  { type: 'wolf', x: -150, z: 110, r: 24, n: 3 },
  { type: 'wolf', x: -20, z: -120, r: 22, n: 3 },
  { type: 'wolf', x: 170, z: 150, r: 26, n: 3 },
  { type: 'wolf', x: 220, z: -80, r: 22, n: 3 },
  { type: 'sprite', x: -200, z: -60, r: 26, n: 3 },
  { type: 'sprite', x: -160, z: -100, r: 22, n: 2 },
  { type: 'slime', x: -170, z: -20, r: 26, n: 3, color: 0x4a8a3a },
  { type: 'shadow_wolf', x: -80, z: -60, r: 30, n: 2, night: true },
  { type: 'shadow_wolf', x: 140, z: 40, r: 30, n: 2, night: true },
  { type: 'shadow_wolf', x: -120, z: 180, r: 30, n: 2, night: true },
  { type: 'sentinel', x: -185, z: -212, r: 18, n: 3, flag: '!guardianDead' },
  { type: 'alpha_wolf', x: -40, z: -150, r: 4, n: 1, boss: true, quest: ['main3', 3] },
  { type: 'stone_guardian', x: -185, z: -218, r: 2, n: 1, boss: true, quest: ['main4', 2] },
  { type: 'primordial_shadow', x: -225, z: 190, r: 2, n: 1, boss: true, quest: ['main6', 2], onTower: true },
];
