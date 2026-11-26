// Executor de diálogos: linhas com retrato/expressão, digitação com "voz" por personagem,
// escolhas ramificadas e ações embutidas.
import { G } from '../state.js';
import { DLG } from '../data/dialogue.js';
import { dlgText, t } from '../core/i18n.js';
import { NPCS, npcName } from '../data/npcs.js';
import { getLang } from '../core/i18n.js';
import { runActions } from './actions.js';
import { emit } from '../core/events.js';
import { audio } from '../core/audio.js';

export function hasDialogue(id) { return !!DLG[id]; }
export function startDialogue(id, npc = null, onEnd = null) {
  const lines = DLG[id];
  if (!lines) { console.warn('diálogo inexistente', id); onEnd && onEnd(); return; }
  if (G.dialogue) G.dialogueQueue = (G.dialogueQueue || []).concat([[id, npc, onEnd]]);
  else {
    G.dialogue = { id, lines, idx: -1, npc, onEnd, prevMode: G.mode === 'dialogue' ? 'play' : G.mode };
    G.mode = 'dialogue';
    if (npc) { npc.talkTarget = G.player; G.player.face(npc.x, npc.y); npc.face(G.player.x, G.player.y); }
    audio.sfx('dialogOpen');
    nextLine();
  }
}
function fmt(s) { return String(s).replace(/\{name\}/g, G.name); }
export function speakerInfo(sp, npc) {
  if (sp === 'player') return { name: G.name, look: G.playerLook, voice: { pitch: 190, wave: 'triangle', var: 0.12 } };
  if (sp === 'narrator') return { name: '', look: null, voice: null, narrator: true };
  if (sp === 'stranger') return { name: t('npc_stranger'), look: { hood: '#1a141e', mask: '#2a2430', top: '#1e1a22', skin: '#e0ac85' }, voice: { pitch: 120, wave: 'sawtooth', var: 0.1 } };
  const d = NPCS[sp];
  if (d) return { name: npcName(sp, getLang()), look: d.look, voice: d.voice };
  if (npc) return { name: npc.name || t('npc_' + sp), look: npc.look, voice: npc.voice || { pitch: 200, wave: 'square', var: 0.15 } };
  return { name: t('npc_' + sp), look: {}, voice: { pitch: 180, wave: 'square', var: 0.15 } };
}
export function nextLine() {
  const D = G.dialogue; if (!D) return;
  D.idx++;
  if (D.idx >= D.lines.length) { endDialogue(); return; }
  const L = D.lines[D.idx];
  if (L[0] === '>') {
    const texts = dlgText(D.id, D.idx) || L[1].map((c) => c[0]);
    D.choices = L[1].map((c, i) => ({ text: fmt(Array.isArray(texts) ? texts[i] : c[0]), next: c[1], act: c[2] }));
    D.choiceSel = 0;
    D.typing = false;
    emit('dialogueLine');
    return;
  }
  D.choices = null;
  const [sp, expr] = L;
  const text = fmt(dlgText(D.id, D.idx) ?? L[2]);
  D.speaker = sp; D.expr = expr || 'neutral'; D.text = text; D.shown = 0; D.typing = true; D.info = speakerInfo(sp, D.npc);
  if (L[3]) runActions(L[3], { npc: D.npc });
  emit('dialogueLine');
}
export function chooseOption(i) {
  const D = G.dialogue; if (!D || !D.choices) return;
  const c = D.choices[i]; if (!c) return;
  audio.sfx('click');
  if (c.act) runActions(c.act, { npc: D.npc });
  emit('dlgChoice', D.id, i);
  if (c.next) {
    // salta para outro diálogo, preservando NPC e callback
    const { npc, onEnd, prevMode } = D;
    emit('dlgEnd', D.id, npc && npc.npcId);
    G.dialogue = { id: c.next, lines: DLG[c.next], idx: -1, npc, onEnd, prevMode };
    if (!G.dialogue.lines) { console.warn('diálogo inexistente', c.next); G.dialogue = null; G.mode = prevMode; return; }
    nextLine();
  } else nextLine();
}
export function advance() {
  const D = G.dialogue; if (!D || D.choices) return;
  if (D.typing) { D.shown = D.text.length; D.typing = false; return; }
  nextLine();
}
export function updateDialogue(dt) {
  const D = G.dialogue; if (!D || !D.typing) return;
  const sp = G.settings.textSpeed;
  if (sp >= 3) { D.shown = D.text.length; D.typing = false; return; }
  const cps = 38 * sp;
  const before = Math.floor(D.shown);
  D.shown += dt * cps;
  const after = Math.floor(D.shown);
  if (after > before && D.info && D.info.voice) { const ch = D.text[after - 1] || ''; if (/\S/.test(ch) && after % 2 === 0) audio.blip(D.info.voice, ch); }
  if (D.shown >= D.text.length) { D.shown = D.text.length; D.typing = false; }
}
export function endDialogue() {
  const D = G.dialogue; if (!D) return;
  G.dialogue = null;
  if (D.npc) D.npc.talkTarget = null;
  G.mode = D.prevMode === 'dialogue' ? 'play' : D.prevMode || 'play';
  emit('dlgEnd', D.id, D.npc && D.npc.npcId);
  if (D.onEnd) D.onEnd();
  emit('dialogueClosed');
  if (G.dialogueQueue && G.dialogueQueue.length && !G.dialogue) { const [id, npc, cb] = G.dialogueQueue.shift(); startDialogue(id, npc, cb); }
}
// boca: 0 fechada .. 3 aberta, baseada no caractere atual
export function mouthFrame() {
  const D = G.dialogue; if (!D || !D.typing) return 0;
  const ch = (D.text[Math.floor(D.shown)] || '').toLowerCase();
  if (/[aáãâ]/.test(ch)) return 3;
  if (/[eéêoóôõ]/.test(ch)) return 2;
  if (/[iíuú]/.test(ch)) return 1;
  if (/\s|[.,!?]/.test(ch)) return 0;
  return Math.floor(D.shown * 1.7) % 2 ? 1 : 2;
}
