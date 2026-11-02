// Recycle bin: restore or permanently delete items moved to /Lixeira.

import { h, fmtBytes, fmtDate, confirmBox } from "../core/util.js";
import { dirname } from "../core/vfs.js";
import { bus } from "../core/bus.js";
import { appIcon } from "../ui/icons.js";
import { iconForFile } from "../ui/desktop.js";

export default async function recycle({ win, shell }) {
  const vfs = shell.vfs;
  const list = h("div", { class: "rb-list" });
  const info = h("span", { class: "faint" });
  win.body.append(h("div", { class: "rb" },
    h("div", { class: "rb-bar" }, info, h("span", { class: "spacer" }),
      h("button", { class: "btn small", onclick: async () => { for (const f of await vfs.list("/Lixeira")) await vfs.restore(f.path); } }, "Restaurar tudo"),
      h("button", { class: "btn small danger", onclick: async () => { if (await confirmBox(win.body, "Esvaziar Lixeira", "Os itens serão excluídos permanentemente.", "Esvaziar", true)) await vfs.emptyTrash(); } }, "Esvaziar Lixeira")),
    list));
  async function render() {
    const items = await vfs.list("/Lixeira");
    let size = 0;
    for (const f of items) size += f.type === "dir" ? (await vfs.descendants(f.path)).reduce((a, b) => a + (b.size || 0), 0) : f.size;
    info.textContent = `${items.length} item(ns) · ${fmtBytes(size)}`;
    list.innerHTML = "";
    if (!items.length) list.append(h("div", { class: "faint rb-empty" }, "A Lixeira está vazia."));
    for (const f of items) list.append(h("div", { class: "rb-row" },
      h("span", { html: appIcon(iconForFile(f), 30) }),
      h("div", { class: "grow" }, h("b", {}, f.name), h("small", { class: "faint" }, `Local original: ${f.origPath ? dirname(f.origPath) : "?"} · excluído ${fmtDate(f.trashedAt || f.modified)}`)),
      h("button", { class: "btn small", onclick: () => vfs.restore(f.path) }, "Restaurar"),
      h("button", { class: "btn small danger", onclick: async () => { if (await confirmBox(win.body, "Excluir permanentemente", f.name, "Excluir", true)) vfs.remove(f.path); } }, "Excluir")));
  }
  const offs = [bus.on("fs:trash", render), bus.on("fs:change", (pc, d) => d === "/Lixeira" && render())];
  await render();
  return { destroy: () => offs.forEach((o) => o()) };
}
