// Training: skills that grow by doing (swimming, running, fighting, magic,
// taking hits, riding). Each level gives permanent bonuses on top of
// attributes, and raises the hero's Power rating. Weak enemies fear a strong hero.
import { G } from '../core/context.js';
import { t } from '../core/i18n.js';

export const SKILLS = {
  swim: { icon: '🌊', per: { swimSpeed: 0.04, maxStamina: 3, staminaRegen: 0.03 } },
  run: { icon: '👟', per: { runSpeed: 0.015, staminaDrain: -0.03 } },
  combat: { icon: '⚔', per: { melee: 0.025, crit: 0.004 } },
  magic: { icon: '✦', per: { power: 0.025, maxEnergy: 2 } },
  endurance: { icon: '🛡', per: { maxHp: 5, def: 0.6 } },
  riding: { icon: '🐴', per: { horseSpeed: 0.015 } },
};
export const SKILL_MAX = 20;
export const skillNeed = (l) => Math.floor(60 * Math.pow(l, 1.4));

export class Training {
  constructor() {
    const s = G.state.player;
    s.skills = s.skills || {};
    for (const k of Object.keys(SKILLS)) if (!s.skills[k]) s.skills[k] = { lvl: 0, xp: 0 };
    G.bus.on('enemyKilled', () => this.add('combat', 10));
    G.bus.on('powerUsed', () => this.add('magic', 6));
  }
  get sk() { return G.state.player.skills; }
  level(k) { return this.sk[k]?.lvl || 0; }
  add(k, n) {
    const s = this.sk[k];
    if (!s || s.lvl >= SKILL_MAX) return;
    s.xp += n;
    while (s.lvl < SKILL_MAX && s.xp >= skillNeed(s.lvl + 1)) {
      s.xp -= skillNeed(s.lvl + 1);
      s.lvl++;
      G.audio.sfx('achievement');
      G.ui.toast(t('train.up', { skill: t('train.' + k), n: s.lvl, bonus: t('train.' + k + 'Bonus') }), 'power');
    }
  }
  // summed bonuses from all skills
  bonus() {
    const b = { swimSpeed: 0, maxStamina: 0, staminaRegen: 0, runSpeed: 0, staminaDrain: 0, melee: 0, crit: 0, power: 0, maxEnergy: 0, maxHp: 0, def: 0, horseSpeed: 0 };
    for (const [k, d] of Object.entries(SKILLS)) { const l = this.level(k); for (const [p, v] of Object.entries(d.per)) b[p] += v * l; }
    return b;
  }
  // overall strength number shown in the character menu
  powerRating() {
    const st = G.prog.stats();
    let skills = 0; for (const k of Object.keys(SKILLS)) skills += this.level(k);
    return Math.round(G.state.player.level * 10 + skills * 4 + G.prog.weaponDps() * 1.5 + st.def * 2);
  }

  // called every frame by the player with what the hero is doing
  track(dt, moved, P) {
    if (P.swimming) this.add('swim', moved * 1.2);
    else if (P.mounted) this.add('riding', moved * 0.15);
    else if (P.speedNow > 7.5) this.add('run', moved * 0.3);
  }
}
