// End-to-end test of the real app in Chromium (Playwright): creates a PC,
// boots it, drives the virtual mouse/keyboard, file system, apps, installs a
// game, boots real x86 code in the VM, and suspends/resumes.
// Usage: node tests/e2e.test.mjs   (starts its own server)
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.SHOTS || path.join(ROOT, "tests", "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8099;
const server = spawn(process.execPath, [path.join(ROOT, "scripts/serve.mjs"), String(PORT)], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(600);

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? "  ✔ " : "  ✘ ") + msg); if (!cond) failures++; };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/favicon|ERR_|net::/.test(m.text()) && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + ".png") });
  const ev = (fn, arg) => page.evaluate(fn, arg);

  console.log("Launcher e criação de PC");
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector(".launcher");
  await page.click("text=Criar novo PC");
  await page.click(".type-card >> text=PC gamer");
  await page.click(".chip >> text=8 GB");
  await page.click("text=Avançar");
  await page.fill(".wz-body input.input", "PC de Teste");
  await page.click("text=Avançar");
  await page.waitForSelector(".sum-table");
  ok(await page.isVisible("text=Simulado") && await page.isVisible("text=Real"), "resumo mostra o que é simulado e o que é real");
  await shot("01-resumo");
  await page.click("text=Criar PC");
  await page.waitForSelector(".pc-card");
  ok((await page.textContent(".pc-card")).includes("8 GB RAM"), "PC criado com 8 GB de RAM");
  await shot("02-lista");

  console.log("Inicialização");
  await page.click(".power-btn");
  await page.waitForSelector(".post");
  ok((await page.textContent(".post")).includes("VirtualBIOS"), "tela de POST exibida");
  await page.waitForSelector(".taskbar", { timeout: 20000 });
  await wait(800);
  await shot("03-desktop");
  ok(await page.isVisible(".dicon >> text=Este PC"), "ícones da área de trabalho");

  console.log("Mouse virtual (analógico + botões)");
  const before = await ev(() => ({ x: __vpc.shell.input.x, y: __vpc.shell.input.y }));
  const joy = await page.locator(".joy").boundingBox();
  await page.mouse.move(joy.x + joy.width / 2, joy.y + joy.height / 2);
  await page.mouse.down();
  await page.mouse.move(joy.x + joy.width, joy.y + joy.height / 2, { steps: 4 });
  await wait(500);
  await page.mouse.up();
  const after = await ev(() => ({ x: __vpc.shell.input.x, y: __vpc.shell.input.y }));
  ok(after.x > before.x + 30, `cursor andou com o analógico (${Math.round(before.x)} → ${Math.round(after.x)})`);
  // put cursor on the "Este PC" icon and double-click with the virtual 2x button
  const icon = await page.locator(".dicon >> text=Este PC").boundingBox();
  await ev(([x, y]) => { const i = __vpc.shell.input; i.x = x; i.y = y; i.placeCursor(); }, [icon.x + icon.width / 2, icon.y + icon.height / 2]);
  const dbl = await page.locator(".vb-dbl").boundingBox();
  await page.mouse.click(dbl.x + dbl.width / 2, dbl.y + dbl.height / 2);
  await page.waitForSelector('.win[data-app="explorer"]', { timeout: 5000 });
  ok(true, "clique duplo virtual abriu o Explorador");
  // virtual right click on the desktop opens the context menu
  await ev(() => { const i = __vpc.shell.input; i.x = innerWidth * 0.6; i.y = 40; i.placeCursor(); __vpc.shell.wm.minimizeAll(); });
  await wait(300);
  await ev(() => { __vpc.shell.input.press(2); __vpc.shell.input.releaseBtn(2); });
  ok(await page.isVisible(".ctxmenu >> text=Nova pasta"), "clique direito virtual abriu o menu de contexto");
  await shot("04-menu-contexto");
  await ev(() => __vpc.shell.closePopups());

  console.log("Arrastar janela com o mouse virtual (segurar L + analógico)");
  await ev(() => [...__vpc.shell.procs.values()].forEach((p) => p.win.close(true)));
  await ev(() => __vpc.shell.open("calc"));
  await page.waitForSelector('.win[data-app="calc"]');
  await wait(300);
  const w0 = await page.locator('.win[data-app="calc"]').boundingBox();
  await ev(([x, y]) => { const i = __vpc.shell.input; i.x = x; i.y = y; i.placeCursor(); i.press(0); }, [w0.x + 60, w0.y + 12]);
  await ev(() => { const i = __vpc.shell.input; for (let k = 0; k < 10; k++) i.moveBy(-12, 6); i.releaseBtn(0); });
  await wait(300);
  const w1 = await page.locator('.win[data-app="calc"]').boundingBox();
  ok(w1.x < w0.x - 40 && w1.y > w0.y + 20, `janela arrastada com o mouse virtual (${Math.round(w0.x)},${Math.round(w0.y)} → ${Math.round(w1.x)},${Math.round(w1.y)})`);
  await ev(() => { const i = __vpc.shell.input; const b = [...document.querySelectorAll(".calc-k")]; const click = (t) => { const r = b.find((x) => x.textContent === t).getBoundingClientRect(); i.x = r.x + r.width / 2; i.y = r.y + r.height / 2; i.press(0); i.releaseBtn(0); }; ["7", "×", "6", "="].forEach(click); });
  ok((await page.textContent(".calc-res")) === "42", "calculadora operada com cliques virtuais (7×6=42)");

  console.log("Sistema de arquivos");
  await ev(async () => { const v = __vpc.shell.vfs; await v.mkdir("/Documentos/Projetos"); await v.write("/Documentos/Projetos/a.txt", "olá"); await v.copy("/Documentos/Projetos", "/Documentos/Copia"); await v.trash("/Documentos/Copia"); });
  const fsState = await ev(async () => { const v = __vpc.shell.vfs; return { a: await v.readText("/Documentos/Projetos/a.txt"), trash: (await v.list("/Lixeira")).map((f) => f.name), usage: (await v.usage()).bytes }; });
  ok(fsState.a === "olá" && fsState.trash.includes("Copia"), "criar/copiar/lixeira funcionam e persistem");
  await ev(async () => { await __vpc.shell.vfs.restore("/Lixeira/Copia"); });
  ok(await ev(() => __vpc.shell.vfs.exists("/Documentos/Copia")), "restaurar da Lixeira");

  console.log("Teclado virtual no Bloco de Notas");
  await ev(() => __vpc.shell.open("editor", { path: "/Documentos/Projetos/a.txt" }));
  await page.waitForSelector(".ed-text");
  await wait(300);
  await ev(() => { const t = document.querySelector(".ed-text"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
  await ev(() => __vpc.shell.input.toggleKeyboard(true));
  for (const k of ["Space", "KeyM", "KeyU", "KeyN", "KeyD", "KeyO"]) {
    const b = page.locator(`.vk[data-code="${k}"]`).first();
    const bb = await b.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down(); await page.mouse.up();
  }
  ok((await page.inputValue(".ed-text")) === "olá mundo", "texto digitado pelo teclado virtual");
  await shot("05-teclado");
  await ev(() => __vpc.shell.input.combo(["Control", "s"]));
  await wait(400);
  ok((await ev(() => __vpc.shell.vfs.readText("/Documentos/Projetos/a.txt"))) === "olá mundo", "Ctrl+S (atalho virtual) salvou o arquivo");
  await ev(() => __vpc.shell.input.toggleKeyboard(false));

  console.log("Terminal");
  await ev(() => __vpc.shell.open("terminal"));
  await page.waitForSelector(".term-in");
  for (const c of ["cd /Documentos/Projetos", "ls -l", "echo teste > b.txt", "cat b.txt", "free", "neofetch"]) { await page.fill(".term-in", c); await page.press(".term-in", "Enter"); await wait(120); }
  const term = await page.textContent(".term-out");
  ok(term.includes("a.txt") && term.includes("teste") && term.includes("RAM virtual"), "comandos do terminal (ls, echo >, cat, free)");
  await shot("06-terminal");

  console.log("Apps do sistema abrem sem erro");
  for (const id of ["settings", "taskmgr", "store", "downloads", "recycle", "calc", "browser", "remote", "viewer", "player"]) {
    await ev((a) => __vpc.shell.open(a), id);
    await wait(500);
  }
  const appErrors = await page.$$eval(".app-error", (e) => e.map((x) => x.textContent));
  ok(appErrors.length === 0, "nenhum app falhou ao abrir " + (appErrors[0] || ""));
  await ev(() => __vpc.shell.open("taskmgr"));
  await wait(1200);
  await shot("07-tarefas");
  await page.click(".tm-tab >> text=Desempenho");
  await wait(1200);
  await shot("08-desempenho");
  ok((await page.textContent(".tm-side")).includes("FPS"), "painel de desempenho com FPS/CPU/RAM");
  await ev(() => [...__vpc.shell.procs.values()].forEach((p) => p.win.close(true)));

  console.log("Limite de RAM virtual");
  const ramBlock = await ev(async () => { const s = __vpc.shell; const opened = []; for (let i = 0; i < 40; i++) { const p = await s.open("browser"); if (!p) break; opened.push(p); } const n = opened.length; opened.forEach((p) => p.win.close(true)); return n; });
  ok(ramBlock > 3 && ramBlock < 40, `RAM virtual de 8 GB limita processos (abriu ${ramBlock} navegadores e bloqueou o próximo)`);

  console.log("Central de Apps e jogos");
  await ev(() => __vpc.shell.open("store"));
  await page.waitForSelector(".store-card");
  await page.locator(".store-card", { hasText: "Pintura" }).locator("button", { hasText: "Instalar" }).click();
  await wait(400);
  ok(await ev(() => __vpc.shell.pc.installed.includes("paint")), "Pintura instalada pela Central de Apps");
  await shot("09-loja");
  await ev(() => __vpc.shell.open("astro"));
  await page.waitForSelector(".game-canvas");
  await wait(600);
  await ev(() => { __vpc.shell.input.key("Space", " ", true); __vpc.shell.input.key("Space", " ", false); });
  await wait(1500);
  await shot("10-jogo");
  const lit = await page.evaluate(() => { const c = document.querySelector(".game-canvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 120) n++; return n; });
  ok(lit > 50, "jogo renderizando no canvas");
  const mode = await ev(() => __vpc.shell.input.mode);
  ok(mode === "keys", "analógico muda para setas quando um jogo está em foco");

  console.log("Instalar app web (.html) do celular");
  const html = "<!doctype html><title>Meu Jogo Web</title><button id=b onclick=\"this.textContent='clicado'\">clique</button>";
  await ev(async (h) => { await __vpc.shell.vfs.write("/Downloads/meujogo.html", h, { mime: "text/html" }); }, html);
  const analysis = await ev(async () => { const { analyze } = await import("./js/core/compat.js"); const exe = new Uint8Array(512); exe[0] = 0x4d; exe[1] = 0x5a; exe[0x3c] = 0x80; const pe = new Uint8Array(0x400); pe.set(exe); pe.set([0x50, 0x45, 0, 0, 0x64, 0x86], 0x80); pe[0x80 + 24] = 0x0b; pe[0x80 + 25] = 0x02; pe[0x80 + 92] = 2; const r1 = await analyze(new Blob([pe, new Uint8Array(4096)]), "jogo.exe"); const r2 = await analyze(new Blob([await __vpc.shell.vfs.read("/Downloads/meujogo.html")]), "meujogo.html"); return [r1.type, r1.runnable, r1.label, r2.type, r2.runnable]; });
  ok(analysis[0] === "windows" && analysis[1] === false && analysis[2].includes("x64"), "analisador reconhece .exe Windows x64 e informa que não roda nativamente");
  ok(analysis[3] === "html" && analysis[4], "analisador reconhece app HTML como compatível");

  console.log("Instalar jogo web multi-arquivo (.zip) e clicar nele com o mouse virtual");
  await ev(async () => {
    const enc = new TextEncoder();
    const files = { "meu-jogo/index.html": '<!doctype html><title>Jogo ZIP</title><button id="b" style="position:fixed;inset:0;width:100%;height:100%;font-size:40px">0</button><script src="js/app.js"></script>', "meu-jogo/js/app.js": 'let n=0;document.getElementById("b").addEventListener("click",()=>{n++;document.getElementById("b").textContent=String(n)});' };
    const parts = [], central = []; let off = 0;
    for (const [name, text] of Object.entries(files)) {
      const nb = enc.encode(name), data = enc.encode(text);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(8, 0, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
      parts.push(new Uint8Array(lh.buffer), nb, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(10, 0, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + data.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, 2, true); end.setUint16(10, 2, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    await __vpc.shell.vfs.write("/Downloads/meu-jogo.zip", new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" }));
    if (!navigator.serviceWorker.controller) await new Promise((r) => { navigator.serviceWorker.addEventListener("controllerchange", r); setTimeout(r, 5000); });
  });
  await ev(() => __vpc.shell.openFile("/Downloads/meu-jogo.zip"));
  await page.locator("button", { hasText: "Instalar app web" }).dispatchEvent("click");
  await page.locator(".modal button", { hasText: "Instalar" }).click();
  await page.waitForSelector(".wa-frame", { timeout: 10000 });
  const frame = page.frameLocator(".wa-frame");
  await frame.locator("#b").waitFor({ timeout: 10000 });
  await wait(500);
  const fb = await page.locator(".wa-frame").boundingBox();
  await ev(([x, y]) => { const i = __vpc.shell.input; i.x = x; i.y = y; i.placeCursor(); i.press(0); i.releaseBtn(0); i.press(0); i.releaseBtn(0); }, [fb.x + fb.width / 2, fb.y + fb.height / 2]);
  ok((await frame.locator("#b").textContent()) === "2", "jogo .zip instalado (assets via service worker) e recebeu cliques do mouse virtual");
  await shot("10b-webapp");
  ok(await ev(() => __vpc.shell.vfs.exists("/Programas/meu-jogo/js/app.js")), "arquivos do pacote extraídos em /Programas");

  console.log("Máquina Virtual x86 (código x86 real)");
  await ev(() => [...__vpc.shell.procs.values()].forEach((p) => p.win.close(true)));
  await ev(() => __vpc.shell.open("x86", { image: "builtin:vpcboot" }));
  await page.waitForFunction(() => document.querySelector(".vm-text")?.textContent.includes("VPC>"), null, { timeout: 30000 });
  await ev(() => { const i = __vpc.shell.input; for (const c of ["KeyM", "KeyE", "KeyM", "Enter"]) { i.key(c, c, true); i.key(c, c, false); } });
  await page.waitForFunction(() => (document.querySelector(".vm-text")?.textContent.match(/Total memory/g) || []).length >= 2, null, { timeout: 10000 });
  ok(true, "VPC Boot Monitor executou e respondeu ao teclado virtual (comando MEM)");
  await wait(1200);
  await shot("11-vm-boot");

  await ev(() => [...__vpc.shell.procs.values()].forEach((p) => p.win.close(true)));
  await ev(() => __vpc.shell.open("x86", { image: "builtin:linux" }, { state: "max" }));
  await wait(2500);
  const mips = await ev(() => [...__vpc.shell.procs.values()].find((p) => p.inst?.mips)?.inst.mips());
  ok(mips > 0, `VM mede velocidade real durante o boot do Linux: ${mips} MIPS`);
  await page.waitForFunction(() => /vpc@linux/.test(document.querySelector(".vm-text")?.textContent || ""), null, { timeout: 90000 });
  await ev(() => { const i = __vpc.shell.input; const type = (s) => { for (const ch of s) { const code = ch === " " ? "Space" : ch === "-" ? "Minus" : ch === "/" ? "Slash" : ch === "." ? "Period" : /\d/.test(ch) ? "Digit" + ch : "Key" + ch.toUpperCase(); i.key(code, ch, true); i.key(code, ch, false); } i.key("Enter", "Enter", true); i.key("Enter", "Enter", false); }; type("uname -m"); type("ls /mnt/host/"); });
  await page.waitForFunction(() => /i686/.test(document.querySelector(".vm-text")?.textContent || "") && /Documentos/.test(document.querySelector(".vm-text")?.textContent || ""), null, { timeout: 20000 }).then(() => ok(true, "Linux i686 real: shell responde e vê os arquivos do PC (9p)"), () => ok(false, "Linux respondeu ao teclado"));
  await wait(500);
  await shot("12-linux");

  console.log("Suspender e retomar");
  await ev(() => [...__vpc.shell.procs.values()].forEach((p) => p.win.close(true)));
  await ev(() => __vpc.shell.open("editor", { path: "/Documentos/Projetos/a.txt" }));
  await wait(400);
  await ev(() => __vpc.shell.power("suspend"));
  await page.waitForSelector(".pc-card", { timeout: 15000 });
  ok((await page.textContent(".pc-card")).includes("Suspenso"), "PC suspenso aparece na lista");
  await page.click(".power-btn");
  await page.waitForSelector('.win[data-app="editor"]', { timeout: 20000 });
  ok(true, "sessão retomada com os programas abertos");

  console.log("Modo retrato e tela");
  await page.setViewportSize({ width: 412, height: 915 });
  await wait(600);
  ok(await ev(() => document.querySelector(".pc-view").classList.contains("docked")), "retrato: controles encaixados abaixo da tela");
  await shot("13-retrato");
  await ev(() => __vpc.shell.setSetting("resolution", "1280x720"));
  await wait(300);
  ok(await ev(() => __vpc.shell.logical.w === 1280 && __vpc.shell.logical.h === 720), "resolução 1280×720 aplicada");
  await ev(() => __vpc.shell.setSetting("resolution", "auto"));

  console.log("Desligar");
  await ev(() => [...__vpc.shell.procs.values()].forEach((p) => p.win.close(true)));
  await ev(() => __vpc.shell.power("shutdown"));
  await page.waitForSelector(".pc-card", { timeout: 15000 });
  ok((await page.textContent(".pc-card")).includes("Desligado"), "PC desligado");

  ok(errors.length === 0, "sem erros de JavaScript" + (errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""));
} catch (e) {
  console.error(e);
  failures++;
  try { await browser.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(OUT, "falha.png") }); } catch {}
} finally {
  await browser.close();
  server.kill();
}
console.log(failures ? `\n${failures} falha(s)` : "\nTodos os testes passaram");
process.exit(failures ? 1 : 0);
