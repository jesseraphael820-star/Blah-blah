// Home screen: list of virtual PCs, creation wizard and hardware editor.

import { h, fmtBytes, confirmBox, alertBox } from "../core/util.js";
import { pcStore, makePC, PRESETS, CPUS, RAMS, STORAGES, GPUS, OSES, RESOLUTIONS, device, vmMemoryMB, cpuOf, gpuOf, osOf } from "../core/pcs.js";
import { VFS } from "../core/vfs.js";
import { db } from "../core/db.js";
import { ui, logo } from "./icons.js";

const icon = (n, s) => h("span", { class: "ico", html: ui(n, s) });

export class Launcher {
  constructor(root, { onPower, flash }) {
    this.root = root;
    this.onPower = onPower;
    this.flash = flash;
    this.el = h("div", { class: "launcher" });
    root.append(this.el);
  }

  async render() {
    const pcs = await pcStore.list();
    const d = device();
    let est = null;
    try { est = await navigator.storage?.estimate?.(); } catch {}
    this.el.innerHTML = "";
    this.el.append(
      h("header", { class: "l-head" },
        h("div", { class: "brand", html: logo(30) + "<div><b>Virtual PC</b><small>Computadores virtuais no seu celular</small></div>" }),
        h("div", { class: "spacer" }),
        h("button", { class: "btn icon", title: "Tela cheia", onclick: toggleFullscreen, html: ui("fullscreen", 16) })),
      this.flash && h("div", { class: "l-flash" }, icon("moon", 16), this.flash),
      h("section", { class: "l-device" },
        h("div", { class: "l-device-title" }, icon("shield", 16), "Hardware real deste celular", h("span", { class: "tag real" }, "REAL")),
        h("div", { class: "l-device-grid" },
          stat("cpu", "Núcleos de CPU", `${d.cores}`),
          stat("memory", "RAM do aparelho", d.memGB ? `≈ ${d.memGB} GB` : "não informado"),
          stat("gpu", "GPU (WebGL " + (d.webgl || "—") + ")", d.gpu),
          stat("disk", "Espaço p/ o app", est?.quota ? `${fmtBytes(est.quota - est.usage)} livres` : "—"))),
      h("div", { class: "l-section-title" }, h("h2", {}, "Meus computadores"), h("div", { class: "spacer" }),
        pcs.length ? h("button", { class: "btn primary", onclick: () => this.wizard() }, icon("plus", 16), "Criar novo PC") : null),
      pcs.length ? h("div", { class: "pc-grid" }, pcs.map((pc) => this.card(pc)))
        : h("div", { class: "l-empty" },
            h("div", { class: "l-empty-art", html: ui("monitor", 64, 1.2) }),
            h("h3", {}, "Nenhum PC ainda"),
            h("p", { class: "muted" }, "Crie seu primeiro computador virtual escolhendo tipo, RAM, armazenamento e sistema."),
            h("button", { class: "btn primary big", onclick: () => this.wizard() }, icon("plus", 18), "Criar novo PC")),
      h("footer", { class: "l-foot faint" }, "Virtual PC 1.0 · Emulação x86 por v86 (WebAssembly) · Dados salvos neste aparelho"));
  }

  card(pc) {
    const cpu = cpuOf(pc), gpu = gpuOf(pc), os = osOf(pc);
    const suspended = pc.state === "suspended";
    return h("article", { class: "pc-card" + (pc.type === "gamer" ? " gamer" : "") },
      h("div", { class: "pc-card-top" },
        h("div", { class: "pc-badge", html: ui(PRESETS[pc.type]?.icon || "pc", 22) }),
        h("div", { class: "grow" },
          h("div", { class: "pc-name" }, pc.name),
          h("div", { class: "faint small" }, `${PRESETS[pc.type]?.label || "PC"} · ${os.name}`)),
        h("span", { class: "tag " + (suspended ? "warn" : "info") }, suspended ? "Suspenso" : "Desligado")),
      h("div", { class: "pc-specs" },
        spec("cpu", cpu.model, `${cpu.cores} núcleos · ${cpu.ghz.toFixed(1).replace(".", ",")} GHz`),
        spec("memory", `${pc.ram} GB RAM`, `VM x86: até ${vmMemoryMB(pc)} MB reais`),
        spec("disk", `${pc.storage} GB`, "armazenamento"),
        spec("gpu", gpu.name, `${gpu.vram} GB VRAM`)),
      h("button", { class: "power-btn", onclick: () => this.onPower(pc) }, h("span", { html: ui("power", 22, 2.2) }), suspended ? "RETOMAR MEU PC" : "LIGAR MEU PC"),
      h("div", { class: "pc-actions" },
        h("button", { class: "btn small", onclick: () => this.wizard(pc) }, icon("sliders", 14), "Configurar"),
        h("button", { class: "btn small", onclick: () => this.duplicate(pc) }, icon("copy", 14), "Duplicar"),
        h("button", { class: "btn small danger", onclick: () => this.remove(pc) }, icon("trash", 14), "Excluir")));
  }

  async duplicate(pc) {
    const copy = { ...makePC(pc.type), ...JSON.parse(JSON.stringify(pc)) };
    copy.id = makePC().id;
    copy.name = pc.name + " (cópia)";
    copy.state = "off"; copy.session = null; copy.created = Date.now();
    await pcStore.save(copy);
    await new VFS(copy).init();
    this.render();
  }

  async remove(pc) {
    if (!(await confirmBox(this.el, "Excluir PC", `"${pc.name}" e todos os arquivos dele serão apagados deste aparelho.`, "Excluir", true))) return;
    await new VFS(pc).wipe();
    await db.del("snapshots", pc.id).catch(() => {});
    await pcStore.remove(pc.id);
    this.render();
  }

  // ---------------- creation / edit wizard ----------------
  wizard(existing) {
    const editing = !!existing;
    const draft = editing ? JSON.parse(JSON.stringify(existing)) : makePC("mid");
    let step = editing ? 1 : 0;
    const steps = ["Tipo", "Hardware", "Sistema", "Resumo"];
    const sheet = h("div", { class: "wizard" });
    const close = () => sheet.remove();
    this.el.append(sheet);

    const applyPreset = (t) => {
      const p = PRESETS[t];
      Object.assign(draft, { type: t, cpu: p.cpu, ram: p.ram, storage: p.storage, gpu: p.gpu });
      if (p.os) draft.os = p.os; else if (draft.os === "vpcos-gamer") draft.os = "vpcos";
      if (!editing) draft.name = p.label.replace("PC", "Meu PC");
    };

    const chips = (values, cur, fmt, onPick, disabled = () => false) =>
      h("div", { class: "chips" }, values.map((v) =>
        h("button", { class: "chip" + (v === cur ? " on" : ""), disabled: disabled(v), onclick: () => { onPick(v); draw(); } }, fmt(v))));

    const note = (kind, text) => h("div", { class: "note" }, h("span", { class: "tag " + kind }, kind === "sim" ? "SIMULADO" : kind === "real" ? "REAL" : "MISTO"), h("span", {}, text));

    const d = device();
    const draw = async () => {
      let body;
      if (step === 0) {
        body = h("div", { class: "type-grid" }, Object.entries(PRESETS).map(([t, p]) =>
          h("button", { class: "type-card" + (draft.type === t ? " on" : ""), onclick: () => { applyPreset(t); step = t === "custom" ? 1 : 1; draw(); } },
            h("div", { class: "type-ico", html: ui(p.icon, 26) }),
            h("b", {}, p.label), h("small", {}, p.desc),
            h("div", { class: "type-specs faint" }, `${p.ram} GB · ${p.storage} GB · ${GPUS.find((g) => g.id === p.gpu).name.replace("VGraphics ", "")}`))));
      } else if (step === 1) {
        body = h("div", { class: "hw" },
          h("div", { class: "hw-block" },
            h("h4", {}, icon("cpu", 16), "Processador virtual"),
            h("div", { class: "cpu-list" }, CPUS.map((c) => h("button", { class: "cpu-opt" + (draft.cpu === c.id ? " on" : ""), onclick: () => { draft.cpu = c.id; draft.type = draft.type === "custom" || editing ? draft.type : "custom"; draw(); } },
              h("b", {}, c.model), h("small", {}, `${c.cores} núcleos · ${c.ghz.toFixed(1).replace(".", ",")} GHz`), h("div", { class: "perf-dots" }, [1, 2, 3, 4].map((i) => h("i", { class: i <= c.tier ? "on" : "" })))))),
            note("sim", `O modelo e o clock são rótulos de desempenho simulado. O processamento real é feito pelos ${d.cores} núcleos do seu celular; a VM x86 mostra a velocidade real medida (MIPS).`)),
          h("div", { class: "hw-block" },
            h("h4", {}, icon("memory", 16), "Memória RAM"),
            chips(RAMS, draft.ram, (v) => `${v} GB`, (v) => { draft.ram = v; }),
            note("mix", `Simulado: é o limite de memória para os programas do desktop (o Gerenciador de Tarefas bloqueia abrir apps além dele). Real: a VM x86 aloca de verdade até ${vmMemoryMB({ ram: draft.ram })} MB da RAM do celular${d.memGB ? ` (aparelho ≈ ${d.memGB} GB)` : ""}.`)),
          h("div", { class: "hw-block" },
            h("h4", {}, icon("disk", 16), "Armazenamento"),
            chips(STORAGES, draft.storage, (v) => `${v} GB`, (v) => { draft.storage = v; }, (v) => editing && v < existing.storage && false),
            note("real", "Real: arquivos, programas e downloads são gravados de verdade no armazenamento do celular. A capacidade escolhida é o limite máximo; só o que você salvar ocupa espaço.")),
          h("div", { class: "hw-block" },
            h("h4", {}, icon("gpu", 16), "Placa de vídeo virtual"),
            chips(GPUS.map((g) => g.id), draft.gpu, (v) => GPUS.find((g) => g.id === v).name.replace("VGraphics ", ""), (v) => { draft.gpu = v; }),
            note("sim", `Nível simulado usado para checar requisitos e qualidade gráfica dos jogos. A renderização real usa a GPU do celular: ${d.gpu}.`)));
      } else if (step === 2) {
        body = h("div", { class: "hw" },
          h("div", { class: "hw-block" },
            h("h4", {}, icon("edit", 16), "Nome do PC"),
            h("input", { class: "input", value: draft.name, maxlength: 40, oninput: (e) => { draft.name = e.target.value; } })),
          h("div", { class: "hw-block" },
            h("h4", {}, icon("monitor", 16), "Sistema operacional"),
            h("div", { class: "os-list" }, OSES.map((o) => h("button", { class: "os-opt" + (draft.os === o.id ? " on" : ""), onclick: () => { draft.os = o.id; draw(); } },
              h("b", {}, o.name), h("small", {}, o.desc), h("span", { class: "tag real" }, o.engine))))),
          h("div", { class: "hw-block" },
            h("h4", {}, icon("fullscreen", 16), "Resolução da tela"),
            chips(RESOLUTIONS, draft.settings.resolution, (v) => (v === "auto" ? "Automática" : v.replace("x", "×")), (v) => { draft.settings.resolution = v; }),
            note("real", "Real: o desktop é renderizado nessa resolução e redimensionado para caber na tela do celular. \"Automática\" usa a resolução nativa da tela.")));
      } else {
        const cpu = cpuOf(draft), gpu = gpuOf(draft), os = osOf(draft);
        let est = null; try { est = await navigator.storage?.estimate?.(); } catch {}
        const row = (k, v, kind, detail) => h("tr", {}, h("td", {}, k), h("td", {}, h("b", {}, v)), h("td", {}, h("span", { class: "tag " + kind }, kind === "sim" ? "Simulado" : kind === "real" ? "Real" : "Misto")), h("td", { class: "muted" }, detail));
        body = h("div", { class: "summary" },
          h("div", { class: "sum-hero" }, h("div", { class: "pc-badge big", html: ui(PRESETS[draft.type]?.icon || "pc", 30) }), h("div", {}, h("h3", {}, draft.name || "Meu PC"), h("div", { class: "muted" }, `${PRESETS[draft.type]?.label} · ${os.name}`))),
          h("div", { class: "table-wrap" }, h("table", { class: "sum-table" },
            h("thead", {}, h("tr", {}, h("th", {}, "Componente"), h("th", {}, "Configuração"), h("th", {}, "Natureza"), h("th", {}, "Como funciona"))),
            h("tbody", {},
              row("Processador", `${cpu.model} (${cpu.cores}c)`, "sim", `Rótulo de desempenho. Execução real nos ${d.cores} núcleos do celular.`),
              row("Memória RAM", `${draft.ram} GB`, "mix", `Limite simulado para apps do desktop; VM x86 aloca até ${vmMemoryMB(draft)} MB reais.`),
              row("Armazenamento", `${draft.storage} GB`, "real", `Gravação real no aparelho (IndexedDB). Disponível agora: ${est?.quota ? fmtBytes(est.quota - est.usage) : "—"}.`),
              row("Placa de vídeo", gpu.name, "sim", `Nível para requisitos. Render real: ${d.gpu}.`),
              row("Sistema", os.name, "real", os.engine + "."),
              row("Resolução", draft.settings.resolution === "auto" ? "Automática" : draft.settings.resolution, "real", "Renderização real do desktop."),
              row("Mouse / teclado", "Virtual + físico", "real", "Analógico e teclado na tela; mouse/teclado Bluetooth ou USB funcionam direto.")))),
          h("div", { class: "note warn-note" }, icon("info", 16), h("span", {}, "Jogos e programas Windows (.exe) não rodam nativamente no Android. Este PC executa: apps do VirtualOS, jogos HTML5/WebAssembly, sistemas x86 reais (Linux, DOS, utilitários de boot) via emulação, e PCs Windows reais via área de trabalho remota.")));
      }

      sheet.innerHTML = "";
      sheet.append(h("div", { class: "wz-card" },
        h("div", { class: "wz-head" },
          h("button", { class: "btn icon", onclick: close, html: ui("x", 16) }),
          h("div", { class: "grow" }, h("b", {}, editing ? `Configurar "${existing.name}"` : "Criar novo PC"), h("div", { class: "faint small" }, editing ? "As mudanças valem a partir da próxima inicialização. Seus arquivos são mantidos." : "Escolha o tipo e personalize os componentes.")),
        ),
        h("div", { class: "wz-steps" }, steps.map((s, i) => h("button", { class: "wz-step" + (i === step ? " on" : "") + (i < step ? " done" : ""), onclick: () => { step = i; draw(); } }, h("i", {}, i < step ? "✓" : i + 1), s))),
        h("div", { class: "wz-body" }, body),
        h("div", { class: "wz-foot" },
          step > 0 ? h("button", { class: "btn", onclick: () => { step--; draw(); } }, icon("back", 14), "Voltar") : h("span"),
          h("div", { class: "spacer" }),
          step < 3 ? h("button", { class: "btn primary", onclick: () => { step++; draw(); } }, "Avançar", icon("fwd", 14))
            : h("button", { class: "btn primary", onclick: () => this.finish(draft, existing, sheet) }, icon("check", 14), editing ? "Salvar alterações" : "Criar PC"))));
    };
    draw();
  }

  async finish(draft, existing, sheet) {
    draft.name = (draft.name || "Meu PC").trim() || "Meu PC";
    if (existing) {
      const vfs = new VFS(draft);
      const { bytes } = await vfs.usage();
      if (bytes > draft.storage * 1024 ** 3) return alertBox(this.el, "Armazenamento insuficiente", `Os arquivos deste PC já ocupam ${fmtBytes(bytes)}. Escolha uma capacidade maior.`);
    }
    await pcStore.save(draft);
    await new VFS(draft).init();
    sheet.remove();
    await this.render();
    if (!existing) this.el.querySelector(".pc-card .power-btn")?.classList.add("pulse");
  }

  destroy() { this.el.remove(); }
}

function stat(ic, label, value) {
  return h("div", { class: "l-stat" }, h("span", { class: "l-stat-ico", html: ui(ic, 18) }), h("div", { class: "grow" }, h("small", {}, label), h("b", { title: value }, value)));
}
function spec(ic, a, b) {
  return h("div", { class: "spec" }, h("span", { html: ui(ic, 16) }), h("div", {}, h("b", {}, a), h("small", {}, b)));
}

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      await screen.orientation?.lock?.("landscape").catch(() => {});
    }
  } catch {}
}
