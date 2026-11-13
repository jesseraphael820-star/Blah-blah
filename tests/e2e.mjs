// Teste ponta a ponta (Playwright) de todas as funcionalidades principais.
// Uso: npm run build && npm run test:e2e
// Requer tests/fixtures/face.jpg (qualquer foto frontal de rosto).
// A IA é interceptada SOMENTE neste teste (page.route) para validar o fluxo
// sem gastar créditos; o app em si nunca simula edições.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, statSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3123;
const BASE = `http://localhost:${PORT}`;
const FIXTURE = "tests/fixtures/face.jpg";
const OUT = "tests/output";
mkdirSync(OUT, { recursive: true });
let pw;
try {
  pw = createRequire(import.meta.url)("playwright");
} catch {
  console.error("Instale o Playwright: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}
const { chromium, devices } = pw;
if (!existsSync(FIXTURE)) {
  console.error(`Coloque uma foto de rosto em ${FIXTURE}`);
  process.exit(1);
}

const env = { ...process.env, PORT: String(PORT) };
delete env.OPENAI_API_KEY;
delete env.REPLICATE_API_TOKEN;
delete env.IMAGE_PROVIDER;
const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env, stdio: "pipe" });
server.stderr.on("data", (d) => process.stderr.write(d));

let failures = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n    ${String(err?.message ?? err).split("\n").slice(0, 6).join("\n    ")}`);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/status`);
      if (r.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("servidor não subiu");
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  console.log("API");
  await step("GET /api/status sem chave → configured=false", async () => {
    const s = await (await fetch(`${BASE}/api/status`)).json();
    assert(s.configured === false && s.provider === null, JSON.stringify(s));
  });
  await step("POST /api/edit sem chave → 503 NOT_CONFIGURED", async () => {
    const r = await fetch(`${BASE}/api/edit`, { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    const j = await r.json();
    assert(r.status === 503 && j.error.code === "NOT_CONFIGURED", `${r.status} ${JSON.stringify(j)}`);
    assert(r.headers.get("cache-control")?.includes("no-store"), "sem no-store");
  });

  console.log("Upload e detecção de rosto");
  await page.goto(BASE);
  await step("landing exibe área de upload", async () => {
    await page.getByTestId("dropzone").waitFor();
    await page.getByTestId("upload-button").waitFor();
  });
  await step("rejeita arquivo que não é imagem", async () => {
    await page.getByTestId("file-input").setInputFiles({ name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("oi") });
    await page.getByText("Formato não suportado").waitFor({ timeout: 5000 });
  });
  await step("envia foto, mostra prévia e detecta o rosto", async () => {
    await page.getByTestId("file-input").setInputFiles(FIXTURE);
    await page.getByTestId("photo-preview").waitFor({ timeout: 20000 });
    const status = page.getByTestId("face-status");
    await status.filter({ hasText: "Rosto detectado" }).waitFor({ timeout: 30000 });
    await page.getByTestId("face-overlay").waitFor();
  });
  await page.screenshot({ path: `${OUT}/01-landing-upload.png` });
  await step("abre o estúdio", async () => {
    await page.getByTestId("open-studio").click();
    await page.waitForURL("**/studio");
    await page.getByTestId("editor").waitFor();
    await page.getByTestId("tool-panel").waitFor();
  });

  console.log("IA não configurada");
  let editCalls = 0;
  await page.route("**/api/edit", (route) => {
    editCalls++;
    return route.continue();
  });
  await step("aplicar sem IA configurada mostra instruções e não envia a foto", async () => {
    await page.getByTestId("api-not-configured").waitFor();
    await page.getByTestId("cat-cabelo").click();
    await page.getByTestId("tool-low-fade").click();
    await page.getByTestId("apply-edit").click();
    const dlg = page.getByTestId("error-dialog");
    await dlg.waitFor();
    assert((await dlg.getAttribute("data-code")) === "NOT_CONFIGURED", "código errado");
    await page.getByTestId("setup-instructions").waitFor();
    assert(editCalls === 0, "a foto não deveria ter sido enviada");
    await page.screenshot({ path: `${OUT}/02-not-configured.png` });
    await page.getByTestId("error-ok").click();
  });
  await page.unroute("**/api/edit");

  console.log("Edição com IA (provedor interceptado no teste)");
  // Gera, no navegador, uma versão visivelmente diferente da imagem enviada.
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { configured: true, provider: "openai", model: "gpt-image-1" } }),
  );
  const seen = [];
  await page.route("**/api/edit", async (route) => {
    const body = route.request().postDataJSON();
    seen.push(body);
    const edited = await page.evaluate(async ({ image, toolId }) => {
      const img = new Image();
      img.src = image;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.filter = toolId.startsWith("bone") ? "hue-rotate(180deg)" : "sepia(0.8) saturate(1.6)";
      ctx.drawImage(img, 0, 0);
      return c.toDataURL("image/jpeg", 0.9);
    }, body);
    await sleep(1200);
    await route.fulfill({ json: { image: edited, provider: "openai", model: "gpt-image-1" } });
  });
  await page.reload();
  await page.getByTestId("editor").waitFor();

  await step("primeira edição pede autorização e mostra carregamento", async () => {
    await page.getByTestId("cat-cabelo").click();
    await page.getByTestId("tool-low-fade").click();
    await page.getByTestId("apply-edit").click();
    await page.getByTestId("consent-accept").click();
    await page.getByTestId("processing").waitFor({ timeout: 5000 });
    await page.screenshot({ path: `${OUT}/03-processing.png` });
    await page.getByTestId("processing").waitFor({ state: "detached", timeout: 20000 });
  });
  await step("requisição enviada contém só ids validados (sem prompt livre)", async () => {
    const b = seen[0];
    assert(b && b.toolId === "low-fade" && !("prompt" in b), JSON.stringify(Object.keys(b ?? {})));
    assert(b.image.startsWith("data:image/jpeg;base64,"), "imagem não é jpeg");
    assert(Math.max(b.width, b.height) <= 1024, "imagem não foi redimensionada");
  });
  await step("resultado aparece no comparador com 2 versões", async () => {
    await page.getByTestId("compare-slider").waitFor();
    assert((await page.getByTestId("version-strip").locator("img").count()) === 2, "versões != 2");
  });
  await step("controle deslizante revela antes/depois ao arrastar", async () => {
    const handle = page.getByRole("slider", { name: "Controle antes e depois" });
    const box = await page.getByTestId("compare-slider").boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 6 });
    await page.mouse.up();
    const v1 = Number(await handle.getAttribute("aria-valuenow"));
    assert(v1 >= 15 && v1 <= 25, `valor ${v1}`);
    await handle.focus();
    await page.keyboard.press("End");
    assert(Number(await handle.getAttribute("aria-valuenow")) === 100, "teclado End");
    await page.keyboard.press("Home");
    for (let i = 0; i < 25; i++) await page.keyboard.press("ArrowRight");
    assert(Number(await handle.getAttribute("aria-valuenow")) === 50, "teclado setas");
    await page.screenshot({ path: `${OUT}/04-slider.png` });
  });
  await step("modo lado a lado", async () => {
    await page.getByTestId("mode-side").click();
    await page.getByTestId("compare-side").waitFor();
    await page.screenshot({ path: `${OUT}/05-side.png` });
    await page.getByRole("radio", { name: "Deslizante" }).click();
    await page.getByTestId("compare-slider").waitFor();
  });
  await step("segunda edição (acessório com cor) encadeia sobre a versão atual", async () => {
    await page.getByTestId("cat-acessorios").click();
    await page.getByTestId("tool-bone-smashing").click();
    await page.getByRole("radio", { name: "Branco" }).click();
    await page.getByTestId("apply-edit").click();
    await page.getByTestId("processing").waitFor({ state: "detached", timeout: 20000 });
    assert(seen.length === 2 && seen[1].variantId === "branco", JSON.stringify(seen[1]?.variantId));
    assert((await page.getByTestId("version-strip").locator("img").count()) === 3, "versões != 3");
  });
  await step("desfazer, refazer e restaurar original", async () => {
    await page.getByTestId("undo").click();
    await page.getByTestId("redo").click();
    assert(await page.getByTestId("redo").isDisabled(), "refazer deveria estar desabilitado");
    await page.getByTestId("restore").click();
    assert(await page.getByTestId("undo").isDisabled(), "desfazer deveria estar desabilitado no original");
    assert(await page.getByTestId("download").isDisabled(), "download deveria estar desabilitado no original");
    await page.getByTestId("redo").click();
    await page.getByTestId("redo").click();
  });
  await step("salvar imagem editada (download)", async () => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download").click()]);
    const p = `${OUT}/${dl.suggestedFilename()}`;
    await dl.saveAs(p);
    assert(dl.suggestedFilename().endsWith(".jpg") && statSync(p).size > 10_000, "download inválido");
  });
  await step("baixar comparação antes/depois", async () => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-compare").click()]);
    const p = `${OUT}/${dl.suggestedFilename()}`;
    await dl.saveAs(p);
    assert(dl.suggestedFilename().includes("antes-depois") && statSync(p).size > 10_000, "download inválido");
  });
  await step("favoritar edição atual e ver em Favoritos", async () => {
    await page.getByTestId("favorite-current").click();
    await page.getByTestId("nav-favoritos").click();
    await page.getByTestId("history-item").first().waitFor();
    assert((await page.getByTestId("history-item").count()) === 1, "favoritos != 1");
  });
  await step("histórico lista as 2 edições e persiste após recarregar", async () => {
    await page.reload();
    await page.getByTestId("nav-historico").click();
    await page.getByTestId("history-item").first().waitFor();
    assert((await page.getByTestId("history-item").count()) === 2, "histórico != 2");
    await page.screenshot({ path: `${OUT}/06-history.png` });
    await page.getByTestId("nav-editor").click();
    assert((await page.getByTestId("version-strip").locator("img").count()) === 3, "sessão não restaurada");
  });
  await step("usar edição do histórico no comparador", async () => {
    await page.getByTestId("nav-historico").click();
    await page.getByTestId("history-use").last().click();
    await page.getByTestId("editor").waitFor();
    assert((await page.getByTestId("version-strip").locator("img").count()) === 4, "não adicionou versão");
  });
  await step("excluir uma edição do histórico", async () => {
    await page.getByTestId("nav-historico").click();
    await page.getByTestId("history-delete").first().click();
    await page.getByTestId("history-delete-confirm").click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="history-item"]').length === 1);
  });
  await step("Gua Sha e Hábitos (educativo)", async () => {
    await page.getByTestId("nav-guasha").click();
    await page.getByTestId("guasha-guide").waitFor();
    await page.getByText("não altera permanentemente a estrutura óssea").first().waitFor();
    await page.screenshot({ path: `${OUT}/07-guasha.png`, fullPage: true });
    await page.getByTestId("nav-habitos").click();
    await page.getByTestId("habits-guide").waitFor();
    await page.getByRole("checkbox").first().click();
    await page.getByText("1/5").waitFor();
  });
  await step("configurações: apagar histórico", async () => {
    await page.getByTestId("nav-config").click();
    await page.getByTestId("clear-history").click();
    await page.getByTestId("confirm-wipe").click();
    await page.getByTestId("clear-history").filter({ hasText: "(0)" }).waitFor();
  });
  await step("configurações: apagar tudo volta para o upload", async () => {
    await page.getByTestId("wipe-all").click();
    await page.getByTestId("confirm-wipe").click();
    await page.getByTestId("nav-editor").click();
    await page.getByTestId("dropzone").waitFor();
    await page.reload();
    await page.getByTestId("dropzone").waitFor();
  });
  await step("remover foto", async () => {
    await page.getByTestId("file-input").setInputFiles(FIXTURE);
    await page.getByTestId("editor").waitFor({ timeout: 20000 });
    await page.getByTestId("nav-foto").click();
    await page.getByTestId("photo-preview").waitFor();
    await page.getByTestId("remove-photo").click();
    await page.getByTestId("confirm-remove").click();
    await page.getByTestId("dropzone").waitFor();
  });

  console.log("Responsivo (celular)");
  const mobile = await browser.newContext({ ...devices["iPhone 13"] });
  const mp = await mobile.newPage();
  for (const path of ["/", "/studio", "/privacidade"]) {
    await step(`sem rolagem horizontal em ${path}`, async () => {
      await mp.goto(BASE + path);
      await mp.waitForLoadState("networkidle");
      const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(over <= 0, `overflow de ${over}px`);
    });
  }
  await step("upload e editor no celular", async () => {
    await mp.goto(BASE + "/studio");
    await mp.getByTestId("file-input").setInputFiles(FIXTURE);
    await mp.getByTestId("editor").waitFor({ timeout: 30000 });
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 0, `overflow de ${over}px`);
    await mp.screenshot({ path: `${OUT}/08-mobile.png`, fullPage: true });
  });

  await step("sem erros no console", async () => {
    const relevant = consoleErrors.filter((e) => !/503|Service Unavailable/.test(e));
    assert(relevant.length === 0, relevant.join("\n"));
  });

  await browser.close();
} catch (err) {
  failures++;
  console.error(err);
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} falha(s)` : "\nTodos os testes passaram ✔");
process.exit(failures ? 1 : 0);
