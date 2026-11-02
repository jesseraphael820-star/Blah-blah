// Headless check: the bundled v86 emulator boots the bundled VPC Boot Monitor
// and executes real x86 code (we type "mem" and read the VGA text screen).
import { V86 } from "../www/vendor/v86/libv86.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "www");
const buf = (p) => { const b = fs.readFileSync(path.join(root, p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const floppy = new Uint8Array(1474560);
floppy.set(new Uint8Array(buf("images/vpcboot.img")));

const emu = new V86({
  wasm_path: path.join(root, "vendor/v86/v86.wasm"),
  memory_size: 64 * 1024 * 1024,
  vga_memory_size: 8 * 1024 * 1024,
  bios: { buffer: buf("vendor/v86/seabios.bin") },
  vga_bios: { buffer: buf("vendor/v86/vgabios.bin") },
  fda: { buffer: floppy.buffer },
  autostart: true,
  disable_speaker: true,
});

const rows = [];
emu.add_listener("screen-put-char", ([row, col, ch]) => {
  rows[row] ??= Array(80).fill(" ");
  rows[row][col] = String.fromCharCode(ch || 32);
});
const screen = () => rows.map((r) => (r || []).join("").trimEnd()).join("\n").trimEnd();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = false;
for (let i = 0; i < 60 && !ok; i++) { await wait(500); ok = screen().includes("VPC>"); }
if (!ok) { console.error(screen()); emu.destroy(); throw new Error("boot prompt not reached"); }
emu.keyboard_send_text("mem\n");
await wait(1500);
const s = screen();
emu.destroy();
if (!/Total memory: 6\d MB/.test(s)) { console.error(s); throw new Error("MEM command output missing"); }
console.log("v86 boot test OK\n" + s.split("\n").filter((l) => l.trim()).slice(-6).join("\n"));
process.exit(0);
