// Telas: título, seleção de personagem, pausa (mapa, missões, estatísticas,
// configurações, controles), briefing/conclusão/falha de missão, garagem e final.

import { CHARACTERS, drawCharacterPreview } from '../entities/human.js';
import { CATEGORIES, ENDING_TEXT } from '../systems/mission-data.js';
import { MODELS, SHOP } from '../entities/vehicle-models.js';
import { drawVehiclePreview } from '../entities/vehicle-sprites.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtTime = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const money = (n) => '$' + Math.round(n).toLocaleString('pt-BR');

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('screen');
    this.open = false;
    this.current = null;
    this.anim = null;
  }

  show(html, { solid = false, name = '' } = {}) {
    cancelAnimationFrame(this.anim);
    this.root.innerHTML = html;
    this.root.classList.add('show');
    this.root.classList.toggle('solid', solid);
    this.open = true;
    this.current = name;
    this.game.setPaused(true);
    this.root.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.audio.play('click');
        const fn = this.handlers[b.dataset.act];
        if (fn) fn(b.dataset.arg, b);
      });
    });
  }

  close() {
    cancelAnimationFrame(this.anim);
    this.root.classList.remove('show');
    this.root.innerHTML = '';
    this.open = false;
    this.current = null;
    this.game.setPaused(false);
  }

  // ---------------- Título ----------------
  showTitle() {
    const g = this.game;
    const has = g.hasSave();
    this.handlers = {
      continue: () => g.continueGame(),
      new: () => {
        if (has) this.confirm('Começar um novo jogo apagará o progresso salvo. Continuar?', () => this.showCharSelect(), () => this.showTitle());
        else this.showCharSelect();
      },
      settings: () => this.showSettingsStandalone(),
      controls: () => this.showControlsStandalone(),
    };
    this.show(`
      <div class="title-screen">
        <div class="logo">PORTO<br>BRASA</div>
        <div class="logo-sub">cidade sem freio</div>
        <div class="col">
          ${has ? '<button class="btn primary" data-act="continue">▶ Continuar</button>' : ''}
          <button class="btn ${has ? '' : 'primary'}" data-act="new">Novo jogo</button>
          <button class="btn" data-act="controls">Controles</button>
          <button class="btn" data-act="settings">Configurações</button>
        </div>
        <div class="rotate-tip">Dica: no celular, jogue com a tela na horizontal.</div>
        <div class="foot-note">Jogo original inspirado nos clássicos de ação top-down. Todos os nomes, lugares e personagens são fictícios.</div>
      </div>`, { solid: true, name: 'title' });
  }

  confirm(text, yes, no) {
    this.handlers = { yes, no };
    this.show(`<div class="panel narrow"><h2>Confirmar</h2><p>${esc(text)}</p>
      <div class="row"><button class="btn primary" data-act="yes">Sim</button><button class="btn" data-act="no">Não</button></div></div>`, { solid: true });
  }

  // ---------------- Personagem ----------------
  showCharSelect() {
    const g = this.game;
    let sel = 0;
    this.handlers = {
      pick: (i) => {
        sel = +i;
        this.root.querySelectorAll('.char').forEach((c, k) => c.classList.toggle('sel', k === sel));
      },
      start: () => g.newGame(CHARACTERS[sel].id),
      back: () => this.showTitle(),
    };
    this.show(`
      <div class="panel">
        <h2>Escolha seu personagem</h2>
        <p>Cada personagem tem uma vantagem própria.</p>
        <div class="chars">
          ${CHARACTERS.map((c, i) => `
            <div class="char ${i === 0 ? 'sel' : ''}" data-act="pick" data-arg="${i}">
              <canvas width="220" height="220"></canvas>
              <div class="cn">${esc(c.name)}</div>
              <div class="cp">${esc(c.perk)}</div>
            </div>`).join('')}
        </div>
        <div class="row"><button class="btn primary" data-act="start">Começar a jogar</button><button class="btn" data-act="back">Voltar</button></div>
      </div>`, { solid: true, name: 'chars' });
    const cvs = [...this.root.querySelectorAll('.char canvas')];
    const loop = (t) => {
      cvs.forEach((cv, i) => drawCharacterPreview(cv, CHARACTERS[i].look, i === sel ? t / 1000 : 0));
      this.anim = requestAnimationFrame(loop);
    };
    this.anim = requestAnimationFrame(loop);
  }

  // ---------------- Pausa ----------------
  showPause(tab = 'missions') {
    const g = this.game;
    if (!g.running) return;
    const tabs = [['map', 'Mapa'], ['missions', 'Missões'], ['stats', 'Estatísticas'], ['settings', 'Configurações'], ['controls', 'Controles']];
    this.handlers = {
      tab: (t) => this.showPause(t),
      resume: () => this.close(),
      save: () => { g.autosave(); g.hud.toast('Jogo salvo', 'ok'); this.close(); },
      quit: () => { g.autosave(); g.quitToTitle(); },
      ...this.settingsHandlers(),
    };
    let body = '';
    if (tab === 'map') body = this.mapHtml();
    if (tab === 'missions') body = this.missionsHtml();
    if (tab === 'stats') body = this.statsHtml();
    if (tab === 'settings') body = this.settingsHtml();
    if (tab === 'controls') body = this.controlsHtml();
    this.show(`
      <div class="panel">
        <h2>Pausado</h2>
        <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === tab ? 'on' : ''}" data-act="tab" data-arg="${k}">${n}</button>`).join('')}</div>
        ${body}
        <div class="row">
          <button class="btn primary" data-act="resume">▶ Continuar</button>
          <button class="btn" data-act="save">Salvar</button>
          <button class="btn danger" data-act="quit">Sair para o menu</button>
        </div>
      </div>`, { name: 'pause' });
    this.bindSettings();
    if (tab === 'map') {
      const cv = this.root.querySelector('.map-canvas');
      g.hud.drawFullMap(cv);
    }
  }

  mapHtml() {
    return `<canvas class="map-canvas" width="672" height="672"></canvas>
      <div class="legend">
        <span><i style="background:#fff"></i>Você</span><span><i style="background:#4fa3ff"></i>Garagem</span>
        <span><i style="background:#c77dff"></i>Pintura Rápida</span><span><i style="background:#ff6b6b"></i>Hospital</span>
        <span><i style="background:#7aa2ff"></i>Delegacia</span><span><i style="background:#f2b631"></i>Missões</span>
        <span><i style="background:#ffd23a"></i>Objetivo</span>
      </div>`;
  }

  missionsHtml() {
    const M = this.game.missions;
    const story = M.defs.filter((d) => d.cat === 'story' || d.story);
    const side = M.defs.filter((d) => !(d.cat === 'story' || d.story));
    const item = (d) => {
      const c = CATEGORIES[d.cat];
      const done = M.completed.has(d.id);
      const open = M.isUnlocked(d);
      const act = M.active && M.active.def === d;
      const status = act ? '<span style="color:#ffd23a">EM ANDAMENTO</span>' : done ? '<span style="color:#4fd17a">✔ CONCLUÍDA</span>' : open ? '<span style="color:#ffb35a">DISPONÍVEL</span>' : '🔒 BLOQUEADA';
      return `<div class="mitem ${!open && !done ? 'locked' : ''}" style="border-left-color:${c.color}">
        <div class="mi-ic" style="color:${c.color}">${c.icon}</div>
        <div class="mi-t"><div class="mi-n">${esc(d.name)}</div><div class="mi-d">${c.name} · ${money(d.reward)} · ${esc(d.contact)}</div></div>
        <div class="mi-s">${status}</div></div>`;
    };
    const done = M.completed.size;
    return `<p>${done} de ${M.defs.length} missões concluídas. Marcadores de missão aparecem no mapa e no minimapa.</p>
      <h3>Campanha</h3><div class="mlist">${story.map(item).join('')}</div>
      <h3>Paralelas</h3><div class="mlist">${side.map(item).join('')}</div>`;
  }

  statsHtml() {
    const g = this.game, s = g.stats;
    const rows = [
      ['Personagem', g.character.name], ['Dinheiro', money(g.money)], ['Tempo de jogo', fmtTime(s.playTime)],
      ['Missões concluídas', `${g.missions.completed.size} / ${g.missions.defs.length}`], ['Dinheiro ganho', money(s.earned)], ['Dinheiro gasto', money(s.spent)],
      ['Distância a pé', (s.footDist / 9000).toFixed(2) + ' km'], ['Distância dirigindo', (s.carDist / 9000).toFixed(2) + ' km'], ['Velocidade máxima', Math.round(s.topSpeed) + ' km/h'],
      ['Veículos roubados', s.stolen], ['Batidas', s.crashes], ['Nível máximo de procurado', '★'.repeat(s.maxWanted) || '—'],
      ['Vezes detido', s.busted], ['Vezes hospitalizado', s.wasted], ['Pessoas derrubadas', s.knocked],
    ];
    return `<div class="stats">${rows.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
  }

  settingsHtml() {
    const s = this.game.settings;
    const opt = (v, cur, label) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${label}</option>`;
    return `
      <div class="setting"><label>Volume</label><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></div>
      <div class="setting"><label>Qualidade gráfica</label><select data-set="quality">${opt('auto', s.quality, 'Automática')}${opt('low', s.quality, 'Baixa (celulares simples)')}${opt('high', s.quality, 'Alta')}</select></div>
      <div class="setting"><label>Densidade do trânsito</label><select data-set="traffic">${opt(0.5, s.traffic, 'Baixa')}${opt(1, s.traffic, 'Normal')}${opt(1.4, s.traffic, 'Alta')}</select></div>
      <div class="setting"><label>Zoom da câmera</label><input type="range" min="0.7" max="1.4" step="0.05" value="${s.zoom}" data-set="zoom"></div>
      <div class="setting"><label>Controles touch</label><select data-set="touch">${opt('auto', s.touch, 'Automático')}${opt('on', s.touch, 'Sempre visíveis')}${opt('off', s.touch, 'Ocultos')}</select></div>
      <div class="setting"><label>Tamanho dos botões</label><input type="range" min="0.75" max="1.4" step="0.05" value="${s.controlsSize}" data-set="controlsSize"></div>
      <div class="setting"><label>Opacidade dos botões</label><input type="range" min="0.3" max="1" step="0.05" value="${s.controlsOpacity}" data-set="controlsOpacity"></div>
      <div class="setting"><label>Vibração</label><input type="checkbox" ${s.vibration ? 'checked' : ''} data-set="vibration"></div>
      <div class="setting"><label>Mostrar FPS</label><input type="checkbox" ${s.showFps ? 'checked' : ''} data-set="showFps"></div>`;
  }

  settingsHandlers() {
    return {};
  }

  bindSettings() {
    this.root.querySelectorAll('[data-set]').forEach((el) => {
      const key = el.dataset.set;
      const apply = () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'range' || key === 'traffic') v = parseFloat(v);
        this.game.updateSetting(key, v);
      };
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });
  }

  controlsHtml() {
    return `
      <h3>Teclado (computador)</h3>
      <div class="keys">
        <kbd>W A S D / Setas</kbd><span>Andar (8 direções) · Dirigir: W acelera, S freia/ré, A/D esterçam</span>
        <kbd>Shift</kbd><span>Correr</span>
        <kbd>F / Enter</kbd><span>Entrar / sair do veículo</span>
        <kbd>E</kbd><span>Interagir: iniciar missão, garagem, pintura</span>
        <kbd>Espaço</kbd><span>Soco (a pé) · Freio de mão (no carro)</span>
        <kbd>H</kbd><span>Buzina</span>
        <kbd>M</kbd><span>Mapa da cidade</span>
        <kbd>Esc / P</kbd><span>Pausar</span>
      </div>
      <h3>Celular (touchscreen)</h3>
      <div class="keys">
        <kbd>Joystick (esquerda)</kbd><span>Toque em qualquer ponto da metade esquerda: andar ou esterçar</span>
        <kbd>ACELERAR / FREAR</kbd><span>Aparecem dentro do veículo (FREAR segurado dá ré)</span>
        <kbd>ENTRAR / SAIR</kbd><span>Aparece perto de um veículo</span>
        <kbd>CORRER</kbd><span>Segure para correr (a pé)</span>
        <kbd>AÇÃO</kbd><span>Soco / freio de mão — vira USAR quando há algo para interagir</span>
        <kbd>BUZINA</kbd><span>No veículo</span>
        <kbd>❚❚ / MAPA</kbd><span>Pausa e mapa (canto superior)</span>
      </div>
      <h3>Dicas</h3>
      <p>• Missões: vá até os ícones coloridos no mapa (★ = história na Oficina Brasa).<br>
      • Garagem (G): guarde até 4 veículos e compre novos. Pintura Rápida (P): conserta o carro e apaga as estrelas de procurado.<br>
      • Para despistar a polícia, saia do campo de visão das viaturas até as estrelas pararem de piscar e sumirem.</p>`;
  }

  showSettingsStandalone() {
    this.handlers = { back: () => this.showTitle() };
    this.show(`<div class="panel narrow"><h2>Configurações</h2>${this.settingsHtml()}<div class="row"><button class="btn primary" data-act="back">Voltar</button></div></div>`, { solid: true });
    this.bindSettings();
  }

  showControlsStandalone() {
    this.handlers = { back: () => this.showTitle() };
    this.show(`<div class="panel"><h2>Controles</h2>${this.controlsHtml()}<div class="row"><button class="btn primary" data-act="back">Voltar</button></div></div>`, { solid: true });
  }

  // ---------------- Missões ----------------
  showBriefing(d) {
    const g = this.game, c = CATEGORIES[d.cat];
    const repeat = g.missions.completed.has(d.id);
    const reward = Math.round(d.reward * (repeat ? 0.5 : 1) * (g.character?.cashMul || 1));
    const meta = [`Recompensa: <b>${money(reward)}</b>`];
    if (d.time) meta.push(`Tempo: <b>${fmtTime(d.time)}</b>`);
    if (d.maxDamage) meta.push(`Danos máx.: <b>${Math.round(d.maxDamage * 100)}%</b>`);
    if (d.noWanted) meta.push('<b>Sem procurado</b>');
    this.handlers = {
      go: () => { this.close(); g.missions.start(d); },
      cancel: () => { g.missions.giverCd = 2.5; this.close(); },
    };
    this.show(`
      <div class="panel narrow">
        <div class="brief-cat" style="color:${c.color}">${c.icon} ${c.name}${repeat ? ' · repetição (50%)' : ''}</div>
        <h1>${esc(d.name)}</h1>
        <p style="color:#9aa3b2">Contato: ${esc(d.contact)}</p>
        <p>${esc(d.desc)}</p>
        <p><b>Objetivo:</b> ${esc(d.steps[0].text)}</p>
        <div class="brief-meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>
        <div class="row"><button class="btn primary" data-act="go">Aceitar missão</button><button class="btn" data-act="cancel">Agora não</button></div>
      </div>`, { name: 'brief' });
  }

  showComplete(d, reward, time, unlocked, nextStory) {
    const g = this.game;
    this.handlers = {
      ok: () => {
        if (d.final && !g.endingSeen) { g.endingSeen = true; g.autosave(); this.showEnding(); }
        else this.close();
      },
    };
    this.show(`
      <div class="panel narrow center">
        <div class="result-big ok">MISSÃO CONCLUÍDA</div>
        <h2>${esc(d.name)}</h2>
        <div class="reward">+${money(reward)}</div>
        <p>Tempo: ${fmtTime(time)}</p>
        ${unlocked.length ? `<p>🔓 Novas missões: <b>${unlocked.map(esc).join(', ')}</b></p>` : ''}
        ${nextStory ? `<p>★ Próxima missão da história: <b>${esc(nextStory)}</b> (Oficina Brasa)</p>` : ''}
        <p style="font-size:12px;color:#6b7384">Progresso salvo automaticamente.</p>
        <div class="row" style="justify-content:center"><button class="btn primary" data-act="ok">Continuar</button></div>
      </div>`, { name: 'complete' });
  }

  showFail(d, reason) {
    const g = this.game;
    this.handlers = {
      retry: () => { this.close(); g.retryMission(d); },
      ok: () => this.close(),
    };
    this.show(`
      <div class="panel narrow center">
        <div class="result-big bad">MISSÃO FRACASSADA</div>
        <h2>${esc(d.name)}</h2>
        <p>${esc(reason)}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" data-act="retry">Tentar novamente</button><button class="btn" data-act="ok">Fechar</button></div>
      </div>`, { name: 'fail' });
  }

  showEnding() {
    const g = this.game;
    this.handlers = { ok: () => this.close() };
    this.show(`
      <div class="panel narrow center">
        <div class="logo" style="font-size:44px">FIM DA<br>CAMPANHA</div>
        <p style="margin-top:16px">${esc(ENDING_TEXT)}</p>
        <h3>Suas estatísticas</h3>
        ${this.statsHtml()}
        <div class="row" style="justify-content:center"><button class="btn primary" data-act="ok">Continuar explorando</button></div>
      </div>`, { name: 'ending' });
  }

  // ---------------- Garagem ----------------
  showGarage() {
    const g = this.game;
    const slots = g.garage;
    const done = g.missions.completed;
    this.handlers = {
      take: (i) => { g.takeFromGarage(+i); this.close(); },
      sell: (i) => { g.sellFromGarage(+i); this.showGarage(); },
      buy: (m) => { g.buyVehicle(m); this.showGarage(); },
      close: () => this.close(),
    };
    const slotHtml = [];
    for (let i = 0; i < g.garageSize; i++) {
      const s = slots[i];
      if (!s) { slotHtml.push(`<div class="gcar empty">Vaga livre</div>`); continue; }
      const m = MODELS[s.model];
      slotHtml.push(`<div class="gcar"><canvas width="240" height="120" data-model="${s.model}" data-color="${s.color}"></canvas>
        <div class="gn">${esc(m.name)}</div><div class="gd">${m.cls} · ${Math.round((s.hp / m.hp) * 100)}% estado</div>
        <div class="row" style="justify-content:center;margin-top:4px"><button class="btn small primary" data-act="take" data-arg="${i}">Retirar</button>
        <button class="btn small" data-act="sell" data-arg="${i}">Vender ${money(Math.round((m.price || 2000) * 0.3))}</button></div></div>`);
    }
    const shop = SHOP.map((it) => {
      const m = MODELS[it.model];
      const locked = it.unlock && !done.has(it.unlock);
      const full = slots.filter(Boolean).length >= g.garageSize;
      const cant = locked || full || g.money < m.price;
      return `<div class="gcar"><canvas width="240" height="120" data-model="${it.model}" data-color="${m.colors[0]}"></canvas>
        <div class="gn">${esc(m.name)}</div><div class="gd">${m.cls} · ${Math.round(m.maxSpeed * 0.4)} km/h</div>
        <button class="btn small ${cant ? '' : 'primary'}" data-act="buy" data-arg="${it.model}" ${cant ? 'disabled' : ''}>${locked ? '🔒 Avance na história' : money(m.price)}</button></div>`;
    }).join('');
    this.show(`
      <div class="panel">
        <h2>Garagem</h2>
        <p>Guarde veículos dirigindo até a porta da garagem. Seu dinheiro: <b style="color:#7cf29a">${money(g.money)}</b></p>
        <h3>Seus veículos (${slots.filter(Boolean).length}/${g.garageSize})</h3>
        <div class="garage-grid">${slotHtml.join('')}</div>
        <h3>Concessionária</h3>
        <div class="garage-grid">${shop}</div>
        <div class="row"><button class="btn" data-act="close">Fechar</button></div>
      </div>`, { name: 'garage' });
    this.root.querySelectorAll('canvas[data-model]').forEach((cv) => drawVehiclePreview(cv, cv.dataset.model, cv.dataset.color));
  }
}
