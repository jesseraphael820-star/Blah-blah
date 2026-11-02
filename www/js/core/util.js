// Small DOM + formatting helpers shared by the whole app.

// UI code passes optional children (`cond ? node : null`) to append(); make the
// native method skip null/undefined/false instead of printing them as text.
if (!Element.prototype.__vpcAppend) {
  const orig = Element.prototype.append;
  Element.prototype.__vpcAppend = orig;
  Element.prototype.append = function (...nodes) { return orig.apply(this, nodes.flat().filter((n) => n != null && n !== false)); };
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function fmtBytes(n, digits = 1) {
  if (n == null || isNaN(n)) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (Math.abs(n) >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : digits).replace(".", ",")} ${u[i]}`;
}

export const GB = 1024 ** 3;
export const MB = 1024 ** 2;

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function fmtDate(t) {
  const d = new Date(t);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function extOf(name) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export const MIME = {
  txt: "text/plain", md: "text/markdown", js: "text/javascript", json: "application/json", html: "text/html", htm: "text/html", css: "text/css", csv: "text/csv", log: "text/plain", ini: "text/plain", xml: "text/xml", sh: "text/x-sh", py: "text/x-python",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac",
  mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime",
  pdf: "application/pdf", zip: "application/zip", iso: "application/x-iso9660-image", img: "application/octet-stream", exe: "application/x-msdownload",
};
export const mimeOf = (name) => MIME[extOf(name)] || "application/octet-stream";

export function kind(name, type) {
  if (type === "dir") return "folder";
  const e = extOf(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(e)) return "image";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(e)) return "audio";
  if (["mp4", "webm", "mkv", "mov"].includes(e)) return "video";
  if (["txt", "md", "js", "json", "css", "csv", "log", "ini", "xml", "sh", "py", "c", "h", "bat"].includes(e)) return "text";
  if (["html", "htm"].includes(e)) return "html";
  if (["iso", "img", "ima", "bin", "vfd", "hdd"].includes(e)) return "disk";
  if (e === "zip") return "zip";
  if (["exe", "msi", "com"].includes(e)) return "exe";
  if (e === "apk") return "apk";
  if (e === "vpcapp") return "app";
  if (e === "lnk") return "link";
  if (e === "pdf") return "pdf";
  return "file";
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Modal dialogs rendered into a given container (the desktop or the launcher).
export function modal(container, { title, body, actions = [{ label: "OK", value: true, primary: true }], input }) {
  return new Promise((resolve) => {
    const field = input ? h("input", { class: "input", value: input.value || "", placeholder: input.placeholder || "" }) : null;
    const close = (v) => { bd.remove(); resolve(v); };
    const bd = h("div", { class: "modal-backdrop", onpointerdown: (e) => { if (e.target === bd) close(null); } },
      h("div", { class: "modal", role: "dialog" },
        title && h("h3", {}, title),
        body && (body instanceof Node ? body : h("p", {}, body)),
        field,
        h("div", { class: "actions" }, actions.map((a) =>
          h("button", { class: "btn" + (a.primary ? " primary" : "") + (a.danger ? " danger" : ""), onclick: () => close(field && a.value === true ? field.value : a.value) }, a.label)))));
    container.append(bd);
    if (field) {
      setTimeout(() => { field.focus(); field.select(); }, 30);
      field.addEventListener("keydown", (e) => { if (e.key === "Enter") close(field.value); if (e.key === "Escape") close(null); });
    }
  });
}

export const confirmBox = (c, title, body, label = "Confirmar", danger = false) =>
  modal(c, { title, body, actions: [{ label: "Cancelar", value: false }, { label, value: true, primary: !danger, danger }] });
export const promptBox = (c, title, value = "", placeholder = "") =>
  modal(c, { title, input: { value, placeholder }, actions: [{ label: "Cancelar", value: null }, { label: "OK", value: true, primary: true }] });
export const alertBox = (c, title, body) => modal(c, { title, body });

// Ask the user to pick files from the phone/computer storage.
export function pickFiles({ multiple = true, accept = "" } = {}) {
  return new Promise((resolve) => {
    const inp = h("input", { type: "file", multiple, accept, style: { display: "none" } });
    inp.addEventListener("change", () => { resolve([...inp.files]); inp.remove(); });
    inp.addEventListener("cancel", () => { resolve([]); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

// Save a blob to the real device storage (browser download / Android Downloads).
export async function saveToDevice(blob, name) {
  const nat = window.Capacitor?.Plugins?.DeviceSensors;
  if (nat) {
    // Android WebView cannot download blob: URLs; write to Downloads natively
    const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.readAsDataURL(blob); });
    return nat.saveFile({ name, mime: blob.type || "application/octet-stream", base64: b64 });
  }
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name, style: { display: "none" } });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
