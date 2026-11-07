// Testes automáticos: rodam sem interação, apenas lendo APIs do navegador ou medindo de fato.
import { NA, yesNo, fmtBytes, fmtNum, median, fetchTimeout } from '../utils.js';
import { deviceLabel } from '../detect.js';

const r = (status, summary, details = [], note = '') => ({ status, summary, details, note });

// ---------------------------------------------------------------------------
const device = {
  id: 'device', name: 'Modelo do dispositivo', category: 'Sistema', icon: 'smartphone',
  async run({ env }) {
    const d = env.device;
    const details = [
      ['Tipo', d.typeLabel],
      ['Fabricante', d.vendor || NA],
      ['Modelo', d.model || NA],
      ['Arquitetura', d.arch || NA],
      ['Pontos de toque', String(env.touchPoints)],
    ];
    if (d.model) return r('pass', `${deviceLabel(env)} — identificado`, details);
    return r('unavailable', `${d.generic || d.typeLabel} · modelo não exposto`, details,
      'Por privacidade, este navegador não informa o modelo exato do aparelho.');
  },
};

const os = {
  id: 'os', name: 'Sistema operacional', category: 'Sistema', icon: 'system',
  async run({ env }) {
    const { name, version, note } = env.os;
    if (!name) return r('unavailable', 'Sistema não identificado', [['User-Agent', env.ua]]);
    const major = parseFloat(version);
    const details = [['Sistema', name], ['Versão', version || NA], ['Plataforma informada', navigator.userAgentData?.platform || navigator.platform || NA]];
    let old = false;
    if (name === 'Android' && major && major < 10) old = true;
    if ((name === 'iOS' || name === 'iPadOS') && major && major < 15) old = true;
    if (name === 'Windows' && /^(7|8|8\.1)$/.test(version)) old = true;
    if (old) return r('warn', `${name} ${version} — versão antiga`, details, 'Versões antigas podem não receber atualizações de segurança.');
    return r('pass', `${name}${version ? ' ' + version : ''} — compatível`, details, note);
  },
};

const browser = {
  id: 'browser', name: 'Navegador e compatibilidade', category: 'Sistema', icon: 'globe',
  async run({ env }) {
    const checks = [
      ['JavaScript moderno', (() => { try { return Function('return ({a:{b:1}})?.a?.b ?? 0')() === 1; } catch { return false; } })()],
      ['Fetch API', 'fetch' in window],
      ['WebAssembly', typeof WebAssembly === 'object'],
      ['Service Worker', 'serviceWorker' in navigator],
      ['WebGL', (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } })()],
      ['Web Audio', !!(window.AudioContext || window.webkitAudioContext)],
      ['Câmera/Microfone (API)', !!navigator.mediaDevices?.getUserMedia],
      ['Armazenamento local', (() => { try { localStorage.setItem('__pc', '1'); localStorage.removeItem('__pc'); return true; } catch { return false; } })()],
      ['IntersectionObserver', 'IntersectionObserver' in window],
      ['CSS Grid', CSS.supports?.('display', 'grid')],
      ['Conexão segura (HTTPS)', window.isSecureContext],
    ];
    const ok = checks.filter((c) => c[1]).length;
    const pct = Math.round((ok / checks.length) * 100);
    const details = [
      ['Navegador', env.browser.name ? `${env.browser.name} ${env.browser.version}` : NA],
      ['Motor', env.browser.engine || NA],
      ['Recursos suportados', `${ok} de ${checks.length} (${pct}%)`],
      ...checks.map(([k, v]) => [k, yesNo(v)]),
    ];
    const label = env.browser.name || 'Navegador';
    if (ok === checks.length) return r('pass', `${label} — totalmente compatível`, details);
    const missing = checks.filter((c) => !c[1]).map((c) => c[0]).join(', ');
    return r(pct >= 75 ? 'warn' : 'fail', `${label} — ${pct}% compatível`, details, `Recursos ausentes: ${missing}.`);
  },
};

// ---------------------------------------------------------------------------
const resolution = {
  id: 'resolution', name: 'Resolução da tela', category: 'Tela', icon: 'monitor',
  async run() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(screen.width * dpr);
    const h = Math.round(screen.height * dpr);
    const mm = (q) => window.matchMedia?.(q).matches;
    const gamut = mm('(color-gamut: rec2020)') ? 'Rec. 2020' : mm('(color-gamut: p3)') ? 'Display P3' : mm('(color-gamut: srgb)') ? 'sRGB' : NA;
    const details = [
      ['Resolução física', `${w} × ${h} px`],
      ['Densidade (DPR)', `${fmtNum(dpr, 2)}×`],
      ['Profundidade de cor', `${screen.colorDepth} bits`],
      ['Gama de cores', gamut],
      ['HDR', mm('(dynamic-range: high)') ? 'Suportado' : 'Não informado'],
    ];
    if (!w || !h) return r('unavailable', 'Resolução não informada', details);
    return r('pass', `${w} × ${h} px — funcionando corretamente`, details,
      'A resolução física é calculada a partir dos pixels lógicos × densidade informada pelo navegador.');
  },
};

function simplifyRatio(a, b) {
  const long = Math.max(a, b), short = Math.min(a, b);
  const x = Math.round((long / short) * 9 * 2) / 2;
  return `${String(x).replace('.', ',')}:9`;
}

const size = {
  id: 'size', name: 'Tamanho da tela', category: 'Tela', icon: 'maximize',
  async run({ env }) {
    const sw = screen.width, sh = screen.height;
    const vw = window.innerWidth, vh = window.innerHeight;
    const details = [
      ['Tela (pixels lógicos)', `${sw} × ${sh}`],
      ['Área visível do navegador', `${vw} × ${vh}`],
      ['Proporção', simplifyRatio(sw, sh)],
      ['Classe', env.device.typeLabel],
      ['Tamanho físico (polegadas)', NA],
    ];
    if (!sw || !sh) return r('unavailable', 'Tamanho não informado', details);
    return r('pass', `${sw} × ${sh} pt · ${simplifyRatio(sw, sh)}`, details,
      'Navegadores não informam o tamanho físico em polegadas; exibimos as dimensões lógicas.');
  },
};

const COMMON_HZ = [30, 48, 50, 60, 75, 90, 100, 120, 144, 165, 240];
const refresh = {
  id: 'refresh', name: 'Taxa de atualização', category: 'Tela', icon: 'timer',
  async run({ progress }) {
    if (document.hidden) return r('unavailable', 'Página em segundo plano', [], 'Mantenha a página visível para medir.');
    const stamps = [];
    await new Promise((resolve) => {
      const stop = setTimeout(resolve, 2500);
      const tick = (t) => {
        stamps.push(t);
        progress?.(Math.min(1, (t - stamps[0]) / 1200));
        if (t - stamps[0] < 1200) requestAnimationFrame(tick);
        else { clearTimeout(stop); resolve(); }
      };
      requestAnimationFrame(tick);
    });
    if (stamps.length < 10) return r('unavailable', 'Não foi possível medir', [['Quadros capturados', String(stamps.length)]]);
    const deltas = stamps.slice(1).map((t, i) => t - stamps[i]).filter((d) => d > 2 && d < 100);
    const raw = 1000 / median(deltas);
    const snap = COMMON_HZ.find((hz) => Math.abs(hz - raw) / hz < 0.06);
    const hz = snap || Math.round(raw);
    const details = [['Frequência medida', `${fmtNum(raw, 1)} Hz`], ['Quadros analisados', String(deltas.length)], ['Estabilidade', `${fmtNum(Math.max(0, 100 - (Math.max(...deltas) - Math.min(...deltas)) / median(deltas) * 10), 0)}%`]];
    if (hz < 50) return r('warn', `${hz} Hz — abaixo do esperado`, details, 'Pode indicar modo de economia de bateria ativo ou alta carga no aparelho.');
    return r('pass', `${hz} Hz — fluido`, details, 'Medido em tempo real pela cadência de quadros do navegador.');
  },
};

const orientation = {
  id: 'orientation', name: 'Orientação do aparelho', category: 'Tela', icon: 'rotate',
  async run() {
    const so = screen.orientation;
    const portrait = window.matchMedia?.('(orientation: portrait)').matches;
    const type = so?.type || (portrait ? 'portrait-primary' : 'landscape-primary');
    const label = type.startsWith('portrait') ? 'Retrato' : 'Paisagem';
    const details = [
      ['Orientação atual', `${label}${type.endsWith('secondary') ? ' (invertida)' : ''}`],
      ['Ângulo', so ? `${so.angle}°` : (typeof window.orientation === 'number' ? `${window.orientation}°` : NA)],
      ['API de orientação', yesNo(!!so)],
    ];
    if (!so && typeof window.orientation !== 'number' && !window.matchMedia) return r('unavailable', 'Orientação não informada', details);
    return r('pass', `${label} — detectada`, details, 'Gire o aparelho e repita para confirmar a troca de orientação.');
  },
};

const touch = {
  id: 'touch', name: 'Suporte ao toque', category: 'Tela', icon: 'touch',
  async run({ env }) {
    const points = navigator.maxTouchPoints || 0;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const details = [
      ['Pontos simultâneos', String(points)],
      ['Eventos de toque', yesNo('ontouchstart' in window)],
      ['Ponteiro principal', coarse ? 'Toque (impreciso)' : 'Fino (mouse/caneta)'],
      ['Hover', yesNo(window.matchMedia?.('(hover: hover)').matches)],
    ];
    if (points > 0) return r('pass', `Detectado · ${points} ponto${points > 1 ? 's' : ''}`, details);
    if ('ontouchstart' in window || coarse) return r('pass', 'Detectado', details, 'O navegador não informou quantos toques simultâneos são suportados.');
    if (env.device.type !== 'desktop') return r('fail', 'Toque não detectado', details, 'Um aparelho móvel deveria informar suporte ao toque.');
    return r('unavailable', 'Sem tela sensível ao toque', details, 'Normal para computadores sem tela touch.');
  },
};

// ---------------------------------------------------------------------------
const PING_URLS = [
  'https://www.gstatic.com/generate_204',
  'https://speed.cloudflare.com/__down?bytes=0',
  'https://www.cloudflare.com/favicon.ico',
];

async function ping(url) {
  const t0 = performance.now();
  await fetchTimeout(`${url}${url.includes('?') ? '&' : '?'}_=${Math.random().toString(36).slice(2)}`, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' }, 5000);
  return performance.now() - t0;
}

const network = {
  id: 'network', name: 'Conexão com a internet', category: 'Conectividade', icon: 'wifi',
  async run({ progress, shared }) {
    const c = navigator.connection;
    const typeMap = { wifi: 'Wi-Fi', cellular: 'Dados móveis', ethernet: 'Cabo (Ethernet)', none: 'Nenhuma', bluetooth: 'Bluetooth', wimax: 'WiMAX', other: 'Outra', unknown: 'Desconhecida' };
    const base = [
      ['Navegador online', yesNo(navigator.onLine)],
      ['Tipo de rede', c?.type ? typeMap[c.type] || c.type : NA],
      ['Classe efetiva', c?.effectiveType ? c.effectiveType.toUpperCase() : NA],
      ['Economia de dados', c ? yesNo(c.saveData) : NA],
    ];
    if (!navigator.onLine) return r('fail', 'Sem conexão', base, 'O aparelho informa que está offline.');

    let host = null; const times = [];
    for (const url of PING_URLS) {
      try { await ping(url); host = url; break; } catch { /* tenta o próximo */ }
    }
    progress?.(0.3);
    if (!host) return r('fail', 'Internet inacessível', base, 'Não foi possível alcançar servidores públicos. Verifique Wi-Fi/dados ou bloqueadores.');
    for (let i = 0; i < 4; i++) {
      try { times.push(await ping(host)); } catch { /* ignora amostra */ }
      progress?.(0.3 + (i + 1) * 0.17);
    }
    const lat = times.length ? Math.round(median(times)) : NaN;
    shared.latency = lat;
    const details = [...base, ['Latência (mediana)', Number.isFinite(lat) ? `${lat} ms` : NA], ['Servidor de teste', new URL(host).hostname]];
    if (!Number.isFinite(lat)) return r('warn', 'Conectado, latência instável', details);
    if (lat > 400) return r('warn', `Conectado · latência alta (${lat} ms)`, details, 'Latência alta pode deixar chamadas e jogos lentos.');
    return r('pass', `Conectado · ${lat} ms — funcionando corretamente`, details, 'Tempo de ida e volta medido em requisições reais.');
  },
};

async function downloadSample(bytes, onProgress) {
  const url = `https://speed.cloudflare.com/__down?bytes=${bytes}&_=${Math.random().toString(36).slice(2)}`;
  const t0 = performance.now();
  const res = await fetchTimeout(url, { cache: 'no-store', credentials: 'omit' }, 15000);
  if (!res.ok || !res.body) throw new Error('Resposta inválida');
  const reader = res.body.getReader();
  let received = 0; let tFirst = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!tFirst) tFirst = performance.now();
    received += value.length;
    onProgress?.(received / bytes);
  }
  const tEnd = performance.now();
  const secs = Math.max(0.001, (tEnd - (received > 200000 ? tFirst : t0)) / 1000);
  return { received, secs, mbps: (received * 8) / secs / 1e6 };
}

const speed = {
  id: 'speed', name: 'Velocidade da conexão', category: 'Conectividade', icon: 'zap',
  minDuration: 400,
  async run({ progress, results }) {
    const net = results.network;
    if (net && net.status === 'fail') return r('unavailable', 'Sem internet para medir', [], 'O teste de conexão falhou.');
    const c = navigator.connection;
    const sizes = c?.saveData ? [250000, 1000000] : [250000, 1000000, 5000000, 15000000];
    let best = null; let total = 0; const start = performance.now();
    try {
      for (let i = 0; i < sizes.length; i++) {
        const s = await downloadSample(sizes[i], (f) => progress?.((i + f) / sizes.length));
        total += s.received;
        best = s;
        if (s.secs > 1.5 || performance.now() - start > 9000) break;
      }
    } catch {
      if (!best) {
        if (c?.downlink) {
          return r('pass', `≈ ${fmtNum(c.downlink, 1)} Mbps (estimativa do navegador)`, [['Download estimado', `${fmtNum(c.downlink, 1)} Mbps`], ['Método', 'Estimativa da Network Information API']],
            'Não foi possível baixar a amostra de teste; o valor é a estimativa informada pelo navegador.');
        }
        return r('unavailable', 'Medição bloqueada pela rede', [], 'O servidor de teste não pôde ser alcançado (firewall, bloqueador ou rede restrita).');
      }
    }
    const mbps = best.mbps;
    const details = [
      ['Download medido', `${fmtNum(mbps, mbps < 10 ? 1 : 0)} Mbps`],
      ['Dados baixados', fmtBytes(total)],
      ['Duração da amostra final', `${fmtNum(best.secs, 2)} s`],
      ['Estimativa do navegador', c?.downlink ? `${fmtNum(c.downlink, 1)} Mbps` : NA],
      ['Método', 'Download real (Cloudflare)'],
    ];
    const label = `${fmtNum(mbps, mbps < 10 ? 1 : 0)} Mbps`;
    if (mbps < 1) return r('fail', `${label} — muito lenta`, details, 'Velocidade insuficiente para vídeo e chamadas.');
    if (mbps < 5) return r('warn', `${label} — lenta`, details, 'Pode haver lentidão em vídeos em alta definição.');
    return r('pass', `${label} — boa velocidade`, details, 'Valor aproximado; varia conforme a rede e o horário.');
  },
};

const battery = {
  id: 'battery', name: 'Bateria', category: 'Hardware', icon: 'battery',
  async run() {
    if (!navigator.getBattery) return r('unavailable', 'Não disponível neste navegador', [], 'Safari e Firefox não permitem ler o estado da bateria.');
    let b;
    try { b = await navigator.getBattery(); } catch { return r('unavailable', 'Acesso bloqueado', []); }
    const lvl = Math.round(b.level * 100);
    const fmtT = (s) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : NA);
    const details = [
      ['Carga', `${lvl}%`],
      ['Carregador conectado', yesNo(b.charging)],
      ['Tempo para carga total', b.charging ? fmtT(b.chargingTime) : '—'],
      ['Autonomia estimada', !b.charging ? fmtT(b.dischargingTime) : '—'],
    ];
    const note = 'O navegador informa apenas carga e conexão do carregador, não a saúde física da bateria.';
    if (lvl <= 15 && !b.charging) return r('warn', `${lvl}% — bateria baixa`, details, note);
    return r('pass', `${lvl}% · ${b.charging ? 'carregando' : 'na bateria'}`, details, note);
  },
};

const BENCH_SRC = `onmessage=()=>{const end=performance.now()+600;let n=0,x=0;while(performance.now()<end){for(let i=0;i<20000;i++){x+=Math.sqrt(i*1.0001)*Math.sin(i);}n++;}postMessage({n:n,x:x});}`;

function runBenchmark() {
  return new Promise((resolve, reject) => {
    let w;
    try {
      const url = URL.createObjectURL(new Blob([BENCH_SRC], { type: 'text/javascript' }));
      w = new Worker(url);
      URL.revokeObjectURL(url);
    } catch (e) { reject(e); return; }
    const t = setTimeout(() => { w.terminate(); reject(new Error('timeout')); }, 5000);
    w.onmessage = (e) => { clearTimeout(t); w.terminate(); resolve(Math.round(e.data.n / 0.6)); };
    w.onerror = (e) => { clearTimeout(t); w.terminate(); reject(e); };
    w.postMessage(0);
  });
}

const performanceTest = {
  id: 'performance', name: 'Memória e processamento', category: 'Hardware', icon: 'cpu',
  async run({ progress }) {
    const cores = navigator.hardwareConcurrency || 0;
    const mem = navigator.deviceMemory;
    progress?.(0.1);
    let score = null;
    try { score = await runBenchmark(); } catch { score = null; }
    progress?.(0.8);
    let quota = NA;
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.quota) quota = `${fmtBytes(est.quota)} (uso: ${fmtBytes(est.usage || 0)})`;
    } catch { /* indisponível */ }
    const tier = score == null ? NA : score >= 1600 ? 'Alto' : score >= 700 ? 'Intermediário' : 'Básico';
    const details = [
      ['Núcleos lógicos (CPU)', cores ? String(cores) : NA],
      ['Memória RAM informada', mem ? `${mem >= 8 ? '8 GB ou mais' : `≈ ${String(mem).replace('.', ',')} GB`}` : NA],
      ['Pontuação de processamento', score != null ? fmtNum(score) : NA],
      ['Nível de desempenho', tier],
      ['Cota de armazenamento do navegador', quota],
    ];
    const note = 'A pontuação é relativa (operações matemáticas em 0,6 s) — use para comparar verificações.';
    if (score == null && !cores) return r('unavailable', 'Informações bloqueadas', details);
    if ((mem && mem <= 2) || (cores && cores <= 2) || (score != null && score < 300)) {
      return r('warn', `${cores || '?'} núcleos · desempenho limitado`, details, note);
    }
    return r('pass', `${cores || '?'} núcleos · desempenho ${tier.toLowerCase()}`, details, note);
  },
};

function cleanRenderer(s) {
  if (!s) return '';
  let out = s.replace(/^ANGLE \(/, '').replace(/\)$/, '');
  const parts = out.split(', ');
  if (parts.length >= 2) out = parts[1];
  return out.replace(/ANGLE Metal Renderer: /, '').replace(/\s*\(0x[0-9A-Fa-f]+\)/g, '').replace(/ Direct3D.*$/, '').trim();
}

const gpu = {
  id: 'gpu', name: 'Processador gráfico (GPU)', category: 'Hardware', icon: 'layers',
  async run() {
    const canvas = document.createElement('canvas');
    let gl = null; let v2 = false;
    try { gl = canvas.getContext('webgl2'); v2 = !!gl; if (!gl) gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); } catch { gl = null; }
    const webgpu = 'gpu' in navigator;
    if (!gl) return r('warn', 'Aceleração gráfica indisponível', [['WebGL', 'Não'], ['WebGPU', yesNo(webgpu)]], 'Jogos e mapas 3D podem não funcionar. A aceleração por hardware pode estar desativada.');
    let renderer = gl.getParameter(gl.RENDERER);
    let vendor = gl.getParameter(gl.VENDOR);
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) { renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || renderer; vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || vendor; }
    const details = [
      ['GPU', cleanRenderer(renderer) || NA],
      ['Fornecedor', vendor || NA],
      ['WebGL', v2 ? 'WebGL 2.0' : 'WebGL 1.0'],
      ['WebGPU', yesNo(webgpu)],
      ['Textura máxima', `${gl.getParameter(gl.MAX_TEXTURE_SIZE)} px`],
    ];
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const sw = /SwiftShader|llvmpipe|Software|Basic Render/i.test(renderer || '');
    if (sw) return r('warn', 'Renderização por software', details, 'A GPU não está sendo usada; o desempenho gráfico será reduzido.');
    return r('pass', `${cleanRenderer(renderer) || 'GPU'} — ativa`, details);
  },
};

export const autoTests = [device, os, browser, resolution, size, refresh, orientation, touch, network, speed, battery, performanceTest, gpu];
