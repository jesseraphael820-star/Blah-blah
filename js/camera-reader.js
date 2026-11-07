// Leitor de câmera: abre a câmera, espera o usuário ficar parado e analisa
// quadros reais (taxa de quadros, exposição, foco, ruído, cores, imagem congelada).
// Tudo é processado localmente; nenhuma imagem é gravada ou enviada.
import { icon } from './icons.js';
import { fmtNum, median, NA } from './utils.js';

const W = 96, H = 72;           // grade de análise (reduzida)
const STILL_DIFF = 7;           // diferença média entre quadros abaixo disso = parado
const RING_C = 2 * Math.PI * 46;

export async function openCamera(facingMode = 'environment') {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

function readerMarkup() {
  return `<div class="reader">
    <div class="rd-view">
      <video playsinline muted autoplay></video>
      <canvas class="rd-freeze" hidden></canvas>
      <div class="rd-reticle" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="rd-scan" aria-hidden="true"></div>
      <svg class="rd-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="t" cx="50" cy="50" r="46"/>
        <circle class="v" cx="50" cy="50" r="46" style="stroke-dasharray:${RING_C};stroke-dashoffset:${RING_C}"/>
      </svg>
      <div class="rd-done" aria-hidden="true"></div>
      <span class="live-tag"><i></i>AO VIVO</span>
      <div class="rd-msg" aria-live="polite">Abrindo a câmera…</div>
    </div>
    <div class="rd-chips">
      <div><span>Quadros</span><b data-k="fps">—</b></div>
      <div><span>Brilho</span><b data-k="lum">—</b></div>
      <div><span>Foco</span><b data-k="sharp">—</b></div>
      <div><span>Parado</span><b data-k="still">0%</b></div>
    </div>
    <div class="rd-motion"><span>Estabilidade</span><div class="bar"><div class="bar-fill"></div></div></div>
  </div>`;
}

/**
 * Executa a leitura em `container` usando `stream`.
 * Resolve com { metrics, checks, status, summary, details, note }.
 */
export function runCameraReader(container, stream, { requiredStillMs = 3000, timeoutMs = 25000, signal } = {}) {
  container.innerHTML = readerMarkup();
  const view = container.querySelector('.rd-view');
  const video = view.querySelector('video');
  const freeze = view.querySelector('.rd-freeze');
  const msg = view.querySelector('.rd-msg');
  const ring = view.querySelector('.rd-ring .v');
  const motionBar = container.querySelector('.rd-motion .bar-fill');
  const chip = (k, v) => { container.querySelector(`[data-k="${k}"]`).textContent = v; };

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });

  video.srcObject = stream;
  video.play().catch(() => {});

  return new Promise((resolve) => {
    let prev = null;
    let frames = 0; let lastTime = -1; let firstFrameAt = 0;
    let stillMs = 0; let lastTick = 0; let staticMs = 0;
    const samples = { lum: [], sharp: [], noise: [], r: [], g: [], b: [] };
    let maxMotion = 0;
    const t0 = performance.now();
    let finished = false; let raf = 0;

    // Conta quadros reais entregues pela câmera.
    const countFrame = () => { frames++; if (!firstFrameAt) firstFrameAt = performance.now(); };
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      const onVF = () => { if (finished) return; countFrame(); video.requestVideoFrameCallback(onVF); };
      video.requestVideoFrameCallback(onVF);
    }
    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

    const analyze = () => {
      g.drawImage(video, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      const L = new Float32Array(W * H);
      let sr = 0, sg = 0, sb = 0, sl = 0;
      for (let i = 0, p = 0; i < L.length; i++, p += 4) {
        const r = d[p], gg = d[p + 1], b = d[p + 2];
        const l = 0.299 * r + 0.587 * gg + 0.114 * b;
        L[i] = l; sr += r; sg += gg; sb += b; sl += l;
      }
      const n = L.length;
      // Variância do Laplaciano = nitidez
      let s1 = 0, s2 = 0, m = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const v = 4 * L[i] - L[i - 1] - L[i + 1] - L[i - W] - L[i + W];
          s1 += v; s2 += v * v; m++;
        }
      }
      const lap = s2 / m - (s1 / m) ** 2;
      let diff = NaN;
      if (prev) { let s = 0; for (let i = 0; i < n; i++) s += Math.abs(L[i] - prev[i]); diff = s / n; }
      prev = L;
      return { lum: sl / n, r: sr / n, g: sg / n, b: sb / n, lap, diff };
    };

    const finish = (reason) => {
      if (finished) return; finished = true;
      cancelAnimationFrame(raf);
      // congela o último quadro na tela
      if (video.videoWidth) {
        freeze.width = video.videoWidth; freeze.height = video.videoHeight;
        freeze.getContext('2d').drawImage(video, 0, 0);
        freeze.hidden = false;
      }
      const elapsed = (performance.now() - (firstFrameAt || t0)) / 1000;
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      const metrics = {
        reason,
        width: video.videoWidth, height: video.videoHeight,
        fps: frames > 1 && elapsed > 0 ? frames / elapsed : 0,
        fpsSetting: settings.frameRate,
        facing: settings.facingMode,
        lum: median(samples.lum), sharp: median(samples.sharp), noise: median(samples.noise),
        r: median(samples.r), g: median(samples.g), b: median(samples.b),
        stillMs, staticMs, maxMotion, hasRVFC,
        label: track?.label || '',
      };
      const out = evaluate(metrics);
      view.classList.add('is-done', `tone-${out.status === 'pass' ? 'pass' : out.status === 'warn' ? 'warn' : 'fail'}`);
      view.querySelector('.rd-done').innerHTML = out.status === 'pass'
        ? '<svg viewBox="0 0 52 52" class="check-draw"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>'
        : icon(out.status === 'warn' ? 'alert' : 'x');
      msg.textContent = out.status === 'pass' ? 'Câmera funcionando normalmente' : out.summary;
      ring.style.strokeDashoffset = '0';
      resolve(out);
    };

    signal?.addEventListener('abort', () => finish('aborted'), { once: true });

    const loop = (now) => {
      if (finished) return;
      raf = requestAnimationFrame(loop);
      if (!video.videoWidth) {
        if (now - t0 > 6000) finish('no-video');
        return;
      }
      if (!hasRVFC && video.currentTime !== lastTime) { lastTime = video.currentTime; countFrame(); }
      if (now - lastTick < 66) return; // ~15 análises por segundo
      const dt = lastTick ? Math.min(200, now - lastTick) : 0;
      lastTick = now;
      const a = analyze();
      const elapsed = (now - (firstFrameAt || t0)) / 1000;
      const fps = elapsed > 0.5 ? frames / elapsed : 0;
      chip('fps', fps ? `${Math.round(fps)} fps` : '—');
      chip('lum', `${Math.round((a.lum / 255) * 100)}%`);
      chip('sharp', `${Math.min(100, Math.round(Math.sqrt(Math.max(0, a.lap)) * 10))}`);
      if (!Number.isFinite(a.diff)) return;

      const motion = Math.min(1, a.diff / (STILL_DIFF * 3));
      maxMotion = Math.max(maxMotion, a.diff);
      motionBar.style.transform = `scaleX(${1 - motion})`;
      motionBar.parentElement.classList.toggle('moving', a.diff >= STILL_DIFF);
      if (a.diff < 0.05) staticMs += dt; else staticMs = 0;

      if (a.diff < STILL_DIFF) {
        stillMs += dt;
        samples.lum.push(a.lum); samples.sharp.push(a.lap); samples.noise.push(a.diff);
        samples.r.push(a.r); samples.g.push(a.g); samples.b.push(a.b);
        msg.textContent = stillMs < requiredStillMs * 0.5 ? 'Fique parado…' : 'Analisando… continue parado';
        view.classList.remove('moving');
      } else {
        msg.textContent = 'Movimento detectado — segure firme';
        view.classList.add('moving');
      }
      const p = Math.min(1, stillMs / requiredStillMs);
      ring.style.strokeDashoffset = String(RING_C * (1 - p));
      chip('still', `${Math.round(p * 100)}%`);
      if (p >= 1) finish('ok');
      else if (now - t0 > timeoutMs) finish('timeout');
    };
    msg.textContent = 'Aponte para um objeto e fique parado';
    raf = requestAnimationFrame(loop);
  });
}

/** Converte as métricas em verificações individuais e um resultado geral. */
export function evaluate(m) {
  const checks = [];
  const add = (name, status, value, hint = '') => checks.push({ name, status, value, hint });

  if (m.reason === 'no-video' || !m.width) {
    add('Imagem recebida', 'fail', 'Nenhum quadro', 'A câmera abriu, mas não enviou imagem.');
    return pack(m, checks);
  }
  add('Imagem recebida', 'pass', `${m.width} × ${m.height}`);

  // Taxa de quadros
  if (!m.fps) add('Taxa de quadros', 'fail', '0 fps', 'Nenhum quadro novo chegou durante o teste.');
  else if (m.fps < 12) add('Taxa de quadros', 'warn', `${fmtNum(m.fps, 0)} fps`, 'Imagem lenta; pode ser pouca luz ou o aparelho sobrecarregado.');
  else add('Taxa de quadros', 'pass', `${fmtNum(m.fps, 0)} fps`);

  // Resolução
  const px = m.width * m.height;
  if (px >= 1280 * 720) add('Resolução', 'pass', px >= 1920 * 1080 ? 'Full HD ou maior' : 'HD');
  else if (px >= 640 * 480) add('Resolução', 'pass', 'SD (640 × 480)', 'O navegador pode limitar a resolução entregue.');
  else add('Resolução', 'warn', `${m.width} × ${m.height}`, 'Resolução baixa.');

  if (m.reason === 'timeout' && !Number.isFinite(m.lum)) {
    add('Estabilidade', 'warn', 'Não estabilizou', 'Não foi possível ficar parado tempo suficiente. Apoie o aparelho e repita.');
    return pack(m, checks);
  }
  if (m.reason === 'timeout') add('Estabilidade', 'warn', 'Parcial', 'O teste terminou antes de completar o tempo parado.');

  // Exposição
  const lumPct = Math.round((m.lum / 255) * 100);
  if (m.lum < 12) add('Exposição', 'fail', `${lumPct}%`, 'Imagem preta: lente coberta ou sensor sem resposta.');
  else if (m.lum < 35) add('Exposição', 'warn', `${lumPct}% (escura)`, 'Ambiente escuro ou lente obstruída. Repita com mais luz.');
  else if (m.lum > 240) add('Exposição', 'warn', `${lumPct}% (estourada)`, 'Imagem muito clara; evite apontar para a luz.');
  else add('Exposição', 'pass', `${lumPct}%`);

  // Foco / nitidez
  const sharp = Math.min(100, Math.round(Math.sqrt(Math.max(0, m.sharp)) * 10));
  if (sharp < 25) add('Foco e nitidez', 'warn', `${sharp}/100`, 'Imagem desfocada, lente suja ou cena sem detalhes. Aponte para algo com textura.');
  else add('Foco e nitidez', 'pass', `${sharp}/100`);

  // Ruído
  add('Ruído do sensor', m.noise > 5 ? 'warn' : 'pass', `${fmtNum(m.noise, 1)}`, m.noise > 5 ? 'Granulado alto; comum com pouca luz.' : '');

  // Cores
  const ch = [m.r, m.g, m.b];
  const names = ['vermelho', 'verde', 'azul'];
  const dead = ch.findIndex((v) => v < 6);
  if (m.lum > 40 && dead >= 0) add('Cores', 'fail', `Canal ${names[dead]} ausente`, 'Um canal de cor não responde; possível defeito no sensor.');
  else {
    const warm = m.r - m.b;
    const tone = Math.abs(warm) < 18 ? 'Neutro' : warm > 0 ? 'Quente' : 'Frio';
    add('Cores', 'pass', `Balanço ${tone.toLowerCase()}`);
  }

  // Imagem congelada (sensores reais sempre variam um pouco)
  if (m.staticMs > 2000) add('Imagem ao vivo', 'warn', 'Sem variação', 'A imagem ficou idêntica entre quadros; pode estar congelada ou ser uma câmera virtual.');
  else add('Imagem ao vivo', 'pass', 'Atualizando');

  return pack(m, checks);
}

function pack(m, checks) {
  const fails = checks.filter((c) => c.status === 'fail');
  const warns = checks.filter((c) => c.status === 'warn');
  const status = fails.length ? 'fail' : warns.length ? 'warn' : 'pass';
  const summary = status === 'pass'
    ? `${m.width} × ${m.height} · ${fmtNum(m.fps, 0)} fps — funcionando normalmente`
    : (fails[0] || warns[0]).name + ': ' + (fails[0] || warns[0]).value;
  const details = [
    ...checks.map((c) => [c.name, c.value]),
    ['Lente', m.facing === 'environment' ? 'Traseira' : m.facing === 'user' ? 'Frontal' : NA],
    ['Tempo parado', `${fmtNum((m.stillMs || 0) / 1000, 1)} s`],
  ];
  const note = (fails[0] || warns[0])?.hint || 'Analisado em quadros reais com o aparelho parado.';
  return { status, summary, details, note, checks, metrics: m };
}
