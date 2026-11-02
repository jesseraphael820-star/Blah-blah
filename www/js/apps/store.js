// Central de Apps: catalog with real requirement checks, install/uninstall,
// installed programs and their space, and installation from files (phone
// storage or the PC's own files) with honest compatibility analysis.

import { h, fmtBytes, pickFiles, confirmBox, promptBox } from "../core/util.js";
import { join, basename, dirname } from "../core/vfs.js";
import { checkRequirements, GPUS, device } from "../core/pcs.js";
import { analyze } from "../core/compat.js";
import { readZip } from "../core/zip.js";
import { APPS } from "./registry.js";
import { ui, appIcon } from "../ui/icons.js";

const CATALOG = ["astro", "lane", "reversi", "paint"];

export default async function store({ win, shell, args }) {
  let tab = args.analyze ? "file" : args.tab || "discover";
  const tabs = h("div", { class: "store-tabs" });
  const body = h("div", { class: "store-body" });
  win.body.append(h("div", { class: "store" }, tabs, body));

  function drawTabs() {
    tabs.innerHTML = "";
    [["discover", "Descobrir", "star"], ["installed", "Instalados", "apps"], ["file", "Instalar de arquivo", "upload"], ["compat", "O que roda aqui?", "info"]]
      .forEach(([id, n, i]) => tabs.append(h("button", { class: "store-tab" + (tab === id ? " on" : ""), onclick: () => { tab = id; drawTabs(); render(); } }, h("span", { html: ui(i, 15) }), n)));
  }

  const reqText = (req = {}) => [req.ram && `${req.ram} GB RAM`, req.gpu && GPUS[req.gpu - 1].name.replace("VGraphics ", "GPU "), req.webgl && "WebGL"].filter(Boolean).join(" · ") || "Nenhum";

  async function install(id) {
    const app = APPS[id];
    const chk = checkRequirements(shell.pc, app.req);
    if (!chk.ok) return shell.notify("Incompatível", chk.issues.join(" "), { level: "bad", icon: "store" });
    shell.pc.installed = [...new Set([...shell.pc.installed, id])];
    await shell.vfs.write(join("/Programas", app.name + ".vpcapp"), JSON.stringify({ id, name: app.name, version: "1.0", installed: Date.now(), packageMB: app.size }), { mime: "application/json", extra: { app: { launcher: id, icon: app.icon } } });
    await shell.persist();
    shell.renderIcons();
    shell.notify("Instalado", `${app.name} foi instalado. Atalho criado na Área de Trabalho.`, { icon: app.icon });
    render();
  }
  async function uninstall(id) {
    const app = APPS[id];
    if (!(await confirmBox(win.body, "Desinstalar", `Remover ${app.name}? Saves e configurações do jogo também serão apagados.`, "Desinstalar", true))) return;
    for (const p of shell.procs.values()) if (p.appId === id) p.win.close(true);
    shell.pc.installed = shell.pc.installed.filter((x) => x !== id);
    await shell.vfs.remove(join("/Programas", app.name + ".vpcapp"));
    localStorage.removeItem(`vpc:${shell.pc.id}:${id}`);
    await shell.persist();
    shell.renderIcons();
    render();
  }

  async function render() {
    body.innerHTML = "";
    if (tab === "discover") {
      const featured = APPS[args.focus] ? args.focus : "astro";
      const f = APPS[featured];
      body.append(h("div", { class: "store-hero", style: { "--c": featured === "lane" ? "#ff5f6d" : "#7b5cff" } },
        h("span", { html: appIcon(f.icon, 84) }),
        h("div", { class: "grow" }, h("small", { class: "faint" }, "DESTAQUE"), h("h2", {}, f.name), h("p", {}, f.desc), actionBtn(featured))));
      body.append(h("h3", { class: "store-h" }, "Jogos e programas"));
      body.append(h("div", { class: "store-grid" }, CATALOG.map((id) => {
        const a = APPS[id];
        const chk = checkRequirements(shell.pc, a.req);
        return h("div", { class: "store-card" },
          h("div", { class: "row" }, h("span", { html: appIcon(a.icon, 52) }), h("div", { class: "grow" }, h("b", {}, a.name), h("small", { class: "faint" }, `${a.genre} · ${a.size} MB`))),
          h("p", { class: "muted" }, a.desc),
          h("div", { class: "store-req" }, h("small", { class: "faint" }, "Requisitos: " + reqText(a.req)),
            h("span", { class: "tag " + (chk.level === "ok" ? "real" : chk.level) }, chk.level === "ok" ? "Compatível" : chk.level === "warn" ? "Desempenho reduzido" : "Incompatível")),
          [...chk.issues, ...chk.warnings].map((t) => h("small", { class: chk.issues.includes(t) ? "st-bad" : "st-warn" }, t)),
          actionBtn(id));
      })));
      body.append(h("h3", { class: "store-h" }, "Sistemas para a Máquina x86 (emulação real)"));
      body.append(h("div", { class: "store-grid" },
        sysCard("Linux i686 (VPC Linux)", "Kernel Linux 6.8 + BusyBox, compilado para o Virtual PC. Shell, editor vi, utilitários e pasta compartilhada com seus arquivos.", "2,8 MB", "builtin:linux"),
        sysCard("Memtest86+ 7.0", "Teste de memória real rodando direto no hardware x86 emulado.", "140 KB", "builtin:memtest"),
        sysCard("VPC Boot Monitor", "Mini sistema em modo real x86: memória, CPUID, relógio e comandos.", "9 KB", "builtin:vpcboot"),
        h("div", { class: "store-card" }, h("b", {}, "Seu próprio sistema"), h("p", { class: "muted" }, "Importe ISOs/IMGs 32 bits: FreeDOS, KolibriOS, Alpine x86, Tiny Core, ReactOS, Windows 9x (licença própria)."), h("button", { class: "btn", onclick: () => { tab = "file"; drawTabs(); render(); } }, "Importar imagem"))));
    } else if (tab === "installed") {
      const programs = await shell.vfs.list("/Programas");
      const webApps = programs.filter((p) => p.app?.launcher === "webapp" || (p.type === "dir" && !p.name.endsWith(".vpcapp")));
      const rows = shell.pc.installed.filter((id) => APPS[id]);
      let webSizes = 0;
      body.append(h("div", { class: "store-list" },
        rows.map((id) => h("div", { class: "store-row" }, h("span", { html: appIcon(APPS[id].icon, 36) }), h("div", { class: "grow" }, h("b", {}, APPS[id].name), h("small", { class: "faint" }, `${APPS[id].genre} · pacote ${APPS[id].size} MB (incluído no app)`)),
          h("button", { class: "btn small", onclick: () => shell.open(id) }, "Abrir"), h("button", { class: "btn small danger", onclick: () => uninstall(id) }, "Desinstalar"))),
        await Promise.all(webApps.map(async (p) => {
          const size = p.type === "dir" ? (await shell.vfs.descendants(p.path)).reduce((a, b) => a + (b.size || 0), 0) : p.size;
          webSizes += size;
          const entry = p.type === "dir" ? (await shell.vfs.descendants(p.path)).find((f) => f.app?.launcher === "webapp") : p;
          return h("div", { class: "store-row" }, h("span", { html: appIcon("webapp", 36) }), h("div", { class: "grow" }, h("b", {}, p.name.replace(/\.html?$/, "")), h("small", { class: "faint" }, `App web importado · ${fmtBytes(size)} (real)`)),
            h("button", { class: "btn small", onclick: () => entry && shell.openFile(entry.path) }, "Abrir"),
            h("button", { class: "btn small danger", onclick: async () => { if (await confirmBox(win.body, "Desinstalar", `Remover ${p.name}?`, "Remover", true)) { await shell.vfs.remove(p.path); const l = join("/Desktop", p.name.replace(/\.html?$/, "") + ".lnk"); await shell.vfs.remove(l); render(); } } }, "Desinstalar"));
        }))));
      if (!rows.length && !webApps.length) body.append(h("div", { class: "faint store-empty" }, "Nenhum programa instalado."));
      const u = await shell.vfs.usage();
      body.append(h("div", { class: "store-space" }, h("b", {}, "Espaço"), h("div", { class: "bar" }, h("i", { style: { width: Math.max(1, (u.bytes / shell.vfs.capacity()) * 100) + "%" } })), h("small", { class: "faint" }, `Apps web importados: ${fmtBytes(webSizes)} · Total do disco: ${fmtBytes(u.bytes)} de ${fmtBytes(shell.vfs.capacity(), 0)}`)));
    } else if (tab === "file") {
      const res = h("div", { class: "store-analysis" });
      body.append(h("div", { class: "store-drop" },
        h("span", { html: ui("upload", 36, 1.4) }),
        h("b", {}, "Selecione um instalador, jogo ou imagem de disco"),
        h("small", { class: "faint" }, ".zip/.html (apps web), .iso/.img (Máquina x86), .exe/.msi/.apk (análise de compatibilidade), ELF Linux"),
        h("div", { class: "row" },
          h("button", { class: "btn primary", onclick: async () => { const [f] = await pickFiles({ multiple: false }); if (f) analyzeFile(f, f.name, null, res); } }, "Do armazenamento do celular"),
          h("button", { class: "btn", onclick: async () => { const p = await promptBox(win.body, "Caminho do arquivo no PC", "/Downloads/"); if (p) analyzeFile(await shell.vfs.read(p), basename(p), p, res).catch((e) => shell.notify("Erro", e.message, { level: "bad" })); } }, "Dos arquivos do PC"))),
        res);
      if (args.analyze) { const p = args.analyze; args.analyze = null; shell.vfs.read(p).then((b) => analyzeFile(b, basename(p), p, res)); }
    } else {
      const d = device();
      const item = (ok, t, s) => h("div", { class: "compat-row" }, h("span", { class: "tag " + (ok === true ? "real" : ok === "warn" ? "warn" : "bad") }, ok === true ? "Roda" : ok === "warn" ? "Limitado" : "Não roda"), h("div", {}, h("b", {}, t), h("small", { class: "faint" }, s)));
      body.append(h("div", { class: "compat" },
        h("p", { class: "muted" }, `Arquitetura: VirtualOS (HTML5/WebAssembly no motor do celular) + emulador x86 v86 + cliente remoto VNC. Seu aparelho: ${d.cores} núcleos, GPU ${d.gpu}.`),
        item(true, "Apps do VirtualOS", "Explorador, Bloco de Notas, Terminal, Navegador, Fotos, Player, Calculadora, Pintura, jogos da Central."),
        item(true, "Jogos e apps HTML5 / WebAssembly / WebGL", "Importe .zip com index.html ou .html: rodam com aceleração real da GPU."),
        item(true, "Linux i686, DOS, utilitários de boot", "Emulação x86 completa (v86). Velocidade típica: dezenas a centenas de MIPS (≈ um PC dos anos 90)."),
        item("warn", "Windows 95/98/2000, ReactOS e programas Windows antigos", "Rodam na Máquina x86 com sua própria imagem/licença; lento, sem aceleração 3D."),
        item(true, "Qualquer programa ou jogo de um PC real", "Pela Área de Trabalho Remota (VNC): o PC real executa, o celular mostra e controla."),
        item(false, "Jogos Windows modernos (.exe) direto no celular", "Exigiriam Windows x64 + DirectX: não é possível emular com desempenho aceitável no Android. O app identifica e avisa."),
        item(false, "Apps Android (.apk) dentro do PC", "Instale direto no Android.")));
    }
  }

  function sysCard(name, desc, size, image) {
    return h("div", { class: "store-card" }, h("div", { class: "row" }, h("span", { html: appIcon("x86", 44) }), h("div", { class: "grow" }, h("b", {}, name), h("small", { class: "faint" }, `Incluído · ${size}`))), h("p", { class: "muted" }, desc), h("button", { class: "btn primary", onclick: () => shell.open("x86", { image, autostart: true }) }, "Iniciar na Máquina x86"));
  }

  function actionBtn(id) {
    const inst = shell.pc.installed.includes(id);
    return inst ? h("div", { class: "row" }, h("button", { class: "btn primary", onclick: () => shell.open(id) }, "Abrir"), h("button", { class: "btn", onclick: () => uninstall(id) }, "Desinstalar"))
      : h("button", { class: "btn primary", onclick: () => install(id) }, h("span", { html: ui("download", 14) }), "Instalar");
  }

  async function analyzeFile(blob, name, vfsPath, out) {
    out.innerHTML = "";
    out.append(h("div", { class: "faint" }, "Analisando " + name + "…"));
    const r = await analyze(blob, name);
    out.innerHTML = "";
    const ok = r.runnable;
    out.append(h("div", { class: "store-card" },
      h("div", { class: "row" }, h("span", { html: appIcon(r.type === "windows" ? "exe" : r.type === "apk" ? "apk" : r.type.includes("zip") ? "zip" : r.type === "html" || r.type === "webzip" ? "html" : "disk", 44) }), h("div", { class: "grow" }, h("b", {}, name), h("small", { class: "faint" }, `${r.label} · ${fmtBytes(r.size)}`)), h("span", { class: "tag " + (ok ? "real" : "bad") }, ok ? "Compatível" : "Não executável aqui")),
      r.how.map((t) => h("p", { class: "muted" }, t)),
      h("div", { class: "row wrap" }, r.actions.map((a) => {
        if (a === "install-web") return h("button", { class: "btn primary", onclick: () => installWeb(blob, name, r) }, "Instalar app web");
        if (a === "x86") return h("button", { class: "btn primary", onclick: async () => { const p = vfsPath || (await save(blob, name, "/Downloads")); shell.open("x86", { image: p, autostart: true }); } }, "Iniciar na Máquina x86");
        if (a === "remote") return h("button", { class: "btn", onclick: () => shell.open("remote") }, "Abrir Área de Trabalho Remota");
        if (a === "linux-share") return h("button", { class: "btn primary", onclick: async () => { const p = vfsPath || (await save(blob, name, "/Downloads")); shell.notify("Pronto", `Inicie o Linux: o arquivo estará em /mnt/host${p}`, { icon: "x86" }); shell.open("x86", { image: "builtin:linux", autostart: true }); } }, "Usar no Linux da VM");
        if (a === "extract") return h("button", { class: "btn", onclick: () => extract(blob, name) }, "Extrair para Downloads");
        return null;
      }), !vfsPath ? h("button", { class: "btn", onclick: () => save(blob, name, "/Downloads") }, "Só copiar para Downloads") : null)));
  }

  async function save(blob, name, dir) {
    const p = join(dir, await shell.vfs.uniqueName(dir, name));
    await shell.vfs.write(p, blob);
    shell.notify("Arquivo copiado", p, { icon: "explorer" });
    return p;
  }

  async function extract(blob, name) {
    const z = await readZip(blob);
    const base = join("/Downloads", await shell.vfs.uniqueName("/Downloads", name.replace(/\.zip$/i, "")));
    let n = 0;
    for (const e of z.entries) { if (e.dir) continue; await shell.vfs.write(join(base, e.name), await z.read(e)); n++; }
    shell.notify("Extraído", `${n} arquivos em ${base}`, { icon: "explorer" });
    shell.open("explorer", { path: base });
  }

  async function installWeb(blob, name, r) {
    if (!(await confirmBox(win.body, "Instalar app web", "Apps importados rodam com acesso ao armazenamento local do Virtual PC. Instale apenas apps de fontes confiáveis.", "Instalar"))) return;
    const title = name.replace(/\.(zip|html?)$/i, "");
    let entry;
    try {
      if (r.type === "webzip") {
        const z = await readZip(blob);
        const dir = join("/Programas", await shell.vfs.uniqueName("/Programas", title));
        const root = dirname("/" + r.entry).slice(1);
        for (const e of z.entries) {
          if (e.dir || (root && !e.name.startsWith(root + "/"))) continue;
          const rel = root ? e.name.slice(root.length + 1) : e.name;
          const p = join(dir, rel);
          await shell.vfs.write(p, await z.read(e), p === join(dir, "index.html") || p === join(dir, "index.htm") ? { extra: { app: { launcher: "webapp", icon: "webapp", title } } } : {});
        }
        entry = join(dir, basename(r.entry));
      } else {
        entry = join("/Programas", await shell.vfs.uniqueName("/Programas", title + ".html"));
        await shell.vfs.write(entry, blob, { mime: "text/html", extra: { app: { launcher: "webapp", icon: "webapp", title } } });
      }
      await shell.vfs.write(join("/Desktop", await shell.vfs.uniqueName("/Desktop", title + ".lnk")), JSON.stringify({ type: "file", path: entry }), { mime: "application/json", extra: { linkIcon: "webapp" } });
      shell.notify("App instalado", `${title} instalado em ${dirname(entry)}.`, { icon: "webapp" });
      shell.openFile(entry);
    } catch (e) { shell.notify("Falha na instalação", e.message, { level: "bad", icon: "store" }); }
  }

  drawTabs();
  render();
  return { onArgs: (a) => { Object.assign(args, a); tab = a.analyze ? "file" : a.tab || (a.focus ? "discover" : tab); drawTabs(); render(); } };
}
