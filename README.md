# Virtual PC — um computador completo dentro do celular

Virtual PC é um aplicativo (PWA + APK Android) para criar, configurar e usar
computadores virtuais no celular: desktop moderno com janelas, menu Iniciar,
barra de tarefas, explorador de arquivos, terminal, navegador, loja de apps,
jogos, gerenciador de tarefas — controlado por um **analógico de mouse e um
teclado na tela**, ou por teclado/mouse Bluetooth/USB.

Ele executa **de verdade**:

| Ambiente | Tecnologia | O que roda |
|---|---|---|
| **VirtualOS** (o desktop) | HTML5 + JavaScript + WebAssembly no motor do celular | Explorador, Bloco de Notas, Terminal, Navegador, Fotos, Player, Calculadora, Pintura, jogos da Central de Apps, apps/jogos web importados (.html/.zip) |
| **Máquina Virtual x86** | [v86](https://github.com/copy/v86) (emulador x86 completo em WebAssembly) | Linux i686 incluído, Memtest86+, VPC Boot Monitor e qualquer **.iso/.img 32 bits** importada (FreeDOS, KolibriOS, Alpine x86, ReactOS, Windows 9x com licença própria…) |
| **Área de Trabalho Remota** | Cliente VNC [noVNC](https://github.com/novnc/noVNC) via WebSocket | Qualquer programa ou jogo Windows/Linux/macOS rodando num PC real |

> **Honestidade técnica.** O Android não executa programas Windows (`.exe`)
> e emular um PC x86‑64 com Windows moderno e DirectX num celular não tem
> desempenho utilizável. Por isso o Virtual PC **não finge** rodar jogos de
> Windows: o analisador de compatibilidade lê o cabeçalho do arquivo (PE/MZ/ELF/ISO/ZIP…),
> diz exatamente o que ele é e oferece a alternativa real (Máquina x86 para
> sistemas 32 bits, PC Remoto para jogos Windows).

## O que é real e o que é simulado

Mostrado também no assistente de criação, no POST de inicialização e em Configurações › Sistema.

| Componente | Natureza | Como funciona |
|---|---|---|
| Processador (modelo/clock) | Simulado | Rótulo de desempenho usado nos requisitos. O processamento é feito pelos núcleos reais do celular; a VM x86 mostra a velocidade real medida em **MIPS**. |
| Memória RAM | Misto | Limite **simulado** para os apps do desktop (o Gerenciador de Tarefas bloqueia abrir programas além dele). A VM x86 **aloca RAM real** (até um teto seguro calculado pela RAM do aparelho). |
| Armazenamento | Real | Arquivos gravados de verdade no aparelho (IndexedDB). A capacidade escolhida é o limite máximo; a cota real do aparelho também é verificada. |
| Placa de vídeo | Simulado | Nível usado para requisitos e qualidade gráfica dos jogos. A renderização usa a GPU real (canvas/WebGL). |
| Resolução | Real | O desktop é renderizado na resolução escolhida e escalado para a tela. |
| FPS, carga da CPU, heap JS, bateria | Real | Medidos em tempo real (requestAnimationFrame, event loop, `performance.memory`, Battery API). |
| Temperatura | Real (APK) | Navegadores não expõem temperatura; no APK, um plugin nativo lê a temperatura da bateria e a RAM total/livre. |

## Funcionalidades

- **Vários PCs**: criar (básico, intermediário, gamer, profissional, personalizado), duplicar, excluir, **alterar o hardware sem recriar** (Configurações › Hardware ou "Configurar" na lista).
- **Inicialização**: botão **LIGAR MEU PC**, tela de POST/BIOS com o hardware virtual e o real, splash, boas‑vindas. **Desligar, reiniciar e suspender** (a suspensão salva as janelas abertas e um *snapshot real* do estado da VM x86).
- **Desktop**: papel de parede (6 temas + imagem própria), ícones, menu Iniciar com busca (apps, arquivos e configurações), barra de tarefas com apps fixados/abertos, relógio/calendário, central de notificações, configurações rápidas (internet, modo avião, não perturbe, FPS, tela cheia, travar paisagem, volume, brilho), menus de contexto, atalhos (Win, Alt+Tab, Alt+F4, Win+D, Win+E, Ctrl+Shift+Esc, F11).
- **Janelas**: mover, redimensionar pelas bordas, maximizar/restaurar (duplo clique ou arrastar ao topo), minimizar, foco/z-order, animações, transparência.
- **Tela**: tela cheia, sair da tela cheia, rotação automática (retrato e paisagem), travar paisagem, resolução, zoom da interface, tamanho dos ícones.
- **Mouse virtual**: analógico circular com movimento suave e aceleração, **L**, **R**, **2×** (clique duplo), **arrastar e soltar** (segurar L ou travar com ✋), **rolagem** (faixa ↕), sensibilidade/tamanho/opacidade, modo canhoto, vibração. Em jogos o analógico vira **setas** com botões **A/B** automaticamente.
- **Teclado virtual**: completo com Esc, F1–F12, Ctrl, Alt, Shift, Win, Tab, Enter, Caps, setas, ç e faixa de atalhos (Ctrl+C/V/X/Z/A/S, Alt+Tab, Alt+F4, Win+D, Win+E, Ctrl+Shift+Esc, Ctrl+Alt+Del).
- **Teclado/mouse físicos e gamepad**: funcionam direto (Bluetooth/USB‑OTG); na VM o mouse é capturado (Pointer Lock).
- **Arquivos**: Explorador com pastas do sistema, criar/renomear/copiar/recortar/colar/excluir, Lixeira (restaurar/esvaziar), arrastar para pastas, propriedades, uso de disco, **importar do celular** e **salvar no celular**; Terminal com `ls, cd, cat, echo >, cp, mv, rm, find, tree, df, free, ps, kill, wget, neofetch…`.
- **Central de Apps**: catálogo com checagem de requisitos (compatível / desempenho reduzido / incompatível), instalar/desinstalar, programas instalados e espaço ocupado, **instalar de arquivo** (do celular ou do PC) com análise de compatibilidade; apps web `.zip`/`.html` são extraídos em `/Programas` e servidos por um servidor interno (service worker).
- **Downloads**: gerenciador com progresso, velocidade, cancelar e tentar de novo (downloads HTTP reais; sites que bloqueiam CORS são explicados).
- **Desempenho**: Gerenciador de Tarefas com processos (finalizar tarefa), gráficos de FPS, CPU, memória, heap, disco e MIPS da VM; painel de FPS sobreposto.
- **Rede**: status real, tipo de conexão, modo avião do PC, rede da VM (HTTP via fetch ou relay WebSocket).
- **Jogos incluídos** (originais): *Astro Blaster* (nave/tiro), *Turbo Lane* (corrida), *Reversi* (tabuleiro com IA).

## Arquitetura

```
┌──────────────────────────── Android (APK Capacitor) ou navegador (PWA) ───────────────────────────┐
│  WebView / Chromium                                                                                 │
│  ┌───────────────┐  ┌──────────────────────── Shell VirtualOS (js/ui/desktop.js) ───────────────┐  │
│  │ Launcher      │  │ Window manager · taskbar · menu Iniciar · notificações · processos/RAM   │  │
│  │ criar/editar  │→ │ InputLayer: analógico, botões, teclado virtual, gamepad → eventos DOM     │  │
│  │ PCs · boot    │  │ Apps (js/apps/*) · jogos (js/games/*)                                      │  │
│  └───────────────┘  │   ├─ Máquina x86 ── v86 (WASM): CPU i686, VGA, PS/2, IDE, NE2000, 9p ─────┤  │
│                     │   ├─ PC Remoto ──── noVNC (RFB sobre WebSocket) → PC real                 │  │
│                     │   └─ Apps web ───── iframe servido pelo service worker (vfs/<pc>/<path>)  │  │
│                     └───────────────────────────────────────────────────────────────────────────┘  │
│  Armazenamento: IndexedDB (perfis dos PCs, sistema de arquivos virtual, snapshots da VM)            │
│  Plugin nativo (APK): temperatura da bateria, RAM real, salvar em Downloads                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Escolhas e motivos:

- **Web + WebAssembly empacotado com Capacitor**: um único código roda no Android (APK), como PWA instalável e no PC. O WebView do Android usa a GPU real e executa WebAssembly com JIT, o que dá ao v86 dezenas a centenas de MIPS.
- **v86** em vez de QEMU: é o emulador x86 maduro que roda dentro do WebView sem root e sem binários nativos por arquitetura. Limite: CPU de 32 bits (i686), sem aceleração 3D.
- **Sem dependências de build**: ES modules puros, sem bundler. `www/` é o app.

### Estrutura de pastas

```
www/                      app (servido como está)
  index.html, sw.js, manifest.webmanifest
  css/                    base, launcher, desktop, apps, input
  js/main.js              roteamento launcher → boot → desktop
  js/core/                db (IndexedDB), vfs (sistema de arquivos), pcs (perfis/hardware),
                          metrics, compat (analisador de arquivos), zip, scancodes, util, bus
  js/ui/                  launcher, boot, desktop (shell), wm (janelas), input (controles), icons, wallpapers
  js/apps/                explorer, editor, terminal, browser, settings, taskmgr, store, downloads,
                          recycle, calc, media, paint, x86vm, remote, webapp, registry
  js/games/               engine, astro, lane, reversi
  vendor/v86/             libv86.mjs, v86.wasm, seabios.bin, vgabios.bin (BSD-2 / LGPL)
  vendor/novnc/           cliente VNC (MPL-2.0)
  images/                 vpc-linux.bzImage, memtest86plus.bin, vpcboot.img
android/                  projeto nativo Capacitor (MainActivity, DeviceSensorsPlugin)
os/vpcboot/               código-fonte assembly do VPC Boot Monitor
os/linux/                 init, config do kernel e script para recompilar o Linux incluído
os/licenses/              licenças de terceiros (BusyBox, Memtest86+)
scripts/                  serve.mjs (servidor local), make-icons.mjs
tests/                    v86-boot, v86-linux (Node) e e2e (Chromium/Playwright)
.github/workflows/        CI: testes + build do APK
```

## Como instalar e executar

### 1. No navegador (PC ou celular) — mais rápido

Requisitos: Node.js 18+.

```bash
npm start            # http://localhost:8080
```

No celular, na mesma rede Wi‑Fi, abra o endereço exibido (`http://IP-DO-PC:8080`).
Para instalar como app (PWA, tela cheia, offline) o Chrome exige HTTPS: publique
a pasta `www/` em qualquer hospedagem estática com HTTPS (GitHub Pages, Netlify,
Cloudflare Pages…) e use **Menu ⋮ › Instalar app**.

### 2. APK Android

**Pelo GitHub (sem instalar nada):** cada push executa o workflow
`.github/workflows/android.yml`; baixe o artefato **virtual-pc-debug-apk** na
aba *Actions*, copie para o celular e instale (permita "fontes desconhecidas").

**Localmente** (Android Studio ou SDK + JDK 21):

```bash
npm install
npm run android:build     # gera android/app/build/outputs/apk/debug/app-debug.apk
# ou: npx cap open android  (abre no Android Studio)
```

Requisitos do aparelho: Android 6+ (Android 10+ recomendado), WebView/Chrome atualizado, 3 GB+ de RAM para a VM x86.

## Como usar

1. **Criar novo PC** → escolha o tipo → ajuste processador, RAM, armazenamento, placa de vídeo → sistema e resolução → veja o resumo real/simulado → **Criar PC**.
2. **LIGAR MEU PC**. Toque na tela de POST para pular.
3. **Mouse**: arraste o analógico (canto inferior esquerdo) para mover o cursor; **L** clica, **R** abre menus, **2×** abre ícones, segure **L** e mova o analógico para arrastar janelas (ou trave com ✋), a faixa **↕** rola. Também é possível tocar direto na tela.
4. **Teclado**: botão de controles (na borda esquerda) → ⌨. Esse botão também alterna o modo do analógico (mouse/setas), oculta os controles e ativa tela cheia.
5. **Jogos**: Central de Apps → Instalar → abra pelo ícone. Para jogos web próprios: Central de Apps › Instalar de arquivo (.zip com `index.html` ou .html).
6. **Linux de verdade**: Máquina x86 › VPC Linux › Ligar. Seus arquivos aparecem em `/mnt/host`; use **Copiar arquivos da VM** para trazer o que criar lá para `/Documentos/Da VM`. Toque na tela da VM para enviar o teclado; com mouse físico clique para capturar (**Ctrl+Alt+G** libera).
7. **Outros sistemas**: importe uma `.iso`/`.img` 32 bits do celular na Máquina x86. Exemplos que funcionam no v86: FreeDOS, KolibriOS, Alpine Linux x86, Tiny Core, ReactOS, Windows 95/98 (com sua licença).
8. **Jogos Windows**: Área de Trabalho Remota. No PC: servidor VNC (TightVNC/UltraVNC/TigerVNC) + `websockify 6080 localhost:5900`; no Virtual PC: `ws://IP-DO-PC:6080` (rede local) ou `wss://…` (internet, via VPN/proxy HTTPS).
9. **Suspender** (menu Iniciar › energia): salva tudo, inclusive o estado da VM; ao religar, continua de onde parou.

## Testes

```bash
npm test                    # tudo
node tests/v86-boot.test.mjs   # boota o VPC Boot Monitor no v86 e executa o comando MEM
node tests/v86-linux.test.mjs  # boota o Linux, usa o shell e a pasta compartilhada 9p
node tests/e2e.test.mjs        # Chromium: cria PC, boot, mouse/teclado virtuais, arquivos,
                               # terminal, RAM virtual, loja, jogo, app .zip, VM x86 e Linux,
                               # suspender/retomar, retrato, resolução, desligar
```

O e2e precisa do Playwright (`npm install --no-save playwright && npx playwright install chromium`).
Capturas de tela ficam em `tests/screenshots/`.

## Limitações conhecidas

- A CPU emulada é **i686 (32 bits)**; sistemas 64 bits e jogos 3D não rodam na Máquina x86.
- Sites externos dentro do Navegador: muitos bloqueiam ser exibidos em outro app (X‑Frame‑Options) e o mouse virtual não consegue clicar dentro de páginas de outros domínios (toque direto funciona). Use "Abrir no navegador do celular".
- Downloads diretos dependem de o servidor permitir CORS; caso contrário baixe pelo navegador do celular e use **Importar**.
- Temperatura e RAM total exata só estão disponíveis no APK.

## Licenças

Terceiros incluídos: v86 (BSD‑2‑Clause), SeaBIOS/VGABIOS (LGPL‑3.0),
noVNC (MPL‑2.0) e pako (MIT/Zlib), Linux (GPL‑2.0), BusyBox (GPL‑2.0), Memtest86+ (GPL‑2.0) — veja `os/licenses/`,
`www/vendor/*/LICENSE*` e `os/linux/README.md` (fontes correspondentes).
