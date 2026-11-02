// File Explorer: browse, create, rename, copy/cut/paste, delete (to trash),
// import files from the phone, export to the phone, drag & drop between folders.

import { h, fmtBytes, fmtDate, extOf, promptBox, alertBox, pickFiles, saveToDevice, confirmBox } from "../core/util.js";
import { join, dirname, basename, SYSTEM_DIRS } from "../core/vfs.js";
import { bus } from "../core/bus.js";
import { ui, appIcon } from "../ui/icons.js";
import { iconForFile } from "../ui/desktop.js";

const PLACES = [
  ["/", "Este PC", "pc"], ["/Desktop", "Área de Trabalho", "monitor"], ["/Documentos", "Documentos", "file"], ["/Downloads", "Downloads", "download"],
  ["/Imagens", "Imagens", "image"], ["/Músicas", "Músicas", "music"], ["/Vídeos", "Vídeos", "video"], ["/Programas", "Programas", "apps"], ["/Lixeira", "Lixeira", "trash"],
];

export default async function explorer({ win, shell, args }) {
  const vfs = shell.vfs;
  let cwd = args.path || "/";
  let history = [cwd], hi = 0;
  let view = "grid";
  let sel = new Set();
  let items = [];

  const pathInput = h("input", { class: "input fx-path", value: cwd, onkeydown: (e) => { if (e.key === "Enter") go(e.target.value); } });
  const search = h("input", { class: "input fx-search", placeholder: "Pesquisar", oninput: () => render() });
  const tb = (icon, title, fn, extra = "") => h("button", { class: "btn icon small " + extra, title, html: ui(icon, 16), onclick: fn });
  const backBtn = tb("back", "Voltar", () => { if (hi > 0) { hi--; go(history[hi], false); } });
  const fwdBtn = tb("fwd", "Avançar", () => { if (hi < history.length - 1) { hi++; go(history[hi], false); } });
  const upBtn = tb("up", "Pasta acima", () => go(dirname(cwd)));
  const list = h("div", { class: "fx-list" });
  const status = h("div", { class: "fx-status" });
  const side = h("div", { class: "fx-side" }, PLACES.map(([p, n, i]) => h("button", { class: "fx-place", dataset: { p }, onclick: () => go(p) }, h("span", { html: ui(i, 16) }), n)));
  const usageBox = h("div", { class: "fx-usage" });
  side.append(usageBox);

  const actions = h("div", { class: "fx-actions" },
    h("button", { class: "btn small", onclick: () => newItem(true) }, h("span", { html: ui("plus", 14) }), "Nova pasta"),
    h("button", { class: "btn small", onclick: () => newItem(false) }, h("span", { html: ui("file", 14) }), "Novo arquivo"),
    h("button", { class: "btn small", title: "Transferir do celular para este PC", onclick: importFromDevice }, h("span", { html: ui("upload", 14) }), "Importar"),
    h("div", { class: "fx-sep" }),
    tb("cut", "Recortar", () => clip("cut")), tb("copy", "Copiar", () => clip("copy")), tb("paste", "Colar", () => shell.paste(cwd).then(load)),
    tb("edit", "Renomear", () => rename()), tb("trash", "Excluir", () => remove()), tb("download", "Salvar no celular", () => exportSel()),
    h("div", { class: "spacer" }),
    tb(view === "grid" ? "list" : "grid", "Modo de exibição", (e) => { view = view === "grid" ? "list" : "grid"; e.currentTarget.innerHTML = ui(view === "grid" ? "list" : "grid", 16); render(); }));

  win.body.append(h("div", { class: "fx" },
    h("div", { class: "fx-top" }, backBtn, fwdBtn, upBtn, tb("refresh", "Atualizar", () => load()), pathInput, search),
    actions,
    h("div", { class: "fx-main" }, side, h("div", { class: "fx-content" }, list, status))));

  list.addEventListener("pointerdown", (e) => { if (e.target === list) { sel.clear(); paintSel(); } });
  list.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".fx-item")) return;
    e.preventDefault();
    shell.menu(e, [
      { label: "Nova pasta", icon: "folder", run: () => newItem(true) },
      { label: "Novo arquivo de texto", icon: "file", run: () => newItem(false) },
      { label: "Colar", icon: "paste", disabled: !shell.clipboard, run: () => shell.paste(cwd).then(load) },
      { label: "Importar do celular…", icon: "upload", run: importFromDevice },
      { label: "Abrir no Terminal", icon: "terminal", run: () => shell.open("terminal", { cwd }) },
      ...(cwd === "/Lixeira" ? ["-", { label: "Esvaziar Lixeira", icon: "trash", danger: true, run: () => vfs.emptyTrash() }] : []),
    ]);
  });
  // drop real files from the device straight into the current folder
  list.addEventListener("dragover", (e) => { e.preventDefault(); list.classList.add("drop"); });
  list.addEventListener("dragleave", () => list.classList.remove("drop"));
  list.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); list.classList.remove("drop"); if (e.dataTransfer.files.length) shell.importFiles([...e.dataTransfer.files], cwd === "/" ? "/Documentos" : cwd); });

  async function go(p, push = true) {
    p = p || "/";
    const st = await vfs.stat(p);
    if (!st) return shell.notify("Pasta não encontrada", p, { level: "warn", icon: "explorer" });
    if (st.type !== "dir") return shell.openFile(p);
    cwd = st.path;
    if (push) { history = history.slice(0, hi + 1); history.push(cwd); hi = history.length - 1; }
    sel.clear();
    search.value = "";
    load();
  }

  async function load() {
    items = await vfs.list(cwd);
    pathInput.value = cwd;
    win.setTitle(cwd === "/" ? "Este PC" : basename(cwd));
    side.querySelectorAll(".fx-place").forEach((b) => b.classList.toggle("on", b.dataset.p === cwd));
    backBtn.disabled = hi <= 0; fwdBtn.disabled = hi >= history.length - 1; upBtn.disabled = cwd === "/";
    render();
    const u = await vfs.usage();
    const cap = vfs.capacity();
    const pct = (u.bytes / cap) * 100;
    usageBox.innerHTML = "";
    usageBox.append(h("small", { class: "faint" }, "Disco VDISK (C:)"), h("div", { class: "bar" + (pct > 90 ? " bad" : pct > 75 ? " warn" : "") }, h("i", { style: { width: Math.max(1, pct) + "%" } })), h("small", {}, `${fmtBytes(cap - u.bytes)} livres de ${fmtBytes(cap, 0)}`));
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    list.className = "fx-list " + view;
    list.innerHTML = "";
    if (view === "list") list.append(h("div", { class: "fx-row fx-hdr" }, h("span", {}, "Nome"), h("span", {}, "Modificado"), h("span", {}, "Tipo"), h("span", {}, "Tamanho")));
    if (!shown.length) list.append(h("div", { class: "fx-empty faint" }, q ? "Nenhum resultado." : cwd === "/Lixeira" ? "A Lixeira está vazia." : "Esta pasta está vazia. Toque com o botão direito para criar itens ou importe arquivos do celular."));
    for (const f of shown) {
      const typeLabel = f.type === "dir" ? "Pasta" : f.app ? "Aplicativo" : (extOf(f.name).toUpperCase() || "Arquivo");
      const el = view === "grid"
        ? h("div", { class: "fx-item", dataset: { path: f.path } }, h("div", { class: "fx-ic", html: appIcon(iconForFile(f), 46) }), h("div", { class: "fx-name" }, f.name), f.trashedAt ? h("small", { class: "faint" }, "de " + dirname(f.origPath || "")) : null)
        : h("div", { class: "fx-item fx-row", dataset: { path: f.path } }, h("span", { class: "fx-name" }, h("span", { html: appIcon(iconForFile(f), 20) }), f.name), h("span", { class: "faint" }, fmtDate(f.modified)), h("span", { class: "faint" }, typeLabel), h("span", { class: "faint" }, f.type === "dir" ? "" : fmtBytes(f.size)));
      el.title = `${f.name}\n${typeLabel}${f.type === "dir" ? "" : " · " + fmtBytes(f.size)}`;
      let last = 0;
      el.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey) { sel.has(f.path) ? sel.delete(f.path) : sel.add(f.path); }
        else { sel = new Set([f.path]); }
        paintSel();
        const now = performance.now();
        if (now - last < 450) { last = 0; open(f); } else last = now;
      });
      el.addEventListener("dblclick", (e) => e.preventDefault());
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!sel.has(f.path)) { sel = new Set([f.path]); paintSel(); }
        shell.menu(e, f.trashedAt ? [
          { label: "Restaurar", icon: "restart", run: () => Promise.all([...sel].map((p) => vfs.restore(p))).then(load) },
          { label: "Excluir permanentemente", icon: "trash", danger: true, run: () => remove() },
        ] : [
          { label: "Abrir", icon: "fwd", run: () => open(f) },
          ...(f.type === "file" ? [{ label: "Abrir com Bloco de Notas", icon: "edit", run: () => shell.open("editor", { path: f.path }) }] : []),
          "-",
          { label: "Recortar", icon: "cut", run: () => clip("cut") },
          { label: "Copiar", icon: "copy", run: () => clip("copy") },
          { label: "Renomear", icon: "edit", run: () => rename() },
          { label: "Criar atalho na Área de Trabalho", icon: "link", run: () => shortcut(f) },
          ...(f.type === "file" ? [{ label: "Salvar no celular", icon: "download", run: () => exportSel() }] : []),
          { label: "Propriedades", icon: "info", run: () => props(f) },
          "-",
          { label: "Excluir", icon: "trash", danger: true, run: () => remove() },
        ]);
      });
      // drag & drop inside the explorer (move into folders)
      el.addEventListener("pointerdown", (e) => startDrag(e, f, el));
      list.append(el);
    }
    paintSel();
    status.textContent = `${shown.length} ${shown.length === 1 ? "item" : "itens"}${sel.size ? ` · ${sel.size} selecionado(s)` : ""}`;
  }

  function paintSel() {
    list.querySelectorAll(".fx-item").forEach((el) => el.classList.toggle("sel", sel.has(el.dataset.path)));
    status.textContent = `${items.length} itens${sel.size ? ` · ${sel.size} selecionado(s)` : ""}`;
  }

  function startDrag(e, f, el) {
    if (e.button !== 0 || f.trashedAt) return;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null, over = null;
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10) return;
      if (!ghost) { ghost = h("div", { class: "fx-ghost", html: appIcon(iconForFile(f), 36) }); document.body.append(ghost); if (!sel.has(f.path)) { sel = new Set([f.path]); paintSel(); } }
      ghost.style.transform = `translate(${ev.clientX + 8}px, ${ev.clientY + 8}px)`;
      const t = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => x.closest?.(".fx-item, .fx-place"));
      const target = t?.closest(".fx-item, .fx-place");
      if (over !== target) { over?.classList.remove("drop-target"); over = target; }
      const tp = target?.dataset.path || target?.dataset.p;
      if (target && tp && !sel.has(tp)) target.classList.add("drop-target");
    };
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      ghost?.remove();
      over?.classList.remove("drop-target");
      if (!ghost || !over) return;
      const dest = over.dataset.path || over.dataset.p;
      const st = await vfs.stat(dest);
      if (!st || st.type !== "dir" || sel.has(dest)) return;
      for (const p of sel) {
        try { if (dest === "/Lixeira") await vfs.trash(p); else await vfs.move(p, join(dest, await vfs.uniqueName(dest, basename(p)))); }
        catch (err) { shell.notify("Não foi possível mover", err.message, { level: "bad", icon: "explorer" }); }
      }
      load();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function open(f) { if (f.trashedAt) return props(f); if (f.type === "dir") go(f.path); else shell.openFile(f.path); }
  function clip(op) { if (sel.size) shell.clipboard = { op, paths: [...sel] }; }

  async function newItem(dir) {
    const name = await promptBox(win.body, dir ? "Nova pasta" : "Novo arquivo", dir ? "Nova pasta" : "Novo documento.txt");
    if (!name) return;
    const base = cwd === "/" ? "/Documentos" : cwd;
    try {
      const p = join(base, await vfs.uniqueName(base, name));
      dir ? await vfs.mkdir(p) : await vfs.write(p, "");
      if (base !== cwd) go(base); else load();
    } catch (e) { shell.notify("Erro", e.message, { level: "bad", icon: "explorer" }); }
  }

  async function rename() {
    const p = [...sel][0];
    if (!p) return;
    if (cwd === "/" && SYSTEM_DIRS.includes(basename(p))) return alertBox(win.body, "Pasta do sistema", "Pastas do sistema não podem ser renomeadas.");
    const n = await promptBox(win.body, "Renomear", basename(p));
    if (!n || n === basename(p)) return;
    try { await vfs.rename(p, n); load(); } catch (e) { shell.notify("Erro ao renomear", e.message, { level: "bad", icon: "explorer" }); }
  }

  async function remove() {
    if (!sel.size) return;
    const paths = [...sel];
    if (cwd === "/" && paths.some((p) => SYSTEM_DIRS.includes(basename(p)))) return alertBox(win.body, "Pasta do sistema", "Pastas do sistema não podem ser excluídas.");
    if (cwd === "/Lixeira") {
      if (!(await confirmBox(win.body, "Excluir permanentemente", `${paths.length} item(ns) serão apagados para sempre.`, "Excluir", true))) return;
      for (const p of paths) await vfs.remove(p);
    } else for (const p of paths) await vfs.trash(p);
    sel.clear();
    load();
  }

  async function importFromDevice() {
    const files = await pickFiles();
    if (!files.length) return;
    const dest = cwd === "/" || cwd === "/Lixeira" ? "/Documentos" : cwd;
    await shell.importFiles(files, dest);
    if (dest !== cwd) go(dest); else load();
  }

  async function exportSel() {
    for (const p of sel) {
      const st = await vfs.stat(p);
      if (st?.type === "file") saveToDevice(await vfs.read(p), st.name);
    }
  }

  async function shortcut(f) {
    const name = await vfs.uniqueName("/Desktop", f.name.replace(/\.[^.]+$/, "") + ".lnk");
    await vfs.write(join("/Desktop", name), JSON.stringify({ type: "file", path: f.path }), { mime: "application/json", extra: { linkIcon: iconForFile(f) } });
  }

  async function props(f) {
    let size = f.size || 0, count = 0;
    if (f.type === "dir") { const d = await vfs.descendants(f.path); size = d.reduce((a, b) => a + (b.size || 0), 0); count = d.length; }
    alertBox(win.body, f.name, `Tipo: ${f.type === "dir" ? "Pasta" : f.mime || extOf(f.name)}\nLocal: ${dirname(f.path)}\nTamanho: ${fmtBytes(size)}${f.type === "dir" ? `\nContém: ${count} itens` : ""}\nCriado: ${fmtDate(f.created)}\nModificado: ${fmtDate(f.modified)}${f.origPath ? `\nLocal original: ${f.origPath}` : ""}`);
  }

  const off = bus.on("fs:change", (pc, dir) => { if (pc === shell.pc.id && (dir === cwd || dirname(dir) === cwd)) load(); });
  await load();
  return { destroy: off, onArgs: (a) => a.path && go(a.path) };
}
