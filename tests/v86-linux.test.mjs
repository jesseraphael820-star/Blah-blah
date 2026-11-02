// Headless check: the bundled i686 Linux kernel (+ BusyBox initramfs) boots in
// v86, gets a shell, and sees the 9p shared folder used for file transfer.
import { V86 } from "../www/vendor/v86/libv86.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "www");
const buf = (p) => { const b = fs.readFileSync(path.join(root, p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

const emu = new V86({
  wasm_path: path.join(root, "vendor/v86/v86.wasm"),
  memory_size: 128 * 1024 * 1024,
  bios: { buffer: buf("vendor/v86/seabios.bin") },
  vga_bios: { buffer: buf("vendor/v86/vgabios.bin") },
  bzimage: { buffer: buf("images/vpc-linux.bzImage") },
  cmdline: "console=tty0 quiet",
  filesystem: {},
  autostart: true,
  disable_speaker: true,
});
const rows = [];
emu.add_listener("screen-put-char", ([r, c, ch]) => { rows[r] ??= Array(80).fill(" "); rows[r][c] = String.fromCharCode(ch || 32); });
const screen = () => rows.map((r) => (r || []).join("").trimEnd()).filter((l) => l.trim()).join("\n");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = false;
for (let i = 0; i < 120 && !ok; i++) { await wait(500); ok = /vpc@linux/.test(screen()); }
if (!ok) { console.error(screen()); emu.destroy(); throw new Error("Linux shell not reached"); }
await emu.create_file("/hello.txt", new TextEncoder().encode("ola do virtual pc\n"));
emu.keyboard_send_text("cat /mnt/host/hello.txt; uname -m; echo linux-out > /mnt/host/out.txt\n");
let s = "";
for (let i = 0; i < 20; i++) { await wait(500); s = screen(); if (s.includes("ola do virtual pc") && /i[3-6]86/.test(s)) break; }
let out = "";
try { out = new TextDecoder().decode(await emu.read_file("/out.txt")); } catch {}
emu.destroy();
if (!s.includes("ola do virtual pc") || !/i[3-6]86/.test(s) || !out.includes("linux-out")) { console.error(s, "\nout:", out); throw new Error("shared folder / shell check failed"); }
console.log("v86 Linux test OK\n" + s.split("\n").slice(-8).join("\n"));
process.exit(0);
