// Guerras territoriais: relações diplomáticas, posse de territórios, economia e simulação diária de conflitos.
import { G } from '../state.js';
import { TERRITORIES, FACTIONS, FACTION_IDS, RELATIONS } from '../data/world.js';
import { emit } from '../core/events.js';
import { mulberry32 } from '../core/util.js';

const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export function initWar() {
  G.territory = {}; for (const t of TERRITORIES) G.territory[t.id] = t.orig;
  G.relations = {};
  for (const [k, v] of Object.entries(RELATIONS)) { const [a, b] = k.split('-'); G.relations[key(a, b)] = v; }
  G.treasury = {}; for (const f of FACTION_IDS) G.treasury[f] = 500;
  G.rep = {}; for (const f of FACTION_IDS) G.rep[f] = f === 'varden' ? 20 : 0;
  G.warLog = [];
}
export function relation(a, b) { if (a === b) return 100; return G.relations[key(a, b)] ?? 0; }
export function setRelation(a, b, v) { G.relations[key(a, b)] = Math.max(-100, Math.min(100, v)); emit('relationsChanged'); }
export function atWar(a, b) { if (!a || !b || a === b) return false; return relation(a, b) <= -60; }
export function diplomacy(a, b) { const r = relation(a, b); return r <= -60 ? 'war' : r < -15 ? 'tense' : r < 40 ? 'neutral' : 'ally'; }
export function setOwner(tid, owner, silent = false) {
  const prev = G.territory[tid];
  if (prev === owner) return;
  G.territory[tid] = owner;
  const t = TERRITORIES.find((x) => x.id === tid);
  G.warLog.unshift({ day: G.day, tid, from: prev, to: owner });
  if (G.warLog.length > 30) G.warLog.length = 30;
  if (!silent) emit('territoryChanged', tid, prev, owner, t);
}
export function territoriesOf(f) { return TERRITORIES.filter((t) => G.territory[t.id] === f); }
export function strength(f) { let s = FACTIONS[f].troops / 10; for (const t of territoriesOf(f)) s += t.imp * 3; return s; }
export function income(f) { let s = 0; for (const t of territoriesOf(f)) s += t.imp * 12; return s; }
export function neighbors(tid) {
  const t = TERRITORIES.find((x) => x.id === tid);
  return TERRITORIES.filter((o) => o !== t && Math.hypot(o.x - t.x, o.y - t.y) < 48);
}
// tick diário: renda e escaramuças entre facções em guerra (nunca captura capitais)
export function dailyTick() {
  const r = mulberry32(G.day * 977);
  for (const f of FACTION_IDS) G.treasury[f] = (G.treasury[f] || 0) + income(f) - Math.round(FACTIONS[f].troops * 0.15);
  if (!G.flags.warStarted || G.flags.ending) return;
  for (const a of FACTION_IDS) for (const b of FACTION_IDS) {
    if (a >= b || !atWar(a, b)) continue;
    if (r() > 0.35) continue;
    const [att, def] = strength(a) * (0.7 + r() * 0.6) > strength(b) * (0.7 + r() * 0.6) ? [a, b] : [b, a];
    // território de fronteira do defensor
    const cands = territoriesOf(def).filter((t) => !t.id.endsWith('_capital') && !G.flags['lock_' + t.id] && neighbors(t.id).some((n) => G.territory[n.id] === att));
    if (!cands.length) continue;
    // Várden protegida no início para não frustrar o jogador
    if (def === 'varden' && territoriesOf('varden').length <= 2) continue;
    const t = cands[Math.floor(r() * cands.length)];
    setOwner(t.id, att);
  }
}
export function addRep(f, v) { G.rep[f] = Math.max(-100, Math.min(100, (G.rep[f] || 0) + v)); emit('repChanged', f); }
