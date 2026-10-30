const KEY = 'fta1_settings';
const touchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export const DEFAULTS = {
  controls: 'auto', // auto | keyboard | gamepad | touch
  sens: 1,
  invertY: false,
  deadzone: 0.15,
  stickDrive: true,
  gearbox: 'auto',
  vibration: true,
  camAuto: true,
  lang: 'pt',
  dub: 'pt',
  subs: true,
  volume: 0.8,
  musicVol: 0.6,
  voiceVol: 1,
  quality: touchDevice ? 'low' : 'high',
  shadows: !touchDevice,
  bloom: !touchDevice,
  drawDist: 1,
  weather: 'auto',
  timeScale: 1,
  units: 'kmh',
};

export class Settings {
  constructor() {
    this.v = { ...DEFAULTS };
    try { Object.assign(this.v, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* armazenamento indisponível */ }
    this.listeners = [];
    this.touchDevice = touchDevice;
  }
  get(k) { return this.v[k]; }
  set(k, val) {
    this.v[k] = val;
    try { localStorage.setItem(KEY, JSON.stringify(this.v)); } catch (e) { /* ignora */ }
    for (const f of this.listeners) f(k, val);
  }
  on(f) { this.listeners.push(f); }
  scheme(padConnected) {
    const c = this.v.controls;
    if (c !== 'auto') return c;
    if (padConnected) return 'gamepad';
    return touchDevice ? 'touch' : 'keyboard';
  }
}

const L = (pt, en) => ({ pt, en });
const TABS = [
  {
    id: 'ctrl', name: L('Controles', 'Controls'), items: [
      { k: 'controls', label: L('Esquema de controle', 'Control scheme'), type: 'select', opts: [['auto', L('Automático', 'Automatic')], ['keyboard', L('Teclado e mouse', 'Keyboard & mouse')], ['gamepad', L('Controle (analógico)', 'Gamepad (analog)')], ['touch', L('Toque (analógico virtual)', 'Touch (virtual stick)')]] },
      { k: 'stickDrive', label: L('Acelerar/frear com o analógico', 'Throttle/brake with stick'), type: 'check' },
      { k: 'sens', label: L('Sensibilidade da câmera', 'Camera sensitivity'), type: 'range', min: 0.2, max: 3, step: 0.1 },
      { k: 'invertY', label: L('Inverter eixo Y', 'Invert Y axis'), type: 'check' },
      { k: 'deadzone', label: L('Zona morta do analógico', 'Stick deadzone'), type: 'range', min: 0, max: 0.4, step: 0.01 },
      { k: 'gearbox', label: L('Câmbio', 'Gearbox'), type: 'select', opts: [['auto', L('Automático', 'Automatic')], ['manual', L('Manual (Q/E · LB/RB)', 'Manual (Q/E · LB/RB)')]] },
      { k: 'camAuto', label: L('Câmera segue o carro', 'Camera follows car'), type: 'check' },
      { k: 'vibration', label: L('Vibração do controle', 'Gamepad vibration'), type: 'check' },
    ],
  },
  {
    id: 'audio', name: L('Áudio e dublagem', 'Audio & voice'), items: [
      { k: 'dub', label: L('Dublagem', 'Voice-over'), type: 'select', opts: [['pt', L('Português (Brasil)', 'Portuguese (Brazil)')], ['en', L('Inglês', 'English')]] },
      { k: 'lang', label: L('Idioma da interface e legendas', 'Interface & subtitle language'), type: 'select', opts: [['pt', L('Português (Brasil)', 'Portuguese (Brazil)')], ['en', L('Inglês', 'English')]] },
      { k: 'subs', label: L('Legendas', 'Subtitles'), type: 'check' },
      { k: 'volume', label: L('Volume geral', 'Master volume'), type: 'range', min: 0, max: 1, step: 0.05 },
      { k: 'musicVol', label: L('Volume do rádio', 'Radio volume'), type: 'range', min: 0, max: 1, step: 0.05 },
      { k: 'voiceVol', label: L('Volume das vozes', 'Voice volume'), type: 'range', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: 'gfx', name: L('Gráficos', 'Graphics'), items: [
      { k: 'quality', label: L('Qualidade (reinicia o mundo)', 'Quality (reloads world)'), type: 'select', opts: [['low', L('Baixa', 'Low')], ['mid', L('Média', 'Medium')], ['high', L('Alta', 'High')]] },
      { k: 'shadows', label: L('Sombras', 'Shadows'), type: 'check' },
      { k: 'bloom', label: L('Brilho das luzes (bloom)', 'Light glow (bloom)'), type: 'check' },
      { k: 'drawDist', label: L('Distância de visão', 'Draw distance'), type: 'range', min: 0.4, max: 1.5, step: 0.05 },
      { k: 'units', label: L('Velocímetro', 'Speedometer'), type: 'select', opts: [['kmh', L('km/h', 'km/h')], ['mph', L('mph', 'mph')]] },
    ],
  },
  {
    id: 'world', name: L('Clima e tempo', 'Weather & time'), items: [
      { k: 'weather', label: L('Clima', 'Weather'), type: 'select', opts: [['auto', L('Dinâmico', 'Dynamic')], ['clear', L('Ensolarado', 'Sunny')], ['cloudy', L('Nublado', 'Cloudy')], ['rain', L('Chuva', 'Rain')], ['storm', L('Tempestade', 'Storm')], ['fog', L('Neblina', 'Fog')]] },
      { k: 'timeScale', label: L('Velocidade do relógio', 'Clock speed'), type: 'range', min: 0, max: 10, step: 0.5 },
    ],
  },
  { id: 'help', name: L('Ajuda', 'Help'), help: true },
];

const HELP = {
  pt: `<table>
  <tr><th></th><th>Teclado/Mouse</th><th>Controle</th><th>Toque</th></tr>
  <tr><td>Andar / dirigir</td><td>W A S D</td><td>Analógico esquerdo</td><td>Analógico virtual</td></tr>
  <tr><td>Câmera</td><td>Mouse</td><td>Analógico direito</td><td>Arrastar à direita</td></tr>
  <tr><td>Acelerar / frear</td><td>W / S</td><td>RT / LT (analógico)</td><td>Botões ▲ ▼ ou analógico</td></tr>
  <tr><td>Correr / freio de mão</td><td>Shift / Espaço</td><td>A (segurar)</td><td>Botões</td></tr>
  <tr><td>Pular</td><td>Espaço</td><td>X</td><td>⤒</td></tr>
  <tr><td>Soco</td><td>Clique</td><td>B</td><td>👊</td></tr>
  <tr><td>Entrar/sair do veículo</td><td>F</td><td>Y</td><td>🚗</td></tr>
  <tr><td>Buzina / rádio</td><td>H / R</td><td>L3 / D-pad ←</td><td>📻</td></tr>
  <tr><td>Mapa / pausa</td><td>M / Esc</td><td>Back / Start</td><td>🗺 / ⏸</td></tr>
  <tr><td>Marchas (manual)</td><td>E / Q</td><td>RB / LB</td><td>—</td></tr>
  </table>`,
  en: `<table>
  <tr><th></th><th>Keyboard/Mouse</th><th>Gamepad</th><th>Touch</th></tr>
  <tr><td>Walk / drive</td><td>W A S D</td><td>Left stick</td><td>Virtual stick</td></tr>
  <tr><td>Camera</td><td>Mouse</td><td>Right stick</td><td>Drag on right side</td></tr>
  <tr><td>Throttle / brake</td><td>W / S</td><td>RT / LT (analog)</td><td>▲ ▼ buttons or stick</td></tr>
  <tr><td>Sprint / handbrake</td><td>Shift / Space</td><td>A (hold)</td><td>Buttons</td></tr>
  <tr><td>Jump</td><td>Space</td><td>X</td><td>⤒</td></tr>
  <tr><td>Punch</td><td>Click</td><td>B</td><td>👊</td></tr>
  <tr><td>Enter/exit vehicle</td><td>F</td><td>Y</td><td>🚗</td></tr>
  <tr><td>Horn / radio</td><td>H / R</td><td>L3 / D-pad ←</td><td>📻</td></tr>
  <tr><td>Map / pause</td><td>M / Esc</td><td>Back / Start</td><td>🗺 / ⏸</td></tr>
  <tr><td>Gears (manual)</td><td>E / Q</td><td>RB / LB</td><td>—</td></tr>
  </table>`,
};

export function buildSettingsUI(root, settings, onClose) {
  let tab = 'ctrl';
  const render = () => {
    const lang = settings.get('lang');
    root.innerHTML = '';
    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    for (const t of TABS) {
      const b = document.createElement('button');
      b.textContent = t.name[lang];
      b.className = t.id === tab ? 'on' : '';
      b.onclick = () => { tab = t.id; render(); };
      tabs.appendChild(b);
    }
    root.appendChild(tabs);
    const body = document.createElement('div');
    body.className = 'tabbody';
    const T = TABS.find((t) => t.id === tab);
    if (T.help) body.innerHTML = HELP[lang];
    else for (const it of T.items) {
      const row = document.createElement('label');
      row.className = 'row';
      const span = document.createElement('span');
      span.textContent = it.label[lang];
      row.appendChild(span);
      let inp;
      if (it.type === 'select') {
        inp = document.createElement('select');
        for (const [v, l] of it.opts) { const o = document.createElement('option'); o.value = v; o.textContent = l[lang]; inp.appendChild(o); }
        inp.value = settings.get(it.k);
        inp.onchange = () => { settings.set(it.k, inp.value); if (it.k === 'lang') render(); };
      } else if (it.type === 'check') {
        inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!settings.get(it.k);
        inp.onchange = () => settings.set(it.k, inp.checked);
      } else {
        inp = document.createElement('input'); inp.type = 'range'; inp.min = it.min; inp.max = it.max; inp.step = it.step; inp.value = settings.get(it.k);
        const out = document.createElement('em'); out.textContent = (+inp.value).toFixed(2);
        inp.oninput = () => { settings.set(it.k, +inp.value); out.textContent = (+inp.value).toFixed(2); };
        row.appendChild(inp); row.appendChild(out); body.appendChild(row);
        continue;
      }
      row.appendChild(inp);
      body.appendChild(row);
    }
    root.appendChild(body);
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = lang === 'pt' ? 'Voltar' : 'Back';
    close.onclick = onClose;
    root.appendChild(close);
  };
  render();
  return render;
}
