# Ideias para criar vídeos .mp4 neste estilo

O `piramides.mp4` é um **explainer animado em estilo "flat"**: formas geométricas simples, paleta quente,
capítulos numerados, legendas com efeito de máquina de escrever e trilha sintetizada.
Tudo é gerado por código (`gerar_video.py`), sem nenhuma imagem externa.

## Como regenerar / editar
```bash
pip install pillow numpy     # e ter o ffmpeg instalado
python3 gerar_video.py       # gera piramides.mp4 (~70 s, 1280x720, 30 fps)
```
- Cada cena é uma função `cena_xxx(lt, dur)`; a lista `CENAS` define ordem e duração.
- Para trocar textos, edite as chamadas `legenda(...)`.
- Para vertical (Reels/TikTok/Shorts), mude `W, H = 1080, 1920` e reposicione os elementos.

## A "fórmula" do estilo
1. **Gancho em 3 s** – uma pergunta grande na tela ("Como construíram...?").
2. **Capítulos curtos (8–12 s)** – um conceito por cena, com contador `01/06`.
3. **Uma animação que *prova* a ideia** – ex.: medidor de força caindo para 50% quando a areia é molhada.
4. **Um número de impacto** – contador subindo até "~30.000".
5. **Debate/curiosidade** – painel comparando teorias (rampa reta, zigue-zague, espiral, interna).
6. **Fecho com frase de efeito** – "Engenharia, organização e muita gente — não mistério."

## Melhorias para o próximo vídeo
- **Narração**: escreva o roteiro e gere voz com TTS (ex.: ElevenLabs, Piper, edge-tts) e
  sincronize a duração de cada cena com cada trecho falado.
- **Efeito sonoro**: batidas de cinzel na pedreira, água no trenó, ondas no Nilo.
- **Câmera**: zoom lento (efeito Ken Burns) recortando e ampliando o quadro a cada frame.
- **Mapa animado**: linha traçando a rota Assuã → Gizé pelo Nilo (~800 km).
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
