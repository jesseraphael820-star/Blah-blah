// Virtual file system: a real, persistent hierarchical file system stored in
// IndexedDB (one namespace per virtual PC). File contents are real Blobs.
// The PC's "storage size" is enforced as a quota over these real bytes.

import { db } from "./db.js";
import { bus } from "./bus.js";
import { mimeOf, GB } from "./util.js";

export const SYSTEM_DIRS = ["Desktop", "Documentos", "Downloads", "Imagens", "Músicas", "Vídeos", "Programas", "Lixeira"];
export const TRASH = "/Lixeira";

export function normPath(p, cwd = "/") {
  if (!p) return cwd;
  if (p === "~") p = "/";
  const parts = (p.startsWith("/") ? p : cwd + "/" + p).split("/");
  const out = [];
  for (const s of parts) {
    if (!s || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return "/" + out.join("/");
}
export const dirname = (p) => { const n = normPath(p); const i = n.lastIndexOf("/"); return i <= 0 ? "/" : n.slice(0, i); };
export const basename = (p) => normPath(p).split("/").pop();
export const join = (...a) => normPath(a.join("/"));

export class FSError extends Error {}

export class VFS {
  constructor(pc) {
    this.pc = pc; // PC profile (id, storage capacity)
    this.reservedGB = 0;
  }
  get id() { return this.pc.id; }
  key(path) { return `${this.id}:${normPath(path)}`; }

  capacity() { return this.pc.storage * GB; }

  async init() {
    for (const d of SYSTEM_DIRS) await this.mkdir("/" + d, { silent: true });
  }

  async stat(path) {
    path = normPath(path);
    if (path === "/") return { path: "/", name: "/", type: "dir", parent: null };
    return (await db.get("files", this.key(path))) || null;
  }
  async exists(path) { return !!(await this.stat(path)); }

  async list(dir) {
    dir = normPath(dir);
    const rows = await db.byIndex("files", "parent", [this.id, dir]);
    return rows.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "pt-BR", { numeric: true }) : a.type === "dir" ? -1 : 1));
  }

  async all() { return db.byIndex("files", "pc", this.id); }

  async usage() {
    let bytes = 0, files = 0, dirs = 0;
    for (const f of await this.all()) { if (f.type === "dir") dirs++; else { files++; bytes += f.size || 0; } }
    return { bytes, files, dirs };
  }

  async mkdir(path, { silent = false } = {}) {
    path = normPath(path);
    if (path === "/") return;
    const st = await this.stat(path);
    if (st) { if (st.type === "dir") return; throw new FSError(`Já existe um arquivo chamado "${st.name}"`); }
    await this.mkdir(dirname(path), { silent: true });
    const now = Date.now();
    await db.put("files", { id: this.key(path), pc: this.id, path, parent: dirname(path), name: basename(path), type: "dir", size: 0, created: now, modified: now });
    if (!silent) bus.emit("fs:change", this.id, dirname(path));
  }

  async ensureSpace(extra) {
    const { bytes } = await this.usage();
    const cap = this.capacity();
    if (bytes + extra > cap) throw new FSError(`Armazenamento do PC cheio: faltam ${((bytes + extra - cap) / 1048576).toFixed(1)} MB. Aumente o armazenamento em Configurações ou libere espaço.`);
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota && est.usage + extra > est.quota * 0.98) throw new FSError("O armazenamento real do celular disponível para o app acabou.");
    }
  }

  async write(path, data, { mime, extra = {} } = {}) {
    path = normPath(path);
    if (path === "/") throw new FSError("Caminho inválido");
    let blob = data instanceof Blob ? data : new Blob([data ?? ""], { type: mime || mimeOf(path) });
    if (mime && blob.type !== mime) blob = new Blob([blob], { type: mime });
    const old = await this.stat(path);
    if (old?.type === "dir") throw new FSError("Já existe uma pasta com esse nome");
    await this.ensureSpace(blob.size - (old?.size || 0));
    await this.mkdir(dirname(path), { silent: true });
    const now = Date.now();
    await db.put("files", { ...(old || {}), ...extra, id: this.key(path), pc: this.id, path, parent: dirname(path), name: basename(path), type: "file", size: blob.size, mime: blob.type || mimeOf(path), data: blob, created: old?.created || now, modified: now });
    bus.emit("fs:change", this.id, dirname(path));
  }

  async read(path) {
    const st = await this.stat(path);
    if (!st) throw new FSError(`Arquivo não encontrado: ${path}`);
    if (st.type === "dir") throw new FSError(`"${st.name}" é uma pasta`);
    return st.data instanceof Blob ? st.data : new Blob([st.data || ""]);
  }
  async readText(path) { return (await this.read(path)).text(); }

  async descendants(path) {
    path = normPath(path);
    const pre = path === "/" ? "/" : path + "/";
    return (await this.all()).filter((f) => f.path.startsWith(pre));
  }

  async remove(path) {
    path = normPath(path);
    if (path === "/") throw new FSError("Não é possível remover a raiz");
    const st = await this.stat(path);
    if (!st) return;
    const keys = [st.id, ...(st.type === "dir" ? (await this.descendants(path)).map((f) => f.id) : [])];
    await db.delMany("files", keys);
    bus.emit("fs:change", this.id, dirname(path));
  }

  async uniqueName(dir, name) {
    let n = name, i = 1;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : "";
    while (await this.exists(join(dir, n))) n = `${stem} (${++i})${ext}`;
    return n;
  }

  async move(src, dst, { meta } = {}) {
    src = normPath(src); dst = normPath(dst);
    if (src === dst) return;
    if (dst.startsWith(src + "/")) throw new FSError("Não é possível mover uma pasta para dentro dela mesma");
    const st = await this.stat(src);
    if (!st) throw new FSError("Origem não encontrada");
    if (await this.exists(dst)) throw new FSError(`Já existe "${basename(dst)}" no destino`);
    await this.mkdir(dirname(dst), { silent: true });
    const items = [st, ...(st.type === "dir" ? await this.descendants(src) : [])];
    for (const it of items) {
      const np = dst + it.path.slice(src.length);
      const rec = { ...it, id: this.key(np), path: np, parent: dirname(np), name: basename(np), modified: it === st ? Date.now() : it.modified };
      if (it === st && meta) Object.assign(rec, meta);
      await db.put("files", rec);
    }
    await db.delMany("files", items.map((i) => i.id));
    bus.emit("fs:change", this.id, dirname(src));
    bus.emit("fs:change", this.id, dirname(dst));
  }

  async copy(src, dst) {
    src = normPath(src); dst = normPath(dst);
    const st = await this.stat(src);
    if (!st) throw new FSError("Origem não encontrada");
    if (dst.startsWith(src + "/")) throw new FSError("Não é possível copiar uma pasta para dentro dela mesma");
    const items = [st, ...(st.type === "dir" ? await this.descendants(src) : [])];
    await this.ensureSpace(items.reduce((a, b) => a + (b.size || 0), 0));
    for (const it of items) {
      const np = dst + it.path.slice(src.length);
      if (it.type === "dir") await this.mkdir(np, { silent: true });
      else await this.write(np, it.data, { extra: { app: it.app } });
    }
    bus.emit("fs:change", this.id, dirname(dst));
  }

  async rename(path, newName) {
    if (!newName || newName.includes("/")) throw new FSError("Nome inválido");
    await this.move(path, join(dirname(path), newName));
  }

  // Recycle bin
  async trash(path) {
    path = normPath(path);
    if (path.startsWith(TRASH + "/") || path === TRASH) return this.remove(path);
    const name = await this.uniqueName(TRASH, basename(path));
    await this.move(path, join(TRASH, name), { meta: { origPath: path, trashedAt: Date.now() } });
    bus.emit("fs:trash", this.id);
  }
  async restore(trashPath) {
    const st = await this.stat(trashPath);
    if (!st) return;
    let target = st.origPath || join("/Documentos", st.name);
    if (await this.exists(target)) target = join(dirname(target), await this.uniqueName(dirname(target), basename(target)));
    await this.move(trashPath, target, { meta: { origPath: undefined, trashedAt: undefined } });
    bus.emit("fs:trash", this.id);
  }
  async emptyTrash() {
    for (const f of await this.list(TRASH)) await this.remove(f.path);
    bus.emit("fs:trash", this.id);
  }

  async wipe() {
    await db.delMany("files", await db.keysByIndex("files", "pc", this.id));
  }
}
