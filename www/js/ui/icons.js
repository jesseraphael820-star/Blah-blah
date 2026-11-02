// Hand-made SVG icon set. `ui(name)` returns a line glyph, `appIcon(id)` a
// colourful tile icon in a modern desktop style.

const G = {
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  gamepad: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-3.95 3.4L2 14a3 3 0 0 0 5.4 2.2L9 14h6l1.6 2.2A3 3 0 0 0 22 14l-.75-5.6A4 4 0 0 0 17.3 5Z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  min: '<path d="M5 12h14"/>',
  max: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  restoreWin: '<rect x="4" y="8" width="12" height="12" rx="1.5"/><path d="M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1"/>',
  wifiOff: '<path d="m2 2 20 20M8.5 16a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4-2.4M14.5 10.2a10 10 0 0 1 4.5 2.4M2 9a15 15 0 0 1 5-3.2M11 4.1a15 15 0 0 1 11 4.9"/><circle cx="12" cy="19.5" r="1"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m23 9-6 6M17 9l6 6"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  fwd: '<path d="m9 18 6-6-6-6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M7 16h10"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  exitFull: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
  rotate: '<path d="M2 12a10 10 0 0 1 17-7l2 2M22 12a10 10 0 0 1-17 7l-2-2"/><path d="M21 3v4h-4M3 21v-4h4"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  chevRight: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  play: '<path d="M6 4l14 8-14 8Z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  memory: '<path d="M6 19v-3M10 19v-3M14 19v-3M18 19v-3M8 11V9M16 11V9M12 11V9"/><rect x="2" y="5" width="20" height="11" rx="1"/>',
  disk: '<path d="M22 12H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/><path d="M6 16h.01M10 16h.01"/>',
  gpu: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="9" cy="12" r="3"/><path d="M16 10h3M16 14h3M5 18v3"/>',
  thermo: '<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7H16a6 6 0 0 0 6-6c0-4.9-4.5-8.4-10-8.4Z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9Z"/>',
  apps: '<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  video: '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m22 8-5 4 5 4Z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  pin: '<path d="M12 17v5M9 10.8V4h6v6.8l3 3.2H6Z"/>',
  scroll: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  brightness: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z"/>',
  hdd: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 16h.01M10 16h8"/>',
  remote: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M9 10l3-3 3 3M12 7v6"/>',
};

export function ui(name, size = 18, stroke = 1.8) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${G[name] || G.file}</svg>`;
}

const TILES = {
  explorer: ["#ffcb47", "#f59e0b", "folder"],
  folder: ["#ffd666", "#f5a524", "folder"],
  editor: ["#6ec3ff", "#2f7cf6", "edit"],
  terminal: ["#3a4256", "#10131c", "terminal"],
  browser: ["#41d1ff", "#2563eb", "globe"],
  settings: ["#9aa5bd", "#505a72", "sliders"],
  taskmgr: ["#3ee6a0", "#0e9f6e", "cpu"],
  store: ["#ff7ad9", "#7b5cff", "star"],
  downloads: ["#5bd2ff", "#0284c7", "download"],
  recycle: ["#c4cee0", "#7c879d", "trash"],
  recycleFull: ["#c4cee0", "#7c879d", "trash"],
  calc: ["#8f9bb3", "#3b4459", "grid"],
  viewer: ["#ff9a62", "#e8505b", "image"],
  player: ["#ff6b8b", "#b4235a", "play"],
  x86: ["#59f0c8", "#0f766e", "cpu"],
  remote: ["#8aa2ff", "#4338ca", "remote"],
  perf: ["#ffe14d", "#ff7a00", "zap"],
  webapp: ["#7ee0ff", "#3b82f6", "apps"],
  astro: ["#7b5cff", "#1e1b4b", "star"],
  lane: ["#ff5f6d", "#ffc371", "zap"],
  reversi: ["#22c55e", "#14532d", "grid"],
  paint: ["#ffb3c7", "#e11d74", "palette"],
  text: ["#e6ecf7", "#a5b1c7", "file"],
  image: ["#ffb199", "#ff6a88", "image"],
  audio: ["#ff8bb0", "#c2185b", "music"],
  video: ["#a78bfa", "#6d28d9", "video"],
  disk: ["#9be7d8", "#0f766e", "hdd"],
  zip: ["#ffe08a", "#c98a12", "file"],
  exe: ["#c5cbe0", "#59607a", "monitor"],
  apk: ["#a3e635", "#3f6212", "file"],
  html: ["#ffa26b", "#ea580c", "globe"],
  file: ["#e6ecf7", "#a5b1c7", "file"],
  pdf: ["#ff8a8a", "#dc2626", "file"],
  link: ["#e6ecf7", "#a5b1c7", "link"],
  app: ["#7ee0ff", "#3b82f6", "apps"],
};

let n = 0;
export function appIcon(id, size = 40) {
  if (id === "folder") return folderIcon(size);
  const [a, b, g] = TILES[id] || TILES.file;
  const gid = "g" + (n++);
  const fileish = ["text", "file", "pdf", "zip", "html", "link"].includes(id);
  if (fileish) {
    return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f9fd"/><stop offset="1" stop-color="#d6deec"/></linearGradient></defs><path d="M12 4h17l9 9v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="url(#${gid})"/><path d="M29 4v9h9" fill="#b7c3d9"/><g transform="translate(15 19) scale(.75)" fill="none" stroke="${b}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${G[g]}</g></svg>`;
  }
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect x="3" y="3" width="42" height="42" rx="11" fill="url(#${gid})"/><rect x="3" y="3" width="42" height="21" rx="11" fill="#fff" opacity=".12"/><g transform="translate(12 12)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${G[g]}</g></svg>`;
}

export function folderIcon(size = 40) {
  const gid = "f" + (n++);
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd970"/><stop offset="1" stop-color="#f5a524"/></linearGradient></defs><path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v3H4Z" fill="#e0901a"/><path d="M4 17a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" fill="url(#${gid})"/><path d="M4 17a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v2H4Z" fill="#fff" opacity=".25"/></svg>`;
}

export function logo(size = 48) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="vpcL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c8dff"/><stop offset="1" stop-color="#7b5cff"/></linearGradient></defs><rect x="2" y="2" width="28" height="28" rx="6" fill="url(#vpcL)"/><rect x="34" y="2" width="28" height="28" rx="6" fill="url(#vpcL)" opacity=".85"/><rect x="2" y="34" width="28" height="28" rx="6" fill="url(#vpcL)" opacity=".85"/><rect x="34" y="34" width="28" height="28" rx="6" fill="url(#vpcL)" opacity=".7"/></svg>`;
}
