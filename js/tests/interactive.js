// Testes interativos: só começam depois que o usuário toca em "Permitir/Iniciar".
// Câmera e microfone pedem permissão do navegador; nenhum dado sai do aparelho.
import { NA, yesNo, fmtNum, delay, withTimeout } from '../utils.js';
import { icon } from '../icons.js';

const r = (status, summary, details = [], note = '') => ({ status, summary, details, note });
const needsMedia = (env) => {
  if (!env.secure) return r('unavailable', 'Requer conexão segura (HTTPS)', [], 'O navegador só libera câmera e microfone em páginas HTTPS.');
  if (!navigator.mediaDevices?.getUserMedia) return r('unavailable', 'Não suportado pelo navegador', []);
  return null;
};

function mediaError(err, env, what) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return r('skipped', 'Permissão negada', [], `O acesso ao ${what} não foi autorizado. Você pode liberar nas configurações do navegador.`);
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return env.device.type === 'desktop'
      ? r('unavailable', `Nenhum ${what} encontrado`, [], 'Normal em computadores sem esse dispositivo.')
      : r('fail', `Nenhum ${what} encontrado`, [], 'O aparelho não informou nenhum dispositivo disponível.');
  }
  if (name === 'NotReadableError' || name === 'AbortError') return r('fail', `${what[0].toUpperCase() + what.slice(1)} não respondeu`, [], 'Pode estar em uso por outro app ou apresentar falha.');
  return r('fail', `Erro ao acessar o ${what}`, [['Erro', name || String(err)]]);
}

const stopStream = (s) => s?.getTracks().forEach((t) => t.stop());

// ---------------------------------------------------------------------------
const camera = {
  id: 'camera', name: 'Câmera', category: 'Multimídia', icon: 'camera', interactive: true,
  prompt: { title: 'Testar a câmera', text: 'Vamos abrir a câmera por alguns segundos para verificar se ela gera imagem. Nada é gravado ou enviado.', action: 'Permitir câmera' },
  precheck: needsMedia,
  async run({ env, stage }) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: env.device.type === 'desktop' ? 'user' : 'environment' }, audio: false });
    } catch (e) { return mediaError(e, env, 'câmera'); }
    try {
      stage.innerHTML = `<div class="cam-preview"><video playsinline muted autoplay></video><div class="cam-scan"></div><span class="live-tag"><i></i>AO VIVO</span></div><p class="stage-hint">Analisando a imagem…</p>`;
      const video = stage.querySelector('video');
      video.srcObject = stream;
      await video.play().catch(() => {});
      await withTimeout(new Promise((res) => {
        if (video.videoWidth) res();
        video.addEventListener('loadeddata', res, { once: true });
      }), 5000).catch(() => {});
      await delay(1800);
      const w = video.videoWidth, h = video.videoHeight;
      let luma = NaN;
      if (w && h) {
        const c = document.createElement('canvas'); c.width = 64; c.height = 48;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(video, 0, 0, 64, 48);
        const d = g.getImageData(0, 0, 64, 48).data; let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        luma = sum / (d.length / 4);
      }
      const track = stream.getVideoTracks()[0];
      const set = track?.getSettings?.() || {};
      let cams = NA;
      try { cams = String((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput').length); } catch { /* ignore */ }
      const details = [
        ['Resolução capturada', w ? `${w} × ${h}` : NA],
        ['Quadros por segundo', set.frameRate ? `${Math.round(set.frameRate)} fps` : NA],
        ['Câmeras detectadas', cams],
        ['Lente testada', set.facingMode === 'environment' ? 'Traseira' : set.facingMode === 'user' ? 'Frontal' : 'Padrão'],
        ['Brilho médio da imagem', Number.isFinite(luma) ? `${Math.round((luma / 255) * 100)}%` : NA],
      ];
      if (!w) return r('fail', 'Câmera sem imagem', details, 'A câmera abriu, mas não enviou quadros.');
      if (luma < 8) return r('warn', 'Imagem muito escura', details, 'A lente pode estar coberta ou o ambiente muito escuro. Repita em local iluminado.');
      return r('pass', `${w} × ${h} — funcionando corretamente`, details);
    } finally { stopStream(stream); }
  },
};

// ---------------------------------------------------------------------------
const microphone = {
  id: 'microphone', name: 'Microfone', category: 'Multimídia', icon: 'mic', interactive: true,
  prompt: { title: 'Testar o microfone', text: 'Depois de permitir, fale algo ou bata palmas. Medimos apenas o volume em tempo real — nada é gravado.', action: 'Permitir microfone' },
  precheck: (env) => needsMedia(env) || (!(window.AudioContext || window.webkitAudioContext) ? r('unavailable', 'Web Audio não suportado') : null),
  async run({ env, stage }) {
    let stream; let ac;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) { return mediaError(e, env, 'microfone'); }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      await ac.resume().catch(() => {});
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser(); an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const bytes = new Uint8Array(an.fftSize);
      const readWave = () => {
        if (an.getFloatTimeDomainData) { an.getFloatTimeDomainData(buf); return; }
        an.getByteTimeDomainData(bytes);
        for (let i = 0; i < bytes.length; i++) buf[i] = (bytes[i] - 128) / 128;
      };
      stage.innerHTML = `<div class="meter"><div class="meter-bars">${'<i></i>'.repeat(24)}</div><div class="meter-label"><span>Nível</span><b id="mic-db">—</b></div></div><p class="stage-hint">${icon('mic')} Fale algo ou bata palmas perto do aparelho</p>`;
      const bars = [...stage.querySelectorAll('.meter-bars i')];
      const dbEl = stage.querySelector('#mic-db');
      let peak = 0; let voiced = 0; const start = performance.now(); let last = start;
      await new Promise((resolve) => {
        const loop = () => {
          readWave();
          let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const now = performance.now();
          if (rms > 0.02) voiced += now - last;
          last = now;
          peak = Math.max(peak, rms);
          const lvl = Math.min(1, rms * 8);
          bars.forEach((b, i) => { b.classList.toggle('on', i / bars.length < lvl); });
          dbEl.textContent = rms > 0 ? `${Math.round(20 * Math.log10(rms))} dB` : '—';
          if (voiced > 700 || now - start > 7000) resolve(); else requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
      const set = stream.getAudioTracks()[0]?.getSettings?.() || {};
      const details = [
        ['Pico de sinal', peak > 0 ? `${Math.round(20 * Math.log10(peak))} dBFS` : NA],
        ['Tempo com som detectado', `${fmtNum(voiced / 1000, 1)} s`],
        ['Taxa de amostragem', set.sampleRate ? `${set.sampleRate} Hz` : `${ac.sampleRate} Hz`],
        ['Canais', set.channelCount ? String(set.channelCount) : NA],
      ];
      if (peak < 0.003) return r('fail', 'Nenhum sinal captado', details, 'O microfone parece mudo. Verifique se não está obstruído ou desativado.');
      if (voiced < 300) return r('warn', 'Sinal muito fraco', details, 'Detectamos pouco som. Repita falando mais perto do aparelho.');
      return r('pass', 'Som captado — funcionando corretamente', details);
    } finally { stopStream(stream); ac?.close?.(); }
  },
};

// ---------------------------------------------------------------------------
function playTones(ac) {
  const seq = [[523.25, -1], [659.25, 1], [783.99, 0], [1046.5, 0]];
  const t0 = ac.currentTime + 0.05;
  seq.forEach(([f, pan], i) => {
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = t0 + i * 0.32;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(ac.destination); }
    else g.connect(ac.destination);
    o.start(t); o.stop(t + 0.3);
  });
  return delay(seq.length * 320 + 200);
}

const speaker = {
  id: 'speaker', name: 'Alto-falante', category: 'Multimídia', icon: 'speaker', interactive: true,
  prompt: { title: 'Testar o alto-falante', text: 'Vamos tocar uma sequência curta de tons (esquerda, direita e centro). Aumente o volume e desative o modo silencioso.', action: 'Tocar sons' },
  precheck: () => (!(window.AudioContext || window.webkitAudioContext) ? r('unavailable', 'Web Audio não suportado') : null),
  async run({ stage, ask }) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    try {
      await ac.resume().catch(() => {});
      let plays = 0;
      for (;;) {
        stage.innerHTML = `<div class="sound-wave playing">${'<i></i>'.repeat(9)}</div><p class="stage-hint">Tocando…</p>`;
        await playTones(ac); plays++;
        const ans = await ask('Você ouviu os sons?', [['yes', 'Ouvi', 'primary'], ['no', 'Não ouvi', 'ghost'], ['again', 'Tocar de novo', 'ghost']]);
        const details = [['Reproduções', String(plays)], ['Áudio estéreo', yesNo(!!ac.createStereoPanner)], ['Taxa de saída', `${ac.sampleRate} Hz`], ['Confirmação', 'Informada pelo usuário']];
        if (ans === 'yes') return r('pass', 'Som reproduzido — confirmado', details);
        if (ans === 'no') return r('warn', 'Som não ouvido', details, 'Verifique volume, modo silencioso e fones conectados. No iPhone, a chave lateral silencia o navegador.');
      }
    } finally { ac.close?.(); }
  },
};

// ---------------------------------------------------------------------------
const vibration = {
  id: 'vibration', name: 'Vibração', category: 'Hardware', icon: 'vibrate', interactive: true,
  prompt: { title: 'Testar o motor de vibração', text: 'O aparelho vai vibrar em um padrão curto. Segure-o na mão para sentir.', action: 'Vibrar agora' },
  precheck: (env) => {
    if (!('vibrate' in navigator)) return r('unavailable', 'Não suportado pelo navegador', [], 'O Safari (iPhone/iPad) não permite que sites acionem a vibração.');
    if (env.device.type === 'desktop') return r('unavailable', 'Sem motor de vibração', [], 'Computadores normalmente não possuem vibração.');
    return null;
  },
  async run({ stage, ask }) {
    let tries = 0;
    for (;;) {
      const accepted = navigator.vibrate([220, 120, 220, 120, 420]);
      tries++;
      stage.innerHTML = `<div class="vibe-demo">${icon('smartphone')}</div><p class="stage-hint">Vibrando…</p>`;
      await delay(1200);
      if (!accepted) return r('fail', 'Vibração recusada pelo navegador', [['Tentativas', String(tries)]], 'O navegador bloqueou o comando de vibração.');
      const ans = await ask('Você sentiu o aparelho vibrar?', [['yes', 'Senti', 'primary'], ['no', 'Não senti', 'ghost'], ['again', 'Vibrar de novo', 'ghost']]);
      const details = [['Tentativas', String(tries)], ['Padrão', '3 pulsos'], ['Confirmação', 'Informada pelo usuário']];
      if (ans === 'yes') return r('pass', 'Vibração confirmada', details);
      if (ans === 'no') return r('warn', 'Vibração não sentida', details, 'Verifique se a vibração está ativada nas configurações e se o modo economia não a desativa.');
    }
  },
};

// ---------------------------------------------------------------------------
const sensors = {
  id: 'sensors', name: 'Sensores de movimento', category: 'Sensores', icon: 'compass', interactive: true,
  prompt: { title: 'Testar sensores', text: 'Depois de permitir, incline e gire o aparelho por alguns segundos. Verificamos acelerômetro, giroscópio e orientação.', action: 'Permitir sensores' },
  precheck: (env) => {
    if (!('DeviceMotionEvent' in window) && !('DeviceOrientationEvent' in window)) return r('unavailable', 'Sem API de sensores', []);
    if (!env.secure) return r('unavailable', 'Requer conexão segura (HTTPS)', []);
    return null;
  },
  async run({ env, stage }) {
    // No iOS, a permissão precisa ser pedida diretamente no toque do usuário.
    const asks = [];
    if (typeof DeviceMotionEvent?.requestPermission === 'function') asks.push(DeviceMotionEvent.requestPermission());
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') asks.push(DeviceOrientationEvent.requestPermission());
    if (asks.length) {
      const res = await Promise.allSettled(asks);
      if (res.every((x) => x.status === 'rejected' || x.value !== 'granted')) return r('skipped', 'Permissão negada', [], 'O acesso aos sensores não foi autorizado.');
    }
    const seen = { accel: false, gyro: false, orient: false, compass: false };
    let motionEvents = 0; let orientEvents = 0; let maxDelta = 0; let lastG = null;
    stage.innerHTML = `<div class="level"><div class="level-ring"><span class="level-bubble"></span><i class="level-cross"></i></div>
      <dl class="level-vals"><div><dt>β</dt><dd id="sv-b">—</dd></div><div><dt>γ</dt><dd id="sv-g">—</dd></div><div><dt>α</dt><dd id="sv-a">—</dd></div></dl></div>
      <p class="stage-hint">${icon('rotate')} Incline e gire o aparelho</p>`;
    const bubble = stage.querySelector('.level-bubble');
    const vb = stage.querySelector('#sv-b'), vg = stage.querySelector('#sv-g'), va = stage.querySelector('#sv-a');
    const onMotion = (e) => {
      const g = e.accelerationIncludingGravity;
      if (g && g.x != null) {
        seen.accel = true; motionEvents++;
        if (lastG) maxDelta = Math.max(maxDelta, Math.abs(g.x - lastG.x) + Math.abs(g.y - lastG.y) + Math.abs(g.z - lastG.z));
        lastG = { x: g.x, y: g.y, z: g.z };
      }
      const rr = e.rotationRate;
      if (rr && (rr.alpha != null || rr.beta != null)) seen.gyro = true;
    };
    const onOrient = (e) => {
      if (e.beta == null && e.gamma == null) return;
      seen.orient = true; orientEvents++;
      if (e.webkitCompassHeading != null || e.absolute) seen.compass = true;
      const x = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
      const y = Math.max(-1, Math.min(1, (e.beta || 0) / 45));
      bubble.style.transform = `translate(${x * 46}px, ${y * 46}px)`;
      vb.textContent = `${Math.round(e.beta || 0)}°`; vg.textContent = `${Math.round(e.gamma || 0)}°`; va.textContent = e.alpha != null ? `${Math.round(e.alpha)}°` : '—';
    };
    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientation', onOrient);
    await delay(4000);
    window.removeEventListener('devicemotion', onMotion);
    window.removeEventListener('deviceorientation', onOrient);
    const generic = ['Accelerometer', 'Gyroscope', 'Magnetometer', 'AmbientLightSensor', 'GravitySensor'].filter((n) => n in window);
    const details = [
      ['Acelerômetro', seen.accel ? 'Respondendo' : 'Sem dados'],
      ['Giroscópio', seen.gyro ? 'Respondendo' : 'Sem dados'],
      ['Orientação', seen.orient ? 'Respondendo' : 'Sem dados'],
      ['Bússola', seen.compass ? 'Disponível' : NA],
      ['Eventos recebidos', String(motionEvents + orientEvents)],
      ['APIs de sensores genéricos', generic.length ? generic.join(', ') : NA],
    ];
    const count = [seen.accel, seen.gyro, seen.orient].filter(Boolean).length;
    if (!count) {
      if (env.device.type === 'desktop') return r('unavailable', 'Sem sensores de movimento', details, 'Normal para a maioria dos computadores.');
      return r('warn', 'Sensores não responderam', details, 'Verifique as permissões de movimento do navegador e repita o teste.');
    }
    if (seen.accel && maxDelta < 0.05 && motionEvents > 20) return r('warn', `${count} sensor(es) · sem variação`, details, 'Os valores não mudaram. Mova o aparelho durante o teste para confirmar.');
    return r('pass', `${count} sensor${count > 1 ? 'es' : ''} respondendo`, details);
  },
};

// ---------------------------------------------------------------------------
async function enterFullscreen(el) {
  try { await (el.requestFullscreen?.() || el.webkitRequestFullscreen?.()); } catch { /* opcional */ }
}
async function exitFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.webkitFullscreenElement) document.webkitExitFullscreen(); } catch { /* opcional */ }
}

const pixels = {
  id: 'pixels', name: 'Teste de pixels', category: 'Tela', icon: 'grid', interactive: true,
  prompt: { title: 'Verificar pixels e manchas', text: 'A tela exibirá cores sólidas em tela cheia. Observe se aparecem pontos, manchas ou listras. Toque para avançar.', action: 'Iniciar teste de cores' },
  async run({ overlay, ask, stage }) {
    const colors = [['#ff0000', 'Vermelho'], ['#00ff00', 'Verde'], ['#0000ff', 'Azul'], ['#ffffff', 'Branco'], ['#000000', 'Preto'], ['#808080', 'Cinza']];
    overlay.hidden = false;
    overlay.className = 'overlay color-test';
    await enterFullscreen(overlay);
    for (let i = 0; i < colors.length; i++) {
      const [c, name] = colors[i];
      overlay.style.background = c;
      overlay.innerHTML = `<span class="ct-hint ${i === 4 ? 'light' : ''}">${name} · ${i + 1}/${colors.length} — toque para avançar</span>`;
      await new Promise((res) => overlay.addEventListener('click', res, { once: true }));
    }
    await exitFullscreen();
    overlay.hidden = true; overlay.style.background = ''; overlay.innerHTML = ''; overlay.className = 'overlay';
    stage.innerHTML = `<div class="swatches">${colors.map(([c]) => `<i style="background:${c}"></i>`).join('')}</div>`;
    const ans = await ask('Você notou pontos, manchas ou listras em alguma cor?', [['no', 'Não, tudo uniforme', 'primary'], ['yes', 'Sim, notei', 'ghost']]);
    const details = [['Cores exibidas', String(colors.length)], ['Modo', 'Tela cheia'], ['Confirmação', 'Informada pelo usuário']];
    if (ans === 'no') return r('pass', 'Nenhum defeito relatado', details);
    return r('warn', 'Possível defeito na tela', details, 'Pixels mortos ou manchas podem indicar dano no painel. Recomenda-se avaliação técnica.');
  },
};

// ---------------------------------------------------------------------------
const touchmap = {
  id: 'touchmap', name: 'Mapa de toque', category: 'Tela', icon: 'hand', interactive: true,
  prompt: { title: 'Mapear a superfície de toque', text: 'Deslize o dedo por toda a tela até pintar todos os quadrados. Áreas que não respondem podem indicar falha no touch.', action: 'Iniciar mapa de toque' },
  precheck: () => ((navigator.maxTouchPoints || 0) === 0 && !('ontouchstart' in window) ? r('unavailable', 'Sem tela sensível ao toque', [], 'Normal para computadores sem tela touch.') : null),
  async run({ overlay }) {
    overlay.hidden = false;
    overlay.className = 'overlay touch-test';
    await enterFullscreen(overlay);
    await delay(250);
    const W = window.innerWidth, H = window.innerHeight;
    const cols = W < 600 ? 6 : 10;
    const cell = W / cols;
    const rows = Math.max(6, Math.round(H / cell));
    const total = cols * rows;
    const done = new Uint8Array(total); let count = 0;
    overlay.innerHTML = `<div class="tt-grid" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)">${'<i></i>'.repeat(total)}</div>
      <div class="tt-hud"><b id="tt-pct">0%</b><span>Pinte todos os quadrados</span></div>
      <button class="tt-done btn btn-ghost" type="button">Concluir</button>`;
    const cells = overlay.querySelectorAll('.tt-grid i');
    const pctEl = overlay.querySelector('#tt-pct');
    const start = performance.now();
    const result = await new Promise((resolve) => {
      const mark = (x, y) => {
        const c = Math.floor((x / overlay.clientWidth) * cols);
        const rr = Math.floor((y / overlay.clientHeight) * rows);
        if (c < 0 || rr < 0 || c >= cols || rr >= rows) return;
        const i = rr * cols + c;
        if (!done[i]) {
          done[i] = 1; count++; cells[i].classList.add('on');
          pctEl.textContent = `${Math.floor((count / total) * 100)}%`;
          if (count === total) finish(true);
        }
      };
      const onDown = (e) => {
        if (e.target.closest('.tt-done')) return;
        e.preventDefault();
        try { overlay.setPointerCapture(e.pointerId); } catch { /* ok */ }
        mark(e.clientX, e.clientY);
      };
      const onMove = (e) => {
        if (e.buttons === 0 && e.pointerType === 'mouse') return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        (evs.length ? evs : [e]).forEach((ev) => mark(ev.clientX, ev.clientY));
      };
      const btn = overlay.querySelector('.tt-done');
      const finish = (complete) => {
        overlay.removeEventListener('pointerdown', onDown);
        overlay.removeEventListener('pointermove', onMove);
        setTimeout(() => resolve(complete), complete ? 450 : 0);
      };
      btn.addEventListener('click', () => finish(false));
      overlay.addEventListener('pointerdown', onDown);
      overlay.addEventListener('pointermove', onMove);
    });
    await exitFullscreen();
    overlay.hidden = true; overlay.innerHTML = ''; overlay.className = 'overlay';
    const pct = Math.round((count / total) * 100);
    const details = [['Área respondendo', `${pct}%`], ['Quadrados', `${count} de ${total}`], ['Tempo', `${fmtNum((performance.now() - start) / 1000, 1)} s`]];
    if (result) return r('pass', '100% da superfície respondeu', details);
    if (pct === 0) return r('skipped', 'Teste não realizado', details);
    return r('warn', `${pct}% da superfície respondeu`, details, 'Áreas não pintadas podem não ter sido percorridas ou indicar falha no touch. Repita para confirmar.');
  },
};

export const interactiveTests = [camera, microphone, speaker, vibration, sensors, pixels, touchmap];
