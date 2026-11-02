// Máquina Virtual x86: full PC emulation (CPU i686, RAM, VGA, PS/2, IDE,
// floppy, NE2000, virtio-9p) using v86 compiled to WebAssembly. Boots the
// bundled Linux / utilities or any .iso/.img the user imports. Keyboard and
// mouse are routed from the virtual controls or physical devices; the VM can
// be suspended to a real snapshot and shares files with the PC via 9p.

import { h, fmtBytes, pickFiles, kind, extOf, confirmBox, promptBox } from "../core/util.js";
import { join, basename } from "../core/vfs.js";
import { db } from "../core/db.js";
import { vmMemoryMB, device } from "../core/pcs.js";
import { scancodeBytes } from "../core/scancodes.js";
import { bus } from "../core/bus.js";
import { ui, appIcon } from "../ui/icons.js";

const V = (p) => new URL("../../vendor/v86/" + p, import.meta.url).href;
const IMG = (p) => new URL("../../images/" + p, import.meta.url).href;

export const BUILTIN = {
  "builtin:linux": { name: "VPC Linux (i686)", desc: "Linux 6.8 + BusyBox · pasta compartilhada · 2,8 MB", type: "bzimage", url: IMG("vpc-linux.bzImage"), minMB: 48, share: true },
  "builtin:memtest": { name: "Memtest86+ 7.0", desc: "Teste de RAM real no hardware emulado · 140 KB", type: "fda", url: IMG("memtest86plus.bin"), minMB: 16 },
  "builtin:vpcboot": { name: "VPC Boot Monitor", desc: "Mini sistema x86 em modo real · 9 KB", type: "fda", url: IMG("vpcboot.img"), minMB: 4 },
};
const SHARE_DIRS = ["/Documentos", "/Downloads", "/Desktop", "/Imagens", "/Músicas"];
const SHARE_LIMIT = 64 * 1024 * 1024;

export default async function x86vm({ win, shell, args }) {
  const vfs = shell.vfs;
  let emu = null, running = false, paused = false, current = null, memMB = Math.min(vmMemoryMB(shell.pc), 256);
  let lastIC = 0, lastT = 0, mips = 0, mipsTimer = null, focused = false, captured = false, btn = [0, 0, 0];
  let textScale = 1;

  const lib = h("div", { class: "vm-lib" });
  const screenBox = h("div", { class: "vm-screen-box" });
  const screenEl = h("div", { class: "vm-screen", tabindex: 0 }, h("div", { class: "vm-text" }), h("canvas", { class: "vm-canvas" }));
  screenBox.append(screenEl);
  const status = h("div", { class: "vm-status" });
  const tbtn = (icon, title, fn, cls = "") => h("button", { class: "btn small " + cls, title, onclick: fn }, h("span", { html: ui(icon, 14) }), title);
  const bar = h("div", { class: "vm-bar" });
  const overlay = h("div", { class: "vm-overlay hidden" });
  screenBox.append(overlay);
  const view = h("div", { class: "vm-view hidden" }, bar, screenBox, status);
  win.body.append(h("div", { class: "vm" }, lib, view));

  function drawBar() {
    bar.innerHTML = "";
    bar.append(
      tbtn("back", "Biblioteca", () => stop(true)),
      tbtn(paused ? "play" : "pause", paused ? "Continuar" : "Pausar", togglePause),
      tbtn("restart", "Reiniciar", () => emu?.restart()),
      tbtn("keyboard", "Ctrl+Alt+Del", () => sendCombo(["ControlLeft", "AltLeft", "Delete"])),
      tbtn("mouse", captured ? "Liberar mouse" : "Capturar mouse", () => (captured ? releaseMouse() : captureMouse())),
      tbtn("save", "Salvar estado", saveSnapshot),
      current?.share ? tbtn("download", "Copiar arquivos da VM", exportShared) : null,
      tbtn("fullscreen", "Tela cheia", () => { win.maximize(true); document.documentElement.requestFullscreen?.().catch(() => {}); }),
      h("span", { class: "spacer" }),
      tbtn("stop", "Desligar", () => stop(true), "danger"));
  }

  // ---------------- library ----------------
  async function drawLib() {
    view.classList.add("hidden");
    lib.classList.remove("hidden");
    win.setTitle("Máquina Virtual x86");
    const images = (await vfs.all()).filter((f) => f.type === "file" && kind(f.name) === "disk" && !f.path.startsWith("/Lixeira"));
    const snaps = (await db.get("snapshots", shell.pc.id)) || null;
    const maxMB = vmMemoryMB(shell.pc);
    const memInput = h("input", { type: "range", min: 16, max: maxMB, step: 16, value: memMB, oninput: (e) => { memMB = +e.target.value; memLabel.textContent = memMB + " MB"; } });
    const memLabel = h("b", {}, memMB + " MB");
    const net = shell.settings.network?.relay || "";
    lib.innerHTML = "";
    lib.append(
      h("div", { class: "vm-head" }, h("span", { html: appIcon("x86", 46) }), h("div", { class: "grow" }, h("h2", {}, "Máquina Virtual x86"), h("p", { class: "muted" }, "Emulação completa de um PC i686 (CPU, memória, VGA, teclado, mouse, discos e rede) em WebAssembly. Executa código x86 real, sem simulação."))),
      h("div", { class: "vm-cfg" },
        h("div", { class: "vm-cfg-item" }, h("small", { class: "faint" }, "RAM real da VM"), h("div", { class: "row" }, memInput, memLabel), h("small", { class: "faint" }, `Máximo seguro neste celular: ${maxMB} MB (limitado pela RAM do PC virtual e do aparelho)`)),
        h("div", { class: "vm-cfg-item" }, h("small", { class: "faint" }, "Rede da VM"), h("select", { class: "input", onchange: async (e) => { const v = e.target.value === "custom" ? (await promptBox(win.body, "Endereço do relay de rede", net && net !== "fetch" ? net : "wss://")) || "" : e.target.value; await shell.setSetting("network.relay", v); drawLib(); } },
          h("option", { value: "", selected: !net }, "Desligada"), h("option", { value: "fetch", selected: net === "fetch" }, "HTTP via navegador (fetch)"), h("option", { value: "custom", selected: !!net && net !== "fetch" }, net && net !== "fetch" ? net : "Relay WebSocket…")),
          h("small", { class: "faint" }, "O modo fetch dá acesso HTTP limitado (CORS). Um relay wss:// dá rede completa."))),
      snaps ? h("div", { class: "vm-snap" }, h("span", { html: ui("moon", 18) }), h("div", { class: "grow" }, h("b", {}, "Estado salvo: " + (snaps.name || "VM")), h("small", { class: "faint" }, `${fmtBytes(snaps.state.byteLength)} · ${new Date(snaps.at).toLocaleString("pt-BR")}`)),
        h("button", { class: "btn primary", onclick: () => start(snaps.image, { snapshot: snaps }) }, "Retomar"), h("button", { class: "btn", onclick: async () => { await db.del("snapshots", shell.pc.id); drawLib(); } }, "Descartar")) : null,
      h("h3", {}, "Sistemas incluídos"),
      h("div", { class: "vm-grid" }, Object.entries(BUILTIN).map(([id, b]) => imgCard(id, b.name, b.desc, "x86"))),
      h("h3", {}, "Suas imagens de disco"),
      h("div", { class: "vm-grid" },
        images.map((f) => imgCard(f.path, f.name, `${fmtBytes(f.size)} · ${f.path}`, "disk")),
        h("button", { class: "vm-card vm-add", onclick: importImage }, h("span", { html: ui("upload", 26) }), h("b", {}, "Importar .iso / .img do celular"), h("small", { class: "faint" }, "FreeDOS, KolibriOS, Alpine x86, Tiny Core, ReactOS, Windows 9x…"))),
      h("p", { class: "faint small" }, `Dica: a CPU emulada é 32 bits (i686). Desempenho típico: 30–300 MIPS dependendo do celular (${device().cores} núcleos aqui). Sistemas 64 bits e jogos Windows modernos não funcionam.`));
  }
  function imgCard(id, name, desc, icon) {
    return h("div", { class: "vm-card" }, h("div", { class: "row" }, h("span", { html: appIcon(icon, 36) }), h("div", { class: "grow" }, h("b", {}, name), h("small", { class: "faint" }, desc))),
      h("button", { class: "btn primary", onclick: () => start(id) }, h("span", { html: ui("power", 14) }), "Ligar"));
  }
  async function importImage() {
    const files = await pickFiles({ multiple: false, accept: ".iso,.img,.ima,.vfd,.bin,.hdd,application/octet-stream" });
    if (!files.length) return;
    await shell.importFiles(files, "/Downloads");
    drawLib();
  }

  // ---------------- run ----------------
  async function start(image, { snapshot } = {}) {
    if (running) await stop(false);
    const b = BUILTIN[image];
    const cfg = {
      wasm_path: V("v86.wasm"),
      memory_size: memMB * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      bios: { url: V("seabios.bin") },
      vga_bios: { url: V("vgabios.bin") },
      screen_container: screenEl,
      autostart: true,
      disable_keyboard: true,
      disable_mouse: true,
      disable_speaker: shell.volume() === 0,
      acpi: true,
    };
    let name;
    try {
      if (b) {
        name = b.name;
        if (memMB < b.minMB) cfg.memory_size = b.minMB * 1024 * 1024;
        if (b.type === "bzimage") { cfg.bzimage = { url: b.url }; cfg.cmdline = "console=tty0 loglevel=4 tsc=reliable"; cfg.filesystem = {}; }
        else cfg.fda = { buffer: await padFloppy(await (await fetch(b.url)).arrayBuffer()) };
      } else {
        const st = await vfs.stat(image);
        if (!st) throw new Error("Imagem não encontrada: " + image);
        name = st.name;
        const blob = await vfs.read(image);
        const head = await blob.slice(32769, 32774).text().catch(() => "");
        const ext = extOf(st.name);
        const async = blob.size > 64 * 1024 * 1024;
        if (head === "CD001" || ext === "iso") cfg.cdrom = { buffer: blob, async };
        else if (blob.size <= 2949120) cfg.fda = { buffer: await padFloppy(await blob.arrayBuffer()) };
        else cfg.hda = { buffer: blob, async };
      }
      const relay = shell.settings.network?.relay;
      if (relay && !shell.settings.network?.offline) { cfg.net_device = { type: "ne2k", relay_url: relay }; cfg.network_relay_url = relay; }
      if (snapshot) cfg.initial_state = { buffer: snapshot.state };
    } catch (e) { return shell.notify("Não foi possível ligar a VM", e.message, { level: "bad", icon: "x86" }); }

    current = { id: image, name, share: !!b?.share };
    lib.classList.add("hidden");
    view.classList.remove("hidden");
    overlay.classList.remove("hidden");
    overlay.innerHTML = "";
    overlay.append(h("div", { class: "spinner" }, [0, 1, 2, 3, 4].map(() => h("i"))), h("div", {}, `Ligando ${name}…`), h("small", { class: "faint" }, "Carregando BIOS e emulador (WebAssembly)"));
    win.setTitle(`${name} — Máquina x86`);
    drawBar();
    const { V86 } = await import("../../vendor/v86/libv86.mjs");
    emu = new V86(cfg);
    running = true; paused = false;
    shell.procs.get(pidOf())?.win && shell.renderTaskbar();
    emu.add_listener("emulator-ready", async () => {
      overlay.classList.add("hidden");
      if (current.share && !snapshot) await shareFiles();
      shell.notify("Máquina x86 ligada", `${name} · ${Math.round(cfg.memory_size / 1048576)} MB de RAM real`, { icon: "x86" });
    });
    emu.add_listener("download-progress", (e) => { if (e.total) overlay.querySelector("small").textContent = `Carregando ${basename(e.file_name || "")}: ${Math.round((e.loaded / e.total) * 100)}%`; });
    emu.add_listener("screen-set-size", () => setTimeout(fit, 30));
    lastIC = 0; lastT = performance.now();
    mipsTimer = setInterval(() => {
      if (!emu || paused) { mips = 0; return; }
      const ic = emu.get_instruction_counter(), t = performance.now();
      mips = lastIC ? Math.max(0, Math.round(((ic - lastIC) >>> 0) / ((t - lastT) * 1000))) : 0;
      lastIC = ic; lastT = t;
      status.innerHTML = "";
      status.append(h("span", {}, h("b", {}, mips), " MIPS"), h("span", {}, `RAM ${Math.round(cfg.memory_size / 1048576)} MB (real)`), h("span", {}, cfg.net_device ? "Rede: " + (cfg.network_relay_url === "fetch" ? "fetch" : "relay") : "Rede: off"), h("span", { class: focused ? "vm-focus on" : "vm-focus" }, focused ? "Teclado → VM" : "Toque na tela da VM para usar o teclado"), captured ? h("span", { class: "tag warn" }, "Mouse capturado") : null);
    }, 1000);
    focus();
  }

  async function padFloppy(buf) {
    const sizes = [368640, 737280, 1228800, 1474560, 2949120];
    const size = sizes.find((s) => s >= buf.byteLength) || buf.byteLength;
    if (size === buf.byteLength) return buf;
    const out = new Uint8Array(size);
    out.set(new Uint8Array(buf));
    return out.buffer;
  }

  // create parent directories inside the VM's 9p file system
  function mkdirs(dir) {
    const fs = emu.fs9p;
    let parent = 0, cur = "";
    for (const part of dir.split("/").filter(Boolean)) {
      cur += "/" + part;
      const s = fs.SearchPath(cur);
      parent = s.id !== -1 ? s.id : fs.CreateDirectory(part, parent);
    }
  }

  async function shareFiles() {
    let total = 0, n = 0;
    try {
      for (const f of await vfs.all()) {
        if (f.type !== "file" || !SHARE_DIRS.some((d) => f.path.startsWith(d + "/"))) continue;
        if (total + f.size > SHARE_LIMIT) break;
        mkdirs(f.path.slice(0, f.path.lastIndexOf("/")));
        await emu.create_file(f.path, new Uint8Array(await f.data.arrayBuffer()));
        total += f.size; n++;
      }
      await emu.create_file("/LEIA-ME.txt", new TextEncoder().encode(`Pasta compartilhada do Virtual PC.\nSeus arquivos (${n}) foram copiados para cá.\nCrie arquivos em /mnt/host e use "Copiar arquivos da VM" para trazê-los para /Documentos/Da VM.\n`));
    } catch (e) { console.warn("9p share", e); }
  }

  async function exportShared() {
    const fs = emu?.fs9p;
    if (!fs) return;
    const out = [];
    const walk = (p) => { for (const n of fs.read_dir(p) || []) { const full = (p === "/" ? "" : p) + "/" + n; const s = fs.SearchPath(full); if (s.id === -1) continue; if (fs.IsDirectory(s.id)) walk(full); else out.push(full); } };
    walk("/");
    let n = 0;
    for (const p of out) {
      if (p === "/LEIA-ME.txt") continue;
      const data = await emu.read_file(p);
      const dest = join("/Documentos/Da VM", p);
      const old = await vfs.stat(SHARE_DIRS.some((d) => p.startsWith(d + "/")) ? p : "/__none");
      if (old && old.size === data.byteLength) continue; // unchanged original
      await vfs.write(dest, new Blob([data]));
      n++;
    }
    shell.notify("Arquivos da VM", n ? `${n} arquivo(s) copiados para /Documentos/Da VM.` : "Nenhum arquivo novo ou alterado em /mnt/host.", { icon: "x86" });
  }

  async function saveSnapshot() {
    if (!emu) return;
    try {
      const state = await emu.save_state();
      await db.put("snapshots", { image: current.id, name: current.name, at: Date.now(), state, memMB }, shell.pc.id);
      shell.notify("Estado salvo", `${current.name}: ${fmtBytes(state.byteLength)} gravados. Retome pela biblioteca ou ao reabrir o PC.`, { icon: "x86" });
      return true;
    } catch (e) { shell.notify("Falha ao salvar estado", e.message, { level: "bad", icon: "x86" }); return false; }
  }

  function togglePause() {
    if (!emu) return;
    paused ? emu.run() : emu.stop();
    paused = !paused;
    drawBar();
  }

  async function stop(toLib) {
    releaseMouse();
    clearInterval(mipsTimer);
    if (emu) { try { await emu.destroy(); } catch {} }
    emu = null; running = false; mips = 0;
    screenEl.querySelector(".vm-text").innerHTML = "";
    if (toLib) drawLib();
  }

  // ---------------- display ----------------
  function fit() {
    const text = screenEl.querySelector(".vm-text"), canvas = screenEl.querySelector(".vm-canvas");
    const box = screenBox.getBoundingClientRect();
    const graphical = canvas.style.display !== "none" && canvas.width > 0;
    const el = graphical ? canvas : text;
    const w = graphical ? canvas.width : text.scrollWidth, hh = graphical ? canvas.height : text.scrollHeight;
    if (!w || !hh || !box.width) return;
    const scaleNow = shell.scale;
    textScale = Math.min((box.width / scaleNow) / w, (box.height / scaleNow) / hh);
    el.style.transform = `scale(${textScale})`;
    screenEl.style.width = w * textScale + "px";
    screenEl.style.height = hh * textScale + "px";
  }
  const ro = new ResizeObserver(() => fit());
  ro.observe(screenBox);
  win.on("resize", fit);

  // ---------------- input ----------------
  function pidOf() { return [...shell.procs.values()].find((p) => p.win === win)?.pid; }
  function focus() { focused = true; screenEl.focus({ preventScroll: true }); screenEl.classList.add("focused"); }
  function blur() { focused = false; screenEl.classList.remove("focused"); }
  win.on("focus", () => running && focus());
  shell.wm.on("change", () => { if (shell.wm.active !== win) blur(); });

  function sendKey(code, down) {
    if (!emu || paused) return;
    const bytes = scancodeBytes(code, down);
    if (bytes) emu.keyboard_send_scancodes(bytes);
  }
  function sendCombo(codes) { codes.forEach((c) => sendKey(c, true)); [...codes].reverse().forEach((c) => sendKey(c, false)); }

  const onKey = (e) => {
    if (!running || !focused || shell.wm.active !== win || !e.isTrusted) return;
    if (e.code === "F11") return;
    if (e.ctrlKey && e.altKey && e.code === "KeyG") { e.preventDefault(); releaseMouse(); return; }
    e.preventDefault();
    e.stopPropagation();
    sendKey(e.code, e.type === "keydown");
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);

  const mouseClick = () => emu?.bus.send("mouse-click", btn);
  const grab = {
    wantsMouse: true,
    move: (dx, dy) => emu?.bus.send("mouse-delta", [dx, -dy]),
    button: (b, down) => { btn[b === 2 ? 2 : b === 1 ? 1 : 0] = down ? 1 : 0; mouseClick(); },
    wheel: (dy) => emu?.bus.send("mouse-wheel", [dy > 0 ? -1 : 1, 0]),
    key: (code, down) => sendKey(code, down),
    combo: (keys) => sendCombo(keys.map((k) => ({ Control: "ControlLeft", Alt: "AltLeft", Shift: "ShiftLeft", Meta: "MetaLeft", Delete: "Delete", Escape: "Escape", Tab: "Tab", F4: "F4" }[k] || (k.length === 1 ? "Key" + k.toUpperCase() : k)))),
    release: () => { captured = false; drawBar(); },
  };
  function captureMouse() {
    if (!running) return;
    captured = true;
    shell.input.setGrab(grab);
    if (lastPointerType === "mouse") screenEl.requestPointerLock?.()?.catch?.(() => {});
    drawBar();
    focus();
  }
  function releaseMouse() {
    if (!captured) return;
    captured = false;
    if (shell.input.grab === grab) shell.input.setGrab(null);
    if (document.pointerLockElement === screenEl) document.exitPointerLock();
    btn = [0, 0, 0];
    if (running) drawBar();
  }

  // real input on the VM screen: physical mouse (pointer lock) or touch as touchpad
  let lastPointerType = "touch", touchStart = null;
  screenEl.addEventListener("pointerdown", (e) => {
    focus();
    if (!running) return;
    lastPointerType = e.isTrusted ? e.pointerType : "virtual";
    if (!e.isTrusted) { if (!captured) captureMouse(); return; } // virtual mouse click -> capture
    if (e.pointerType === "mouse") {
      if (!captured) return captureMouse();
      if (document.pointerLockElement !== screenEl) screenEl.requestPointerLock?.()?.catch?.(() => {});
      grab.button(e.button, true);
      e.preventDefault();
    } else {
      touchStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, id: e.pointerId };
      screenEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  screenEl.addEventListener("pointermove", (e) => {
    if (!running || !e.isTrusted) return;
    if (e.pointerType === "mouse" && document.pointerLockElement === screenEl) grab.move(e.movementX, e.movementY);
    else if (touchStart && e.pointerId === touchStart.id) {
      const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
      if (Math.hypot(dx, dy) > 3) touchStart.moved = true;
      grab.move(dx * 1.5, dy * 1.5);
      touchStart.x = e.clientX; touchStart.y = e.clientY;
    }
  });
  screenEl.addEventListener("pointerup", (e) => {
    if (!running || !e.isTrusted) return;
    if (e.pointerType === "mouse") { if (captured) grab.button(e.button, false); return; }
    if (touchStart && !touchStart.moved && performance.now() - touchStart.t < 250) { grab.button(0, true); setTimeout(() => grab.button(0, false), 40); }
    touchStart = null;
  });
  screenEl.addEventListener("contextmenu", (e) => e.preventDefault());
  screenEl.addEventListener("wheel", (e) => { if (running && captured) { e.preventDefault(); grab.wheel(e.deltaY); } }, { passive: false });
  const onLockChange = () => { if (!document.pointerLockElement && captured && lastPointerType === "mouse") releaseMouse(); };
  document.addEventListener("pointerlockchange", onLockChange);
  const offVol = bus.on("volume", () => {});

  win.onClose(async () => {
    if (running && !(await confirmBox(win.body, "Desligar a VM?", "O sistema emulado será desligado. Salve o estado se quiser continuar depois.", "Desligar", true))) return false;
    return true;
  });

  await drawLib();
  if (args.resume) {
    const snap = await db.get("snapshots", shell.pc.id);
    if (snap) start(snap.image, { snapshot: snap });
  } else if (args.image && args.autostart !== false) start(args.image);

  return {
    preferredInput: "mouse",
    mips: () => (running ? mips : 0),
    extraMem: () => (running ? memMB : 0),
    grabsKeyboard: () => running && focused,
    virtualKey: (code, down) => { if (running) { sendKey(code, down); return true; } return false; },
    virtualCombo: (keys) => (running ? (grab.combo(keys), true) : false),
    async suspend() { if (running && (await saveSnapshot())) return { resume: true }; return {}; },
    destroy() {
      stop(false);
      ro.disconnect();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      document.removeEventListener("pointerlockchange", onLockChange);
      offVol();
    },
  };
}
