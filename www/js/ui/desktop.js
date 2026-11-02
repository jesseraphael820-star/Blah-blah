// The VirtualOS desktop shell: wallpaper, icons, taskbar, start menu, quick
// settings, notifications, process management, sessions and power states.

import { h, $, fmtBytes, kind, extOf, promptBox, alertBox, confirmBox, uid, clamp, fmtDate } from "../core/util.js";
import { VFS, join, basename, dirname } from "../core/vfs.js";
import { pcStore, osOf, cpuOf } from "../core/pcs.js";
import { bus } from "../core/bus.js";
import { kv } from "../core/db.js";
import { metrics } from "../core/metrics.js";
import { WindowManager } from "./wm.js";
import { InputLayer } from "./input.js";
import { ui, appIcon, logo } from "./icons.js";
import { toggleFullscreen } from "./launcher.js";
import { APPS, PINNED, START_PINNED, OS_BASE_MB } from "../apps/registry.js";
import { wallpaperCSS } from "./wallpapers.js";

const SYS_ICONS = [
  { id: "sys:pc", label: "Este PC", icon: "explorer", open: (s) => s.open("explorer", { path: "/" }) },
  { id: "sys:trash", label: "Lixeira", icon: "recycle", open: (s) => s.open("recycle") },
  { id: "sys:store", label: "Central de Apps", icon: "store", open: (s) => s.open("store") },
  { id: "sys:browser", label: "Navegador", icon: "browser", open: (s) => s.open("browser") },
  { id: "sys:x86", label: "Máquina x86", icon: "x86", open: (s) => s.open("x86") },
  { id: "sys:terminal", label: "Terminal", icon: "terminal", open: (s) => s.open("terminal") },
  { id: "sys:settings", label: "Configurações", icon: "settings", open: (s) => s.open("settings") },
];

export class Shell {
  constructor(root, pc, { onPower }) {
    this.root = root;
    this.pc = pc;
    this.onPower = onPower;
    this.vfs = new VFS(pc);
    this.procs = new Map();
    this.nextPid = 100;
    this.notifications = [];
    this.taskbarHeight = 48;
    this.scale = 1;
    this.disposers = [];
    this.clipboard = null; // {op:'copy'|'cut', paths:[]}
  }

  get settings() { return this.pc.settings; }

  async start() {
    this.build();
    this.wm = new WindowManager(this, this.winLayer);
    this.wm.on("change", () => this.renderTaskbar());
    this.input = new InputLayer(this);
    this.applySettings();
    this.layout();
    metrics.start();
    this.renderIcons();
    this.renderTaskbar();
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 1000);

    const onResize = () => this.layout();
    window.addEventListener("resize", onResize);
    screen.orientation?.addEventListener?.("change", onResize);
    document.addEventListener("fullscreenchange", onResize);
    this.disposers.push(() => { window.removeEventListener("resize", onResize); screen.orientation?.removeEventListener?.("change", onResize); document.removeEventListener("fullscreenchange", onResize); });
    this.disposers.push(bus.on("fs:change", (pcId, dir) => { if (pcId === this.pc.id && (dir === "/Desktop" || dir === "/Lixeira" || dir === "/")) this.renderIcons(); }));
    this.disposers.push(bus.on("fs:trash", () => this.renderIcons()));
    this.disposers.push(metrics.on("tick", () => this.renderHud()));
    this.disposers.push(metrics.on("battery", () => this.renderTray()));
    const onNet = () => { this.renderTray(); this.notify("Rede", navigator.onLine ? "Conectado à internet." : "Sem conexão com a internet.", { icon: "settings" }); };
    window.addEventListener("online", onNet); window.addEventListener("offline", onNet);
    this.disposers.push(() => { window.removeEventListener("online", onNet); window.removeEventListener("offline", onNet); });
    this.keyHandler = (e) => this.onKey(e);
    window.addEventListener("keydown", this.keyHandler, true);
    window.addEventListener("keyup", this.keyHandler, true);

    this.notifications = (await kv.get("notif:" + this.pc.id, [])).slice(0, 50);
    this.renderNotifCenter();

    // restore suspended session or first-run welcome
    if (this.pc.state === "suspended" && this.pc.session) {
      for (const w of this.pc.session.windows || []) await this.open(w.appId, { ...(w.args || {}), resume: true }, { rect: w.rect, state: w.state }).catch(() => {});
      this.notify("Sessão retomada", "Seus programas foram restaurados.", { icon: "settings" });
    } else if (!this.pc.lastBoot || this.pc.lastBoot === this.pc.created || !(await kv.get("welcomed:" + this.pc.id))) {
      await kv.set("welcomed:" + this.pc.id, true);
      await this.seedFiles();
      this.notify("Bem-vindo ao " + osOf(this.pc).name, "Use o analógico na parte inferior para mover o mouse, ou toque diretamente. Abra a Central de Apps para instalar jogos.", { icon: "store" });
    }
    this.pc.state = "on"; this.pc.session = null;
    await this.persist();
    if (this.pc.os === "linux" && !this.procs.size) this.open("x86", { image: "builtin:linux", autostart: true }, { state: "max" });
    if (this.pc.os === "remote" && !this.procs.size) this.open("remote", {}, { state: "max" });
  }

  async seedFiles() {
    const v = this.vfs;
    if (!(await v.exists("/Documentos/Leia-me.txt"))) {
      await v.write("/Documentos/Leia-me.txt",
`Bem-vindo ao Virtual PC!

O que é REAL neste computador:
 • Sistema de arquivos: tudo que você salva fica gravado no celular.
 • Apps do VirtualOS: Explorador, Bloco de Notas, Terminal, Navegador, Fotos, Player, Calculadora, Pintura.
 • Máquina Virtual x86 (v86/WebAssembly): roda um Linux i686 de verdade, utilitários de boot e
   imagens .iso/.img que você importar (Linux, FreeDOS, KolibriOS...).
 • Área de Trabalho Remota (VNC): use um PC Windows/Linux real e seus jogos pela rede.
 • Jogos HTML5 instaláveis pela Central de Apps e apps web (.html/.zip) importados.

O que é SIMULADO:
 • Modelo/clock do processador e nível da placa de vídeo (usados para checar requisitos).
 • A RAM escolhida é um limite para os apps do desktop (a VM x86 usa RAM real).

Executáveis Windows (.exe) e APKs não rodam diretamente: o Virtual PC detecta e explica a alternativa.
`);
      await v.write("/Desktop/Leia-me.lnk", JSON.stringify({ type: "file", path: "/Documentos/Leia-me.txt" }), { mime: "application/json", extra: { linkIcon: "text" } });
    }
  }

  // ---------------- layout ----------------
  build() {
    this.el = h("div", { class: "pc-view" });
    this.stage = h("div", { class: "stage" });
    this.screen = h("div", { class: "screen" });
    this.wallpaper = h("div", { class: "wallpaper" });
    this.iconLayer = h("div", { class: "desk-icons" });
    this.winLayer = h("div", { class: "desk-windows" });
    this.snapHint = h("div", { class: "snap-hint" });
    this.taskbar = h("div", { class: "taskbar" });
    this.toastLayer = h("div", { class: "toasts" });
    this.hud = h("div", { class: "hud hidden" });
    this.dim = h("div", { class: "dimmer" });
    this.overlayHost = h("div", { class: "overlay-host" });
    this.screen.append(this.wallpaper, this.iconLayer, this.winLayer, this.snapHint, this.taskbar, this.toastLayer, this.hud, this.overlayHost, this.dim);
    this.stage.append(this.screen);
    this.el.append(this.stage);
    this.root.append(this.el);

    this.iconLayer.addEventListener("pointerdown", (e) => { if (e.target === this.iconLayer) this.selectIcon(null); this.closePopups(); });
    this.iconLayer.addEventListener("contextmenu", (e) => { if (e.target === this.iconLayer) { e.preventDefault(); this.desktopMenu(e); } });
    this.wallpaper.addEventListener("pointerdown", () => this.closePopups());
    this.winLayer.addEventListener("pointerdown", () => this.closePopups(true));
    // native drag & drop of real files from the phone/computer onto the desktop
    this.screen.addEventListener("dragover", (e) => e.preventDefault());
    this.screen.addEventListener("drop", (e) => {
      if (!e.dataTransfer?.files?.length || e.target.closest(".win")) return;
      e.preventDefault();
      this.importFiles([...e.dataTransfer.files], "/Desktop");
    });
  }

  screenRect() { return this.screen.getBoundingClientRect(); }
  screenSize() { return { w: this.logical.w, h: this.logical.h }; }

  layout() {
    const portraitDock = this.input?.dockHeight() || 0;
    const vw = window.innerWidth, vh = window.innerHeight - portraitDock;
    this.el.classList.toggle("portrait", vh > vw * 1.05 && window.innerWidth < 900);
    this.stage.style.bottom = portraitDock + "px";
    const z = (this.settings.zoom || 100) / 100;
    let base;
    if (this.settings.resolution && this.settings.resolution !== "auto") {
      const [w, hh] = this.settings.resolution.split("x").map(Number);
      base = { w, h: hh };
    } else base = { w: vw, h: vh };
    const logical = { w: Math.round(base.w / z), h: Math.round(base.h / z) };
    const scale = Math.min(vw / logical.w, vh / logical.h);
    this.logical = logical;
    this.scale = scale;
    this.screen.classList.toggle("narrow", logical.w < 640);
    Object.assign(this.screen.style, { width: logical.w + "px", height: logical.h + "px", transform: `translate(-50%, -50%) scale(${scale})` });
    this.wm?.fitAll();
    this.renderIcons();
    this.input?.layout();
  }

  applySettings() {
    const s = this.settings;
    if (s.wallpaper === "custom" && s.customWallpaper) {
      if (this._wpPath !== s.customWallpaper) {
        this._wpPath = s.customWallpaper;
        this.vfs.read(s.customWallpaper).then((blob) => {
          if (this._wpUrl) URL.revokeObjectURL(this._wpUrl);
          this._wpUrl = URL.createObjectURL(blob);
          this.wallpaper.style.cssText = wallpaperCSS("custom", this._wpUrl);
        }).catch(() => { this.wallpaper.style.cssText = wallpaperCSS("aurora"); });
      }
    } else { this._wpPath = null; this.wallpaper.style.cssText = wallpaperCSS(s.wallpaper); }
    this.screen.style.setProperty("--accent", s.accent);
    this.screen.style.setProperty("--accent-soft", hexA(s.accent, 0.18));
    this.screen.classList.toggle("no-transparency", !s.transparency);
    this.screen.classList.toggle("gamer", this.pc.os === "vpcos-gamer");
    this.screen.dataset.iconSize = s.iconSize || "md";
    this.dim.style.opacity = s.brightness != null ? String((100 - s.brightness) / 100 * 0.7) : "0";
    this.hud.classList.toggle("hidden", !s.hud);
    bus.emit("volume", this.volume());
  }

  volume() { return this.settings.muted ? 0 : (this.settings.volume ?? 70) / 100; }

  async setSetting(path, value) {
    const parts = path.split(".");
    let o = this.settings;
    while (parts.length > 1) { const k = parts.shift(); o[k] ??= {}; o = o[k]; }
    o[parts[0]] = value;
    this.applySettings();
    if (["resolution", "zoom"].includes(path) || path.startsWith("controls")) { this.input?.applySettings(); this.layout(); }
    this.renderTray();
    bus.emit("settings", path, value);
    await this.persist();
  }

  async persist() { await pcStore.save(this.pc); }

  // ---------------- processes ----------------
  ramTotalMB() { return this.pc.ram * 1024; }
  ramUsedMB() { let m = OS_BASE_MB; for (const p of this.procs.values()) m += p.mem + (p.inst?.extraMem?.() || 0); return m; }

  async open(appId, args = {}, opts = {}) {
    const app = APPS[appId];
    if (!app) throw new Error("App desconhecido: " + appId);
    if (app.single) {
      const ex = [...this.procs.values()].find((p) => p.appId === appId);
      if (ex) { ex.win.restore(); ex.inst?.onArgs?.(args); return ex; }
    }
    if (!app.system && !this.pc.installed.includes(appId)) {
      this.notify("Programa não instalado", `${app.name} não está instalado. Instale pela Central de Apps.`, { icon: "store" });
      return this.open("store", { focus: appId });
    }
    const free = this.ramTotalMB() - this.ramUsedMB();
    if (app.mem > free) {
      this.notify("Memória insuficiente", `${app.name} precisa de ${app.mem} MB de RAM virtual, mas só há ${Math.max(0, free)} MB livres de ${this.ramTotalMB()} MB. Feche programas no Gerenciador de Tarefas ou aumente a RAM do PC.`, { icon: "taskmgr", level: "bad" });
      return null;
    }
    const pid = this.nextPid++;
    const win = this.wm.create({ appId, pid, title: app.name, icon: app.icon, width: app.w, height: app.h, resizable: app.resizable, maximized: opts.state === "max" });
    if (opts.rect && opts.state !== "max") { win.rect = { ...opts.rect }; win.fit(); }
    const proc = { pid, appId, name: app.name, win, inst: null, mem: app.mem, started: Date.now(), args };
    this.procs.set(pid, proc);
    win.on("close", () => { try { proc.inst?.destroy?.(); } catch (e) { console.error(e); } this.procs.delete(pid); this.renderTaskbar(); });
    win.body.append(h("div", { class: "app-loading" }, h("div", { class: "spinner" }, [0, 1, 2, 3, 4].map(() => h("i")))));
    try {
      const mod = await app.load();
      win.body.innerHTML = "";
      proc.inst = (await mod.default({ win, shell: this, args, app, pid })) || {};
      this.wm.emit("change"); // lets the input layer pick the app's preferred controls
    } catch (e) {
      console.error(e);
      win.body.innerHTML = "";
      win.body.append(h("div", { class: "app-error" }, h("b", {}, "Falha ao abrir " + app.name), h("pre", {}, String(e?.stack || e))));
    }
    this.renderTaskbar();
    return proc;
  }

  kill(pid) { this.procs.get(pid)?.win.close(true); }

  async openFile(path) {
    const st = await this.vfs.stat(path);
    if (!st) return this.notify("Arquivo não encontrado", path, { level: "bad" });
    if (st.type === "dir") return this.open("explorer", { path });
    const k = kind(st.name, st.type);
    if (st.app) return this.open(st.app.launcher || "webapp", { path, ...st.app });
    switch (k) {
      case "link": {
        try {
          const l = JSON.parse(await this.vfs.readText(path));
          if (l.type === "app") return this.open(l.app, l.args || {});
          if (l.type === "file") return this.openFile(l.path);
          if (l.type === "url") return this.open("browser", { url: l.url });
        } catch { return this.notify("Atalho inválido", st.name, { level: "bad" }); }
        return;
      }
      case "text": return this.open("editor", { path });
      case "image": return this.open("viewer", { path });
      case "audio": case "video": return this.open("player", { path });
      case "html": return this.open("webapp", { path });
      case "disk": return this.open("x86", { image: path });
      case "pdf": return this.open("browser", { file: path });
      case "zip": case "exe": case "apk": return this.open("store", { analyze: path });
      default: return this.open("editor", { path });
    }
  }

  async importFiles(files, dir) {
    let ok = 0;
    for (const f of files) {
      try {
        const name = await this.vfs.uniqueName(dir, f.name);
        await this.vfs.write(join(dir, name), f);
        ok++;
      } catch (e) { this.notify("Falha ao transferir " + f.name, e.message, { level: "bad" }); }
    }
    if (ok) this.notify("Transferência concluída", `${ok} arquivo(s) copiado(s) do aparelho para ${dir}.`, { icon: "explorer" });
    return ok;
  }

  // ---------------- desktop icons ----------------
  async renderIcons() {
    if (!this.iconLayer || !this.logical) return;
    const files = await this.vfs.list("/Desktop").catch(() => []);
    const trashFull = (await this.vfs.list("/Lixeira").catch(() => [])).length > 0;
    const items = [
      ...SYS_ICONS.map((s) => ({ ...s, icon: s.id === "sys:trash" && trashFull ? "recycleFull" : s.icon })),
      ...this.pc.installed.filter((id) => APPS[id]).map((id) => ({ id: "app:" + id, label: APPS[id].name, icon: APPS[id].icon, open: (s) => s.open(id) })),
      ...files.map((f) => ({ id: "file:" + f.path, label: f.name.replace(/\.lnk$/, ""), icon: iconForFile(f), file: f, open: (s) => s.openFile(f.path) })),
    ];
    const size = { sm: [76, 84], md: [86, 96], lg: [100, 112] }[this.settings.iconSize || "md"];
    const rows = Math.max(1, Math.floor((this.logical.h - this.taskbarHeight - 8) / size[1]));
    this.iconLayer.innerHTML = "";
    items.forEach((it, i) => {
      const col = Math.floor(i / rows), row = i % rows;
      const el = h("div", { class: "dicon", tabindex: 0, dataset: { id: it.id }, style: { left: 6 + col * size[0] + "px", top: 6 + row * size[1] + "px", width: size[0] - 4 + "px" } },
        h("div", { class: "dicon-img", html: it.thumb || appIcon(it.icon, size[0] > 90 ? 52 : 44) }),
        h("div", { class: "dicon-label" }, it.label));
      let lastClick = 0;
      el.addEventListener("click", (e) => {
        this.selectIcon(it.id);
        const now = performance.now();
        if (now - lastClick < 450) { lastClick = 0; it.open(this); } else lastClick = now;
        e.stopPropagation();
      });
      el.addEventListener("dblclick", (e) => { e.preventDefault(); });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") it.open(this); if (e.key === "Delete" && it.file) this.vfs.trash(it.file.path); });
      el.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); this.selectIcon(it.id); this.iconMenu(e, it); });
      this.iconLayer.append(el);
    });
  }
  selectIcon(id) { this.iconLayer.querySelectorAll(".dicon").forEach((d) => d.classList.toggle("sel", d.dataset.id === id)); }

  // ---------------- context menus ----------------
  menu(e, items) {
    this.closePopups();
    const r = this.screenRect();
    const x = (e.clientX - r.left) / this.scale, y = (e.clientY - r.top) / this.scale;
    const m = h("div", { class: "ctxmenu popup" }, items.map((it) => it === "-" ? h("div", { class: "sep" }) :
      h("button", { class: "ctx-item" + (it.danger ? " danger" : ""), disabled: it.disabled, onclick: () => { m.remove(); it.run(); } }, h("span", { html: it.icon ? ui(it.icon, 15) : "" }), h("span", { class: "grow" }, it.label), it.hint ? h("span", { class: "faint" }, it.hint) : null)));
    this.overlayHost.append(m);
    const mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = clamp(x, 4, this.logical.w - mw - 4) + "px";
    m.style.top = clamp(y, 4, this.logical.h - mh - 4) + "px";
    return m;
  }

  desktopMenu(e) {
    const newItem = async (kindName) => {
      const isDir = kindName === "dir";
      const name = await promptBox(this.overlayHost, isDir ? "Nova pasta" : "Novo documento de texto", isDir ? "Nova pasta" : "Novo documento.txt");
      if (!name) return;
      try {
        const p = join("/Desktop", await this.vfs.uniqueName("/Desktop", name));
        if (isDir) await this.vfs.mkdir(p); else await this.vfs.write(p, "");
      } catch (err) { this.notify("Erro", err.message, { level: "bad" }); }
    };
    this.menu(e, [
      { label: "Nova pasta", icon: "folder", run: () => newItem("dir") },
      { label: "Novo documento de texto", icon: "file", run: () => newItem("txt") },
      { label: "Colar", icon: "paste", disabled: !this.clipboard, run: () => this.paste("/Desktop") },
      { label: "Transferir arquivos do aparelho…", icon: "upload", run: async () => { const { pickFiles } = await import("../core/util.js"); this.importFiles(await pickFiles(), "/Desktop"); } },
      "-",
      { label: "Atualizar", icon: "refresh", run: () => this.renderIcons() },
      { label: "Abrir no Terminal", icon: "terminal", run: () => this.open("terminal", { cwd: "/Desktop" }) },
      { label: "Personalizar", icon: "palette", run: () => this.open("settings", { page: "personalize" }) },
      { label: "Configurações de tela", icon: "monitor", run: () => this.open("settings", { page: "display" }) },
    ]);
  }

  iconMenu(e, it) {
    const items = [{ label: "Abrir", icon: "fwd", run: () => it.open(this) }];
    if (it.file) {
      items.push(
        { label: "Copiar", icon: "copy", run: () => { this.clipboard = { op: "copy", paths: [it.file.path] }; } },
        { label: "Recortar", icon: "cut", run: () => { this.clipboard = { op: "cut", paths: [it.file.path] }; } },
        { label: "Renomear", icon: "edit", run: async () => { const n = await promptBox(this.overlayHost, "Renomear", it.file.name); if (n && n !== it.file.name) this.vfs.rename(it.file.path, n).catch((err) => this.notify("Erro", err.message, { level: "bad" })); } },
        { label: "Propriedades", icon: "info", run: () => alertBox(this.overlayHost, it.file.name, `Tipo: ${it.file.type === "dir" ? "Pasta" : extOf(it.file.name).toUpperCase() || "Arquivo"}\nTamanho: ${fmtBytes(it.file.size)}\nLocal: ${it.file.path}\nModificado: ${fmtDate(it.file.modified)}`) },
        "-",
        { label: "Excluir", icon: "trash", danger: true, run: () => this.vfs.trash(it.file.path) });
    } else if (it.id.startsWith("app:")) {
      items.push({ label: "Desinstalar…", icon: "trash", danger: true, run: () => this.open("store", { tab: "installed" }) });
    } else if (it.id === "sys:trash") {
      items.push({ label: "Esvaziar Lixeira", icon: "trash", danger: true, run: async () => { if (await confirmBox(this.overlayHost, "Esvaziar Lixeira", "Os itens serão excluídos permanentemente.", "Esvaziar", true)) this.vfs.emptyTrash(); } });
    }
    this.menu(e, items);
  }

  async paste(dir) {
    if (!this.clipboard) return;
    const { op, paths } = this.clipboard;
    for (const p of paths) {
      try {
        const name = await this.vfs.uniqueName(dir, basename(p));
        if (op === "cut") { if (dirname(p) !== dir) await this.vfs.move(p, join(dir, name)); }
        else await this.vfs.copy(p, join(dir, name));
      } catch (e) { this.notify("Erro ao colar", e.message, { level: "bad" }); }
    }
    if (op === "cut") this.clipboard = null;
  }

  // ---------------- taskbar ----------------
  renderTaskbar() {
    if (!this.taskbar) return;
    const running = new Map();
    for (const p of this.procs.values()) { if (!running.has(p.appId)) running.set(p.appId, []); running.get(p.appId).push(p); }
    const appIds = [...new Set([...PINNED, ...running.keys()])];
    const active = this.wm?.active;
    this.taskbar.innerHTML = "";
    const center = h("div", { class: "tb-center" },
      h("button", { class: "tb-btn tb-start", title: "Iniciar", html: logo(24), onclick: (e) => { e.stopPropagation(); this.toggleStart(); } }),
      h("button", { class: "tb-btn", title: "Pesquisar", html: ui("search", 20), onclick: (e) => { e.stopPropagation(); this.toggleStart(true); } }),
      appIds.map((id) => {
        const procs = running.get(id) || [];
        const isActive = procs.some((p) => p.win === active);
        const b = h("button", { class: "tb-btn tb-app" + (procs.length ? " running" : "") + (isActive ? " active" : ""), title: APPS[id].name, html: appIcon(APPS[id].icon, 26) });
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.closePopups();
          if (!procs.length) return this.open(id);
          if (procs.length === 1) return procs[0].win.toggleFromTaskbar();
          this.windowPicker(b, procs);
        });
        b.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.menu(e, [
            { label: "Nova janela", icon: "plus", run: () => this.open(id) },
            ...(procs.length ? [{ label: "Fechar janela(s)", icon: "x", run: () => procs.forEach((p) => p.win.close()) }] : []),
          ]);
        });
        return b;
      }));
    this.tray = h("div", { class: "tb-tray" });
    this.taskbar.append(center, this.tray, h("button", { class: "tb-showdesk", title: "Mostrar área de trabalho", onclick: () => this.wm.minimizeAll() }));
    this.renderTray();
  }

  windowPicker(anchor, procs) {
    this.closePopups();
    const r = anchor.getBoundingClientRect(), sr = this.screenRect();
    const m = h("div", { class: "win-picker popup" }, procs.map((p) => h("button", { class: "ctx-item", onclick: () => { m.remove(); p.win.restore(); } }, h("span", { html: appIcon(p.win.iconId, 18) }), p.win.title)));
    this.overlayHost.append(m);
    m.style.left = clamp((r.left - sr.left) / this.scale - 60, 4, this.logical.w - 240) + "px";
    m.style.bottom = this.taskbarHeight + 8 + "px";
  }

  renderTray() {
    if (!this.tray) return;
    const s = this.settings;
    const online = navigator.onLine && !s.network?.offline;
    const b = metrics.battery;
    const unread = this.notifications.filter((n) => !n.read).length;
    this.tray.innerHTML = "";
    this.tray.append(
      h("button", { class: "tb-btn tb-small" + (s.hud ? " on" : ""), title: "Painel de desempenho (FPS)", html: ui("zap", 16), onclick: () => this.setSetting("hud", !s.hud) }),
      h("button", { class: "tb-btn tb-quick", title: "Configurações rápidas", onclick: (e) => { e.stopPropagation(); this.toggleQuick(); } },
        h("span", { html: ui(s.network?.offline ? "plane" : online ? "wifi" : "wifiOff", 16) }),
        h("span", { html: ui(s.muted || !s.volume ? "mute" : "volume", 16) }),
        b ? h("span", { class: "tb-batt" }, h("span", { html: ui("battery", 18) }), Math.round(b.level * 100) + "%") : null),
      this.clockBtn = h("button", { class: "tb-btn tb-clock", title: "Notificações e calendário", onclick: (e) => { e.stopPropagation(); this.toggleNotif(); } },
        h("div", { class: "clock-txt" }, h("b"), h("small")),
        unread && !s.dnd ? h("span", { class: "badge" }, unread) : s.dnd ? h("span", { html: ui("moon", 12) }) : null));
    this.tickClock();
  }

  tickClock() {
    if (!this.clockBtn) return;
    const d = new Date();
    this.clockBtn.querySelector("b").textContent = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    this.clockBtn.querySelector("small").textContent = d.toLocaleDateString("pt-BR");
  }

  closePopups(keepNothing) {
    this.overlayHost.querySelectorAll(".popup").forEach((p) => p.remove());
    this.startEl = this.quickEl = this.notifEl = null;
  }

  // ---------------- start menu ----------------
  toggleStart(focusSearch) {
    if (this.startEl) return this.closePopups();
    this.closePopups();
    const search = h("input", { class: "sm-search", placeholder: "Pesquisar apps, configurações e arquivos", oninput: () => draw() });
    const results = h("div", { class: "sm-body" });
    const apps = START_PINNED.concat(this.pc.installed).filter((id, i, a) => APPS[id] && !APPS[id].hidden && a.indexOf(id) === i);
    const launch = (fn) => { this.closePopups(); fn(); };
    const draw = async () => {
      const q = search.value.trim().toLowerCase();
      results.innerHTML = "";
      if (!q) {
        results.append(
          h("div", { class: "sm-head" }, h("b", {}, "Fixados"), h("span", { class: "faint" }, `${apps.length} apps`)),
          h("div", { class: "sm-grid" }, apps.map((id) => h("button", { class: "sm-app", onclick: () => launch(() => this.open(id)) }, h("span", { html: appIcon(APPS[id].icon, 34) }), h("small", {}, APPS[id].short || APPS[id].name)))));
        const all = (await this.vfs.all()).filter((f) => f.type === "file" && !f.path.startsWith("/Lixeira") && !f.path.startsWith("/Programas")).sort((a, b) => b.modified - a.modified).slice(0, 6);
        results.append(h("div", { class: "sm-head" }, h("b", {}, "Recomendados")),
          all.length ? h("div", { class: "sm-recent" }, all.map((f) => h("button", { class: "sm-file", onclick: () => launch(() => this.openFile(f.path)) }, h("span", { html: appIcon(iconForFile(f), 28) }), h("div", { class: "grow" }, h("b", {}, f.name), h("small", { class: "faint" }, fmtDate(f.modified))))))
            : h("div", { class: "faint sm-empty" }, "Seus arquivos recentes aparecem aqui."));
      } else {
        const appHits = apps.filter((id) => (APPS[id].name + " " + (APPS[id].short || "")).toLowerCase().includes(q));
        const fileHits = (await this.vfs.all()).filter((f) => f.name.toLowerCase().includes(q)).slice(0, 12);
        const settingsHits = [["display", "Tela e resolução"], ["personalize", "Papel de parede e cores"], ["hardware", "Hardware do PC"], ["sound", "Som e volume"], ["network", "Rede"], ["controls", "Mouse e teclado virtuais"], ["storage", "Armazenamento"]].filter(([, n]) => n.toLowerCase().includes(q));
        results.append(h("div", { class: "sm-list" },
          appHits.map((id) => h("button", { class: "sm-file", onclick: () => launch(() => this.open(id)) }, h("span", { html: appIcon(APPS[id].icon, 28) }), h("div", { class: "grow" }, h("b", {}, APPS[id].name), h("small", { class: "faint" }, "Aplicativo")))),
          settingsHits.map(([p, n]) => h("button", { class: "sm-file", onclick: () => launch(() => this.open("settings", { page: p })) }, h("span", { html: appIcon("settings", 28) }), h("div", { class: "grow" }, h("b", {}, n), h("small", { class: "faint" }, "Configurações")))),
          fileHits.map((f) => h("button", { class: "sm-file", onclick: () => launch(() => this.openFile(f.path)) }, h("span", { html: appIcon(iconForFile(f), 28) }), h("div", { class: "grow" }, h("b", {}, f.name), h("small", { class: "faint" }, f.path)))),
          !appHits.length && !fileHits.length && !settingsHits.length ? h("div", { class: "faint sm-empty" }, "Nada encontrado.") : null));
      }
    };
    const powerMenu = (e) => {
      e.stopPropagation();
      const pm = h("div", { class: "power-menu" },
        h("button", { class: "ctx-item", onclick: () => this.power("suspend") }, h("span", { html: ui("moon", 15) }), "Suspender"),
        h("button", { class: "ctx-item", onclick: () => this.power("restart") }, h("span", { html: ui("restart", 15) }), "Reiniciar"),
        h("button", { class: "ctx-item", onclick: () => this.power("shutdown") }, h("span", { html: ui("power", 15) }), "Desligar"));
      this.startEl.querySelector(".power-menu")?.remove();
      this.startEl.append(pm);
    };
    this.startEl = h("div", { class: "startmenu popup", onpointerdown: (e) => { if (!e.target.closest(".power-menu, .sm-power")) this.startEl?.querySelector(".power-menu")?.remove(); } },
      h("div", { class: "sm-top" }, h("span", { class: "sm-search-ico", html: ui("search", 16) }), search),
      results,
      h("div", { class: "sm-foot" },
        h("div", { class: "sm-user" }, h("div", { class: "avatar sm" }, this.pc.name[0]?.toUpperCase()), h("div", {}, h("b", {}, this.pc.name), h("small", { class: "faint" }, `${cpuOf(this.pc).model} · ${this.pc.ram} GB`))),
        h("button", { class: "tb-btn sm-power", title: "Energia", html: ui("power", 18), onclick: powerMenu })));
    this.overlayHost.append(this.startEl);
    draw();
    if (focusSearch) setTimeout(() => search.focus(), 50);
  }

  // ---------------- quick settings ----------------
  toggleQuick() {
    if (this.quickEl) return this.closePopups();
    this.closePopups();
    const s = this.settings;
    const tile = (icon, label, on, fn, sub) => h("button", { class: "qs-tile" + (on ? " on" : ""), onclick: async () => { await fn(); this.closePopups(); this.toggleQuick(); } }, h("span", { html: ui(icon, 18) }), h("b", {}, label), sub ? h("small", {}, sub) : null);
    const conn = navigator.connection;
    const orientationLocked = !!this._orientLock;
    this.quickEl = h("div", { class: "quick popup" },
      h("div", { class: "qs-grid" },
        tile(navigator.onLine ? "wifi" : "wifiOff", "Internet", navigator.onLine && !s.network?.offline, () => this.setSetting("network.offline", !s.network?.offline), navigator.onLine ? (conn?.effectiveType ? conn.effectiveType.toUpperCase() : "Conectado") : "Sem rede"),
        tile("plane", "Modo avião", s.network?.offline, () => this.setSetting("network.offline", !s.network?.offline), "Bloqueia rede no PC"),
        tile("moon", "Não perturbe", s.dnd, () => this.setSetting("dnd", !s.dnd)),
        tile("zap", "Painel FPS", s.hud, () => this.setSetting("hud", !s.hud)),
        tile(document.fullscreenElement ? "exitFull" : "fullscreen", "Tela cheia", !!document.fullscreenElement, toggleFullscreen),
        tile("rotate", "Travar paisagem", orientationLocked, () => this.toggleOrientationLock()),
        tile("gamepad", "Controles", s.controls?.visible !== false, () => this.setSetting("controls.visible", s.controls?.visible === false)),
        tile("keyboard", "Teclado", false, () => this.input.toggleKeyboard(true))),
      h("div", { class: "qs-slider" }, h("button", { html: ui(s.muted ? "mute" : "volume", 18), onclick: () => { this.setSetting("muted", !s.muted); this.closePopups(); this.toggleQuick(); } }),
        h("input", { type: "range", min: 0, max: 100, value: s.volume ?? 70, oninput: (e) => this.setSetting("volume", +e.target.value) }), h("span", { class: "qs-val" }, `${s.volume ?? 70}`)),
      h("div", { class: "qs-slider" }, h("span", { html: ui("brightness", 18) }),
        h("input", { type: "range", min: 30, max: 100, value: s.brightness ?? 100, oninput: (e) => this.setSetting("brightness", +e.target.value) }), h("span", { class: "qs-val faint", title: "Ajusta o brilho do PC virtual (o brilho real da tela é controlado pelo Android)" }, "PC")),
      h("div", { class: "qs-foot" },
        h("span", { class: "faint" }, metrics.battery ? `Bateria ${Math.round(metrics.battery.level * 100)}%${metrics.battery.charging ? " · carregando" : ""}` : "Bateria: indisponível"),
        h("button", { class: "tb-btn", title: "Configurações", html: ui("sliders", 16), onclick: () => { this.closePopups(); this.open("settings"); } })));
    this.overlayHost.append(this.quickEl);
  }

  async toggleOrientationLock() {
    try {
      if (this._orientLock) { screen.orientation.unlock(); this._orientLock = false; return; }
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      await screen.orientation.lock("landscape");
      this._orientLock = true;
    } catch (e) {
      this.notify("Rotação", "Seu navegador não permite travar a orientação. Gire o aparelho ou ative a rotação automática do Android.", { level: "warn" });
    }
  }

  // ---------------- notifications ----------------
  notify(title, body = "", { icon = "settings", level = "info", app } = {}) {
    const n = { id: uid("n"), title, body, icon, level, app, time: Date.now(), read: false };
    this.notifications.unshift(n);
    this.notifications = this.notifications.slice(0, 50);
    kv.set("notif:" + this.pc.id, this.notifications).catch(() => {});
    this.renderTray();
    if (this.notifEl) this.renderNotifCenter();
    if (this.settings.dnd && level !== "bad") return n;
    const t = h("div", { class: "toast " + level }, h("span", { class: "toast-ico", html: appIcon(icon, 30) }), h("div", { class: "grow" }, h("b", {}, title), body ? h("p", {}, body) : null), h("button", { class: "toast-x", html: ui("x", 14), onclick: () => t.remove() }));
    this.toastLayer.append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, level === "bad" ? 7000 : 4500);
    return n;
  }

  toggleNotif() {
    if (this.notifEl) return this.closePopups();
    this.closePopups();
    this.notifEl = h("div", { class: "notif-center popup" });
    this.overlayHost.append(this.notifEl);
    this.renderNotifCenter();
    this.notifications.forEach((n) => { n.read = true; });
    kv.set("notif:" + this.pc.id, this.notifications).catch(() => {});
    this.renderTray();
  }

  renderNotifCenter() {
    if (!this.notifEl) return;
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    this.notifEl.innerHTML = "";
    this.notifEl.append(
      h("div", { class: "nc-card" },
        h("div", { class: "nc-head" }, h("b", {}, "Notificações"), h("div", { class: "spacer" }),
          h("button", { class: "btn small", onclick: () => this.setSetting("dnd", !this.settings.dnd).then(() => this.renderNotifCenter()) }, this.settings.dnd ? "Não perturbe: ligado" : "Não perturbe"),
          h("button", { class: "btn small", onclick: () => { this.notifications = []; kv.set("notif:" + this.pc.id, []); this.renderNotifCenter(); this.renderTray(); } }, "Limpar")),
        h("div", { class: "nc-list" }, this.notifications.length ? this.notifications.map((n) => h("div", { class: "nc-item " + n.level }, h("span", { html: appIcon(n.icon, 26) }), h("div", { class: "grow" }, h("b", {}, n.title), n.body ? h("p", {}, n.body) : null, h("small", { class: "faint" }, fmtDate(n.time))))) : h("div", { class: "faint nc-empty" }, "Nenhuma notificação nova"))),
      h("div", { class: "nc-card cal" },
        h("b", {}, d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })),
        h("div", { class: "cal-grid" }, ["D", "S", "T", "Q", "Q", "S", "S"].map((x) => h("span", { class: "faint" }, x)),
          Array.from({ length: first }, () => h("span")), Array.from({ length: days }, (_, i) => h("span", { class: i + 1 === d.getDate() ? "today" : "" }, i + 1)))));
  }

  // ---------------- HUD ----------------
  renderHud() {
    if (!this.settings.hud) return;
    const heap = metrics.heap();
    const vm = [...this.procs.values()].find((p) => p.inst?.mips);
    this.hud.innerHTML = `<b>${metrics.fps}</b> FPS · CPU ${metrics.cpu}% · RAM virt. ${Math.round(this.ramUsedMB())}/${this.ramTotalMB()} MB${heap ? ` · Heap ${fmtBytes(heap.used, 0)}` : ""}${vm ? ` · x86 ${vm.inst.mips()} MIPS` : ""}`;
  }

  // ---------------- keyboard shortcuts ----------------
  onKey(e) {
    const grab = this.wm.active && this.procs.get(this.wm.active.pid)?.inst?.grabsKeyboard?.();
    if (e.type === "keydown" && e.key === "F11") { e.preventDefault(); toggleFullscreen(); return; }
    if (grab) return;
    if (e.type === "keyup") {
      if ((e.key === "Meta" || e.key === "OS") && this._metaAlone) this.toggleStart();
      return;
    }
    this._metaAlone = e.key === "Meta" || e.key === "OS";
    if (e.metaKey && e.key !== "Meta") this._metaAlone = false;
    if (e.altKey && e.key === "Tab") { e.preventDefault(); this.wm.focusNext(); }
    else if (e.altKey && e.key === "F4") { e.preventDefault(); this.wm.active ? this.wm.active.close() : this.power("shutdown"); }
    else if (e.ctrlKey && e.shiftKey && e.key === "Escape") { e.preventDefault(); this.open("taskmgr"); }
    else if (e.metaKey && e.key.toLowerCase() === "d") { e.preventDefault(); this.wm.minimizeAll(); }
    else if (e.metaKey && e.key.toLowerCase() === "e") { e.preventDefault(); this.open("explorer"); }
    else if (e.metaKey && e.key.toLowerCase() === "i") { e.preventDefault(); this.open("settings"); }
    else if (e.key === "Escape" && this.overlayHost.querySelector(".popup")) this.closePopups();
  }

  // ---------------- power ----------------
  async power(action) {
    this.closePopups();
    if (action === "shutdown" || action === "restart") {
      const dirty = [...this.procs.values()].filter((p) => p.inst?.dirty?.());
      if (dirty.length && !(await confirmBox(this.overlayHost, "Alterações não salvas", `${dirty.map((p) => p.win.title).join(", ")} têm alterações não salvas. Continuar mesmo assim?`, action === "restart" ? "Reiniciar" : "Desligar", true))) return;
    }
    this.onPower(action);
  }

  async suspend() {
    const windows = [];
    for (const p of this.procs.values()) {
      const extra = (await p.inst?.suspend?.()) || {};
      windows.push({ appId: p.appId, args: { ...(p.args || {}), ...extra }, rect: p.win.normalRect || p.win.rect, state: p.win.state === "min" ? "normal" : p.win.state });
    }
    this.pc.session = { windows, at: Date.now() };
    this.pc.state = "suspended";
    await this.persist();
    this.teardown();
  }

  async shutdown() {
    this.pc.state = "off";
    this.pc.session = null;
    await this.persist();
    this.teardown();
  }

  teardown() {
    for (const p of [...this.procs.values()]) { try { p.inst?.destroy?.(); } catch {} }
    this.procs.clear();
    clearInterval(this.clockTimer);
    window.removeEventListener("keydown", this.keyHandler, true);
    window.removeEventListener("keyup", this.keyHandler, true);
    this.disposers.forEach((d) => d());
    this.input?.destroy();
    metrics.stop();
    this.el?.remove();
  }
  destroy() { this.teardown(); }
}

export function iconForFile(f) {
  if (f.type === "dir") return "folder";
  if (f.app) return f.app.icon || "webapp";
  if (f.linkIcon) return f.linkIcon;
  const k = kind(f.name, f.type);
  return { text: "text", image: "image", audio: "audio", video: "video", html: "html", disk: "disk", zip: "zip", exe: "exe", apk: "apk", pdf: "pdf", link: "link", app: "app" }[k] || "file";
}

function hexA(hex, a) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  return `rgba(${r},${g},${b},${a})`;
}
