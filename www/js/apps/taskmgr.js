// Task Manager: processes (end task), live performance graphs (FPS, main
// thread CPU load, virtual RAM, real JS heap, storage, x86 VM speed) and the
// real device details.

import { h, fmtBytes } from "../core/util.js";
import { metrics } from "../core/metrics.js";
import { cpuOf, device, vmMemoryMB } from "../core/pcs.js";
import { OS_BASE_MB } from "./registry.js";
import { ui, appIcon } from "../ui/icons.js";

export default async function taskmgr({ win, shell }) {
  let tab = "procs";
  const tabs = h("div", { class: "tm-tabs" });
  const body = h("div", { class: "tm-body" });
  win.body.append(h("div", { class: "tm" }, tabs, body));
  const hist = { ram: [], vm: [] };
  let storage = { bytes: 0 };

  const drawTabs = () => {
    tabs.innerHTML = "";
    [["procs", "Processos", "apps"], ["perf", "Desempenho", "zap"], ["details", "Dispositivo", "info"]].forEach(([id, n, i]) =>
      tabs.append(h("button", { class: "tm-tab" + (tab === id ? " on" : ""), onclick: () => { tab = id; drawTabs(); render(true); } }, h("span", { html: ui(i, 15) }), n)));
  };

  function spark(values, max, color) {
    const c = h("canvas", { class: "tm-spark", width: 600, height: 120 });
    const ctx = c.getContext("2d");
    const W = 600, H = 120;
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, (H * i) / 4); ctx.lineTo(W, (H * i) / 4); ctx.stroke(); }
    if (values.length > 1) {
      const pts = values.map((v, i) => [(i / 59) * W, H - Math.min(1, v / (max || 1)) * (H - 4) - 2]);
      const off = W - pts[pts.length - 1][0];
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + off, y) : ctx.moveTo(x + off, y)));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.lineTo(W, H); ctx.lineTo(pts[0][0] + off, H); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, color + "55"); g.addColorStop(1, color + "00");
      ctx.fillStyle = g; ctx.fill();
    }
    return c;
  }

  let selected = "fps";
  function render(force) {
    const used = Math.round(shell.ramUsedMB()), total = shell.ramTotalMB();
    hist.ram.push(used); if (hist.ram.length > 60) hist.ram.shift();
    const vm = [...shell.procs.values()].find((p) => p.inst?.mips);
    hist.vm.push(vm ? vm.inst.mips() : 0); if (hist.vm.length > 60) hist.vm.shift();
    if (tab === "procs") {
      const scrollTop = body.querySelector(".tm-table-wrap")?.scrollTop || 0;
      body.innerHTML = "";
      const rows = [{ pid: 1, name: "VirtualOS (sistema)", appId: "settings", mem: OS_BASE_MB, sys: true }, ...[...shell.procs.values()].map((p) => ({ ...p, mem: p.mem + (p.inst?.extraMem?.() || 0) }))];
      body.append(
        h("div", { class: "tm-summary" },
          h("div", {}, h("small", { class: "faint" }, "CPU (thread principal, real)"), h("b", {}, metrics.cpu + "%")),
          h("div", {}, h("small", { class: "faint" }, "RAM virtual (simulada)"), h("b", {}, `${used} / ${total} MB`), h("div", { class: "bar" + (used / total > 0.9 ? " bad" : used / total > 0.75 ? " warn" : "") }, h("i", { style: { width: (used / total) * 100 + "%" } }))),
          h("div", {}, h("small", { class: "faint" }, "FPS (real)"), h("b", {}, metrics.fps))),
        h("div", { class: "tm-table-wrap" }, h("table", { class: "tm-table" },
          h("thead", {}, h("tr", {}, h("th", {}, "Nome"), h("th", {}, "PID"), h("th", {}, "Memória"), h("th", {}, "Iniciado"), h("th", {}))),
          h("tbody", {}, rows.map((p) => h("tr", {},
            h("td", {}, h("span", { class: "row" }, h("span", { html: appIcon(p.win?.iconId || p.appId, 18) }), p.win?.title || p.name)),
            h("td", { class: "faint" }, p.pid),
            h("td", {}, `${Math.round(p.mem)} MB`, p.inst?.extraMem?.() ? h("span", { class: "tag real", title: "RAM real alocada pela VM" }, "real") : null),
            h("td", { class: "faint" }, p.started ? new Date(p.started).toLocaleTimeString("pt-BR") : "boot"),
            h("td", {}, p.sys ? null : h("button", { class: "btn small danger", onclick: () => { shell.kill(p.pid); setTimeout(() => render(true), 250); } }, "Finalizar tarefa"))))))));
      body.querySelector(".tm-table-wrap").scrollTop = scrollTop;
    } else if (tab === "perf") {
      const heap = metrics.heap();
      const cap = shell.vfs.capacity();
      const items = {
        fps: { name: "FPS", val: `${metrics.fps}`, sub: "quadros por segundo (real)", data: metrics.history.fps, max: 60, color: "#2fd08a" },
        cpu: { name: "CPU", val: `${metrics.cpu}%`, sub: `${cpuOf(shell.pc).model} · carga real da thread`, data: metrics.history.cpu, max: 100, color: "#4c8dff" },
        ram: { name: "Memória", val: `${used} MB`, sub: `de ${total} MB virtuais`, data: hist.ram, max: total, color: "#b48cff" },
        heap: { name: "Heap JS", val: heap ? fmtBytes(heap.used, 0) : "n/d", sub: heap ? `limite ${fmtBytes(heap.limit, 0)} (real)` : "indisponível neste navegador", data: metrics.history.heap, max: heap?.limit || 1, color: "#ffb547" },
        disk: { name: "Disco", val: fmtBytes(storage.bytes), sub: `de ${fmtBytes(cap, 0)} (real)`, data: [], max: cap, color: "#00b8d9" },
        vm: { name: "VM x86", val: vm ? `${vm.inst.mips()} MIPS` : "parada", sub: "instruções x86 reais/s", data: hist.vm, max: Math.max(10, ...hist.vm), color: "#59f0c8" },
      };
      if (!items[selected]) selected = "fps";
      const it = items[selected];
      body.innerHTML = "";
      body.append(h("div", { class: "tm-perf" },
        h("div", { class: "tm-side" }, Object.entries(items).map(([k, v]) => h("button", { class: "tm-side-item" + (k === selected ? " on" : ""), onclick: () => { selected = k; render(true); } }, h("b", {}, v.name), h("small", {}, v.val), h("i", { style: { background: v.color } })))),
        h("div", { class: "tm-detail" },
          h("div", { class: "row" }, h("h3", {}, it.name), h("span", { class: "spacer" }), h("span", { class: "faint" }, it.sub)),
          selected === "disk" ? h("div", { class: "tm-disk" }, h("div", { class: "bar big" }, h("i", { style: { width: Math.max(1, (storage.bytes / cap) * 100) + "%" } })), h("p", { class: "faint" }, `${fmtBytes(storage.bytes)} em ${storage.files || 0} arquivos e ${storage.dirs || 0} pastas`)) : spark(it.data, it.max, it.color),
          h("div", { class: "tm-big" }, it.val),
          h("div", { class: "tm-grid" },
            kv("Temperatura", metrics.temperature() != null ? metrics.temperature() + " °C" : "indisponível (web)"),
            kv("Bateria", metrics.battery ? `${Math.round(metrics.battery.level * 100)}%${metrics.battery.charging ? " ⚡" : ""}` : "indisponível"),
            kv("Processos", String(shell.procs.size + 1)),
            kv("Tempo ligado", uptime()),
            kv("Resolução", `${shell.logical.w}×${shell.logical.h}`),
            kv("RAM real p/ VM", `${vmMemoryMB(shell.pc)} MB`),
            kv("RAM do aparelho", metrics.realMemory() ? `${fmtBytes(metrics.realMemory().avail)} livres de ${fmtBytes(metrics.realMemory().total)}` : device().memGB ? `≈ ${device().memGB} GB` : "n/d")))));
    } else if (force) {
      const d = device();
      body.innerHTML = "";
      body.append(h("div", { class: "tm-dev" },
        kv("Núcleos de CPU reais", String(d.cores)), kv("RAM do aparelho", d.memGB ? `≈ ${d.memGB} GB` : "não informado"), kv("GPU", d.gpu), kv("Tamanho máx. de textura", d.maxTex ? d.maxTex + " px" : "—"),
        kv("WebGL", d.webgl ? "v" + d.webgl : "não"), kv("WebAssembly", d.wasm ? "sim" : "não"), kv("Tela", d.screen), kv("Toque", d.touch ? "sim" : "não"), kv("Navegador", d.ua)));
    }
  }
  const kv = (k, v) => h("div", { class: "tm-kv" }, h("small", { class: "faint" }, k), h("b", {}, v));
  const uptime = () => { const s = Math.max(0, Math.floor((Date.now() - (shell.pc.lastBoot || Date.now())) / 1000)); return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`; };

  drawTabs();
  storage = await shell.vfs.usage();
  render(true);
  const off = metrics.on("tick", () => render());
  const st = setInterval(async () => { storage = await shell.vfs.usage(); }, 5000);
  return { destroy() { off(); clearInterval(st); } };
}
