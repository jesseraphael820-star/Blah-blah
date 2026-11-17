# 🚗 Porto Brasa — mundo aberto top-down

Jogo 2D de ação em mundo aberto com visão de cima, inspirado nas mecânicas dos clássicos
de ação top-down dos anos 90 — com **cidade, personagens, veículos, missões e visual 100% originais**.
Feito em HTML5 Canvas + JavaScript puro (ES modules), **sem dependências e sem build**.
Roda em navegadores de **Android** e **computador**, e pode ser instalado como app (PWA, funciona offline).

## ▶ Como executar

É preciso servir os arquivos por HTTP (módulos ES não carregam via `file://`).

```bash
node server.mjs          # ou: npm start   → http://localhost:8080
# alternativa: python3 -m http.server 8080
```

**No celular Android:** rode o servidor no computador e abra no Chrome do celular o endereço
`http://IP-DO-COMPUTADOR:8080` exibido no terminal (mesma rede Wi‑Fi). Gire para a horizontal.
Para instalar como app/jogar offline, hospede em HTTPS (ex.: GitHub Pages) e use
“Adicionar à tela inicial”.

## 🎮 Controles

| Ação | Teclado | Touch (celular) |
|---|---|---|
| Andar (8 direções) / esterçar | WASD ou setas | Joystick — toque em qualquer ponto da metade esquerda |
| Acelerar / frear e ré | W / S | ACELERAR / FREAR (aparecem no carro) |
| Correr | Shift | CORRER (segurar) |
| Entrar / sair do veículo | F ou Enter | ENTRAR / SAIR (aparece perto de um veículo) |
| Soco / freio de mão | Espaço | AÇÃO |
| Interagir (missão, garagem, pintura) | E | AÇÃO vira **USAR** quando há interação |
| Buzina | H | BUZINA |
| Mapa / Pausa | M / Esc ou P | botões MAPA e ❚❚ |

## 🏙 O que tem no jogo

- **Cidade de Porto Brasa** (168×168 tiles, totalmente conectada): Centro Comercial, Jardim Aurora
  (residencial), Distrito Fabril, Porto Velho (píeres, navio, farol), Vila das Oficinas, Mercado Novo e a Orla.
  Prédios, casas com piscina, semáforos, faixas de pedestre, calçadas, postes, árvores, estacionamentos e lojas.
- **4 personagens** com vantagens diferentes; animação de caminhada/corrida; vida e dinheiro.
- **16 veículos originais** (populares, sedãs, esportivos, muscle, táxi, caminhonete, utilitário, van, caminhões,
  ambulância, viaturas) com física arcade, derrapagem, marcas de pneu, danos visuais, fumaça, incêndio e explosão,
  som de motor sintetizado.
- **Trânsito com IA**: segue faixas, respeita semáforos, para para pedestres e carros, buzina e desvia de obstáculos.
- **Pedestres com IA**: rotas variadas, atravessam na faixa com o sinal fechado, desviam de carros, fogem de perigo.
- **Polícia com 5 estrelas**: detecta infrações (roubo de carro, agressão, atropelamento, colisão com viatura,
  excesso de velocidade), persegue com viaturas e policiais a pé (pathfinding pela malha da cidade), vai à última
  posição conhecida e procura nas ruas, faz bloqueios em nível alto e desiste se perder você de vista.
- **18 missões** (8 de campanha com começo, meio e final + 10 paralelas): corridas, entregas, transporte de
  passageiros, exploração, desafios de direção e recuperação de veículos — cada uma com briefing, marcador no mapa,
  objetivo, recompensa, condições de falha (tempo, danos, procurado, veículo destruído…) e telas de conclusão/falha.
- **Progressão**: economia, desbloqueio de missões, garagem com 4 vagas, concessionária com carros desbloqueados
  pela história, Pintura Rápida (conserta e apaga as estrelas), hospital/fiança, salvamento automático e estatísticas.
- **Ciclo de dia e noite** (1 min real = 1 h no jogo) com iluminação dos postes, faróis e sirenes.
- **Interface**: minimapa, dinheiro, vida, estrelas, missão atual e cronômetro, velocímetro, pausa com mapa,
  lista de missões, estatísticas, configurações (volume, qualidade, trânsito, zoom, tamanho/opacidade dos botões,
  vibração, FPS) e controles.

## 🗂 Estrutura

```
index.html  styles.css  manifest.webmanifest  sw.js  server.mjs
src/
  main.js            ponto de entrada
  game.js            laço principal, jogador, física, interações, economia, render da cena
  core/              matemática, entrada (teclado+touch), áudio WebAudio, câmera, salvamento
  world/             constantes, geração da cidade, renderização em chunks, campo de fluxo (pathfinding)
  entities/          veículos (modelos, sprites, física) e humanos
  ai/                trânsito, pedestres, polícia/procurado
  systems/           missões (dados + motor), dia/noite, partículas
  ui/                HUD + minimapa, menus/telas, controles touch
tests/
  smoke.mjs          teste geral (andar, dirigir, IA, polícia, missão, noite, mapa, salvamento)
  missions.mjs       executa as 18 missões etapa por etapa
```

## ✅ Testes

Requer Playwright (`npm i -D playwright && npx playwright install chromium`):

```bash
npm test                  # teste de fumaça
node tests/missions.mjs   # todas as missões
```

Para testar manualmente, o objeto `window.game` fica exposto no console
(ex.: `game.police.setLevel(3)`, `game.money += 10000`, `game.time.total = 14*60` para anoitecer).
