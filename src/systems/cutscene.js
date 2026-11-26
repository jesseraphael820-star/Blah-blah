// Cenas cinematográficas: câmera, letterbox, fades, cartões de texto, diálogos e ações em sequência.
import { G } from '../state.js';
import { CUTSCENES } from '../data/cutscenes.js';
import { startDialogue } from './dialogue.js';
import { runActions } from './actions.js';
import { markerPos, npcEntity, changeMap } from './world.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';
import { dist } from '../core/util.js';

export function startCutscene(id, onEnd) {
  const steps = typeof id === 'string' ? CUTSCENES[id] : id;
  if (!steps) { console.warn('cena inexistente', id); return; }
  G.cut = { id, steps, i: -1, t: 0, onEnd, waiting: null };
  G.cutPrevMode = 'play';
  G.mode = 'cutscene';
  G.letterbox = 1;
  nextStep();
}
function nextStep() {
  const C = G.cut; if (!C) return;
  C.i++; C.t = 0; C.waiting = null;
  if (C.i >= C.steps.length) return endCutscene();
  const s = C.steps[C.i];
  if (s.act) runActions(s.act);
  if (s.dlg) { C.waiting = 'dlg'; startDialogue(s.dlg, s.npc ? npcEntity(s.npc) : null, () => { if (G.cut === C) { G.mode = 'cutscene'; nextStep(); } }); return; }
  if (s.cam) { const map = s.map || G.player.mapId; const [x, y] = Array.isArray(s.cam) ? s.cam : s.cam === 'player' ? [G.player.x, G.player.y] : s.cam.startsWith('npc:') ? (() => { const e = npcEntity(s.cam.slice(4)); return [e.x, e.y]; })() : markerPos(map, s.cam); G.cam.lock = { x, y, speed: s.speed || 2 }; }
  if (s.camFree) G.cam.lock = null;
  if (s.fade) { G.fade = { dir: s.fade, t: 0, dur: s.t || 1 }; }
  if (s.card) { G.card = { text: s.card, t: 0, dur: s.t || 3.5, big: !!s.big }; }
  if (s.move) { const [id, map, at, dx = 0, dy = 0] = s.move; const e = id === 'player' ? G.player : npcEntity(id); if (e) { const [x, y] = markerPos(map, at); e.goal = { x: x + dx, y: y + dy }; e.home = { x: x + dx, y: y + dy }; if (id === 'player') G.playerGoal = { x: x + dx, y: y + dy }; } }
  if (s.letterbox != null) G.letterbox = s.letterbox ? 1 : 0;
  if (s.music) audio.setTheme(s.music);
  if (s.teleport) changeMap(s.teleport[0], s.teleport[1], { sfx: false });
  if (s.credits) { C.waiting = 'credits'; emit('rollCredits', () => { if (G.cut === C) nextStep(); }); return; }
  if (s.choice) { C.waiting = 'dlg'; startDialogue(s.choice, null, () => { if (G.cut === C) { G.mode = 'cutscene'; nextStep(); } }); return; }
  if (s.ending) { C.waiting = 'ending'; emit('showEnding', s.ending, () => { if (G.cut === C) nextStep(); }); return; }
  if (s.title) { C.waiting = 'title'; emit('backToTitle'); return; }
}
export function updateCutscene(dt) {
  const C = G.cut; if (!C || C.waiting) return;
  C.t += dt;
  const s = C.steps[C.i];
  // jogador anda até o destino em cenas
  if (G.playerGoal) { const p = G.player; if (p.moveToward(G.playerGoal.x, G.playerGoal.y, 50, dt)) { G.playerGoal = null; p.state = 'idle'; } else p.state = 'walk'; }
  const dur = s.wait ?? s.t ?? (s.cam ? 1.6 : s.card ? s.t || 3.5 : s.move && s.waitMove ? 99 : 0.01);
  if (s.move && s.waitMove) { const e = s.move[0] === 'player' ? G.player : npcEntity(s.move[0]); if (!e || (!e.goal && !G.playerGoal) || C.t > 8) nextStep(); return; }
  if (C.t >= dur) nextStep();
}
export function endCutscene() {
  const C = G.cut; G.cut = null;
  G.cam.lock = null; G.letterbox = 0; G.playerGoal = null;
  if (G.mode === 'cutscene') G.mode = 'play';
  emit('cutsceneEnd', C && C.id);
  if (C && C.onEnd) C.onEnd();
}
export function skipCutscene() {
  const C = G.cut; if (!C || C.waiting === 'credits') return;
  if (G.dialogue) return; // diálogos são avançados normalmente
}
