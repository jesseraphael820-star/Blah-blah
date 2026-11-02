// Virtual PC — entry point. Routes between the launcher (PC list / creation),
// the boot sequence and the desktop shell.

import { pcStore } from "./core/pcs.js";
import { Launcher } from "./ui/launcher.js";
import { bootSequence, shutdownSequence } from "./ui/boot.js";
import { Shell } from "./ui/desktop.js";

const root = document.getElementById("app");
let current = null;

async function showLauncher(flash) {
  current?.destroy?.();
  root.innerHTML = "";
  current = new Launcher(root, { onPower: powerOn, flash });
  await current.render();
}

async function powerOn(pc, { skipPost = false } = {}) {
  current?.destroy?.();
  root.innerHTML = "";
  const resuming = pc.state === "suspended";
  await bootSequence(root, pc, { resuming, skipPost });
  pc.lastBoot = Date.now();
  await pcStore.save(pc);
  root.innerHTML = "";
  const shell = new Shell(root, pc, {
    async onPower(action) {
      if (action === "suspend") {
        await shell.suspend();
        await shutdownSequence(root, pc, "suspend");
        return showLauncher(`"${pc.name}" foi suspenso. Ligue novamente para continuar de onde parou.`);
      }
      await shell.shutdown();
      await shutdownSequence(root, pc, action);
      if (action === "restart") return powerOn(await pcStore.get(pc.id));
      return showLauncher();
    },
  });
  current = shell;
  window.__vpc = { shell }; // handle for automated tests / debugging
  await shell.start();
}

if ("serviceWorker" in navigator && location.protocol !== "file:" && !location.search.includes("nosw")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});

// Deep link for tests / shortcuts: ?boot=<pcId>
const bootId = new URLSearchParams(location.search).get("boot");
if (bootId) pcStore.get(bootId).then((pc) => (pc ? powerOn(pc, { skipPost: true }) : showLauncher()));
else showLauncher();

window.addEventListener("unhandledrejection", (e) => console.error("[virtual-pc]", e.reason));
