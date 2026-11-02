// Web browser: real web pages in an embedded frame, with address bar,
// history, bookmarks, home page and download integration.

import { h, esc } from "../core/util.js";
import { ui } from "../ui/icons.js";

const BOOKMARKS = [
  ["Wikipédia", "https://pt.m.wikipedia.org/wiki/Computador"],
  ["OpenStreetMap", "https://www.openstreetmap.org/export/embed.html?bbox=-46.75,-23.65,-46.55,-23.50&layer=mapnik"],
  ["Internet Archive (jogos DOS)", "https://archive.org/details/softwarelibrary_msdos_games"],
  ["v86 (projeto do emulador)", "https://copy.sh/v86/"],
];

export default async function browser({ win, shell, args }) {
  const tabs = [];
  let cur = null;
  const tabBar = h("div", { class: "br-tabs" });
  const addr = h("input", { class: "input br-addr", placeholder: "Pesquise ou digite um endereço", spellcheck: false });
  const frameHost = h("div", { class: "br-frames" });
  const notice = h("div", { class: "br-notice hidden" });
  const nav = (icon, title, fn) => h("button", { class: "btn icon small", title, html: ui(icon, 16), onclick: fn });
  win.body.append(h("div", { class: "br" },
    tabBar,
    h("div", { class: "br-bar" },
      nav("back", "Voltar", () => step(-1)), nav("fwd", "Avançar", () => step(1)), nav("refresh", "Recarregar", () => cur && load(cur.url, false)), nav("home", "Início", () => load("about:home")),
      addr,
      nav("download", "Baixar arquivo deste endereço", () => cur?.url.startsWith("http") && shell.open("downloads", { url: cur.url })),
      nav("link", "Abrir no navegador do celular", () => cur?.url.startsWith("http") && window.open(cur.url, "_blank", "noopener"))),
    notice, frameHost));

  addr.addEventListener("keydown", (e) => { if (e.key === "Enter") { load(toUrl(addr.value)); addr.blur(); } });
  addr.addEventListener("focus", () => addr.select());

  function toUrl(v) {
    v = v.trim();
    if (!v) return "about:home";
    if (/^(https?:|about:|blob:)/i.test(v)) return v;
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v)) return "https://" + v;
    return "https://duckduckgo.com/?q=" + encodeURIComponent(v);
  }

  function newTab(url = "about:home") {
    const frame = h("iframe", { class: "br-frame", referrerpolicy: "no-referrer", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads", allow: "fullscreen; autoplay; gamepad" });
    const home = h("div", { class: "br-home hidden" });
    const t = { url: "", title: "Nova guia", hist: [], hi: -1, frame, home };
    tabs.push(t);
    frameHost.append(frame, home);
    frame.addEventListener("load", () => { try { t.title = frame.contentDocument?.title || t.title; } catch {} renderTabs(); });
    select(t);
    load(url);
    return t;
  }
  function select(t) {
    cur = t;
    tabs.forEach((x) => { x.frame.classList.toggle("hidden", x !== t || x.url === "about:home"); x.home.classList.toggle("hidden", x !== t || x.url !== "about:home"); });
    addr.value = t.url === "about:home" ? "" : t.url;
    renderTabs();
    showNotice();
  }
  function closeTab(t) {
    const i = tabs.indexOf(t);
    tabs.splice(i, 1); t.frame.remove(); t.home.remove();
    if (!tabs.length) return win.close();
    if (cur === t) select(tabs[Math.max(0, i - 1)]);
    renderTabs();
  }
  function renderTabs() {
    tabBar.innerHTML = "";
    tabs.forEach((t) => tabBar.append(h("div", { class: "br-tab" + (t === cur ? " on" : ""), onclick: () => select(t) }, h("span", { html: ui("globe", 13) }), h("span", { class: "grow" }, t.title), h("button", { class: "br-tab-x", html: ui("x", 12), onclick: (e) => { e.stopPropagation(); closeTab(t); } }))));
    tabBar.append(h("button", { class: "br-tab-new", title: "Nova guia", html: ui("plus", 14), onclick: () => newTab() }));
    win.setTitle((cur?.title || "Navegador") + " — Navegador");
  }
  function showNotice() {
    if (!cur) return;
    const offline = shell.settings.network?.offline || !navigator.onLine;
    notice.classList.toggle("hidden", cur.url === "about:home" && !offline);
    notice.innerHTML = offline ? `${ui("wifiOff", 14)} <span>Sem internet ${shell.settings.network?.offline ? "(modo avião do PC ativado)" : ""}.</span>`
      : `${ui("info", 14)} <span>Alguns sites bloqueiam exibição dentro de apps (X-Frame-Options). Se a página ficar em branco, use “Abrir no navegador do celular”.</span>`;
  }
  function load(url, push = true) {
    const t = cur;
    if (url !== "about:home" && (shell.settings.network?.offline || !navigator.onLine) && !url.startsWith("blob:")) { showNotice(); return; }
    t.url = url;
    if (push) { t.hist = t.hist.slice(0, t.hi + 1); t.hist.push(url); t.hi = t.hist.length - 1; }
    if (url === "about:home") { t.title = "Nova guia"; renderHome(t); }
    else { t.title = url.replace(/^https?:\/\//, "").split("/")[0]; t.frame.src = url; }
    select(t);
  }
  function step(d) {
    const t = cur;
    if (!t) return;
    const n = t.hi + d;
    if (n < 0 || n >= t.hist.length) return;
    t.hi = n;
    load(t.hist[n], false);
  }
  function renderHome(t) {
    const q = h("input", { class: "input br-home-q", placeholder: "Pesquisar na web", onkeydown: (e) => e.key === "Enter" && load(toUrl(e.target.value)) });
    t.home.innerHTML = "";
    t.home.append(
      h("div", { class: "br-home-logo", html: ui("globe", 54, 1.2) }),
      h("h2", {}, "Navegador do VirtualOS"),
      q,
      h("div", { class: "br-marks" }, BOOKMARKS.map(([n, u]) => h("button", { class: "br-mark", onclick: () => load(u) }, h("span", { html: ui("star", 16) }), h("b", {}, n), h("small", { class: "faint" }, esc(u.replace(/^https:\/\//, "").split("/")[0]))))),
      h("p", { class: "faint small" }, "Para instalar jogos/programas: baixe o arquivo (.zip, .html, .iso, .img) e abra-o pelo Explorador ou pela Central de Apps."));
  }

  if (args.file) {
    const blob = await shell.vfs.read(args.file);
    newTab(URL.createObjectURL(blob));
  } else newTab(args.url || "about:home");
  return { onArgs: (a) => a.url && newTab(a.url) };
}
