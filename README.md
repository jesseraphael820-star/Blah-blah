# PORTO SOL

Jogo de mundo aberto de ação em 3D para o navegador, ambientado na cidade fictícia de **Porto Sol**, à beira-mar. É uma obra original do gênero "crime urbano em mundo aberto": tem história, personagens, cidade e código próprios.

Tudo é gerado por código: cidade, texturas, personagens, carros, efeitos e som. Não há arquivos de modelo, imagem ou áudio externos.

## Como jogar

O jogo usa ES modules, por isso precisa de um servidor HTTP (abrir o arquivo direto do disco não funciona):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Também funciona no GitHub Pages: basta publicar a raiz do repositório.

Requisitos: navegador com WebGL2 (Chrome, Edge ou Firefox atuais), teclado e mouse. Uma placa de vídeo dedicada ajuda no modo **Ultra**.

### Controles

| Tecla | Ação |
|---|---|
| W A S D | andar / dirigir |
| Shift | correr |
| Alt | andar devagar |
| C | agachar (a polícia te vê de mais perto) |
| T / G | conversar / provocar quem está perto |
| E | entrar em lojas e locais |
| M | mapa completo da cidade |
| 1, 2… | escolher opções em diálogos e lojas |
| F2 | painel de depuração |
| Espaço | pular / freio de mão (drift) |
| F | entrar no carro, roubar (tira o motorista) ou sair |
| Mouse | câmera |
| Clique | soco / atirar |
| Botão direito | mirar (câmera sobre o ombro) |
| Q | trocar entre punhos e pistola |
| H | buzina |
| R | liga/desliga o rádio (batida procedural) |
| E | sirene (dentro de uma viatura) |
| Espaço / Enter | pular fala na cena |
| Esc | pausar |

## O que tem no jogo

- **Cidade em mundo aberto**: grade de 8×8 quarteirões com centro de arranha-céus de vidro, comércio, bairros residenciais, parques com chafariz, praia com coqueiros e mar, hospital, delegacia, oficina, a casa do Bento e o território da gangue Corvos.
- **Gráficos**: renderização PBR (materiais metálicos, verniz na pintura dos carros, vidro), sombras suaves dinâmicas, céu atmosférico físico com reflexos de ambiente, **ciclo dia/noite** (janelas e postes acendem, estrelas), bloom, correção de cor cinematográfica, vinheta, névoa e FOV que abre com a velocidade.
- **Personagens articulados** com animações procedurais: parado (respirando), andar, correr, pular, soco alternado, mirar, sentar no carro, render-se, cair e morrer. Eles piscam e viram a cabeça para olhar.
- **Vozes com sincronia labial**: as falas usam a síntese de voz do próprio navegador (Web Speech API, pt-BR), e cada personagem tem tom e velocidade de voz próprios. A boca (mandíbula, lábios, dentes) segue os **visemas** do texto falado e se ressincroniza a cada palavra que o motor de voz anuncia. As cenas têm câmera cinematográfica, faixas pretas e legendas.
- **Veículos**: 6 modelos (sedã, esportivo, van, picape, táxi, viatura) com física arcade (tração, aderência lateral, drift no freio de mão, inclinação da carroceria, rodas que esterçam e giram), danos, fumaça, fogo e **explosão** em cadeia. À noite o carro do jogador acende o farol.
- **Roubar carros**: o motorista é puxado para fora e foge ou parte para a briga.
- **Trânsito com IA**: os carros seguem faixas, fazem curvas nos cruzamentos, freiam para pedestres e outros carros e buzinam quando ficam presos.
- **Pedestres** que caminham pelas calçadas, atravessam ruas, fogem de tiros, se rendem e revidam.
- **Polícia e nível de procurado (1 a 5 estrelas)**: viaturas perseguem e batem no seu carro, policiais descem e atiram a partir de 2 estrelas. Para fugir, saia da linha de visão deles. Você pode ser **preso** ou **morrer**, e reaparece na delegacia ou no hospital.
- **Expressões faciais**: sobrancelhas, pálpebras, cantos da boca e olhar com movimentos rápidos. Os personagens mostram alegria, raiva, tristeza, surpresa, preocupação e confiança, gesticulam e mexem a cabeça enquanto falam.
- **Conversas na rua**: pedestres param para conversar entre si com vozes diferentes. Você pode cumprimentar (T) ou provocar (G), e a resposta depende da sua reputação e do nível de procurado.
- **Escolhas na história**: na missão 3 você decide o destino do líder dos Corvos, e isso muda o final.
- **Clima dinâmico**: sol, nublado, chuva (com som e asfalto molhado que reflete) e neblina.
- **Natação e agachar**: dá para entrar no mar e nadar, e agachado você chama menos atenção da polícia.
- **Lojas e atividades**: roupas (Moda Sol), lanchonete (Maré), academia (força e fôlego), apartamento à venda (Edifício Maré, vira ponto de salvamento e lugar para dormir) e pintura e reparo de carros.
- **Reputação e estatísticas** (no menu de pausa) e **salvamento manual**.
- **Combate**: socos, pistola com tiro na cabeça, rastro de bala, clarão do disparo e partículas.
- **4 missões de história** com cenas faladas:
  1. *Rodas Novas*: roubar um carro e levá-lo à oficina da Duda.
  2. *Entrega Quente*: corrida contra o tempo por 9 checkpoints com o Fúria GT (prêmio: pistola).
  3. *Asas Cortadas*: enfrentar a gangue Corvos no território deles.
  4. *Calor Total*: despistar 3 estrelas e voltar ao esconderijo.
- **HUD completo**: relógio, vida, colete, dinheiro, estrelas, arma e munição, minimapa giratório com marcadores, velocímetro, cronômetro, objetivos e mensagens.
- **Itens**: vida no hospital e no esconderijo, colete na delegacia e dinheiro deixado por inimigos.
- **Áudio sintetizado**: motor com marchas, cantada de pneu, sirene, tiros, batidas, explosões, buzina e rádio.
- **Progresso salvo** automaticamente no navegador (missão atual, dinheiro e armas).

Para entender o código e acrescentar missões e locais, veja **[docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md)**.

## Estrutura

```
index.html        interface, HUD, menu e import map
src/main.js       loop do jogo, câmera, polícia, crimes, colisões, cenas
src/world.js      geração da cidade, céu, luzes, dia/noite e consultas de colisão
src/textures.js   texturas procedurais (fachadas, asfalto, calçada, grama, água…)
src/human.js      personagem articulado, animações e boca falante
src/voice.js      voz (Web Speech API) e sincronia labial por visemas
src/vehicle.js    modelos de carro, física, IA de trânsito e de perseguição
src/npc.js        pedestres, policiais, gangue e personagens da história
src/player.js     protagonista: movimento, combate, roubo de carro, direção
src/missions.js   missões e roteiro
src/hud.js        HUD, minimapa, mapa completo, escolhas, estatísticas, depuração
src/places.js     lojas, lanchonete, academia, apartamento, pintura
src/fx.js         partículas, explosões e marcadores
src/audio.js      áudio sintetizado
vendor/three/     Three.js r160 (licença MIT)
```

## Créditos

Desenvolvido com [Three.js](https://threejs.org) (MIT). Todo o resto (código, história, personagens e arte procedural) é original.
