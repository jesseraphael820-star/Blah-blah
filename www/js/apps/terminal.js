// Terminal: a real command interpreter running over the PC's file system.

import { h, fmtBytes, esc } from "../core/util.js";
import { normPath, basename, dirname, join } from "../core/vfs.js";
import { metrics } from "../core/metrics.js";
import { cpuOf, gpuOf, device, osOf } from "../core/pcs.js";
import { APPS } from "./registry.js";

export default async function terminal({ win, shell, args }) {
  const vfs = shell.vfs;
  let cwd = args.cwd || "/";
  const hist = [];
  let hi = 0;
  const out = h("div", { class: "term-out" });
  const promptEl = h("span", { class: "term-prompt" });
  const input = h("input", { class: "term-in", spellcheck: false, autocapitalize: "off", autocomplete: "off" });
  const box = h("div", { class: "term", onclick: () => input.focus() }, out, h("div", { class: "term-line" }, promptEl, input));
  win.body.append(box);

  const print = (text = "", cls = "") => { out.append(h("div", { class: "tl " + cls, html: text })); box.scrollTop = box.scrollHeight; };
  const println = (t = "", cls) => print(esc(t), cls);
  const setPrompt = () => { promptEl.innerHTML = `<span class="t-g">usuario@${esc(shell.pc.name.replace(/\s+/g, "-").toLowerCase())}</span>:<span class="t-b">${esc(cwd)}</span>$&nbsp;`; win.setTitle("Terminal — " + cwd); };

  const C = {
    help: () => println(`Comandos disponíveis:
  ls [-l] [dir]     cd <dir>          pwd               tree [dir]
  cat <arq>         head/tail <arq>   wc <arq>          grep <txt> <arq>
  echo txt [> arq]  touch <arq>       mkdir <dir>       rm [-r] <item>
  cp <a> <b>        mv <a> <b>        find <nome>       du [dir]
  df                free              ps                kill <pid>
  top               uname [-a]        neofetch          date
  open <arq|app>    apps              wget <url> [arq]  js <expressão>
  calc <expressão>  history           clear             exit
  linux             (abre o Linux x86 real na Máquina Virtual)`),
    pwd: () => println(cwd),
    clear: () => { out.innerHTML = ""; },
    exit: () => win.close(),
    whoami: () => println("usuario"),
    hostname: () => println(shell.pc.name),
    date: () => println(new Date().toString()),
    history: () => hist.forEach((c, i) => println(`${String(i + 1).padStart(4)}  ${c}`)),
    async cd([d = "/"]) { const p = normPath(d, cwd); const st = await vfs.stat(p); if (!st) throw new Error(`cd: ${d}: Arquivo ou diretório inexistente`); if (st.type !== "dir") throw new Error(`cd: ${d}: Não é um diretório`); cwd = p; },
    async ls(a) {
      const long = a.includes("-l") || a.includes("-la");
      const target = normPath(a.find((x) => !x.startsWith("-")) || ".", cwd);
      const st = await vfs.stat(target);
      if (!st) throw new Error(`ls: não foi possível acessar '${target}'`);
      const list = st.type === "dir" ? await vfs.list(target) : [st];
      if (long) for (const f of list) print(`${f.type === "dir" ? "d" : "-"}rw-r--r--  ${String(f.type === "dir" ? "-" : fmtBytes(f.size)).padStart(9)}  ${new Date(f.modified).toLocaleString("pt-BR").padEnd(20)} ${f.type === "dir" ? `<span class="t-b">${esc(f.name)}/</span>` : esc(f.name)}`);
      else print(list.map((f) => (f.type === "dir" ? `<span class="t-b">${esc(f.name)}/</span>` : esc(f.name))).join("&nbsp;&nbsp;&nbsp;") || '<span class="t-dim">(vazio)</span>');
    },
    async tree([d = "."]) {
      const root = normPath(d, cwd);
      const all = await vfs.descendants(root);
      println(root);
      all.sort((a, b) => a.path.localeCompare(b.path)).forEach((f) => { const depth = f.path.slice(root.length).split("/").length - 2; print("&nbsp;&nbsp;".repeat(depth) + "├─ " + (f.type === "dir" ? `<span class="t-b">${esc(f.name)}/</span>` : esc(f.name))); });
    },
    async cat(a) { for (const f of a) println(await vfs.readText(normPath(f, cwd))); },
    async head([f, n = 10]) { println((await vfs.readText(normPath(f, cwd))).split("\n").slice(0, +n).join("\n")); },
    async tail([f, n = 10]) { println((await vfs.readText(normPath(f, cwd))).split("\n").slice(-n).join("\n")); },
    async wc([f]) { const t = await vfs.readText(normPath(f, cwd)); println(`${t.split("\n").length} linhas  ${(t.match(/\S+/g) || []).length} palavras  ${t.length} caracteres  ${f}`); },
    async grep([q, f]) { const t = await vfs.readText(normPath(f, cwd)); t.split("\n").forEach((l, i) => { if (l.toLowerCase().includes(q.toLowerCase())) print(`<span class="t-dim">${i + 1}:</span> ` + esc(l).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<span class="t-y">${m}</span>`)); }); },
    async touch(a) { for (const f of a) { const p = normPath(f, cwd); if (!(await vfs.exists(p))) await vfs.write(p, ""); } },
    async mkdir(a) { for (const f of a.filter((x) => x !== "-p")) await vfs.mkdir(normPath(f, cwd)); },
    async rm(a) {
      const rec = a.some((x) => /^-[rRf]+$/.test(x));
      for (const f of a.filter((x) => !x.startsWith("-"))) {
        const p = normPath(f, cwd), st = await vfs.stat(p);
        if (!st) throw new Error(`rm: não foi possível remover '${f}': não existe`);
        if (st.type === "dir" && !rec) throw new Error(`rm: '${f}' é um diretório (use rm -r)`);
        await vfs.trash(p);
      }
      println("(itens enviados para a Lixeira)", "t-dim");
    },
    rmdir: (a) => C.rm(["-r", ...a]),
    async cp([a, b]) { let d = normPath(b, cwd); const st = await vfs.stat(d); if (st?.type === "dir") d = join(d, basename(a)); await vfs.copy(normPath(a, cwd), d); },
    async mv([a, b]) { let d = normPath(b, cwd); const st = await vfs.stat(d); if (st?.type === "dir") d = join(d, basename(a)); await vfs.move(normPath(a, cwd), d); },
    async find([q = ""]) { (await vfs.all()).filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).forEach((f) => println(f.path)); },
    async du([d = "."]) { const p = normPath(d, cwd); const all = await vfs.descendants(p); println(`${fmtBytes(all.reduce((s, f) => s + (f.size || 0), 0))}\t${p}`); },
    async df() {
      const u = await vfs.usage(); const cap = vfs.capacity();
      let est; try { est = await navigator.storage.estimate(); } catch {}
      println(`Sistema de arq.   Tamanho    Usado      Disp.      Uso%  Montado em
vdisk0 (real)     ${fmtBytes(cap, 0).padEnd(10)} ${fmtBytes(u.bytes).padEnd(10)} ${fmtBytes(cap - u.bytes).padEnd(10)} ${((u.bytes / cap) * 100).toFixed(1).padStart(4)}%  /
${est?.quota ? `armazenamento do aparelho disponível ao app: ${fmtBytes(est.quota - est.usage)} livres de ${fmtBytes(est.quota)}` : ""}`);
    },
    free() {
      const tot = shell.ramTotalMB(), used = Math.round(shell.ramUsedMB()), heap = metrics.heap();
      println(`              total      usado      livre
RAM virtual:  ${String(tot).padEnd(6)} MB  ${String(used).padEnd(6)} MB  ${String(tot - used).padEnd(6)} MB   (simulada)
${heap ? `Heap JS real: ${fmtBytes(heap.total).padEnd(9)}  ${fmtBytes(heap.used).padEnd(9)}  limite ${fmtBytes(heap.limit)}` : "Heap JS real: indisponível neste navegador"}
${device().memGB ? `RAM do aparelho: ≈ ${device().memGB} GB` : ""}`);
    },
    ps() { println("  PID  RAM(MB)  INÍCIO    PROGRAMA"); println("    1     " + String(900).padEnd(6) + "  boot      virtualos-kernel"); for (const p of shell.procs.values()) println(`${String(p.pid).padStart(5)}  ${String(Math.round(p.mem + (p.inst?.extraMem?.() || 0))).padStart(7)}  ${new Date(p.started).toLocaleTimeString("pt-BR").padEnd(8)}  ${p.name}`); },
    top() { println(`FPS ${metrics.fps}  ·  CPU (thread principal) ${metrics.cpu}%  ·  RAM virtual ${Math.round(shell.ramUsedMB())}/${shell.ramTotalMB()} MB`); C.ps(); },
    kill([pid]) { const p = shell.procs.get(+pid); if (!p) throw new Error(`kill: (${pid}) - processo inexistente`); shell.kill(+pid); println(`Processo ${pid} (${p.name}) encerrado.`); },
    uname(a) { println(a.includes("-a") ? `VirtualOS 11.0 ${shell.pc.name} vpc-kernel-1.0 #1 ${cpuOf(shell.pc).model} WebAssembly ${navigator.platform}` : "VirtualOS"); },
    neofetch() {
      const d = device(), c = cpuOf(shell.pc), g = gpuOf(shell.pc);
      print(`<span class="t-b">      ██████  ██████</span>    <b>usuario</b>@<b>${esc(shell.pc.name)}</b>
<span class="t-b">      ██████  ██████</span>    -------------------------
<span class="t-b">      ██████  ██████</span>    <span class="t-b">SO</span>: ${esc(osOf(shell.pc).name)}
<span class="t-b">                    </span>    <span class="t-b">CPU</span>: ${esc(c.model)} (${c.cores}) @ ${c.ghz} GHz <span class="t-dim">[sim]</span>
<span class="t-b">      ██████  ██████</span>    <span class="t-b">Host</span>: ${d.cores} núcleos reais
<span class="t-b">      ██████  ██████</span>    <span class="t-b">GPU</span>: ${esc(g.name)} <span class="t-dim">[sim]</span> / ${esc(d.gpu)}
<span class="t-b">      ██████  ██████</span>    <span class="t-b">RAM</span>: ${Math.round(shell.ramUsedMB())} MB / ${shell.ramTotalMB()} MB
                            <span class="t-b">Disco</span>: ${shell.pc.storage} GB · <span class="t-b">Resolução</span>: ${shell.logical.w}x${shell.logical.h}`);
    },
    apps() { Object.entries(APPS).filter(([id, a]) => !a.hidden && (a.system || shell.pc.installed.includes(id))).forEach(([id, a]) => println(`${id.padEnd(10)} ${a.name}`)); },
    async open([t]) {
      if (!t) throw new Error("uso: open <arquivo|app>");
      if (APPS[t]) return shell.open(t);
      await shell.openFile(normPath(t, cwd));
    },
    linux() { shell.open("x86", { image: "builtin:linux", autostart: true }); println("Iniciando Linux i686 na Máquina Virtual x86…"); },
    async wget([url, name]) {
      if (!url) throw new Error("uso: wget <url> [arquivo]");
      if (shell.settings.network?.offline) throw new Error("wget: modo avião ativado");
      const { downloadManager } = await import("./downloads.js");
      println(`Baixando ${url} …`);
      const job = downloadManager(shell).start(url, name ? normPath(name, cwd) : null, cwd === "/" ? "/Downloads" : cwd);
      const res = await job.done;
      if (res.ok) println(`Salvo: ${res.path} (${fmtBytes(res.size)})`, "t-g"); else throw new Error("wget: " + res.error);
    },
    calc(a) { const e = a.join(" "); if (!/^[\d\s+\-*/().,%^]+$/.test(e)) throw new Error("calc: apenas números e + - * / ( ) % ^"); println(String(Function(`"use strict";return (${e.replace(/\^/g, "**").replace(/,/g, ".")})`)())); },
    js(a) { const r = Function(`"use strict";return (${a.join(" ")})`)(); println(typeof r === "object" ? JSON.stringify(r, null, 2) : String(r)); },
    async echo(a, raw) {
      const m = raw.match(/^echo\s+(.*?)\s*(>>?)\s*(\S+)\s*$/);
      if (m) {
        const p = normPath(m[3], cwd);
        const text = m[1].replace(/^["']|["']$/g, "") + "\n";
        const prev = m[2] === ">>" && (await vfs.exists(p)) ? await vfs.readText(p) : "";
        await vfs.write(p, prev + text, { mime: "text/plain" });
      } else println(a.join(" ").replace(/^["']|["']$/g, ""));
    },
  };
  C.dir = C.ls; C.cls = C.clear; C.type = C.cat; C.del = C.rm; C.curl = C.wget;

  async function run(line) {
    const raw = line.trim();
    print(promptEl.innerHTML + esc(raw));
    if (!raw) return;
    hist.push(raw); hi = hist.length;
    const parts = raw.match(/"[^"]*"|'[^']*'|\S+/g).map((s) => s.replace(/^["']|["']$/g, ""));
    const [cmd, ...a] = parts;
    const fn = C[cmd.toLowerCase()];
    if (!fn) return println(`${cmd}: comando não encontrado. Digite 'help'.`, "t-r");
    try { await fn(a, raw); } catch (e) { println(e.message, "t-r"); }
    setPrompt();
  }

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") { const v = input.value; input.value = ""; await run(v); setPrompt(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); input.value = hi < hist.length - 1 ? hist[++hi] : ((hi = hist.length), ""); }
    else if (e.key === "Tab") {
      e.preventDefault();
      const parts = input.value.split(" ");
      const last = parts.pop();
      const dir = last.includes("/") ? normPath(dirname(last.startsWith("/") ? last : join(cwd, last)) || "/") : cwd;
      const pre = last.includes("/") ? last.slice(last.lastIndexOf("/") + 1) : last;
      const m = (await vfs.list(dir)).filter((f) => f.name.startsWith(pre));
      if (m.length === 1) { parts.push(last.slice(0, last.length - pre.length) + m[0].name + (m[0].type === "dir" ? "/" : "")); input.value = parts.join(" "); }
      else if (m.length > 1) println(m.map((f) => f.name).join("  "));
    } else if (e.key.toLowerCase() === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; }
  });

  println(`VirtualOS Terminal 1.0 — ${shell.pc.name}`, "t-dim");
  println("Digite 'help' para ver os comandos.", "t-dim");
  setPrompt();
  setTimeout(() => input.focus(), 50);
  return { run };
}
