/* Divine AI — lógica da interface */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const P = window.DIVINE_PROVIDERS;
  const Icons = window.DivineIcons;

  const ALL = P.flatMap((p) => p.models.map((m) => ({ ...m, provider: p })));
  const findModel = (id) => ALL.find((m) => m.id === id) || ALL[0];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const state = {
    model: findModel(store.get("divine.model", "divine-1.0")),
    chats: store.get("divine.chats", []),
    currentId: null,
    tab: "all",
    toggles: { web: false, think: false },
    busy: false,
    available: null,
  };

  /* ---------- Model visual ---------- */
  function modelBadge(model, { size = "md" } = {}) {
    const isDivine = model.provider.id === "divine";
    return `<span class="mbadge ${size} ${isDivine ? "is-divine" : ""}" style="--pc:${model.provider.color}">
      <span class="mbadge-icon">${Icons.get(model.provider.icon)}</span>
      ${isDivine
        ? `<span class="divine-glow">Divine AI</span><span class="ver">1.0</span>`
        : `<span class="mbadge-name">${model.name}</span>`}
    </span>`;
  }

  function renderActiveModel() {
    const m = state.model;
    const isDivine = m.provider.id === "divine";
    $("#pillIcon").innerHTML = Icons.get(m.provider.icon);
    $("#pillName").innerHTML = isDivine ? `<span class="divine-glow">Divine AI</span> <span class="ver">1.0</span>` : m.name;
    $("#pillProvider").textContent = isDivine ? "Modelo próprio" : m.provider.company;
    $("#modelPill").classList.toggle("is-divine", isDivine);
    $("#modelPill").style.setProperty("--pc", m.provider.color);
    $("#composerModel").innerHTML = modelBadge(m, { size: "sm" });
    $("#input").placeholder = `Pergunte qualquer coisa ao ${isDivine ? "Divine AI 1.0" : m.name}...`;
    document.body.dataset.provider = m.provider.id;
    $$("#providersMini li").forEach((li) => li.classList.toggle("active", li.dataset.p === m.provider.id));
  }

  /* ---------- Sidebar providers ---------- */
  function renderProvidersMini() {
    $("#providersMini").innerHTML = P.map((p) => `
      <li data-p="${p.id}" title="${p.company}">
        <span class="pm-icon">${Icons.get(p.icon)}</span>
        <span class="pm-name">${p.id === "divine" ? "Divine AI" : p.name}</span>
        <span class="pm-count">${p.models.length}</span>
      </li>`).join("");
    $$("#providersMini li").forEach((li) => li.addEventListener("click", () => { state.tab = li.dataset.p; openModal(); }));
  }

  /* ---------- Model picker ---------- */
  function renderTabs() {
    const tabs = [{ id: "all", name: "Todos" }, ...P];
    $("#providerTabs").innerHTML = tabs.map((t) => `
      <button class="tab ${state.tab === t.id ? "active" : ""}" data-tab="${t.id}">
        ${t.icon ? `<span class="tab-icon">${Icons.get(t.icon)}</span>` : ""}
        ${t.id === "divine" ? "Divine AI" : t.name}
      </button>`).join("");
    $$("#providerTabs .tab").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; renderTabs(); renderModelList(); }));
  }

  function renderModelList() {
    const q = $("#modelSearch").value.trim().toLowerCase();
    const groups = P.filter((p) => state.tab === "all" || p.id === state.tab)
      .map((p) => ({ p, models: p.models.filter((m) => !q || (m.name + p.company + m.desc + m.tags.join(" ")).toLowerCase().includes(q)) }))
      .filter((g) => g.models.length);

    if (!groups.length) {
      $("#modelList").innerHTML = `<div class="empty">Nenhum modelo encontrado para “${q}”.</div>`;
      return;
    }

    $("#modelList").innerHTML = groups.map(({ p, models }) => `
      <div class="group">
        <div class="group-head">
          <span class="group-icon">${Icons.get(p.icon)}</span>
          <span>${p.id === "divine" ? "Divine AI" : p.name}</span>
          <small>${p.company} · ${p.models.length} ${p.models.length === 1 ? "modelo" : "modelos"}</small>
        </div>
        <div class="group-grid">
          ${models.map((m) => {
            const active = m.id === state.model.id;
            const divine = p.id === "divine";
            return `<button class="model-card ${active ? "active" : ""} ${divine ? "is-divine" : ""}" data-id="${m.id}" style="--pc:${p.color}">
              ${active ? `<span class="mc-icon">${Icons.get(p.icon)}</span>` : `<span class="mc-dot"></span>`}
              <span class="mc-body">
                <span class="mc-name">${divine ? `<span class="divine-glow">Divine AI</span> 1.0` : m.name}</span>
                <span class="mc-desc">${m.desc}</span>
                <span class="mc-tags">${m.tags.map((t) => `<i class="tag tag-${t.toLowerCase()}">${t}</i>`).join("")}<i class="tag ctx">${m.ctx} ctx</i>${state.available && state.available[m.id] !== "ok" ? `<i class="tag nokey">${state.available[m.id] === "noapi" ? "Sem API" : "Sem chave"}</i>` : ""}</span>
              </span>
              ${active ? `<svg class="check" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>` : ""}
            </button>`;
          }).join("")}
        </div>
      </div>`).join("");

    $$("#modelList .model-card").forEach((c) => c.addEventListener("click", () => selectModel(c.dataset.id)));
  }

  function selectModel(id) {
    state.model = findModel(id);
    store.set("divine.model", id);
    renderActiveModel();
    closeModal();
    toast(`${state.model.provider.id === "divine" ? "Divine AI 1.0" : state.model.name} ativado`);
  }

  function openModal() {
    $("#modelModal").hidden = false;
    renderTabs();
    renderModelList();
    requestAnimationFrame(() => $("#modelModal").classList.add("open"));
    setTimeout(() => $("#modelSearch").focus(), 50);
  }
  function closeModal() {
    $("#modelModal").classList.remove("open");
    setTimeout(() => ($("#modelModal").hidden = true), 180);
    $("#modelSearch").value = "";
  }

  /* ---------- Conversations ---------- */
  const currentChat = () => state.chats.find((c) => c.id === state.currentId);
  const saveChats = () => store.set("divine.chats", state.chats.slice(0, 40));

  function renderHistory() {
    if (!state.chats.length) {
      $("#history").innerHTML = `<li class="muted">Nenhuma conversa ainda</li>`;
      return;
    }
    $("#history").innerHTML = state.chats.map((c) => {
      const m = findModel(c.model);
      return `<li class="${c.id === state.currentId ? "active" : ""}" data-id="${c.id}">
        <span class="h-icon">${Icons.get(m.provider.icon)}</span>
        <span class="h-title">${escapeHtml(c.title)}</span>
        <button class="h-del" data-del="${c.id}" aria-label="Excluir">×</button>
      </li>`;
    }).join("");
    $$("#history li[data-id]").forEach((li) => li.addEventListener("click", (e) => {
      if (e.target.dataset.del) {
        state.chats = state.chats.filter((c) => c.id !== e.target.dataset.del);
        if (state.currentId === e.target.dataset.del) newChat();
        saveChats(); renderHistory(); return;
      }
      openChat(li.dataset.id);
    }));
  }

  function newChat() {
    state.currentId = null;
    $("#messages").innerHTML = "";
    $("#welcome").hidden = false;
    renderHistory();
    closeSidebar();
    $("#input").focus();
  }

  function openChat(id) {
    const c = state.chats.find((x) => x.id === id);
    if (!c) return;
    state.currentId = id;
    $("#welcome").hidden = true;
    $("#messages").innerHTML = "";
    c.messages.forEach((m) => appendMessage(m.role, m.content, findModel(m.model)));
    renderHistory();
    closeSidebar();
    scrollBottom();
  }

  /* ---------- Messages ---------- */
  function appendMessage(role, content, model) {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    if (role === "user") {
      el.innerHTML = `<div class="bubble">${escapeHtml(content)}</div>`;
    } else {
      el.innerHTML = `
        <div class="msg-head">${modelBadge(model, { size: "sm" })}</div>
        <div class="msg-body">${content ? renderMarkdown(content) : ""}</div>
        <div class="msg-actions">
          <button data-copy title="Copiar"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>
          <button title="Gostei"><svg viewBox="0 0 24 24"><path d="M7 10v11M15 5.9L14 10h5.8a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.4 21H7V10l4-8a3 3 0 0 1 4 3.9z"/></svg></button>
          <button title="Regenerar"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg></button>
        </div>`;
      el.querySelector("[data-copy]").addEventListener("click", () => {
        navigator.clipboard?.writeText(el.querySelector(".msg-body").innerText);
        toast("Copiado");
      });
    }
    $("#messages").appendChild(el);
    return el;
  }

  async function send(text) {
    if (!text.trim() || state.busy) return;
    state.busy = true;
    $("#welcome").hidden = true;

    let chat = currentChat();
    if (!chat) {
      chat = { id: "c" + Date.now(), title: text.slice(0, 48), model: state.model.id, messages: [] };
      state.chats.unshift(chat);
      state.currentId = chat.id;
    }
    chat.model = state.model.id;
    chat.messages.push({ role: "user", content: text });
    appendMessage("user", text);
    renderHistory();

    const model = state.model;
    const el = appendMessage("assistant", "", model);
    const body = el.querySelector(".msg-body");
    body.innerHTML = `<div class="typing">${state.toggles.think ? "<span class='think-label'>Raciocinando</span>" : ""}<i></i><i></i><i></i></div>`;
    scrollBottom();

    // Histórico enviado à API (sem a mensagem vazia do assistente)
    const history = chat.messages.map((m) => ({ role: m.role, content: m.content }));
    let out = "";
    let failed = null;
    try {
      const res = await fetch("api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: model.id, messages: history }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 404 || res.status === 405
        ? "Servidor da Divine AI não encontrado. Rode `node server.js` e abra http://localhost:3000."
        : `Erro ${res.status} do servidor.`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 2);
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5));
          if (ev.error) throw new Error(ev.error);
          if (ev.t) {
            out += ev.t;
            body.innerHTML = renderMarkdown(out) + `<span class="caret"></span>`;
            scrollBottom();
          }
        }
      }
      if (!out) throw new Error("O modelo não retornou texto.");
      body.innerHTML = renderMarkdown(out);
    } catch (e) {
      failed = e.message === "Failed to fetch"
        ? "Sem conexão com o servidor da Divine AI. Rode `node server.js` e abra http://localhost:3000."
        : e.message;
    }

    if (failed) {
      body.innerHTML = (out ? renderMarkdown(out) : "") + `<div class="msg-error">${renderMarkdown(failed)}</div>`;
      // Não salva respostas com erro, e remove a pergunta se nada veio, para poder tentar de novo
      if (!out) chat.messages.pop();
    }
    if (out) chat.messages.push({ role: "assistant", content: out, model: model.id });
    if (!chat.messages.length) state.chats = state.chats.filter((c) => c !== chat);
    saveChats();
    renderHistory();
    state.busy = false;
  }

  /* ---------- Status da API ---------- */
  async function loadStatus() {
    const el = $(".status");
    try {
      const res = await fetch("api/status");
      if (!res.ok) throw 0;
      const st = await res.json();
      state.available = st.available;
      const n = Object.values(st.available).filter((v) => v === "ok").length;
      el.classList.toggle("off", n === 0);
      el.innerHTML = n
        ? `<i></i> API conectada · ${n} modelos disponíveis`
        : `<i></i> Nenhuma chave de API configurada`;
    } catch {
      state.available = null;
      el.classList.add("off");
      el.innerHTML = `<i></i> Servidor offline`;
    }
    if (!$("#modelModal").hidden) renderModelList();
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function renderMarkdown(src) {
    const blocks = [];
    let s = src.replace(/```(\w*)\n([\s\S]*?)(```|$)/g, (_, lang, code) => {
      blocks.push(`<pre><div class="code-head"><span>${lang || "code"}</span></div><code>${escapeHtml(code)}</code></pre>`);
      return `\u0000${blocks.length - 1}\u0000`;
    });
    s = escapeHtml(s)
      .replace(/`([^`]+)`/g, "<code class='inline'>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");
    const lines = s.split("\n");
    let html = "", list = null;
    const close = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const line of lines) {
      let m;
      if ((m = line.match(/^\d+\.\s(.*)/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${m[1]}</li>`; }
      else if ((m = line.match(/^- (.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${m[1]}</li>`; }
      else if ((m = line.match(/^&gt;\s?(.*)/))) { close(); html += `<blockquote>${m[1]}</blockquote>`; }
      else if (line.trim() === "") { close(); }
      else { close(); html += `<p>${line}</p>`; }
    }
    close();
    return html.replace(/(<p>)?\u0000(\d+)\u0000(<\/p>)?/g, (_, a, i) => blocks[i]);
  }
  const scrollBottom = () => { const c = $("#chat"); c.scrollTop = c.scrollHeight; };
  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 1800);
  }
  const closeSidebar = () => $("#sidebar").classList.remove("open");

  /* ---------- Events ---------- */
  const input = $("#input");
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 220) + "px";
    $("#send").disabled = !input.value.trim();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#composer").requestSubmit(); }
  });
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = ""; input.style.height = "auto"; $("#send").disabled = true;
    send(v);
  });
  $$("#suggestions button").forEach((b) => b.addEventListener("click", () => send(b.dataset.prompt)));
  $$(".tool-btn.toggle").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.toggle;
    state.toggles[k] = !state.toggles[k];
    b.classList.toggle("on", state.toggles[k]);
  }));

  $("#modelPill").addEventListener("click", openModal);
  $("#composerModel").addEventListener("click", openModal);
  $$("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
  $("#modelSearch").addEventListener("input", renderModelList);
  $("#newChat").addEventListener("click", newChat);
  $("#openSidebar").addEventListener("click", () => $("#sidebar").classList.add("open"));
  $("#closeSidebar").addEventListener("click", closeSidebar);
  $("#shareBtn").addEventListener("click", () => { navigator.clipboard?.writeText(location.href); toast("Link copiado"); });
  $("#openSettings").addEventListener("click", () => toast("Configurações em breve"));

  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); $("#modelModal").hidden ? (state.tab = "all", openModal()) : closeModal(); }
    if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); newChat(); }
    if (e.key === "Escape" && !$("#modelModal").hidden) closeModal();
  });

  /* ---------- Init ---------- */
  Icons.hydrate();
  $("#statModels").textContent = ALL.length;
  $("#statProviders").textContent = P.length;
  renderProvidersMini();
  renderActiveModel();
  renderHistory();
  loadStatus();
})();
