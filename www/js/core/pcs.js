// Virtual PC profiles: presets, persistence and device capability detection.
// Each field is tagged as "simulated" (a label/budget enforced by the app) or
// "real" (backed by actual phone hardware or real allocations).

import { db } from "./db.js";
import { uid, clamp } from "./util.js";

export const CPUS = [
  { id: "v2", model: "VCore V2 Lite", cores: 2, ghz: 2.0, tier: 1 },
  { id: "v4", model: "VCore V4", cores: 4, ghz: 2.8, tier: 2 },
  { id: "v6", model: "VCore V6 Pro", cores: 6, ghz: 3.4, tier: 3 },
  { id: "v8", model: "VCore V8 Gamer X", cores: 8, ghz: 4.2, tier: 4 },
  { id: "v12", model: "VCore V12 Workstation", cores: 12, ghz: 3.8, tier: 4 },
];
export const RAMS = [2, 4, 8, 16, 32];
export const STORAGES = [16, 32, 64, 128, 256, 512];
export const GPUS = [
  { id: "basic", name: "VGraphics Básica", vram: 1, tier: 1 },
  { id: "mid", name: "VGraphics RX Intermediária", vram: 4, tier: 2 },
  { id: "advanced", name: "VGraphics RTX Avançada", vram: 8, tier: 3 },
];
export const OSES = [
  { id: "vpcos", name: "VirtualOS 11", desc: "Desktop completo com apps reais (arquivos, terminal, navegador, jogos).", engine: "Interface desktop nativa (HTML5 / WebAssembly)" },
  { id: "vpcos-gamer", name: "VirtualOS 11 Gamer Edition", desc: "Mesmo sistema com tema gamer e painel de FPS ligado.", engine: "Interface desktop nativa (HTML5 / WebAssembly)" },
  { id: "linux", name: "VirtualOS + Linux x86", desc: "Inicia o desktop e abre um Linux i686 real emulado (v86) automaticamente.", engine: "Emulação x86 completa (v86 / WebAssembly)" },
  { id: "remote", name: "VirtualOS + PC Remoto", desc: "Abre o cliente de área de trabalho remota (VNC) para transmitir um PC Windows/Linux de verdade.", engine: "Streaming remoto (VNC sobre WebSocket)" },
];
export const RESOLUTIONS = ["auto", "1024x576", "1280x720", "1366x768", "1600x900", "1920x1080"];

export const PRESETS = {
  basic: { label: "PC básico", desc: "Navegação, documentos e jogos leves.", cpu: "v2", ram: 4, storage: 32, gpu: "basic", icon: "pc" },
  mid: { label: "PC intermediário", desc: "Multitarefa e jogos casuais.", cpu: "v4", ram: 8, storage: 128, gpu: "mid", icon: "pc" },
  gamer: { label: "PC gamer", desc: "Jogos compatíveis com máximo desempenho.", cpu: "v8", ram: 16, storage: 256, gpu: "advanced", icon: "gamepad", os: "vpcos-gamer" },
  pro: { label: "PC profissional", desc: "Workstation para muitos apps e VMs.", cpu: "v12", ram: 32, storage: 512, gpu: "mid", icon: "briefcase" },
  custom: { label: "PC personalizado", desc: "Escolha cada componente.", cpu: "v4", ram: 8, storage: 64, gpu: "mid", icon: "sliders" },
};

export const WALLPAPERS = ["aurora", "bloom", "nebula", "carbon", "sunset", "ocean"];

export function defaultSettings(os) {
  return {
    wallpaper: os === "vpcos-gamer" ? "carbon" : "aurora",
    customWallpaper: null,
    accent: os === "vpcos-gamer" ? "#ff3d6e" : "#4c8dff",
    transparency: true,
    volume: 70,
    muted: false,
    hud: os === "vpcos-gamer",
    dnd: false,
    resolution: "auto",
    zoom: 100,
    controls: { sensitivity: 1, size: 120, haptics: true, leftHanded: false, opacity: 0.9, visible: true },
    network: { offline: false, relay: "" },
    remote: { url: "", viewOnly: false },
    iconSize: "md",
  };
}

export function makePC(type = "mid", over = {}) {
  const p = PRESETS[type] || PRESETS.custom;
  const os = over.os || p.os || "vpcos";
  return {
    id: uid("pc_"),
    name: over.name || p.label.replace("PC", "Meu PC"),
    type,
    cpu: over.cpu || p.cpu,
    ram: over.ram || p.ram,
    storage: over.storage || p.storage,
    gpu: over.gpu || p.gpu,
    os,
    created: Date.now(),
    lastBoot: null,
    state: "off",
    session: null,
    installed: ["astro", "lane", "reversi"],
    settings: defaultSettings(os),
    ...Object.fromEntries(Object.entries(over).filter(([k]) => !["name", "cpu", "ram", "storage", "gpu", "os"].includes(k))),
  };
}

export const pcStore = {
  list: async () => (await db.all("pcs")).sort((a, b) => (b.lastBoot || b.created) - (a.lastBoot || a.created)),
  get: (id) => db.get("pcs", id),
  save: (pc) => db.put("pcs", JSON.parse(JSON.stringify(pc))),
  remove: (id) => db.del("pcs", id),
};

export const cpuOf = (pc) => CPUS.find((c) => c.id === pc.cpu) || CPUS[1];
export const gpuOf = (pc) => GPUS.find((g) => g.id === pc.gpu) || GPUS[0];
export const osOf = (pc) => OSES.find((o) => o.id === pc.os) || OSES[0];

let deviceCache;
export function device() {
  if (deviceCache) return deviceCache;
  let gpu = "Desconhecida", webgl = 0, maxTex = 0;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (gl) {
      webgl = gl instanceof (window.WebGL2RenderingContext || Object) && window.WebGL2RenderingContext ? 2 : 1;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {}
  const ua = navigator.userAgent;
  const cores = navigator.hardwareConcurrency || 2;
  const memGB = navigator.deviceMemory || null; // Chrome caps this at 8
  deviceCache = {
    cores,
    memGB,
    gpu,
    webgl,
    maxTex,
    wasm: typeof WebAssembly === "object",
    android: /Android/i.test(ua),
    mobile: /Android|iPhone|iPad|Mobile/i.test(ua),
    touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    screen: `${screen.width}×${screen.height} @${devicePixelRatio}x`,
    ua,
  };
  return deviceCache;
}

// Real RAM the x86 emulator may allocate for the guest, capped for phone safety.
export function vmMemoryMB(pc) {
  const d = device();
  const deviceMB = (d.memGB || 4) * 1024;
  const cap = clamp(Math.floor(deviceMB / 4), 128, 1024);
  return clamp(pc.ram * 1024, 32, cap);
}

// How a requirement set compares to this PC and the real device.
export function checkRequirements(pc, req = {}) {
  const issues = [], warnings = [];
  const d = device();
  if (req.ram && pc.ram < req.ram) issues.push(`Requer ${req.ram} GB de RAM virtual (este PC tem ${pc.ram} GB).`);
  if (req.gpu && gpuOf(pc).tier < req.gpu) warnings.push(`Recomendado placa de vídeo ${GPUS[req.gpu - 1].name}.`);
  if (req.cpu && cpuOf(pc).tier < req.cpu) warnings.push("Processador virtual abaixo do recomendado.");
  if (req.webgl && !d.webgl) issues.push("Seu celular não oferece WebGL (aceleração gráfica real).");
  if (req.wasm && !d.wasm) issues.push("Seu navegador não suporta WebAssembly.");
  if (req.deviceMemGB && d.memGB && d.memGB < req.deviceMemGB) warnings.push(`O celular tem ${d.memGB} GB de RAM real; o recomendado é ${req.deviceMemGB} GB.`);
  if (req.cores && d.cores < req.cores) warnings.push(`O celular tem ${d.cores} núcleos reais; recomendado ${req.cores}.`);
  return { ok: !issues.length, issues, warnings, level: issues.length ? "bad" : warnings.length ? "warn" : "ok" };
}
