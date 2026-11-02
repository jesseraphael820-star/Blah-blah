// Download manager: real HTTP downloads (fetch + streaming progress) saved into
// the PC's file system. Servers must allow cross-origin requests (CORS);
// otherwise the user is told and can import the file from the phone instead.

import { h, fmtBytes, uid, pickFiles } from "../core/util.js";
import { join, basename } from "../core/vfs.js";
import { bus } from "../core/bus.js";
import { ui, appIcon } from "../ui/icons.js";
import { iconForFile } from "../ui/desktop.js";

const managers = new WeakMap();

export function downloadManager(shell) {
  if (managers.has(shell)) return managers.get(shell);
  const jobs = [];
  const m = {
    jobs,
    start(url, path, dir = "/Downloads") {
      const job = { id: uid("d"), url, path, status: "baixando", received: 0, total: 0, speed: 0, started: Date.now(), ctrl: new AbortController() };
      jobs.unshift(job);
      job.done = (async () => {
        try {
          if (shell.settings.network?.offline) throw new Error("Modo avião ativado");
          if (!navigator.onLine) throw new Error("Sem conexão com a internet");
          const res = await fetch(url, { signal: job.ctrl.signal, mode: "cors" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          job.total = +res.headers.get("content-length") || 0;
          if (job.total) await shell.vfs.ensureSpace(job.total);
          let name = path ? basename(path) : decodeURIComponent(new URL(url, location.href).pathname.split("/").pop() || "") || "download";
          const cd = res.headers.get("content-disposition")?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
          if (cd && !path) name = decodeURIComponent(cd[1]);
          const reader = res.body.getReader();
          const chunks = [];
          let lastT = performance.now(), lastB = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            job.received += value.length;
            const now = performance.now();
            if (now - lastT > 400) { job.speed = ((job.received - lastB) * 1000) / (now - lastT); lastT = now; lastB = job.received; bus.emit("downloads"); }
          }
          const blob = new Blob(chunks, { type: res.headers.get("content-type") || "" });
          const target = path || join(dir, await shell.vfs.uniqueName(dir, name));
          await shell.vfs.write(target, blob);
          Object.assign(job, { status: "concluído", path: target, size: blob.size });
          shell.notify("Download concluído", `${basename(target)} (${fmtBytes(blob.size)})`, { icon: "downloads" });
          return { ok: true, path: target, size: blob.size };
        } catch (e) {
          const msg = e.name === "AbortError" ? "Cancelado" : e instanceof TypeError ? "O servidor bloqueou o download direto (CORS) ou está offline. Baixe pelo navegador do celular e use \"Importar do celular\"." : e.message;
          Object.assign(job, { status: e.name === "AbortError" ? "cancelado" : "erro", error: msg });
          if (e.name !== "AbortError") shell.notify("Falha no download", msg, { icon: "downloads", level: "bad" });
          return { ok: false, error: msg };
        } finally { bus.emit("downloads"); }
      })();
      bus.emit("downloads");
      return job;
    },
  };
  managers.set(shell, m);
  return m;
}

export default async function downloads({ win, shell, args }) {
  const dm = downloadManager(shell);
  const url = h("input", { class: "input grow", placeholder: "https://exemplo.com/arquivo.zip", value: args.url || "" });
  const listEl = h("div", { class: "dl-list" });
  const go = () => { if (url.value.trim()) { dm.start(url.value.trim()); url.value = ""; } };
  url.addEventListener("keydown", (e) => e.key === "Enter" && go());
  win.body.append(h("div", { class: "dl" },
    h("div", { class: "dl-top" }, url, h("button", { class: "btn primary", onclick: go }, h("span", { html: ui("download", 14) }), "Baixar"),
      h("button", { class: "btn", title: "Copiar arquivos do armazenamento do celular", onclick: async () => shell.importFiles(await pickFiles(), "/Downloads") }, h("span", { html: ui("upload", 14) }), "Do celular")),
    h("div", { class: "faint small dl-hint" }, "Downloads reais via internet, salvos em /Downloads. Alguns sites bloqueiam download direto (CORS) — nesse caso use \"Do celular\"."),
    listEl));

  function render() {
    listEl.innerHTML = "";
    if (!dm.jobs.length) listEl.append(h("div", { class: "faint dl-empty" }, "Nenhum download nesta sessão."));
    for (const j of dm.jobs) {
      const pct = j.total ? (j.received / j.total) * 100 : j.status === "concluído" ? 100 : 0;
      const name = j.path ? basename(j.path) : j.url.split("/").pop() || j.url;
      listEl.append(h("div", { class: "dl-item " + j.status },
        h("span", { html: appIcon(iconForFile({ name, type: "file" }), 32) }),
        h("div", { class: "grow" },
          h("b", {}, name),
          h("div", { class: "bar" + (j.status === "erro" ? " bad" : "") }, h("i", { style: { width: (j.status === "baixando" && !j.total ? 30 : pct) + "%" } })),
          h("small", { class: "faint" }, j.status === "baixando" ? `${fmtBytes(j.received)}${j.total ? " de " + fmtBytes(j.total) : ""} · ${fmtBytes(j.speed)}/s` : j.status === "concluído" ? `${fmtBytes(j.size)} · ${j.path}` : j.error || j.status)),
        j.status === "baixando" ? h("button", { class: "btn small", onclick: () => j.ctrl.abort() }, "Cancelar")
          : j.status === "concluído" ? h("button", { class: "btn small", onclick: () => shell.openFile(j.path) }, "Abrir")
          : h("button", { class: "btn small", onclick: () => { dm.jobs.splice(dm.jobs.indexOf(j), 1); dm.start(j.url, j.path); } }, "Tentar de novo")));
    }
  }
  const off = bus.on("downloads", render);
  render();
  if (args.url) go();
  return { destroy: off, onArgs: (a) => { if (a.url) { url.value = a.url; go(); } } };
}
