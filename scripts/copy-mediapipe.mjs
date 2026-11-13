// Copia os arquivos WASM do MediaPipe para /public, para que a detecção de rosto
// rode 100% no navegador sem depender de CDN de terceiros.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(root, "public", "mediapipe", "wasm");

if (!existsSync(src)) {
  console.warn("[copy-mediapipe] pacote @mediapipe/tasks-vision não encontrado; pulando.");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-mediapipe] WASM copiado para public/mediapipe/wasm");
