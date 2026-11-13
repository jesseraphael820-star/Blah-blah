// Gera uma prévia estática (sem servidor) do site para visualização/compartilhamento.
// Uso: node preview/build.mjs  → saída em preview/dist
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "preview", "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "mediapipe", "wasm"), { recursive: true });
mkdirSync(join(out, "models"), { recursive: true });

const shim = (f) => join(root, "preview", "shims", f);
await build({
  entryPoints: [join(root, "preview", "main.tsx")],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  jsx: "automatic",
  outfile: join(out, "app.js"),
  alias: {
    "@": join(root, "src"),
    "next/link": shim("link.tsx"),
    "next/navigation": shim("navigation.ts"),
    "next/font/google": shim("font.ts"),
  },
  define: {
    "process.env.NEXT_PUBLIC_STATIC_PREVIEW": '"1"',
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "warning",
});

execFileSync(
  "npx",
  ["@tailwindcss/cli", "-i", join(root, "preview", "preview.css"), "-o", join(out, "app.css"), "--minify"],
  { cwd: root, stdio: "inherit" },
);

for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"])
  cpSync(join(root, "node_modules/@mediapipe/tasks-vision/wasm", f), join(out, "mediapipe/wasm", f));
cpSync(join(root, "public/models/blaze_face_short_range.tflite"), join(out, "models/blaze_face_short_range.tflite.wasm")); // extensão aceita pelo host de artefatos

writeFileSync(
  join(out, "index.html"),
  `<title>LOOKSMAXXING AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="app.css">
<div id="root"></div>
<script type="module" src="app.js"></script>
`,
);
console.log("Prévia gerada em preview/dist");
