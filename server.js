/*
 * Divine AI — servidor
 * Serve o site e faz a ponte com as APIs de IA. As chaves ficam somente aqui
 * (arquivo .env), nunca no navegador.
 *
 * Uso: node server.js   (Node 18+; sem dependências)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

/* ---------- .env ---------- */
const ROOT = __dirname;
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const env = (k, d = "") => process.env[k] || d;
const PORT = Number(env("PORT", "3000"));
const { providers, routes } = require("./js/models.js");
const MODELS = new Map(providers.flatMap((p) => p.models.map((m) => [m.id, { ...m, provider: p.id }])));

/* ---------- Provedores de API ---------- */
// Todos, exceto Anthropic, usam o formato compatível com OpenAI (chat/completions).
const UPSTREAMS = {
  openrouter: { key: "OPENROUTER_API_KEY", base: env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"), kind: "openai" },
  openai: { key: "OPENAI_API_KEY", base: env("OPENAI_BASE_URL", "https://api.openai.com/v1"), kind: "openai" },
  claude: { key: "ANTHROPIC_API_KEY", base: env("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1"), kind: "anthropic" },
  grok: { key: "XAI_API_KEY", base: env("XAI_BASE_URL", "https://api.x.ai/v1"), kind: "openai" },
  kimi: { key: "MOONSHOT_API_KEY", base: env("MOONSHOT_BASE_URL", "https://api.moonshot.ai/v1"), kind: "openai" },
  gemini: { key: "GEMINI_API_KEY", base: env("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"), kind: "openai" },
  deepseek: { key: "DEEPSEEK_API_KEY", base: env("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"), kind: "openai" },
};
const hasKey = (u) => Boolean(env(UPSTREAMS[u].key));

const DIVINE_SYSTEM =
  "Você é a Divine AI 1.0, o modelo próprio da plataforma Divine AI. " +
  "Responda de forma clara, precisa e profissional, no idioma do usuário. " +
  "Use Markdown (listas, **negrito**, blocos de código) quando ajudar. " +
  "Se perguntarem quem você é, diga que é a Divine AI 1.0.";

/* Escolhe a rota: chave direta do provedor > OpenRouter. */
function resolveRoute(modelId) {
  const model = MODELS.get(modelId);
  if (!model) return { error: "Modelo desconhecido." };

  if (model.provider === "divine") {
    // DIVINE_BASE_MODEL = "<provedor>:<id>", ex.: "claude:claude-sonnet-5-5" ou "openrouter:anthropic/claude-sonnet-4.5"
    const base = env("DIVINE_BASE_MODEL");
    if (base) {
      const [up, ...rest] = base.split(":");
      if (!UPSTREAMS[up]) return { error: `DIVINE_BASE_MODEL inválido: provedor "${up}" não existe.` };
      if (!hasKey(up)) return { error: `DIVINE_BASE_MODEL usa "${up}", mas ${UPSTREAMS[up].key} não está configurada.` };
      return { upstream: up, model: rest.join(":"), system: DIVINE_SYSTEM };
    }
    // Sem configuração: usa o primeiro provedor com chave
    const fallback = [
      ["claude", "claude-sonnet-5-5"], ["openai", "gpt-5.1"], ["gemini", "gemini-2.5-flash"],
      ["openrouter", "anthropic/claude-sonnet-4.5"], ["deepseek", "deepseek-chat"], ["grok", "grok-4"], ["kimi", "kimi-k2-0905-preview"],
    ].find(([u]) => hasKey(u));
    if (!fallback) return { error: noKeyMsg() };
    return { upstream: fallback[0], model: fallback[1], system: DIVINE_SYSTEM };
  }

  const r = routes[modelId] || {};
  if (r.direct && hasKey(model.provider)) return { upstream: model.provider, model: r.direct };
  if (r.openrouter && hasKey("openrouter")) return { upstream: "openrouter", model: r.openrouter };
  if (!r.direct && !r.openrouter) return { error: `${model.name} ainda não está disponível por API.`, noapi: true };
  const need = [r.direct && UPSTREAMS[model.provider].key, r.openrouter && "OPENROUTER_API_KEY"].filter(Boolean).join(" ou ");
  return { error: `Para usar ${model.name}, configure ${need} no arquivo .env.` };
}
const noKeyMsg = () => "Nenhuma chave de API configurada. Copie .env.example para .env, adicione pelo menos uma chave e reinicie o servidor.";

/* ---------- Chamada em streaming ---------- */
async function* streamUpstream({ upstream, model, system }, messages, signal) {
  const u = UPSTREAMS[upstream];
  const key = env(u.key);
  const maxTokens = Number(env("MAX_TOKENS", "4096"));

  let res;
  if (u.kind === "anthropic") {
    res = await fetch(`${u.base}/messages`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, ...(system && { system }), messages }),
    });
  } else {
    const headers = { "content-type": "application/json", authorization: `Bearer ${key}` };
    if (upstream === "openrouter") {
      headers["X-Title"] = "Divine AI";
      if (env("PUBLIC_URL")) headers["HTTP-Referer"] = env("PUBLIC_URL");
    }
    res = await fetch(`${u.base}/chat/completions`, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        messages: system ? [{ role: "system", content: system }, ...messages] : messages,
      }),
    });
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.error?.message || j.message || JSON.stringify(j);
    } catch {}
    const hint = res.status === 401 || res.status === 403 ? " (chave inválida ou sem permissão)"
      : res.status === 404 ? " (modelo não encontrado — confira o ID em js/models.js)"
      : res.status === 429 ? " (limite de uso atingido)" : "";
    throw new Error(`${upstream} respondeu ${res.status}${hint}${detail ? `: ${detail}` : ""}`);
  }

  // Leitura do SSE
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let ev;
      try { ev = JSON.parse(data); } catch { continue; }
      if (ev.error) throw new Error(ev.error.message || "Erro do provedor");
      const text = u.kind === "anthropic"
        ? ev.type === "content_block_delta" && ev.delta?.type === "text_delta" ? ev.delta.text : ""
        : ev.choices?.[0]?.delta?.content || "";
      if (text) yield text;
    }
  }
}

/* ---------- Validação ---------- */
function cleanMessages(list) {
  if (!Array.isArray(list)) return null;
  const out = list
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-40)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 32000) }));
  // A conversa precisa começar e terminar com o usuário
  while (out.length && out[0].role !== "user") out.shift();
  return out.length && out[out.length - 1].role === "user" ? out : null;
}

/* Limite simples por IP: 30 requisições / minuto */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > Number(env("RATE_LIMIT_PER_MIN", "30"));
}

/* ---------- HTTP ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };
const PUBLIC = new Set(["index.html", "css", "js", "assets"]);

function serveStatic(req, res) {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const rel = path.normalize(url === "/" ? "index.html" : url.slice(1));
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC.has(rel.split(path.sep)[0])) {
    res.writeHead(404).end("Not found");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end("Not found");
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(data);
  });
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("Mensagem muito grande.")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) {
    res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: e.message || "JSON inválido." }));
    return;
  }

  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive" });

  const ip = req.socket.remoteAddress;
  if (rateLimited(ip)) { send({ error: "Muitas requisições. Aguarde um minuto." }); return res.end(); }

  const messages = cleanMessages(body.messages);
  if (!messages) { send({ error: "Conversa inválida." }); return res.end(); }

  const route = resolveRoute(body.model);
  if (route.error) { send({ error: route.error }); return res.end(); }
  send({ route: { upstream: route.upstream, model: route.model } });

  const ac = new AbortController();
  res.on("close", () => ac.abort());
  try {
    for await (const t of streamUpstream(route, messages, ac.signal)) send({ t });
    send({ done: true });
  } catch (e) {
    if (!ac.signal.aborted) {
      console.error(`[chat] ${body.model}:`, e.message);
      send({ error: e.message });
    }
  }
  res.end();
}

function handleStatus(res) {
  const configured = Object.keys(UPSTREAMS).filter(hasKey);
  const available = {};
  for (const id of MODELS.keys()) {
    const r = resolveRoute(id);
    available[id] = !r.error ? "ok" : r.noapi ? "noapi" : "nokey";
  }
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ configured, available }));
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/chat") return void handleChat(req, res);
    if (req.method === "GET" && req.url === "/api/status") return handleStatus(res);
    if (req.method === "GET") return serveStatic(req, res);
    res.writeHead(405).end();
  })
  .listen(PORT, () => {
    const configured = Object.keys(UPSTREAMS).filter(hasKey);
    console.log(`Divine AI rodando em http://localhost:${PORT}`);
    console.log(configured.length ? `Provedores com chave: ${configured.join(", ")}` : `⚠ ${noKeyMsg()}`);
  });
