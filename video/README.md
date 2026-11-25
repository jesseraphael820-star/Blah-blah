# THE POWER OF OPUS 5.5

Vídeo cinematográfico 4K UHD (3840×2160, 60 fps, H.264 + AAC, legendas pt-BR), ~2:45, produzido inteiramente com código.

## Pipeline (tudo executado de verdade)
| Etapa | Script | Ferramenta |
|---|---|---|
| App de demonstração real ("Orbit") | `demo-app/` | HTML/CSS/JS, `node --test` (6 testes) |
| Bug real + correção (NaN em quadro vazio) | `buggy/` → `demo-app/` | `node --test` |
| Capturas do app sendo usado | `src/capture_demo.js` | Playwright + Chromium |
| Narração pt-BR | `src/narration.py` | Kokoro TTS (local, voz `pm_alex`) |
| Trilha original 96 BPM, sound design, ducking, −14 LUFS | `src/audio.py` | NumPy/SciPy + FFmpeg loudnorm |
| Renderização 4K60 (partículas 3D, bloom, câmera, grade) | `src/engine.py`, `src/scenes.py`, `src/render.py` | Pillow + NumPy → libx264 |
| Montagem final | `src/render_all.sh` | FFmpeg |

## Reproduzir
```bash
pip install kokoro-onnx soundfile scipy pygments pillow numpy
# modelos Kokoro em /opt/tts (kokoro-v1.0.onnx, voices-v1.0.bin)
(cd demo-app && python3 -m http.server 8765 &) ; node src/capture_demo.js
python3 src/narration.py && python3 src/audio.py
ffmpeg -i assets/mix.wav -af loudnorm=I=-14:TP=-1.0:LRA=11 -c:a pcm_s24le assets/mix_norm.wav
src/render_all.sh
```

## Honestidade
Código, testes, capturas do app e o log de produção mostrados no vídeo são reais. A rede neural (cena 2) e os cartões de raciocínio/organização (cena 4) são visualizações ilustrativas, e estão rotuladas assim. Nenhuma métrica ou recurso específico do Opus 5.5 é afirmado. Blender e After Effects não estavam disponíveis e não foram usados. Produção independente, não oficial da Anthropic.
