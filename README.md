# Metrópolis — Construtor de Cidades 3D com IA

Jogo de construir cidades em 3D que roda direto no navegador. A jogabilidade
se inspira nos construtores de cidade modernos (zonas RCI, ruas que se
conectam a uma rodovia regional, energia, água, serviços com raio de
cobertura, mapas de dados), com visual e conteúdo próprios.

## Como jogar

Os scripts são clássicos (sem ES modules) e o Three.js vem incluído em `lib/`,
então o jogo funciona sem internet.

```bash
# opção 1: abrir o arquivo index.html no navegador
# opção 2 (recomendado): servir a pasta
python3 -m http.server 8000
# e abrir http://localhost:8000
```

1. Digite o **nome da cidade** e clique em **Fundar cidade**.
2. A rodovia regional chega pelo **oeste**. Toda rua precisa estar conectada a ela.
3. Crie **zonas** residenciais, comerciais e industriais ao longo das ruas.
4. Garanta **energia** e **água**: sem elas, os prédios não crescem.
5. Construa serviços (prefeitura, hospital, polícia, bombeiros, escola),
   áreas verdes e marcos para valorizar o solo e deixar os moradores felizes.

### Iara: a assistente de IA

No painel à direita, peça qualquer obra em português. A Iara escolhe o melhor
lugar, **mostra uma prévia holográfica no mapa, lista os preços e o custo
total**, e só constrói se você clicar em **✔ Confirmar**. Clique em **✖ Não**
para cancelar. Exemplos:

- `Monte uma cidade inicial completa`
- `construa um bairro residencial` / `construa um bairro misto`
- `crie uma zona industrial longe das casas`
- `coloque 2 turbinas eólicas e uma torre de água`
- `faça um hospital perto do centro`
- `plante 30 árvores` · `construa o hub de cidade inteligente`
- `construa 3 prédios comerciais` · `quero um estádio`
- `aumente os impostos para 11%` · `renomear a cidade para Porto Azul`
- `como está a cidade?` · `o que devo fazer?`

A Iara funciona localmente, com um interpretador de linguagem natural e um
planejador espacial próprios. Ela não precisa de chave de API nem de internet.

### Controles

| Ação | Mouse / teclado | Toque |
|---|---|---|
| Mover a câmera | botão direito (ou esquerdo sem ferramenta) / WASD | 1 dedo |
| Zoom | roda do mouse / + − | pinça |
| Girar | botão do meio / Q E | 2 dedos |
| Girar prédio | R | — |
| Cancelar ferramenta | Esc | — |
| Pausar / velocidades | Espaço / 1 2 3 | botões no topo |
| Demolir | B | botão Demolir |

## O que tem no jogo

- **Ruas** com conexões automáticas (retas, curvas, T, cruzamentos com faixa
  de pedestre), calçadas e pontes sobre o rio.
- **Zonas RCI** que crescem sozinhas em 3 densidades: casas → prédios →
  torres, lojas → escritórios → arranha-céus, fábricas → armazéns →
  indústria de tecnologia.
- **Prédios para construir diretamente**: casa, edifício, torre residencial,
  loja, escritórios, arranha-céu, fábrica, armazém e indústria de tecnologia.
- **Serviços**: prefeitura, hospital, delegacia, bombeiros, escola.
- **Energia e água**: usina eólica (pás animadas), solar, a carvão (com
  fumaça) e torre de água.
- **Meio ambiente inteligente**: parques, parque grande com lago, praça com
  fonte, árvores, centro de reciclagem e **Hub de Cidade Inteligente**, que
  reduz o consumo e a poluição.
- **Marcos**: torre panorâmica, estádio, torre corporativa, shopping.
- **Moradores e carros** circulando pelas ruas e calçadas. Os moradores
  aumentam de tamanho conforme a câmera se afasta, para continuarem visíveis
  de longe.
- **Painel de população** sempre visível ao lado, com gráfico de evolução,
  felicidade, energia, água, empregos, demanda RCI e imposto.
- **Nome da cidade** no topo (clique para renomear).
- **Texturas procedurais** de asfalto, calçada, fachadas com janelas que
  acendem à noite, telhas, vidro com reflexo, água animada, além de sombras
  em tempo real e ciclo de dia e noite.
- **Mapas de dados**: poluição, valor do solo, cobertura de serviços e
  zoneamento.
- **Salvar e carregar** no navegador, com salvamento automático a cada mês.

## Estrutura

```
index.html        interface
css/style.css     estilo da interface
lib/three.min.js  Three.js r149 (licença MIT)
js/textures.js    texturas procedurais (canvas)
js/models.js      modelos 3D, materiais e catálogo de construções
js/world.js       grade, terreno, ruas, zonas, renderização instanciada
js/sim.js         simulação (demanda, crescimento, energia, água, orçamento)
js/agents.js      moradores e carros
js/ai.js          Iara: interpretação de linguagem e planejamento de obras
js/ui.js          HUD, barra de ferramentas, chat
js/main.js        câmera, controles, ferramentas, dia/noite, loop, salvar
```
