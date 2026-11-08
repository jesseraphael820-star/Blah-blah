"use strict";

// ===== Configuração =====
const API_URL = "https://api.anthropic.com/v1/messages";
const CHAVE_LS = "saboria.chave";
const MODELO_LS = "saboria.modelo";
const HIST_LS = "saboria.historico";
const MAX_HIST = 20;

const $ = (id) => document.getElementById(id);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "reconhecido", "nome", "categoria", "tipo", "nota_geral", "veredito", "subnotas",
    "potencial", "efeitos", "pontos_positivos", "pontos_negativos", "nutricao",
    "harmonizacao", "melhor_momento", "dica", "alerta",
  ],
  properties: {
    reconhecido: { type: "boolean", description: "true se a imagem mostra uma bebida ou comida" },
    nome: { type: "string" },
    categoria: { type: "string", description: "Ex.: Energético, Suco natural, Fast food, Sobremesa" },
    tipo: { type: "string", enum: ["bebida", "comida", "outro"] },
    nota_geral: { type: "number", description: "0 a 10, uma casa decimal" },
    veredito: { type: "string", description: "Uma frase curta resumindo a avaliação" },
    subnotas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterio", "nota"],
        properties: { criterio: { type: "string" }, nota: { type: "number" } },
      },
    },
    potencial: { type: "string", description: "Potencial da bebida/comida: energia, saciedade, recuperação, sabor, etc." },
    efeitos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["emoji", "titulo", "descricao"],
        properties: { emoji: { type: "string" }, titulo: { type: "string" }, descricao: { type: "string" } },
      },
    },
    pontos_positivos: { type: "array", items: { type: "string" } },
    pontos_negativos: { type: "array", items: { type: "string" } },
    nutricao: {
      type: "object",
      additionalProperties: false,
      required: ["porcao", "calorias_kcal", "acucar_g", "proteina_g", "gordura_g", "cafeina_mg"],
      properties: {
        porcao: { type: "string" },
        calorias_kcal: { type: "number" },
        acucar_g: { type: "number" },
        proteina_g: { type: "number" },
        gordura_g: { type: "number" },
        cafeina_mg: { type: "number" },
      },
    },
    harmonizacao: { type: "array", items: { type: "string" } },
    melhor_momento: { type: "string" },
    dica: { type: "string" },
    alerta: { type: "string", description: "Alerta de saúde importante, ou string vazia se não houver" },
  },
};

const SISTEMA = `Você é um avaliador especialista em nutrição, gastronomia e bebidas.
Recebe a foto de uma bebida ou comida e devolve uma avaliação honesta em português do Brasil.

Regras:
- Identifique o item (marca, se visível) e a categoria.
- nota_geral de 0 a 10 (uma casa decimal), equilibrando saúde, sabor/qualidade e custo-benefício. Seja justo: refrigerante comum fica baixo em saúde, salada bem montada fica alto, etc.
- subnotas: 4 critérios, cada um de 0 a 10. Para bebidas use: Saúde, Sabor, Energia, Hidratação. Para comidas use: Saúde, Sabor, Saciedade, Apresentação.
- potencial: 2 a 3 frases sobre o que o item pode oferecer (energia, foco, recuperação, prazer, saciedade…).
- efeitos: 3 a 6 efeitos concretos no corpo (ex.: pico de glicose, estímulo da cafeína, hidratação, reposição de eletrólitos), com emoji.
- nutricao: estimativa para a porção visível na foto; use 0 quando não se aplica.
- harmonizacao: 3 a 5 comidas/bebidas que combinam.
- alerta: só preencha quando houver algo importante (excesso de cafeína, álcool, alergênicos comuns, açúcar muito alto); senão deixe "".
- Se a imagem não for comida nem bebida, use reconhecido=false, tipo="outro", nota_geral=0 e explique no veredito.`;

// ===== Estado =====
let imagemAtual = null; // { base64, mediaType, dataUrl, miniatura }

// ===== Imagem =====
function carregarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem não suportado."));
      img.onload = () => resolve(img);
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

function redimensionar(img, max, qualidade) {
  const escala = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", qualidade);
}

async function usarArquivo(arquivo) {
  if (!arquivo || !arquivo.type.startsWith("image/")) {
    mostrarStatus("Escolha um arquivo de imagem.", true);
    return;
  }
  try {
    const img = await carregarImagem(arquivo);
    const dataUrl = redimensionar(img, 1280, 0.85);
    imagemAtual = {
      dataUrl,
      base64: dataUrl.split(",")[1],
      mediaType: "image/jpeg",
      miniatura: redimensionar(img, 120, 0.7),
    };
    $("previa").src = dataUrl;
    $("previa").hidden = false;
    $("zonaVazia").hidden = true;
    $("btnAvaliar").disabled = false;
    mostrarStatus("");
  } catch (e) {
    mostrarStatus(e.message, true);
  }
}

// ===== API =====
async function avaliar() {
  const chave = lerLS(CHAVE_LS);
  if (!chave) {
    abrirConfig();
    mostrarStatus("Adicione sua chave da API para avaliar.", true);
    return;
  }
  if (!imagemAtual) return;

  const modelo = lerLS(MODELO_LS) || "claude-opus-5-5";
  const tipo = document.querySelector('input[name="tipo"]:checked').value;
  const obs = $("obs").value.trim();

  let pedido = "Avalie o item desta imagem.";
  if (tipo !== "auto") pedido += ` O usuário indicou que é uma ${tipo}.`;
  if (obs) pedido += ` Observação do usuário: "${obs}".`;

  const corpo = {
    model: modelo,
    max_tokens: 16000,
    system: SISTEMA,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: imagemAtual.mediaType, data: imagemAtual.base64 } },
        { type: "text", text: pedido },
      ],
    }],
  };

  const headers = {
    "content-type": "application/json",
    "x-api-key": chave,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  // Fallback automático no servidor caso o modelo recuse (Opus/Sonnet)
  if (modelo !== "claude-haiku-5-5") {
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    corpo.fallbacks = "default";
  }

  $("btnAvaliar").disabled = true;
  mostrarStatus("Analisando a imagem… isso pode levar alguns segundos.", false, true);

  try {
    const resp = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(corpo) });
    const dados = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = dados?.error?.message || `Erro ${resp.status}`;
      if (resp.status === 401) throw new Error("Chave da API inválida. Verifique em ⚙️ Configurar.");
      if (resp.status === 429) throw new Error("Muitas requisições. Aguarde um pouco e tente de novo.");
      throw new Error(msg);
    }
    if (dados.stop_reason === "refusal") {
      throw new Error("A IA não pôde avaliar esta imagem. Tente outra foto.");
    }
    if (dados.stop_reason === "max_tokens") {
      throw new Error("A resposta ficou incompleta. Tente novamente.");
    }

    const texto = (dados.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const resultado = JSON.parse(texto);
    mostrarResultado(resultado);
    salvarHistorico(resultado, imagemAtual.miniatura);
    mostrarStatus("");
  } catch (e) {
    const msg = e instanceof TypeError ? "Falha de conexão. Verifique sua internet." : e.message;
    mostrarStatus(msg, true);
  } finally {
    $("btnAvaliar").disabled = false;
  }
}

// ===== Renderização =====
function corDaNota(n) {
  if (n >= 7) return "var(--bom)";
  if (n >= 4) return "var(--medio)";
  return "var(--ruim)";
}

function limitar(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0;
}

function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const f of filhos) e.append(f);
  return e;
}

function preencherLista(id, itens) {
  const ul = $(id);
  ul.replaceChildren(...(itens || []).map((t) => el("li", { textContent: t })));
}

function mostrarResultado(r) {
  const nota = limitar(r.nota_geral);
  const circ = $("notaCirculo");
  circ.style.setProperty("--p", String(nota * 10));
  circ.style.setProperty("--cor", corDaNota(nota));
  $("notaValor").textContent = nota.toFixed(1).replace(".0", "");

  $("resCategoria").textContent = r.categoria || r.tipo || "";
  $("resNome").textContent = r.nome || "Item desconhecido";
  $("resVeredito").textContent = r.veredito || "";

  $("subnotas").replaceChildren(...(r.subnotas || []).map((s) => {
    const n = limitar(s.nota);
    const barra = el("i");
    barra.style.width = `${n * 10}%`;
    barra.style.background = corDaNota(n);
    return el("div", { className: "subnota" },
      el("div", { className: "subnota-topo" }, el("span", { textContent: s.criterio }), el("span", { textContent: `${n.toFixed(1).replace(".0", "")}/10` })),
      el("div", { className: "barra" }, barra));
  }));

  $("resPotencial").textContent = r.potencial || "—";

  $("resEfeitos").replaceChildren(...(r.efeitos || []).map((f) =>
    el("li", {},
      el("span", { className: "ic", textContent: f.emoji || "•" }),
      el("div", {}, el("strong", { textContent: f.titulo }), el("small", { textContent: f.descricao })))));

  preencherLista("resPros", r.pontos_positivos);
  preencherLista("resContras", r.pontos_negativos);

  const n = r.nutricao || {};
  const itens = [
    ["Calorias", n.calorias_kcal, "kcal"],
    ["Açúcar", n.acucar_g, "g"],
    ["Proteína", n.proteina_g, "g"],
    ["Gordura", n.gordura_g, "g"],
    ["Cafeína", n.cafeina_mg, "mg"],
  ];
  $("resNutri").replaceChildren(
    ...itens.map(([rot, v, u]) => el("div", {}, el("b", { textContent: `${Math.round(Number(v) || 0)} ${u}` }), el("small", { textContent: rot }))),
  );
  if (n.porcao) $("resNutri").append(el("div", {}, el("b", { textContent: "📏" }), el("small", { textContent: n.porcao })));

  preencherLista("resHarmoniza", r.harmonizacao);
  $("resMomento").textContent = r.melhor_momento || "—";
  $("resDica").textContent = r.dica || "—";

  $("blocoAlerta").hidden = !r.alerta;
  $("resAlerta").textContent = r.alerta || "";

  $("resultado").hidden = false;
  $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
}

function mostrarStatus(msg, erro = false, carregando = false) {
  const s = $("status");
  s.textContent = msg;
  s.classList.toggle("erro", erro);
  s.classList.toggle("carregando", carregando);
}

// ===== Armazenamento =====
function lerLS(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function gravarLS(k, v) {
  try { localStorage.setItem(k, v); return true; } catch { return false; }
}

function lerHistorico() {
  try { return JSON.parse(lerLS(HIST_LS) || "[]"); } catch { return []; }
}

function salvarHistorico(resultado, miniatura) {
  const lista = lerHistorico();
  lista.unshift({ resultado, miniatura, data: Date.now() });
  let cortada = lista.slice(0, MAX_HIST);
  while (cortada.length && !gravarLS(HIST_LS, JSON.stringify(cortada))) cortada = cortada.slice(0, -1);
  renderizarHistorico();
}

function renderizarHistorico() {
  const lista = lerHistorico();
  $("histVazio").hidden = lista.length > 0;
  $("btnLimpar").hidden = lista.length === 0;
  $("historico").replaceChildren(...lista.map((h) => {
    const nota = limitar(h.resultado.nota_geral);
    const li = el("li", { tabIndex: 0 },
      el("img", { src: h.miniatura, alt: "" }),
      el("div", { className: "h-info" },
        el("strong", { textContent: h.resultado.nome }),
        el("small", { textContent: `${h.resultado.categoria} · ${new Date(h.data).toLocaleString("pt-BR")}` })),
      el("span", { className: "h-nota", textContent: nota.toFixed(1).replace(".0", "") }));
    li.querySelector(".h-nota").style.color = corDaNota(nota);
    const abrir = () => mostrarResultado(h.resultado);
    li.addEventListener("click", abrir);
    li.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(); });
    return li;
  }));
}

// ===== Configuração =====
function abrirConfig() {
  $("chave").value = lerLS(CHAVE_LS) || "";
  $("modelo").value = lerLS(MODELO_LS) || "claude-opus-5-5";
  $("dlgConfig").showModal();
}

// ===== Eventos =====
$("arquivo").addEventListener("change", (e) => usarArquivo(e.target.files[0]));
const zona = $("zona");
["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("arrastando"); }));
["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, () => zona.classList.remove("arrastando")));
zona.addEventListener("drop", (e) => { e.preventDefault(); usarArquivo(e.dataTransfer.files[0]); });
document.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  if (item) usarArquivo(item.getAsFile());
});

$("btnAvaliar").addEventListener("click", avaliar);
$("btnConfig").addEventListener("click", abrirConfig);
$("btnSalvar").addEventListener("click", () => {
  gravarLS(CHAVE_LS, $("chave").value.trim());
  gravarLS(MODELO_LS, $("modelo").value);
  mostrarStatus("Configuração salva.");
});
$("btnLimpar").addEventListener("click", () => {
  if (confirm("Apagar todo o histórico?")) { gravarLS(HIST_LS, "[]"); renderizarHistorico(); }
});

renderizarHistorico();
