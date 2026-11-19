#!/usr/bin/env python3
"""Animação: Mato Grosso x Mato Grosso do Sul — debate até o desempate.

Os bonecos falam (voz sintetizada com espeak-ng + mbrola br1/br3) o que cada estado
tem de melhor, tema por tema, até o round de desempate.
Gera debate_mt_ms.mp4 (1280x720, 30fps).
Requisitos: apt-get install espeak-ng mbrola-br1 mbrola-br3 ; pip install pillow numpy
Uso: python3 debate_mt_ms.py [--winner MT|MS] [--preview t1,t2,...]
"""
import json, math, random, subprocess, sys, wave, os, hashlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, SS, FPS = 1280, 720, 2, 30
GROUND = 640
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
args = sys.argv[1:]
WINNER = args[args.index("--winner") + 1] if "--winner" in args else "MT"
LOSER = "MS" if WINNER == "MT" else "MT"
PREVIEW = [float(x) for x in args[args.index("--preview") + 1].split(",")] if "--preview" in args else None

random.seed(7)
_fonts = {}
def font(sz):
    sz = max(4, int(sz * SS))
    if sz not in _fonts:
        _fonts[sz] = ImageFont.truetype(FONT, sz)
    return _fonts[sz]

def lerp(a, b, t): return a + (b - a) * t
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out(t): t = clamp(t); return 1 - (1 - t) ** 3
def ease_io(t): t = clamp(t); return t * t * (3 - 2 * t)

# ---------------------------------------------------------------- MAPA
geo = json.load(open(os.path.join(HERE, "brazil-states.geojson")))
states = {}
for f in geo["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    states[f["properties"]["sigla"]] = [p[0] for p in polys]

pts = [pt for s in ("MT", "MS") for poly in states[s] for pt in poly]
lon0, lon1 = min(p[0] for p in pts), max(p[0] for p in pts)
lat0, lat1 = min(p[1] for p in pts), max(p[1] for p in pts)
coslat = math.cos(math.radians((lat0 + lat1) / 2))
MAP_H = 610
K = MAP_H / (lat1 - lat0)
MAP_CX, MAP_CY = 640, 340
MARGIN = 40  # margem extra p/ tremer a tela

def proj(lon, lat):
    x = (lon - (lon0 + lon1) / 2) * coslat * K + MAP_CX
    y = ((lat0 + lat1) / 2 - lat) * K + MAP_CY
    return ((x + MARGIN) * SS, (y + MARGIN) * SS)

def star(cx, cy, r, rot=-90, n=5, inner=0.42):
    out = []
    for i in range(n * 2):
        rr = r if i % 2 == 0 else r * inner
        a = math.radians(rot + i * 180 / n)
        out.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return out

MT_BLUE, MT_GREEN, YELLOW = (22, 58, 150), (0, 140, 70), (255, 210, 0)
MS_BLUE, MS_GREEN, WHITE = (30, 80, 170), (0, 150, 64), (255, 255, 255)

def flag_mt(w, h):
    im = Image.new("RGB", (w, h), MT_BLUE)
    d = ImageDraw.Draw(im)
    d.polygon([(w / 2, h * .08), (w * .92, h / 2), (w / 2, h * .92), (w * .08, h / 2)], fill=WHITE)
    r = min(w, h) * .2
    d.ellipse([w / 2 - r, h / 2 - r, w / 2 + r, h / 2 + r], fill=MT_GREEN)
    d.polygon(star(w / 2, h / 2, r * .8), fill=YELLOW)
    return im

def flag_ms(w, h):
    im = Image.new("RGB", (w, h), WHITE)
    d = ImageDraw.Draw(im)
    d.polygon([(w, 0), (w, h), (0, h)], fill=MS_BLUE)
    t = min(w, h) * .14
    d.polygon([(0, h - t), (w - t, 0), (w, 0), (w, t), (t, h), (0, h)], fill=MS_GREEN)
    d.polygon(star(w * .72, h * .72, min(w, h) * .1), fill=YELLOW)
    return im

def build_background():
    bw, bh = (W + 2 * MARGIN) * SS, (H + 2 * MARGIN) * SS
    bg = Image.new("RGB", (bw, bh))
    d = ImageDraw.Draw(bg)
    for y in range(bh):  # céu gradiente
        t = y / bh
        d.line([(0, y), (bw, y)], fill=(int(lerp(12, 40, t)), int(lerp(18, 30, t)), int(lerp(45, 60, t))))
    # outros estados, apagadinhos
    for sig, polys in states.items():
        if sig in ("MT", "MS"):
            continue
        for poly in polys:
            d.polygon([proj(*p) for p in poly], fill=(38, 52, 70), outline=(70, 90, 115))
    # MT e MS com a bandeira de cada um "dentro" do território
    for sig, maker in (("MT", flag_mt), ("MS", flag_ms)):
        allp = [proj(*p) for poly in states[sig] for p in poly]
        x0, y0 = min(p[0] for p in allp), min(p[1] for p in allp)
        x1, y1 = max(p[0] for p in allp), max(p[1] for p in allp)
        fw, fh = int(x1 - x0) + 2, int(y1 - y0) + 2
        mask = Image.new("L", (fw, fh), 0)
        md = ImageDraw.Draw(mask)
        for poly in states[sig]:
            md.polygon([(proj(*p)[0] - x0, proj(*p)[1] - y0) for p in poly], fill=255)
        bg.paste(maker(fw, fh), (int(x0), int(y0)), mask)
    for sig in ("MT", "MS"):
        for poly in states[sig]:
            d.line([proj(*p) for p in poly] + [proj(*poly[0])], fill=WHITE, width=3 * SS, joint="curve")
    # chão
    over = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    gy = (GROUND + MARGIN) * SS
    od.rectangle([0, gy, bw, bh], fill=(20, 14, 8, 215))
    od.line([(0, gy), (bw, gy)], fill=(255, 200, 80, 255), width=3 * SS)
    for i in range(0, bw, 60 * SS):
        od.line([(i, gy + 6 * SS), (i - 40 * SS, bh)], fill=(255, 200, 80, 40), width=2 * SS)
    bg = Image.alpha_composite(bg.convert("RGBA"), over)
    return bg

def centroid(sig):
    poly = max(states[sig], key=len)
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    return sum(xs) / len(xs), sum(ys) / len(ys)

# ---------------------------------------------------------------- BONECOS
FIGHTERS = {
    "MT": dict(name="MATO GROSSO", shirt=MT_BLUE, shirt2=(14, 38, 105), pants=(40, 50, 75), skin=(222, 172, 125),
               hat="cowboy", hatc=(120, 72, 30), f=1, home=300, flag=flag_mt),
    "MS": dict(name="MATO GROSSO DO SUL", shirt=MS_GREEN, shirt2=(0, 100, 45), pants=(55, 45, 40), skin=(170, 115, 75),
               hat="palha", hatc=(225, 190, 110), f=-1, home=980, flag=flag_ms),
}
THIGH, SHIN, TORSO, HEAD, UARM, FARM = 60, 60, 88, 27, 50, 48

def vec(a, L, f):
    r = math.radians(a)
    return (f * math.sin(r) * L, math.cos(r) * L)

def add(p, v): return (p[0] + v[0], p[1] + v[1])

IDLE = dict(th1=10, sh1=4, th2=-8, sh2=-6, ua1=10, fa1=20, ua2=-5, fa2=10, tl=2, yo=0, rot=0, face="neutral", mouth=0)

def pose(act, lt, gt, x, mouth=0.0):
    q = dict(IDLE)
    q["yo"] = math.sin(gt * 3) * 2
    q["mouth"] = mouth
    if act == "walk":
        ph = x * 0.06
        s = math.sin(ph)
        q.update(th1=26 * s, sh1=26 * s - 14, th2=-26 * s, sh2=-26 * s - 14, ua1=-25 * s + 10, fa1=-25 * s + 40,
                 ua2=25 * s, fa2=25 * s + 30, tl=6, yo=-abs(math.cos(ph)) * 6, face="happy")
    elif act == "talk":
        g = math.sin(gt * 4.3) * 0.5 + math.sin(gt * 7.1) * 0.5
        q.update(ua1=60 + 28 * g, fa1=110 + 35 * math.sin(gt * 5.3), ua2=-25, fa2=25, tl=6 + 3 * g, face="talk",
                 yo=q["yo"] - 3 * mouth)
    elif act == "listen":
        q.update(ua1=22, fa1=100, ua2=28, fa2=96, tl=-2, face="hmm")
    elif act == "cheer":
        j = abs(math.sin(gt * 7))
        q.update(ua1=170, fa1=175 + 10 * math.sin(gt * 14), ua2=-20, fa2=30, yo=-18 * j, face="happy")
    elif act == "sad":
        q.update(tl=20, ua1=-3, fa1=-6, ua2=4, fa2=2, th1=6, sh1=2, th2=-4, sh2=-2, face="sad")
    elif act == "victory":
        j = abs(math.sin(gt * 6))
        q.update(ua1=165, fa1=178, ua2=-165, fa2=-178, yo=-35 * j, th1=lerp(10, 10, j), sh1=lerp(4, -20, j),
                 th2=lerp(-8, -30, j), sh2=lerp(-6, -60, j), tl=0, face="happy")
    return q

def fighter_geometry(fid, x, q):
    F = FIGHTERS[fid]; f = F["f"]
    l1 = math.cos(math.radians(q["th1"])) * THIGH + math.cos(math.radians(q["sh1"])) * SHIN
    l2 = math.cos(math.radians(q["th2"])) * THIGH + math.cos(math.radians(q["sh2"])) * SHIN
    hip = (x, GROUND - max(l1, l2) - 9 + q["yo"])
    k1 = add(hip, vec(q["th1"], THIGH, f)); ft1 = add(k1, vec(q["sh1"], SHIN, f))
    k2 = add(hip, vec(q["th2"], THIGH, f)); ft2 = add(k2, vec(q["sh2"], SHIN, f))
    neck = add(hip, vec(180 - q["tl"], TORSO, f))
    sh = add(neck, vec(q["tl"], 10, f))
    head = add(neck, vec(180 - q["tl"] * 1.3, HEAD + 8, f))
    e1 = add(sh, vec(q["ua1"], UARM, f)); h1 = add(e1, vec(q["fa1"], FARM, f))
    e2 = add(sh, vec(q["ua2"], UARM, f)); h2 = add(e2, vec(q["fa2"], FARM, f))
    G = dict(hip=hip, k1=k1, ft1=ft1, k2=k2, ft2=ft2, neck=neck, sh=sh, head=head, e1=e1, h1=h1, e2=e2, h2=h2,
             b1=add(ft1, vec(q["sh1"] + 90, 16, f)), b2=add(ft2, vec(q["sh2"] + 90, 16, f)))
    # rotação do corpo todo (queda/giro), pivô perto dos pés
    th = math.radians(-f * q["rot"])
    pv = (x, GROUND - 18 + min(0, q["yo"]))
    if q["rot"]:
        c, s = math.cos(th), math.sin(th)
        for k, p in G.items():
            dx, dy = p[0] - pv[0], p[1] - pv[1]
            G[k] = (pv[0] + dx * c - dy * s, pv[1] + dx * s + dy * c)
    G["ang"] = th
    return G

def S(p): return (p[0] * SS + OX * SS, p[1] * SS + OY * SS)

def limb(d, a, b, w, col):
    A, B = S(a), S(b); r = w * SS / 2
    d.line([A, B], fill=col, width=int(w * SS))
    for P in (A, B):
        d.ellipse([P[0] - r, P[1] - r, P[0] + r, P[1] + r], fill=col)

def local(G, base, lx, ly, f):
    """ponto no referencial da cabeça/tronco (lx p/ frente, ly p/ baixo) já rotacionado"""
    c, s = math.cos(G["ang"]), math.sin(G["ang"])
    dx, dy = f * lx, ly
    return (base[0] + dx * c - dy * s, base[1] + dx * s + dy * c)

def draw_fighter(d, fid, x, q):
    F = FIGHTERS[fid]; f = F["f"]; G = fighter_geometry(fid, x, q)
    OUT = (15, 10, 10)
    # sombra
    sx = S((G["hip"][0], GROUND + 4))
    d.ellipse([sx[0] - 60 * SS, sx[1] - 8 * SS, sx[0] + 60 * SS, sx[1] + 8 * SS], fill=(0, 0, 0))
    def L(a, b, w, col):
        limb(d, a, b, w + 5, OUT); limb(d, a, b, w, col)
    # braço de trás e perna de trás
    L(G["sh"], G["e2"], 15, F["shirt2"]); L(G["e2"], G["h2"], 12, tuple(int(c * .8) for c in F["skin"]))
    L(G["hip"], G["k2"], 18, tuple(int(c * .75) for c in F["pants"])); L(G["k2"], G["ft2"], 16, tuple(int(c * .75) for c in F["pants"]))
    L(G["ft2"], G["b2"], 13, (70, 40, 20))
    # tronco
    L(G["hip"], G["neck"], 38, F["shirt"])
    mid = ((G["hip"][0] + G["neck"][0]) / 2, (G["hip"][1] + G["neck"][1]) / 2)
    # brasão (bandeirinha) no peito
    ux, uy = G["neck"][0] - G["hip"][0], G["neck"][1] - G["hip"][1]
    n = math.hypot(ux, uy); ux, uy = ux / n, uy / n
    nx, ny = -uy, ux
    c0 = (mid[0] + ux * 12, mid[1] + uy * 12)
    corners = [(c0[0] + nx * a * 13 + ux * b * 10, c0[1] + ny * a * 13 + uy * b * 10) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    d.polygon([S(p) for p in corners], fill=YELLOW if fid == "MT" else WHITE, outline=OUT)
    d.polygon([S(p) for p in star(c0[0], c0[1], 7, rot=math.degrees(math.atan2(uy, ux)) + 180)],
              fill=MT_GREEN if fid == "MT" else MS_BLUE)
    # cinto
    L(add(G["hip"], (ux * 4, uy * 4)), add(G["hip"], (ux * 6, uy * 6)), 36, (60, 35, 15))
    # perna da frente
    L(G["hip"], G["k1"], 18, F["pants"]); L(G["k1"], G["ft1"], 16, F["pants"]); L(G["ft1"], G["b1"], 13, (95, 55, 25))
    # cabeça
    hc = S(G["head"]); r = HEAD * SS
    d.ellipse([hc[0] - r - 3 * SS, hc[1] - r - 3 * SS, hc[0] + r + 3 * SS, hc[1] + r + 3 * SS], fill=OUT)
    d.ellipse([hc[0] - r, hc[1] - r, hc[0] + r, hc[1] + r], fill=F["skin"])
    hd = G["head"]; P = lambda lx, ly: S(local(G, hd, lx, ly, f))
    fc = q["face"]; m = q.get("mouth", 0)
    for ex in (6, 18):
        pe = P(ex, -3); rr = 3.2 * SS
        d.ellipse([pe[0] - rr, pe[1] - rr, pe[0] + rr, pe[1] + rr], fill=OUT)
    def mouth_ellipse(h):
        pm = P(14, 11); rw, rh = 6 * SS, (1.5 + h) * SS
        d.ellipse([pm[0] - rw, pm[1] - rh, pm[0] + rw, pm[1] + rh], fill=(90, 20, 20), outline=OUT, width=2 * SS)
    if fc == "talk":
        d.line([P(1, -11), P(10, -13)], fill=OUT, width=3 * SS); d.line([P(14, -13), P(23, -11)], fill=OUT, width=3 * SS)
        if m > 0.08: mouth_ellipse(8 * m)
        else: d.line([P(7, 11), P(21, 11)], fill=OUT, width=3 * SS)
    elif fc == "hmm":
        d.line([P(1, -9), P(10, -9)], fill=OUT, width=3 * SS); d.line([P(14, -10), P(23, -14)], fill=OUT, width=3 * SS)
        d.line([P(8, 12), P(20, 10)], fill=OUT, width=3 * SS)
    elif fc == "sad":
        d.line([P(1, -8), P(10, -12)], fill=OUT, width=3 * SS); d.line([P(14, -12), P(23, -8)], fill=OUT, width=3 * SS)
        d.line([P(5, 14), P(13, 9), P(21, 14)], fill=OUT, width=3 * SS, joint="curve")
    elif fc == "happy":
        d.line([P(1, -12), P(10, -13)], fill=OUT, width=3 * SS); d.line([P(14, -13), P(23, -12)], fill=OUT, width=3 * SS)
        if m > 0.08: mouth_ellipse(8 * m)
        else: d.line([P(4, 7), P(12, 13), P(22, 7)], fill=OUT, width=3 * SS, joint="curve")
    else:
        d.line([P(5, 9), P(13, 12), P(21, 9)], fill=OUT, width=3 * SS, joint="curve")
    # bigode do MT, cavanhaque do MS
    if fid == "MT":
        d.line([P(8, 5), P(22, 5)], fill=(60, 35, 20), width=4 * SS)
    else:
        d.line([P(13, 18), P(17, 24)], fill=(40, 25, 15), width=4 * SS)
    # chapéu
    if F["hat"] == "cowboy":
        brim = [P(-36, -18), P(-30, -24), P(32, -24), P(40, -16), P(30, -20), P(-26, -20)]
        crown = [P(-20, -22), P(-17, -46), P(0, -40), P(17, -46), P(20, -22)]
        d.polygon(crown, fill=F["hatc"], outline=OUT); d.polygon(brim, fill=F["hatc"], outline=OUT)
        d.line([P(-19, -26), P(19, -26)], fill=YELLOW, width=4 * SS)
    else:
        brim = [P(-44, -17), P(44, -17), P(36, -23), P(-36, -23)]
        crown = [P(-20, -22), P(-17, -40), P(17, -40), P(20, -22)]
        d.polygon(crown, fill=F["hatc"], outline=OUT); d.polygon(brim, fill=F["hatc"], outline=OUT)
        d.line([P(-19, -27), P(19, -27)], fill=(200, 30, 30), width=5 * SS)
    # braço da frente
    L(G["sh"], G["e1"], 15, F["shirt"]); L(G["e1"], G["h1"], 12, F["skin"])
    hh = S(G["h1"]); rr = 10 * SS
    d.ellipse([hh[0] - rr - 2 * SS, hh[1] - rr - 2 * SS, hh[0] + rr + 2 * SS, hh[1] + rr + 2 * SS], fill=OUT)
    d.ellipse([hh[0] - rr, hh[1] - rr, hh[0] + rr, hh[1] + rr], fill=F["skin"])
    return G

# ---------------------------------------------------------------- ROTEIRO
# (quem fala, texto do balão, texto falado)
INTRO = [
    ("MT", "Eu sou o MATO GROSSO! O terceiro maior estado do Brasil!",
           "Eu sou o Mato Grosso! O terceiro maior estado do Brasil!"),
    ("MS", "E eu sou o MATO GROSSO DO SUL! Bora ver quem é o melhor?",
           "E eu sou o Mato Grosso do Sul! Bora ver quem é o melhor?"),
]
ROUND_DEFS = [
    ("SEGURANÇA", [
        ("MT", "Na fronteira com a Bolívia quem trabalha é o GEFRON, o Grupo Especial de Fronteira do Mato Grosso!",
               "Na fronteira com a Bolívia quem trabalha é o Gefron, o Grupo Especial de Fronteira do Mato Grosso!"),
        ("MS", "Pois aqui tem o DOF, o Departamento de Operações de Fronteira, famoso pelas apreensões recordes de drogas!",
               "Pois aqui tem o dófi, o Departamento de Operações de Fronteira, famoso pelas apreensões recordes de drogas!"),
    ], "MS"),
    ("EDUCAÇÃO", [
        ("MS", "Aqui tem UFMS, UFGD e UEMS: universidade pública espalhada pelo estado inteiro!",
               "Aqui tem a U F M S, a U F G D e a U E M S. Universidade pública espalhada pelo estado inteiro!"),
        ("MT", "A UFMT forma gente desde 1970, com campus em Cuiabá, Sinop, Barra do Garças e Várzea Grande!",
               "A U F M T forma gente desde mil novecentos e setenta, com campus em Cuiabá, Sinop, Barra do Garças e Várzea Grande!"),
    ], "MT"),
    ("ECONOMIA", [
        ("MT", "Sou o maior produtor de soja, milho e algodão do Brasil, e tenho o maior rebanho de boi do país!",
               "Sou o maior produtor de soja, milho e algodão do Brasil, e tenho o maior rebanho de boi do país!"),
        ("MS", "E eu tenho o Vale da Celulose, em Três Lagoas: um dos maiores polos de celulose do mundo!",
               "E eu tenho o Vale da Celulose, em Três Lagoas. Um dos maiores polos de celulose do mundo!"),
    ], "MT"),
    ("TURISMO", [
        ("MS", "Eu tenho Bonito, com os rios mais cristalinos do Brasil, e a maior parte do Pantanal!",
               "Eu tenho Bonito, com os rios mais cristalinos do Brasil, e a maior parte do Pantanal!"),
        ("MT", "Chapada dos Guimarães, Transpantaneira... e Amazônia, Cerrado e Pantanal no mesmo estado!",
               "Chapada dos Guimarães, Transpantaneira! E Amazônia, Cerrado e Pantanal no mesmo estado!"),
    ], "MS"),
]
FINAL_DEF = ("CULTURA E COMIDA", [
    ("MT", "Aqui tem rasqueado, siriri, cururu e uma ventrecha de pacu de comer rezando!",
           "Aqui tem rasqueado, siriri, cururu, e uma ventrecha de pacu de comer rezando!"),
    ("MS", "E aqui tem tereré geladinho, sobá de Campo Grande, chipa e chamamé!",
           "E aqui tem tereré geladinho, sobá de Campo Grande, chipa e chamamé!"),
], WINNER)
ENDING = {
    "MT": [("MS", "Tá bom, você venceu... mas lembra: até 1977 a gente era um estado só!",
                  "Tá bom, você venceu. Mas lembra: até mil novecentos e setenta e sete a gente era um estado só!"),
           ("MT", "É verdade, irmão! Centro-Oeste unido!", "É verdade, irmão! Centro-Oeste unido!")],
    "MS": [("MT", "Tá bom, você venceu... mas lembra: até 1977 a gente era um estado só!",
                  "Tá bom, você venceu. Mas lembra: até mil novecentos e setenta e sete a gente era um estado só!"),
           ("MS", "É verdade, irmão! Centro-Oeste unido!", "É verdade, irmão! Centro-Oeste unido!")],
}[WINNER]

# ---------------------------------------------------------------- VOZ (espeak-ng + mbrola)
import numpy as np
SR = 44100
CACHE = os.environ.get("TTS_CACHE", os.path.join(HERE, ".tts_cache"))
VOICES = {"MT": ["-v", "mb-br1", "-s", "150", "-p", "42"], "MS": ["-v", "mb-br3", "-s", "150", "-p", "55"]}

def tts(fid, spoken):
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.md5((fid + spoken + " ".join(VOICES[fid])).encode()).hexdigest()[:16]
    path = os.path.join(CACHE, key + ".wav")
    if not os.path.exists(path):
        subprocess.run(["espeak-ng", *VOICES[fid], "-w", path, spoken], check=True, stderr=subprocess.DEVNULL)
    with wave.open(path) as w:
        sr0 = w.getframerate(); raw = w.readframes(w.getnframes())
    a = np.frombuffer(raw, dtype=np.int16).astype(float) / 32768
    a = np.interp(np.arange(0, len(a) * SR / sr0) * sr0 / SR, np.arange(len(a)), a)
    a = a / (np.max(np.abs(a)) + 1e-9) * 0.95
    hop = SR // FPS
    env = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2)) for i in range(0, len(a), hop)])
    env = np.clip(env / (np.percentile(env, 90) + 1e-9), 0, 1)
    return a, env, len(a) / SR

# ---------------------------------------------------------------- LINHA DO TEMPO
LINES = []    # (t0, fid, texto, audio, env, dur)
ACTS = {"MT": [], "MS": []}   # (t0, t1, act) — o último que cobre o instante vence
BANNERS = []  # (t0, t1, texto, tamanho, cor, y)
METERS = []   # (t0, dur, alvo -1=MT +1=MS)
SCORE_EVENTS = []
TOPICS = []   # (t0, t1, tema)
SFX = []      # (t, nome)
WALK_IN = (4.5, 7.0)

def act(fid, t0, t1, a): ACTS[fid].append((t0, t1, a))
def other(fid): return "MS" if fid == "MT" else "MT"
NAME = {"MT": "MATO GROSSO", "MS": "MATO GROSSO DO SUL"}

def say(t, fid, disp, spoken):
    a, env, dur = tts(fid, spoken)
    LINES.append((t, fid, disp, a, env, dur))
    act(fid, t, t + dur + 0.1, "talk"); act(other(fid), t + 0.3, t + dur + 0.3, "listen")
    return t + dur + 0.55

def play_round(t, n, tema, lines, winner, final=False):
    BANNERS.append((t, t + 1.5, "ROUND FINAL" if final else f"ROUND {n}", 100, YELLOW if final else WHITE, 280))
    BANNERS.append((t + 0.3, t + 1.5, f"TEMA: {tema}", 50, WHITE, 370))
    SFX.append((t, "gong"))
    t0 = t; t += 1.9
    for fid, disp, spoken in lines:
        t = say(t, fid, disp, spoken)
    dur = 4.2 if final else 2.6
    METERS.append((t, dur, -1 if winner == "MT" else 1)); SFX.append((t, "applause_long" if final else "applause"))
    t += dur
    SCORE_EVENTS.append((t, winner)); SFX.append((t, "ding"))
    TOPICS.append((t0 + 0.3, t + (0.2 if final else 1.6), tema))
    if not final:
        BANNERS.append((t, t + 1.6, f"PONTO PRO {NAME[winner]}!", 54 if winner == "MT" else 46,
                        (130, 175, 255) if winner == "MT" else (120, 235, 150), 280))
        act(winner, t, t + 1.6, "cheer"); act(other(winner), t, t + 1.6, "sad")
        t += 1.9
    return t

t = 7.3
for fid, disp, spoken in INTRO:
    t = say(t, fid, disp, spoken)
t += 0.3
for i, (tema, lines, w) in enumerate(ROUND_DEFS):
    t = play_round(t, i + 1, tema, lines, w)
BANNERS.append((t, t + 2.0, "EMPATE!  2 x 2", 105, YELLOW, 300)); SFX.append((t, "stab"))
act("MT", t, t + 2.0, "listen"); act("MS", t, t + 2.0, "listen"); t += 2.1
DESEMPATE = (t, t + 2.8)
BANNERS.append((t, t + 2.8, "DESEMPATE!", 140, (255, 60, 40), 290)); SFX.append((t, "boom"))
BANNERS.append((t + 1.0, t + 2.8, "QUEM LEVA ESSA?", 46, WHITE, 400))
t += 3.0
t = play_round(t, 5, *FINAL_DEF, final=True)
WIN_T = t
BANNERS.append((t, 999, f"{NAME[WINNER]} VENCEU!", 62 if WINNER == "MT" else 50, YELLOW, 170))
BANNERS.append((t + 0.6, t + 3.0, "CAMPEÃO DO DESEMPATE", 40, WHITE, 240)); SFX.append((t, "fanfare"))
act(WINNER, t, t + 3.0, "victory"); act(LOSER, t, t + 3.0, "sad")
t += 3.2
for fid, disp, spoken in ENDING:
    t = say(t, fid, disp, spoken)
act("MT", t, t + 9, "cheer"); act("MS", t, t + 9, "cheer")
DURATION = t + 3.5

def fighter_state(fid, st):
    F = FIGHTERS[fid]
    if st < WALK_IN[1]:
        p = clamp((st - WALK_IN[0]) / (WALK_IN[1] - WALK_IN[0]))
        return "walk", 0, lerp(-200 if fid == "MT" else 1480, F["home"], p)
    a = "idle"; lt = 0
    for t0, t1, ac in ACTS[fid]:
        if t0 <= st < t1: a, lt = ac, st - t0
    return a, lt, F["home"]

def mouth_at(fid, st):
    for t0, f, disp, a, env, dur in LINES:
        if f == fid and t0 <= st < t0 + dur:
            i = int((st - t0) * FPS)
            return float(env[min(i, len(env) - 1)])
    return 0.0

def score(st):
    s = {"MT": 0, "MS": 0}
    for t_, w in SCORE_EVENTS:
        if st >= t_: s[w] += 1
    return s

# ---------------------------------------------------------------- TEXTOS
def text(d, s, cx, cy, sz, fill=WHITE, stroke=(0, 0, 0), sw=None, anchor="mm"):
    fnt = font(sz)
    sw = int((sw if sw is not None else max(2, sz / 12)) * SS)
    d.text((cx * SS, cy * SS), s, font=fnt, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor=anchor)

def text_layer(canvas, s, cx, cy, sz, fill, stroke=(0, 0, 0), alpha=1.0, rot=0):
    if alpha <= 0.01 or sz < 2: return
    fnt = font(sz); sw = int(max(2, sz / 12) * SS)
    bb = fnt.getbbox(s, stroke_width=sw)
    tw, th = bb[2] - bb[0] + 20, bb[3] - bb[1] + 20
    lay = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((tw / 2, th / 2), s, font=fnt, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor="mm")
    if rot: lay = lay.rotate(rot, expand=True, resample=Image.BICUBIC)
    if alpha < 1:
        a = lay.getchannel("A").point(lambda v: int(v * alpha)); lay.putalpha(a)
    canvas.alpha_composite(lay, (int(cx * SS - lay.width / 2), int(cy * SS - lay.height / 2)))

def wrap(s, sz, maxw):
    fnt = font(sz); lines, cur = [], ""
    for w in s.split():
        nxt = (cur + " " + w).strip()
        if fnt.getlength(nxt) / SS > maxw and cur: lines.append(cur); cur = w
        else: cur = nxt
    if cur: lines.append(cur)
    return lines

def draw_bubble(canvas, fid, disp, prog, alpha):
    F = FIGHTERS[fid]; SZ = 25; LH = 33; MAXW = 500
    lines = wrap(disp, SZ, MAXW)
    words_total = len(disp.split()); show = math.ceil(words_total * clamp(prog / 0.85))
    bw = max(font(SZ).getlength(l) / SS for l in lines) + 44; bh = len(lines) * LH + 30
    x0 = 40 if fid == "MT" else W - 40 - bw; y1 = 300; y0 = y1 - bh
    lay = Image.new("RGBA", canvas.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    hx = F["home"]; tip = (hx + 10 * F["f"], 345)
    base = (min(max(hx, x0 + 40), x0 + bw - 40), y1 - 4)
    border = F["shirt"]
    d.polygon([(p[0] * SS, p[1] * SS) for p in ((base[0] - 18, base[1]), (base[0] + 18, base[1]), tip)],
              fill=(255, 255, 255, 245), outline=border)
    d.rounded_rectangle([x0 * SS, y0 * SS, (x0 + bw) * SS, y1 * SS], radius=22 * SS, fill=(255, 255, 255, 245),
                        outline=border, width=5 * SS)
    d.polygon([((base[0] - 15) * SS, (y1 - 6) * SS), ((base[0] + 15) * SS, (y1 - 6) * SS),
               ((base[0] + 15) * SS, (y1 + 2) * SS), ((base[0] - 15) * SS, (y1 + 2) * SS)], fill=(255, 255, 255, 245))
    n = 0
    for i, l in enumerate(lines):
        ws = l.split(); vis = ws[:max(0, show - n)]; n += len(ws)
        if vis:
            d.text(((x0 + 22) * SS, (y0 + 15 + i * LH) * SS), " ".join(vis), font=font(SZ), fill=(25, 25, 35), anchor="la")
    if alpha < 1:
        lay.putalpha(lay.getchannel("A").point(lambda v: int(v * alpha)))
    canvas.alpha_composite(lay)

def draw_meter(canvas, st):
    for t0, dur, target in METERS:
        if t0 - 0.2 <= st < t0 + dur + 1.0:
            p = clamp((st - t0) / dur)
            a = clamp((st - t0 + 0.2) / 0.2) * (1 - clamp((st - t0 - dur - 0.7) / 0.3))
            wob = math.sin((st - t0) * (9 if dur > 3 else 13)) * (0.85 if dur > 3 else 0.6) * (1 - p) ** 0.7
            v = clamp(target * ease_io(p) * 0.9 + wob, -0.95, 0.95)
            lay = Image.new("RGBA", canvas.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
            cx, cy, bw = 640, 240, 520
            d.rounded_rectangle([(cx - bw / 2 - 6) * SS, (cy - 26) * SS, (cx + bw / 2 + 6) * SS, (cy + 26) * SS],
                                radius=14 * SS, fill=(0, 0, 0, 230))
            for i in range(bw):
                tt = i / bw
                col = tuple(int(lerp(a_, b_, tt)) for a_, b_ in zip((60, 110, 255), (40, 210, 100)))
                d.line([((cx - bw / 2 + i) * SS, (cy - 18) * SS), ((cx - bw / 2 + i) * SS, (cy + 18) * SS)], fill=col)
            d.line([(cx * SS, (cy - 22) * SS), (cx * SS, (cy + 22) * SS)], fill=(255, 255, 255), width=2 * SS)
            nx = cx + v * bw / 2
            d.polygon([((nx - 14) * SS, (cy - 40) * SS), ((nx + 14) * SS, (cy - 40) * SS), (nx * SS, (cy - 14) * SS)],
                      fill=YELLOW, outline=(0, 0, 0))
            d.rectangle([(nx - 3) * SS, (cy - 18) * SS, (nx + 3) * SS, (cy + 18) * SS], fill=YELLOW, outline=(0, 0, 0))
            text(d, "APLAUSÔMETRO", cx, cy - 62, 34, WHITE)
            text(d, "MT", cx - bw / 2 - 40, cy, 30, (130, 175, 255)); text(d, "MS", cx + bw / 2 + 40, cy, 30, (120, 235, 150))
            if a < 1: lay.putalpha(lay.getchannel("A").point(lambda q: int(q * a)))
            canvas.alpha_composite(lay)

CONFETTI = [(random.uniform(0, W), random.uniform(-400, -10), random.uniform(80, 220), random.uniform(-40, 40),
             random.choice([YELLOW, WHITE, FIGHTERS[WINNER]["shirt"], (255, 80, 60), (0, 200, 90)]),
             random.uniform(0, 6.28), random.uniform(5, 11)) for _ in range(160)]

def draw_hud(canvas, d, st):
    a = clamp((st - 6.2) / 0.5)
    if a <= 0: return
    off = (1 - a) * 140
    sc = score(st)
    for fid, side in (("MT", 0), ("MS", 1)):
        F = FIGHTERS[fid]
        fx = 30 if side == 0 else W - 30 - 66
        fl = F["flag"](66 * SS, 44 * SS)
        canvas.paste(fl, (int(fx * SS), int((22 - off) * SS)))
        d.rectangle([fx * SS, (22 - off) * SS, (fx + 66) * SS, (66 - off) * SS], outline=(0, 0, 0), width=2 * SS)
        nx = fx + 80 if side == 0 else fx - 14
        text(d, F["name"], nx, 44 - off, 28, WHITE, anchor="lm" if side == 0 else "rm")
    d.rounded_rectangle([(W / 2 - 70) * SS, (14 - off) * SS, (W / 2 + 70) * SS, (76 - off) * SS],
                        radius=10 * SS, fill=(0, 0, 0), outline=YELLOW, width=3 * SS)
    text(d, f"{sc['MT']} x {sc['MS']}", W / 2, 45 - off, 40, YELLOW)
    for t0, t1, tema in TOPICS:
        if t0 <= st < t1:
            ta = clamp((st - t0) / 0.3) * (1 - clamp((st - t1 + 0.3) / 0.3))
            if ta > 0.5:
                text(d, tema, W / 2, 100, 26, (255, 230, 120))

# ---------------------------------------------------------------- RENDER
BG = build_background()
OX = OY = 0

def shake_amount(st):
    m = 0
    if DESEMPATE[0] <= st < DESEMPATE[0] + 0.4: m = 25 * (1 - (st - DESEMPATE[0]) / 0.4)
    if 1.25 <= st < 1.6: m = max(m, 20 * (1 - (st - 1.25) / 0.35))
    if WIN_T <= st < WIN_T + 0.4: m = max(m, 14 * (1 - (st - WIN_T) / 0.4))
    return m

def render(st):
    global OX, OY
    m = shake_amount(st)
    OX, OY = random.uniform(-m, m), random.uniform(-m, m)
    if st < 1.3:
        z = lerp(2.4, 1.0, ease_out(st / 1.3))
        cw, ch = BG.width / z, BG.height / z
        cx, cy = BG.width / 2, (MAP_CY + MARGIN) * SS
        crop = BG.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2)))
        frame = crop.resize(BG.size, Image.BILINEAR).crop((MARGIN * SS, MARGIN * SS, (W + MARGIN) * SS, (H + MARGIN) * SS))
    else:
        ox, oy = int((MARGIN - OX) * SS), int((MARGIN - OY) * SS)
        frame = BG.crop((ox, oy, ox + W * SS, oy + H * SS))
    frame = frame.copy()
    for sig, nm in (("MT", "MATO GROSSO"), ("MS", "MATO GROSSO DO SUL")):
        lon, lat = centroid(sig); px, py = proj(lon, lat)
        a = clamp((st - 0.6) / 0.6) * (0.85 if st < 4.5 else 0.4)
        text_layer(frame, nm, px / SS - MARGIN + OX, py / SS - MARGIN + OY + (-50 if sig == "MT" else 30), 30, WHITE, alpha=a)
    if DESEMPATE[0] <= st < DESEMPATE[1] + 0.3:
        pul = 0.5 + 0.5 * math.sin((st - DESEMPATE[0]) * 10)
        fade = 1 - clamp((st - DESEMPATE[1]) / 0.3)
        frame.alpha_composite(Image.new("RGBA", frame.size, (200, 0, 0, int((70 + 60 * pul) * fade))))
    dim = clamp((st - 4.0) / 1.0) * 0.35
    if dim > 0:
        frame.alpha_composite(Image.new("RGBA", frame.size, (0, 0, 0, int(255 * dim))))
    d = ImageDraw.Draw(frame)

    if st < 4.5:  # ABERTURA
        if 1.25 <= st < 1.45:
            frame.alpha_composite(Image.new("RGBA", frame.size, (255, 255, 255, int(255 * (1 - (st - 1.25) / 0.2)))))
        out = clamp((st - 3.9) / 0.5)
        if st >= 1.25:
            p = ease_out((st - 1.25) / 0.45)
            text_layer(frame, "MATO GROSSO", lerp(-400, 640, p) - out * 900, 230, 82, (130, 175, 255), alpha=1 - out)
            text_layer(frame, "MATO GROSSO DO SUL", lerp(1700, 640, p) + out * 900, 470, 70, (120, 235, 150), alpha=1 - out)
        if st >= 1.6:
            p = clamp((st - 1.6) / 0.25)
            text_layer(frame, "VS", 640, 350, lerp(260, 120, ease_out(p)), YELLOW, alpha=p * (1 - out), rot=math.sin(st * 5) * 6)
        if st >= 2.3:
            p = clamp((st - 2.3) / 0.4)
            text_layer(frame, "O GRANDE DEBATE DO CENTRO-OESTE", 640, 590, 36, WHITE, alpha=p * (1 - out))
        if st < 0.4:
            frame.alpha_composite(Image.new("RGBA", frame.size, (0, 0, 0, int(255 * (1 - st / 0.4)))))

    if st >= 4.3:  # BONECOS
        d = ImageDraw.Draw(frame)
        for fid in ("MT", "MS"):
            a, lt, x = fighter_state(fid, st)
            draw_fighter(d, fid, x, pose(a, lt, st, x, mouth_at(fid, st)))

    for t0, fid, disp, a, env, dur in LINES:  # balões de fala
        if t0 - 0.1 <= st < t0 + dur + 0.45:
            al = clamp((st - t0 + 0.1) / 0.15) * (1 - clamp((st - t0 - dur - 0.25) / 0.2))
            draw_bubble(frame, fid, disp, (st - t0) / dur, al)

    draw_meter(frame, st)

    if st >= WIN_T:
        lt = st - WIN_T
        cd = ImageDraw.Draw(frame)
        for x, y, vy, vx, col, ph, sz in CONFETTI:
            yy = (y + vy * lt) % (H + 420) - 400 if lt > 4 else y + vy * lt
            xx = x + vx * lt + math.sin(lt * 3 + ph) * 20
            w = abs(math.cos(lt * 6 + ph)) * sz + 2
            cd.rectangle([(xx - w / 2) * SS, (yy - sz / 2) * SS, (xx + w / 2) * SS, (yy + sz / 2) * SS], fill=col)

    d = ImageDraw.Draw(frame)
    draw_hud(frame, d, st)

    talking = any(t0 - 0.1 <= st < t0 + dur + 0.45 for t0, _, _, _, _, dur in LINES)
    for t0, t1, s, sz, col, y in BANNERS:
        if t0 <= st < t1:
            if talking and t1 > 900: y = 690 - 40  # mantém o "VENCEU" sem cobrir os balões
            p = st - t0
            scl = lerp(2.6, 1.0, ease_out(p / 0.22))
            a = clamp(p / 0.12) * (1 - clamp((st - (t1 - 0.2)) / 0.2)) if t1 < 900 else clamp(p / 0.12)
            pulse = 1 + (0.06 * math.sin(st * 12) if "DESEMPATE" in s else 0)
            text_layer(frame, s, W / 2, y, sz * scl * pulse * (0.75 if talking and t1 > 900 else 1), col, alpha=a)

    if st > DURATION - 0.8:
        frame.alpha_composite(Image.new("RGBA", frame.size, (0, 0, 0, int(255 * clamp((st - DURATION + 0.8) / 0.8)))))
    return frame.convert("RGB").resize((W, H), Image.LANCZOS)

# ---------------------------------------------------------------- ÁUDIO
def make_audio(path):
    n = int((DURATION + 0.5) * SR); music = np.zeros(n); fx = np.zeros(n); voice = np.zeros(n)
    rng = np.random.default_rng(1)
    def put(buf, t, sig, gain=1.0):
        i = int(t * SR)
        if i >= n or i < 0: return
        s_ = sig[: n - i]; buf[i:i + len(s_)] += s_ * gain
    def env(L, dec): return np.exp(-np.linspace(0, L, int(L * SR)) * dec)
    def kick():
        L = 0.35; tt = np.linspace(0, L, int(L * SR)); f = 120 * np.exp(-tt * 18) + 45
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    def snare(): L = 0.2; return rng.normal(0, 1, int(L * SR)) * env(L, 22) * 0.5
    def hat(): L = 0.05; s = np.diff(rng.normal(0, 1, int(L * SR)), prepend=0); return s * env(L, 80) * 0.25
    def gong():
        L = 2.0; tt = np.linspace(0, L, int(L * SR))
        return sum(np.sin(2 * np.pi * f * tt) * a for f, a in ((220, .6), (331, .4), (440, .3), (587, .2))) * np.exp(-tt * 2.2)
    def whoosh():
        L = 0.45; tt = np.linspace(0, L, int(L * SR)); s = np.convolve(rng.normal(0, 1, len(tt)), np.ones(30) / 30, mode="same")
        return s * np.sin(np.pi * tt / L) * 3
    def stab(freqs, L=0.6):
        tt = np.linspace(0, L, int(L * SR))
        return sum(np.sign(np.sin(2 * np.pi * f * tt)) for f in freqs) * np.exp(-tt * 4) * 0.12
    def ding():
        L = 1.0; tt = np.linspace(0, L, int(L * SR))
        return (np.sin(2 * np.pi * 1320 * tt) + 0.5 * np.sin(2 * np.pi * 1980 * tt)) * np.exp(-tt * 5) * 0.5
    def applause(L):
        s = np.zeros(int(L * SR))
        for _ in range(int(L * 260)):
            i = rng.integers(0, len(s) - 800); c = rng.normal(0, 1, 600) * np.exp(-np.arange(600) / 90)
            s[i:i + 600] += c * rng.uniform(0.2, 1)
        fade = np.minimum(1, np.minimum(np.arange(len(s)) / (0.3 * SR), (len(s) - np.arange(len(s))) / (0.6 * SR)))
        return s * fade * 0.35
    # trilha de fundo
    bpm = 120; beat = 60 / bpm; t = 1.25
    while t < DURATION - 1:
        b = round((t - 1.25) / beat)
        des = DESEMPATE[0] <= t
        put(music, t, kick(), 0.5 if b % 2 == 0 else 0.0)
        if b % 4 == 2: put(music, t, snare(), 0.45)
        put(music, t + beat / 2, hat(), 0.5)
        if b % 8 == 0:
            root = 130.8 if des else 110
            put(music, t, stab([root, root * 1.5, root * 2], 1.2), 0.8)
        t += beat
    put(fx, 1.25, kick(), 1.2); put(fx, 1.25, whoosh(), 0.6); put(fx, 1.25, stab([55, 82.5, 110], 1.5), 2.0)
    for t_, name in SFX:
        if name == "gong": put(fx, t_, gong(), 0.5)
        elif name == "applause": put(fx, t_, applause(2.8), 1.0)
        elif name == "applause_long": put(fx, t_, applause(4.6), 1.0)
        elif name == "ding": put(fx, t_, ding(), 1.0)
        elif name == "stab": put(fx, t_, stab([220, 277, 330], 1.0), 2.0)
        elif name == "boom": put(fx, t_, kick(), 1.5); put(fx, t_, stab([55, 58, 82.5], 2.0), 2.5)
        elif name == "fanfare":
            for i, f in enumerate([262, 330, 392, 523]): put(fx, t_ + i * 0.14, stab([f, f * 1.5], 0.5), 1.8)
            put(fx, t_ + 0.6, stab([523, 659, 784], 1.8), 2.2); put(fx, t_, applause(3.5), 1.0)
    for t0, fid, disp, a, e, dur in LINES:
        put(voice, t0, a, 1.0)
    # abaixa a música enquanto alguém fala
    duck = np.ones(n)
    for t0, fid, disp, a, e, dur in LINES:
        i0, i1 = int(t0 * SR), int((t0 + dur) * SR); duck[max(0, i0 - 4000):i1 + 4000] = 0.35
    duck = np.convolve(duck, np.ones(4410) / 4410, mode="same")
    mus = music * duck
    mus = mus / (np.max(np.abs(mus)) + 1e-9) * 0.35
    fx = fx / (np.max(np.abs(fx)) + 1e-9) * 0.55
    out = mus + fx + voice * 0.9
    out = np.tanh(out * 1.1) * 0.95
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())

if __name__ == "__main__":
    if PREVIEW:
        for t in PREVIEW:
            render(t).save(f"preview_{t:06.2f}.png")
        print("duração:", round(DURATION, 1)); sys.exit()
    wav = "debate_audio.wav"; mp4 = os.path.join(HERE, "debate_mt_ms.mp4")
    make_audio(wav)
    nfr = int(DURATION * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", mp4],
                          stdin=subprocess.PIPE)
    for i in range(nfr):
        ff.stdin.write(render(i / FPS).tobytes())
        if i % 300 == 0: print(f"frame {i}/{nfr}", flush=True)
    ff.stdin.close(); ff.wait()
    os.remove(wav)
    print("ok:", mp4, f"{DURATION:.1f}s")
