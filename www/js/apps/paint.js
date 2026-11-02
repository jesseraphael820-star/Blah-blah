// Paint: brush, eraser, line, rectangle, ellipse, fill bucket, colours, undo,
// open/save PNG in the PC's file system.

import { h, promptBox } from "../core/util.js";
import { join } from "../core/vfs.js";
import { ui } from "../ui/icons.js";

const COLORS = ["#000000", "#ffffff", "#7f7f7f", "#c3c3c3", "#ed1c24", "#ff7f27", "#fff200", "#22b14c", "#00a2e8", "#3f48cc", "#a349a4", "#b97a57"];

export default async function paint({ win, shell, args }) {
  let tool = "brush", color = "#000000", size = 6, path = args.path || null;
  const canvas = h("canvas", { class: "pt-canvas", width: 1280, height: 800 });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const undo = [];
  const snap = () => { undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (undo.length > 25) undo.shift(); };
  const toolBtn = (id, icon, label) => h("button", { class: "btn small pt-tool" + (tool === id ? " on" : ""), dataset: { t: id }, title: label, onclick: () => { tool = id; bar.querySelectorAll(".pt-tool").forEach((b) => b.classList.toggle("on", b.dataset.t === id)); } }, icon);
  const bar = h("div", { class: "pt-bar" },
    toolBtn("brush", "✎", "Pincel"), toolBtn("eraser", "⌫", "Borracha"), toolBtn("line", "╱", "Linha"), toolBtn("rect", "▭", "Retângulo"), toolBtn("ellipse", "◯", "Elipse"), toolBtn("fill", "◧", "Balde de tinta"),
    h("input", { type: "range", min: 1, max: 60, value: size, title: "Espessura", oninput: (e) => { size = +e.target.value; } }),
    h("div", { class: "pt-colors" }, COLORS.map((c) => h("button", { class: "pt-color", style: { background: c }, onclick: () => { color = c; picker.value = c; } }))),
    h("input", { type: "color", value: color, onchange: (e) => { color = e.target.value; } }),
    h("span", { class: "spacer" }),
    h("button", { class: "btn small", onclick: () => { if (undo.length) ctx.putImageData(undo.pop(), 0, 0); } }, "Desfazer"),
    h("button", { class: "btn small", onclick: () => { snap(); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); } }, "Limpar"),
    h("button", { class: "btn small primary", onclick: save }, h("span", { html: ui("save", 14) }), "Salvar"));
  const picker = bar.querySelector('input[type="color"]');
  const wrap = h("div", { class: "pt-wrap" }, canvas);
  win.body.append(h("div", { class: "pt" }, bar, wrap));

  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height]; };
  let drawing = false, start, base;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const [x, y] = pos(e);
    snap();
    if (tool === "fill") return flood(Math.round(x), Math.round(y));
    drawing = true; start = [x, y]; base = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x, y);
    if (tool === "brush" || tool === "eraser") { ctx.lineTo(x + 0.1, y); stroke(); }
    const move = (ev) => {
      if (!drawing) return;
      const [mx, my] = pos(ev);
      if (tool === "brush" || tool === "eraser") { ctx.lineTo(mx, my); stroke(); }
      else {
        ctx.putImageData(base, 0, 0);
        ctx.beginPath();
        if (tool === "line") { ctx.moveTo(start[0], start[1]); ctx.lineTo(mx, my); }
        if (tool === "rect") ctx.rect(start[0], start[1], mx - start[0], my - start[1]);
        if (tool === "ellipse") ctx.ellipse((start[0] + mx) / 2, (start[1] + my) / 2, Math.abs(mx - start[0]) / 2, Math.abs(my - start[1]) / 2, 0, 0, Math.PI * 2);
        stroke();
      }
    };
    const up = () => { drawing = false; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
  function stroke() { ctx.strokeStyle = tool === "eraser" ? "#fff" : color; ctx.lineWidth = size; ctx.stroke(); }
  function flood(x, y) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data, W = canvas.width, H = canvas.height;
    const i0 = (y * W + x) * 4, target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const c = color.match(/\w\w/g).map((v) => parseInt(v, 16));
    if (target[0] === c[0] && target[1] === c[1] && target[2] === c[2]) return;
    const same = (i) => Math.abs(d[i] - target[0]) < 24 && Math.abs(d[i + 1] - target[1]) < 24 && Math.abs(d[i + 2] - target[2]) < 24;
    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop();
      let i = (py * W + px) * 4;
      if (px < 0 || py < 0 || px >= W || py >= H || !same(i)) continue;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    ctx.putImageData(img, 0, 0);
  }
  async function save() {
    if (!path) {
      const n = await promptBox(win.body, "Salvar desenho", "Desenho.png");
      if (!n) return;
      path = join("/Imagens", n.endsWith(".png") ? n : n + ".png");
    }
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    try { await shell.vfs.write(path, blob, { mime: "image/png" }); shell.notify("Desenho salvo", path, { icon: "paint" }); win.setTitle(path.split("/").pop() + " — Pintura"); }
    catch (e) { shell.notify("Erro ao salvar", e.message, { level: "bad", icon: "paint" }); }
  }
  if (path) {
    const img = new Image();
    img.src = URL.createObjectURL(await shell.vfs.read(path));
    await img.decode().catch(() => {});
    canvas.width = img.naturalWidth || 1280; canvas.height = img.naturalHeight || 800;
    ctx.drawImage(img, 0, 0);
  }
  return {};
}
