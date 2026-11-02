// File compatibility analyser: inspects real file headers (magic bytes) and
// explains honestly whether/how the file can run on this virtual PC.

import { extOf } from "./util.js";
import { readZip } from "./zip.js";

const PE_MACHINE = { 0x14c: "x86 (32 bits)", 0x8664: "x64 (64 bits)", 0xaa64: "ARM64", 0x1c0: "ARM", 0x1c4: "ARM Thumb-2" };
const ELF_MACHINE = { 3: "i386 (32 bits)", 62: "x86-64", 40: "ARM", 183: "AArch64", 243: "RISC-V" };

export async function analyze(blob, name) {
  const head = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
  const dv = new DataView(head.buffer);
  const ext = extOf(name);
  const str = (o, n) => String.fromCharCode(...head.subarray(o, o + n));
  const r = { name, size: blob.size, ext, type: "unknown", label: "Arquivo desconhecido", runnable: false, how: [], actions: [] };

  if (head[0] === 0x4d && head[1] === 0x5a) { // MZ
    const peOff = head.length > 0x40 ? dv.getUint32(0x3c, true) : 0;
    let pe = null;
    if (peOff && peOff + 24 < blob.size) {
      const peHead = new DataView(await blob.slice(peOff, peOff + 0x60).arrayBuffer());
      if (peHead.byteLength >= 0x60 && peHead.getUint32(0, true) === 0x00004550) {
        const machine = peHead.getUint16(4, true);
        const magic = peHead.getUint16(24, true);
        const subsys = peHead.getUint16(24 + 68, true);
        pe = { machine: PE_MACHINE[machine] || "0x" + machine.toString(16), bits: magic === 0x20b ? 64 : 32, gui: subsys === 2, subsysName: { 1: "driver", 2: "interface gráfica", 3: "console" }[subsys] || "outro" };
      }
    }
    if (pe) {
      Object.assign(r, { type: "windows", label: `Programa Windows (PE ${pe.machine}, ${pe.subsysName})`, runnable: false });
      r.how.push("Executáveis Windows precisam do Windows. O Android não roda .exe nativamente e este app não finge que roda.");
      r.how.push("Opção 1 — Área de Trabalho Remota: instale e rode o programa/jogo num PC Windows real e controle-o daqui (melhor para jogos).");
      if (pe.bits === 32) r.how.push("Opção 2 — Máquina x86: programas Windows antigos de 32 bits podem rodar se você iniciar uma imagem de Windows 9x/ReactOS própria (.iso/.img). Desempenho baixo; jogos 3D modernos não funcionam.");
      else r.how.push("Programas de 64 bits não rodam no emulador x86 (ele emula apenas CPUs de 32 bits).");
      r.actions.push("remote");
    } else {
      Object.assign(r, { type: "dos", label: "Programa MS-DOS (MZ)", runnable: true });
      r.how.push("Programas DOS rodam na Máquina x86 com um sistema DOS (ex.: imagem do FreeDOS). Coloque o programa numa imagem de disquete/ISO ou use a pasta compartilhada do Linux.");
      r.actions.push("x86");
    }
    return r;
  }
  if (head[0] === 0x7f && str(1, 3) === "ELF") {
    const cls = head[4] === 2 ? 64 : 32;
    const machine = dv.getUint16(18, true);
    const m = ELF_MACHINE[machine] || "desconhecida";
    const ok = machine === 3;
    Object.assign(r, { type: "elf", label: `Programa Linux ELF ${cls} bits (${m})`, runnable: ok });
    r.how.push(ok ? "Compatível com o Linux i686 da Máquina x86 (se for estático ou usar só bibliotecas presentes). Ele é copiado para a pasta compartilhada /mnt/host." : `A Máquina x86 emula CPU i686 de 32 bits; binários ${m} não rodam nela.`);
    if (ok) r.actions.push("linux-share");
    return r;
  }
  if (str(0, 4) === "PK\x03\x04" || ext === "apk") {
    if (ext === "apk") {
      Object.assign(r, { type: "apk", label: "Aplicativo Android (APK)", runnable: false });
      r.how.push("APKs são apps do próprio Android: instale-o diretamente no celular, fora do Virtual PC.");
      return r;
    }
    try {
      const z = await readZip(blob);
      const names = z.entries.map((e) => e.name);
      const index = names.filter((n) => /(^|\/)index\.html?$/i.test(n)).sort((a, b) => a.split("/").length - b.split("/").length)[0];
      const exe = names.find((n) => /\.exe$/i.test(n));
      const disk = names.find((n) => /\.(iso|img|ima)$/i.test(n));
      const jsdos = names.find((n) => /\.jsdos$/i.test(n) || /^\.jsdos\//.test(n));
      if (index) { Object.assign(r, { type: "webzip", label: `Aplicativo/jogo web (${z.entries.length} arquivos)`, runnable: true, entry: index }); r.how.push("Aplicativo HTML5/WebAssembly: roda de verdade neste PC."); r.actions.push("install-web"); }
      else if (disk) { Object.assign(r, { type: "diskzip", label: "Pacote com imagem de disco", runnable: true, entry: disk }); r.how.push(`Contém a imagem ${disk}: extraia e inicie na Máquina x86.`); r.actions.push("extract"); }
      else if (exe || jsdos) { Object.assign(r, { type: "winzip", label: "Pacote com programa Windows/DOS", runnable: false }); r.how.push("O pacote contém executáveis (.exe). Veja a análise do .exe após extrair: Windows precisa de PC remoto; DOS roda na Máquina x86."); r.actions.push("extract"); }
      else { Object.assign(r, { type: "zip", label: `Arquivo ZIP (${z.entries.length} itens)`, runnable: false }); r.actions.push("extract"); }
    } catch (e) { Object.assign(r, { type: "zip", label: "ZIP inválido", how: [e.message] }); }
    return r;
  }
  if (blob.size >= 32774 && (await blob.slice(32769, 32774).text()) === "CD001") {
    Object.assign(r, { type: "iso", label: "Imagem de CD/DVD inicializável (ISO 9660)", runnable: true });
    r.how.push("Inicie na Máquina x86 (emulação i686 de 32 bits). Funciona com Linux 32 bits, FreeDOS, KolibriOS, ReactOS e outros sistemas leves.");
    r.actions.push("x86");
    return r;
  }
  if (["img", "ima", "vfd", "bin", "hdd", "iso"].includes(ext) || (blob.size % 512 === 0 && head[510] === 0x55 && head[511] === 0xaa)) {
    const boot = head[510] === 0x55 && head[511] === 0xaa;
    Object.assign(r, { type: "disk", label: boot ? "Imagem de disco inicializável" : "Imagem de disco", runnable: true });
    r.how.push(blob.size <= 2949120 ? "Será usada como disquete na Máquina x86." : "Será usada como disco rígido/CD na Máquina x86.");
    r.actions.push("x86");
    return r;
  }
  if (["html", "htm"].includes(ext) || /<!doctype html|<html/i.test(str(0, 512))) {
    Object.assign(r, { type: "html", label: "Página/aplicativo HTML", runnable: true });
    r.how.push("Roda de verdade no VirtualOS.");
    r.actions.push("install-web");
    return r;
  }
  if (["msi"].includes(ext)) { Object.assign(r, { type: "windows", label: "Instalador Windows (MSI)" }); r.how.push("Instaladores MSI precisam do Windows. Use a Área de Trabalho Remota."); r.actions.push("remote"); return r; }
  if (["deb", "rpm", "appimage"].includes(ext)) { Object.assign(r, { type: "linuxpkg", label: "Pacote Linux " + ext.toUpperCase() }); r.how.push("Pacotes de distribuições x86-64 não rodam no Linux i686 mínimo da VM. Use uma ISO de distribuição 32 bits na Máquina x86 ou um PC remoto."); return r; }
  r.how.push("Tipo não executável. Você pode abrir com o Bloco de Notas ou guardá-lo nos seus arquivos.");
  return r;
}
