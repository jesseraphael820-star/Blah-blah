# Wild Lands — RPG 3D de mundo aberto (voxel / pixel art)

Jogo 3D jogável no navegador, feito com Three.js (incluído em `lib/`, sem build).

## Como jogar
Sirva a pasta com qualquer servidor estático e abra `index.html`:
```
python3 -m http.server 8080
# abra http://localhost:8080
```
Controles: WASD mover · Shift correr · Espaço pular/nadar · Clique atacar (combo de 3) · Botão direito defender (no tempo certo apara) · Ctrl/C esquivar · E interagir · 1-4 poderes · Q poção · R travar alvo · I inventário · J diário · M mapa · K personagem · P poderes · O espadas · Esc menu. Celular: joystick e botões na tela.

## Conteúdo
- Mundo 640×640 com vila, fazenda, floresta, lago, rio, cascata (com câmara secreta), montanhas, ruínas, torre, mirante, acampamento e caverna-masmorra.
- Ciclo dia/noite, chuva, neblina, tempestade com raios, vento na grama/árvores, água com ondas/espuma, fumaça, luzes noturnas.
- 6 missões principais com 4 chefes + 10 secundárias, diário, desafios diários, recompensa diária, eventos (meteoros, mercador, slime dourado, ataque noturno).
- 13 espadas (comum → mágica), 7 poderes evoluíveis, armaduras, skins, chapéus, acessórios, mascotes.
- NPCs com rotinas, diálogos com legenda, boca animada e expressões; lojas, reputação, conquistas, títulos, placar, viagem rápida, salvamento automático.
- Idiomas: PT-BR, EN, ES (detecção automática + troca nas configurações). Áudio e música 100% procedurais.

## Estrutura
`src/core` (input, áudio, save, i18n) · `src/world` (terreno, estruturas, água, céu, clima, caverna, física) · `src/entities` (jogador, NPCs, inimigos, animais) · `src/systems` (combate, poderes, missões, diálogo, progressão...) · `src/ui` (HUD, menus, loja, mapa) · `src/data` (itens, inimigos, missões, NPCs, mundo) · `src/lang`.
