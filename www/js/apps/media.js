// Fotos (image viewer with folder navigation and zoom) and Player (audio/video).

import { h, kind, saveToDevice } from "../core/util.js";
import { dirname, basename } from "../core/vfs.js";
import { bus } from "../core/bus.js";
import { ui } from "../ui/icons.js";

export async function viewer({ win, shell, args }) {
  const vfs = shell.vfs;
  let files = [], i = 0, zoom = 1, url = null;
  const img = h("img", { class: "mv-img", draggable: false });
  const name = h("span", { class: "grow" });
  const btn = (icon, title, fn) => h("button", { class: "btn small icon", title, html: ui(icon, 16), onclick: fn });
  win.body.append(h("div", { class: "mv" },
    h("div", { class: "mv-bar" }, btn("back", "Anterior", () => show(i - 1)), btn("fwd", "Próxima", () => show(i + 1)), name,
      btn("plus", "Zoom +", () => setZoom(zoom * 1.25)), btn("min", "Zoom −", () => setZoom(zoom / 1.25)), btn("max", "Ajustar", () => setZoom(1)),
      btn("palette", "Usar como papel de parede", async () => { await shell.setSetting("customWallpaper", files[i].path); await shell.setSetting("wallpaper", "custom"); shell.notify("Papel de parede", "Imagem aplicada.", { icon: "viewer" }); }),
      btn("download", "Salvar no celular", async () => saveToDevice(await vfs.read(files[i].path), files[i].name))),
    h("div", { class: "mv-stage" }, img)));
  const setZoom = (z) => { zoom = Math.max(0.2, Math.min(8, z)); img.style.transform = `scale(${zoom})`; };
  async function show(n) {
    if (!files.length) return;
    i = (n + files.length) % files.length;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(await vfs.read(files[i].path));
    img.src = url;
    name.textContent = `${files[i].name}  (${i + 1}/${files.length})`;
    win.setTitle(files[i].name + " — Fotos");
    setZoom(1);
  }
  files = (await vfs.list(args.path ? dirname(args.path) : "/Imagens")).filter((f) => kind(f.name) === "image");
  if (!files.length) img.replaceWith(h("div", { class: "faint mv-empty" }, "Nenhuma imagem em /Imagens. Importe fotos do celular pelo Explorador."));
  await show(Math.max(0, files.findIndex((f) => f.path === args.path)));
  win.body.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") show(i + 1); if (e.key === "ArrowLeft") show(i - 1); });
  win.body.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });
  return { destroy: () => url && URL.revokeObjectURL(url) };
}

export async function player({ win, shell, args }) {
  const vfs = shell.vfs;
  let queue = [], i = 0, url = null;
  const media = h("video", { class: "mp-media", controls: true, playsinline: true });
  const list = h("div", { class: "mp-list" });
  win.body.append(h("div", { class: "mp" }, h("div", { class: "mp-stage" }, media), list));
  const vol = () => { media.volume = shell.volume(); };
  const off = bus.on("volume", vol);
  async function play(n) {
    i = (n + queue.length) % queue.length;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(await vfs.read(queue[i].path));
    media.src = url;
    media.classList.toggle("audio", kind(queue[i].name) === "audio");
    vol();
    media.play().catch(() => {});
    win.setTitle(queue[i].name + " — Player");
    render();
  }
  function render() {
    list.innerHTML = "";
    queue.forEach((f, n) => list.append(h("button", { class: "mp-item" + (n === i ? " on" : ""), onclick: () => play(n) }, h("span", { html: ui(kind(f.name) === "audio" ? "music" : "video", 14) }), f.name)));
  }
  media.addEventListener("ended", () => queue.length > 1 && play(i + 1));
  media.addEventListener("error", () => shell.notify("Formato não suportado", `${queue[i]?.name}: o decodificador do celular não reproduz este formato.`, { level: "warn", icon: "player" }));
  queue = (await vfs.list(args.path ? dirname(args.path) : "/Músicas")).filter((f) => ["audio", "video"].includes(kind(f.name)));
  if (!queue.length) { list.append(h("div", { class: "faint mv-empty" }, "Nenhuma mídia em /Músicas. Abra um arquivo de áudio ou vídeo pelo Explorador.")); return { destroy: off }; }
  await play(Math.max(0, queue.findIndex((f) => f.path === args.path)));
  return { destroy() { off(); media.pause(); if (url) URL.revokeObjectURL(url); } };
}
