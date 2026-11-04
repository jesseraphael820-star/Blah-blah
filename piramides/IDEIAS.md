# Ideias para criar vídeos .mp4 neste estilo

O `piramides.mp4` é um **explainer animado com narração e bonecos**, no formato
**tentativa e erro**: os personagens tentam uma ideia, ela dá ERRADO (carimbo + som de erro),
e eles corrigem até chegar na solução (carimbo "DEU CERTO!" + som de acerto).

Personagens: **Hemiunu** (o arquiteto real da Grande Pirâmide) e **Neferet** (fictícia, chefe das equipes),
mais um **narrador**. Cada fala tem voz própria, balão de diálogo com texto digitando e boca animada
pelo volume da voz.

## Como regenerar / editar
```bash
pip install pillow numpy kokoro-onnx soundfile        # e ter o ffmpeg instalado
# baixe kokoro-v1.0.onnx e voices-v1.0.bin em:
# https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
KOKORO_DIR=/pasta/dos/modelos python3 gerar_video.py  # ~3,5 min de vídeo
```
- **Tudo começa no `ROTEIRO`**: cada fala é `(quem, texto, tag, pausa, carimbo)`.
  `quem` = `N` (narrador), `H` (Hemiunu) ou `F` (Neferet); `carimbo` = `ERRO`, `QUASE`, `MITO` ou `CERTO`.
- A duração de cada cena se ajusta sozinha ao tamanho das falas.
- As animações usam as tags: `c.desde("fail", lt)` = segundos desde que a fala "fail" começou.
- Vozes (Kokoro, offline): `pm_alex` (narrador), `pm_santa` (Hemiunu), `pf_dora` (Neferet).
  As vozes ficam em cache em `.cache_vozes/`, então só falas alteradas são regeradas.
- **Versão YouTube**: `python3 gerar_video.py --youtube` gera em `youtube/`:
  `piramides_youtube_1080p.mp4` (1920x1080, áudio normalizado em -14 LUFS e tela final),
  `miniatura.jpg`, `legendas_pt-BR.srt` e `descricao.txt` (título, descrição, capítulos e tags).
- Para vertical (Reels/TikTok/Shorts), mude `W, H = 1080, 1920` e reposicione os elementos.

## A estrutura "erro → correção" (copie para qualquer tema)
```
PERSONAGEM A: "Vamos fazer X!"                         (mostra X acontecendo)
NARRADOR:     "Mas X dá errado porque Y."              (animação do fracasso + carimbo ERRO)
PERSONAGEM B: "Então vamos fazer Z."                   (mostra Z funcionando + DEU CERTO)
NARRADOR:     "Fato real que comprova Z."              (número/curiosidade na tela)
```
Variação: um "QUASE..." no meio (a solução funciona, mas ainda tem um problema) deixa a cena
mais divertida, como no trenó: desliza, mas precisa do dobro de gente, até molhar a areia.

## A "fórmula" do estilo
1. **Gancho em 3 s** – uma pergunta grande na tela ("Como construíram...?").
2. **Capítulos curtos (~30 s)** – um problema por cena: tentativa → erro → correção.
3. **Uma animação que *prova* a ideia** – ex.: medidor de força caindo para 50% quando a areia é molhada.
4. **Um número de impacto** – "2.300.000 blocos", "20 a 30 mil trabalhadores".
5. **Desmentir um mito** – carimbo "MITO!" (não foram escravos).
6. **Fecho com frase de efeito** – "Não foi magia. Foi tentativa, erro e muita gente trabalhando junto."

## Melhorias para o próximo vídeo
- **Vozes mais expressivas**: troque o Kokoro por ElevenLabs ou grave a sua própria voz
  (basta substituir o áudio de cada fala, a sincronia continua automática).
- **Personagens andando entre as cenas** e interagindo com os objetos (empurrar o trenó, etc.).
- **Efeito sonoro**: batidas de cinzel na pedreira, água no trenó, ondas no Nilo.
- **Câmera**: zoom lento (efeito Ken Burns) recortando e ampliando o quadro a cada frame.
- **Comparação de escala**: a Grande Pirâmide (146 m) ao lado do Cristo Redentor (38 m) ou de um prédio.
- **Corte transversal 3D**: câmaras internas e a Grande Galeria (Blender ou Manim).

## Outros temas que funcionam bem neste formato
- Como os romanos construíram o Coliseu / os aquedutos
- Como Stonehenge foi erguido
- Como os incas encaixavam pedras sem argamassa (Machu Picchu)
- Como a Muralha da China foi construída
- Como os moais da Ilha de Páscoa "andaram"
- Como funcionava o Farol de Alexandria
- Como se mumificava um faraó

## Ferramentas alternativas
| Objetivo | Ferramenta |
|---|---|
| Animação por código (este projeto) | Python + Pillow + ffmpeg |
| Animações matemáticas/diagramas | Manim |
| 3D realista (pirâmide, câmeras, luz) | Blender (gratuito, scriptável em Python) |
| Montagem rápida com templates | CapCut, Canva |
| Edição profissional / cor / áudio | DaVinci Resolve |
| Motion design | After Effects, Rive, Lottie |

## Fatos usados no vídeo (para conferir/aprofundar)
- ~2,3 milhões de blocos, média ~2,5 t; Grande Pirâmide de Quéops, c. 2560 a.C., 146 m originais.
- Calcário local em Gizé; revestimento de Tura; granito de Assuã para a Câmara do Rei.
- Diário de Merer (papiros de Wadi al-Jarf, achados em 2013): transporte de calcário de Tura.
- Areia molhada reduz pela metade a força de arraste (Fall et al., Univ. de Amsterdã, 2014);
  pintura na tumba de Djehutihotep mostra um homem jogando água na frente do trenó.
- Rampa com degraus e buracos de postes em Hatnub (anunciada em 2018).
- Vila e tumbas de trabalhadores em Gizé indicam mão de obra paga e organizada (não escravos).
