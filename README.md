# FTA 1

Jogo de mundo aberto em 3D que roda no navegador (Three.js), com clima dos anos 90 inspirado nos clássicos do gênero. Tudo é gerado por código: mapa, cidades, carros, personagens, músicas do rádio e vozes.

## Como jogar

O jogo usa módulos ES, então precisa ser servido por HTTP (abrir o arquivo direto não funciona):

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

Ou publique a pasta no GitHub Pages / Netlify. É preciso internet na primeira vez para baixar o Three.js e as fontes do CDN.

## O que tem

- **4 cidades**: Porto Sereno (metrópole litorânea com arranha-céus e avenida de palmeiras), São Cruzeiro (cidade média na serra), Vila Poeira (vilarejo no deserto) e Pedra Alta (vila no morro), ligadas por 5 rodovias, mais o Monte Sereno, o Deserto do Sal e a Costa Esmeralda.
- **Mapa**: minimapa no canto superior direito, que gira com a câmera, com ruas em preto e o nome grande de cada cidade. O mapa completo abre com `M`. O nome da zona aparece ao entrar nela.
- **Física de veículos**: modelo de pneus com ângulo de deriva (curva tipo Pacejka), círculo de atrito, transferência de peso, torque do motor com marchas, câmbio automático ou manual, freio de mão, arrasto aerodinâmico calculado contra o **vento real** (vento lateral empurra o carro), aderência por piso (asfalto, terra, grama, areia) e piso molhado na chuva, saltos em lombadas, colisão com impulso e rotação, dano. Veículos: BMX, moto, sedã, táxi, picape e esportivo.
- **Vento e água**: as árvores, palmeiras e a grama balançam no shader conforme a direção e a força do vento, com rajadas. As ondas do mar seguem a direção do vento e crescem com ele (dispersão de águas profundas), com espuma na beira e na crista, reflexo do céu, fresnel e brilho do sol. A chuva cai inclinada pelo vento.
- **Clima e ciclo dia/noite**: ensolarado, nublado, chuva, tempestade (com raios e trovões) e neblina, com troca dinâmica. O asfalto molhado reflete os postes e os faróis. As janelas dos prédios acendem à noite, e o céu, a névoa, as nuvens, as estrelas e os reflexos do ambiente são atualizados ao longo do dia.
- **NPCs**: pedestres andam pelas calçadas, atravessam a rua, fogem, reclamam e caem. O trânsito anda pela mão direita, para diante de obstáculos, buzina e desencalha sozinho. Dá para roubar carros.
- **Dublagem** em português do Brasil e inglês (voz sintetizada do navegador), com legendas independentes do idioma da voz.
- **Rádio** com 3 estações procedurais: G-Funk, Funk Carioca e Bossa Lo-fi.
- **Fome e comida**: a barra laranja embaixo da vida é a fome, que esvazia em uns 15 minutos de jogo. Com fome a vida cai. Na **Lanchonete do Zé** (Porto Sereno) e na **Pastelaria Serrana** (São Cruzeiro) você come pastel, X-tudo, prato feito ou salada. Comer de barriga cheia engorda (o personagem ganha barriga e corre mais devagar), e correr e treinar na academia emagrece.
- **Dinheiro com sentido**:
  - **Auto Sereno Veículos**: compra moto, sedã, picape, Faísca GT, jet-ski e lancha. Os barcos são entregues na marina, e o que você compra volta toda vez que carrega o jogo.
  - **Casa à venda** ($1500): vira sua casa, onde você dorme 6 horas, salva o jogo e começa quando volta.
  - Pedestres e gangues derrubados deixam dinheiro no chão.
- **Barcos**: lancha e jet-ski na marina do píer (ícone M no mapa). Eles boiam nas mesmas ondas do mar, sobem e descem com elas, levantam a proa quando aceleram, inclinam na curva, deixam esteira de espuma e o vento empurra de lado. Na areia encalham.
- **Semáforos** nos cruzamentos de Porto Sereno e São Cruzeiro: verde, amarelo e vermelho de verdade. Os carros param no vermelho e fazem fila. Furar o vermelho com a polícia perto dá uma estrela.
- **Animais**: cachorros andam pelas calçadas, latem e abanam o rabo quando você chega perto e fogem de carro. Passarinhos voam sobre a cidade, pombos ciscam na calçada e saem voando quando você chega, e gaivotas planam sobre a praia.
- **Gangues**: o **Bonde Verde** (Porto Sereno) e a **Família Roxa** (São Cruzeiro) têm território pintado no mapa. Os membros ficam em grupo conversando. Se você chegar perto eles avisam, e se insistir ou bater em um deles todos atacam, com soco, taco ou pistola.
- **Armas**: na **Armas do Tonhão** tem taco, faca, pistola e escopeta, além de munição.
  - Troca de arma com Q/E, 1–5 ou a roda do mouse.
  - Mira com o botão direito (em 1ª ou 3ª pessoa) e atira com o clique. No controle e no toque a mira trava sozinha no alvo.
  - Tiro na cabeça mata mais rápido, e acertar um carro estraga ele.
  - A partir de 3 estrelas os policiais sacam a pistola e atiram em você.
- **Gente conversando**: quem fala mexe a boca, e as pessoas conversando na rua fazem um murmúrio de vozes ao fundo.
- **Cigarro parado**: se você fica uns 7 segundos parado a pé, o personagem tira o cigarro do bolso, acende com o isqueiro (chama e clique), traga com a brasa acendendo e solta fumaça pela boca. Um fiozinho de fumaça sobe da ponta e vai com o vento. Perto de uma parede ele vira de costas, encosta e apoia o pé na parede. Ao se mexer ele joga a bituca fora (faísca caindo).
- **Pular do carro andando**: apertando `F`/Y/🚗 acima de ~20 km/h o personagem salta pela porta com a velocidade do carro, cai rolando no asfalto levantando poeira, se machuca (o dano cresce com a velocidade, e bater numa parede rolando machuca mais), fica caído e levanta. O carro vazio continua andando até parar sozinho.
- **Câmera em 1ª ou 3ª pessoa**: `C` / R3 / 👁 alterna entre terceira pessoa, terceira pessoa de longe e primeira pessoa (também dá pra escolher em Configurações). Em primeira pessoa a pé o personagem olha pra onde você mira. No carro a câmera fica nos olhos do motorista, com painel, volante que gira e vidros por onde dá pra ver; o olhar volta pra frente sozinho quando você solta a câmera.
- **Tela de toque organizada**: cada botão só aparece quando dá pra usar. O 🚗 só aparece com um carro (ou loja aberta) perto, o 🤿 só na água, o soco some quando você está nadando, buzina, rádio e farol somem na bicicleta, e o ⏭ só aparece durante falas e cenas.
- **Chuva no chão**: o asfalto e as calçadas escurecem e ficam brilhando quando molham, e se formam poças que crescem com a chuva. As gotas abrem anéis nas poças e respingam no chão. Postes, faróis e lanternas se refletem na rua molhada, em faixas compridas no asfalto e como espelho nas poças. Os pneus levantam névoa atrás do carro, passar na poça espirra água para os lados, pisar na poça a pé também espirra, e dá para ouvir o chiado do pneu no molhado. Com chuva ou neblina, o facho do farol aparece no ar.
- **Física mais real**:
  - suspensão com mola e amortecedor: o carro mergulha ao frear, agacha ao acelerar, inclina na curva e quica ao cair de um salto;
  - ladeira de verdade: o carro sem freio desce sozinho e perde força subindo;
  - aquaplanagem: em alta velocidade numa poça o pneu perde aderência, e a poça de um lado só puxa o carro para aquele lado;
  - no molhado o carro freia em uma distância bem maior (de 80 km/h: 31 m no seco, 45 m na chuva);
  - o carro perde aderência quando o peso joga para um lado, mais na frente que atrás, então no limite ele sai de frente;
  - o Faísca GT tem carga aerodinâmica que gruda mais no chão quanto mais rápido;
  - a roda que patina gira mais rápido que o chão.
- **Freio realista**: o carro não tem ABS. Se você frear forte demais, as rodas travam: o pneu desliza com atrito cinético (menos aderência), a dianteira travada não obedece o volante, e ficam marcas de pneu no asfalto (ou de terra fora dele) com fumaça. Dosando o freio no analógico você para mais rápido sem travar. Derrapando de lado o carro perde velocidade como na vida real (cerca de 0,7 g), sem parar do nada. O freio de mão trava a traseira para dar drift.
- **Farol**: liga e desliga com `L` / D-pad ↑ / 💡. Se você não desligar, ele continua aceso depois que você sai do carro.
- **Soco em combo**: apertando no ritmo sai jab de esquerda, direto de direita e gancho. O personagem fica em guarda depois de socar e mira no pedestre mais perto. Quem apanha cambaleia, e o gancho derruba.
- **Polícia**: as estrelas de procurado (1 a 5) sobem quando você atropela, rouba, bate em viatura ou soca um policial. As viaturas perseguem com sirene e luzes e tentam te fechar. Se você está a pé, os policiais descem e correm atrás de você. Ficar parado perto deles dá **PRESO**. A partir de 3 estrelas aparece um helicóptero da polícia varrendo a área com holofote. Fugir da vista deles faz as estrelas caírem uma por uma.
- **Períodos do dia**: Madrugada, Manhã, Começo da tarde, Tarde e Noite, mostrados embaixo do relógio e avisados na troca. Dá para pular para um período nas Configurações.
- **Batidas com dano localizado**: a lataria amassa só no ponto da batida (frente, traseira ou laterais), e só as peças daquele lado quebram: farol ou lanterna do lado atingido, para-brisa, vidro traseiro ou lateral, para-choque, capô, porta-malas e portas. Cacos e peças voam e ficam no chão. Com o carro muito batido o motor solta fumaça, pega fogo e explode, empurrando o que estiver perto. A Oficina Vargas conserta o carro por $50: é só parar no pátio dela.
- **Postes, semáforos, hidrantes e lixeiras quebram**: batendo forte, o poste é arrancado da base e tomba de verdade (gira, quica no chão soltando faísca e fica caído na rua, e o carro pode empurrar ou passar por cima dele com um tranco). O carro perde a velocidade que gastou pra arrancar o poste. Devagar o poste só balança e o carro para. O hidrante voa e solta um jato de água por uns 20 segundos, e a lixeira sai rolando espalhando lixo. Poste derrubado apaga a luz. Tudo volta ao lugar quando você está longe. Batendo em árvore, a copa treme e caem folhas.
- **Física de batida**: o carro testa o caminho em passos quando está rápido (não atravessa poste fino), o quique diminui em batidas fortes (a energia vai pra amassar), raspando na parede ele desliza encostado com faísca e chiado de metal, e carro contra carro gira os dois quando a batida é de lado. A carroceria dá um tranco na suspensão a cada batida (mergulha, balança de lado). A frente batida desalinha a direção e o carro passa a puxar de leve pra um lado (a oficina conserta). De moto ou bicicleta, batendo forte você voa por cima do guidão.
- **Céu**: aviões cruzam o céu com luzes de navegação piscando e som.
- **Pedestres conversando**: duplas param na calçada e conversam com gestos e falas dubladas.
- **Água**: dá para pular na água em pose de mergulho (tem um píer com trampolim de 11 m na praia de Porto Sereno), com respingo. Na superfície você nada crawl ou fica boiando. Com `Ctrl`/`Z` você mergulha e nada de peito embaixo d'água, com bolhas, visão azulada e barra de fôlego.
- **Loja de roupas e academia**: a **Moda Sereno** e a **Academia Força Bruta** em Porto Sereno abrem depois de um tempo de jogo, e o jogo avisa quando liberam (ícone no mapa). Na loja você compra camisa, calça, boné e corrente. Na academia você treina apertando o botão: o personagem ganha músculo visível e fôlego, que dá mais tempo de corrida e de ar embaixo d'água.
- **História**: começa com uma cena de chegada de táxi, depois você segue o Duda de bicicleta até a oficina e por fim faz um racha no Faísca GT até São Cruzeiro. Depois disso, o mundo fica livre para explorar.

## Controles

| | Teclado/Mouse | Controle | Toque |
|---|---|---|---|
| Andar / dirigir | WASD | Analógico esquerdo | Analógico virtual |
| Câmera | Mouse | Analógico direito | Arrastar à direita |
| Acelerar / frear | W / S | RT / LT (analógico) | ▲ ▼ ou analógico |
| Correr / freio de mão | Shift / Espaço | A | botões |
| Pular | Espaço | X | ⤒ |
| Soco | Clique | B | 👊 |
| Entrar/sair | F | Y | 🚗 |
| Rádio / buzina | R / H | D-pad ← / L3 | 📻 📯 |
| 1ª / 3ª pessoa | C | R3 | 👁 |
| Trocar de arma | Q / E · 1–5 | D-pad → | 🔫 |
| Mirar / atirar | Botão direito / clique | LT / B | 🎯 / 👊 |
| Mapa / pausa | M / Esc | Back / Start | 🗺 ⏸ |

Em **Configurações** você escolhe o esquema de controle (automático, teclado, controle analógico ou toque), se o analógico também acelera e freia, a sensibilidade, a zona morta, o câmbio, a dublagem, as legendas, os volumes, a qualidade gráfica, as sombras, o bloom, a distância de visão, o clima e a velocidade do relógio.
