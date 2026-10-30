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
| Mapa / pausa | M / Esc | Back / Start | 🗺 ⏸ |

Em **Configurações** você escolhe o esquema de controle (automático, teclado, controle analógico ou toque), se o analógico também acelera e freia, a sensibilidade, a zona morta, o câmbio, a dublagem, as legendas, os volumes, a qualidade gráfica, as sombras, o bloom, a distância de visão, o clima e a velocidade do relógio.
