/* Interface: HUD, barra de ferramentas, painel de população, chat da IA */
(function () {
  const C = window.CITY;
  const S = C.sim, W = C.world, CAT = C.CATALOG;
  const $ = (id) => document.getElementById(id);
  const UI = (C.ui = {});

  const ICON = {
    roads: '<path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3"/>',
    zones: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    buildings: '<path d="M4 21V8l6-4v17M10 21V10h10v11M13.5 13h1M16.5 13h1M13.5 16.5h1M16.5 16.5h1M6.5 10h1M6.5 13.5h1M6.5 17h1M2 21h20"/>',
    services: '<path d="M12 3l9 5H3zM5.5 11v7M9.5 11v7M14.5 11v7M18.5 11v7M3 21h18"/>',
    utilities: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    environment: '<path d="M12 2l6 8h-3l4 6H5l4-6H6zM12 16v6"/>',
    landmarks: '<path d="M12 2v4M9.5 6h5l-.8 4h-3.4zM10.3 10L8.5 21h7l-1.8-11M6 21h12"/>',
    bulldoze: '<path d="M3 16h10v5H3zM5 16V9h5l3 7M13 18h3l5-6-2.5-2L14 15"/>',
    maps: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>'
  };
  const CATS = [
    { id: 'roads', name: 'Ruas', items: ['road'] },
    { id: 'zones', name: 'Zonas', items: ['zoneR', 'zoneC', 'zoneI', 'dezone'] },
    { id: 'buildings', name: 'Prédios', items: ['casa', 'edificio', 'torre_res', 'loja', 'escritorio', 'arranha_ceu', 'fabrica', 'armazem', 'tecnologia'] },
    { id: 'services', name: 'Serviços', items: ['prefeitura', 'hospital', 'policia', 'bombeiros', 'escola'] },
    { id: 'utilities', name: 'Energia/Água', items: ['eolica', 'solar', 'carvao', 'agua'] },
    { id: 'environment', name: 'Ambiente', items: ['parque', 'parque_grande', 'praca', 'arvore', 'reciclagem', 'hub'] },
    { id: 'landmarks', name: 'Marcos', items: ['torre', 'estadio', 'corporativo', 'shopping'] },
    { id: 'bulldoze', name: 'Demolir', tool: 'bulldoze' },
    { id: 'maps', name: 'Mapas', maps: true }
  ];
  const MAPS = [
    { id: null, name: 'Nenhum', sw: 'linear-gradient(135deg,#dfe8ee,#b7c6d1)' },
    { id: 'pol', name: 'Poluição', sw: 'linear-gradient(135deg,#7bd389,#f2c94c,#8b4513)' },
    { id: 'lv', name: 'Valor do solo', sw: 'linear-gradient(135deg,#e74c3c,#f1c40f,#2ecc71)' },
    { id: 'cov', name: 'Serviços', sw: 'linear-gradient(135deg,#1e88e5,#00b8a9)' },
    { id: 'zones', name: 'Zoneamento', sw: 'linear-gradient(135deg,#3fbf5a,#3b8fe0,#e3b23c)' }
  ];
  const thumbs = {};
  let openCat = null;

  UI.init = function () {
    // categorias
    const cats = $('cats');
    for (const c of CATS) {
      const b = document.createElement('button');
      b.className = 'cat'; b.dataset.cat = c.id;
      b.innerHTML = `<span class="ic"><svg viewBox="0 0 24 24">${ICON[c.id]}</svg></span>${c.name}`;
      b.onclick = () => {
        if (c.tool) { const on = !(C.game.tool && C.game.tool.id === 'bulldoze'); closeTray(); C.game.setTool(on ? 'bulldoze' : null); b.classList.toggle('on', on); return; }
        if (openCat === c.id) { closeTray(); return; }
        openTray(c);
      };
      cats.appendChild(b);
    }
    // velocidade
    $('speed').querySelectorAll('button').forEach((b) => (b.onclick = () => UI.setSpeed(+b.dataset.s)));
    UI.setSpeed(1);
    $('tax').oninput = (e) => { S.tax = +e.target.value; UI.update(); };
    $('sideToggle').onclick = () => $('side').classList.toggle('closed');
    $('aiHead').onclick = (e) => { if (e.target.id === 'aiMin' || e.target.closest('#aiHead')) $('ai').classList.toggle('open'); };
    $('aiForm').onsubmit = (e) => { e.preventDefault(); const v = $('aiText').value.trim(); if (v) { $('aiText').value = ''; UI.ask(v); } };
    // renomear direto no topo (sem prompt(), que não funciona em todos os navegadores incorporados)
    const cn = $('cityName');
    cn.onclick = () => {
      if (cn.isContentEditable) return;
      cn.contentEditable = 'true'; cn.focus();
      const r = document.createRange(); r.selectNodeContents(cn);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    };
    const commitName = () => {
      const n = cn.textContent.trim();
      if (n) S.name = n.slice(0, 32);
      cn.contentEditable = 'false';
      UI.update();
    };
    cn.addEventListener('blur', commitName);
    cn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cn.blur(); }
      if (e.key === 'Escape') { cn.textContent = S.name; cn.blur(); }
      e.stopPropagation();
    });
    $('btnSave').onclick = () => { C.game.save(); UI.toast('💾 Cidade salva!', 'good'); };
    $('btnDay').onclick = () => {
      const modes = ['auto', 'day', 'night'], names = { auto: '☀ Auto', day: '☀ Dia', night: '🌙 Noite' };
      C.game.dayMode = modes[(modes.indexOf(C.game.dayMode) + 1) % 3];
      $('btnDay').textContent = names[C.game.dayMode];
    };
    S.listeners.push((m, k) => UI.toast(m, k));
    setInterval(UI.update, 250);
  };

  function closeTray() { openCat = null; $('tray').classList.remove('open'); document.querySelectorAll('.cat').forEach((b) => b.classList.remove('on')); }
  UI.closeTray = closeTray;
  function openTray(c) {
    openCat = c.id;
    document.querySelectorAll('.cat').forEach((b) => b.classList.toggle('on', b.dataset.cat === c.id));
    const tray = $('tray');
    tray.innerHTML = '';
    if (c.maps) {
      for (const m of MAPS) {
        const b = document.createElement('button');
        b.className = 'item' + (C.game.map === m.id ? ' on' : '');
        b.innerHTML = `<div class="thumb"><div class="sw" style="background:${m.sw}"></div></div><div class="nm">${m.name}</div><div class="pr" style="color:#4b5966">Mapa de dados</div>`;
        b.onclick = () => { C.game.setMap(m.id); tray.querySelectorAll('.item').forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
        tray.appendChild(b);
      }
    } else {
      for (const id of c.items) {
        const it = CAT[id];
        const b = document.createElement('button');
        b.className = 'item' + (C.game.tool && C.game.tool.id === id ? ' on' : '');
        b.dataset.id = id;
        b.title = it.desc || '';
        const price = id === 'road' ? `${S.fmt(it.cost)}/lote` : id.startsWith('zone') ? `${S.fmt(it.cost)}/lote` : id === 'dezone' ? 'Grátis' : id === 'arvore' ? `${S.fmt(it.cost)}/lote` : S.fmt(it.cost);
        let thumb;
        if (thumbs[id]) thumb = `<img src="${thumbs[id]}" alt="">`;
        else if (it.zone) thumb = `<div class="sw" style="background:${it.color};box-shadow:inset 0 0 0 4px rgba(255,255,255,.6)"></div>`;
        else if (id === 'road') thumb = `<div class="sw" style="background:repeating-linear-gradient(90deg,#3b3c3f 0 18px,#e5c04a 18px 21px,#3b3c3f 21px 24px,#e5c04a 24px 27px,#3b3c3f 27px 46px);border-left:5px solid #b8b3a8;border-right:5px solid #b8b3a8"></div>`;
        else if (id === 'dezone') thumb = `<div class="sw" style="background:repeating-linear-gradient(45deg,#ddd 0 6px,#fff 6px 12px);border:2px dashed #999"></div>`;
        else thumb = `<div class="sw" style="background:#5d7d3a"></div>`;
        b.innerHTML = `<div class="thumb">${thumb}</div><div class="nm">${it.name}</div><div class="pr">${price}</div>`;
        b.onclick = () => {
          const same = C.game.tool && C.game.tool.id === id;
          C.game.setTool(same ? null : id);
          tray.querySelectorAll('.item').forEach((x) => x.classList.toggle('on', !same && x.dataset.id === id));
        };
        tray.appendChild(b);
      }
    }
    tray.classList.add('open');
  }
  UI.refreshTrayTool = function () {
    $('tray').querySelectorAll('.item').forEach((x) => x.classList.toggle('on', !!(C.game.tool && x.dataset.id === C.game.tool.id)));
    if (!C.game.tool) document.querySelector('.cat[data-cat="bulldoze"]').classList.remove('on');
  };

  UI.setSpeed = function (s) {
    C.game.speed = s; S.speed = s;
    $('speed').querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.s === s));
  };

  // ---------- miniaturas 3D renderizadas ----------
  UI.makeThumbs = function () {
    const ids = [];
    for (const c of CATS) if (c.items) for (const id of c.items) if (C.models.svc[id] || CAT[id].grow) ids.push(id);
    const w = 236, h = 148;
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    r.setSize(w, h); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xdfefff, 0x6b7a5a, 0.9));
    const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(5, 9, 6); sc.add(d);
    if (C.envMap) sc.environment = C.envMap;
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 500);
    for (const id of ids) {
      let obj;
      const it = CAT[id];
      if (it.grow) {
        const list = C.models.archList(it.grow[0], +it.grow[1]);
        const a = C.models.arch[list[0]];
        obj = new THREE.Group();
        for (const p of a.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.applyMatrix4(p.m); obj.add(m); }
        const lot = new THREE.Mesh(C.models.plane(4, 4), C.models.lot(a.lot)); lot.position.y = 0.01; obj.add(lot);
      } else obj = C.models.svc[id]();
      sc.add(obj);
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const dist = Math.max(size.x, size.z, size.y * 1.2) * 1.9 + 2;
      cam.position.set(ctr.x + dist * 0.75, ctr.y + dist * 0.55, ctr.z + dist * 0.85);
      cam.lookAt(ctr);
      r.render(sc, cam);
      thumbs[id] = r.domElement.toDataURL('image/png');
      sc.remove(obj);
    }
    r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
  };

  // ---------- HUD ----------
  let lastPop = 0;
  UI.update = function () {
    if (!$('cityName').isContentEditable) $('cityName').textContent = S.name;
    $('cityName2').textContent = S.name;
    document.title = `${S.name} — Metrópolis`;
    $('date').textContent = S.dateStr();
    $('money').textContent = S.fmt(S.money);
    $('money').classList.toggle('neg', S.money < 0);
    const bal = S.monthIncome - S.monthExpense;
    $('balance').textContent = (bal >= 0 ? '+' : '−') + S.fmt(Math.abs(bal)).replace('§ ', '§') + '/mês';
    $('balance').className = 'sub ' + (bal >= 0 ? 'pos' : 'neg');
    const popStr = S.pop.toLocaleString('pt-BR');
    $('pop').textContent = popStr; $('popTop').textContent = popStr;
    const h = S.popHist, prev = h.length > 6 ? h[h.length - 7] : 0;
    const diff = S.pop - prev;
    $('popTrend').textContent = S.pop === 0 ? 'Aguardando os primeiros moradores' : (diff >= 0 ? '▲ +' : '▼ ') + diff.toLocaleString('pt-BR') + ' no último mês';
    bar('happyBar', S.happy / 100, S.happy > 60 ? 'var(--good)' : S.happy > 40 ? 'var(--warn)' : 'var(--bad)');
    $('happy').textContent = Math.round(S.happy) + '%';
    const pr = S.power.prod ? S.power.use / S.power.prod : (S.power.use ? 1.2 : 0);
    bar('powerBar', Math.min(1, pr), pr > 1 ? 'var(--bad)' : pr > 0.85 ? 'var(--warn)' : 'var(--good)');
    $('power').textContent = `${Math.round(S.power.use)}/${Math.round(S.power.prod)}`;
    const wr = S.water.prod ? S.water.use / S.water.prod : (S.water.use ? 1.2 : 0);
    bar('waterBar', Math.min(1, wr), wr > 1 ? 'var(--bad)' : wr > 0.85 ? 'var(--warn)' : '#2d9cdb');
    $('water').textContent = `${Math.round(S.water.use)}/${Math.round(S.water.prod)}`;
    $('jobsC').textContent = S.jobsC.toLocaleString('pt-BR');
    $('jobsI').textContent = S.jobsI.toLocaleString('pt-BR');
    $('jobsS').textContent = S.jobsS.toLocaleString('pt-BR');
    for (const k of ['R', 'C', 'I']) {
      const v = S.demand[k], el = $('d' + k);
      if (v >= 0) { el.style.bottom = '50%'; el.style.top = 'auto'; el.style.height = (v * 50) + '%'; }
      else { el.style.top = '50%'; el.style.bottom = 'auto'; el.style.height = (-v * 50) + '%'; }
    }
    if (document.activeElement !== $('tax')) $('tax').value = S.tax;
    $('taxVal').textContent = S.tax + '%';
    const ag = C.agents.counts();
    $('counts').textContent = `${ag.people} pedestres e ${ag.cars} carros nas ruas agora`;
    if (S.pop !== lastPop) { lastPop = S.pop; }
    spark();
  };
  function bar(id, f, color) { const e = $(id); e.style.width = Math.max(0, Math.min(1, f)) * 100 + '%'; e.style.background = color; }
  function spark() {
    const cv = $('spark'), g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    const d = S.popHist.concat([S.pop]);
    if (d.length < 2) return;
    const max = Math.max(10, ...d);
    g.beginPath();
    d.forEach((v, i) => { const x = i / (d.length - 1) * w, y = h - 4 - v / max * (h - 10); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2; g.stroke();
    g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fill();
  }

  // ---------- toasts / tooltip / info ----------
  UI.toast = function (msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, 3800);
  };
  UI.tooltip = function (html, x, y) {
    const t = $('tooltip');
    if (!html) { t.style.display = 'none'; return; }
    t.innerHTML = html; t.style.display = 'block';
    t.style.left = Math.min(window.innerWidth - t.offsetWidth - 8, x + 16) + 'px';
    t.style.top = (y + 18) + 'px';
  };
  const ZN = { R: ['Casa', 'Edifício Residencial', 'Torre Residencial'], C: ['Loja', 'Prédio Comercial', 'Arranha-céu Comercial'], I: ['Fábrica', 'Indústria / Armazém', 'Indústria de Tecnologia'] };
  UI.showInfo = function (x, z) {
    const t = W.get(x, z), el = $('info');
    if (!t) { el.classList.remove('open'); return; }
    const i = W.idx(x, z);
    const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    let html = '<button class="x" onclick="this.parentNode.classList.remove(\'open\')">×</button>';
    const common = kv('Valor do solo', Math.round(S.lv[i] * 100) + '%') + kv('Poluição', Math.round(S.pol[i]) + '%');
    if (t.b) {
      const b = t.b, cap = C.CAP[b.zone][b.level];
      html += `<h3>${ZN[b.zone][b.level - 1]}</h3><div class="k">Nível ${b.level} · ${b.zone === 'R' ? 'Residencial' : b.zone === 'C' ? 'Comercial' : 'Industrial'}</div>`;
      html += kv(b.zone === 'R' ? 'Moradores' : 'Empregos', `${Math.round(cap * b.occ)} / ${cap}`);
      html += kv('Ocupação', Math.round(b.occ * 100) + '%') + common;
      html += kv('Acesso à rua', W.access(x, z, 2) ? '✔' : '✖');
    } else if (t.t === 'svc') {
      const s = W.services.get(t.svc), it = CAT[s.type];
      html += `<h3>${it.name}</h3><div class="k">${it.desc}</div>`;
      html += kv('Status', s.active ? '✔ Funcionando' : '✖ Sem rua conectada') + kv('Manutenção', S.fmt(it.upkeep || 0) + '/mês');
      const e = it.eff || {};
      if (e.power) html += kv('Energia', '+' + e.power + ' MW');
      if (e.water) html += kv('Água', '+' + e.water + ' m³');
      if (e.jobs) html += kv('Empregos', e.jobs);
    } else if (t.t === 'road') {
      html += `<h3>${t.fixed ? 'Rodovia Regional' : t.water ? 'Ponte' : 'Rua'}</h3><div class="k">${W.connected[i] ? 'Conectada à rodovia' : '⚠ Desconectada da rodovia'}</div>` + common;
    } else if (t.water) {
      html += '<h3>Rio</h3><div class="k">Construa ruas por cima para fazer pontes (custo triplo).</div>';
    } else {
      html += `<h3>${t.zone ? CAT['zone' + t.zone].name : 'Terreno vazio'}</h3><div class="k">${t.trees ? 'Área arborizada' : t.zone ? (W.access(x, z, 2) ? 'Aguardando construção' : '⚠ Precisa de rua a até 2 lotes') : 'Livre para construir'}</div>` + common;
      html += kv('Cobertura', ['police', 'fire', 'health', 'edu'].filter((k) => S.cover[k][i]).map((k) => ({ police: '🚓', fire: '🚒', health: '🏥', edu: '🎓' })[k]).join(' ') || '—');
    }
    el.innerHTML = html;
    el.classList.add('open');
  };
  UI.hideInfo = () => $('info').classList.remove('open');

  // ---------- chat da IA ----------
  const msgs = () => $('aiMsgs');
  function scroll() { const m = msgs(); m.scrollTop = m.scrollHeight; }
  UI.say = function (html, who) {
    const d = document.createElement('div');
    d.className = 'msg ' + (who || 'bot');
    d.innerHTML = html;
    msgs().appendChild(d); scroll();
    return d;
  };
  UI.chips = function (list) {
    const c = $('aiChips');
    c.innerHTML = '';
    for (const t of list || []) {
      const b = document.createElement('button');
      b.textContent = t; b.type = 'button';
      b.onclick = () => UI.ask(t);
      c.appendChild(b);
    }
  };
  let currentCard = null;
  UI.ask = function (text) {
    $('ai').classList.add('open');
    UI.say(escapeHtml(text), 'me');
    UI.chips([]);
    const typing = UI.say('Iara está analisando o mapa…', 'bot typing');
    setTimeout(() => {
      typing.remove();
      let res;
      try { res = C.ai.handle(text); } catch (e) { console.error(e); res = { reply: 'Ops, tive um problema para planejar isso. Tente de outro jeito.' }; }
      if (res.confirm && currentCard) { currentCard.querySelector('.yes').click(); return; }
      if (res.cancel && currentCard) { currentCard.querySelector('.no').click(); return; }
      if (res.plan) UI.showPlan(res.plan);
      else { UI.say(res.reply); UI.chips(res.chips); }
    }, 450 + Math.random() * 300);
  };
  function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  UI.showPlan = function (plan) {
    if (currentCard && !currentCard.classList.contains('done')) closeCard(currentCard, '↺ Substituído por um novo plano', '#8a96a3');
    const card = document.createElement('div');
    card.className = 'plan';
    const after = S.money - plan.cost;
    const afford = after >= 0;
    card.innerHTML = `<div class="ph">🤖 ${plan.intro}</div>
      <ul>${plan.lines.map((l) => `<li><span>${l.label}</span><span>${l.cost ? S.fmt(l.cost) : '—'}</span></li>`).join('')}</ul>
      <div class="tot"><span>Custo total</span><span>${S.fmt(plan.cost)}</span></div>
      <div class="after">Saldo após a obra: <b style="color:${afford ? 'inherit' : 'var(--bad)'}">${S.fmt(after)}</b>${afford ? '' : ' — saldo insuficiente'}</div>
      ${plan.notes && plan.notes.length ? `<div class="notes">ℹ ${plan.notes.join('<br>ℹ ')}</div>` : ''}
      <div class="acts"><button class="yes" ${afford ? '' : 'disabled'}>✔ Confirmar</button><button class="no">✖ Não</button></div>
      <div class="stamp"></div>`;
    msgs().appendChild(card); scroll();
    currentCard = card;
    C.game.previewPlan(plan);
    card.querySelector('.yes').onclick = () => {
      if (card.classList.contains('done')) return;
      if (S.money < plan.cost) { UI.toast('Saldo insuficiente para esta obra.', 'bad'); return; }
      C.game.clearPreview();
      const r = C.ai.execute(plan);
      closeCard(card, `✔ Construído! Investimento de ${S.fmt(r.spent)}`, 'var(--good)');
      UI.toast('🏗️ Obra concluída: ' + plan.lines.map((l) => l.label).join(', '), 'good');
      const a = C.ai.advice();
      setTimeout(() => { UI.say('Prontinho! ' + (a.tips[0] ? 'Próximo passo sugerido: ' + a.tips[0] : '')); UI.chips(a.chips); }, 500);
    };
    card.querySelector('.no').onclick = () => {
      if (card.classList.contains('done')) return;
      C.game.clearPreview();
      C.ai.pending = null;
      closeCard(card, '✖ Cancelado — nada foi construído', 'var(--bad)');
      UI.say('Tudo bem, não construí nada. Quer que eu planeje outra coisa?');
      UI.chips(['O que devo fazer?', 'Como está a cidade?']);
    };
  };
  function closeCard(card, text, color) {
    card.classList.add('done');
    const st = card.querySelector('.stamp');
    st.textContent = text; st.style.color = color;
    if (currentCard === card) currentCard = null;
  }
})();
