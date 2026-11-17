// Gera uma versão do jogo em UM único arquivo HTML (CSS + JS embutidos),
// para publicar como artefato ou abrir direto no celular sem servidor.
// Uso: node tools/build-single.mjs [saida.html]   (padrão: dist/porto-brasa.html)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || join(root, 'dist/porto-brasa.html'));

const order = [];
const seen = new Set();
const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?\s*$/gm;

function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) visit(resolve(dirname(file), m[2]));
  order.push(file);
}
visit(join(root, 'src/main.js'));

const varName = (file) => '__m_' + relative(join(root, 'src'), file).replace(/[^a-zA-Z0-9]/g, '_');

let js = '';
for (const file of order) {
  let src = readFileSync(file, 'utf8');
  if (/^import\s/m.test(src.replace(IMPORT_RE, ''))) throw new Error('import não suportado em ' + file);
  src = src.replace(IMPORT_RE, (_, names, from) => {
    const list = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': '));
    return `const { ${list.join(', ')} } = ${varName(resolve(dirname(file), from))};`;
  });
  const exported = [];
  src = src.replace(/^export\s+(async\s+function|function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, name) => {
    exported.push(name);
    return `${kw} ${name}`;
  });
  if (/^export\s/m.test(src)) throw new Error('export não suportado em ' + file);
  js += `\n// ---- ${relative(root, file)} ----\nconst ${varName(file)} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

const css = readFileSync(join(root, 'styles.css'), 'utf8')
  .replace(':root {', ':root {\n  color-scheme: dark;');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const bodyMarkup = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"')).trim();
const icon = readFileSync(join(root, 'assets/icon.svg'), 'utf8');

const page = `<title>Porto Brasa</title>
<meta name="theme-color" content="#0c0e13">
<meta name="mobile-web-app-capable" content="yes">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
<style>
${css}
</style>
${bodyMarkup}
<script>
window.__ARTIFACT__ = true;
(() => {
'use strict';
${js}
})();
</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Gerado ${relative(root, out)} — ${(page.length / 1024).toFixed(0)} KB, ${order.length} módulos`);
