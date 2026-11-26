// Conquistas.
import { G } from '../state.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';
export const ACHIEVEMENTS = ['first_blood', 'first_horse', 'legend_horse', 'explorer', 'treasure_10', 'smith_master', 'parry_10', 'liberator', 'rich', 'fisher', 'hunter', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'end_union', 'end_conquest', 'end_sacrifice', 'side_all', 'meteor', 'dawnblade', 'level10', 'tournament'];
export function unlockAchievement(id) {
  if (G.achievements[id]) return;
  G.achievements[id] = G.day;
  audio.sfx('achieve');
  emit('achievement', id);
  try { const all = JSON.parse(localStorage.getItem('sotk_achievements') || '{}'); all[id] = 1; localStorage.setItem('sotk_achievements', JSON.stringify(all)); } catch (e) { /* armazenamento indisponível */ }
}
export function checkAchievements() {
  const s = G.stats;
  if (s.kills >= 1) unlockAchievement('first_blood');
  if (s.chests >= 10) unlockAchievement('treasure_10');
  if (s.parries >= 10) unlockAchievement('parry_10');
  if (s.captures >= 5) unlockAchievement('liberator');
  if (s.fish >= 5) unlockAchievement('fisher');
  if (s.animals >= 15) unlockAchievement('hunter');
  if (G.inv && G.inv.gold >= 1000) unlockAchievement('rich');
  if (G.player && G.player.level >= 10) unlockAchievement('level10');
  if (Object.keys(G.discovered).filter((k) => k.startsWith('reg')).length >= 8) unlockAchievement('explorer');
  if (G.inv && Object.values(G.inv.upgrades).some((v) => v >= 5)) unlockAchievement('smith_master');
}
