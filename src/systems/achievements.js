// Achievements: evaluated from tracked stats; unlocking grants gold + titles.
import { G } from '../core/context.js';
import { ACHIEVEMENTS } from '../data/quests.js';
import { t } from '../core/i18n.js';

export class Achievements {
  constructor() {
    this.t = 0;
    G.bus.on('enemyKilled', (e) => {
      const s = G.state.ach.stats;
      s.kills++;
      if (e.type === 'slime' || e.type === 'golden_slime') s.slimes++;
      if (e.type === 'wolf' || e.type === 'shadow_wolf') s.wolves++;
      G.events.track('kills', 1);
      if (e.type === 'wolf' || e.type === 'shadow_wolf') G.events.track('wolves', 1);
    });
    G.bus.on('chestOpened', () => { G.state.ach.stats.chests++; G.events.track('chests', 1); });
    G.bus.on('harvest', () => G.events.track('harvest', 1));
    G.bus.on('stormBolt', () => { G.state.ach.stats.storm = 1; });
  }
  statValue(k) {
    const S = G.state, s = S.ach.stats;
    switch (k) {
      case 'bossCount': return s.bosses.length;
      case 'level': return S.player.level;
      case 'discovered': return S.world.discovered.length;
      case 'swordsOwned': return S.inv.owned.swords.length;
      case 'skinsOwned': return S.inv.owned.skins.length;
      case 'powersOwned': return S.inv.owned.powers.length;
      case 'petsOwned': return S.inv.owned.pets.length;
      case 'midnight': return s.midnight || 0;
      default: return s[k] || 0;
    }
  }
  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1;
    const h = G.state.world.time;
    if (h >= 0 && h < 0.5 && !G.sky.underground) G.state.ach.stats.midnight = 1;
    const un = G.state.ach.unlocked;
    for (const a of ACHIEVEMENTS) {
      if (un.includes(a.id)) continue;
      if (this.statValue(a.stat) >= a.n) {
        un.push(a.id);
        G.audio.sfx('achievement');
        G.ui.toast(t('ui.achievement', { name: t('ach.' + a.id + '.name') }), 'ach');
        G.prog.addGold(a.gold, { source: 'ach' });
        if (a.title) G.prog.addTitle(a.title);
      }
    }
  }
}
