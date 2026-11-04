#!/usr/bin/env python3
"""
"Como construíram as Pirâmides?" — vídeo animado com narração e bonecos.

Formato "tentativa e erro": os personagens tentam uma ideia, ela dá ERRADO,
e eles corrigem até chegar na solução que os egípcios (provavelmente) usaram.

Tudo é gerado por código:
  * imagens: Pillow + NumPy (desenhado em 2x e reduzido -> antialias)
  * vozes:   Kokoro TTS (offline, vozes pt-BR)
  * trilha e efeitos sonoros: sintetizados com NumPy
  * vídeo:   ffmpeg (H.264 + AAC)

Uso:
    pip install pillow numpy kokoro-onnx soundfile
    # baixe kokoro-v1.0.onnx e voices-v1.0.bin de
    # https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
    KOKORO_DIR=/pasta/dos/modelos python3 gerar_video.py
"""
import hashlib
import math
import multiprocessing as mp
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ======================================================================= config
# Coordenadas sempre no espaço 1280x720. Desenha em S vezes e reduz por R.
#   padrão:     S=2, R=2 -> 1280x720
#   --youtube:  S=3, R=2 -> 1920x1080 (+ tela final, miniatura, legendas, descrição)
YOUTUBE = "--youtube" in sys.argv
SHORTS = "--shorts" in sys.argv   # vertical 1080x1920, até 60 s
W, H = 1280, 720
S = 3 if YOUTUBE else 2
R = 2
OUT_W, OUT_H = W * S // R, H * S // R
FPS = 30
SR = 44100
AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA_YT = os.path.join(AQUI, "youtube")
PASTA_SH = os.path.join(AQUI, "shorts")
if SHORTS:
    SAIDA = os.path.join(PASTA_SH, "piramides_shorts.mp4")
    OUT_W, OUT_H = 1080, 1920
elif YOUTUBE:
    SAIDA = os.path.join(PASTA_YT, "piramides_youtube_1080p.mp4")
else:
    SAIDA = os.path.join(AQUI, "piramides.mp4")
CACHE = os.path.join(AQUI, ".cache_vozes")
KOKORO_DIR = os.environ.get("KOKORO_DIR", os.path.join(AQUI, "modelos"))

VOZES = {"N": "pm_alex", "H": "pm_santa", "F": "pf_dora"}
NOMES = {"N": "NARRADOR", "H": "HEMIUNU", "F": "NEFERET"}
VELOCIDADE = {"N": 1.05, "H": 1.0, "F": 1.05}

FONTE_B = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
FONTE_R = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
if not os.path.exists(FONTE_B):
    FONTE_B = FONTE_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_fontes = {}


def fonte(tam, negrito=True):
    k = (tam, negrito)
    if k not in _fontes:
        _fontes[k] = ImageFont.truetype(FONTE_B if negrito else FONTE_R, int(tam))
    return _fontes[k]


AREIA = (222, 184, 120)
AREIA_ESC = (190, 148, 88)
AREIA_MOLHADA = (150, 110, 62)
PEDRA = (214, 190, 146)
PEDRA2 = (205, 180, 136)
PEDRA_ESC = (168, 140, 98)
CALCARIO = (246, 240, 226)
OURO = (240, 196, 60)
NILO = (52, 118, 160)
PELE = (150, 92, 52)
PELE_F = (176, 112, 66)
TINTA = (40, 28, 20)
VERMELHO = (215, 55, 45)
VERDE = (60, 170, 80)
LARANJA = (235, 140, 30)
BRANCO = (250, 247, 240)


# ======================================================================= util
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
    return [v * S for v in xy]


def T(pts):
    return [(x * S, y * S) for x, y in pts]


def rot(pts, cx, cy, ang):
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def gradiente(topo, base):
    a = np.linspace(0, 1, H * S)[:, None, None]
    g = np.array(topo)[None, None, :] * (1 - a) + np.array(base)[None, None, :] * a
    return Image.fromarray(np.repeat(g, W * S, axis=1).astype(np.uint8), "RGB")


CEUS = {
    "aurora": gradiente((40, 30, 70), (250, 160, 90)),
    "dia": gradiente((90, 160, 220), (240, 220, 180)),
    "tarde": gradiente((230, 140, 70), (250, 215, 150)),
    "noite": gradiente((12, 14, 36), (70, 50, 90)),
    "papiro": gradiente((236, 214, 168), (214, 184, 132)),
}


def ceu(nome):
    return CEUS[nome].copy().convert("RGBA")


def chao(d, y, cor=AREIA, cor2=AREIA_ESC):
    d.rectangle(P(0, y, W, H), fill=cor)
    pts = [(0, y)] + [(x, y - 12 - 10 * math.sin(x / 140.0)) for x in range(0, W + 40, 40)] + [(W, y)]
    d.polygon(T(pts), fill=cor2)


def sol(d, x, y, r, cor=(255, 224, 140)):
    for i, a in enumerate((60, 35, 18)):
        rr = r + 18 * (3 - i)
        d.ellipse(P(x - rr, y - rr, x + rr, y + rr), fill=cor + (a,))
    d.ellipse(P(x - r, y - r, x + r, y + r), fill=cor)


def piramide(d, cx, base_y, larg, alt, cor=PEDRA, sombra=PEDRA_ESC):
    topo = (cx, base_y - alt)
    d.polygon(T([(cx - larg / 2, base_y), topo, (cx, base_y)]), fill=cor)
    d.polygon(T([(cx, base_y), topo, (cx + larg / 2, base_y)]), fill=sombra)


def piramide_camadas(d, cx, base_y, larg, alt, camadas, n):
    hc = alt / camadas
    for i in range(n):
        y1, y2 = base_y - i * hc, base_y - (i + 1) * hc
        w1, w2 = larg * (1 - i / camadas), larg * (1 - (i + 1) / camadas)
        d.polygon(T([(cx - w1 / 2, y1), (cx + w1 / 2, y1), (cx + w2 / 2, y2), (cx - w2 / 2, y2)]),
                  fill=PEDRA if i % 2 == 0 else PEDRA2)
        nb = max(1, int(w1 / 48))
        for b in range(1, nb):
            bx = cx - w1 / 2 + b * w1 / nb
            d.line(P(bx, y1, bx, y2), fill=PEDRA_ESC, width=S)
        d.line(P(cx - w1 / 2, y1, cx + w1 / 2, y1), fill=PEDRA_ESC, width=S)
    return base_y - n * hc, larg * (1 - n / camadas)


def trabalhador(d, x, y, fase=0.0, escala=1.0, pose="andar", cor=PELE, braco=None):
    e = escala
    sw = max(2, int(4 * e)) * S
    perna, corpo, cab = 22 * e, 26 * e, 8 * e
    quadril, ombro = (x, y - perna), (x, y - perna - corpo)
    a = math.sin(fase) * 0.5 if pose == "andar" else 0.0
    for s in (1, -1):
        d.line(P(*quadril, x + math.sin(a * s) * perna, y), fill=cor, width=sw)
    d.line(P(*quadril, *ombro), fill=cor, width=sw)
    d.polygon(T([(x - 7 * e, y - perna + 2 * e), (x + 7 * e, y - perna + 2 * e),
                 (x + 4 * e, y - perna - 9 * e), (x - 4 * e, y - perna - 9 * e)]), fill=BRANCO)
    d.ellipse(P(ombro[0] - cab, ombro[1] - 2 * cab, ombro[0] + cab, ombro[1]), fill=cor)
    if braco is None:
        braco = (x + 18 * e * math.cos(a), ombro[1] + 14 * e)
    d.line(P(*ombro, *braco), fill=cor, width=sw)
    return ombro


def bloco(d, x, y, w, h, cor=PEDRA, borda=PEDRA_ESC):
    d.rectangle(P(x, y, x + w, y + h), fill=cor, outline=borda, width=2 * S)
    d.line(P(x + 4, y + 4, x + w - 4, y + 4), fill=lerpc(cor, (255, 255, 255), 0.35), width=S)


def bloco_rot(d, cx, cy, w, h, ang, cor=PEDRA, borda=PEDRA_ESC):
    pts = rot([(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2),
               (cx - w / 2, cy + h / 2)], cx, cy, ang)
    d.polygon(T(pts), fill=cor, outline=borda, width=2 * S)


def texto_centro(d, txt, y, tam, cor=(255, 255, 255), negrito=True, alfa=255, sombra=True, cx=W / 2):
    f = fonte(tam * S, negrito)
    l, t, r, b = d.textbbox((0, 0), txt, font=f)
    x = cx * S - (r - l) / 2
    if sombra:
        d.text((x + 3 * S, y * S + 3 * S), txt, font=f, fill=(0, 0, 0, int(alfa * 0.5)))
    d.text((x, y * S), txt, font=f, fill=tuple(cor[:3]) + (int(alfa),))


def quebrar(d, txt, f, larg):
    linhas, atual = [], ""
    for p in txt.split():
        teste = (atual + " " + p).strip()
        if d.textlength(teste, font=f) <= larg * S:
            atual = teste
        else:
            linhas.append(atual)
            atual = p
    if atual:
        linhas.append(atual)
    return linhas


def painel(d, x0, y0, x1, y1, a=1.0):
    d.rounded_rectangle(P(x0, y0, x1, y1), radius=14 * S, fill=(20, 14, 8, int(175 * a)))


# ======================================================================= vozes
_kokoro = None


def sintetizar(quem, texto):
    """retorna (amostras float32 @ SR) — com cache em disco"""
    global _kokoro
    os.makedirs(CACHE, exist_ok=True)
    h = hashlib.md5(f"{VOZES[quem]}|{VELOCIDADE[quem]}|{texto}".encode()).hexdigest()[:16]
    arq = os.path.join(CACHE, h + ".npy")
    if os.path.exists(arq):
        return np.load(arq)
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(os.path.join(KOKORO_DIR, "kokoro-v1.0.onnx"),
                         os.path.join(KOKORO_DIR, "voices-v1.0.bin"))
    amostras, sr = _kokoro.create(texto, voice=VOZES[quem], speed=VELOCIDADE[quem], lang="pt-br")
    amostras = np.asarray(amostras, dtype=np.float32)
    # reamostra para SR
    n = int(len(amostras) * SR / sr)
    amostras = np.interp(np.linspace(0, len(amostras) - 1, n), np.arange(len(amostras)), amostras)
    amostras = amostras.astype(np.float32)
    np.save(arq, amostras)
    return amostras


def envelope(amostras):
    """volume por quadro de vídeo (0..1) para animar a boca"""
    por_q = SR // FPS
    nq = int(math.ceil(len(amostras) / por_q))
    env = np.array([np.sqrt(np.mean(amostras[i * por_q:(i + 1) * por_q] ** 2) + 1e-12) for i in range(nq)])
    env = env / (np.percentile(env, 95) + 1e-9)
    return np.clip(env, 0, 1)


# ======================================================================= linha do tempo
class Fala:
    def __init__(self, quem, texto, tag, pausa, carimbo=None):
        self.quem, self.texto, self.tag, self.pausa, self.carimbo = quem, texto, tag, pausa, carimbo
        self.audio = sintetizar(quem, texto)
        self.dur = len(self.audio) / SR
        self.env = envelope(self.audio)
        self.ini = 0.0


class Cena:
    def __init__(self, titulo, desenho, falas, cabeca=0.8, cauda=1.2, entrada=None, fundo_musica=1.0):
        self.titulo, self.desenho, self.entrada = titulo, desenho, entrada or {}
        self.falas = [Fala(*f) if len(f) > 4 else Fala(*f, None) if len(f) == 4 else Fala(*f, 0.45)
                      for f in falas]
        t = cabeca
        for f in self.falas:
            f.ini = t
            t += f.dur + f.pausa
        self.dur = t - self.falas[-1].pausa + cauda
        self.tags = {f.tag: f for f in self.falas}
        self.carimbos = [(f.ini, f.carimbo) for f in self.falas if f.carimbo]

    def t(self, tag):
        return self.tags[tag].ini

    def desde(self, tag, lt):
        return lt - self.tags[tag].ini

    def prog(self, tag, lt, dur=1.0, atraso=0.0):
        return ease((self.desde(tag, lt) - atraso) / dur)

    def ativa(self, lt):
        for f in self.falas:
            if f.ini <= lt < f.ini + f.dur:
                return f
        return None

    def ultimo_carimbo(self, lt):
        ult = None
        for ini, tipo in self.carimbos:
            if ini <= lt:
                ult = (ini, tipo)
        return ult


# ======================================================================= bonecos
def boneco(d, x, pe, quem, t, amp=0.0, falando=False, expr="neutro", olhar=1, e=0.85):
    """personagem cartoon de frente. quem: 'H' (Hemiunu) ou 'F' (Neferet)"""
    bob = 2.0 * math.sin(t * 2.2 + (0 if quem == "H" else 1.3))
    if expr == "feliz":
        bob -= abs(6 * math.sin(t * 8))

    def Q(px, py):
        return (x * S + px * e * S, (pe + bob * (py / -230)) * S + py * e * S)

    def L(pts, cor, w):
        d.line([Q(*p) for p in pts], fill=cor, width=int(w * e * S), joint="curve")

    def E(cx, cy, rx, ry, **kw):
        a, b = Q(cx - rx, cy - ry), Q(cx + rx, cy + ry)
        d.ellipse([a[0], a[1], b[0], b[1]], **kw)

    pele = PELE if quem == "H" else PELE_F
    gordo = 1.18 if quem == "H" else 1.0
    lado = olhar  # braço que gesticula aponta para o centro
    # pernas
    for s in (-1, 1):
        L([(s * 12, -70), (s * 14, -4)], pele, 13)
        E(s * 17, -3, 11, 6, fill=(120, 80, 45))
    # corpo
    if quem == "H":
        corpo = [(-36, -152), (36, -152), (54, -95), (50, -48), (-50, -48), (-54, -95)]
        d.polygon([Q(*p) for p in corpo], fill=BRANCO, outline=TINTA, width=int(2 * S))
        L([(-30, -148), (34, -70)], OURO, 9)
    else:
        corpo = [(-27, -152), (27, -152), (36, -34), (-36, -34)]
        d.polygon([Q(*p) for p in corpo], fill=BRANCO, outline=TINTA, width=int(2 * S))
        d.polygon([Q(-29, -112), Q(29, -112), Q(30, -100), Q(-30, -100)], fill=VERMELHO)
    # colar largo (usekh)
    for i, c in enumerate(((40, 90, 170), OURO, VERMELHO, (40, 140, 120))):
        r = 40 - i * 6
        a, b = Q(-r * gordo * 0.9, -168 - r * 0.55), Q(r * gordo * 0.9, -168 + r * 0.55)
        d.chord([a[0], a[1], b[0], b[1]], 0, 180, fill=c)
    # braços
    ombros = {-1: (-32 * gordo, -146), 1: (32 * gordo, -146)}
    maos = {}
    for s in (-1, 1):
        if expr == "surpreso":
            maos[s] = (s * 44, -212)
        elif expr == "feliz":
            maos[s] = (s * (60 + 6 * math.sin(t * 10 + s)), -236)
        elif falando and s == lado:
            maos[s] = (s * 64, -150 - 22 * abs(math.sin(t * 5)) - 18 * amp)
        else:
            maos[s] = (s * 46 * gordo, -86)
        mx, my = maos[s]
        L([ombros[s], ((ombros[s][0] + mx) / 2 + s * 8, (ombros[s][1] + my) / 2), (mx, my)], pele, 11)
        E(mx, my, 7.5, 7.5, fill=pele)
    if quem == "H" and expr not in ("surpreso", "feliz"):
        mx, my = maos[-lado]
        d.rectangle([*Q(mx - 5, my - 28), *Q(mx + 5, my + 10)], fill=(236, 214, 160), outline=TINTA,
                    width=int(1.5 * S))
    # cabeça
    cy = -194
    r = 37 if quem == "H" else 34
    if quem == "F":  # parte de trás da peruca
        d.rounded_rectangle([*Q(-44, cy - 42), *Q(44, cy + 46)], radius=int(16 * e * S), fill=(20, 18, 24))
        for yy in (cy + 10, cy + 26, cy + 40):
            L([(-43, yy), (-34, yy)], (40, 90, 170), 3)
            L([(34, yy), (43, yy)], (40, 90, 170), 3)
    else:  # orelhas
        E(-r, cy + 2, 7, 10, fill=pele)
        E(r, cy + 2, 7, 10, fill=pele)
    E(0, cy, r, r, fill=pele)
    if quem == "F":
        a, b = Q(-37, cy - 44), Q(37, cy + 24)
        d.chord([a[0], a[1], b[0], b[1]], 180, 360, fill=(20, 18, 24))
        E(-20, cy + 16, 7, 4, fill=(220, 120, 110, 120))
        E(20, cy + 16, 7, 4, fill=(220, 120, 110, 120))
    else:
        E(-12, cy - 26, 10, 5, fill=(255, 255, 255, 70))
    # olhos
    piscar = (t + (0.0 if quem == "H" else 1.7)) % 3.7 < 0.12
    ry = 9.5 if expr == "surpreso" else 6.5
    for s in (-1, 1):
        ex, ey = s * 13, cy - 2
        if piscar:
            L([(ex - 8, ey), (ex + 8, ey)], TINTA, 2.5)
        else:
            E(ex, ey, 8.5, ry, fill=(255, 255, 255), outline=TINTA, width=int(2 * S))
            E(ex + olhar * 2.5, ey + 0.5, 4, 4, fill=TINTA)
        L([(ex + s * 8, ey), (ex + s * 15, ey - 3)], TINTA, 2.5)  # delineado (kohl)
        sob = 6 if expr == "surpreso" else 0
        L([(ex - 8, ey - 12 - sob), (ex + 8, ey - 13 - sob + (2 if expr == "feliz" else 0))], TINTA, 3)
    # boca
    my = cy + 17
    if falando:
        hm = 2 + 11 * amp
        E(0, my, 8 + 2 * amp, hm, fill=(110, 30, 30), outline=TINTA, width=int(1.5 * S))
    elif expr == "surpreso":
        E(0, my + 2, 6, 8, fill=(110, 30, 30), outline=TINTA, width=int(1.5 * S))
    elif expr == "feliz":
        a, b = Q(-14, my - 12), Q(14, my + 8)
        d.chord([a[0], a[1], b[0], b[1]], 0, 180, fill=(110, 30, 30), outline=TINTA, width=int(1.5 * S))
    else:
        a, b = Q(-9, my - 8), Q(9, my + 3)
        d.arc([a[0], a[1], b[0], b[1]], 20, 160, fill=TINTA, width=int(2.5 * S))
    if expr == "surpreso":  # gota de suor
        gx, gy = -olhar * (r + 6), cy - 20
        d.polygon([Q(gx, gy - 12), Q(gx - 6, gy + 2), Q(gx + 6, gy + 2)], fill=(90, 170, 240))
        E(gx, gy + 3, 6, 6, fill=(90, 170, 240))
    return Q(0, cy - r)  # topo da cabeça (coords 2x)


POS = {"H": 120, "F": 1160}
PE = 712


def camada_personagens(img, cena, lt, forcar=None, pos=None, pe=PE, e=0.85):
    pos = pos or POS
    d = ImageDraw.Draw(img, "RGBA")
    f = cena.ativa(lt)
    uc = cena.ultimo_carimbo(lt)
    expr = "neutro"
    if uc and lt - uc[0] < 2.6:
        expr = "feliz" if uc[1] == "CERTO" else "surpreso"
    if forcar:
        expr = forcar(lt) or expr
    topos = {}
    for quem in ("H", "F"):
        x = pos[quem]
        if quem in cena.entrada:
            k = cena.prog(cena.entrada[quem], lt, 1.2)
            fora = -140 if quem == "H" else W + 140
            x = lerp(fora, x, k)
            if k <= 0:
                continue
        falando = f is not None and f.quem == quem
        amp = 0.0
        if falando:
            i = int((lt - f.ini) * FPS)
            amp = float(f.env[min(i, len(f.env) - 1)])
        ex = expr if not falando else ("neutro" if expr != "feliz" else "feliz")
        if falando and ex == "feliz":
            ex = "neutro"
        topos[quem] = boneco(d, x, pe, quem, lt, amp, falando, ex, olhar=1 if quem == "H" else -1, e=e)
    return img, topos


def camada_fala(img, cena, lt, topos):
    f = cena.ativa(lt)
    if f is None:
        return img
    k = (lt - f.ini) / max(f.dur, 0.1)
    a = ease((lt - f.ini) / 0.2) * ease((f.ini + f.dur + 0.25 - lt) / 0.2)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    fnt = fonte(22 * S, False)
    if f.quem == "N":
        larg = 700
        linhas = quebrar(d, f.texto, fnt, larg)
        alt = 40 + 29 * len(linhas)
        x0, y1 = (W - larg - 40) / 2, H - 14
        y0 = y1 - alt
        d.rounded_rectangle(P(x0, y0, x0 + larg + 40, y1), radius=14 * S, fill=(20, 14, 8, int(200 * a)))
        d.text(P(x0 + 20, y0 + 8), NOMES["N"], font=fonte(15 * S), fill=OURO + (int(255 * a),))
        cor = (255, 248, 235)
    else:
        larg = 380
        linhas = quebrar(d, f.texto, fnt, larg)
        alt = 44 + 29 * len(linhas)
        tx, ty = (v / S for v in topos.get(f.quem, (POS[f.quem] * S, 480 * S)))
        y1 = ty - 22
        y0 = y1 - alt
        x0 = 24 if f.quem == "H" else W - 24 - larg - 36
        x1 = x0 + larg + 36
        d.rounded_rectangle(P(x0, y0, x1, y1), radius=18 * S, fill=(255, 252, 244, int(245 * a)),
                            outline=TINTA + (int(255 * a),), width=3 * S)
        bx = tx + (30 if f.quem == "H" else -30)
        d.polygon(T([(bx - 14, y1 - 3), (bx + 14, y1 - 3), (tx, ty - 4)]),
                  fill=(255, 252, 244, int(245 * a)))
        d.line(P(bx - 14, y1, tx, ty - 4, bx + 14, y1), fill=TINTA + (int(255 * a),), width=3 * S)
        d.text(P(x0 + 18, y0 + 8), NOMES[f.quem], font=fonte(15 * S),
               fill=((180, 120, 20) if f.quem == "H" else VERMELHO) + (int(255 * a),))
        cor = TINTA
    total = sum(len(l) for l in linhas)
    mostrar = int(total * clamp(k * 1.15))
    for i, ln in enumerate(linhas):
        parte = ln[:max(0, mostrar)]
        mostrar -= len(ln)
        d.text(P(x0 + 18 if f.quem != "N" else x0 + 20, y0 + 30 + 29 * i), parte, font=fnt,
               fill=cor + (int(255 * a),))
    return Image.alpha_composite(img, ov)


def camada_carimbo(img, cena, lt):
    uc = cena.ultimo_carimbo(lt)
    if not uc:
        return img
    dt = lt - uc[0]
    if dt > 2.6:
        return img
    tipo = uc[1]
    cor = {"ERRO": VERMELHO, "CERTO": VERDE, "MITO": VERMELHO, "QUASE": LARANJA}[tipo]
    rotulo = {"ERRO": "ERRO!", "CERTO": "DEU CERTO!", "MITO": "MITO!", "QUASE": "QUASE..."}[tipo]
    pop = 1.6 - 0.6 * ease(dt / 0.22)
    a = ease((2.6 - dt) / 0.4)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    fnt = fonte(60 * S * pop)
    l, t_, r, b = d.textbbox((0, 0), rotulo, font=fnt)
    wt, ht = r - l, b - t_
    ic = 70 * S * pop
    cx, cy = W * S / 2, 255 * S
    larg = wt + ic + 70 * S
    x0, y0 = cx - larg / 2, cy - ht / 2 - 26 * S
    d.rounded_rectangle([x0, y0, x0 + larg, y0 + ht + 52 * S], radius=int(20 * S), fill=(255, 255, 255, int(235 * a)),
                        outline=cor + (int(255 * a),), width=int(7 * S))
    ix, iy = x0 + 28 * S, cy - ic / 2
    if tipo in ("CERTO",):
        d.line([(ix, iy + ic * 0.55), (ix + ic * 0.38, iy + ic * 0.9), (ix + ic, iy + ic * 0.1)],
               fill=cor + (int(255 * a),), width=int(12 * S * pop), joint="curve")
    elif tipo == "QUASE":
        d.text((ix + ic * 0.25, iy - ic * 0.15), "!", font=fonte(ic * 1.1), fill=cor + (int(255 * a),))
    else:
        w_ = int(12 * S * pop)
        d.line([(ix, iy), (ix + ic, iy + ic)], fill=cor + (int(255 * a),), width=w_)
        d.line([(ix + ic, iy), (ix, iy + ic)], fill=cor + (int(255 * a),), width=w_)
    d.text((ix + ic + 24 * S, cy - ht / 2 - t_), rotulo, font=fnt, fill=cor + (int(255 * a),))
    return Image.alpha_composite(img, ov)


def camada_titulo(img, titulo, lt):
    if not titulo:
        return img
    a = ease(lt / 0.5)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    fnt = fonte(22 * S)
    wt = d.textlength(titulo, font=fnt)
    x0 = (W * S - wt) / 2 - 20 * S
    d.rounded_rectangle([x0, 16 * S, x0 + wt + 40 * S, 56 * S], radius=int(12 * S), fill=(20, 14, 8, int(170 * a)))
    d.text((x0 + 20 * S, 24 * S), titulo, font=fnt, fill=OURO + (int(255 * a),))
    return Image.alpha_composite(img, ov)


# ======================================================================= cenas
def d_abertura(lt, c):
    img = ceu("aurora")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 640, lerp(520, 330, ease(lt / 6)), 70)
    chao(d, 540)
    for cx, lg, al, atr in ((330, 360, 210, 0.4), (640, 560, 330, 0.0), (930, 300, 170, 0.8)):
        piramide(d, cx, 540, lg, al * ease((lt - atr) / 2.5), cor=(130, 90, 70), sombra=(90, 60, 50))
    a = 255 * ease((lt - 0.6) / 1.0) * (1 - c.prog("hem", lt, 0.8) * 0.0)
    texto_centro(d, "Como construíram", 80, 60, alfa=a)
    texto_centro(d, "as Pirâmides do Egito?", 150, 60, cor=OURO, alfa=a)
    a2 = 255 * ease((c.desde("b", lt)) / 0.8)
    texto_centro(d, "sem guindastes • sem máquinas • sem ferro", 232, 26, negrito=False, alfa=a2)
    return img


SHARDS = [((-40, -10), (-70, 30), 0.5), ((10, -20), (30, -40), -0.7), ((50, 5), (90, 50), 1.1),
          ((-10, 20), (-20, 70), -0.3), ((30, 25), (40, 75), 0.9), ((-55, 15), (-110, 60), 1.4)]


def d_pedreira(lt, c):
    img = ceu("dia")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 1040, 120, 42)
    chao(d, 540)
    d.polygon(T([(150, 540), (150, 260), (420, 260), (420, 340), (1130, 340), (1130, 540)]), fill=(200, 168, 116))
    for y in (340, 440):
        d.line(P(150, y, 1130, y), fill=PEDRA_ESC, width=2 * S)
    bx, by, bw, bh = 560, 340, 170, 100   # bloco embutido na rocha
    tf, tx1, tx2 = c.desde("fail", lt), c.desde("fix1", lt), c.desde("fix2", lt)
    if tf < 0:
        # tentativa: marretadas
        d.rectangle(P(bx, by, bx + bw, by + bh), outline=PEDRA_ESC, width=S)
        golpe = abs(math.sin(lt * 6))
        mx, my = bx - 10, by - 40 + 30 * golpe
        trabalhador(d, bx - 50, by, pose="parado", braco=(mx, my), escala=1.3)
        d.rectangle(P(mx - 12, my - 16, mx + 14, my + 2), fill=(110, 110, 110))
        k = clamp((c.desde("try", lt)) / 3.0)
        for i in range(int(k * 5)):  # rachaduras aparecendo
            x0 = bx + 20 + i * 30
            d.line(P(x0, by, x0 + 15, by + 40, x0 - 5, by + 70), fill=TINTA, width=2 * S)
    elif tx1 < 0:
        # pedra estilhaçada
        k = ease(tf / 0.6)
        for (ox, oy), (vx, vy), ang in SHARDS:
            cx, cy = bx + bw / 2 + ox + vx * k, by + bh / 2 + oy + vy * k
            cy = min(cy, 528)
            pts = rot([(cx - 22, cy - 14), (cx + 18, cy - 20), (cx + 26, cy + 10), (cx - 6, cy + 18)], cx, cy,
                      ang * k * 2)
            d.polygon(T(pts), fill=PEDRA, outline=PEDRA_ESC, width=2 * S)
        trabalhador(d, bx - 50, by, pose="parado", braco=(bx - 30, by - 70), escala=1.3)
    else:
        # método certo: sulco + cunhas
        sulco = ease(tx1 / 3.0)
        d.rectangle(P(bx, by, bx + bw, by + bh), outline=PEDRA_ESC, width=S)
        d.line(P(bx + bw, by, bx + bw, by + bh * sulco), fill=TINTA, width=5 * S)
        d.line(P(bx, by, bx, by + bh * sulco), fill=TINTA, width=5 * S)
        nc = int(clamp(tx2 / 2.0) * 5) if tx2 > 0 else 0
        sai = ease((tx2 - 2.4) / 1.6) if tx2 > 0 else 0
        if sai > 0:
            d.rectangle(P(bx, by, bx + bw, by + bh), fill=(150, 122, 84))
        bloco(d, bx + 320 * sai, by - 0 * sai, bw, bh)
        for i in range(nc if sai == 0 else 0):
            wx = bx + 15 + i * 32
            d.polygon(T([(wx, by + bh - 4), (wx + 16, by + bh - 4), (wx + 8, by + bh + 14)]), fill=(120, 80, 40))
        golpe = abs(math.sin(lt * 6))
        mx, my = bx - 4, by - 36 + 26 * golpe
        trabalhador(d, bx - 50, by, pose="parado", braco=(mx, my), escala=1.3)
        d.line(P(mx, my, mx + 10, my + 30), fill=(200, 120, 60), width=4 * S)  # cinzel de cobre
        if c.desde("fact", lt) > 0:
            for i in range(int(clamp(c.desde("fact", lt) / 3) * 6)):
                bloco(d, 860 + (i % 3) * 82, 470 - (i // 3) * 62, 78, 60)
            a = 255 * c.prog("fact", lt, 0.6)
            painel(d, 330, 80, 950, 150, a / 255)
            texto_centro(d, "2.300.000 blocos • ~2,5 toneladas cada", 98, 30, cor=OURO, alfa=a, sombra=False)
    return img


def d_transporte(lt, c):
    img = ceu("dia")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 300, 120, 40)
    chao(d, 470)
    piramide(d, 1000, 470, 260, 150, cor=(225, 195, 140), sombra=(200, 165, 115))
    g = 560
    tf, tx1 = c.desde("fail", lt), c.desde("fix1", lt)
    if tx1 < 0:
        # carroça com rodas
        andou = min(c.desde("try", lt), c.t("fail") - c.t("try"))
        k = clamp(andou / 4.0)
        afunda = ease(tf / 0.8) if tf > 0 else 0
        cx = 260 + 200 * k
        if afunda > 0:
            d.ellipse(P(cx - 30, g - 8 + 14 * afunda, cx + 250, g + 30), fill=(170, 130, 80))
        ang = -0.12 * afunda
        bloco_rot(d, cx + 110, g - 100 + 20 * afunda, 170, 80, ang)
        d.polygon(T(rot([(cx, g - 58), (cx + 220, g - 58), (cx + 220, g - 48), (cx, g - 48)], cx + 110,
                        g - 53, ang)), fill=(110, 70, 35))
        for i, wx in enumerate((cx + 40, cx + 180)):
            r = 34
            wy = g - r + 22 * afunda
            if i == 1 and afunda > 0:
                wx += 220 * ease((tf - 0.5) / 1.5)
                wy = g - r
            gira = lt * 4 if tf < 0 else (lt * 6 if i == 1 else 0)
            d.ellipse(P(wx - r, wy - r, wx + r, wy + r), outline=(110, 70, 35), width=6 * S)
            for s in range(4):
                a_ = gira + s * math.pi / 4
                d.line(P(wx - r * math.cos(a_), wy - r * math.sin(a_), wx + r * math.cos(a_), wy + r * math.sin(a_)),
                       fill=(110, 70, 35), width=3 * S)
        for i in range(3):
            px = cx + 280 + i * 50
            trabalhador(d, px, g, fase=lt * 7 + i if tf < 0 else 0, braco=(px - 20, g - 40), escala=1.1)
        d.line(P(cx + 220, g - 53, cx + 400, g - 45), fill=(170, 130, 70), width=3 * S)
        return img
    # trenó
    tx2 = c.desde("fix2", lt)
    molhar = ease(tx2 / 1.5) if tx2 > 0 else 0
    vel = 12 if molhar < 0.5 else 40
    base = 260 + 12 * tx1 if tx2 < 0 else 260 + 12 * (c.t("fix2") - c.t("fix1")) + 40 * tx2
    sx = min(base, 420)
    if molhar > 0:
        d.rectangle(P(0, g - 4, W, g + 12), fill=lerpc(AREIA, AREIA_MOLHADA, molhar))
    d.line(P(sx - 10, g, sx + 200, g), fill=(110, 70, 35), width=8 * S)
    d.arc(P(sx + 170, g - 40, sx + 230, g + 2), 0, 90, fill=(110, 70, 35), width=8 * S)
    bloco(d, sx + 10, g - 96, 170, 90)
    cx0 = sx + 215
    esforco = c.desde("fail2", lt) > 0 and molhar < 0.6
    for i in range(6):
        px = cx0 + 70 + i * 48
        trabalhador(d, px, g, fase=lt * (4 if molhar < 0.5 else 9) + i, braco=(px - 20, g - 40), escala=1.1)
        if esforco and int(lt * 4 + i) % 2 == 0:
            d.ellipse(P(px + 6, g - 70, px + 12, g - 62), fill=(90, 170, 240))
    d.line(P(cx0, g - 30, cx0 + 70 + 5 * 48, g - 44), fill=(170, 130, 70), width=3 * S)
    if tx2 > 0:
        ax = cx0 + 25
        trabalhador(d, ax, g, pose="parado", braco=(ax + 24, g - 55), escala=1.1)
        d.polygon(T([(ax + 20, g - 70), (ax + 42, g - 66), (ax + 36, g - 48), (ax + 22, g - 50)]), fill=(170, 90, 50))
        for k in range(6):
            yy = g - 48 + ((lt * 120 + k * 9) % 46)
            d.ellipse(P(ax + 34, yy, ax + 40, yy + 7), fill=(80, 150, 220))
    forca = lerp(1.0, 0.5, molhar)
    painel(d, 440, 72, 840, 150)
    d.text(P(460, 80), "Força para puxar", font=fonte(20 * S), fill=(255, 248, 235))
    d.text(P(770, 80), f"{int(forca * 100)}%", font=fonte(20 * S), fill=OURO)
    d.rounded_rectangle(P(460, 112, 820, 136), radius=8 * S, fill=(80, 60, 40))
    d.rounded_rectangle(P(460, 112, 460 + 360 * forca, 136), radius=8 * S,
                        fill=lerpc((220, 70, 50), (80, 190, 90), molhar))
    return img


def mapa(d, lt, c):
    d.rectangle(P(0, 0, W, H), fill=(232, 208, 160))
    for i in range(40):
        x, y = (i * 389) % W, (i * 211) % 600
        d.ellipse(P(x, y, x + 60, y + 18), fill=(222, 196, 146))
    rio = [(330, 160), (360, 230), (420, 290), (470, 340), (560, 370), (650, 400), (720, 430), (800, 450),
           (870, 470), (950, 500), (1000, 540)]
    d.line(T(rio), fill=NILO, width=10 * S, joint="curve")
    for (x, y), nome in (((330, 160), "Gizé"), ((1000, 540), "Assuã")):
        d.ellipse(P(x - 10, y - 10, x + 10, y + 10), fill=VERMELHO, outline=TINTA, width=2 * S)
        d.text(P(x + 16, y - 14), nome, font=fonte(26 * S), fill=TINTA)
    d.text(P(560, 300), "~800 km", font=fonte(26 * S), fill=TINTA)
    k = clamp(c.desde("try", lt) / 12.0)
    i = k * (len(rio) - 1)
    j = min(int(i), len(rio) - 2)
    fx = lerp(rio[j][0], rio[j + 1][0], i - j)
    fy = lerp(rio[j][1], rio[j + 1][1], i - j) + 40
    # rastro do arrasto pelo deserto
    d.line(P(1000, 580, fx, fy), fill=(150, 110, 70), width=3 * S)
    bloco(d, fx - 14, fy - 12, 28, 18)
    dias = int(c.desde("try", lt) * 47)
    painel(d, 760, 90, 1120, 160)
    d.text(P(780, 104), f"Arrastando... dia {max(0, dias)}", font=fonte(26 * S), fill=(255, 248, 235))


def d_nilo(lt, c):
    tx = c.desde("fix", lt)
    if tx < 0:
        img = ceu("papiro")
        d = ImageDraw.Draw(img, "RGBA")
        mapa(d, lt, c)
        return img
    img = ceu("tarde")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 260, 170, 55)
    d.rectangle(P(0, 330, W, 380), fill=(200, 160, 100))
    canal = c.desde("fix2", lt) > 0
    piramide(d, 1040, 340, 220, 130, cor=(200, 150, 100), sombra=(170, 120, 80))
    for px in (120, 180, 470, 720, 800):
        d.line(P(px, 340, px + 6, 290), fill=(110, 80, 50), width=4 * S)
        for a in range(5):
            ang = -2.6 + a * 0.6
            d.line(P(px + 6, 290, px + 6 + 34 * math.cos(ang), 300 + 22 * math.sin(ang)), fill=(60, 110, 50), width=5 * S)
    d.rectangle(P(0, 380, W, 600), fill=NILO)
    if canal:
        k = c.prog("fix2", lt, 1.5)
        d.polygon(T([(900, 380), (980, 380), (1000, 380 - 40 * k), (960, 380 - 40 * k)]), fill=NILO)
    for i in range(26):
        y = 395 + (i % 7) * 28
        x = ((i * 157 + lt * 60) % (W + 100)) - 50
        d.line(P(x, y, x + 40, y), fill=(120, 180, 210), width=2 * S)
    d.rectangle(P(0, 600, W, H), fill=AREIA)
    bx = lerp(-200, 900, ease(tx / 7.0))
    by = 480 + 4 * math.sin(lt * 2)
    d.polygon(T([(bx - 150, by - 20), (bx + 150, by - 20), (bx + 110, by + 22), (bx - 110, by + 22)]), fill=(130, 80, 40))
    d.line(P(bx - 150, by - 20, bx - 175, by - 45), fill=(130, 80, 40), width=8 * S)
    d.line(P(bx + 150, by - 20, bx + 175, by - 45), fill=(130, 80, 40), width=8 * S)
    bloco(d, bx - 55, by - 72, 110, 52, cor=(175, 95, 95), borda=(120, 60, 60))
    d.line(P(bx + 20, by - 20, bx + 20, by - 200), fill=(100, 70, 40), width=5 * S)
    d.polygon(T([(bx + 24, by - 195), (bx + 120, by - 120), (bx + 24, by - 60)]), fill=(245, 235, 210))
    for i in range(3):
        trabalhador(d, bx - 120 + i * 40, by - 20, pose="parado", escala=0.7,
                    braco=(bx - 100 + i * 40, by + 10 + 6 * math.sin(lt * 3 + i)))
    tf = c.desde("fact", lt)
    if tf > 0:
        a = c.prog("fact", lt, 0.8)
        larg = 520 * a
        x0 = 640 - larg / 2
        d.rectangle(P(x0, 90, x0 + larg, 200), fill=(236, 214, 160), outline=(150, 110, 60), width=2 * S)
        for r in range(4):
            for q in range(int(larg / 22)):
                xx = x0 + 14 + q * 22
                yy = 110 + r * 22 + 3 * math.sin(q * 1.7 + r)
                d.arc(P(xx, yy, xx + 14, yy + 12), 180, 360 if (q + r) % 3 else 270, fill=TINTA, width=2 * S)
        if a > 0.9:
            texto_centro(d, "Diário de Merer • papiro de ~2560 a.C.", 212, 22, cor=BRANCO)
    return img


def d_rampa(lt, c):
    img = ceu("dia")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 1150, 90, 38)
    tx = c.desde("fix", lt)
    if tx < 0:
        # rampa reta: câmera afastando
        k = ease(c.desde("try", lt) / (c.t("fix") - c.t("try") - 1.0))
        z = lerp(1.0, 0.27, k)
        g = 560
        cx = lerp(820, 1040, k)
        chao(d, g)
        larg, alt = 700 * z, 420 * z
        d.polygon(T([(cx - larg / 2, g), (cx, g - alt), (cx + larg / 2, g)]), outline=PEDRA_ESC, width=2 * S)
        piramide_camadas(d, cx, g, larg, alt, 14, 8)
        topo = g - alt * 8 / 14
        rx = cx - larg / 2 * (1 - 8 / 14)
        comp = alt * 8 / 14 * 7.5 * clamp(k * 1.3)
        d.polygon(T([(rx - comp, g), (rx, topo), (rx, g)]), fill=(160, 112, 72))
        km = 1.6 * clamp(k * 1.3)
        painel(d, 380, 76, 900, 150)
        texto_centro(d, f"Rampa reta: {km:.1f} km".replace(".", ","), 92, 34, cor=OURO, sombra=False)
        return img
    g = 560
    chao(d, g)
    cx, larg, alt = 640, 700, 420
    k = ease(tx / 8.0)
    n = max(2, min(14, int(2 + k * 12)))
    topo_y, w_top = piramide_camadas(d, cx, g, larg, alt, 14, n)
    # rampa em zigue-zague colada na face
    pts = []
    hc = alt / 14
    for i in range(n + 1):
        y = g - i * hc
        wi = larg * (1 - i / 14)
        lado = -1 if i % 2 == 0 else 1
        pts.append((cx + lado * wi / 2 * 0.85, y))
    d.line(T(pts), fill=(170, 100, 60), width=9 * S, joint="curve")
    m = (lt * 0.5) % 1 * (len(pts) - 1)
    j = min(int(m), len(pts) - 2)
    bx, by = lerp(pts[j][0], pts[j + 1][0], m - j), lerp(pts[j][1], pts[j + 1][1], m - j)
    bloco(d, bx - 12, by - 20, 24, 16)
    if n >= 14:
        d.polygon(T([(cx - 30, g - alt + 30), (cx, g - alt - 4), (cx + 30, g - alt + 30)]), fill=OURO)
    tf = c.desde("fact", lt)
    if tf > 0:
        a = c.prog("fact", lt, 0.6)
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        o = ImageDraw.Draw(ov)
        o.rounded_rectangle(P(330, 80, 950, 400), radius=18 * S, fill=(30, 22, 14, int(225 * a)))
        texto_centro(o, "Hatnub, 2018: rampa com degraus e postes", 96, 26, cor=OURO, alfa=255 * a, sombra=False)
        # rampa íngreme com escadas dos lados
        A = int(255 * a)
        o.polygon(T([(420, 370), (860, 370), (860, 160)]), fill=(160, 112, 72, A))
        for q in range(12):
            x = 440 + q * 36
            y = 370 - (x - 420) / 440 * 210
            o.line(P(x, y + 8, x + 30, y + 8), fill=(220, 190, 140, A), width=3 * S)
        for q in range(3):
            px = 560 + q * 110
            py = 370 - (px - 420) / 440 * 210
            o.rectangle(P(px - 5, py - 40, px + 5, py), fill=(110, 70, 35, A))
        sx = 470 + 300 * ((lt * 0.15) % 1)
        sy = 370 - (sx - 420) / 440 * 210
        o.rectangle(P(sx - 20, sy - 30, sx + 20, sy), fill=PEDRA + (A,), outline=PEDRA_ESC + (A,), width=2 * S)
        o.line(P(sx + 20, sy - 15, 870, 150), fill=(200, 160, 90, A), width=2 * S)
        img = Image.alpha_composite(img, ov)
    return img


def d_alinhar(lt, c):
    img = ceu("tarde")
    d = ImageDraw.Draw(img, "RGBA")
    tf, tx, tfa = c.desde("fail", lt), c.desde("fix", lt), c.desde("fact", lt)
    if tf > 0 and tx < 0:
        # exagero: erro na base vira erro no topo
        chao(d, 560)
        piramide(d, 640, 560, 700, 400, cor=(225, 200, 150), sombra=(200, 170, 120))
        k = c.prog("fail", lt, 1.0)
        d.line(P(290, 560, 640, 160), fill=VERDE, width=4 * S)
        d.line(P(990 + 18, 560 - 30 * k, 640 + 90 * k, 160 + 10 * k), fill=VERMELHO, width=5 * S)
        d.ellipse(P(640 + 90 * k - 26, 150 + 10 * k - 26, 640 + 90 * k + 26, 150 + 10 * k + 26),
                  outline=VERMELHO, width=4 * S)
        painel(d, 380, 76, 900, 140)
        texto_centro(d, "2 cm na base → metros no topo", 88, 30, cor=OURO, sombra=False)
        return img
    for i in range(4):
        y = 620 - i * 95
        x0 = 210 + i * 110
        d.rectangle(P(x0, y - 95, 1080, y), fill=PEDRA if i % 2 else PEDRA2, outline=PEDRA_ESC, width=S)
    bx, by = 560, 335
    if tx < 0:
        ang = 0.18 + 0.02 * math.sin(lt * 3)
        bloco_rot(d, bx + 70, by - 40, 140, 80, ang)
        d.arc(P(bx - 10, by - 90, bx + 150, by + 10), -10, 12, fill=VERMELHO, width=4 * S)
        d.text(P(bx + 160, by - 70), "torto!", font=fonte(30 * S), fill=VERMELHO)
    else:
        k = c.prog("fix", lt, 3.0)
        sobe = (math.sin(lt * 5) + 1) / 2 * (1 - k)
        ang = 0.18 * (1 - k) - 0.03 * sobe
        bloco_rot(d, bx + 70, by - 40 - 6 * sobe, 140, 80, ang)
        px, py = bx - 8, by - 6
        d.ellipse(P(px - 12, py - 8, px + 12, py + 8), fill=(110, 70, 35))
        d.line(P(px + 40, py - 14 * sobe, px - 150, py + 55 * (1 - sobe) - 30), fill=(140, 90, 45), width=9 * S)
        trabalhador(d, px - 165, 430, pose="parado", braco=(px - 140, py + 55 * (1 - sobe) - 30), escala=1.2)
    if tfa > 0:
        a = c.prog("fact", lt, 0.6)
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        o = ImageDraw.Draw(ov)
        A = int(255 * a)
        o.rounded_rectangle(P(300, 80, 980, 330), radius=18 * S, fill=(30, 22, 14, int(225 * a)))
        texto_centro(o, "Nível com água: menos de ~2 cm em 230 m", 96, 26, cor=OURO, alfa=A, sombra=False)
        o.rectangle(P(340, 200, 940, 300), fill=(200, 160, 110, A))
        for q in range(5):
            x = 370 + q * 120
            o.rectangle(P(x, 200, x + 60, 250), fill=(70, 140, 200, A))
        o.line(P(340, 200, 940, 200), fill=(255, 255, 255, A), width=2 * S)
        for q in range(0, 600, 30):
            o.line(P(340 + q, 190, 355 + q, 190), fill=(255, 255, 255, A), width=2 * S)
        img = Image.alpha_composite(img, ov)
    return img


def d_pessoas(lt, c):
    img = ceu("aurora")
    d = ImageDraw.Draw(img, "RGBA")
    chao(d, 300)
    tx = c.desde("fix", lt)
    if tx < 0:
        for i in range(60):
            x = 300 + (i % 15) * 46
            y = 360 + (i // 15) * 45
            trabalhador(d, x, y + 30, pose="parado", escala=0.9,
                        braco=(x + 14, y - 2 + 3 * math.sin(lt * 3 + i)))
        if c.desde("fail", lt) < 0:
            texto_centro(d, "?", 90, 150, cor=OURO)
        return img
    prog = ease(tx / 6.0)
    cols, rows = 46, 16
    vis = int(prog * cols * rows)
    for idx in range(vis):
        cc, r = idx % cols, idx // cols
        x = 220 + cc * 18.5
        y = 330 + r * 12
        dy = 2 * math.sin(lt * 4 + idx)
        d.ellipse(P(x, y + dy, x + 7, y + 7 + dy), fill=PELE if (idx // 40) % 2 == 0 else (175, 110, 60))
    # ícones: pão, cerveja, casa, médico
    icones = ["pão", "cerveja", "casa", "médico"]
    some = 1 - c.prog("fact", lt, 0.5)
    for j, nome in enumerate(icones):
        a = 255 * ease((tx - 0.8 - j * 0.7) / 0.5) * some
        if a <= 0:
            continue
        ix = 330 + j * 180
        iy = 150
        d.rounded_rectangle(P(ix - 60, iy - 60, ix + 60, iy + 70), radius=14 * S, fill=(30, 22, 14, int(a * 0.8)))
        if j == 0:
            d.ellipse(P(ix - 34, iy - 22, ix + 34, iy + 16), fill=(200, 140, 70, int(a)))
            d.arc(P(ix - 20, iy - 18, ix + 20, iy + 6), 200, 340, fill=(140, 90, 40, int(a)), width=3 * S)
        elif j == 1:
            d.polygon(T([(ix - 16, iy - 34), (ix + 16, iy - 34), (ix + 24, iy + 4), (ix, iy + 24), (ix - 24, iy + 4)]),
                      fill=(170, 100, 60, int(a)))
        elif j == 2:
            d.rectangle(P(ix - 30, iy - 10, ix + 30, iy + 22), fill=(210, 170, 110, int(a)))
            d.rectangle(P(ix - 8, iy + 2, ix + 8, iy + 22), fill=(90, 60, 40, int(a)))
            d.rectangle(P(ix - 34, iy - 18, ix + 34, iy - 10), fill=(150, 110, 70, int(a)))
        else:
            d.rectangle(P(ix - 8, iy - 30, ix + 8, iy + 20), fill=(255, 255, 255, int(a)))
            d.rectangle(P(ix - 25, iy - 13, ix + 25, iy + 3), fill=(255, 255, 255, int(a)))
        f = fonte(20 * S)
        wt = d.textlength(nome, font=f)
        d.text((ix * S - wt / 2, (iy + 34) * S), nome, font=f, fill=OURO + (int(a),))
    if c.desde("fix2", lt) > 0:
        a = 255 * c.prog("fix2", lt, 0.6)
        d.rounded_rectangle(P(420, 268, 860, 316), radius=24 * S, fill=(245, 230, 190, int(a)),
                            outline=(180, 120, 20, int(a)), width=3 * S)
        texto_centro(d, "“Amigos de Quéops”", 274, 28, cor=(120, 70, 20), alfa=a, sombra=False)
    if c.desde("fact", lt) > 0:
        a = 255 * c.prog("fact", lt, 0.6)
        texto_centro(d, "20 a 30 mil", 80, 80, cor=OURO, alfa=a)
        texto_centro(d, "trabalhadores, em turnos", 180, 30, alfa=a)
    return img


def d_final(lt, c):
    k = ease(c.desde("b", lt) / 4)
    img = Image.blend(CEUS["tarde"], CEUS["noite"], k * 0.8).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(80):
        sx, sy = (i * 977) % W, (i * 373) % 300
        a = int(255 * k * (0.5 + 0.5 * math.sin(lt * 3 + i)))
        d.ellipse(P(sx, sy, sx + 3, sy + 3), fill=(255, 255, 255, a))
    sol(d, 640, lerp(300, 640, k), 60, cor=(255, 190, 110))
    chao(d, 560, cor=lerpc(AREIA, (110, 85, 80), k), cor2=lerpc(AREIA_ESC, (85, 65, 65), k))
    constr = ease(lt / 3.5)
    n = int(constr * 14)
    if n < 14:
        piramide_camadas(d, 640, 560, 560, 290, 14, n)
    else:
        piramide(d, 640, 560, 560, 290, cor=lerpc(CALCARIO, (190, 170, 180), k),
                 sombra=lerpc((220, 205, 180), (130, 110, 130), k))
        d.polygon(T([(613, 284), (640, 269), (667, 284)]), fill=OURO)
    a = 255 * ease(c.desde("b", lt) / 1)
    texto_centro(d, "Grande Pirâmide de Quéops", 76, 46, alfa=a)
    texto_centro(d, "146 m • ~20 anos de obra • a mais alta do mundo por ~3.800 anos", 140, 22,
                 negrito=False, alfa=a)
    a2 = 255 * ease(c.desde("end", lt) / 1)
    texto_centro(d, "Tentativa, erro e muita gente trabalhando junto.", 188, 28, cor=OURO, alfa=a2)
    a3 = 255 * ease((c.desde("end", lt) - 2.5) / 1)
    texto_centro(d, "Hemiunu foi o arquiteto real da Grande Pirâmide • Neferet é personagem fictícia",
                 230, 16, negrito=False, alfa=a3)
    return img


# ======================================================================= roteiro
# (quem, texto, tag, pausa_depois, carimbo)
ROTEIRO = [
    ("", d_abertura, [
        ("N", "Egito, dois mil quinhentos e sessenta antes de Cristo.", "a", 0.4),
        ("N", "O faraó Quéops quer a maior pirâmide do mundo. Sem guindastes, sem máquinas e sem ferro.", "b", 0.5),
        ("N", "Quem vai resolver isso é Hemiunu, o arquiteto...", "hem", 0.3),
        ("N", "e Neferet, a chefe das equipes de trabalho.", "nef", 0.4),
        ("H", "Fácil! O que pode dar errado?", "go", 0.3),
        ("F", "Tudo, Hemiunu. Tudo.", "go2", 0.6),
    ], {"H": "hem", "F": "nef"}),
    ("1 • A pedra", d_pedreira, [
        ("H", "Primeiro passo: pedra! Vamos quebrar a rocha na marretada.", "try", 0.6),
        ("N", "Crack! O bloco racha todo torto. Pedra irregular não dá para empilhar.", "fail", 0.6, "ERRO"),
        ("F", "Assim não dá. Primeiro a gente cava um sulco reto, com cinzéis de cobre e martelos de pedra.", "fix1", 0.4),
        ("F", "Depois enfia cunhas de madeira e bate nelas. Aí a pedra se solta inteira!", "fix2", 1.2, "CERTO"),
        ("N", "Foram uns dois milhões e trezentos mil blocos. Em média, duas toneladas e meia cada um.", "fact", 0.4),
    ]),
    ("2 • Arrastar o bloco", d_transporte, [
        ("F", "Agora é só colocar o bloco numa carroça com rodas!", "try", 1.0),
        ("N", "As rodas finas afundam na areia, e o eixo de madeira não aguenta o peso.", "fail", 0.6, "ERRO"),
        ("H", "Nada de rodas. Um trenó de madeira desliza por cima da areia.", "fix1", 1.2),
        ("F", "Desliza... mas olha o esforço! Vamos precisar do dobro de gente.", "fail2", 0.6, "QUASE"),
        ("H", "Então joga água na areia, bem na frente do trenó.", "fix2", 1.4, "CERTO"),
        ("N", "Areia molhada na medida certa corta pela metade a força necessária. Uma pintura egípcia de quatro mil anos mostra exatamente isso.", "fact", 0.4),
    ]),
    ("3 • Pedras de longe", d_nilo, [
        ("F", "E o granito? Ele vem de Assuã, a oitocentos quilômetros daqui!", "try", 0.3),
        ("F", "Arrastando pelo deserto, vai levar anos...", "try2", 0.4),
        ("N", "Arrastar pedras de várias toneladas por oitocentos quilômetros de deserto? Impossível.", "fail", 0.6, "ERRO"),
        ("H", "A gente não arrasta. O Nilo carrega! Os barcos descem o rio junto com a correnteza.", "fix", 0.4, "CERTO"),
        ("H", "E na época da cheia, um canal leva os barcos até o pé da pirâmide.", "fix2", 0.5),
        ("N", "O diário de um inspetor chamado Merer, um dos papiros mais antigos do mundo, registra essas viagens de barco.", "fact", 0.4),
    ]),
    ("4 • Subir os blocos", d_rampa, [
        ("H", "Hora de subir. Uma rampa reta, direto até o topo!", "try", 0.5),
        ("N", "Para chegar a cento e quarenta e seis metros sem ficar íngreme demais, essa rampa teria mais de um quilômetro e meio, e mais material do que a própria pirâmide!", "fail", 0.6, "ERRO"),
        ("F", "Então a rampa abraça a pirâmide. Ela vai subindo em zigue-zague, colada nas paredes.", "fix", 2.0, "CERTO"),
        ("N", "Até hoje ninguém sabe qual rampa foi usada. Mas em dois mil e dezoito, arqueólogos acharam numa pedreira uma rampa íngreme, com degraus e postes para puxar as cordas.", "fact", 0.4),
    ]),
    ("5 • Tudo no lugar", d_alinhar, [
        ("F", "Ih, Hemiunu... esse bloco ficou torto!", "try", 0.5),
        ("N", "E um errinho de poucos centímetros na base vira um erro de metros lá no topo. As faces não se encontram!", "fail", 0.6, "ERRO"),
        ("H", "Alavancas de madeira! Com elas, a gente ajusta cada bloco no lugar certinho.", "fix", 1.0, "CERTO"),
        ("H", "E para deixar o chão plano, usamos valas com água. A superfície da água é sempre reta.", "fact", 0.3),
        ("N", "Resultado: a base da Grande Pirâmide tem só uns dois centímetros de desnível, em mais de duzentos e trinta metros.", "fact2", 0.4),
    ]),
    ("6 • Quem construiu?", d_pessoas, [
        ("F", "Isso tudo precisa de muita gente. Vamos usar escravos?", "try", 0.4),
        ("N", "Esse é um mito famoso, mas está errado.", "fail", 0.6, "MITO"),
        ("H", "Nada disso! Trabalhadores pagos, com pão, cerveja, casa e até médico.", "fix", 0.4, "CERTO"),
        ("F", "E as equipes tinham até nomes, como os Amigos de Quéops!", "fix2", 0.5),
        ("N", "Arqueólogos acharam a vila e os túmulos desses trabalhadores, bem ao lado das pirâmides. Eram de vinte a trinta mil pessoas, trabalhando em turnos.", "fact", 0.4),
    ]),
    ("", d_final, [
        ("N", "Uns vinte anos depois...", "a", 0.6),
        ("N", "A Grande Pirâmide: cento e quarenta e seis metros. A construção mais alta do mundo por quase quatro mil anos.", "b", 0.5),
        ("H", "Errar fez parte do projeto.", "h", 0.3),
        ("F", "E cada erro virou uma solução!", "f", 0.4),
        ("N", "Não foi magia. Foi tentativa, erro, e muita gente trabalhando junto.", "end", 0.3),
    ]),
]


def feliz_final(cena):
    def f(lt):
        return "feliz" if cena.desde("h", lt) > 0 else None
    return f


# ======================================================================= áudio
def tom(f, dur, decai=4.0, amp=0.3, onda="seno"):
    t = np.arange(int(dur * SR)) / SR
    if onda == "quadrada":
        s = np.sign(np.sin(2 * np.pi * f * t))
    else:
        s = np.sin(2 * np.pi * f * t)
    return (s * np.exp(-t * decai) * amp).astype(np.float32)


def sfx(tipo):
    if tipo in ("ERRO", "MITO"):
        a = tom(150, 0.55, 2.5, 0.22, "quadrada")
        b = tom(110, 0.55, 2.5, 0.22, "quadrada")
        return np.concatenate([a[:int(0.25 * SR)], b])
    if tipo == "QUASE":
        return np.concatenate([tom(440, 0.18, 6, 0.25), tom(392, 0.35, 5, 0.25)])
    if tipo == "CERTO":
        return np.concatenate([tom(660, 0.12, 8, 0.25), tom(880, 0.12, 8, 0.25), tom(1320, 0.6, 4, 0.25)])
    return np.zeros(1, np.float32)


def musica(dur):
    t = np.arange(int(dur * SR)) / SR
    drone = (0.18 * np.sin(2 * np.pi * 73.42 * t) + 0.10 * np.sin(2 * np.pi * 110.0 * t)
             + 0.05 * np.sin(2 * np.pi * 146.83 * t)) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.15 * t))
    hijaz = [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 523.25, 587.33]
    frase = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 4, 3, 2, 1, 2, 3, 2, 1, 0, 0]
    mel = np.zeros_like(t)
    tempo, n = 1.0, 0
    while tempo < dur - 2:
        f = hijaz[frase[n % len(frase)]]
        i0 = int(tempo * SR)
        seg = np.arange(min(int(1.6 * SR), len(t) - i0)) / SR
        mel[i0:i0 + len(seg)] += (np.sin(2 * np.pi * f * seg) + 0.5 * np.sin(4 * np.pi * f * seg)) * np.exp(-seg * 3.2) * 0.1
        tempo += 0.8 * (2 if n % 8 == 7 else 1)
        n += 1
    tambor = np.zeros_like(t)
    for bt in np.arange(0.0, dur, 1.6):
        i0 = int(bt * SR)
        seg = np.arange(min(int(0.4 * SR), len(t) - i0)) / SR
        tambor[i0:i0 + len(seg)] += np.sin(2 * np.pi * (60 + 40 * np.exp(-seg * 30)) * seg) * np.exp(-seg * 9) * 0.25
    m = drone + mel + tambor
    return (m / np.abs(m).max()).astype(np.float32)


def mixar(cenas, caminho):
    dur = sum(c.dur for c in cenas)
    n = int(dur * SR) + SR
    voz = np.zeros(n, np.float32)
    efeitos = np.zeros(n, np.float32)
    t0 = 0.0
    for c in cenas:
        for f in c.falas:
            i = int((t0 + f.ini) * SR)
            voz[i:i + len(f.audio)] += f.audio
            if f.carimbo:
                s = sfx(f.carimbo)
                efeitos[i:i + len(s)] += s
        t0 += c.dur
    # "ducking": música abaixa quando alguém fala
    m = musica(n / SR)
    ativo = np.convolve((np.abs(voz) > 0.01).astype(np.float32), np.ones(SR // 4) / (SR // 4), mode="same")
    ganho = 0.16 - 0.10 * np.clip(ativo * 3, 0, 1)
    mix = voz * 0.95 + m * ganho + efeitos * 0.8
    tt = np.arange(n) / SR
    mix *= np.minimum(1, np.minimum(tt / 1.0, (n / SR - tt) / 2.0))
    mix = mix / (np.abs(mix).max() + 1e-9) * 0.9
    with wave.open(caminho, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    return dur


# ======================================================================= tela final (YouTube)
def d_tela_final(lt, c):
    img = ceu("aurora")
    d = ImageDraw.Draw(img, "RGBA")
    chao(d, 560)
    for cx, lg, al in ((330, 300, 170), (640, 460, 270), (930, 260, 150)):
        piramide(d, cx, 560, lg, al, cor=(130, 90, 70, 120), sombra=(90, 60, 50, 120))
    a = 255 * ease(lt / 0.8)
    texto_centro(d, "Obrigado por assistir!", 70, 48, cor=OURO, alfa=a)
    # áreas livres para os elementos de tela final do YouTube Studio
    k = ease((lt - 0.5) / 0.8)
    d.rounded_rectangle(P(250, 200, 730, 470), radius=16 * S, fill=(20, 14, 8, int(110 * k)),
                        outline=(255, 255, 255, int(120 * k)), width=2 * S)
    texto_centro(d, "▶ próximo vídeo", 320, 26, alfa=160 * k, sombra=False, cx=490)
    d.ellipse(P(840, 230, 1060, 450), fill=(20, 14, 8, int(110 * k)), outline=(255, 255, 255, int(120 * k)),
              width=2 * S)
    texto_centro(d, "inscreva-se", 324, 24, alfa=160 * k, sombra=False, cx=950)
    return img


FALAS_TELA_FINAL = [
    ("N", "Gostou? Então se inscreve no canal, e conta nos comentários: qual construção antiga a gente explica no próximo vídeo?", "cta", 0.3),
]


# ======================================================================= Shorts (vertical)
def d_gancho(lt, c):
    img = ceu("aurora")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 640, lerp(520, 300, ease(lt / 4)), 70)
    chao(d, 540)
    for cx, lg, al, atr in ((330, 360, 210, 0.3), (640, 560, 330, 0.0), (930, 300, 170, 0.6)):
        piramide(d, cx, 540, lg, al * ease((lt - atr) / 1.8), cor=(130, 90, 70), sombra=(90, 60, 50))
    return img


ROTEIRO_SHORTS = [
    ("", d_gancho, [
        ("H", "Construir uma pirâmide gigante, sem nenhuma máquina? Fácil!", "b", 0.2),
        ("F", "Fácil nada. Olha só!", "hem", 0.1),
    ]),
    ("1 • Arrastar o bloco", d_transporte, [
        ("F", "Põe o bloco numa carroça com rodas!", "try", 0.5),
        ("N", "As rodas afundam na areia.", "fail", 0.4, "ERRO"),
        ("H", "Então, um trenó de madeira!", "fix1", 0.6),
        ("F", "Ainda tá pesado demais!", "fail2", 0.3, "QUASE"),
        ("H", "Joga água na areia!", "fix2", 0.7, "CERTO"),
        ("N", "Areia molhada corta o esforço pela metade.", "fact", 0.2),
    ]),
    ("2 • Subir os blocos", d_rampa, [
        ("H", "Agora, uma rampa reta até o topo!", "try", 0.3),
        ("N", "Ela teria um quilômetro e meio!", "fail", 0.4, "ERRO"),
        ("F", "Então em zigue-zague, colada na pirâmide.", "fix", 0.9, "CERTO"),
        ("N", "Acharam uma rampa assim, com degraus e postes.", "fact", 0.2),
    ]),
    ("3 • Quem construiu?", d_pessoas, [
        ("F", "E a gente usa escravos?", "try", 0.2),
        ("N", "Mito!", "fail", 0.3, "MITO"),
        ("H", "Trabalhadores pagos, com pão, cerveja e médico!", "fix", 0.2, "CERTO"),
        ("F", "E equipes como os Amigos de Quéops!", "fix2", 0.2),
        ("N", "Uns vinte a trinta mil.", "fact", 0.2),
    ]),
    ("", d_final, [
        ("N", "Vinte anos depois: a Grande Pirâmide!", "b", 0.2),
        ("H", "Errar fez parte do projeto!", "h", 0.2),
        ("N", "Segue o canal pra mais!", "end", 0.2),
    ]),
]

SH_CENA_Y = 330          # onde a cena 16:9 entra no quadro vertical (espaço 1080x1920)
SH_POS = {"H": 250, "F": 660}
SH_PE = 1720
SH_E = 1.75
_FUNDO_SH = None


def fundo_shorts():
    global _FUNDO_SH
    if _FUNDO_SH is None:
        a = np.linspace(0, 1, 1920 * S)[:, None, None]
        g = np.array((28, 20, 40))[None, None, :] * (1 - a) + np.array((222, 184, 120))[None, None, :] * a
        _FUNDO_SH = Image.fromarray(np.repeat(g, 1080 * S, axis=1).astype(np.uint8), "RGB").convert("RGBA")
        d = ImageDraw.Draw(_FUNDO_SH, "RGBA")
        d.rectangle(P(0, SH_PE - 20, 1080, 1920), fill=AREIA)
        d.rectangle(P(0, SH_PE - 26, 1080, SH_PE - 20), fill=AREIA_ESC)
    return _FUNDO_SH.copy()


def fala_vertical(img, cena, lt, topos):
    f = cena.ativa(lt)
    if f is None:
        return img
    k = (lt - f.ini) / max(f.dur, 0.1)
    a = ease((lt - f.ini) / 0.15) * ease((f.ini + f.dur + 0.2 - lt) / 0.15)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    fnt = fonte(46 * S)
    x0, x1 = 50, 900          # evita os botões do Shorts à direita
    linhas = quebrar(d, f.texto, fnt, x1 - x0 - 60)
    alt = 80 + 60 * len(linhas)
    y0 = 975
    narr = f.quem == "N"
    fundo = (20, 14, 8, int(215 * a)) if narr else (255, 252, 244, int(245 * a))
    d.rounded_rectangle(P(x0, y0, x1, y0 + alt), radius=28 * S, fill=fundo,
                        outline=None if narr else TINTA + (int(255 * a),), width=5 * S)
    if not narr and f.quem in topos:
        tx, ty = (v / S for v in topos[f.quem])
        bx = min(max(tx, x0 + 60), x1 - 60)
        d.polygon(T([(bx - 26, y0 + alt - 4), (bx + 26, y0 + alt - 4), (tx, ty - 8)]), fill=fundo)
        d.line(P(bx - 26, y0 + alt, tx, ty - 8, bx + 26, y0 + alt), fill=TINTA + (int(255 * a),), width=5 * S)
    cor_nome = OURO if narr else ((180, 120, 20) if f.quem == "H" else VERMELHO)
    d.text(P(x0 + 30, y0 + 16), NOMES[f.quem], font=fonte(26 * S), fill=cor_nome + (int(255 * a),))
    cor = (255, 248, 235) if narr else TINTA
    total = sum(len(l) for l in linhas)
    mostrar = int(total * clamp(k * 1.25))
    for i, ln in enumerate(linhas):
        d.text(P(x0 + 30, y0 + 56 + 60 * i), ln[:max(0, mostrar)], font=fnt, fill=cor + (int(255 * a),))
        mostrar -= len(ln)
    return Image.alpha_composite(img, ov)


def quadro_vertical(c, lt, t_global, dur_total):
    cena = c.desenho(lt, c)
    cena = camada_titulo(cena, c.titulo, lt)
    cena = camada_carimbo(cena, c, lt)
    cena = cena.convert("RGB").resize((1080 * S, 608 * S), Image.LANCZOS)
    img = fundo_shorts()
    img.paste(cena, (0, SH_CENA_Y * S))
    d = ImageDraw.Draw(img, "RGBA")
    # título fixo no topo + barra de progresso
    texto_centro(d, "COMO FIZERAM", 110, 78, cx=540)
    texto_centro(d, "AS PIRÂMIDES?", 200, 78, cor=OURO, cx=540)
    d.rectangle(P(0, SH_CENA_Y + 608, 1080 * t_global / dur_total, SH_CENA_Y + 616), fill=OURO)
    forcar = None
    if c.desenho is d_final:
        forcar = feliz_final(c)
    img, topos = camada_personagens(img, c, lt, forcar, pos=SH_POS, pe=SH_PE, e=SH_E)
    img = fala_vertical(img, c, lt, topos)
    return img.convert("RGB").reduce(R)


def descricao_shorts(cenas, caminho):
    dur = sum(c.dur for c in cenas)
    txt = f"""TÍTULO:
Como fizeram as Pirâmides? (eles erraram MUITO) #Shorts

TÍTULOS ALTERNATIVOS:
- Rodas na areia? ERRO! Como as Pirâmides foram feitas #Shorts
- Os egípcios erraram até acertar as Pirâmides #Shorts

DESCRIÇÃO:
Rodas afundam, rampa reta não dá... como os egípcios resolveram cada problema para construir a \
Grande Pirâmide? Versão completa no canal!
Hemiunu foi o arquiteto real da Grande Pirâmide; Neferet é personagem fictícia.

#Shorts #piramides #egito #historia #curiosidades

DURAÇÃO: {dur:.1f} s  (vertical 1080x1920)
DICA: no YouTube Studio, use "Vídeo relacionado" para ligar este Short ao vídeo completo.
"""
    with open(caminho, "w", encoding="utf-8") as fh:
        fh.write(txt)


# ======================================================================= render
def montar_cenas():
    cenas = []
    for item in (ROTEIRO_SHORTS if SHORTS else ROTEIRO):
        titulo, desenho, falas = item[:3]
        entrada = item[3] if len(item) > 3 else None
        if SHORTS:
            cenas.append(Cena(titulo, desenho, falas, entrada=entrada, cabeca=0.3, cauda=0.5))
        else:
            cenas.append(Cena(titulo, desenho, falas, entrada=entrada))
    if YOUTUBE:
        cenas.append(Cena("", d_tela_final, FALAS_TELA_FINAL, cauda=4.0))
    return cenas


def quadro(c, lt):
    img = c.desenho(lt, c)
    forcar = None
    if c.desenho is d_final:
        forcar = feliz_final(c)
    elif c.desenho is d_tela_final:
        forcar = lambda _lt: "feliz"
    img, topos = camada_personagens(img, c, lt, forcar)
    img = camada_titulo(img, c.titulo, lt)
    img = camada_carimbo(img, c, lt)
    img = camada_fala(img, c, lt, topos)
    return img.convert("RGB").reduce(R)


_CENAS = None
_INICIOS = None


def _render(job):
    ci, i = job
    c = _CENAS[ci]
    lt = i / FPS
    if SHORTS:
        arr = np.asarray(quadro_vertical(c, lt, _INICIOS[ci] + lt, _INICIOS[-1]))
    else:
        arr = np.asarray(quadro(c, lt))
    fade = 0.12 if SHORTS else 0.35
    a = min(1.0, lt / fade, (c.dur - lt) / fade)
    if a < 1:
        arr = (arr.astype(np.float32) * max(a, 0)).astype(np.uint8)
    return arr.tobytes()


def fmt_srt(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def fmt_cap(t):
    t = int(t)
    return f"{t // 60}:{t % 60:02d}"


def legendas_srt(cenas, caminho):
    """legendas: falas longas são divididas em blocos de até 2 linhas de ~42 caracteres"""
    blocos, t0 = [], 0.0
    for c in cenas:
        for f in c.falas:
            palavras, partes, atual = f.texto.split(), [], ""
            alvo = len(f.texto) / math.ceil(len(f.texto) / 84)  # blocos de tamanho parecido
            for p in palavras:
                if len(atual) + len(p) + 1 > alvo + 6 and atual:
                    partes.append(atual)
                    atual = p
                else:
                    atual = (atual + " " + p).strip()
            partes.append(atual)
            total = sum(len(x) for x in partes)
            ini = t0 + f.ini
            for x in partes:
                fim = ini + f.dur * len(x) / total
                meio = len(x) // 2
                if len(x) > 42:
                    corte = x.rfind(" ", 0, meio + 8)
                    corte = corte if corte > 0 else meio
                    x = x[:corte] + "\n" + x[corte + 1:]
                blocos.append((ini, fim, x))
                ini = fim
        t0 += c.dur
    with open(caminho, "w", encoding="utf-8") as fh:
        for n, (a, b, x) in enumerate(blocos, 1):
            fh.write(f"{n}\n{fmt_srt(a)} --> {fmt_srt(b)}\n{x}\n\n")


def descricao(cenas, caminho):
    caps, t0 = [], 0.0
    nomes = ["Introdução"] + [c.titulo.split("• ")[-1] for c in cenas[1:]]
    for c, nome in zip(cenas, nomes):
        if c.desenho is d_final:
            nome = "O resultado"
        elif c.desenho is d_tela_final:
            nome = "Encerramento"
        caps.append(f"{fmt_cap(t0)} {nome}")
        t0 += c.dur
    txt = f"""TÍTULO (até 100 caracteres):
Como construíram as Pirâmides do Egito? (sem guindastes, sem máquinas e sem ferro)

TÍTULOS ALTERNATIVOS:
- Eles erraram MUITO até construir as Pirâmides
- Como as Pirâmides foram construídas, explicado com animação
- 2,3 milhões de blocos sem máquinas: como fizeram as Pirâmides?

DESCRIÇÃO:
Como os egípcios construíram a Grande Pirâmide de Gizé há 4.500 anos, sem guindastes, sem rodas \
e sem ferro? Acompanhe o arquiteto Hemiunu e a chefe de equipe Neferet tentando, errando e \
corrigindo cada etapa da obra: da pedreira ao topo da pirâmide.

Neste vídeo:
🪨 como cortavam blocos de 2,5 toneladas
🛷 por que molhar a areia reduzia o esforço pela metade
⛵ como o granito viajou 800 km pelo Nilo
📐 as teorias das rampas e a descoberta de Hatnub
👷 quem eram os trabalhadores (spoiler: não eram escravos)

CAPÍTULOS:
{chr(10).join(caps)}

Fontes e curiosidades:
• Papiros de Wadi al-Jarf (Diário de Merer), descobertos em 2013
• Fall et al., Physical Review Letters (2014): atrito de trenós em areia molhada
• Rampa de Hatnub: IFAO / Universidade de Liverpool (2018)
• Vila e túmulos dos trabalhadores de Gizé (escavações de Zahi Hawass e Mark Lehner)

Hemiunu foi o arquiteto real da Grande Pirâmide. Neferet é uma personagem fictícia.
Animação, vozes e trilha gerados por código.

#piramides #egito #historia

TAGS:
pirâmides, pirâmides do egito, como construíram as pirâmides, grande pirâmide de gizé, quéops, \
egito antigo, história, hemiunu, curiosidades históricas, arqueologia, animação, engenharia antiga

CATEGORIA: Educação
IDIOMA: Português (Brasil)
LEGENDAS: enviar legendas_pt-BR.srt
TELA FINAL: adicionar nos últimos ~{cenas[-1].dur:.0f} s (vídeo à esquerda, botão de inscrição à direita)
"""
    with open(caminho, "w", encoding="utf-8") as fh:
        fh.write(txt)


def miniatura(caminho):
    img = ceu("tarde")
    d = ImageDraw.Draw(img, "RGBA")
    sol(d, 940, 300, 120, cor=(255, 230, 150))
    chao(d, 560)
    piramide(d, 900, 560, 700, 420, cor=(230, 200, 140), sombra=(190, 150, 100))
    d.polygon(T([(430, 560), (700, 380), (700, 560)]), fill=(160, 112, 72))  # rampa
    bloco_rot(d, 600, 430, 90, 60, -0.55)
    boneco(d, 250, 760, "H", 1.0, expr="surpreso", olhar=1, e=1.75)
    f = fonte(118 * S)
    for i, (txt, cor) in enumerate((("COMO", BRANCO), ("FIZERAM?", OURO))):
        x, y = 470 * S, (40 + i * 125) * S
        d.text((x, y), txt, font=f, fill=cor, stroke_width=10 * S, stroke_fill=TINTA)
    d.rounded_rectangle(P(860, 540, 1240, 680), radius=20 * S, fill=(255, 255, 255), outline=VERMELHO, width=9 * S)
    d.line(P(890, 570, 960, 650), fill=VERMELHO, width=14 * S)
    d.line(P(960, 570, 890, 650), fill=VERMELHO, width=14 * S)
    d.text(P(985, 560), "ERRO!", font=fonte(78 * S), fill=VERMELHO)
    img.convert("RGB").resize((1280, 720), Image.LANCZOS).save(caminho, quality=92)


def main():
    global _CENAS, _INICIOS
    print("gerando vozes...", flush=True)
    cenas = montar_cenas()
    _CENAS = cenas
    _INICIOS = list(np.cumsum([0.0] + [c.dur for c in cenas]))
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    audio = os.path.join(AQUI, "_audio.wav")
    dur = mixar(cenas, audio)
    print(f"duração: {dur:.1f} s  •  {OUT_W}x{OUT_H}", flush=True)
    if SHORTS and dur > 59.5:
        sys.exit(f"Short passou de 60 s ({dur:.1f} s): encurte o ROTEIRO_SHORTS")
    if SHORTS:
        descricao_shorts(cenas, os.path.join(PASTA_SH, "descricao_shorts.txt"))
    if YOUTUBE or SHORTS:
        venc = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high",
                "-bf", "2", "-g", str(FPS // 2), "-pix_fmt", "yuv420p",
                "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k",
                "-ar", "48000", "-ac", "2"]
    if YOUTUBE:
        legendas_srt(cenas, os.path.join(PASTA_YT, "legendas_pt-BR.srt"))
        descricao(cenas, os.path.join(PASTA_YT, "descricao.txt"))
        miniatura(os.path.join(PASTA_YT, "miniatura.jpg"))
        # recomendações do YouTube: GOP fechado de meio segundo, 2 B-frames, áudio 48 kHz estéreo,
        # volume normalizado em -14 LUFS
        venc = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high",
                "-bf", "2", "-g", str(FPS // 2), "-pix_fmt", "yuv420p",
                "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k",
                "-ar", "48000", "-ac", "2"]
    elif not SHORTS:
        venc = ["-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k"]
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OUT_W}x{OUT_H}", "-r", str(FPS), "-i", "-",
           "-i", audio, *venc, "-shortest", "-movflags", "+faststart", SAIDA]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    jobs = [(ci, i) for ci, c in enumerate(cenas) for i in range(int(round(c.dur * FPS)))]
    with mp.get_context("fork").Pool(os.cpu_count()) as pool:
        for q, buf in enumerate(pool.imap(_render, jobs, chunksize=8), 1):
            proc.stdin.write(buf)
            if q % 300 == 0:
                print(f"  quadro {q}/{len(jobs)}", flush=True)
    proc.stdin.close()
    proc.wait()
    os.remove(audio)
    print("pronto:", SAIDA)


if __name__ == "__main__":
    main()
