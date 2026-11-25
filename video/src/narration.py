"""Narration script: (start_seconds, spoken_text, subtitle_text). Generates per-line WAVs with Kokoro (pt-br)."""
import json, sys, os
LINES = [
 (3.2,  "O futuro da inteligência artificial.", "O futuro da inteligência artificial."),
 (10.2, "Claude Opus cinco ponto cinco.", "Claude Opus 5.5."),
 (16.3, "O que acontece quando uma inteligência artificial consegue compreender problemas complexos, analisar informações e transformar ideias em soluções?",
        "O que acontece quando uma inteligência artificial consegue compreender problemas complexos, analisar informações e transformar ideias em soluções?"),
 (29.0, "Ela lê. Conecta. Raciocina, passo a passo, até encontrar um caminho.", "Ela lê. Conecta. Raciocina, passo a passo, até encontrar um caminho."),
 (41.0, "Na programação, ela escreve código, constrói interfaces e analisa projetos inteiros.", "Na programação, ela escreve código, constrói interfaces e analisa projetos inteiros."),
 (48.6, "Quando algo falha, ela investiga a causa, corrige o erro e roda os testes de novo.", "Quando algo falha, ela investiga a causa, corrige o erro e roda os testes de novo."),
 (56.8, "Tudo o que você vê aqui é real: código, testes e aplicação foram executados para este vídeo.", "Tudo o que você vê aqui é real: código, testes e aplicação foram executados para este vídeo."),
 (66.0, "Mas inteligência vai além do código.", "Mas inteligência vai além do código."),
 (69.6, "Planejar estratégias. Analisar documentos longos. Resolver problemas com clareza.", "Planejar estratégias. Analisar documentos longos. Resolver problemas com clareza."),
 (78.2, "E transformar grandes volumes de informação em algo organizado e acionável.", "E transformar grandes volumes de informação em algo organizado e acionável."),
 (91.0, "Com ferramentas conectadas, ela pode conduzir fluxos de trabalho com várias etapas.", "Com ferramentas conectadas, ela pode conduzir fluxos de trabalho com várias etapas."),
 (97.8, "Planejar. Organizar. Executar. E verificar cada resultado.", "Planejar. Organizar. Executar. E verificar cada resultado."),
 (104.8,"E quando uma ferramenta não está disponível, ela diz isso com transparência, em vez de fingir.", "E quando uma ferramenta não está disponível, ela diz isso com transparência, em vez de fingir."),
 (116.0,"Agora, uma demonstração real, do zero.", "Agora, uma demonstração real, do zero."),
 (120.0,"Uma ideia.", "Uma ideia."),
 (123.6,"Um plano.", "Um plano."),
 (127.2,"O código.", "O código."),
 (131.0,"A interface ganhando forma.", "A interface ganhando forma."),
 (135.4,"Seis testes executados. Seis aprovados.", "6 testes executados. 6 aprovados."),
 (140.2,"E o resultado final, funcionando.", "E o resultado final, funcionando."),
 (148.6,"Inteligência. Criatividade. Possibilidade.", "Inteligência. Criatividade. Possibilidade."),
 (156.2,"Claude Opus cinco ponto cinco.", "Claude Opus 5.5."),
]
if __name__ == "__main__":
    from kokoro_onnx import Kokoro
    import soundfile as sf
    k = Kokoro("/opt/tts/kokoro-v1.0.onnx", "/opt/tts/voices-v1.0.bin")
    os.makedirs("assets/vo", exist_ok=True)
    meta = []
    for i, (t, spoken, sub) in enumerate(LINES):
        s, sr = k.create(spoken, voice="pm_alex", speed=0.92, lang="pt-br")
        p = f"assets/vo/l{i:02d}.wav"; sf.write(p, s, sr)
        meta.append({"i": i, "start": t, "dur": len(s)/sr, "sub": sub, "path": p, "sr": sr})
        end = t + len(s)/sr
        nxt = LINES[i+1][0] if i+1 < len(LINES) else 165
        print(f"{i:2d} {t:6.1f} dur {len(s)/sr:5.2f} end {end:6.2f} next {nxt:6.1f} {'OVERLAP' if end > nxt-0.3 else ''}")
    json.dump(meta, open("assets/vo/meta.json", "w"), ensure_ascii=False, indent=1)
