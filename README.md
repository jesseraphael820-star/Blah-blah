# Strike Ops Mobile X

FPS tático 5v5 para celular (Android / navegador), feito em WebGL com Three.js. Sem build: é só servir a pasta.
Todo o conteúdo (mapas, modelos, skins, sons) é original e gerado por código — nenhum asset de outros jogos.

## Como jogar

```bash
python3 -m http.server 8080     # ou qualquer servidor estático
# abra http://<ip-do-pc>:8080 no Chrome do Android (modo paisagem)
```

Em HTTPS (ex.: GitHub Pages) o jogo pode ser instalado como app pelo menu do Chrome → "Adicionar à tela inicial" e funciona offline.

## O que tem

- **Lobby 3D** com personagem, nickname, nível/XP, moedas e indicador de conexão.
- **Modos**: Competitivo (bomba, primeiro a 7, troca de lado, patente), Casual e Treinamento.
- **Bots com IA**: visão/audição, patrulha, cobertura, plantar/desarmar, avisos entre aliados, 4 dificuldades.
- **Controles touch**: joystick, câmera, atirar, mirar, recarregar, pular, agachar, andar, trocar arma, granada, interagir —
  posição/tamanho editáveis, sensibilidade, layouts e giroscópio. No PC: WASD + mouse.
- **14 armas**, 6 facas + faca padrão, 5 granadas (explosiva, fumaça, flash, incendiária, distração).
- **Economia por round** e menu de compra (armas, granadas, colete, capacete, kit de desarme).
- **Loja, caixas, mercado e inventário** com inspeção 3D, raridades e equipar/desequipar.
- **5 mapas**: Fundição, Bastião, Duna, Cais 9, Distrito.
- **Gráficos** Baixo / Médio / Alto / Ultra. **Progresso salvo** no aparelho (localStorage).

## Estrutura

| Arquivo | Função |
|---|---|
| `js/main.js` | renderer, lobby 3D, inspeção, loop |
| `js/game.js` | partida: jogador, tiro, rounds, bomba, economia |
| `js/bots.js` | inteligência artificial |
| `js/maps.js` | mapas, colisão, raycast, navegação A* |
| `js/controls.js` | touch, teclado/mouse, giroscópio, editor de HUD |
| `js/hud.js` / `js/ui.js` | HUD da partida / menus |
| `js/models.js` / `js/textures.js` / `js/fx.js` / `js/audio.js` | modelos, texturas, efeitos e sons procedurais |
| `js/data.js` / `js/save.js` | dados de balanceamento / persistência |

## Testes

```bash
node tools/test-maps.mjs   # todos os mapas navegáveis (spawns -> bombsites)
node tools/test-los.mjs    # sem linha de visão entre spawns
```
