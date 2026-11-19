#!/usr/bin/env python3
"""Animação: Mato Grosso x Mato Grosso do Sul — luta até o desempate.

Gera luta_mt_ms.mp4 (1280x720, 30fps, com áudio sintetizado).
Uso: python3 luta_mt_ms.py [--winner MT|MS] [--preview t1,t2,...]
"""
import json, math, random, struct, subprocess, sys, wave, os
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
               hat="cowboy", hatc=(120, 72, 30), f=1, home=430, flag=flag_mt),
    "MS": dict(name="MATO GROSSO DO SUL", shirt=MS_GREEN, shirt2=(0, 100, 45), pants=(55, 45, 40), skin=(170, 115, 75),
               hat="palha", hatc=(225, 190, 110), f=-1, home=850, flag=flag_ms),
}
THIGH, SHIN, TORSO, HEAD, UARM, FARM = 60, 60, 88, 27, 50, 48

def vec(a, L, f):
    r = math.radians(a)
    return (f * math.sin(r) * L, math.cos(r) * L)

def add(p, v): return (p[0] + v[0], p[1] + v[1])

IDLE = dict(th1=28, sh1=8, th2=-14, sh2=-30, ua1=35, fa1=150, ua2=15, fa2=160, tl=8, yo=0, rot=0, face="angry")

def pose(act, p, lt, gt, x):
    q = dict(IDLE)
    bob = math.sin(gt * 9) * 3
    q["yo"] = bob
    if act == "walk":
        ph = x * 0.06
        s = math.sin(ph)
        q.update(th1=26 * s, sh1=26 * s - 14, th2=-26 * s, sh2=-26 * s - 14, ua1=-25 * s + 10, fa1=-25 * s + 60,
                 ua2=25 * s, fa2=25 * s + 40, tl=10, yo=-abs(math.cos(ph)) * 6)
    elif act in ("punch", "upper"):
        e = clamp(p / 0.3) if p < 0.3 else clamp(1 - (p - 0.55) / 0.45)
        if act == "punch":
            q.update(ua1=lerp(35, 92, e), fa1=lerp(150, 90, e), tl=lerp(8, 24, e), th1=lerp(28, 40, e))
        else:
            q.update(ua1=lerp(35, 160, e), fa1=lerp(150, 175, e), tl=lerp(8, -5, e), yo=-30 * e, th1=lerp(28, 10, e),
                     sh1=lerp(8, -10, e), th2=lerp(-14, -30, e), sh2=lerp(-30, -50, e))
    elif act == "kick":
        e = clamp(p / 0.3) if p < 0.3 else clamp(1 - (p - 0.55) / 0.45)
        q.update(th1=lerp(28, 95, e), sh1=lerp(8, 92, e), th2=lerp(-14, -5, e), sh2=lerp(-30, -5, e), tl=lerp(8, -25, e),
                 ua2=lerp(15, -60, e), fa2=lerp(160, -30, e), ua1=lerp(35, 60, e), fa1=lerp(150, 120, e))
    elif act == "flykick":
        e = clamp(p / 0.3)
        q.update(th1=lerp(28, 100, e), sh1=lerp(8, 95, e), th2=lerp(-14, 40, e), sh2=lerp(-30, -60, e),
                 tl=lerp(8, -30, e), ua2=-70, fa2=-40, ua1=60, fa1=130, yo=-110 * math.sin(math.pi * clamp(p)))
    elif act == "hurt":
        e = 1 - ease_out(clamp(lt / 0.35))
        q.update(tl=-28 * e + 8 * (1 - e), ua1=lerp(35, -50, e), fa1=lerp(150, -20, e), ua2=lerp(15, -70, e),
                 fa2=lerp(160, -40, e), face="hurt")
    elif act in ("ko", "superko"):
        dur = 0.55 if act == "ko" else 1.1
        e = clamp(lt / dur)
        spin = 90 if act == "ko" else 450
        q.update(rot=lerp(0, spin, ease_out(e)), yo=-(90 if act == "ko" else 230) * math.sin(math.pi * e),
                 ua1=lerp(35, 160, e), fa1=lerp(150, 175, e), ua2=lerp(15, -160, e), fa2=lerp(160, -170, e),
                 th1=8, sh1=4, th2=-8, sh2=-4, tl=0, face="ko")
        if e >= 1:  # mexendo a perninha no chão
            q["sh1"] = 4 + 10 * math.sin(gt * 12)
    elif act == "taunt":
        q.update(ua1=170, fa1=175 + 10 * math.sin(gt * 14), ua2=15, fa2=160, face="happy")
    elif act == "victory":
        j = abs(math.sin(gt * 6))
        q.update(ua1=165, fa1=178, ua2=-165, fa2=-178, yo=-35 * j, th1=lerp(28, 10, j), sh1=lerp(8, -20, j),
                 th2=lerp(-14, -30, j), sh2=lerp(-30, -60, j), tl=0, face="happy")
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
    if q["face"] == "ko":
        for ex in (6, 18):
            d.line([P(ex - 4, -7), P(ex + 4, 1)], fill=OUT, width=3 * SS)
            d.line([P(ex - 4, 1), P(ex + 4, -7)], fill=OUT, width=3 * SS)
        pm = P(12, 12); rr = 4 * SS
        d.ellipse([pm[0] - rr, pm[1] - rr, pm[0] + rr, pm[1] + rr], fill=OUT)
    else:
        for ex in (6, 18):
            pe = P(ex, -3); rr = 3.2 * SS
            d.ellipse([pe[0] - rr, pe[1] - rr, pe[0] + rr, pe[1] + rr], fill=OUT)
        if q["face"] == "angry":
            d.line([P(1, -12), P(10, -8)], fill=OUT, width=3 * SS); d.line([P(14, -8), P(23, -12)], fill=OUT, width=3 * SS)
            d.line([P(6, 11), P(20, 9)], fill=OUT, width=3 * SS)
        elif q["face"] == "hurt":
            d.line([P(1, -8), P(10, -12)], fill=OUT, width=3 * SS); d.line([P(14, -12), P(23, -8)], fill=OUT, width=3 * SS)
            pm = P(14, 12); rr = 5 * SS
            d.ellipse([pm[0] - rr, pm[1] - rr, pm[0] + rr, pm[1] + rr], fill=OUT)
        else:
            d.line([P(4, 7), P(12, 13), P(22, 7)], fill=OUT, width=3 * SS, joint="curve")
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

# ---------------------------------------------------------------- COREOGRAFIA (tempo da "história")
SEGS = {"MT": [], "MS": []}
def seg(fid, t0, t1, act, x0, x1=None):
    SEGS[fid].append((t0, t1, act, x0, x0 if x1 is None else x1))

HITS = []  # (t, alvo, dano, tipo, x, y)
def hit(t, tgt, dmg, kind, x, y):
    HITS.append((t, tgt, dmg, kind, x, y))

MTH, MSH = FIGHTERS["MT"]["home"], FIGHTERS["MS"]["home"]
# entrada
seg("MT", 0, 4.5, "walk", -200); seg("MS", 0, 4.5, "walk", 1480)
seg("MT", 4.5, 7.0, "walk", -200, MTH); seg("MS", 4.5, 7.0, "walk", 1480, MSH)
seg("MT", 7.0, 10.0, "idle", MTH); seg("MS", 7.0, 10.74, "idle", MSH)
# ROUND 1 — MT manda bem
seg("MT", 10.0, 10.55, "walk", MTH, 700)
seg("MT", 10.55, 10.95, "punch", 700, 715); hit(10.67, "MS", 25, "small", 778, 445)
seg("MT", 10.95, 11.4, "punch", 715, 730); hit(11.07, "MS", 25, "small", 795, 445)
seg("MT", 11.4, 11.95, "upper", 730, 745); hit(11.56, "MS", 50, "big", 810, 400)
seg("MT", 11.95, 12.4, "idle", 745); seg("MT", 12.4, 14.2, "taunt", 745)
seg("MS", 10.67, 11.07, "hurt", MSH, 865); seg("MS", 11.07, 11.56, "hurt", 865, 880)
seg("MS", 11.56, 14.2, "ko", 880, 960)
# ROUND 2 — MS devolve
seg("MT", 14.2, 16.7, "idle", MTH); seg("MS", 14.2, 16.0, "idle", MSH)
seg("MS", 16.0, 16.35, "walk", MSH, 720)
seg("MS", 16.35, 16.95, "flykick", 720, 590); hit(16.6, "MT", 40, "big", 470, 420)
seg("MT", 16.6, 17.4, "hurt", MTH, 405)
seg("MS", 16.95, 17.25, "walk", 590, 545)
seg("MS", 17.25, 17.8, "kick", 545, 540); hit(17.4, "MT", 60, "big", 430, 470)
seg("MT", 17.4, 21.0, "ko", 405, 330)
seg("MS", 17.8, 21.0, "taunt", 540)
# DESEMPATE
seg("MT", 21.0, 24.4, "idle", MTH); seg("MS", 21.0, 24.4, "idle", MSH)
seg("MT", 24.4, 25.0, "walk", MTH, 560); seg("MS", 24.4, 25.0, "walk", MSH, 720)
seg("MT", 25.0, 25.2, "idle", 560); seg("MS", 25.0, 25.34, "idle", 720)
seg("MT", 25.2, 25.6, "punch", 560, 575); hit(25.32, "MS", 20, "small", 700, 445)
seg("MS", 25.34, 25.75, "hurt", 720, 740)
seg("MS", 25.75, 26.2, "punch", 740, 722); hit(25.87, "MT", 20, "small", 592, 445)
seg("MT", 25.6, 25.87, "idle", 575); seg("MT", 25.87, 26.35, "hurt", 575, 555)
seg("MT", 26.35, 26.9, "kick", 555, 565); hit(26.5, "MS", 20, "small", 690, 470)
seg("MS", 26.2, 26.5, "idle", 722); seg("MS", 26.5, 26.95, "hurt", 722, 745)
seg("MS", 26.95, 27.5, "kick", 745, 735); hit(27.1, "MT", 20, "small", 590, 470)
seg("MT", 26.9, 27.1, "idle", 565); seg("MT", 27.1, 27.65, "hurt", 565, 535)
seg("MS", 27.5, 27.7, "idle", 735)
seg("MT", 27.65, 28.05, "punch", 535, 585); seg("MS", 27.7, 28.05, "punch", 735, 690)
hit(27.82, "MT", 15, "clash", 638, 420); hit(27.82, "MS", 15, "clash", 638, 420)
seg("MT", 28.05, 28.5, "hurt", 585, 500); seg("MS", 28.05, 28.5, "hurt", 690, 770)
seg("MT", 28.5, 29.7, "idle", 500); seg("MS", 28.5, 29.7, "idle", 770)
# GOLPE FINAL (câmera lenta)
wx0, lx0 = (500, 770) if WINNER == "MT" else (770, 500)
wf = FIGHTERS[WINNER]["f"]
wx1 = lx0 - wf * 135
seg(WINNER, 29.7, 30.05, "walk", wx0, wx1)
seg(WINNER, 30.05, 30.75, "upper", wx1, wx1 + wf * 20); hit(30.2, LOSER, 100, "super", lx0 - wf * 40, 400)
seg(LOSER, 29.7, 30.2, "idle", lx0)
seg(LOSER, 30.2, 45, "superko", lx0, lx0 + wf * (190 if WINNER == "MT" else 170))
seg(WINNER, 30.75, 31.5, "idle", wx1 + wf * 20); seg(WINNER, 31.5, 45, "victory", wx1 + wf * 20)
for k in SEGS: SEGS[k].sort()

def fighter_state(fid, st):
    cur = None
    for s in SEGS[fid]:
        if s[0] <= st < s[1]:
            cur = s
    if cur is None:
        past = [s for s in SEGS[fid] if s[1] <= st]
        cur = max(past, key=lambda s: s[1]) if past else SEGS[fid][0]
    t0, t1, act, x0, x1 = cur
    lt = st - t0; p = clamp(lt / (t1 - t0))
    if act in ("ko", "superko"):
        x = lerp(x0, x1, ease_out(lt / (0.6 if act == "ko" else 1.1)))
    elif act == "hurt":
        x = lerp(x0, x1, ease_out(lt / 0.35))
    elif act == "walk":
        x = lerp(x0, x1, p)
    else:
        x = lerp(x0, x1, ease_io(p))
    return act, p, lt, x

ROUNDS = [(0, 14.2), (14.2, 21.0), (21.0, 99)]
def hp(fid, st):
    r = next(r for r in ROUNDS if r[0] <= st < r[1])
    v = 100.0; ghost = 100.0
    for t, tgt, dmg, *_ in HITS:
        if tgt == fid and r[0] <= t <= st:
            v -= dmg
            ghost -= dmg * clamp((st - t - 0.25) / 0.5)
    return max(0, v), max(0, ghost)

SCORE_EVENTS = [(12.3, "MT"), (17.9, "MS"), (31.4, WINNER)]
def score(st):
    s = {"MT": 0, "MS": 0}
    for t, w in SCORE_EVENTS:
        if st >= t: s[w] += 1
    return s

# câmera lenta no golpe final
SLOW_A, SLOW_B, SLOW_F = 30.1, 30.7, 4.0
END_ST = 37.5
def vt_from_st(st):
    if st < SLOW_A: return st
    if st < SLOW_B: return SLOW_A + (st - SLOW_A) * SLOW_F
    return SLOW_A + (SLOW_B - SLOW_A) * SLOW_F + (st - SLOW_B)
def st_from_vt(vt):
    if vt < SLOW_A: return vt
    if vt < SLOW_A + (SLOW_B - SLOW_A) * SLOW_F: return SLOW_A + (vt - SLOW_A) / SLOW_F
    return SLOW_B + vt - (SLOW_A + (SLOW_B - SLOW_A) * SLOW_F)
DURATION = vt_from_st(END_ST)

# ---------------------------------------------------------------- TEXTOS
def text(d, s, cx, cy, sz, fill=WHITE, stroke=(0, 0, 0), sw=None, anchor="mm", alpha_img=None):
    fnt = font(sz)
    sw = int((sw if sw is not None else max(2, sz / 12)) * SS)
    d.text((cx * SS, cy * SS), s, font=fnt, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor=anchor)

def text_layer(canvas, s, cx, cy, sz, fill, stroke=(0, 0, 0), alpha=1.0, rot=0):
    """texto em camada própria (permite transparência e rotação)"""
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

# banners: (t0, t1, texto, tamanho, cor, y)
BANNERS = [
    (6.4, 8.3, "VS", 150, YELLOW, 300),
    (8.3, 9.3, "ROUND 1", 110, WHITE, 300), (9.3, 10.2, "LUTA!", 130, (255, 80, 40), 300),
    (12.3, 13.9, "PONTO PRO MATO GROSSO!", 58, (120, 170, 255), 290),
    (14.4, 15.3, "ROUND 2", 110, WHITE, 300), (15.3, 16.1, "LUTA!", 130, (255, 80, 40), 300),
    (17.9, 18.9, "PONTO PRO MATO GROSSO DO SUL!", 50, (110, 230, 140), 290),
    (19.0, 20.6, "EMPATE!  1 x 1", 105, YELLOW, 300),
    (21.2, 23.6, "DESEMPATE!", 140, (255, 60, 40), 290),
    (22.2, 23.6, "QUEM LEVA ESSA?", 46, WHITE, 400),
    (23.7, 24.5, "ROUND FINAL", 100, YELLOW, 300), (24.5, 25.2, "LUTA!", 130, (255, 80, 40), 300),
    (28.55, 29.65, "ÚLTIMO GOLPE...", 70, WHITE, 300),
    (31.5, 99, f"{FIGHTERS[WINNER]['name']} VENCEU!", 62 if WINNER == "MT" else 50, YELLOW, 170),
    (32.3, 99, "CAMPEÃO DO DESEMPATE", 40, WHITE, 240),
]

POWS = ["POW!", "PÁ!", "TUM!", "BAM!", "CRAU!", "TOMA!"]
HIT_FX = [(h, random.choice(POWS), random.uniform(-25, 25)) for h in HITS if not (h[3] == "clash" and h[1] == "MS")]

CONFETTI = [(random.uniform(0, W), random.uniform(-400, -10), random.uniform(80, 220), random.uniform(-40, 40),
             random.choice([YELLOW, WHITE, FIGHTERS[WINNER]["shirt"], (255, 80, 60), (0, 200, 90)]),
             random.uniform(0, 6.28), random.uniform(5, 11)) for _ in range(160)]

# ---------------------------------------------------------------- HUD
def draw_hud(canvas, d, st):
    a = clamp((st - 6.2) / 0.5)
    if a <= 0: return
    sc = score(st)
    for fid, side in (("MT", 0), ("MS", 1)):
        F = FIGHTERS[fid]
        v, ghost = hp(fid, st)
        bw = 470; x0 = 40 if side == 0 else W - 40 - bw; y0 = 28 - (1 - a) * 120
        d.rounded_rectangle([x0 * SS - 4 * SS, y0 * SS - 4 * SS, (x0 + bw) * SS + 4 * SS, (y0 + 30) * SS + 4 * SS],
                            radius=8 * SS, fill=(0, 0, 0))
        d.rectangle([x0 * SS, y0 * SS, (x0 + bw) * SS, (y0 + 30) * SS], fill=(70, 10, 10))
        def bar(val, col):
            wv = bw * val / 100
            if side == 0: d.rectangle([(x0 + bw - wv) * SS, y0 * SS, (x0 + bw) * SS, (y0 + 30) * SS], fill=col)
            else: d.rectangle([x0 * SS, y0 * SS, (x0 + wv) * SS, (y0 + 30) * SS], fill=col)
        bar(ghost, (255, 60, 40))
        col = (255, 210, 0) if v > 30 else (255, 120, 0)
        if v <= 30 and int(st * 8) % 2: col = (255, 255, 255)
        bar(v, col)
        # bandeirinha + nome
        fl = F["flag"](60 * SS, 40 * SS)
        fx = x0 if side == 0 else x0 + bw - 60
        canvas.paste(fl, (int(fx * SS), int((y0 + 40) * SS)))
        d.rectangle([fx * SS, (y0 + 40) * SS, (fx + 60) * SS, (y0 + 80) * SS], outline=(0, 0, 0), width=2 * SS)
        nx = x0 + 72 if side == 0 else x0 + bw - 72
        text(d, F["name"], nx, y0 + 60, 26, WHITE, anchor="lm" if side == 0 else "rm")
        # bolinhas de vitória
        for i in range(2):
            cx = (x0 + bw - 20 - i * 30) if side == 0 else (x0 + 20 + i * 30); cy = y0 + 100
            fill = YELLOW if sc[fid] > i else (40, 40, 40)
            d.ellipse([(cx - 10) * SS, (cy - 10) * SS, (cx + 10) * SS, (cy + 10) * SS], fill=fill, outline=(0, 0, 0), width=2 * SS)
    # placar central
    d.rounded_rectangle([(W / 2 - 62) * SS, (18 - (1 - a) * 120) * SS, (W / 2 + 62) * SS, (78 - (1 - a) * 120) * SS],
                        radius=10 * SS, fill=(0, 0, 0), outline=YELLOW, width=3 * SS)
    text(d, f"{sc['MT']} x {sc['MS']}", W / 2, 48 - (1 - a) * 120, 38, YELLOW)

# ---------------------------------------------------------------- RENDER
BG = build_background()
OX = OY = 0

def shake_amount(st):
    m = 0
    for t, tgt, dmg, kind, *_ in HITS:
        dt = st - t
        if 0 <= dt < 0.35:
            m = max(m, {"small": 7, "big": 16, "clash": 22, "super": 34}[kind] * (1 - dt / 0.35))
    if 21.2 <= st < 21.6: m = max(m, 25 * (1 - (st - 21.2) / 0.4))
    if 1.25 <= st < 1.6: m = max(m, 20 * (1 - (st - 1.25) / 0.35))
    return m

def render(vt):
    global OX, OY
    st = st_from_vt(vt)
    m = shake_amount(st)
    OX, OY = random.uniform(-m, m), random.uniform(-m, m)
    # fundo (com zoom na abertura)
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
    d = ImageDraw.Draw(frame)
    # nomes dos estados no mapa
    for sig, nm in (("MT", "MATO GROSSO"), ("MS", "MATO GROSSO DO SUL")):
        lon, lat = centroid(sig); px, py = proj(lon, lat)
        a = clamp((st - 0.6) / 0.6) * (0.85 if st < 4.5 else 0.45)
        text_layer(frame, nm, px / SS - MARGIN + OX, py / SS - MARGIN + OY + (-50 if sig == "MT" else 30), 30, WHITE,
                   alpha=a)
    # escurece o fundo na luta
    dim = clamp((st - 4.0) / 1.0) * 0.35
    if 21.0 <= st < 24.4:  # pulsação vermelha do desempate
        pul = 0.5 + 0.5 * math.sin((st - 21) * 10)
        red = Image.new("RGBA", frame.size, (200, 0, 0, int(70 + 60 * pul)))
        frame.alpha_composite(red)
    if dim > 0:
        frame.alpha_composite(Image.new("RGBA", frame.size, (0, 0, 0, int(255 * dim))))
    d = ImageDraw.Draw(frame)

    # ABERTURA
    if st < 4.5:
        if 1.25 <= st < 1.45:
            frame.alpha_composite(Image.new("RGBA", frame.size, (255, 255, 255, int(255 * (1 - (st - 1.25) / 0.2)))))
        out = clamp((st - 3.9) / 0.5)
        if st >= 1.25:
            p = ease_out((st - 1.25) / 0.45)
            text_layer(frame, "MATO GROSSO", lerp(-400, 640, p) - out * 900, 230, 82, (130, 175, 255), alpha=1 - out)
            text_layer(frame, "MATO GROSSO DO SUL", lerp(1700, 640, p) + out * 900, 470, 70, (120, 235, 150), alpha=1 - out)
        if st >= 1.6:
            p = clamp((st - 1.6) / 0.25)
            text_layer(frame, "VS", 640, 350, lerp(260, 120, ease_out(p)), YELLOW, alpha=p * (1 - out),
                       rot=math.sin(st * 5) * 6)
        if st >= 2.3:
            p = clamp((st - 2.3) / 0.4)
            text_layer(frame, "A BATALHA DO CENTRO-OESTE", 640, 590, 36, WHITE, alpha=p * (1 - out))
        if st < 0.4:
            frame.alpha_composite(Image.new("RGBA", frame.size, (0, 0, 0, int(255 * (1 - st / 0.4)))))

    # BONECOS
    if st >= 4.3:
        order = ["MT", "MS"]
        # quem está atacando fica na frente
        states_ = {fid: fighter_state(fid, st) for fid in order}
        order.sort(key=lambda k: states_[k][0] in ("punch", "kick", "upper", "flykick"))
        for fid in order:
            act, p, lt, x = states_[fid]
            draw_fighter(d, fid, x, pose(act, p, lt, st, x))

    # efeitos de golpe
    for (t, tgt, dmg, kind, hx, hy), word, rot in HIT_FX:
        dt = st - t
        if 0 <= dt < 0.45:
            big = {"small": 1, "big": 1.5, "clash": 2.0, "super": 3.0}[kind]
            e = ease_out(dt / 0.18)
            r = (25 + 45 * e) * big
            a = 1 - clamp((dt - 0.2) / 0.25)
            lay = Image.new("RGBA", frame.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
            c = S((hx, hy))
            ld.polygon([(c[0] + px * SS, c[1] + py * SS) for px, py in star(0, 0, r * 1.3, rot=dt * 300, n=10, inner=.45)],
                       fill=(255, 140, 0, int(230 * a)))
            ld.polygon([(c[0] + px * SS, c[1] + py * SS) for px, py in star(0, 0, r, rot=dt * 300 + 18, n=10, inner=.5)],
                       fill=(255, 255, 180, int(255 * a)))
            frame.alpha_composite(lay)
            text_layer(frame, word, hx + OX, hy - 60 * big + OY, 34 * big * (0.6 + 0.4 * e), YELLOW, (150, 0, 0), alpha=a, rot=rot)
            if kind == "super" and dt < 0.12:
                frame.alpha_composite(Image.new("RGBA", frame.size, (255, 255, 255, int(255 * (1 - dt / 0.12)))))

    # faixas de câmera lenta
    if SLOW_A - 0.05 <= st < SLOW_B + 0.3:
        a = clamp((st - SLOW_A + 0.05) / 0.1) * (1 - clamp((st - SLOW_B) / 0.3))
        hbar = int(70 * a * SS)
        d = ImageDraw.Draw(frame)
        d.rectangle([0, 0, W * SS, hbar], fill=(0, 0, 0)); d.rectangle([0, H * SS - hbar, W * SS, H * SS], fill=(0, 0, 0))
        if a > 0.5:
            text(d, "CÂMERA LENTA", W - 30, H - 35 * a, 26, (255, 255, 255), anchor="rm")

    # confete da vitória
    if st >= 31.4:
        lt = st - 31.4
        cd = ImageDraw.Draw(frame)
        for x, y, vy, vx, col, ph, sz in CONFETTI:
            yy = y + vy * lt; xx = x + vx * lt + math.sin(lt * 3 + ph) * 20
            if yy > H + 20: continue
            w = abs(math.cos(lt * 6 + ph)) * sz + 2
            cd.rectangle([(xx - w / 2) * SS, (yy - sz / 2) * SS, (xx + w / 2) * SS, (yy + sz / 2) * SS], fill=col)

    d = ImageDraw.Draw(frame)
    draw_hud(frame, d, st)

    # banners
    for t0, t1, s, sz, col, y in BANNERS:
        if t0 <= st < t1:
            p = (st - t0)
            scl = lerp(2.6, 1.0, ease_out(p / 0.22))
            a = clamp(p / 0.12) * (1 - clamp((st - (t1 - 0.2)) / 0.2)) if t1 < 90 else clamp(p / 0.12)
            pulse = 1 + (0.06 * math.sin(st * 12) if "DESEMPATE" in s else 0)
            text_layer(frame, s, W / 2, y, sz * scl * pulse, col, alpha=a)

    # transições
    for tc in (14.2, 21.0):
        if abs(st - tc) < 0.35:
            frame.alpha_composite(Image.new("RGBA", frame.size, (0, 0, 0, int(255 * (1 - abs(st - tc) / 0.35)))))
    if vt > DURATION - 0.8:
        frame.alpha_composite(Image.new("RGBA", frame.size, (0, 0, 0, int(255 * clamp((vt - DURATION + 0.8) / 0.8)))))
    return frame.convert("RGB").resize((W, H), Image.LANCZOS)

# ---------------------------------------------------------------- ÁUDIO (sintetizado)
def make_audio(path):
    import numpy as np
    sr = 44100; n = int((DURATION + 0.5) * sr); out = np.zeros(n)
    rng = np.random.default_rng(1)
    def put(t, sig, gain=1.0):
        i = int(t * sr)
        if i >= n: return
        seg_ = sig[: n - i]; out[i:i + len(seg_)] += seg_ * gain
    def env(L, dec): return np.exp(-np.linspace(0, L, int(L * sr)) * dec)
    def kick():
        L = 0.35; tt = np.linspace(0, L, int(L * sr)); f = 120 * np.exp(-tt * 18) + 45
        return np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-tt * 9)
    def snare():
        L = 0.2; return rng.normal(0, 1, int(L * sr)) * env(L, 22) * 0.5
    def hat():
        L = 0.05; s = rng.normal(0, 1, int(L * sr)); s = np.diff(s, prepend=0); return s * env(L, 80) * 0.25
    def punch(strong):
        L = 0.4 if strong else 0.25; tt = np.linspace(0, L, int(L * sr))
        body = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-tt * 10) + 40) / sr) * np.exp(-tt * 12)
        noise = rng.normal(0, 1, len(tt)) * np.exp(-tt * (25 if strong else 40))
        return body * 1.2 + noise * 0.8
    def gong():
        L = 2.0; tt = np.linspace(0, L, int(L * sr))
        return sum(np.sin(2 * np.pi * f * tt) * a for f, a in ((220, .6), (331, .4), (440, .3), (587, .2))) * np.exp(-tt * 2.2)
    def whoosh():
        L = 0.45; tt = np.linspace(0, L, int(L * sr)); s = rng.normal(0, 1, len(tt))
        s = np.convolve(s, np.ones(30) / 30, mode="same")
        return s * np.sin(np.pi * tt / L) * 3
    def stab(freqs, L=0.6):
        tt = np.linspace(0, L, int(L * sr))
        return sum(np.sign(np.sin(2 * np.pi * f * tt)) for f in freqs) * np.exp(-tt * 4) * 0.12
    # batida (para no intro e volta)
    bpm = 132; beat = 60 / bpm; t = 1.25
    while t < DURATION - 1:
        st = st_from_vt(t)
        if not (SLOW_A <= st < SLOW_B) and not (13.9 < st < 14.4) and not (20.6 < st < 21.2):
            b = round((t - 1.25) / beat)
            put(t, kick(), 0.55 if b % 2 == 0 else 0.0)
            if b % 4 == 2: put(t, snare(), 0.5)
            put(t + beat / 2, hat(), 0.6)
            if b % 8 == 0:
                root = 110 if st < 21 else 130.8
                put(t, stab([root, root * 1.5, root * 2]), 1.0)
        t += beat
    put(1.25, kick(), 1.2); put(1.25, whoosh(), 0.6); put(1.25, stab([55, 82.5, 110], 1.5), 2.0)
    # eventos por tempo da história
    def at(st): return vt_from_st(st)
    for t0, t1, s, *_ in BANNERS:
        if s.startswith("ROUND"): put(at(t0), gong(), 0.5)
        if s == "LUTA!": put(at(t0), stab([220, 330, 440], 0.4), 2.0)
        if s == "VS": put(at(t0), whoosh(), 0.7)
        if s.startswith("DESEMPATE"):
            put(at(t0), kick(), 1.5); put(at(t0), stab([55, 58, 82.5], 2.0), 2.5)
        if "VENCEU" in s:
            for i, f in enumerate([262, 330, 392, 523]): put(at(t0) + i * 0.14, stab([f, f * 1.5], 0.5), 1.8)
            put(at(t0) + 0.6, stab([523, 659, 784], 1.8), 2.2)
    for tt_, tgt, dmg, kind, *_ in HITS:
        put(at(tt_), punch(kind != "small"), {"small": .7, "big": 1.0, "clash": .9, "super": 1.4}[kind])
        if kind == "super": put(at(tt_), stab([40, 60], 2.5), 3)
    for fid in SEGS:
        for t0, t1, act, *_ in SEGS[fid]:
            if act in ("punch", "kick", "upper", "flykick"): put(at(t0) + 0.02, whoosh(), 0.25)
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.9
    data = (out * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(data.tobytes())

if __name__ == "__main__":
    if PREVIEW:
        for t in PREVIEW:
            render(t).save(f"preview_{t:05.2f}.png")
        sys.exit()
    wav = "luta_audio.wav"; mp4 = os.path.join(HERE, "luta_mt_ms.mp4")
    make_audio(wav)
    nfr = int(DURATION * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", mp4],
                          stdin=subprocess.PIPE)
    for i in range(nfr):
        ff.stdin.write(render(i / FPS).tobytes())
        if i % 150 == 0: print(f"frame {i}/{nfr}", flush=True)
    ff.stdin.close(); ff.wait()
    os.remove(wav)
    print("ok:", mp4, f"{DURATION:.1f}s")
