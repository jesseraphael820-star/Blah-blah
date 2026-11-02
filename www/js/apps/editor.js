// Notepad-style text editor with open/save/save-as, find, word count, wrap and font size.

import { h, promptBox, confirmBox } from "../core/util.js";
import { join, basename, dirname } from "../core/vfs.js";
import { ui } from "../ui/icons.js";

export default async function editor({ win, shell, args }) {
  const vfs = shell.vfs;
  let path = args.path || null;
  let saved = "";
  let fontSize = 14;
  const ta = h("textarea", { class: "ed-text", spellcheck: false, wrap: "soft" });
  const status = h("div", { class: "ed-status" });
  const btn = (icon, label, fn) => h("button", { class: "btn small", onclick: fn }, h("span", { html: ui(icon, 14) }), label);
  const findBox = h("input", { class: "input ed-find hidden", placeholder: "Localizar… (Enter)", onkeydown: (e) => { if (e.key === "Enter") find(e.target.value); if (e.key === "Escape") findBox.classList.add("hidden"); } });

  win.body.append(h("div", { class: "ed" },
    h("div", { class: "ed-bar" },
      btn("file", "Novo", async () => { if (await canDiscard()) { path = null; ta.value = ""; saved = ""; update(); } }),
      btn("folder", "Abrir", openDialog),
      btn("save", "Salvar", () => save()),
      btn("copy", "Salvar como", () => save(true)),
      btn("search", "Localizar", () => { findBox.classList.toggle("hidden"); findBox.focus(); }),
      h("div", { class: "spacer" }),
      h("button", { class: "btn small icon", title: "Diminuir fonte", onclick: () => { fontSize = Math.max(10, fontSize - 1); ta.style.fontSize = fontSize + "px"; } }, "A-"),
      h("button", { class: "btn small icon", title: "Aumentar fonte", onclick: () => { fontSize = Math.min(28, fontSize + 1); ta.style.fontSize = fontSize + "px"; } }, "A+"),
      h("label", { class: "row small faint" }, h("input", { type: "checkbox", checked: true, onchange: (e) => { ta.wrap = e.target.checked ? "soft" : "off"; } }), "Quebra")),
    findBox, ta, status));

  ta.addEventListener("input", update);
  ta.addEventListener("keyup", update);
  ta.addEventListener("click", update);
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(e.shiftKey); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); findBox.classList.remove("hidden"); findBox.focus(); }
  });

  function update() {
    const dirty = ta.value !== saved;
    win.setTitle(`${dirty ? "● " : ""}${path ? basename(path) : "Sem título"} — Bloco de Notas`);
    const before = ta.value.slice(0, ta.selectionStart);
    const ln = before.split("\n").length, col = before.length - before.lastIndexOf("\n");
    const words = (ta.value.match(/\S+/g) || []).length;
    status.textContent = `Ln ${ln}, Col ${col}  ·  ${ta.value.length} caracteres  ·  ${words} palavras  ·  UTF-8${path ? "  ·  " + path : ""}`;
  }

  function find(q) {
    if (!q) return;
    const from = ta.selectionEnd;
    let i = ta.value.toLowerCase().indexOf(q.toLowerCase(), from);
    if (i < 0) i = ta.value.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return shell.notify("Localizar", `"${q}" não encontrado.`, { icon: "editor" });
    ta.focus();
    ta.setSelectionRange(i, i + q.length);
  }

  async function load(p) {
    try { ta.value = await vfs.readText(p); path = p; saved = ta.value; update(); }
    catch (e) { shell.notify("Erro ao abrir", e.message, { level: "bad", icon: "editor" }); }
  }

  async function openDialog() {
    if (!(await canDiscard())) return;
    const p = await promptBox(win.body, "Abrir arquivo", path || "/Documentos/", "/Documentos/arquivo.txt");
    if (p) load(p);
  }

  async function save(as = false) {
    let p = path;
    if (!p || as) {
      p = await promptBox(win.body, "Salvar como", path || "/Documentos/Novo documento.txt");
      if (!p) return false;
      if (!p.startsWith("/")) p = join("/Documentos", p);
    }
    try {
      await vfs.write(p, ta.value, { mime: "text/plain" });
      path = p; saved = ta.value; update();
      shell.notify("Arquivo salvo", `${basename(p)} em ${dirname(p)}`, { icon: "editor" });
      return true;
    } catch (e) { shell.notify("Erro ao salvar", e.message, { level: "bad", icon: "editor" }); return false; }
  }

  async function canDiscard() {
    if (ta.value === saved) return true;
    return confirmBox(win.body, "Alterações não salvas", "Descartar as alterações deste documento?", "Descartar", true);
  }

  win.onClose(canDiscard);
  if (path) await load(path); else update();
  setTimeout(() => ta.focus(), 50);
  return { dirty: () => ta.value !== saved, onArgs: (a) => a.path && load(a.path) };
}
