#!/usr/bin/env python3
"""
Gera o vídeo animado "Como construíram as Pirâmides do Egito?" (.mp4)

Tudo é desenhado por código (Pillow + NumPy) e codificado com o ffmpeg.
A trilha sonora também é sintetizada aqui (drone + melodia na escala Hijaz).

Uso:
    python3 gerar_video.py            # gera piramides.mp4 nesta pasta
Requisitos: python3, pillow, numpy, ffmpeg no PATH.
"""
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- config
W, H = 1280, 720          # resolução final
S = 2                     # supersampling (desenha em 2x e reduz -> antialias)
FPS = 30
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "piramides.mp4")
AUDIO = os.path.join(AQUI, "_trilha.wav")

FONTE_B = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
FONTE_R = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
if not os.path.exists(FONTE_B):
    FONTE_B = FONTE_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

_fontes = {}


def fonte(tam, negrito=True):
    k = (tam, negrito)
    if k not in _fontes:
        _fontes[k] = ImageFont.truetype(FONTE_B if negrito else FONTE_R, tam)
    return _fontes[k]


# paleta
AREIA = (222, 184, 120)
AREIA_ESC = (190, 148, 88)
AREIA_MOLHADA = (150, 110, 62)
PEDRA = (214, 190, 146)
PEDRA_ESC = (168, 140, 98)
CALCARIO = (246, 240, 226)
OURO = (240, 196, 60)
NILO = (52, 118, 160)
PELE = (120, 72, 40)
TINTA = (40, 28, 20)


# ---------------------------------------------------------------- utilidades
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def lerp(a, b, t):
    return a + (b - a) * t


def lerpc(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


def P(*xy):
    """converte coordenadas de 1280x720 para a tela supersampled"""
    return [v * S for v in xy]


def gradiente(topo, base):
    a = np.linspace(0, 1, H * S)[:, None, None]
    g = (np.array(topo)[None, None, :] * (1 - a) + np.array(base)[None, None, :] * a)
    g = np.repeat(g, W * S, axis=1).astype(np.uint8)
    return Image.fromarray(g, "RGB")


CEUS = {
    "aurora": gradiente((40, 30, 70), (250, 160, 90)),
    "dia": gradiente((90, 160, 220), (240, 220, 180)),
    "tarde": gradiente((230, 140, 70), (250, 215, 150)),
    "noite": gradiente((12, 14, 36), (70, 50, 90)),
}


def chao(d, y, cor=AREIA, cor2=AREIA_ESC):
    d.rectangle(P(0, y, W, H), fill=cor)
    # dunas suaves ao fundo
    pts = [(0, y)]
    for x in range(0, W + 40, 40):
        pts.append((x, y - 12 - 10 * math.sin(x / 140.0)))
    pts.append((W, y))
    d.polygon([tuple(P(*p)) for p in pts], fill=cor2)


def sol(d, x, y, r, cor=(255, 224, 140)):
    for i, a in enumerate((60, 35, 18)):
        rr = r + 18 * (3 - i)
        c = lerpc(cor, (255, 255, 255), 0)
        d.ellipse(P(x - rr, y - rr, x + rr, y + rr), fill=c + (a,))
    d.ellipse(P(x - r, y - r, x + r, y + r), fill=cor)


def piramide(d, cx, base_y, larg, alt, cor=PEDRA, sombra=PEDRA_ESC, prog=1.0):
    """pirâmide em perfil com face iluminada e face em sombra"""
    topo = (cx, base_y - alt)
    d.polygon([tuple(P(cx - larg / 2, base_y)), tuple(P(*topo)), tuple(P(cx, base_y))], fill=cor)
    d.polygon([tuple(P(cx, base_y)), tuple(P(*topo)), tuple(P(cx + larg / 2, base_y))], fill=sombra)


def trabalhador(d, x, y, fase=0.0, escala=1.0, pose="andar", cor=PELE, braco=None):
    """boneco simples estilo hieróglifo; y = pés"""
    e = escala
    sw = max(2, int(4 * e)) * S
    perna = 22 * e
    corpo = 26 * e
    cabeca = 8 * e
    quadril = (x, y - perna)
    ombro = (x, y - perna - corpo)
    a = math.sin(fase) * 0.5 if pose == "andar" else 0.0
    for s in (1, -1):
        px = x + math.sin(a * s) * perna
        d.line(P(*quadril, px, y), fill=cor, width=sw)
    d.line(P(*quadril, *ombro), fill=cor, width=sw)
    # saiote branco
    d.polygon([tuple(P(x - 7 * e, y - perna + 2 * e)), tuple(P(x + 7 * e, y - perna + 2 * e)),
               tuple(P(x + 4 * e, y - perna - 9 * e)), tuple(P(x - 4 * e, y - perna - 9 * e))],
              fill=(245, 240, 225))
    d.ellipse(P(ombro[0] - cabeca, ombro[1] - 2 * cabeca, ombro[0] + cabeca, ombro[1]), fill=cor)
    if braco is None:
        braco = (x + 18 * e * math.cos(a), ombro[1] + 14 * e)
    d.line(P(*ombro, *braco), fill=cor, width=sw)
    return ombro


def bloco(d, x, y, w, h, cor=PEDRA, borda=PEDRA_ESC):
    d.rectangle(P(x, y, x + w, y + h), fill=cor, outline=borda, width=2 * S)
    d.line(P(x + 4, y + 4, x + w - 4, y + 4), fill=lerpc(cor, (255, 255, 255), 0.35), width=S)


def texto_centro(d, txt, y, tam, cor=(255, 255, 255), negrito=True, alfa=255, sombra=True):
    f = fonte(tam * S, negrito)
    l, t, r, b = d.textbbox((0, 0), txt, font=f)
    x = (W * S - (r - l)) / 2
    if sombra:
        d.text((x + 3 * S, y * S + 3 * S), txt, font=f, fill=(0, 0, 0, int(alfa * 0.5)))
    d.text((x, y * S), txt, font=f, fill=cor[:3] + (alfa,))


def legenda(img, titulo, linhas, lt, dur):
    """faixa inferior com título do capítulo + texto explicativo, com fade"""
    a = ease(lt / 0.5) * ease((dur - lt) / 0.4)
    if a <= 0:
        return img
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    alt = 46 + 34 * len(linhas)
    y0 = H - alt - 18
    d.rounded_rectangle(P(40, y0, W - 40, H - 18), radius=18 * S, fill=(20, 14, 8, int(185 * a)))
    d.rectangle(P(40, y0 + 12, 48, H - 30), fill=OURO + (int(255 * a),))
    d.text(P(66, y0 + 12), titulo, font=fonte(26 * S), fill=OURO + (int(255 * a),))
    for i, ln in enumerate(linhas):
        # efeito "máquina de escrever" suave por linha
        k = clamp((lt - 0.4 - i * 0.5) / 0.9)
        n = int(len(ln) * k)
        d.text(P(66, y0 + 50 + 34 * i), ln[:n], font=fonte(24 * S, False),
               fill=(255, 248, 235, int(255 * a)))
    return Image.alpha_composite(img, ov)


def capitulo(img, num, lt):
    """número do capítulo no canto superior"""
    a = ease(lt / 0.5)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rounded_rectangle(P(40, 30, 150, 74), radius=12 * S, fill=(20, 14, 8, int(150 * a)))
    d.text(P(58, 36), f"{num:02d}/06", font=fonte(26 * S), fill=OURO + (int(255 * a),))
    return Image.alpha_composite(img, ov)


# ---------------------------------------------------------------- cenas
# cada cena: função (lt, dur) -> Image RGBA em 2x


def cena_titulo(lt, dur):
    img = CEUS["aurora"].copy().convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    sy = lerp(520, 300, ease(lt / 5))
    sol(d, 640, sy, 70)
    chao(d, 540)
    # três pirâmides de Gizé surgindo
    for cx, lg, al, atraso in ((330, 360, 210, 0.4), (640, 560, 330, 0.0), (930, 300, 170, 0.8)):
        k = ease((lt - atraso) / 2.2)
        piramide(d, cx, 540, lg, al * k, cor=(130, 90, 70), sombra=(90, 60, 50))
    a = int(255 * ease((lt - 1.2) / 1.0))
    texto_centro(d, "Como construíram", 90, 64, alfa=a)
    texto_centro(d, "as Pirâmides do Egito?", 165, 64, cor=OURO, alfa=a)
    a2 = int(255 * ease((lt - 2.6) / 1.0))
    texto_centro(d, "Gizé • c. 2560 a.C. • 2,3 milhões de blocos", 600, 28, negrito=False, alfa=a2)
    return img


def cena_pedreira(lt, dur):
    img = CEUS["dia"].copy().convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 1100, 110, 45)
    chao(d, 470)
    # paredão da pedreira em degraus
    d.polygon([tuple(P(*p)) for p in [(0, 470), (0, 250), (260, 250), (260, 330), (520, 330),
                                       (520, 410), (760, 410), (760, 470)]], fill=(200, 168, 116))
    for y in (250, 330, 410):
        d.line(P(0, y, 760, y), fill=PEDRA_ESC, width=2 * S)
    # sulcos e cunhas no bloco sendo separado
    sep = ease((lt - 2.5) / 3.0)
    bx = 560 + 120 * sep
    bloco(d, bx, 410 - 60 + 60 * 0, 140, 60)
    for i in range(4):
        wx = 575 + i * 33
        d.polygon([tuple(P(wx, 405)), tuple(P(wx + 10, 405)), tuple(P(wx + 5, 420))], fill=(120, 80, 40))
    # trabalhadores com cinzel de cobre e malho
    for i, (x, y) in enumerate(((330, 330), (420, 330), (840, 470), (950, 470))):
        golpe = abs(math.sin(lt * 5 + i * 1.7))
        mx = x + 26
        my = y - 50 + 22 * golpe
        trabalhador(d, x, y, pose="parado", braco=(mx, my))
        d.rectangle(P(mx - 6, my - 10, mx + 8, my), fill=(110, 70, 40))  # malho
        if golpe > 0.93:
            for k in range(5):
                ang = k * 1.2 + lt
                d.ellipse(P(mx + 10 + 14 * math.cos(ang), my + 8 + 10 * math.sin(ang),
                            mx + 14 + 14 * math.cos(ang), my + 12 + 10 * math.sin(ang)),
                          fill=(255, 230, 160))
    # blocos prontos empilhados
    for i in range(3):
        bloco(d, 980 + (i % 2) * 70, 410 - (i // 2) * 60, 66, 60)
    img = capitulo(img, 1, lt)
    return legenda(img, "1. A pedreira", [
        "Calcário era cortado ali mesmo em Gizé, com cinzéis de cobre,",
        "malhos de pedra e cunhas de madeira. Bloco médio: ~2,5 toneladas."], lt, dur)


def cena_nilo(lt, dur):
    img = CEUS["tarde"].copy().convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 260, 170, 55)
    # margem distante com palmeiras e pirâmide
    d.rectangle(P(0, 330, W, 380), fill=(200, 160, 100))
    piramide(d, 1060, 340, 200, 110, cor=(200, 150, 100), sombra=(170, 120, 80))
    for px in (120, 180, 470, 720, 800):
        d.line(P(px, 340, px + 6, 290), fill=(110, 80, 50), width=4 * S)
        for a in range(5):
            ang = -2.6 + a * 0.6
            d.line(P(px + 6, 290, px + 6 + 34 * math.cos(ang), 290 + 22 * math.sin(ang) + 10),
                   fill=(60, 110, 50), width=5 * S)
    # rio
    d.rectangle(P(0, 380, W, 560), fill=NILO)
    for i in range(26):
        y = 395 + (i % 6) * 28
        x = ((i * 157 + lt * 40) % (W + 100)) - 50
        d.line(P(x, y, x + 40, y), fill=(120, 180, 210), width=2 * S)
    d.rectangle(P(0, 560, W, H), fill=AREIA)
    # barco com bloco de granito
    bx = lerp(-260, 1350, lt / dur)
    by = 470 + 4 * math.sin(lt * 2)
    d.polygon([tuple(P(*p)) for p in [(bx - 150, by - 20), (bx + 150, by - 20), (bx + 110, by + 22),
                                       (bx - 110, by + 22)]], fill=(130, 80, 40))
    d.line(P(bx - 150, by - 20, bx - 175, by - 45), fill=(130, 80, 40), width=8 * S)
    d.line(P(bx + 150, by - 20, bx + 175, by - 45), fill=(130, 80, 40), width=8 * S)
    bloco(d, bx - 55, by - 72, 110, 52, cor=(170, 90, 90), borda=(120, 60, 60))  # granito rosa
    d.line(P(bx + 20, by - 20, bx + 20, by - 200), fill=(100, 70, 40), width=5 * S)
    d.polygon([tuple(P(bx + 24, by - 195)), tuple(P(bx + 120, by - 120)), tuple(P(bx + 24, by - 60))],
              fill=(245, 235, 210))
    for i in range(3):
        trabalhador(d, bx - 120 + i * 40, by - 20, pose="parado", escala=0.7,
                    braco=(bx - 100 + i * 40, by + 10 + 6 * math.sin(lt * 3 + i)))
    img = capitulo(img, 2, lt)
    return legenda(img, "2. Pelo rio Nilo", [
        "Calcário fino veio de Tura e granito de Assuã (~800 km) em barcos.",
        "O diário de Merer (papiros de Wadi al-Jarf) registra essas viagens."], lt, dur)


def cena_treno(lt, dur):
    img = CEUS["dia"].copy().convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 160, 100, 40)
    chao(d, 430)
    piramide(d, 1100, 430, 300, 170, cor=(225, 195, 140), sombra=(200, 165, 115))
    ground = 540
    # faixa de areia molhada (aparece após o aguadeiro passar)
    molhar = ease((lt - 1.5) / 2.0)
    sx = lerp(180, 520, ease(lt / dur))
    if molhar > 0:
        d.rectangle(P(0, ground - 4, W, ground + 10), fill=lerpc(AREIA, AREIA_MOLHADA, molhar) + (255,))
    # trenó + bloco
    d.line(P(sx - 10, ground, sx + 230, ground), fill=(110, 70, 35), width=8 * S)
    d.arc(P(sx + 200, ground - 40, sx + 260, ground + 2), 0, 90, fill=(110, 70, 35), width=8 * S)
    bloco(d, sx + 10, ground - 110, 190, 104)
    # corda + puxadores
    cx0 = sx + 245
    for i in range(6):
        px = cx0 + 60 + i * 55
        trabalhador(d, px, ground, fase=lt * 7 + i, braco=(px - 20, ground - 40))
    d.line(P(cx0, ground - 30, cx0 + 60 + 5 * 55, ground - 40), fill=(170, 130, 70), width=3 * S)
    # aguadeiro despejando água na frente do trenó
    ax = cx0 + 20
    trabalhador(d, ax, ground, pose="parado", braco=(ax + 24, ground - 50))
    d.polygon([tuple(P(ax + 20, ground - 64)), tuple(P(ax + 40, ground - 60)), tuple(P(ax + 34, ground - 44)),
               tuple(P(ax + 22, ground - 46))], fill=(170, 90, 50))
    for k in range(6):
        yy = ground - 44 + ((lt * 120 + k * 9) % 44)
        d.ellipse(P(ax + 34, yy, ax + 40, yy + 7), fill=(80, 150, 220))
    # medidor de força
    forca = lerp(1.0, 0.5, molhar)
    d.rounded_rectangle(P(820, 40, 1240, 140), radius=14 * S, fill=(20, 14, 8, 170))
    d.text(P(840, 50), "Força para puxar", font=fonte(22 * S), fill=(255, 248, 235))
    d.rounded_rectangle(P(840, 90, 1220, 120), radius=8 * S, fill=(80, 60, 40))
    cor = lerpc((220, 70, 50), (80, 190, 90), molhar)
    d.rounded_rectangle(P(840, 90, 840 + 380 * forca, 120), radius=8 * S, fill=cor)
    d.text(P(1150, 50), f"{int(forca * 100)}%", font=fonte(22 * S), fill=OURO)
    img = capitulo(img, 3, lt)
    return legenda(img, "3. Trenós e areia molhada", [
        "Molhar a areia na frente do trenó reduz o atrito pela metade",
        "(Univ. de Amsterdã, 2014) — cena pintada na tumba de Djehutihotep."], lt, dur)


def cena_rampa(lt, dur):
    img = CEUS["dia"].copy().convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 1150, 90, 38)
    chao(d, 560)
    base_y, cx, larg, alt = 560, 640, 760, 420
    camadas = 14
    fase1 = 6.0  # segundos construindo
    prog = ease(lt / fase1)
    n = int(prog * camadas) + 1
    n = min(n, camadas)
    hcam = alt / camadas
    for i in range(n):
        y1 = base_y - i * hcam
        y2 = y1 - hcam
        w1 = larg * (1 - i / camadas)
        w2 = larg * (1 - (i + 1) / camadas)
        tone = PEDRA if i % 2 == 0 else (205, 180, 136)
        d.polygon([tuple(P(cx - w1 / 2, y1)), tuple(P(cx + w1 / 2, y1)),
                   tuple(P(cx + w2 / 2, y2)), tuple(P(cx - w2 / 2, y2))], fill=tone)
        nb = max(1, int(w1 / 50))
        for b in range(1, nb):
            bxx = cx - w1 / 2 + b * w1 / nb
            d.line(P(bxx, y1, bxx, y2), fill=PEDRA_ESC, width=S)
        d.line(P(cx - w1 / 2, y1, cx + w1 / 2, y1), fill=PEDRA_ESC, width=S)
    # rampa reta de tijolos de barro até o topo atual
    topo_y = base_y - n * hcam
    w_topo = larg * (1 - n / camadas)
    if n < camadas:
        rx = cx - w_topo / 2
        comp = (base_y - topo_y) * 2.2
        d.polygon([tuple(P(rx - comp, base_y)), tuple(P(rx, topo_y)), tuple(P(rx, base_y))],
                  fill=(160, 112, 72))
        # bloco subindo a rampa
        k = (lt * 0.6) % 1
        bx = lerp(rx - comp, rx, k)
        by = lerp(base_y, topo_y, k)
        bloco(d, bx - 20, by - 26, 34, 24)
    else:
        # piramídio dourado no topo
        d.polygon([tuple(P(cx - 30, base_y - alt + 30)), tuple(P(cx, base_y - alt - 4)),
                   tuple(P(cx + 30, base_y - alt + 30))], fill=OURO)
    # painel com as 4 teorias (segunda metade)
    a = ease((lt - fase1 - 0.3) / 0.8)
    if a > 0:
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        o = ImageDraw.Draw(ov)
        o.rectangle(P(0, 0, W, H), fill=(20, 14, 8, int(200 * a)))
        nomes = ["Reta", "Zigue-zague", "Espiral", "Interna"]
        for j, nome in enumerate(nomes):
            k = ease((lt - fase1 - 0.5 - j * 0.6) / 0.8) * a
            ox = 70 + j * 290
            oy = 120
            o.rounded_rectangle(P(ox, oy, ox + 260, oy + 280), radius=16 * S,
                                fill=(60, 44, 30, int(255 * k)))
            pc = ox + 130
            pb = oy + 220
            o.polygon([tuple(P(pc - 90, pb)), tuple(P(pc, pb - 140)), tuple(P(pc + 90, pb))],
                      fill=PEDRA + (int(255 * k),))
            rc = (200, 90, 60, int(255 * k))
            if j == 0:
                o.line(P(pc - 120, pb, pc - 30, pb - 95), fill=rc, width=7 * S)
            elif j == 1:
                o.line(P(pc - 70, pb - 8, pc + 50, pb - 40, pc - 40, pb - 75, pc + 20, pb - 105,
                         pc - 5, pb - 125), fill=rc, width=6 * S, joint="curve")
            elif j == 2:
                o.line(P(pc - 85, pb - 4, pc + 75, pb - 20, pc + 10, pb - 50, pc - 50, pb - 70,
                         pc + 30, pb - 100, pc, pb - 130), fill=rc, width=6 * S, joint="curve")
            else:
                for q in range(0, 120, 12):
                    o.line(P(pc - 70 + q * 0.55, pb - 20 - q * 0.9, pc - 64 + q * 0.55, pb - 28 - q * 0.9),
                           fill=rc, width=5 * S)
            f = fonte(26 * S)
            l, t, r, b = o.textbbox((0, 0), nome, font=f)
            o.text((pc * S - (r - l) / 2, (oy + 236) * S), nome, font=f, fill=OURO + (int(255 * k),))
        texto_centro(o, "Qual rampa? Os arqueólogos ainda debatem", 50, 34, alfa=int(255 * a), sombra=False)
        img = Image.alpha_composite(img, ov)
    img = capitulo(img, 4, lt)
    return legenda(img, "4. Rampas", [
        "Rampas de tijolo de barro e entulho levavam os blocos para cima.",
        "Em 2018, achou-se em Hatnub uma rampa com postes e degraus laterais."], lt, dur)


def cena_alavancas(lt, dur):
    img = CEUS["tarde"].copy().convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    # degraus próximos do topo, visão aproximada
    for i in range(5):
        y = 620 - i * 90
        x0 = 80 + i * 120
        d.rectangle(P(x0, y - 90, W, y), fill=PEDRA if i % 2 else (205, 180, 136), outline=PEDRA_ESC, width=S)
    # bloco sendo alavancado (balança para cima)
    sobe = (math.sin(lt * 2.5) + 1) / 2
    bx, by = 470, 350 - 20 * sobe
    ang = -0.15 * sobe
    bloco(d, bx, by - 70, 130, 70)
    # alavanca de madeira
    px, py = bx - 10, 350
    d.ellipse(P(px - 12, py - 8, px + 12, py + 8), fill=(110, 70, 40))
    d.line(P(px + 40, py - 18 * sobe, px - 140, py + 60 * (1 - sobe) - 30), fill=(140, 90, 45), width=9 * S)
    trabalhador(d, px - 150, 440, pose="parado", braco=(px - 130, py + 60 * (1 - sobe) - 30))
    # revestimento branco polido aparecendo da direita
    rev = ease((lt - 2.5) / 3.0)
    if rev > 0:
        d.polygon([tuple(P(*p)) for p in [(W - 420 * rev, 620), (W, 620), (W, 620 - 400 * rev)]],
                  fill=CALCARIO)
        for k in range(int(30 * rev)):
            gx = W - (k * 37 % int(420 * rev + 1))
            gy = 620 - (k * 53 % int(400 * rev + 1))
            d.ellipse(P(gx, gy, gx + 4, gy + 4), fill=(255, 255, 255))
    img = capitulo(img, 5, lt)
    return legenda(img, "5. Alavancas e revestimento", [
        "Alavancas de madeira faziam o ajuste fino de cada bloco.",
        "Por fora, calcário branco polido: a pirâmide brilhava ao sol."], lt, dur)


def cena_trabalhadores(lt, dur):
    img = CEUS["aurora"].copy().convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    chao(d, 300)
    # pontinhos = equipes surgindo
    total = 30000
    prog = ease(lt / (dur * 0.7))
    cols, rows = 60, 20
    vis = int(prog * cols * rows)
    for idx in range(vis):
        c, r = idx % cols, idx // cols
        x = 90 + c * 18.5
        y = 330 + r * 12
        dy = 2 * math.sin(lt * 4 + idx)
        cor = PELE if (idx // 40) % 2 == 0 else (140, 88, 50)
        d.ellipse(P(x, y + dy, x + 7, y + 7 + dy), fill=cor)
    num = int(prog * total)
    texto_centro(d, f"~{num:,}".replace(",", "."), 110, 90, cor=OURO)
    texto_centro(d, "trabalhadores em equipes que se revezavam", 225, 30, negrito=False)
    img = capitulo(img, 6, lt)
    return legenda(img, "6. Quem construiu?", [
        "Não eram escravos: eram trabalhadores pagos com pão, cerveja e abrigo.",
        "Suas tumbas e a vila onde viviam foram achadas ao lado das pirâmides."], lt, dur)


def cena_final(lt, dur):
    k = ease(lt / 3)
    img = Image.blend(CEUS["tarde"], CEUS["noite"], k * 0.85).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(80):
        sx = (i * 977) % W
        sy = (i * 373) % 300
        a = int(255 * k * (0.5 + 0.5 * math.sin(lt * 3 + i)))
        d.ellipse(P(sx, sy, sx + 3, sy + 3), fill=(255, 255, 255, a))
    sol(d, 640, lerp(300, 620, k), 60, cor=(255, 190, 110))
    chao(d, 560, cor=lerpc(AREIA, (90, 70, 70), k), cor2=lerpc(AREIA_ESC, (70, 50, 55), k))
    piramide(d, 640, 560, 620, 360, cor=lerpc(CALCARIO, (180, 160, 170), k),
             sombra=lerpc((220, 205, 180), (120, 100, 120), k))
    d.polygon([tuple(P(610, 235)), tuple(P(640, 200)), tuple(P(670, 235))], fill=OURO)
    a = int(255 * ease((lt - 1) / 1))
    texto_centro(d, "Grande Pirâmide de Quéops", 70, 50, alfa=a)
    texto_centro(d, "146 m de altura • ~20 anos de obra • a mais alta do mundo por 3.800 anos",
                 140, 24, negrito=False, alfa=a)
    a2 = int(255 * ease((lt - 3.5) / 1))
    texto_centro(d, "Engenharia, organização e muita gente — não mistério.", 610, 30, cor=OURO, alfa=a2)
    return img


CENAS = [
    (cena_titulo, 6.0),
    (cena_pedreira, 9.0),
    (cena_nilo, 9.0),
    (cena_treno, 9.5),
    (cena_rampa, 12.0),
    (cena_alavancas, 8.5),
    (cena_trabalhadores, 8.5),
    (cena_final, 8.0),
]
FADE = 0.5  # transição em preto entre cenas
DUR_TOTAL = sum(d for _, d in CENAS)


# ---------------------------------------------------------------- áudio
def gerar_trilha(caminho, dur, sr=44100):
    t = np.arange(int(dur * sr)) / sr
    # drone (Ré + Lá) com leve tremolo
    drone = (0.18 * np.sin(2 * np.pi * 73.42 * t) + 0.10 * np.sin(2 * np.pi * 110.0 * t)
             + 0.05 * np.sin(2 * np.pi * 146.83 * t)) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.15 * t))
    # melodia dedilhada na escala Hijaz em Ré: D Eb F# G A Bb C D
    hijaz = [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 523.25, 587.33]
    frase = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 4, 3, 2, 1, 2, 3, 2, 1, 0, -1, 0, 0]
    mel = np.zeros_like(t)
    passo = 0.75
    rng = np.random.default_rng(7)
    n = 0
    tempo = 1.5
    while tempo < dur - 2:
        g = frase[n % len(frase)]
        f = hijaz[g] if g >= 0 else hijaz[6] / 2
        i0 = int(tempo * sr)
        L = int(1.6 * sr)
        seg = np.arange(min(L, len(t) - i0)) / sr
        env = np.exp(-seg * 3.2)
        nota = (np.sin(2 * np.pi * f * seg) + 0.5 * np.sin(2 * np.pi * 2 * f * seg)
                + 0.25 * np.sin(2 * np.pi * 3 * f * seg)) * env * 0.11
        mel[i0:i0 + len(seg)] += nota
        tempo += passo * (2 if n % 8 == 7 else 1) + rng.uniform(-0.02, 0.02)
        n += 1
    # percussão grave (tambor) a cada 1,5 s
    tambor = np.zeros_like(t)
    for bt in np.arange(0.0, dur, 1.5):
        i0 = int(bt * sr)
        seg = np.arange(min(int(0.4 * sr), len(t) - i0)) / sr
        tambor[i0:i0 + len(seg)] += np.sin(2 * np.pi * (60 + 40 * np.exp(-seg * 30)) * seg) * np.exp(-seg * 9) * 0.25
    mix = drone + mel + tambor
    fade = np.minimum(1, np.minimum(t / 2.0, (dur - t) / 3.0))
    mix = mix * fade
    mix = mix / (np.abs(mix).max() + 1e-9) * 0.8
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(caminho, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- render
def main():
    gerar_trilha(AUDIO, DUR_TOTAL)
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", AUDIO,
           "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", SAIDA]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(DUR_TOTAL * FPS)
    inicio = 0.0
    quadro = 0
    for func, dur in CENAS:
        nq = int(round(dur * FPS))
        for i in range(nq):
            lt = i / FPS
            img = func(lt, dur).convert("RGB").reduce(S)
            # fade de/para preto
            a = min(1.0, lt / FADE, (dur - lt) / FADE)
            if a < 1:
                arr = (np.asarray(img, dtype=np.float32) * max(a, 0)).astype(np.uint8)
            else:
                arr = np.asarray(img)
            proc.stdin.write(arr.tobytes())
            quadro += 1
            if quadro % 150 == 0:
                print(f"  quadro {quadro}/{total}", flush=True)
        inicio += dur
    proc.stdin.close()
    proc.wait()
    os.remove(AUDIO)
    print("pronto:", SAIDA)


if __name__ == "__main__":
    main()
