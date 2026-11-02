// Runner for installed/imported web apps and games (HTML5, WebAssembly,
// WebGL). Files are served straight from the PC's file system by the service
// worker (vfs/<pc>/<path>), so multi-file games with relative assets work.

import { h } from "../core/util.js";
import { basename, dirname } from "../core/vfs.js";
import { ui } from "../ui/icons.js";

export default async function webapp({ win, shell, args }) {
  const st = await shell.vfs.stat(args.path);
  if (!st) throw new Error("Arquivo não encontrado: " + args.path);
  const title = st.app?.title || basename(args.path).replace(/\.html?$/, "");
  win.setTitle(title);
  const frame = h("iframe", { class: "wa-frame", allow: "fullscreen; autoplay; gamepad; pointer-lock", sandbox: "allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-modals allow-downloads" });
  const bar = h("div", { class: "wa-bar" },
    h("span", { class: "faint small" }, dirname(args.path)),
    h("span", { class: "spacer" }),
    h("button", { class: "btn small", onclick: () => frame.contentWindow?.location.reload() }, h("span", { html: ui("refresh", 14) }), "Recarregar"),
    h("button", { class: "btn small", onclick: () => frame.requestFullscreen?.() }, h("span", { html: ui("fullscreen", 14) }), "Tela cheia"));
  win.body.append(h("div", { class: "wa" }, bar, frame));

  const swReady = navigator.serviceWorker?.controller;
  if (swReady) {
    frame.src = "vfs/" + encodeURIComponent(shell.pc.id) + args.path.split("/").map(encodeURIComponent).join("/");
  } else {
    // no service worker (first launch / file://): single-file fallback
    const html = await shell.vfs.readText(args.path);
    frame.srcdoc = html;
    shell.notify("Modo de compatibilidade", "O app foi aberto sem o servidor interno; arquivos externos do pacote podem não carregar. Recarregue o Virtual PC para ativá-lo.", { level: "warn", icon: "webapp" });
  }
  frame.addEventListener("load", () => {
    try {
      const d = frame.contentDocument;
      if (d?.title) win.setTitle(d.title);
      // master volume for media elements inside the app
      d?.querySelectorAll("audio, video").forEach((m) => { m.volume = shell.volume(); });
    } catch {}
  });
  return { preferredInput: "mouse", destroy() { frame.src = "about:blank"; } };
}
