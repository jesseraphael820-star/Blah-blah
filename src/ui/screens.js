// Telas: título, novo jogo, carregar, configurações, créditos, morte, epílogo dos finais e camada cinematográfica.
import { G } from '../state.js';
import { h, clear, scaled } from './dom.js';
import { t, loc, LANGS, setLang, getLang } from '../core/i18n.js';
import { audio } from '../core/audio.js';
import { charPreview, SKINS, HAIRS } from '../gfx/chars.js';
import { SLOTS, info as slotInfo, anySave, lastSlot } from '../systems/save.js';
import { settingsPanel } from './menus.js';
import { emit } from '../core/events.js';
import { renderMap } from './mapview.js';
import { portrait } from '../gfx/portraits.js';
import { NPCS } from '../data/npcs.js';

let ui, title, sub = null, death, ending, credits, cinema, fadeEl, cardEl;
export function initScreens(root) {
  ui = root;
  title = h('div', { id: 'title', class: 'screen' }); death = h('div', { id: 'death', class: 'screen hidden' }); ending = h('div', { id: 'ending', class: 'screen dark hidden' }); credits = h('div', { id: 'credits', class: 'screen hidden' });
  cinema = h('div', { id: 'cinema', class: 'passive' }, h('div', { class: 'lb top' }), h('div', { class: 'lb bot' }));
  fadeEl = h('div', { id: 'fade', class: 'passive' }); cardEl = h('div', { id: 'card', class: 'passive', style: { opacity: 0 } });
  root.append(cinema, fadeEl, cardEl, title, death, ending, credits);
}
// ---------- título ----------
export function showTitle() {
  G.mode = 'title'; title.classList.remove('hidden'); renderTitle();
  audio.setTheme('menu');
}
export function hideTitle() { title.classList.add('hidden'); sub = null; }
function renderTitle() {
  clear(title);
  const langSel = h('select', { class: 'langq', onchange: (e) => { G.settings.lang = e.target.value; emit('settingsChanged'); renderTitle(); } }, ...LANGS.map((l) => h('option', { value: l.code, selected: l.code === getLang() }, l.name)));
  if (sub === 'new') return title.append(langSel, newGamePanel());
  if (sub === 'load') return title.append(langSel, loadPanel());
  if (sub === 'settings') return title.append(h('div', { class: 'panel menuwin' }, h('div', { class: 'tabs' }, h('span', { class: 'tab on' }, t('tab_settings')), h('button', { class: 'tab', style: { marginInlineStart: 'auto' }, onclick: () => { sub = null; renderTitle(); } }, '✕')), h('div', { class: 'tabbody' }, settingsPanel(() => renderTitle()))));
  const last = lastSlot();
  const btn = (k, fn, dis) => h('button', { class: 'btn', disabled: dis, onclick: () => { audio.init(); audio.sfx('click'); fn(); }, onmouseenter: () => audio.sfx('hover') }, t(k));
  title.append(langSel,
    h('div', { class: 'logo' }, h('small', {}, 'SHADOWS OF THE'), 'KINGDOM'),
    h('div', { class: 'sub' }, t('title_sub')),
    h('div', { class: 'menu' },
      btn('menu_continue', () => emit('loadGame', last), !last),
      btn('menu_new', () => { sub = 'new'; renderTitle(); }),
      btn('menu_load', () => { sub = 'load'; renderTitle(); }, !anySave()),
      btn('menu_settings', () => { sub = 'settings'; renderTitle(); }),
      btn('menu_credits', () => showCredits(() => showTitle()))),
    h('div', { class: 'ver' }, 'v1.0 · ' + t(G.device && G.device.touch ? 'title_hint_touch' : 'title_hint')));
}
function newGamePanel() {
  const look = Object.assign({ skin: SKINS[1], hair: HAIRS[1], hairStyle: 0, top: '#5a4a6a', pants: '#3a3028', boots: '#2a1e18', eye: '#3a5a7a' }, G.playerLook || {});
  const name = h('input', { type: 'text', maxlength: 14, value: G.name || 'Aren' });
  const prevWrap = h('div');
  const refresh = () => { clear(prevWrap).append(scaled(charPreview(look, 1), 8)); };
  const row = (label, key, opts) => h('div', {}, h('div', { class: 'kv' }, t(label)), h('div', { class: 'swatches' }, ...opts.map((o) => h('span', { class: 'sw2' + (look[key] === o ? ' on' : ''), style: { background: typeof o === 'string' ? o : '#3a2a4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }, onclick: (e) => { look[key] = o; e.target.parentNode.querySelectorAll('.sw2').forEach((s) => s.classList.remove('on')); e.target.classList.add('on'); refresh(); } }, typeof o === 'number' ? String(o + 1) : ''))));
  refresh();
  return h('div', { class: 'panel' }, h('div', { class: 'newgame' }, prevWrap, h('div', { class: 'opts' },
    h('h2', { class: 'panel-title', style: { margin: 0 } }, t('new_title')),
    h('div', {}, h('div', { class: 'kv' }, t('new_name')), name),
    row('new_skin', 'skin', SKINS), row('new_hair', 'hair', HAIRS), row('new_style', 'hairStyle', [0, 1, 2, 3, 4, 6]), row('new_clothes', 'top', ['#5a4a6a', '#6a5a3a', '#3a5a4a', '#6a3a3a', '#3a4a6a']),
    h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } },
      h('button', { class: 'btn gold', onclick: () => { G.name = (name.value || 'Aren').trim().slice(0, 14); G.playerLook = look; emit('newGame'); } }, t('new_start')),
      h('button', { class: 'btn', onclick: () => { sub = null; renderTitle(); } }, t('ui_back'))))));
}
function loadPanel() {
  return h('div', { class: 'panel', style: { padding: '18px', width: 'min(600px, 92vw)' } }, h('h2', { class: 'panel-title', style: { marginTop: 0 } }, t('menu_load')),
    h('div', { class: 'slots' }, ...SLOTS.map((s) => { const inf = slotInfo(s); return h('div', { class: 'saveslot' }, h('div', {}, h('b', {}, s === 'auto' ? t('save_auto') : `${t('save_slot')} ${s}`), h('div', { class: 'meta' }, inf ? `${inf.name} · ${t('ui_chapter')} ${inf.chapter} · ${t('ui_day')} ${inf.day}` : t('save_empty'))), inf ? h('button', { class: 'btn small gold', onclick: () => emit('loadGame', s) }, t('save_load')) : null); })),
    h('button', { class: 'btn', style: { marginTop: '12px' }, onclick: () => { sub = null; renderTitle(); } }, t('ui_back')));
}
// ---------- morte ----------
export function showDeath() {
  death.classList.remove('hidden'); clear(death).append(h('h1', {}, t('death_title')), h('div', { class: 'kv', style: { fontSize: '15px' } }, t('death_sub')),
    h('button', { class: 'btn gold', onclick: () => { death.classList.add('hidden'); emit('respawn'); } }, t('death_retry')),
    lastSlot() ? h('button', { class: 'btn', onclick: () => { death.classList.add('hidden'); emit('loadGame', lastSlot()); } }, t('death_load')) : null,
    h('button', { class: 'btn', onclick: () => { death.classList.add('hidden'); emit('backToTitle'); } }, t('ui_quit_title')));
}
export function hideDeath() { death.classList.add('hidden'); }
// ---------- epílogo ----------
const EPI = {
  union: { t: { pt: 'Final da União', en: 'Union Ending' }, p: [
    { pt: 'Diante dos líderes das sete vilas, o Coração foi partido em sete fragmentos sobre a mesma forja que o criou.', en: 'Before the leaders of the seven villages, the Heart was split into seven shards upon the same forge that created it.' },
    { pt: 'Cada vila recebeu um pedaço. Nenhuma poderia, sozinha, revogar o juramento das outras. O Pacto dos Sete renasceu.', en: 'Each village received a piece. None could, alone, revoke the oath of the others. The Pact of the Seven was reborn.' },
    { pt: 'O Rei Torvald recuperou o trono e assinou a paz com Várden. O fragmento de Cinzamar foi entregue por Kael, de joelhos, à própria mãe.', en: 'King Torvald reclaimed his throne and signed peace with Várden. Cinzamar\'s shard was delivered by Kael, on his knees, to his own mother.' },
    { pt: 'A Irmandade de Várden voltou a ser o que jurou ser: guardiã das estradas — de todas as estradas.', en: 'The Brotherhood of Várden became once more what it swore to be: guardian of the roads — of all roads.' },
    { pt: 'Pela primeira vez em trezentos anos, carroças de Cinzamar cruzaram a Ponte de Várden carregadas de carvão, e voltaram carregadas de trigo.', en: 'For the first time in three hundred years, carts from Cinzamar crossed the Várden Bridge loaded with coal, and returned loaded with wheat.' }] },
  conquest: { t: { pt: 'Final da Conquista', en: 'Conquest Ending' }, p: [
    { pt: 'O Coração voltou ao pedestal do salão de Várden. Com ele, voltaram os contratos, os pedágios e o medo.', en: 'The Heart returned to the pedestal of Várden\'s hall. With it returned the contracts, the tolls and the fear.' },
    { pt: 'Drakmor rendeu-se. O Vau de Ferro, a Ponte e as Minas Profundas passaram a hastear o roxo. O mapa nunca foi tão violeta.', en: 'Drakmor surrendered. Ironford, the Bridge and the Deep Mines now fly purple. The map has never been so violet.' },
    { pt: 'Kael foi julgado e preso na torre de Várden. Todas as manhãs, ele olha para o sul, na direção de Cinzamar.', en: 'Kael was tried and imprisoned in Várden\'s tower. Every morning, he looks south, toward Cinzamar.' },
    { pt: 'Cinzamar continuou sem selo. Nas tavernas do Vale das Cinzas, começaram a cantar uma canção nova — sobre um Guardião que podia ter mudado tudo.', en: 'Cinzamar remained without a seal. In the taverns of the Ash Valley, they began to sing a new song — about a Warden who could have changed everything.' },
    { pt: 'A paz de Várden era firme como ferro. E, como o ferro, fria.', en: 'Várden\'s peace was firm as iron. And, like iron, cold.' }] },
  sacrifice: { t: { pt: 'Final do Sacrifício Político', en: 'Political Sacrifice Ending' }, p: [
    { pt: 'O Coração foi levado às Ruínas Antigas e guardado na Sala dos Sete, sob a vigilância de um conselho com um representante de cada vila.', en: 'The Heart was taken to the Ancient Ruins and kept in the Hall of the Seven, watched over by a council with one representative from each village.' },
    { pt: 'Várden renunciou ao monopólio das rotas. Perdeu riqueza, perdeu influência — e ganhou algo que não se mede em territórios.', en: 'Várden renounced its monopoly on the routes. It lost wealth, lost influence — and gained something not measured in territories.' },
    { pt: 'O Mestre de Campo devolveu a capa ao Grão-Mestre Oswin e partiu pela estrada, sem título e sem bandeira.', en: 'The Field Master returned the cloak to Grand Master Oswin and set out on the road, without title and without banner.' },
    { pt: 'Kael caminhou ao lado. Dizem que os dois ainda protegem viajantes nas estradas mais esquecidas do reino.', en: 'Kael walked alongside. They say the two still protect travelers on the most forgotten roads of the kingdom.' },
    { pt: 'Nenhuma vila governou as outras. Pela primeira vez, ninguém precisou.', en: 'No village ruled the others. For the first time, no one needed to.' }] },
};
export function showEnding(which, onDone) {
  G.mode = 'ending';
  const E = EPI[which] || EPI.union;
  const cv = h('canvas', { style: { width: 'min(520px, 90vw)', imageRendering: 'pixelated', border: '2px solid #5a4470', borderRadius: '6px' } });
  renderMap(cv, 'pol', 2);
  ending.classList.remove('hidden');
  const ps = E.p.map((p, i) => h('p', { style: { animationDelay: (0.6 + i * 1.6) + 's' } }, loc(p)));
  const kaelExpr = which === 'conquest' ? 'sad' : 'happy';
  clear(ending).append(h('div', { class: 'es' }, t('epilogue')), h('h1', { class: 'et' }, loc(E.t)),
    h('div', { class: 'ebody' }, h('div', { class: 'ep' }, ...ps), h('div', { style: { textAlign: 'center' } }, cv, h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' } }, scaled(portrait(G.playerLook, 'happy', 0), 2), scaled(portrait(NPCS.kael.look, kaelExpr, 0), 2), scaled(portrait(NPCS.oswin.look, which === 'sacrifice' ? 'sad' : 'happy', 0), 2)))),
    h('button', { class: 'btn gold', style: { marginTop: '18px', opacity: 0, animation: 'fadeUp 1s forwards', animationDelay: (E.p.length * 1.6 + 1) + 's' }, onclick: () => { ending.classList.add('hidden'); onDone && onDone(); } }, t('ui_continue')));
  audio.setTheme('credits');
}
// ---------- créditos ----------
export function showCredits(onDone) {
  const prevMode = G.mode; G.mode = 'credits';
  credits.classList.remove('hidden');
  const sec = (title, ...lines) => [h('h2', {}, title), ...lines.map((l) => h('p', {}, l))];
  const roll = h('div', { class: 'roll' },
    h('h1', { class: 'panel-title', style: { fontSize: '48px' } }, 'Shadows of the Kingdom'),
    ...sec(t('cr_direction'), 'Claude — ' + t('cr_team')),
    ...sec(t('cr_design'), t('cr_design_d')), ...sec(t('cr_story'), t('cr_story_d')), ...sec(t('cr_art'), t('cr_art_d')),
    ...sec(t('cr_audio'), t('cr_audio_d')), ...sec(t('cr_code'), t('cr_code_d')), ...sec(t('cr_loc'), LANGS.map((l) => l.name).join(' · ')),
    ...sec(t('cr_cast'), ...['kael', 'oswin', 'mira', 'tessa', 'roderic', 'sylvara', 'brenna', 'lucan', 'torvald', 'vargan', 'maren', 'morwen'].map((k) => NPCS[k].name)),
    ...sec(t('cr_thanks'), t('cr_thanks_d')), h('p', { style: { marginTop: '60px', fontSize: '22px', color: '#f4dc8a' } }, t('cr_end')));
  clear(credits).append(roll, h('button', { class: 'btn small', style: { position: 'absolute', right: '14px', bottom: '14px' }, onclick: () => finish() }, t('ui_skip')));
  audio.setTheme('credits');
  let done = false;
  const finish = () => { if (done) return; done = true; credits.classList.add('hidden'); G.mode = prevMode === 'credits' ? 'title' : prevMode; onDone && onDone(); };
  setTimeout(finish, 54000);
}
// ---------- camada cinematográfica ----------
export function updateCinema(dt) {
  cinema.classList.toggle('on', !!G.letterbox);
  const F = G.fade;
  if (F) {
    F.t += dt; const k = Math.min(1, F.t / F.dur);
    fadeEl.style.opacity = F.dir === 'out' ? k : 1 - k;
    if (k >= 1 && F.dir === 'in') G.fade = null;
  } else if (!G.fadeHold) fadeEl.style.opacity = 0;
  const C = G.card;
  if (C) {
    C.t += dt; cardEl.textContent = loc(C.text); cardEl.classList.toggle('big', C.big);
    cardEl.style.opacity = C.t < 0.6 ? C.t / 0.6 : C.t > C.dur - 0.6 ? Math.max(0, (C.dur - C.t) / 0.6) : 1;
    if (C.t >= C.dur) { G.card = null; cardEl.style.opacity = 0; }
  }
}
