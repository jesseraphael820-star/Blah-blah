// Renderização da interface: telas, lista de testes, painel principal, resultados e histórico.
import { $, $$, esc, fmtDateTime, fmtNum, prefersReducedMotion } from './utils.js';
import { icon, hydrateIcons } from './icons.js';
import { STATUS, CATEGORIES, scoreLabel, scoreTone } from './score.js';

// ---------------------------------------------------------------- telas
let current = 'home';
export function showScreen(name) {
  if (name === current) return;
  const from = $(`#screen-${current}`);
  const to = $(`#screen-${name}`);
  current = name;
  document.body.dataset.screen = name;
  document.dispatchEvent(new CustomEvent('screenchange', { detail: name }));
  const swap = () => {
    from.hidden = true; from.classList.remove('is-active', 'is-leaving');
    to.hidden = false;
    requestAnimationFrame(() => to.classList.add('is-active'));
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  };
  if (prefersReducedMotion()) { swap(); return; }
  from.classList.add('is-leaving');
  setTimeout(swap, 260);
}
export const currentScreen = () => current;

// ---------------------------------------------------------------- toast
export function toast(msg, tone = 'info') {
  const el = document.createElement('div');
  el.className = `toast tone-${tone}`;
  el.innerHTML = `${icon(tone === 'pass' ? 'check' : tone === 'warn' ? 'alert' : 'info')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

// ---------------------------------------------------------------- diálogo de confirmação
export function confirmDialog(title, text, okLabel = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.innerHTML = `<div class="dialog glass" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
      <h3 id="dlg-t">${esc(title)}</h3><p>${esc(text)}</p>
      <div class="hp-actions"><button class="btn btn-ghost" data-v="0">Voltar</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${esc(okLabel)}</button></div></div>`;
    const close = (v) => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 200); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    wrap.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) close(b.dataset.v === '1'); else if (e.target === wrap) close(false); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-v="1"]').focus();
  });
}

// ---------------------------------------------------------------- lista de testes
export function renderTestList(tests) {
  const ol = $('#test-list');
  let html = '';
  let group = null;
  tests.forEach((t) => {
    const g = t.interactive ? 'i' : 'a';
    if (g !== group) {
      group = g;
      html += `<li class="tr-group">${g === 'a' ? 'Verificação automática' : 'Testes interativos'}</li>`;
    }
    html += `<li class="tr" data-id="${t.id}" data-state="pending">
      <span class="tr-ico">${icon(t.icon)}</span>
      <div class="tr-body">
        <div class="tr-top"><b>${esc(t.name)}</b></div>
        <span class="tr-sum">${t.interactive ? 'Requer sua participação' : 'Aguardando'}</span>
        <div class="tr-bar"><i></i></div>
      </div>
      <span class="tr-badge"><span class="tr-dot"></span></span>
    </li>`;
  });
  ol.innerHTML = html;
}

export function setRow(id, state, summary, progress) {
  const li = $(`.tr[data-id="${id}"]`);
  if (!li) return;
  if (state) {
    li.dataset.state = state;
    const badge = li.querySelector('.tr-badge');
    if (state === 'running' || state === 'waiting') badge.innerHTML = '<span class="spin"></span>';
    else if (STATUS[state]) badge.innerHTML = `<span class="badge-ico tone-${STATUS[state].tone}">${icon(STATUS[state].icon)}</span>`;
  }
  if (summary != null) li.querySelector('.tr-sum').textContent = summary;
  if (progress != null) li.querySelector('.tr-bar i').style.transform = `scaleX(${progress})`;
  if (state === 'running' || state === 'waiting') {
    const list = li.closest('ol');
    if (list && list.scrollHeight > list.clientHeight) {
      const top = li.offsetTop - list.clientHeight / 2 + li.clientHeight / 2;
      list.scrollTo({ top, behavior: 'smooth' });
    }
  }
}

export function setOverall(done, total, phase) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('#scan-bar').style.transform = `scaleX(${pct / 100})`;
  $('#scan-pct').textContent = `${pct}%`;
  $('#scan-count').textContent = `Teste ${Math.min(done + 1, total)} de ${total}`;
  if (phase) $('#scan-phase').textContent = phase;
}

// ---------------------------------------------------------------- painel principal
const RING_C = 2 * Math.PI * 52;

function ringMarkup(t) {
  return `<div class="hp-visual">
    <div class="hp-radar"></div>
    <div class="hp-ring">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="hp-track" cx="60" cy="60" r="52"/>
        <circle class="hp-prog" cx="60" cy="60" r="52" style="stroke-dasharray:${RING_C};stroke-dashoffset:${RING_C}"/>
      </svg>
      <div class="hp-spinner"></div>
      <div class="hp-icon">${icon(t.icon)}</div>
      <div class="hp-result-ico"></div>
    </div>
    <div class="hp-beam"></div>
  </div>`;
}

export function heroRunning(t) {
  const hp = $('#hero-panel');
  hp.className = 'hero-panel glass is-running';
  hp.innerHTML = `${ringMarkup(t)}
    <div class="hp-info">
      <span class="hp-cat">${esc(t.category)}</span>
      <h3>${esc(t.name)}</h3>
      <p class="hp-status"><span class="typing">Analisando</span></p>
      <div class="bar hp-bar"><div class="bar-fill"></div></div>
      <div class="hp-stage"></div>
      <div class="hp-ask"></div>
    </div>`;
  return { stage: hp.querySelector('.hp-stage'), askEl: hp.querySelector('.hp-ask') };
}

export function heroProgress(p) {
  const hp = $('#hero-panel');
  const ring = hp.querySelector('.hp-prog');
  const bar = hp.querySelector('.hp-bar .bar-fill');
  if (ring) ring.style.strokeDashoffset = String(RING_C * (1 - p));
  if (bar) bar.style.transform = `scaleX(${p})`;
}

export function heroDone(result) {
  const hp = $('#hero-panel');
  const st = STATUS[result.status];
  hp.classList.remove('is-running', 'is-waiting');
  hp.classList.add('is-done', `tone-${st.tone}`);
  heroProgress(1);
  const ico = hp.querySelector('.hp-result-ico');
  if (ico) {
    ico.innerHTML = result.status === 'pass'
      ? `<svg viewBox="0 0 52 52" class="check-draw"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>`
      : icon(st.icon);
  }
  const s = hp.querySelector('.hp-status');
  if (s) s.innerHTML = `<span class="hp-verdict tone-${st.tone}">${icon(st.icon)} ${esc(st.label)}</span> <span class="hp-sum">${esc(result.summary)}</span>`;
}

export function heroPrompt(t, { onAccept, onSkip }) {
  const hp = $('#hero-panel');
  hp.className = 'hero-panel glass is-prompt';
  hp.innerHTML = `${ringMarkup(t)}
    <div class="hp-info">
      <span class="hp-cat">${esc(t.category)} · interativo</span>
      <h3>${esc(t.prompt.title)}</h3>
      <p class="hp-desc">${esc(t.prompt.text)}</p>
      <div class="hp-actions">
        <button class="btn btn-primary" data-act="accept">${icon('play')} ${esc(t.prompt.action)}</button>
        <button class="btn btn-ghost" data-act="skip">Pular</button>
      </div>
      <p class="hp-privacy">${icon('lock')} Processado localmente. Nada é gravado ou enviado.</p>
    </div>`;
  hp.querySelector('[data-act="accept"]').addEventListener('click', onAccept, { once: true });
  hp.querySelector('[data-act="skip"]').addEventListener('click', onSkip, { once: true });
  hp.querySelector('[data-act="accept"]').focus({ preventScroll: true });
}

export function makeAsk(askEl) {
  return (question, options) => new Promise((resolve) => {
    askEl.innerHTML = `<p class="ask-q">${esc(question)}</p><div class="hp-actions">${options.map(([v, label, kind]) => `<button class="btn btn-${kind || 'ghost'}" data-v="${v}">${esc(label)}</button>`).join('')}</div>`;
    askEl.classList.add('show');
    askEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      askEl.classList.remove('show'); askEl.innerHTML = '';
      resolve(b.dataset.v);
    }, { once: true }));
  });
}

// ---------------------------------------------------------------- tela de sucesso
function successSub(s) {
  const base = `${s.pass} de ${s.executed} teste${s.executed === 1 ? '' : 's'} aprovado${s.pass === 1 ? '' : 's'}`;
  return s.attention ? `${base} · ${s.attention} ${s.attention === 1 ? 'item precisa' : 'itens precisam'} de atenção` : `${base} · nenhum item precisa de atenção`;
}

export function showSuccess(summary) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'success-wrap';
    wrap.setAttribute('role', 'status');
    const sparks = Array.from({ length: 14 }, (_, i) => `<i style="--a:${(i / 14) * 360}deg;--d:${110 + (i % 3) * 26}px;--t:${i % 2 ? 0 : 80}ms"></i>`).join('');
    wrap.innerHTML = `<div class="sc-inner">
      <div class="sc-mark"><span class="sc-ring r1"></span><span class="sc-ring r2"></span><div class="sc-sparks">${sparks}</div>
        <svg viewBox="0 0 52 52" class="check-draw sc-check" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
      <h2>Verificado com sucesso!</h2>
      <p>${esc(successSub(summary))}</p>
      <button class="btn btn-primary" type="button">${icon('shieldCheck')} Ver relatório</button>
    </div>`;
    let done = false;
    const close = () => {
      if (done) return; done = true;
      wrap.classList.add('out');
      setTimeout(() => { wrap.remove(); resolve(); }, 380);
    };
    wrap.addEventListener('click', close);
    document.body.appendChild(wrap);
    wrap.querySelector('button').focus({ preventScroll: true });
    setTimeout(close, prefersReducedMotion() ? 1500 : 3200);
  });
}

// ---------------------------------------------------------------- resultados
function countUp(el, to, ms = 1400) {
  if (prefersReducedMotion()) { el.textContent = `${to}%`; return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = `${Math.round(to * e)}%`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function detailsMarkup(details) {
  if (!details?.length) return '';
  const row = ([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
  const head = details.slice(0, 3).map(row).join('');
  const rest = details.slice(3);
  return `<dl class="rc-det">${head}</dl>${rest.length ? `<details class="rc-more"><summary>Mais ${rest.length} detalhe${rest.length > 1 ? 's' : ''} ${icon('chevron')}</summary><dl class="rc-det">${rest.map(row).join('')}</dl></details>` : ''}`;
}

export function renderResults(report, { fromHistory = false } = {}) {
  const s = report.summary;
  const { date, time, long } = fmtDateTime(report.createdAt);
  $('#results-eyebrow').textContent = fromHistory ? 'Verificação salva no histórico' : 'Diagnóstico concluído';
  $('#sb-title').textContent = fromHistory ? 'Verificação concluída com sucesso' : 'Verificado com sucesso!';
  $('#sb-sub').textContent = `${successSub(s)} · ${date} às ${time}`;
  const sb = $('#success-banner'); sb.classList.remove('play'); void sb.offsetWidth; sb.classList.add('play');
  $('#results-meta').innerHTML = `${icon('history')} ${esc(long)} às ${esc(time)} · ${esc(report.deviceLabel)} · ${esc(report.osLabel)}`;

  // Gauge
  const card = $('.gauge-card');
  card.classList.remove('tone-pass', 'tone-warn', 'tone-fail');
  card.classList.add(`tone-${scoreTone(s.pct)}`);
  const C = 2 * Math.PI * 86;
  const g = $('#gauge-value');
  g.style.transition = 'none';
  g.style.strokeDasharray = `${C}`;
  g.style.strokeDashoffset = `${C}`;
  g.getBoundingClientRect();
  requestAnimationFrame(() => {
    g.style.transition = '';
    g.style.strokeDashoffset = `${C * (1 - s.pct / 100)}`;
  });
  countUp($('#gauge-pct'), s.pct);
  $('#gauge-label').textContent = s.executed ? scoreLabel(s.pct) : 'Sem testes executados';

  $('#st-run').textContent = s.executed;
  $('#st-pass').textContent = s.pass;
  $('#st-warn').textContent = s.attention;
  $('#st-na').textContent = s.na;

  // Gráfico por categoria
  const rows = CATEGORIES.map((cat) => {
    const list = report.results.filter((r) => r.category === cat);
    if (!list.length) return '';
    const c = { pass: 0, warn: 0, fail: 0, na: 0 };
    list.forEach((r) => { c[STATUS[r.status].tone]++; });
    const seg = (k) => (c[k] ? `<i class="seg ${k}" style="--w:${(c[k] / list.length) * 100}%" title="${c[k]}"></i>` : '');
    return `<div class="cat-row"><span class="cat-name">${esc(cat)}</span><div class="cat-bar">${seg('pass')}${seg('warn')}${seg('fail')}${seg('na')}</div><span class="cat-val">${c.pass}/${list.length}</span></div>`;
  }).join('');
  $('#cat-chart').innerHTML = rows;

  // Cartões
  const order = { fail: 0, warn: 1, pass: 2, unavailable: 3, skipped: 4 };
  const sorted = [...report.results].sort((a, b) => order[a.status] - order[b.status]);
  $('#report-grid').innerHTML = sorted.map((r, i) => {
    const st = STATUS[r.status];
    const group = r.status === 'pass' ? 'pass' : (r.status === 'warn' || r.status === 'fail') ? 'attention' : 'na';
    return `<article class="rc glass tone-${st.tone}" data-group="${group}" style="--i:${i}">
      <header>
        <span class="rc-ico">${icon(r.icon)}</span>
        <div class="rc-title"><span class="rc-cat">${esc(r.category)}</span><h4>${esc(r.name)}</h4></div>
        <span class="pill tone-${st.tone}">${icon(st.icon)} ${esc(st.label)}</span>
      </header>
      <p class="rc-sum">${esc(r.summary)}</p>
      ${detailsMarkup(r.details)}
      ${r.note ? `<p class="rc-note">${icon('info')} ${esc(r.note)}</p>` : ''}
    </article>`;
  }).join('');
  applyFilter('all');
}

export function applyFilter(f) {
  $$('.filters .chip').forEach((c) => { const on = c.dataset.filter === f; c.classList.toggle('is-active', on); c.setAttribute('aria-selected', String(on)); });
  $$('#report-grid .rc').forEach((c) => { c.hidden = f !== 'all' && c.dataset.group !== f; });
}

// ---------------------------------------------------------------- histórico
export function renderHistory(list) {
  const el = $('#history-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty glass">${icon('history')}<h3>Nenhuma verificação salva</h3><p>Os diagnósticos concluídos aparecem aqui, armazenados apenas neste navegador.</p><button class="btn btn-primary" data-act="start">${icon('play')} Iniciar verificação</button></div>`;
    return;
  }
  const C = 2 * Math.PI * 20;
  el.innerHTML = list.map((rep) => {
    const { date, time } = fmtDateTime(rep.createdAt);
    const s = rep.summary;
    const tone = scoreTone(s.pct);
    return `<article class="hi glass" data-id="${esc(rep.id)}">
      <div class="hi-ring tone-${tone}"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" class="t"/><circle cx="24" cy="24" r="20" class="v" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - s.pct / 100)}"/></svg><b>${s.pct}%</b></div>
      <div class="hi-body">
        <h4>${esc(date)} <span>${esc(time)}</span></h4>
        <p>${esc(rep.deviceLabel)} · ${esc(rep.osLabel)}</p>
        <div class="hi-tags"><span class="tag pass">${s.pass} aprovados</span>${s.attention ? `<span class="tag warn">${s.attention} atenção</span>` : ''}<span class="tag na">${s.na} N/D</span></div>
      </div>
      <div class="hi-actions">
        <button class="btn btn-ghost btn-sm" data-act="view">${icon('eye')} Ver</button>
        <button class="icon-btn" data-act="del" aria-label="Excluir">${icon('trash')}</button>
      </div>
    </article>`;
  }).join('');
}

// ---------------------------------------------------------------- leitor de câmera
const CAM_ITEMS = [
  ['camera', 'Imagem recebida', 'A câmera entrega quadros ao vivo'],
  ['timer', 'Taxa de quadros', 'Quantos quadros por segundo chegam'],
  ['monitor', 'Resolução', 'Tamanho real da imagem capturada'],
  ['sun', 'Exposição', 'Imagem nem preta nem estourada'],
  ['eye', 'Foco e nitidez', 'Detalhes visíveis, lente limpa'],
  ['activity', 'Ruído do sensor', 'Granulado com o aparelho parado'],
  ['grid', 'Cores', 'Os três canais de cor respondem'],
  ['refresh', 'Imagem ao vivo', 'A imagem não está congelada'],
];

export function cameraIdle(blockedText) {
  $('#cam-stage').innerHTML = `<div class="cam-idle ${blockedText ? 'blocked' : ''}">
    <div class="ci-icon">${icon('camera')}<span class="ci-scan"></span></div>
    <p>${esc(blockedText || 'Toque em "Abrir câmera" e permita o acesso quando o navegador pedir.')}</p></div>`;
  $('#cam-side-title').textContent = 'O que é verificado';
  $('#cam-checks').innerHTML = `<ul class="cam-list">${CAM_ITEMS.map(([ic, n, d]) => `<li><span class="cl-ico">${icon(ic)}</span><div><b>${esc(n)}</b><span>${esc(d)}</span></div></li>`).join('')}</ul>`;
}

export function cameraResult(out) {
  const st = STATUS[out.status];
  const title = out.status === 'pass' ? 'Câmera funcionando normalmente' : out.status === 'warn' ? 'Câmera funciona, com ressalvas' : 'Problema detectado na câmera';
  $('#cam-side-title').textContent = 'Resultado';
  const icoFor = (name) => (CAM_ITEMS.find((c) => c[1] === name) || ['info'])[0];
  $('#cam-checks').innerHTML = `<div class="cam-verdict tone-${st.tone}"><span class="badge-ico tone-${st.tone}">${icon(st.icon)}</span><div><b>${esc(title)}</b><span>${esc(out.note)}</span></div></div>
    <ul class="cam-list done">${out.checks.map((c, i) => {
      const t = STATUS[c.status];
      return `<li style="--i:${i}" class="tone-${t.tone}"><span class="cl-ico">${icon(icoFor(c.name))}</span><div><b>${esc(c.name)}</b><span>${esc(c.hint || t.label)}</span></div><em>${esc(c.value)}</em><span class="badge-ico tone-${t.tone}">${icon(t.icon)}</span></li>`;
    }).join('')}</ul>`;
}

export function cameraError(text) {
  $('#cam-stage').innerHTML = `<div class="cam-idle blocked"><div class="ci-icon">${icon('alert')}</div><p>${esc(text)}</p></div>`;
}

export { hydrateIcons, fmtNum };
