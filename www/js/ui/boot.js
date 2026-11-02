// Boot / shutdown sequences. The POST screen reports the virtual hardware and
// the real device it runs on; the loading phase does real work (mounting the
// file system, checking storage, preloading the desktop modules).

import { h, sleep, fmtBytes } from "../core/util.js";
import { cpuOf, gpuOf, osOf, device, vmMemoryMB } from "../core/pcs.js";
import { VFS } from "../core/vfs.js";
import { logo } from "./icons.js";

export async function bootSequence(root, pc, { resuming = false, skipPost = false } = {}) {
  const el = h("div", { class: "boot" });
  root.append(el);
  let skip = skipPost;
  el.addEventListener("pointerdown", () => { skip = true; });
  const wait = (ms) => (skip ? sleep(0) : sleep(ms));

  if (!resuming && !skipPost) {
    const cpu = cpuOf(pc), gpu = gpuOf(pc), d = device();
    const post = h("pre", { class: "post" });
    el.append(post);
    const line = async (t, ms = 90) => { post.textContent += t + "\n"; await wait(ms); };
    await line("VirtualBIOS v2.4  (C) Virtual PC Project", 120);
    await line(`${pc.name} — ${pc.type.toUpperCase()}\n`, 120);
    await line(`CPU: ${cpu.model} @ ${cpu.ghz.toFixed(2)} GHz, ${cpu.cores} núcleos  [simulado]`);
    await line(`     Host: ${d.cores} núcleos reais${d.android ? " · Android" : ""}`);
    const memLine = post.textContent.length;
    const total = pc.ram * 1024 * 1024;
    for (let k = 0; k <= 16; k++) {
      post.textContent = post.textContent.slice(0, memLine) + `Teste de memória: ${Math.round((total * k) / 16).toLocaleString("pt-BR")} KB ${k === 16 ? "OK" : ""}\n`;
      await wait(35);
    }
    await line(`     VM x86: até ${vmMemoryMB(pc)} MB de RAM real reservável`);
    await line(`Disco 0: VDISK ${pc.storage} GB (armazenamento real do aparelho)`);
    await line(`Vídeo: ${gpu.name} ${gpu.vram} GB  [simulado]`);
    await line(`       Render real: ${d.gpu}`);
    await line(`USB/Bluetooth: teclado e mouse físicos detectados automaticamente`);
    let est; try { est = await navigator.storage?.estimate?.(); } catch {}
    await line(`Armazenamento livre no aparelho: ${est?.quota ? fmtBytes(est.quota - est.usage) : "desconhecido"}`, 200);
    await line(`\nIniciando ${osOf(pc).name}...`, 380);
    post.remove();
  }

  const splash = h("div", { class: "splash" },
    h("div", { class: "splash-logo", html: logo(84) }),
    h("div", { class: "splash-name" }, resuming ? "Retomando sessão" : osOf(pc).name),
    h("div", { class: "spinner" }, [0, 1, 2, 3, 4].map(() => h("i"))),
    h("div", { class: "splash-status faint" }, ""));
  el.append(splash);
  const status = splash.querySelector(".splash-status");
  const t0 = performance.now();
  status.textContent = "Montando sistema de arquivos…";
  const vfs = new VFS(pc);
  await vfs.init();
  status.textContent = "Carregando componentes do desktop…";
  await Promise.all([import("./desktop.js"), import("./wm.js"), import("./input.js")]);
  status.textContent = "Preparando sessão do usuário…";
  const minimum = skip ? 150 : resuming ? 900 : 1700;
  await sleep(Math.max(0, minimum - (performance.now() - t0)));

  if (!resuming && !skip) {
    splash.remove();
    const welcome = h("div", { class: "welcome" }, h("div", { class: "avatar" }, pc.name[0]?.toUpperCase() || "U"), h("div", { class: "welcome-t" }, "Bem-vindo(a)"), h("div", { class: "faint" }, pc.name));
    el.append(welcome);
    await sleep(900);
  }
  el.classList.add("out");
  await sleep(250);
  el.remove();
}

export async function shutdownSequence(root, pc, action) {
  const text = { shutdown: "Desligando", restart: "Reiniciando", suspend: "Suspendendo" }[action] || "Desligando";
  const el = h("div", { class: "boot" }, h("div", { class: "splash" }, h("div", { class: "spinner" }, [0, 1, 2, 3, 4].map(() => h("i"))), h("div", { class: "splash-name" }, text + "…")));
  root.innerHTML = "";
  root.append(el);
  await sleep(action === "restart" ? 900 : 1200);
  el.remove();
}
