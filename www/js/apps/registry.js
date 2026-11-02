// Registry of every program the VirtualOS can run. `mem` is the simulated RAM
// budget (MB) the process reserves from the PC's virtual RAM; `size` is the
// simulated install size (MB) counted against the PC's storage.

export const APPS = {
  explorer: { name: "Explorador de Arquivos", short: "Arquivos", icon: "explorer", mem: 90, w: 860, h: 540, load: () => import("./explorer.js"), system: true },
  editor: { name: "Bloco de Notas", short: "Notas", icon: "editor", mem: 40, w: 720, h: 500, load: () => import("./editor.js"), system: true },
  terminal: { name: "Terminal", icon: "terminal", mem: 35, w: 760, h: 460, load: () => import("./terminal.js"), system: true },
  browser: { name: "Navegador", icon: "browser", mem: 380, w: 980, h: 640, load: () => import("./browser.js"), system: true },
  settings: { name: "Configurações", icon: "settings", mem: 60, w: 900, h: 600, load: () => import("./settings.js"), system: true, single: true },
  taskmgr: { name: "Gerenciador de Tarefas", short: "Tarefas", icon: "taskmgr", mem: 45, w: 860, h: 560, load: () => import("./taskmgr.js"), system: true, single: true },
  store: { name: "Central de Apps", short: "Loja", icon: "store", mem: 120, w: 960, h: 620, load: () => import("./store.js"), system: true, single: true },
  downloads: { name: "Downloads", icon: "downloads", mem: 30, w: 640, h: 440, load: () => import("./downloads.js"), system: true, single: true },
  recycle: { name: "Lixeira", icon: "recycle", mem: 40, w: 720, h: 460, load: () => import("./recycle.js"), system: true, single: true },
  calc: { name: "Calculadora", icon: "calc", mem: 20, w: 320, h: 470, load: () => import("./calc.js"), system: true, resizable: false },
  viewer: { name: "Fotos", icon: "viewer", mem: 70, w: 800, h: 560, load: () => import("./media.js").then((m) => ({ default: m.viewer })), system: true },
  player: { name: "Player de Mídia", short: "Player", icon: "player", mem: 90, w: 760, h: 480, load: () => import("./media.js").then((m) => ({ default: m.player })), system: true },
  x86: { name: "Máquina Virtual x86", short: "Máquina x86", icon: "x86", mem: 64, w: 900, h: 620, load: () => import("./x86vm.js"), system: true, req: { wasm: true } },
  remote: { name: "Área de Trabalho Remota", short: "PC Remoto", icon: "remote", mem: 150, w: 980, h: 640, load: () => import("./remote.js"), system: true },
  webapp: { name: "Aplicativo Web", icon: "webapp", mem: 200, w: 900, h: 600, load: () => import("./webapp.js"), system: true, hidden: true },
  // installable programs (Central de Apps)
  astro: { name: "Astro Blaster", icon: "astro", mem: 260, size: 48, w: 900, h: 620, load: () => import("../games/astro.js"), game: true, genre: "Nave / tiro", req: { ram: 4, gpu: 1 }, desc: "Tiro espacial em arena: destrua asteroides e drones, colete energia e sobreviva às ondas." },
  lane: { name: "Turbo Lane", icon: "lane", mem: 320, size: 64, w: 760, h: 620, load: () => import("../games/lane.js"), game: true, genre: "Corrida", req: { ram: 4, gpu: 2 }, desc: "Corrida em pista neon com trânsito e turbo. Requisitos maiores de GPU para efeitos completos." },
  reversi: { name: "Reversi", icon: "reversi", mem: 80, size: 6, w: 620, h: 640, load: () => import("../games/reversi.js"), game: true, genre: "Tabuleiro", req: { ram: 2 }, desc: "O clássico jogo de tabuleiro de domínio público contra uma IA com 3 níveis." },
  paint: { name: "Pintura", icon: "paint", mem: 90, size: 12, w: 860, h: 600, load: () => import("./paint.js"), genre: "Criatividade", req: { ram: 2 }, desc: "Editor de desenho com pincéis, formas, cores e salvamento PNG no sistema de arquivos." },
};

export const PINNED = ["explorer", "browser", "store", "terminal", "settings"];
export const START_PINNED = ["explorer", "browser", "store", "settings", "terminal", "taskmgr", "editor", "calc", "x86", "remote", "downloads", "viewer", "player", "recycle"];
export const OS_BASE_MB = 900; // simulated RAM reserved by VirtualOS itself
