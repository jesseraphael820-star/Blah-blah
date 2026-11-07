// PhoneCheck — orquestração do fluxo de diagnóstico.
import { $, $$, delay, withTimeout, prefersReducedMotion } from './utils.js';
import { icon, hydrateIcons } from './icons.js';
import { collectEnv, deviceLabel } from './detect.js';
import { autoTests } from './tests/auto.js';
import { interactiveTests } from './tests/interactive.js';
import { summarize } from './score.js';
import { sound } from './sound.js';
import { history } from './history.js';
import { exportPDF, shareReport } from './report.js';
import * as ui from './ui.js';

const TESTS = [...autoTests, ...interactiveTests];
const MIN_AUTO_MS = 850;

const state = {
  running: false,
  cancelled: false,
  skipInteractive: false,
  resolvePrompt: null,
  report: null,
};

// ------------------------------------------------------------------ tema
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#btn-theme').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
  $('#btn-theme').setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#07090c' : '#f3f6f9');
}

function applySound() {
  const on = sound.enabled;
  const b = $('#btn-sound');
  b.innerHTML = icon(on ? 'volumeOn' : 'volumeOff');
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros');
  b.classList.toggle('is-on', on);
}

// ------------------------------------------------------------------ execução
function animateProgress(row, getReported) {
  const t0 = performance.now();
  let raf = 0; let stopped = false;
  const step = () => {
    if (stopped) return;
    const t = performance.now() - t0;
    const timeBased = 0.92 * (1 - Math.exp(-t / 700));
    const p = Math.max(timeBased * (getReported() > 0 ? 0.4 : 1), Math.min(0.97, getReported()));
    ui.heroProgress(p);
    ui.setRow(row, null, null, p);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

const fail = (summary, note = '') => ({ status: 'unavailable', summary, details: [], note });

async function runAuto(t, ctx) {
  ui.heroRunning(t);
  ui.setRow(t.id, 'running', 'Analisando…');
  sound.play('tick');
  let reported = 0;
  const stop = animateProgress(t.id, () => reported);
  const testCtx = { ...ctx, progress: (p) => { reported = Math.max(reported, p); } };
  let result;
  try {
    [result] = await Promise.all([
      withTimeout(Promise.resolve().then(() => t.run(testCtx)), 25000),
      delay(prefersReducedMotion() ? 200 : (t.minDuration ?? MIN_AUTO_MS)),
    ]);
  } catch (e) {
    result = fail(e?.message === 'Tempo esgotado' ? 'Tempo esgotado' : 'Não foi possível executar', 'O navegador não respondeu a esta verificação.');
  }
  stop();
  return result;
}

function runInteractive(t, ctx) {
  const pre = t.precheck?.(ctx.env);
  if (pre) return Promise.resolve(pre);
  if (state.skipInteractive || state.cancelled) return Promise.resolve({ status: 'skipped', summary: 'Pulado pelo usuário', details: [] });
  ui.setRow(t.id, 'waiting', 'Aguardando sua ação');
  return new Promise((resolve) => {
    state.resolvePrompt = () => resolve({ status: 'skipped', summary: 'Pulado pelo usuário', details: [] });
    ui.heroPrompt(t, {
      onSkip: () => state.resolvePrompt?.(),
      onAccept: () => {
        state.resolvePrompt = null;
        const { stage, askEl } = ui.heroRunning(t);
        $('#hero-panel').classList.add('is-waiting');
        ui.setRow(t.id, 'running', 'Em andamento…');
        ui.heroProgress(0.15);
        // Chamado de forma síncrona dentro do toque: necessário para permissões do iOS e vibração.
        let p;
        try { p = t.run({ ...ctx, stage, ask: ui.makeAsk(askEl), overlay: $('#overlay') }); } catch (e) { p = Promise.reject(e); }
        Promise.resolve(p).then(resolve, (e) => {
          console.error(e);
          $('#overlay').hidden = true;
          resolve(fail('Não foi possível executar', 'Ocorreu um erro ao acessar este recurso.'));
        });
      },
    });
  });
}

async function startDiagnosis() {
  if (state.running) return;
  state.running = true; state.cancelled = false; state.skipInteractive = false;
  sound.play('start');
  ui.renderTestList(TESTS);
  ui.setOverall(0, TESTS.length, 'Verificação automática');
  $('#btn-skip-interactive').hidden = true;
  ui.showScreen('scan');
  await delay(300);

  const env = await collectEnv();
  const results = {};
  const ctx = { env, results, shared: {} };
  const ordered = [];

  for (let i = 0; i < TESTS.length; i++) {
    if (state.cancelled) break;
    const t = TESTS[i];
    if (t.interactive && i === autoTests.length) {
      ui.setOverall(i, TESTS.length, 'Testes interativos');
      $('#btn-skip-interactive').hidden = false;
    } else ui.setOverall(i, TESTS.length);

    const res = t.interactive ? await runInteractive(t, ctx) : await runAuto(t, ctx);
    if (state.cancelled) break;
    const full = { id: t.id, name: t.name, category: t.category, icon: t.icon, interactive: !!t.interactive, ...res };
    results[t.id] = full;
    ordered.push(full);

    ui.heroDone(full);
    ui.setRow(t.id, full.status, full.summary, 1);
    sound.play(full.status === 'pass' ? 'pass' : full.status === 'warn' ? 'warn' : full.status === 'fail' ? 'fail' : 'tick');
    // pausa curta para o check verde aparecer
    const showMs = prefersReducedMotion() ? 150 : (t.interactive ? 900 : 520);
    await delay(showMs);
  }

  state.running = false;
  $('#btn-skip-interactive').hidden = true;
  if (state.cancelled) return;
  ui.setOverall(TESTS.length, TESTS.length, 'Concluído');

  const report = {
    id: `pc-${Date.now().toString(36)}`,
    createdAt: Date.now(),
    deviceLabel: deviceLabel(env),
    osLabel: [env.os.name, env.os.version].filter(Boolean).join(' ') || 'Sistema desconhecido',
    browserLabel: [env.browser.name, env.browser.version.split('.')[0]].filter(Boolean).join(' '),
    results: ordered,
    summary: summarize(ordered),
  };
  state.report = report;
  history.add(report);
  sound.play('done');
  await delay(350);
  ui.renderResults(report);
  ui.showScreen('results');
}

function cancelDiagnosis() {
  state.cancelled = true;
  state.resolvePrompt?.();
  state.resolvePrompt = null;
  state.running = false;
  const ov = $('#overlay'); ov.hidden = true; ov.innerHTML = ''; ov.className = 'overlay';
}

// ------------------------------------------------------------------ eventos
async function goHome() {
  if (state.running) {
    if (!await ui.confirmDialog('Cancelar verificação?', 'O diagnóstico em andamento será interrompido e não será salvo.', 'Cancelar verificação', true)) return;
    cancelDiagnosis();
  }
  ui.showScreen('home');
}

async function openHistory() {
  if (state.running) {
    if (!await ui.confirmDialog('Abrir o histórico?', 'O diagnóstico em andamento será interrompido e não será salvo.', 'Abrir histórico', true)) return;
    cancelDiagnosis();
  }
  ui.renderHistory(history.all());
  ui.showScreen('history');
}

function bind() {
  $('#btn-start').addEventListener('click', startDiagnosis);
  $('#btn-repeat').addEventListener('click', startDiagnosis);
  $('#brand-home').addEventListener('click', goHome);
  $('#btn-history').addEventListener('click', openHistory);
  $('#btn-history-back').addEventListener('click', () => ui.showScreen(state.report ? 'results' : 'home'));

  $('#btn-theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('phonecheck.theme', next); } catch { /* ok */ }
  });
  $('#btn-sound').addEventListener('click', () => {
    const on = sound.toggle();
    applySound();
    ui.toast(on ? 'Efeitos sonoros ativados' : 'Efeitos sonoros desativados');
  });

  $('#btn-skip-interactive').addEventListener('click', () => {
    state.skipInteractive = true;
    state.resolvePrompt?.();
    state.resolvePrompt = null;
    $('#btn-skip-interactive').hidden = true;
  });

  $('#btn-pdf').addEventListener('click', async (e) => {
    if (!state.report) return;
    const btn = e.currentTarget; btn.disabled = true; btn.classList.add('is-loading');
    try { await exportPDF(state.report); ui.toast('Relatório PDF gerado', 'pass'); } catch (err) {
      console.error(err);
      if (err?.code === 'declined') return;
      if (window.PHONECHECK_EMBED) { ui.toast('Não foi possível salvar o PDF nesta visualização.', 'warn'); return; }
      ui.toast('Não foi possível gerar o PDF. Usando a impressão do navegador.', 'warn');
      setTimeout(() => window.print(), 400);
    } finally { btn.disabled = false; btn.classList.remove('is-loading'); }
  });

  $('#btn-share').addEventListener('click', async () => {
    if (!state.report) return;
    const r = await shareReport(state.report);
    if (r === 'copied') ui.toast('Resumo copiado para a área de transferência', 'pass');
    else if (r === 'failed') ui.toast('Não foi possível compartilhar neste navegador', 'warn');
  });

  $$('.filters .chip').forEach((c) => c.addEventListener('click', () => ui.applyFilter(c.dataset.filter)));

  $('#btn-history-clear').addEventListener('click', async () => {
    if (!history.all().length) return;
    if (!await ui.confirmDialog('Apagar histórico?', 'Todas as verificações salvas neste navegador serão removidas.', 'Apagar tudo', true)) return;
    history.clear();
    ui.renderHistory([]);
    ui.toast('Histórico apagado');
  });

  $('#history-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'start') { startDiagnosis(); return; }
    const id = btn.closest('.hi')?.dataset.id;
    if (btn.dataset.act === 'view') {
      const rep = history.get(id);
      if (!rep) return;
      state.report = rep;
      ui.renderResults(rep, { fromHistory: true });
      ui.showScreen('results');
    } else if (btn.dataset.act === 'del') {
      history.remove(id);
      ui.renderHistory(history.all());
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#overlay').hidden) $('#overlay .tt-done')?.click();
  });
}

function init() {
  hydrateIcons();
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  applySound();
  $('#stat-total-tests').textContent = String(TESTS.length);
  document.body.dataset.screen = 'home';
  bind();
  document.documentElement.classList.add('ready');
}

init();
