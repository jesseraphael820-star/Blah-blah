// Área de Trabalho Remota: a real VNC (RFB) client (noVNC) over WebSocket.
// Lets the phone display and control a real Windows/Linux/macOS PC, which is
// the honest way to use Windows programs and PC games from Android.

import { h, promptBox } from "../core/util.js";
import { ui, appIcon } from "../ui/icons.js";

export default async function remote({ win, shell, args }) {
  const { default: RFB } = await import("../../vendor/novnc/core/rfb.js");
  const { default: keysyms } = await import("../../vendor/novnc/core/input/keysymdef.js");
  const KU = await import("../../vendor/novnc/core/input/util.js");
  let rfb = null, connected = false;
  const cfg = shell.settings.remote || {};
  const url = h("input", { class: "input", placeholder: "wss://meu-pc.exemplo.com:6080/websockify", value: args.url || cfg.url || "" });
  const pass = h("input", { class: "input", type: "password", placeholder: "Senha VNC (se houver)" });
  const viewOnly = h("input", { type: "checkbox", checked: !!cfg.viewOnly });
  const quality = h("select", { class: "input" }, [["9", "Máxima"], ["6", "Alta"], ["3", "Média (rede lenta)"], ["0", "Baixa"]].map(([v, l]) => h("option", { value: v, selected: v === "6" }, l)));
  const err = h("div", { class: "rd-err hidden" });
  const form = h("div", { class: "rd-form" },
    h("div", { class: "rd-head" }, h("span", { html: appIcon("remote", 54) }), h("div", {}, h("h2", {}, "Área de Trabalho Remota"), h("p", { class: "muted" }, "Controle um PC real pela rede. O PC executa os programas e jogos Windows; o celular mostra a tela e envia mouse e teclado."))),
    h("div", { class: "field" }, h("label", {}, "Endereço WebSocket do servidor VNC"), url),
    h("div", { class: "field" }, h("label", {}, "Senha"), pass),
    h("div", { class: "row wrap" }, h("label", { class: "row" }, viewOnly, "Somente visualizar"), h("span", { class: "spacer" }), h("label", { class: "row" }, "Qualidade", quality)),
    err,
    h("button", { class: "btn primary big", onclick: connect }, h("span", { html: ui("link", 16) }), "Conectar"),
    h("details", { class: "rd-help" }, h("summary", {}, "Como preparar o PC (Windows/Linux)"),
      h("ol", {},
        h("li", {}, "Instale um servidor VNC no PC (Windows: TightVNC ou UltraVNC; Linux: TigerVNC ou x11vnc) e defina uma senha."),
        h("li", {}, "Instale o websockify (Python: pip install websockify) e rode: websockify 6080 localhost:5900"),
        h("li", {}, "Na mesma rede Wi-Fi use ws://IP-DO-PC:6080. Pela internet, use uma VPN (ex.: Tailscale) ou um proxy com HTTPS (wss://)."),
        h("li", {}, "Para jogos, prefira rede 5 GHz e qualidade Média ou Alta.")),
      h("p", { class: "faint small" }, "Esta é uma conexão real com o PC; nada é simulado. Latência e qualidade dependem da sua rede.")));
  const screen = h("div", { class: "rd-screen hidden", tabindex: 0 });
  const bar = h("div", { class: "rd-bar hidden" },
    h("span", { class: "rd-name" }, "—"),
    h("span", { class: "spacer" }),
    h("button", { class: "btn small", onclick: () => rfb?.sendCtrlAltDel() }, "Ctrl+Alt+Del"),
    h("button", { class: "btn small", onclick: () => sendCombo(["Meta"]) }, "Win"),
    h("button", { class: "btn small", onclick: () => sendCombo(["Alt", "Tab"]) }, "Alt+Tab"),
    h("button", { class: "btn small", onclick: () => shell.input.toggleKeyboard(true) }, h("span", { html: ui("keyboard", 14) }), "Teclado"),
    h("button", { class: "btn small", onclick: () => { win.maximize(true); document.documentElement.requestFullscreen?.().catch(() => {}); } }, h("span", { html: ui("fullscreen", 14) })),
    h("button", { class: "btn small danger", onclick: () => rfb?.disconnect() }, "Desconectar"));
  win.body.append(h("div", { class: "rd" }, form, bar, screen));

  function connect() {
    let u = url.value.trim();
    err.classList.add("hidden");
    if (!/^wss?:\/\//.test(u)) { show("Use um endereço ws:// ou wss://"); return; }
    if (location.protocol === "https:" && u.startsWith("ws://") && !window.Capacitor) { show("Esta página está em HTTPS: navegadores bloqueiam ws:// sem criptografia. Use wss:// ou o app Android (APK)."); }
    shell.setSetting("remote.url", u);
    shell.setSetting("remote.viewOnly", viewOnly.checked);
    try {
      rfb = new RFB(screen, u, { credentials: { password: pass.value } });
    } catch (e) { show(e.message); return; }
    rfb.scaleViewport = true;
    rfb.resizeSession = false;
    rfb.viewOnly = viewOnly.checked;
    rfb.qualityLevel = +quality.value;
    rfb.compressionLevel = 2;
    rfb.addEventListener("connect", () => { connected = true; form.classList.add("hidden"); screen.classList.remove("hidden"); bar.classList.remove("hidden"); rfb.focus(); shell.notify("PC remoto conectado", u, { icon: "remote" }); });
    rfb.addEventListener("disconnect", (e) => { connected = false; screen.classList.add("hidden"); bar.classList.add("hidden"); form.classList.remove("hidden"); screen.innerHTML = ""; if (!e.detail.clean) show("Conexão perdida ou recusada. Verifique o endereço, o websockify e o firewall do PC."); rfb = null; });
    rfb.addEventListener("credentialsrequired", async () => { const p = pass.value || (await promptBox(win.body, "Senha do VNC", "")); rfb.sendCredentials({ password: p || "" }); });
    rfb.addEventListener("desktopname", (e) => { bar.querySelector(".rd-name").textContent = e.detail.name; win.setTitle(e.detail.name + " — Área de Trabalho Remota"); });
    rfb.addEventListener("securityfailure", (e) => show("Falha de segurança: " + (e.detail.reason || "senha incorreta")));
  }
  function show(t) { err.textContent = t; err.classList.remove("hidden"); }

  const sym = (key, code) => KU.getKeysym({ key, code, location: 0 }) || keysyms.lookup?.(key.charCodeAt(0)) || 0;
  function sendCombo(keys) {
    if (!rfb) return;
    const codes = keys.map((k) => ({ Control: ["Control", "ControlLeft"], Alt: ["Alt", "AltLeft"], Shift: ["Shift", "ShiftLeft"], Meta: ["Meta", "MetaLeft"] }[k] || [k, k.length === 1 ? "Key" + k.toUpperCase() : k]));
    codes.forEach(([k, c]) => rfb.sendKey(sym(k, c), c, true));
    [...codes].reverse().forEach(([k, c]) => rfb.sendKey(sym(k, c), c, false));
  }

  return {
    grabsKeyboard: () => connected,
    virtualKey: (code, down, key) => { if (!connected || !rfb) return false; rfb.sendKey(sym(key, code), code, down); return true; },
    virtualCombo: (keys) => { if (!connected) return false; if (keys.includes("Delete") && keys.includes("Alt")) rfb.sendCtrlAltDel(); else sendCombo(keys); return true; },
    destroy() { rfb?.disconnect(); },
  };
}
