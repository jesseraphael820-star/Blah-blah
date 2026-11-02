// Settings: system info, hardware (change PC config without recreating it),
// display, personalisation, sound, network, controls, notifications, storage, power.

import { h, fmtBytes, pickFiles, confirmBox } from "../core/util.js";
import { CPUS, RAMS, STORAGES, GPUS, RESOLUTIONS, PRESETS, device, vmMemoryMB, cpuOf, gpuOf, osOf, OSES } from "../core/pcs.js";
import { metrics } from "../core/metrics.js";
import { ui } from "../ui/icons.js";
import { wallpaperCSS, WALLPAPER_NAMES } from "../ui/wallpapers.js";
import { toggleFullscreen } from "../ui/launcher.js";
import { APPS } from "./registry.js";

const PAGES = [
  ["system", "Sistema", "monitor"], ["hardware", "Hardware do PC", "cpu"], ["display", "Tela", "fullscreen"], ["personalize", "Personalização", "palette"],
  ["sound", "Som", "volume"], ["network", "Rede e internet", "wifi"], ["controls", "Mouse e teclado", "gamepad"], ["notifications", "Notificações", "bell"],
  ["storage", "Armazenamento", "disk"], ["power", "Energia", "power"],
];
const ACCENTS = ["#4c8dff", "#7b5cff", "#ff3d6e", "#ff8a00", "#2fd08a", "#00b8d9", "#e11d74", "#a3e635"];

export default async function settings({ win, shell, args }) {
  let page = args.page || "system";
  const nav = h("div", { class: "st-nav" });
  const body = h("div", { class: "st-body" });
  win.body.append(h("div", { class: "st" }, nav, body));
  const s = () => shell.settings;
  const set = (k, v) => shell.setSetting(k, v).then(draw);

  const card = (title, ...c) => h("div", { class: "st-card" }, title && h("h4", {}, title), ...c);
  const row = (label, desc, control) => h("div", { class: "st-row" }, h("div", { class: "grow" }, h("b", {}, label), desc ? h("small", { class: "faint" }, desc) : null), control);
  const toggle = (val, fn) => h("label", { class: "switch" }, h("input", { type: "checkbox", checked: !!val, onchange: (e) => fn(e.target.checked) }), h("i"));
  const select = (val, opts, fn) => h("select", { class: "input", onchange: (e) => fn(e.target.value) }, opts.map(([v, l]) => h("option", { value: v, selected: String(v) === String(val) }, l)));
  const range = (val, min, max, step, fn, fmt = (v) => v) => { const o = h("span", { class: "st-val" }, fmt(val)); return h("div", { class: "row st-range" }, h("input", { type: "range", min, max, step, value: val, oninput: (e) => { o.textContent = fmt(+e.target.value); fn(+e.target.value); } }), o); };
  const tag = (k) => h("span", { class: "tag " + k }, k === "sim" ? "Simulado" : k === "real" ? "Real" : "Misto");

  async function draw() {
    nav.innerHTML = "";
    nav.append(h("div", { class: "st-user" }, h("div", { class: "avatar sm" }, shell.pc.name[0]?.toUpperCase()), h("div", {}, h("b", {}, shell.pc.name), h("small", { class: "faint" }, osOf(shell.pc).name))));
    PAGES.forEach(([id, n, i]) => nav.append(h("button", { class: "st-nav-item" + (id === page ? " on" : ""), onclick: () => { page = id; draw(); } }, h("span", { html: ui(i, 16) }), n)));
    body.innerHTML = "";
    body.append(h("h2", {}, PAGES.find((p) => p[0] === page)[1]));
    body.append(...(await PAGE[page]()));
    win.setTitle("Configurações — " + PAGES.find((p) => p[0] === page)[1]);
  }

  const PAGE = {
    async system() {
      const d = device(), c = cpuOf(shell.pc), g = gpuOf(shell.pc);
      let est; try { est = await navigator.storage.estimate(); } catch {}
      const kv = (k, v, t) => h("div", { class: "st-kv" }, h("span", { class: "faint" }, k), h("b", {}, v), t ? tag(t) : h("span"));
      return [
        card("Este computador",
          kv("Nome", shell.pc.name), kv("Tipo", PRESETS[shell.pc.type]?.label || "-"), kv("Sistema", osOf(shell.pc).name, "real"),
          kv("Processador", `${c.model} · ${c.cores} núcleos · ${c.ghz} GHz`, "sim"), kv("RAM instalada", `${shell.pc.ram} GB`, "mix"),
          kv("Armazenamento", `${shell.pc.storage} GB`, "real"), kv("Placa de vídeo", `${g.name} (${g.vram} GB)`, "sim"),
          kv("Resolução atual", `${shell.logical.w} × ${shell.logical.h} (escala ${shell.scale.toFixed(2)}×)`, "real")),
        card("Hardware real do celular",
          kv("Núcleos de CPU", String(d.cores), "real"), kv("RAM do aparelho", metrics.realMemory() ? `${fmtBytes(metrics.realMemory().total)} (${fmtBytes(metrics.realMemory().avail)} livres)` : d.memGB ? `≈ ${d.memGB} GB (o navegador limita a leitura a 8 GB)` : "não informado pelo navegador", "real"),
          kv("GPU", d.gpu, "real"), kv("WebGL", d.webgl ? "WebGL " + d.webgl : "não suportado", "real"), kv("WebAssembly", d.wasm ? "suportado" : "não suportado", "real"),
          kv("Tela", d.screen, "real"), kv("Armazenamento do app", est?.quota ? `${fmtBytes(est.usage)} usados de ${fmtBytes(est.quota)}` : "—", "real"),
          kv("RAM real máxima da VM x86", `${vmMemoryMB(shell.pc)} MB`, "real"),
          kv("Temperatura", metrics.temperature() != null ? metrics.temperature() + " °C" : "não disponível para apps web; no APK Android é lida da bateria", "real")),
        card("Como este PC funciona", h("p", { class: "muted st-p" }, "O VirtualOS e seus programas rodam de verdade no motor do navegador/WebView (JavaScript + WebAssembly). Sistemas x86 (Linux, DOS, utilitários de boot) rodam por emulação completa de CPU x86 (v86). Executáveis Windows e jogos de PC pesados não rodam no Android sem um Windows completo; para eles use a Área de Trabalho Remota para controlar um PC real.")),
      ];
    },
    hardware() {
      const pc = shell.pc;
      const apply = async (k, v) => {
        if (k === "storage") {
          const u = await shell.vfs.usage();
          if (u.bytes > v * 1024 ** 3) { shell.notify("Armazenamento", `Os arquivos já ocupam ${fmtBytes(u.bytes)}.`, { level: "bad" }); return; }
        }
        if (k === "ram" && v * 1024 < shell.ramUsedMB()) { shell.notify("Memória", "Feche programas antes de reduzir a RAM abaixo do uso atual.", { level: "warn", icon: "taskmgr" }); return; }
        pc[k] = v;
        if (["cpu", "ram", "storage", "gpu"].includes(k)) pc.type = pc.type === "custom" ? "custom" : pc.type;
        await shell.persist();
        shell.notify("Hardware atualizado", "Configuração salva. A RAM real da VM x86 muda na próxima vez que a VM for ligada.", { icon: "settings" });
        draw();
      };
      return [
        card(null, h("p", { class: "muted st-p" }, "Altere os componentes sem recriar o PC. Seus arquivos e programas são mantidos.")),
        card("Processador virtual", row("Modelo", "Rótulo de desempenho; usado nos requisitos dos jogos", h("div", { class: "row" }, tag("sim"), select(pc.cpu, CPUS.map((c) => [c.id, `${c.model} (${c.cores}c, ${c.ghz} GHz)`]), (v) => apply("cpu", v))))),
        card("Memória RAM", row("Capacidade", `Limite para apps do desktop. VM x86 usa até ${vmMemoryMB(pc)} MB reais.`, h("div", { class: "row" }, tag("mix"), select(pc.ram, RAMS.map((r) => [r, r + " GB"]), (v) => apply("ram", +v))))),
        card("Armazenamento", row("Capacidade", "Arquivos gravados de verdade no celular", h("div", { class: "row" }, tag("real"), select(pc.storage, STORAGES.map((r) => [r, r + " GB"]), (v) => apply("storage", +v))))),
        card("Placa de vídeo", row("Modelo", `Nível simulado. Render real: ${device().gpu}`, h("div", { class: "row" }, tag("sim"), select(pc.gpu, GPUS.map((g) => [g.id, g.name]), (v) => apply("gpu", v))))),
        card("Sistema", row("Modo de inicialização", "Válido a partir do próximo boot", select(pc.os, OSES.map((o) => [o.id, o.name]), (v) => apply("os", v)))),
      ];
    },
    display() {
      return [
        card("Resolução e escala",
          row("Resolução da tela", "O desktop é renderizado nessa resolução e ajustado à tela do celular", select(s().resolution, RESOLUTIONS.map((r) => [r, r === "auto" ? `Automática (${Math.round(innerWidth)}×${Math.round(innerHeight)})` : r.replace("x", " × ")]), (v) => set("resolution", v))),
          row("Zoom da interface", "Aumenta ou diminui o tamanho de textos e janelas", range(s().zoom || 100, 50, 200, 5, (v) => shell.setSetting("zoom", v), (v) => v + "%")),
          row("Tamanho dos ícones", null, select(s().iconSize || "md", [["sm", "Pequenos"], ["md", "Médios"], ["lg", "Grandes"]], (v) => set("iconSize", v)))),
        card("Tela cheia e orientação",
          row("Tela cheia", "Esconde as barras do Android", h("button", { class: "btn", onclick: async () => { await toggleFullscreen(); draw(); } }, document.fullscreenElement ? "Sair da tela cheia" : "Entrar em tela cheia")),
          row("Travar em paisagem", "Recomendado para usar como PC (exige tela cheia)", h("button", { class: "btn", onclick: () => shell.toggleOrientationLock().then(draw) }, shell._orientLock ? "Destravar" : "Travar")),
          row("Orientação atual", "Gire o aparelho: o desktop se ajusta automaticamente (retrato e paisagem)", h("b", {}, screen.orientation?.type?.startsWith("portrait") || innerHeight > innerWidth ? "Retrato" : "Paisagem"))),
        card("Brilho do PC", row("Brilho", "Escurece o PC virtual (o brilho do aparelho é do Android)", range(s().brightness ?? 100, 30, 100, 5, (v) => shell.setSetting("brightness", v), (v) => v + "%"))),
      ];
    },
    personalize() {
      const wp = h("div", { class: "st-wps" }, Object.keys(WALLPAPER_NAMES).map((id) => h("button", { class: "st-wp" + (s().wallpaper === id ? " on" : ""), style: { cssText: wallpaperCSS(id) }, title: WALLPAPER_NAMES[id], onclick: () => set("wallpaper", id) }, h("span", {}, WALLPAPER_NAMES[id]))),
        h("button", { class: "st-wp st-wp-add" + (s().wallpaper === "custom" ? " on" : ""), onclick: async () => {
          const [f] = await pickFiles({ multiple: false, accept: "image/*" });
          if (!f) return;
          const p = "/Imagens/Papel de parede." + (f.name.split(".").pop() || "jpg");
          await shell.vfs.write(p, f);
          await shell.setSetting("customWallpaper", p);
          set("wallpaper", "custom");
        } }, h("span", { html: ui("upload", 20) }), h("span", {}, "Sua imagem")));
      return [
        card("Papel de parede", wp),
        card("Cor de destaque", h("div", { class: "st-accents" }, ACCENTS.map((c) => h("button", { class: "st-accent" + (s().accent === c ? " on" : ""), style: { background: c }, onclick: () => set("accent", c) })), h("input", { type: "color", value: s().accent, onchange: (e) => set("accent", e.target.value) }))),
        card("Efeitos", row("Transparência", "Efeito de vidro (acrílico) na barra de tarefas e menus", toggle(s().transparency, (v) => set("transparency", v)))),
      ];
    },
    sound() {
      return [card("Saída de som",
        row("Volume principal", "Aplica-se aos jogos, ao Player e à VM x86", range(s().volume ?? 70, 0, 100, 1, (v) => shell.setSetting("volume", v), (v) => v + "%")),
        row("Mudo", null, toggle(s().muted, (v) => set("muted", v))),
        row("Testar som", "Toca um tom de teste com o volume atual", h("button", { class: "btn", onclick: testTone }, "Reproduzir")))];
    },
    network() {
      const c = navigator.connection;
      return [
        card("Status",
          row("Internet", "Estado real da conexão do celular", h("span", { class: "tag " + (navigator.onLine ? "real" : "bad") }, navigator.onLine ? "Conectado" : "Offline")),
          c ? row("Tipo de conexão", `Velocidade estimada ${c.downlink ?? "?"} Mb/s · latência ${c.rtt ?? "?"} ms`, h("b", {}, (c.effectiveType || c.type || "?").toUpperCase())) : null,
          row("Modo avião do PC", "Bloqueia navegador e downloads dentro deste PC", toggle(s().network?.offline, (v) => set("network.offline", v)))),
        card("Rede da Máquina Virtual x86",
          row("Relay de rede (WebSocket)", "Opcional: endereço wss:// de um relay compatível com v86 para dar internet à VM", h("input", { class: "input", style: { width: "260px" }, placeholder: "wss://relay.exemplo.com/", value: s().network?.relay || "", onchange: (e) => set("network.relay", e.target.value.trim()) }))),
      ];
    },
    controls() {
      const c = s().controls || {};
      return [
        card("Mouse virtual (analógico)",
          row("Mostrar controles na tela", null, toggle(c.visible !== false, (v) => set("controls.visible", v))),
          row("Sensibilidade", "Velocidade do cursor", range(c.sensitivity || 1, 0.3, 3, 0.1, (v) => shell.setSetting("controls.sensitivity", v), (v) => v.toFixed(1) + "×")),
          row("Tamanho do analógico", null, range(c.size || 120, 90, 180, 5, (v) => shell.setSetting("controls.size", v), (v) => v + " px")),
          row("Opacidade", null, range(c.opacity ?? 0.9, 0.3, 1, 0.05, (v) => shell.setSetting("controls.opacity", v), (v) => Math.round(v * 100) + "%")),
          row("Modo canhoto", "Inverte analógico e botões", toggle(c.leftHanded, (v) => set("controls.leftHanded", v))),
          row("Vibração ao tocar", null, toggle(c.haptics !== false, (v) => set("controls.haptics", v)))),
        card("Teclado e mouse físicos", h("p", { class: "muted st-p" }, "Teclados e mouses Bluetooth ou USB (OTG) funcionam automaticamente: conecte-os no Android e use normalmente. Controles de jogo (gamepad) também: o analógico esquerdo move o cursor e os botões A/B clicam. Na Máquina x86, clique na tela da VM para capturar o mouse.")),
        card("Atalhos do sistema", h("div", { class: "st-shortcuts" }, [["Win", "Menu Iniciar"], ["Alt+Tab", "Alternar janelas"], ["Alt+F4", "Fechar janela"], ["Win+D", "Mostrar área de trabalho"], ["Win+E", "Explorador"], ["Ctrl+Shift+Esc", "Gerenciador de Tarefas"], ["F11", "Tela cheia"], ["Ctrl+S", "Salvar (Bloco de Notas)"]].map(([k, d]) => h("div", {}, h("kbd", {}, k), h("span", { class: "faint" }, d))))),
      ];
    },
    notifications() {
      return [card("Notificações",
        row("Não perturbe", "Silencia avisos (erros ainda aparecem)", toggle(s().dnd, (v) => set("dnd", v))),
        row("Testar", null, h("button", { class: "btn", onclick: () => shell.notify("Notificação de teste", "Tudo funcionando!", { icon: "settings" }) }, "Enviar teste")))];
    },
    async storage() {
      const u = await shell.vfs.usage(), cap = shell.vfs.capacity();
      let est; try { est = await navigator.storage.estimate(); } catch {}
      const by = {};
      for (const f of await shell.vfs.all()) if (f.type === "file") { const top = "/" + f.path.split("/")[1]; by[top] = (by[top] || 0) + f.size; }
      const sim = shell.pc.installed.reduce((a, id) => a + (APPS[id]?.size || 0), 0);
      const persisted = await navigator.storage?.persisted?.().catch(() => false);
      return [
        card("VDISK (C:)", h("div", { class: "bar big" }, h("i", { style: { width: Math.max(1, (u.bytes / cap) * 100) + "%" } })), h("div", { class: "row" }, h("b", {}, `${fmtBytes(u.bytes)} usados`), h("span", { class: "spacer" }), h("span", { class: "faint" }, `${fmtBytes(cap - u.bytes)} livres de ${fmtBytes(cap, 0)}`)),
          ...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => row(k, null, h("b", {}, fmtBytes(v)))),
          row("Programas instalados (pacote do app)", "Já incluídos no Virtual PC; tamanho informativo", h("span", { class: "faint" }, `${sim} MB`))),
        card("Armazenamento real do aparelho", row("Usado pelo Virtual PC", est?.quota ? `Cota do navegador: ${fmtBytes(est.quota)}` : null, h("b", {}, est ? fmtBytes(est.usage) : "—")),
          row("Armazenamento persistente", "Impede que o Android apague os dados do PC quando o espaço estiver baixo", persisted ? h("span", { class: "tag real" }, "Ativado") : h("button", { class: "btn", onclick: async () => { const ok = await navigator.storage?.persist?.(); shell.notify("Armazenamento", ok ? "Armazenamento persistente ativado." : "O navegador recusou. Instale o app (PWA/APK) para garantir.", { level: ok ? "info" : "warn" }); draw(); } }, "Ativar"))),
        card("Limpeza", row("Esvaziar Lixeira", null, h("button", { class: "btn danger", onclick: async () => { if (await confirmBox(win.body, "Esvaziar Lixeira", "Excluir permanentemente os itens?", "Esvaziar", true)) { await shell.vfs.emptyTrash(); draw(); } } }, "Esvaziar"))),
      ];
    },
    power() {
      return [card("Energia",
        row("Suspender", "Salva os programas abertos (e o estado da VM x86) e desliga a tela do PC", h("button", { class: "btn", onclick: () => shell.power("suspend") }, h("span", { html: ui("moon", 14) }), "Suspender")),
        row("Reiniciar", null, h("button", { class: "btn", onclick: () => shell.power("restart") }, h("span", { html: ui("restart", 14) }), "Reiniciar")),
        row("Desligar", null, h("button", { class: "btn danger", onclick: () => shell.power("shutdown") }, h("span", { html: ui("power", 14) }), "Desligar")),
        row("Bateria do celular", metrics.battery ? (metrics.battery.charging ? "Carregando" : "Na bateria") : "API de bateria indisponível", h("b", {}, metrics.battery ? Math.round(metrics.battery.level * 100) + "%" : "—")))];
    },
  };

  function testTone() {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 660; g.gain.value = 0.2 * shell.volume();
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.35);
    o.onended = () => ctx.close();
  }

  await draw();
  return { onArgs: (a) => { if (a.page) { page = a.page; draw(); } } };
}
