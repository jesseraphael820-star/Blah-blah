# Shadows of the Kingdom

RPG 2D de mundo aberto, visão de cima, em pixel art — **A Irmandade de Várden**.

Feito em JavaScript puro + Canvas 2D, sem motor externo. Toda a arte (tiles, árvores, construções,
personagens, animais, cavalos, retratos com expressões) e todo o áudio (música por região, efeitos,
ambiência, “vozes” de diálogo) são **gerados proceduralmente em código** — nenhuma imagem ou som de terceiros.

## Como jogar

```bash
npm start            # abre em http://localhost:8080
```
(ES modules exigem `http://`; abrir o `index.html` direto do disco não funciona.)

| Ação | Teclado | Controle |
|---|---|---|
| Mover / correr | WASD ou setas / Shift | analógico / RT |
| Atacar (combos de 3 golpes) | J ou clique | X |
| Bloquear (aparar no último instante) | K ou botão direito | LB |
| Rolar (invulnerável no início) | Espaço | B |
| Interagir / conversar | E | A |
| Montar / assobiar para o cavalo | F / H | Y |
| Alternar arco · poção rápida | R · Q | — · RB |
| Inventário · mapa · missões · mapa político · menu | I · M · L · P · Esc/Tab | Back · Start |

Todos os controles podem ser remapeados em **Configurações → Controles**.

## Conteúdo

- **Mundo aberto 300×220 tiles** com 8 regiões de identidade visual própria: Floresta de Eldoria,
  Planícies de Várden, Montanhas de Ferro, Pântano Esquecido, Vale das Cinzas, Costa dos Mercadores,
  Terras do Norte e Ruínas Antigas. Rios, lagos, pontes, estradas, cavernas, minas e uma tumba com quebra-cabeça.
- **7 vilas/facções** com cor, bandeira, emblema, líder, exército, economia, recursos, cultura, história e
  relações diplomáticas: Várden (roxo), Eldoria (verde), Drakmor (vermelho), Solária (amarelo),
  Frostheim (azul), Cinzamar (cinza) e Ravencross (preto). Construções exploráveis por dentro.
- **Guerras territoriais**: 46 territórios distribuídos de forma desigual, com importância (1–3★), recursos,
  dono original e regiões disputadas. Mapa político com fronteiras, áreas neutras hachuradas e áreas disputadas
  animadas. Postos com guarnição podem ser capturados; a história e uma simulação diária movem as fronteiras
  e afetam a economia (renda, tesouro, preços).
- **Combate**: espadas, espadas longas, adagas, machados, lanças, arcos e escudos (18 armas + 4 escudos),
  combos, esquiva com invulnerabilidade, bloqueio, aparar (parry), golpes telegrafados, críticos, estamina,
  repulsão, chefes com fases e melhorias de armas até +5 no ferreiro.
- **Animais**: cavalos (8 pelagens, montaria, estábulo, cavalos selvagens domáveis e uma égua lendária),
  lobos em matilha, ursos, cervos, coelhos, raposas, javalis, cabras, crocodilos, aranhas, morcegos,
  pássaros, peixes e animais domésticos — cada um com comportamento próprio.
- **História**: 25 missões principais em 5 capítulos (Uma Vida Tranquila → Segredos da Floresta → O Início da
  Guerra → A Traição → A Reconstrução), três finais (União, Conquista, Sacrifício Político), epílogo com o mapa
  resultante, créditos e cena pós-créditos.
- **22 missões secundárias** e eventos aleatórios (emboscadas, matilhas, viajante ferido, mercador ambulante,
  caravana atacada, desertor, chuva de meteoros).
- **Diálogos** com retratos animados: a boca se move conforme as vogais, piscadas, 8 expressões
  (neutra, feliz, triste, raiva, medo, surpresa, sarcástica, cansada) e “voz” sintetizada própria de cada personagem.
- **Sistemas**: ciclo dia/noite, iluminação dinâmica, clima regional (chuva, tempestade com relâmpagos,
  neblina, neve, cinzas, folhas), NPCs com rotinas dia/noite, reputação, comércio, coleta (ervas, minério,
  madeira, cogumelos, gemas), pesca, baús secretos, viagem rápida, conquistas (24),
  salvamento automático + 3 espaços manuais.
- **14 idiomas** trocáveis a qualquer momento, inclusive árabe com interface da direita para a esquerda.

### Sobre as traduções
Interface, menus, configurações, itens, títulos de missões, objetivos, regiões, facções, conquistas e
notificações estão traduzidos nos 14 idiomas. **Diálogos, falas de NPCs, descrições longas, nomes de lugares
específicos de objetivos e textos de epílogo existem em português e inglês**; nos outros 12 idiomas eles usam o
inglês como reserva. O formato já está pronto para receber os demais: basta registrar
`registerDialogue('<código>', { idDoDiálogo: [linha, linha, [opções]...] })`.

## Estrutura

```
index.html, style.css, server.js
src/
  main.js            laço principal e integração dos sistemas
  render.js          renderização da cena (profundidade, luz, clima)
  state.js           estado global
  core/              util, entrada, áudio procedural, i18n, eventos
  gfx/               tiles, objetos, personagens, animais, retratos, ícones, efeitos
  world/             mapa (chunks + colisão), geração do mundo, interiores e masmorras
  entities/          ator (jogador/NPC/inimigo), jogador, criaturas/cavalos/projéteis
  systems/           missões, diálogos, cenas, ações, mundo, guerra, tempo, interação, inventário, conquistas, save
  ui/                HUD, diálogo, menus, telas, mapas
  data/              mundo, facções, NPCs, itens, inimigos, missões, diálogos, cenas, falas
  i18n/              14 idiomas
tests/
  data.test.js       integridade de dados (referências, marcadores, traduções)
  play.mjs           jogada automatizada das 47 missões no navegador (Playwright)
  smoke.mjs          carregamento + capturas de tela
```

## Testes

```bash
node tests/data.test.js     # integridade de dados
node tests/play.mjs <pasta-de-capturas> [0|1|2]   # campanha completa automatizada (final 0=União,1=Conquista,2=Sacrifício)
```
