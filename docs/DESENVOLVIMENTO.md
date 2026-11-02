# Guia de desenvolvimento — Porto Sol

Este documento explica como o jogo é organizado e como acrescentar conteúdo novo.

## Rodando localmente

```bash
python3 -m http.server 8000   # na raiz do repositório
# abra http://localhost:8000
```

Não há etapa de build: os arquivos em `src/` são ES modules carregados direto pelo navegador, e o Three.js (r160, MIT) está em `vendor/three/`.

## Arquitetura

O `Game` (`src/main.js`) é o centro. Ele cria todos os sistemas e roda o laço principal em `loop()`, nesta ordem:

1. **Entrada** (`Input`): teclado, mouse e pointer lock.
2. **Jogador** (`Player.update`): movimento, combate e direção.
3. **Veículos** (`updateCars`): IA, física, colisão carro×carro e carro×pedestre.
4. **NPCs** (`NPC.update`): máquina de estados de cada um.
5. **Polícia** (`updatePolice`): nível de procurado, viaturas e linha de visão.
6. **População** (`managePopulation`, a cada 0,5 s): cria e remove pedestres e carros perto do jogador.
7. **Missões, locais e conversas**: `Missions.update`, `Places.update`, `ambientChat`.
8. **Voz e efeitos**: `Voice.update` (boca) e `FX.update` (partículas).
9. **Câmera, mundo, HUD e áudio**: depois vem a renderização com pós-processamento (bloom, correção de cor, vinheta).

| Arquivo | Responsabilidade |
|---|---|
| `world.js` | Gera a cidade (grade 8×8 de quarteirões), céu, sol, ciclo dia/noite, **clima** e consultas de colisão (`collideCircle`, `pointInBuilding`, `lineBlocked`, `groundHeight`). |
| `textures.js` | Texturas procedurais em canvas. |
| `human.js` | Personagem articulado, poses (andar, correr, agachar, nadar, mirar, sentar, morrer), **expressões faciais** (`setEmotion`), olhar e boca (`setMouth`). |
| `voice.js` | Fala com a Web Speech API e sincronia labial por visemas. |
| `vehicle.js` | Modelos de carro, física arcade, `TrafficAI` (faixas e cruzamentos) e `ChaseAI` (perseguição). |
| `npc.js` | Pedestres, policiais, gangue, personagens da história e reações a diálogo (`react`). |
| `player.js` | Protagonista, roupas (`setLook`) e estatísticas. |
| `missions.js` | Missões e roteiro. |
| `places.js` | Lojas, lanchonete, academia, apartamento e oficina de pintura. |
| `hud.js` | HUD, minimapa, mapa completo, escolhas de diálogo, estatísticas e painel de depuração. |
| `fx.js` | Partículas, explosões e marcadores. |
| `audio.js` | Áudio sintetizado: motor, sirene, chuva, impactos e rádio. |

## Como criar uma missão

Cada missão é um objeto no array `DEFS` em `src/missions.js`:

```js
{
  id: 'minha', title: 'Minha Missão', giver: B,              // B = Bento, D = Duda
  intro: [[B, 'Fala do Bento', 'worried'], [L, 'Resposta do Léo', 'confident']],
  start(m) { m.stage = 0; m.setTarget(posicao, 0xffd23a, 4); },
  update(m, dt) {
    m.objective('Vá até o marcador.');
    if (m.near(posicao, 4)) return 'done';                   // ou 'fail:motivo'
  },
  outro: [[B, 'Muito bem!', 'happy']],
  reward: 1000,
}
```

- O terceiro item de cada fala é a **emoção** do rosto: `neutral`, `happy`, `angry`, `sad`, `surprised`, `worried` ou `confident`.
- Em `outro: (m) => [...]` a cena pode ter **escolhas**: um item `{ choice: [...], branches: [[...], [...]], onPick(i) {...} }`. A escolha fica salva em `game.flags`, e as missões seguintes podem ler esse valor (veja *Asas Cortadas* e *Calor Total*).
- Ferramentas disponíveis em `m`: `objective`, `near`, `setTarget`, `clearTarget`, `blipOnly`, `blips` e `g` (o jogo inteiro).

## Como criar um local (loja ou atividade)

1. Em `world.js`, dentro de `genBlock`, construa o prédio e guarde a entrada em `this.loc.<chave>`.
2. Em `places.js`, adicione uma entrada em `spots` e as opções em `options()`. Cada opção é `{ label, price, run() }`.

## Ferramentas de depuração

Aperte **F2** durante o jogo para abrir o painel, que mostra FPS, draw calls, triângulos, posição, hora, clima, quantidade de NPCs e carros, nível de procurado e missão. Com o painel aberto:

| Tecla | Ação |
|---|---|
| PgUp / PgDn | avança / volta 1 hora |
| Home | próximo clima (limpo → nublado → chuva → neblina) |
| End | +$1000 |
| Insert | liga/desliga invencibilidade |
| Delete | +1 estrela de procurado |

No console do navegador, `game` dá acesso a tudo. Exemplos: `game.world.setWeather('rain')`, `game.player.pos.set(x, y, z)`, `game.missions.index = 2; game.missions.setupStart()`.

## Salvamento

O jogo salva sozinho ao ganhar ou gastar dinheiro e ao concluir missões. O salvamento manual fica no apartamento (depois de comprado) e no menu de pausa. Os dados vão para o `localStorage`, na chave `portosol_save_v1`: missão atual, dinheiro, armas, roupas, estatísticas e escolhas da história.

## Lip sync: estado atual e caminhos de evolução

Hoje a boca é guiada pelo **texto**. Cada letra vira um visema (abertura e largura da boca), e a linha do tempo se ressincroniza a cada evento `onboundary` (palavra) da Web Speech API. Isso funciona offline, sem dependências, com qualquer voz do sistema.

Ferramentas de código aberto que podem servir de próximo passo. **Confira a licença e o funcionamento de cada uma antes de integrar:**

- **Rhubarb Lip Sync** (`DanielSWolf/rhubarb-lip-sync`): extrai visemas de um arquivo de áudio. É um programa de linha de comando, então serviria num pipeline de dublagem pré-gravada.
- **TalkingHead** (`met4citizen/TalkingHead`): avatares 3D com lip sync no navegador.

Uma dublagem com atores ou com TTS pré-gerado daria vozes melhores que as do sistema operacional. Os visemas sairiam do áudio (via Rhubarb) e seriam aplicados por `Human.setMouth`.

## O que ainda não existe (próximas etapas sugeridas)

Pela regra "qualidade acima de quantidade", a região atual foi construída primeiro. Ainda faltam, em ordem sugerida:

1. Motos e bicicletas (física de duas rodas, inclinação nas curvas).
2. Ônibus e caminhões (o sistema de `Car` já aceita novos perfis em `PROFILES` e `CAR_TYPES`).
3. Personalização de veículos (rodas e melhorias mecânicas; a pintura já existe).
4. Interiores exploráveis (hoje as lojas abrem um menu).
5. Novas regiões: favela no morro, rodovia, posto de gasolina, área rural com floresta e aeroporto.
6. Barcos, helicópteros e aviões.
7. Escalada de muros e cercas.
8. Rotinas de NPC por horário (trabalho e casa) e mais tipos de reação.
9. Inventário completo e mais armas.
10. Modelos 3D e animações capturadas (glTF) no lugar das formas procedurais.
