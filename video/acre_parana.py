#!/usr/bin/env python3
"""Show dos Estados: ACRE x PARANÁ — programa de auditório até o desempate.

Os competidores são mascotes no formato do próprio estado (com a bandeira, braços, pernas
e rosto). A apresentadora faz as perguntas, eles apertam a campainha e respondem (voz
sintetizada), o telão mostra o placar e, no 2 x 2, vem a pergunta de desempate.

Requisitos: apt-get install espeak-ng mbrola-br1 mbrola-br3 mbrola-br4 ; pip install pillow numpy
Uso: python3 acre_parana.py [--winner AC|PR] [--preview t1,t2,...]
"""
import hashlib, json, math, os, random, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, SS, FPS, SR = 1280, 720, 2, 30, 44100
GROUND = 590
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
args = sys.argv[1:]
WINNER = args[args.index("--winner") + 1] if "--winner" in args else "AC"
LOSER = "PR" if WINNER == "AC" else "AC"
PREVIEW = [float(x) for x in args[args.index("--preview") + 1].split(",")] if "--preview" in args else None
random.seed(3)

_fonts = {}
def font(sz):
    sz = max(4, int(sz * SS))
    if sz not in _fonts: _fonts[sz] = ImageFont.truetype(FONT, sz)
    return _fonts[sz]
def lerp(a, b, t): return a + (b - a) * t
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out(t): t = clamp(t); return 1 - (1 - t) ** 3
def ease_io(t): t = clamp(t); return t * t * (3 - 2 * t)
def P(x, y): return (x * SS, y * SS)

def star(cx, cy, r, rot=-90, n=5, inner=0.42):
    return [(cx + (r if i % 2 == 0 else r * inner) * math.cos(math.radians(rot + i * 180 / n)),
             cy + (r if i % 2 == 0 else r * inner) * math.sin(math.radians(rot + i * 180 / n))) for i in range(n * 2)]

YELLOW, WHITE, BLACK = (255, 214, 0), (255, 255, 255), (15, 10, 20)
AC_GREEN, AC_YELLOW, AC_RED = (0, 150, 60), (255, 210, 0), (220, 30, 40)
PR_GREEN, PR_BLUE = (0, 130, 70), (25, 60, 160)

def flag_ac(w, h):
    im = Image.new("RGB", (w, h), AC_GREEN); d = ImageDraw.Draw(im)
    d.polygon([(0, 0), (w, 0), (0, h)], fill=AC_YELLOW)
    d.polygon(star(w * .2, h * .27, min(w, h) * .15), fill=AC_RED)
    return im

def flag_pr(w, h):
    im = Image.new("RGB", (w, h), PR_GREEN); d = ImageDraw.Draw(im)
    t = min(w, h) * .2
    d.polygon([(0, 0), (t, 0), (w, h - t), (w, h), (w - t, h), (0, t)], fill=WHITE)
    r = min(w, h) * .26; cx, cy = w / 2, h / 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PR_BLUE)
    d.line([(cx - r, cy + r * .1), (cx + r, cy - r * .1)], fill=WHITE, width=max(2, int(r * .22)))
    for sx, sy in ((0, -.55), (.4, .45), (-.35, .5), (.05, .7), (.55, -.3)):
        d.polygon(star(cx + sx * r, cy + sy * r, r * .12), fill=WHITE)
    return im

# ---------------------------------------------------------------- MASCOTES (corpo = mapa do estado)
geo = json.load(open(os.path.join(HERE, "brazil-states.geojson")))
SHAPES = {}
for f in geo["features"]:
    sg = f["properties"]["sigla"]
    if sg in ("AC", "PR"):
        g = f["geometry"]; polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        SHAPES[sg] = max((p[0] for p in polys), key=len)

def make_sprite(sig, width, maker):
    ring = SHAPES[sig]
    lat_m = sum(p[1] for p in ring) / len(ring); c = math.cos(math.radians(lat_m))
    xs = [p[0] * c for p in ring]; ys = [-p[1] for p in ring]
    k = width / (max(xs) - min(xs)); h = (max(ys) - min(ys)) * k
    pad = 10
    pts = [((x - min(xs)) * k + pad, (y - min(ys)) * k + pad) for x, y in zip(xs, ys)]
    sw, sh = int((width + 2 * pad) * SS), int((h + 2 * pad) * SS)
    spts = [(x * SS, y * SS) for x, y in pts]
    mask = Image.new("L", (sw, sh), 0); ImageDraw.Draw(mask).polygon(spts, fill=255)
    spr = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    spr.paste(maker(sw, sh), (0, 0), mask)
    d = ImageDraw.Draw(spr)
    d.line(spts + [spts[0]], fill=BLACK, width=6 * SS, joint="curve")
    d.line(spts + [spts[0]], fill=WHITE, width=2 * SS, joint="curve")
    # brilho no corpo
    gl = Image.new("RGBA", (sw, sh), (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    gd.ellipse([sw * .12, sh * .08, sw * .55, sh * .35], fill=(255, 255, 255, 50))
    m2 = Image.new("L", (sw, sh), 0); m2.paste(gl.getchannel("A"), (0, 0), mask)
    gl.putalpha(m2); spr.alpha_composite(gl)
    return spr, width, h

MASC = {
    "AC": dict(name="ACRE", home=225, f=1, width=290, maker=flag_ac, shoe=(150, 30, 30), glove=WHITE,
               tag=(0, 140, 60), tag2=AC_YELLOW, buzzer=440, voice=["-v", "mb-br1", "-s", "152", "-p", "48"]),
    "PR": dict(name="PARANÁ", home=1055, f=-1, width=240, maker=flag_pr, shoe=(30, 40, 120), glove=WHITE,
               tag=PR_BLUE, tag2=(130, 220, 140), buzzer=840, voice=["-v", "mb-br3", "-s", "152", "-p", "52"]),
}
for k, m in MASC.items():
    m["spr"], m["bw"], m["bh"] = make_sprite(k, m["width"], m["maker"])
HOST = dict(name="APRESENTADORA", tag=(140, 50, 190), tag2=(255, 170, 230), voice=["-v", "mb-br4", "-s", "158", "-p", "55"])
LEG = 78

def limb(d, a, b, w, col, outline=True):
    if outline: limb(d, a, b, w + 5, BLACK, False)
    A, B = P(*a), P(*b); r = w * SS / 2
    d.line([A, B], fill=col, width=int(w * SS))
    for Q in (A, B): d.ellipse([Q[0] - r, Q[1] - r, Q[0] + r, Q[1] + r], fill=col)

def arm_pts(sh, a1, a2, side, L1=42, L2=40):
    """ângulos em graus a partir de 'para baixo'; side=+1 abre para a direita"""
    e = (sh[0] + side * math.sin(math.radians(a1)) * L1, sh[1] + math.cos(math.radians(a1)) * L1)
    h = (e[0] + side * math.sin(math.radians(a2)) * L2, e[1] + math.cos(math.radians(a2)) * L2)
    return e, h

def draw_mascot(frame, fid, x, st, act, lt, mouth, look):
    M = MASC[fid]; f = M["f"]; bw, bh = M["bw"], M["bh"]
    d = ImageDraw.Draw(frame)
    bob = math.sin(st * 3 + (0 if fid == "AC" else 1.5)) * 3
    tilt = 0; sy = 1.0; walk = 0; jump = 0
    if act == "talk": tilt = 3 * math.sin(st * 3.1); sy = 1 + 0.05 * mouth
    elif act == "cheer": jump = abs(math.sin(st * 7)) * 30; tilt = 6 * math.sin(st * 7)
    elif act == "sad": tilt = -4 * f; sy = 0.94
    elif act == "walk": walk = 1; jump = abs(math.cos(st * 9)) * 8
    elif act == "victory": jump = abs(math.sin(st * 6)) * 45; tilt = 10 * math.sin(st * 3)
    feet_y = GROUND - jump
    cy = feet_y - LEG - bh * sy * 0.5 + 18 + bob
    # pernas
    for side in (-1, 1):
        hip = (x + side * bw * 0.2, cy + bh * sy * 0.2)
        sw = math.sin(st * 9 + (0 if side < 0 else math.pi)) * 22 * walk
        foot = (x + side * bw * 0.22 + sw, feet_y - 6 + (0 if side * sw <= 0 else -abs(sw) * 0.3))
        if act == "victory": foot = (foot[0] + side * 12, foot[1])
        knee = ((hip[0] + foot[0]) / 2 + f * 6, (hip[1] + foot[1]) / 2)
        limb(d, hip, knee, 11, (40, 30, 30)); limb(d, knee, foot, 11, (40, 30, 30))
        s = P(foot[0] + f * 8, foot[1] + 2)
        d.ellipse([s[0] - 22 * SS, s[1] - 10 * SS, s[0] + 22 * SS, s[1] + 9 * SS], fill=M["shoe"], outline=BLACK, width=3 * SS)
    # braços (atrás do corpo, ombro escondido)
    for side in (-1, 1):
        sh = (x + side * bw * 0.36, cy + 4)
        front = side == f
        if act == "talk":
            g = math.sin(st * 4.3 + side) * 0.5 + math.sin(st * 7.1) * 0.5
            a1, a2 = (lerp(70, 120, (g + 1) / 2), lerp(120, 170, (math.sin(st * 5.3) + 1) / 2)) if front else (30, 60)
        elif act == "cheer" or act == "victory":
            a1, a2 = 160 + 10 * math.sin(st * 9 + side), 175
        elif act == "sad": a1, a2 = 8, 4
        elif act == "buzz": a1, a2 = (lerp(30, 100, ease_out(lt / 0.15)), lerp(40, 130, ease_out(lt / 0.15))) if front else (30, 40)
        elif act == "listen": a1, a2 = 40, -60  # mão na cintura
        elif act == "walk": a1, a2 = 25 + 25 * math.sin(st * 9 + side), 40
        else: a1, a2 = 25 + 3 * math.sin(st * 2 + side), 35
        e, hnd = arm_pts(sh, a1, a2, side)
        limb(d, sh, e, 10, (235, 200, 160)); limb(d, e, hnd, 10, (235, 200, 160))
        r = 11 * SS; hp = P(*hnd)
        d.ellipse([hp[0] - r, hp[1] - r, hp[0] + r, hp[1] + r], fill=M["glove"], outline=BLACK, width=3 * SS)
    # corpo (sprite do estado)
    spr = M["spr"]
    if sy != 1.0: spr = spr.resize((int(spr.width * (2 - sy)), int(spr.height * sy)), Image.BILINEAR)
    if tilt: spr = spr.rotate(tilt, expand=True, resample=Image.BICUBIC)
    frame.alpha_composite(spr, (int(x * SS - spr.width / 2), int(cy * SS - spr.height / 2)))
    # rosto (gira junto com o corpo)
    th = math.radians(-tilt)
    def L(lx, ly):
        ly *= sy; c, s = math.cos(th), math.sin(th)
        return P(x + lx * c - ly * s, cy + lx * s + ly * c)
    fx = f * bw * 0.06; fy = -bh * 0.08
    lx_, ly_ = look
    for ex in (-16, 16):
        c = L(fx + ex, fy); r = 15 * SS
        if act == "sad" or (act == "victory" and int(st * 2) % 4 == 0):  # olhos fechados / felizes
            d.arc([c[0] - r, c[1] - r * .6, c[0] + r, c[1] + r * .8], 200 if act == "sad" else 20,
                  340 if act == "sad" else 160, fill=BLACK, width=4 * SS)
            continue
        d.ellipse([c[0] - r, c[1] - r * 1.15, c[0] + r, c[1] + r * 1.15], fill=WHITE, outline=BLACK, width=3 * SS)
        pr = 7 * SS; pc = (c[0] + lx_ * 6 * SS, c[1] + ly_ * 5 * SS)
        d.ellipse([pc[0] - pr, pc[1] - pr, pc[0] + pr, pc[1] + pr], fill=BLACK)
        d.ellipse([pc[0] - pr * .2, pc[1] - pr * .7, pc[0] + pr * .35, pc[1] - pr * .15], fill=WHITE)
    # sobrancelhas
    br = {"talk": 4, "sad": -6, "listen": 0, "cheer": 6, "victory": 6}.get(act, 2)
    for ex in (-16, 16):
        a = L(fx + ex - 11, fy - 24 - (br if ex * f < 0 else br * 0.6)); b = L(fx + ex + 11, fy - 24 - (br if ex * f > 0 else br * 0.6))
        if act == "sad": a, b = L(fx + ex - 11, fy - 22 + (6 if ex < 0 else 0)), L(fx + ex + 11, fy - 22 + (0 if ex < 0 else 6))
        d.line([a, b], fill=BLACK, width=5 * SS)
    # boca
    mc = L(fx, fy + 30)
    if act in ("talk",) and mouth > 0.08 or act in ("cheer", "victory"):
        o = 4 + 13 * (mouth if act == "talk" else 0.8); w_ = 16
        d.chord([mc[0] - w_ * SS, mc[1] - o * SS, mc[0] + w_ * SS, mc[1] + o * SS], 0, 360 if act == "talk" else 180,
                fill=(120, 20, 30), outline=BLACK, width=3 * SS)
        d.ellipse([mc[0] - 7 * SS, mc[1] + (o - 6) * SS * .6, mc[0] + 7 * SS, mc[1] + o * SS * .8], fill=(230, 90, 100))
    elif act == "sad":
        d.arc([mc[0] - 15 * SS, mc[1], mc[0] + 15 * SS, mc[1] + 18 * SS], 200, 340, fill=BLACK, width=4 * SS)
    else:
        d.arc([mc[0] - 15 * SS, mc[1] - 14 * SS, mc[0] + 15 * SS, mc[1] + 6 * SS], 20, 160, fill=BLACK, width=4 * SS)

def draw_host(frame, st, act, mouth, point):
    d = ImageDraw.Draw(frame); x = 640
    bob = math.sin(st * 2.5) * 2
    hip = (x, GROUND - 128 + bob); neck = (x, hip[1] - 92); head = (x, neck[1] - 34)
    for side in (-1, 1):  # pernas
        k = (x + side * 12, hip[1] + 64); ft = (x + side * 16, GROUND - 6)
        limb(d, (x + side * 10, hip[1]), k, 16, (40, 20, 60)); limb(d, k, ft, 16, (40, 20, 60))
        s = P(ft[0] + side * 6, ft[1] + 2)
        d.ellipse([s[0] - 18 * SS, s[1] - 8 * SS, s[0] + 18 * SS, s[1] + 7 * SS], fill=(200, 30, 90), outline=BLACK, width=3 * SS)
    # tronco (blazer)
    body = [P(x - 34, neck[1] + 4), P(x + 34, neck[1] + 4), P(x + 30, hip[1] + 6), P(x - 30, hip[1] + 6)]
    d.polygon(body, fill=(140, 50, 190), outline=BLACK, width=3 * SS)
    d.polygon([P(x - 12, neck[1] + 4), P(x + 12, neck[1] + 4), P(x, neck[1] + 46)], fill=WHITE, outline=BLACK)
    for i in range(3):
        d.polygon([P(*q) for q in star(x, neck[1] + 56 + i * 14, 4)], fill=YELLOW)
    # braços: direito segura o microfone, esquerdo aponta/gesticula
    shR, shL = (x + 34, neck[1] + 12), (x - 34, neck[1] + 12)
    if act == "talk" or act == "point":
        eR, hR = arm_pts(shR, 40, 175, -1, 44, 38)
    else:
        eR, hR = arm_pts(shR, 15, 60, -1, 44, 38)
    if act == "point":
        a = 95; side = point
        eL, hL = arm_pts(shR if side > 0 else shL, a, a + 5, side, 44, 40)
        shG = shR if side > 0 else shL
    elif act == "talk":
        g = math.sin(st * 4)
        eL, hL = arm_pts(shL, 50 + 20 * g, 110 + 30 * math.sin(st * 6), -1, 44, 40); shG = shL
    else:
        eL, hL = arm_pts(shL, 18, 30, -1, 44, 40); shG = shL
    if not (act == "point" and point > 0):
        limb(d, shR, eR, 13, (140, 50, 190)); limb(d, eR, hR, 11, (200, 150, 110))
    limb(d, shG, eL, 13, (140, 50, 190)); limb(d, eL, hL, 11, (200, 150, 110))
    # microfone
    m = P(*hR)
    d.line([m, (m[0] - 2 * SS, m[1] - 22 * SS)], fill=(30, 30, 30), width=7 * SS)
    mm = (m[0] - 2 * SS, m[1] - 26 * SS)
    d.ellipse([mm[0] - 9 * SS, mm[1] - 9 * SS, mm[0] + 9 * SS, mm[1] + 9 * SS], fill=(160, 160, 170), outline=BLACK, width=2 * SS)
    # cabeça + cabelo
    hc = P(*head); r = 30 * SS
    HAIR = (60, 30, 20)
    d.ellipse([hc[0] - r - 10 * SS, hc[1] - r - 8 * SS, hc[0] + r + 10 * SS, hc[1] + r * .8], fill=HAIR, outline=BLACK, width=3 * SS)
    for sd in (-1, 1):
        d.rounded_rectangle([min(hc[0] + sd * (r - 8 * SS), hc[0] + sd * (r + 12 * SS)), hc[1] - 6 * SS,
                             max(hc[0] + sd * (r - 8 * SS), hc[0] + sd * (r + 12 * SS)), hc[1] + r + 22 * SS],
                            radius=8 * SS, fill=HAIR, outline=BLACK, width=3 * SS)
    d.ellipse([hc[0] - r, hc[1] - r, hc[0] + r, hc[1] + r], fill=(200, 150, 110), outline=BLACK, width=3 * SS)
    d.chord([hc[0] - r - 2 * SS, hc[1] - r - 6 * SS, hc[0] + r + 2 * SS, hc[1] + r * .5], 180, 360, fill=(60, 30, 20))
    lk = point * 4
    for ex in (-11, 11):
        e = (hc[0] + (ex + lk) * SS, hc[1] + 4 * SS)
        d.ellipse([e[0] - 4 * SS, e[1] - 5 * SS, e[0] + 4 * SS, e[1] + 5 * SS], fill=BLACK)
    mo = (hc[0] + lk * SS, hc[1] + 18 * SS)
    if act in ("talk", "point") and mouth > 0.08:
        o = 2 + 7 * mouth
        d.ellipse([mo[0] - 8 * SS, mo[1] - o * SS, mo[0] + 8 * SS, mo[1] + o * SS], fill=(150, 20, 50), outline=BLACK, width=2 * SS)
    else:
        d.arc([mo[0] - 10 * SS, mo[1] - 9 * SS, mo[0] + 10 * SS, mo[1] + 3 * SS], 20, 160, fill=(150, 20, 50), width=4 * SS)
    for ex in (-36, 36):  # brincos
        e = (hc[0] + ex * SS, hc[1] + 12 * SS)
        d.ellipse([e[0] - 4 * SS, e[1] - 4 * SS, e[0] + 4 * SS, e[1] + 4 * SS], fill=YELLOW, outline=BLACK)

# ---------------------------------------------------------------- ESTÚDIO
SCREEN = (400, 40, 880, 262)
def build_studio():
    bg = Image.new("RGB", (W * SS, H * SS)); d = ImageDraw.Draw(bg)
    for y in range(H * SS):
        t = y / (H * SS)
        d.line([(0, y), (W * SS, y)], fill=(int(lerp(35, 70, t)), int(lerp(10, 20, t)), int(lerp(70, 110, t))))
    for i in range(0, W, 80):  # painéis da parede
        d.rectangle([P(i + 6, 20), P(i + 74, 470)], fill=(50, 18, 90), outline=(90, 40, 150), width=2 * SS)
    for i in range(0, W, 40):  # lampadinhas
        for yy in (14, 476):
            d.ellipse([P(i + 14, yy - 5), P(i + 24, yy + 5)], fill=(255, 220, 120))
    # palco
    d.rectangle([P(0, 470), P(W, H)], fill=(30, 15, 50))
    d.ellipse([P(-150, 520), P(W + 150, 760)], fill=(70, 30, 120), outline=(255, 200, 80), width=4 * SS)
    d.ellipse([P(60, 545), P(W - 60, 720)], fill=(95, 45, 150))
    for i in range(-10, 11):
        d.line([P(640 + i * 40, 560), P(640 + i * 120, H)], fill=(120, 60, 180), width=SS)
    # moldura do telão
    x0, y0, x1, y1 = SCREEN
    d.rounded_rectangle([P(x0 - 14, y0 - 14), P(x1 + 14, y1 + 14)], radius=14 * SS, fill=(20, 20, 30), outline=(200, 200, 220), width=3 * SS)
    d.line([P(640, y1 + 14), P(640, 330)], fill=(60, 60, 80), width=6 * SS)
    return bg
STUDIO = build_studio()

def draw_buzzer(d, x, lit):
    d.rectangle([P(x - 28, GROUND - 105), P(x + 28, GROUND)], fill=(70, 70, 90), outline=BLACK, width=3 * SS)
    d.ellipse([P(x - 28, GROUND - 117), P(x + 28, GROUND - 93)], fill=(110, 110, 130), outline=BLACK, width=3 * SS)
    col = (255, 60, 60) if lit else (150, 20, 20)
    if lit:
        for r, c_ in ((34, (255, 150, 150)), (26, (255, 210, 210))):
            d.ellipse([P(x - r, GROUND - 120 - r * .8), P(x + r, GROUND - 120 + r * .5)], fill=c_)
    d.chord([P(x - 20, GROUND - 130), P(x + 20, GROUND - 100)], 180, 360, fill=col, outline=BLACK, width=3 * SS)

def spotlights(frame, st, color=(255, 240, 200), alpha=34):
    lay = Image.new("RGBA", frame.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for i, (sx, ph) in enumerate(((120, 0), (420, 1.7), (860, 3.1), (1160, 4.4))):
        ang = math.sin(st * 0.8 + ph) * 0.45
        tx = sx + math.sin(ang) * 700; ty = 700
        d.polygon([P(sx - 10, -10), P(sx + 10, -10), P(tx + 120, ty), P(tx - 120, ty)], fill=color + (alpha,))
    frame.alpha_composite(lay)

def text(d, s, cx, cy, sz, fill=WHITE, stroke=BLACK, anchor="mm", sw=None):
    d.text(P(cx, cy), s, font=font(sz), fill=fill, anchor=anchor, stroke_width=int((sw if sw is not None else max(2, sz / 12)) * SS),
           stroke_fill=stroke)

def text_layer(canvas, s, cx, cy, sz, fill, stroke=BLACK, alpha=1.0, rot=0):
    if alpha <= 0.01 or sz < 2: return
    fnt = font(sz); sw = int(max(2, sz / 12) * SS)
    bb = fnt.getbbox(s, stroke_width=sw); tw, th = bb[2] - bb[0] + 20, bb[3] - bb[1] + 20
    lay = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((tw / 2, th / 2), s, font=fnt, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor="mm")
    if rot: lay = lay.rotate(rot, expand=True, resample=Image.BICUBIC)
    if alpha < 1: lay.putalpha(lay.getchannel("A").point(lambda v: int(v * alpha)))
    canvas.alpha_composite(lay, (int(cx * SS - lay.width / 2), int(cy * SS - lay.height / 2)))

# ---------------------------------------------------------------- ROTEIRO
NAMES = {"AC": "ACRE", "PR": "PARANÁ"}
INTRO = [
    ("AP", "Boa noite! Está começando o Show dos Estados! Hoje é ACRE contra PARANÁ!",
           "Boa noite! Está começando o Show dos Estados! Hoje é Acre contra Paraná!"),
    ("AC", "Oi, gente! E antes que perguntem: sim, o Acre existe!", "Oi, gente! E antes que perguntem: sim, o Acre existe!"),
    ("PR", "E eu sou o Paraná, terra do pinhão e da usina de Itaipu! Pode mandar a pergunta!",
           "E eu sou o Paraná, terra do pinhão e da usina de Itaipu! Pode mandar a pergunta!"),
]
# (tema, pergunta, [respostas na ordem da campainha], vencedor, veredito)
ROUNDS = [
    ("HISTÓRIA", "Primeira pergunta, valendo um ponto! Tema: história!", [
        ("AC", "Eu virei Brasil na raça! Teve a Revolução Acreana e, em 1903, o Tratado de Petrópolis!",
               "Eu virei Brasil na raça! Teve a Revolução Acreana e, em 1903, o Tratado de Petrópolis!"),
        ("PR", "Eu me separei de São Paulo em 1853 e virei província, com capital em Curitiba!",
               "Eu me separei de São Paulo em 1853 e virei província, com capital em Curitiba!"),
    ], "AC", "Revolução e tratado? Ponto pro Acre!"),
    ("TURISMO", "Segunda pergunta! Tema: turismo!", [
        ("PR", "Tenho as Cataratas do Iguaçu, uma das Sete Maravilhas da Natureza!",
               "Tenho as Cataratas do Iguaçu, uma das Sete Maravilhas da Natureza!"),
        ("AC", "E eu tenho os geoglifos: desenhos gigantes no chão, feitos há séculos pelos povos antigos!",
               "E eu tenho os geoglifos: desenhos gigantes no chão, feitos há séculos pelos povos antigos!"),
    ], "PR", "Cataratas não tem como! Ponto pro Paraná!"),
    ("EDUCAÇÃO", "Terceira pergunta! Tema: educação!", [
        ("AC", "A UFAC forma gente em Rio Branco e em Cruzeiro do Sul!", "A U F A C forma gente em Rio Branco e em Cruzeiro do Sul!"),
        ("PR", "A Universidade Federal do Paraná nasceu em 1912 e é uma das mais antigas do Brasil!",
               "A Universidade Federal do Paraná nasceu em 1912 e é uma das mais antigas do Brasil!"),
    ], "PR", "Universidade centenária! Ponto pro Paraná!"),
    ("MEIO AMBIENTE", "Quarta pergunta! Tema: meio ambiente!", [
        ("PR", "Curitiba é famosa pelos parques e por um transporte que virou modelo no mundo!",
               "Curitiba é famosa pelos parques e por um transporte que virou modelo no mundo!"),
        ("AC", "Eu sou quase todo floresta amazônica, e sou a terra do Chico Mendes, defensor da floresta!",
               "Eu sou quase todo floresta amazônica, e sou a terra do Chico Mendes, defensor da floresta!"),
    ], "AC", "Chico Mendes! Ponto pro Acre!"),
]
FINAL = ("COMIDA TÍPICA", "Pergunta de desempate! Tema: comida típica!", [
    ("AC", "Baixaria no café da manhã, tacacá e a farinha de Cruzeiro do Sul, que tem até indicação geográfica!",
           "Baixaria no café da manhã, tacacá, e a farinha de Cruzeiro do Sul, que tem até indicação geográfica!"),
    ("PR", "Barreado do litoral, pinhão quentinho e o pierogi dos imigrantes!",
           "Barreado do litoral, pinhão quentinho, e o pierogi dos imigrantes!"),
], WINNER)
ENDING = {
    "AC": [("PR", "Parabéns, Acre! Aparece aqui pra tomar um chimarrão!", "Parabéns, Acre! Aparece aqui pra tomar um chimarrão!"),
           ("AC", "Pode deixar! E você vem provar a baixaria!", "Pode deixar! E você vem provar a baixaria!")],
    "PR": [("AC", "Parabéns, Paraná! Mas a baixaria do café da manhã ninguém supera!",
                  "Parabéns, Paraná! Mas a baixaria do café da manhã ninguém supera!"),
           ("PR", "Então vem que o chimarrão tá pronto!", "Então vem que o chimarrão tá pronto!")],
}[WINNER] + [("AP", "Até a próxima, pessoal!", "Até a próxima, pessoal!")]

# ---------------------------------------------------------------- VOZ
CACHE = os.environ.get("TTS_CACHE", os.path.join(HERE, ".tts_cache"))
def voice_of(who): return HOST["voice"] if who == "AP" else MASC[who]["voice"]
def tts(who, spoken):
    os.makedirs(CACHE, exist_ok=True)
    v = voice_of(who)
    path = os.path.join(CACHE, hashlib.md5((spoken + " ".join(v)).encode()).hexdigest()[:16] + ".wav")
    if not os.path.exists(path):
        subprocess.run(["espeak-ng", *v, "-w", path, spoken], check=True, stderr=subprocess.DEVNULL)
    with wave.open(path) as w:
        sr0 = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
    a = np.interp(np.arange(0, len(a) * SR / sr0) * sr0 / SR, np.arange(len(a)), a)
    a = a / (np.max(np.abs(a)) + 1e-9) * 0.95
    hop = SR // FPS
    env = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2)) for i in range(0, len(a), hop)])
    return a, np.clip(env / (np.percentile(env, 90) + 1e-9), 0, 1), len(a) / SR

# ---------------------------------------------------------------- LINHA DO TEMPO
LINES, SFX, SCORES, BUZZ = [], [], [], []   # BUZZ: (t, fid)
ACTS = {"AC": [], "PR": [], "AP": []}
SCREENS = []  # (t0, t1, modo, dado)
POPS = []     # (t0, t1, texto, tam, cor, y)
def act(who, t0, t1, a, data=0): ACTS[who].append((t0, t1, a, data))
def say(t, who, disp, spoken, host_act="talk", point=0):
    a, env, dur = tts(who, spoken)
    LINES.append((t, who, disp, a, env, dur))
    act(who, t, t + dur + 0.1, host_act if who == "AP" else "talk", point)
    return t + dur + 0.5

OPEN_END = 5.0; WALK = (5.4, 7.6)
t = 7.8
SCREENS.append((0, 999, "score", None))
SCREENS.append((OPEN_END, t + 6, "logo", None))
for who, disp, spoken in INTRO: t = say(t, who, disp, spoken)

def play(t, n, tema, question, answers, winner, verdict, final=False):
    SCREENS.append((t, t + 4.5, "question", (n, tema, final)))
    SFX.append((t, "jingle"))
    t = say(t, "AP", question, question)
    for fid, disp, spoken in answers:
        BUZZ.append((t, fid)); SFX.append((t, "buzz")); act(fid, t, t + 0.7, "buzz")
        t += 0.6
        t = say(t, fid, disp, spoken)
    if not final:
        side = -1 if winner == "AC" else 1
        SCORES.append((t, winner)); SFX.append((t, "ding")); SFX.append((t, "applause"))
        POPS.append((t, t + 2.2, f"PONTO PRO {NAMES[winner]}!", 64, YELLOW, 360))
        t1 = say(t, "AP", verdict, verdict, "point", side)
        act(winner, t, t1 + 0.3, "cheer"); act("PR" if winner == "AC" else "AC", t, t1 + 0.3, "sad")
        SCREENS.append((t, t1 + 0.4, "point", winner))
        t = t1 + 0.4
    return t

for i, (tema, q, ans, w, ver) in enumerate(ROUNDS):
    t = play(t, i + 1, tema, q, ans, w, ver)
TIE = t
SCREENS.append((t, t + 6.5, "tie", None)); SFX.append((t, "tie"))
POPS.append((t, t + 2.4, "EMPATE! 2 x 2", 90, YELLOW, 360))
t = say(t + 0.3, "AP", "Dois a dois! Empatou! Vamos para a pergunta de desempate!",
        "Dois a dois! Empatou! Vamos para a pergunta de desempate!")
DES = (t, t + 2.6)
POPS.append((t, t + 2.6, "DESEMPATE!", 130, (255, 70, 60), 330)); SFX.append((t, "boom"))
t += 2.8
t = play(t, 5, *FINAL[:4], None, final=True)
t = say(t, "AP", "E o grande campeão do Show dos Estados é...", "E o grande campeão do Show dos Estados é...")
SFX.append((t, "drumroll")); SCREENS.append((t, t + 2.6, "drum", None))
act("AC", t, t + 2.6, "listen"); act("PR", t, t + 2.6, "listen")
t += 2.6
WIN_T = t
SCORES.append((t, WINNER)); SFX.append((t, "fanfare"))
t = say(t, "AP", f"...o {NAMES[WINNER].capitalize()}!", f"o {NAMES[WINNER].capitalize()}!", "point", -1 if WINNER == "AC" else 1)
SCREENS.append((WIN_T, 999, "winner", WINNER))
POPS.append((WIN_T, 999, f"{NAMES[WINNER]} CAMPEÃO!", 76, YELLOW, 345))
act(WINNER, WIN_T, WIN_T + 3.6, "victory"); act(LOSER, WIN_T, WIN_T + 3.6, "sad")
t = max(t, WIN_T + 3.4)
for who, disp, spoken in ENDING: t = say(t, who, disp, spoken)
act("AC", t, t + 9, "victory"); act("PR", t, t + 9, "cheer")
DURATION = t + 3.2

def state(who, st):
    if who != "AP" and st < WALK[1]:
        M = MASC[who]; p = clamp((st - WALK[0]) / (WALK[1] - WALK[0]))
        return "walk", 0, lerp(-200 if who == "AC" else 1480, M["home"], p), 0
    a, lt, data = "idle", 0, 0
    for t0, t1, ac, dt in ACTS[who]:
        if t0 <= st < t1: a, lt, data = ac, st - t0, dt
    if who != "AP" and a == "idle":
        # quem não fala olha pra quem está falando
        sp = speaker(st)
        if sp and sp != who: a = "listen"
    return a, lt, (MASC[who]["home"] if who != "AP" else 640), data

def speaker(st):
    for t0, who, *_r, dur in LINES:
        if t0 <= st < t0 + dur: return who
    return None

def mouth_at(who, st):
    for t0, w, disp, a, env, dur in LINES:
        if w == who and t0 <= st < t0 + dur: return float(env[min(int((st - t0) * FPS), len(env) - 1)])
    return 0.0

def score(st):
    s = {"AC": 0, "PR": 0}
    for t_, w in SCORES:
        if st >= t_: s[w] += 1
    return s

def screen_mode(st):
    mode = None
    for t0, t1, m, data in SCREENS:
        if t0 <= st < t1 and m: mode = (m, data, st - t0)
    return mode

# ---------------------------------------------------------------- TELÃO E LEGENDA
def draw_screen(frame, st):
    x0, y0, x1, y1 = SCREEN; sw, sh = x1 - x0, y1 - y0
    lay = Image.new("RGBA", (sw * SS, sh * SS), (10, 10, 40, 255)); d = ImageDraw.Draw(lay)
    m, data, lt = screen_mode(st)
    cx, cy = sw / 2, sh / 2
    def T(s, x, y, sz, col=WHITE): d.text(P(x, y), s, font=font(sz), fill=col, anchor="mm", stroke_width=2 * SS, stroke_fill=BLACK)
    if m == "logo":
        for i in range(24):  # raios girando
            a0 = math.radians(i * 15 + st * 30)
            d.polygon([P(cx, cy), P(cx + math.cos(a0) * 400, cy + math.sin(a0) * 400),
                       P(cx + math.cos(a0 + .13) * 400, cy + math.sin(a0 + .13) * 400)],
                      fill=(80, 30, 140) if i % 2 else (50, 20, 100))
        T("SHOW DOS", cx, cy - 34, 40, YELLOW); T("ESTADOS", cx, cy + 22, 62 + 3 * math.sin(st * 6), YELLOW)
    elif m == "question":
        n, tema, final = data
        d.rectangle([0, 0, sw * SS, sh * SS], fill=(120, 0, 0) if final else (20, 40, 120))
        T("DESEMPATE" if final else f"PERGUNTA {n}", cx, 60, 40, YELLOW)
        T(tema, cx, 140, 50 if len(tema) < 12 else 40)
    elif m in ("tie", "drum"):
        on = int(st * 6) % 2
        d.rectangle([0, 0, sw * SS, sh * SS], fill=(150, 0, 0) if on else (60, 0, 0))
        if m == "tie": T("2 x 2", cx, cy - 20, 80, YELLOW); T("EMPATE", cx, cy + 55, 40)
        else: T("...", cx, cy, 100, YELLOW)
    elif m == "winner":
        fl = MASC[data]["maker"](int(sw * SS), int(sh * SS)); lay.paste(fl, (0, 0))
        T("CAMPEÃO!", cx, cy - 40, 66, YELLOW); T(NAMES[data], cx, cy + 40, 50)
    else:  # placar
        sc = score(st)
        for fid, xx in (("AC", 110), ("PR", sw - 110)):
            fl = MASC[fid]["maker"](150 * SS, 100 * SS)
            lay.paste(fl, (int((xx - 75) * SS), int(25 * SS)))
            d.rectangle([P(xx - 75, 25), P(xx + 75, 125)], outline=WHITE, width=2 * SS)
            T(NAMES[fid], xx, 155, 30)
            hl = m == "point" and data == fid and int(st * 6) % 2
            T(str(sc[fid]), xx, 198, 40, (255, 255, 255) if hl else YELLOW)
        T("x", cx, 100, 50, WHITE)
    # linhas de LED
    for yy in range(0, sh * SS, 3 * SS): d.line([(0, yy), (sw * SS, yy)], fill=(0, 0, 0, 60))
    frame.alpha_composite(lay, (x0 * SS, y0 * SS))

def wrap(s, sz, maxw):
    fnt = font(sz); out, cur = [], ""
    for w in s.split():
        nxt = (cur + " " + w).strip()
        if fnt.getlength(nxt) / SS > maxw and cur: out.append(cur); cur = w
        else: cur = nxt
    return out + ([cur] if cur else [])

def draw_caption(frame, st):
    for t0, who, disp, a, env, dur in LINES:
        if t0 - 0.05 <= st < t0 + dur + 0.35:
            al = clamp((st - t0 + 0.05) / 0.12) * (1 - clamp((st - t0 - dur - 0.15) / 0.2))
            info = HOST if who == "AP" else MASC[who]
            nm = HOST["name"] if who == "AP" else info["name"]
            lay = Image.new("RGBA", frame.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
            lines = wrap(disp, 27, 1080)
            words = len(disp.split()); show = math.ceil(words * clamp((st - t0) / (dur * 0.85)))
            y0 = 612 if len(lines) > 1 else 640
            slide = (1 - ease_out((st - t0 + 0.05) / 0.25)) * 60
            d.rectangle([P(30 - slide, y0), P(W - 30, 712)], fill=(10, 5, 25, 225))
            d.rectangle([P(30 - slide, y0), P(36 - slide, 712)], fill=info["tag"])
            tw = font(22).getlength(nm) / SS + 30
            d.polygon([P(46 - slide, y0 - 30), P(46 + tw - slide, y0 - 30), P(46 + tw + 16 - slide, y0), P(46 - slide, y0)], fill=info["tag"])
            d.text(P(60 - slide, y0 - 15), nm, font=font(22), fill=info.get("tag2", WHITE), anchor="lm")
            n = 0
            for i, l in enumerate(lines):
                ws = l.split(); vis = ws[:max(0, show - n)]; n += len(ws)
                if vis: d.text(P(56 - slide, y0 + 26 + i * 36), " ".join(vis), font=font(27), fill=WHITE, anchor="lm")
            if al < 1: lay.putalpha(lay.getchannel("A").point(lambda v: int(v * al)))
            frame.alpha_composite(lay)

# ---------------------------------------------------------------- ABERTURA
def opening(st):
    fr = Image.new("RGBA", (W * SS, H * SS), (20, 0, 50, 255)); d = ImageDraw.Draw(fr)
    cx, cy = 640, 330
    for i in range(36):
        a0 = math.radians(i * 10 + st * 40)
        d.polygon([P(cx, cy), P(cx + math.cos(a0) * 1600, cy + math.sin(a0) * 1600),
                   P(cx + math.cos(a0 + .087) * 1600, cy + math.sin(a0 + .087) * 1600)],
                  fill=(200, 40, 160) if i % 2 else (90, 20, 170))
    for i in range(40):
        rx, ry = (i * 337) % W, (i * 191) % H
        s = 3 + 3 * abs(math.sin(st * 4 + i))
        d.polygon([P(*q) for q in star(rx, ry, s * 2, rot=st * 90)], fill=(255, 255, 200))
    if st < 2.6:
        p = ease_out((st - 0.2) / 0.6)
        text_layer(fr, "SHOW DOS", 640, 250, 70 * p + 1, YELLOW, rot=math.sin(st * 4) * 4)
        text_layer(fr, "ESTADOS", 640, 360, 130 * p + 1, YELLOW, rot=-math.sin(st * 4) * 4)
        text_layer(fr, "o programa onde o estado é o competidor", 640, 470, 30, WHITE, alpha=clamp((st - 1.0) / 0.4))
    else:
        p = ease_out((st - 2.6) / 0.5)
        # tela dividida na diagonal
        left = Image.new("RGBA", fr.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(left)
        off = (1 - p) * 900
        ld.polygon([P(-off, 0), P(760 - off, 0), P(520 - off, H), P(-off, H)], fill=(0, 140, 60, 255))
        ld.polygon([P(W + off, 0), P(760 + off + 14, 0), P(520 + off + 14, H), P(W + off, H)], fill=(25, 60, 160, 255))
        fr.alpha_composite(left)
        for fid, x in (("AC", 300 - off), ("PR", 980 + off)):
            spr = MASC[fid]["spr"]; s = 1.6
            spr = spr.resize((int(spr.width * s), int(spr.height * s)), Image.BILINEAR)
            fr.alpha_composite(spr, (int(x * SS - spr.width / 2), int(300 * SS - spr.height / 2)))
            text_layer(fr, NAMES[fid], x, 520, 76, YELLOW if fid == "AC" else WHITE)
        if st > 3.1:
            q = clamp((st - 3.1) / 0.2)
            text_layer(fr, "VS", 640, 340, lerp(260, 140, ease_out(q)), YELLOW, alpha=q, rot=math.sin(st * 6) * 8)
    if st < 0.3: fr.alpha_composite(Image.new("RGBA", fr.size, (0, 0, 0, int(255 * (1 - st / 0.3)))))
    if 2.55 < st < 2.75 or 3.08 < st < 3.25:
        fr.alpha_composite(Image.new("RGBA", fr.size, (255, 255, 255, 170)))
    return fr

CONFETTI = [(random.uniform(0, W), random.uniform(-500, -10), random.uniform(90, 230), random.uniform(-40, 40),
             random.choice([YELLOW, WHITE, (255, 80, 160), (0, 200, 90), (60, 140, 255), (255, 60, 60)]),
             random.uniform(0, 6.28), random.uniform(5, 11)) for _ in range(180)]

# ---------------------------------------------------------------- RENDER
def render(st):
    if st < OPEN_END:
        fr = opening(st)
    else:
        fr = STUDIO.copy().convert("RGBA")
        des = DES[0] <= st < DES[1] or (TIE <= st < TIE + 0.6)
        spotlights(fr, st, (255, 80, 80) if des else (255, 240, 200), 55 if des else 34)
        draw_screen(fr, st)
        d = ImageDraw.Draw(fr)
        for fid in ("AC", "PR"):
            lit = any(b == fid and 0 <= st - t0 < 0.8 for t0, b in BUZZ)
            draw_buzzer(d, MASC[fid]["buzzer"], lit)
        a, lt, x, data = state("AP", st)
        draw_host(fr, st, a, mouth_at("AP", st), data if a == "point" else (0 if not speaker(st) else (-1 if speaker(st) == "AC" else 1 if speaker(st) == "PR" else 0)))
        sp = speaker(st)
        for fid in ("AC", "PR"):
            a, lt, x, _ = state(fid, st)
            if sp and sp != fid: look = (1, 0) if fid == "AC" else (-1, 0)
            else: look = (MASC[fid]["f"] * 0.3, 0.2)
            draw_mascot(fr, fid, x, st, a, lt, mouth_at(fid, st), look)
        if st >= WIN_T:
            lt = st - WIN_T; cd = ImageDraw.Draw(fr)
            for x, y, vy, vx, col, ph, sz in CONFETTI:
                yy = y + vy * lt
                if lt > 5: yy = (y + vy * lt) % (H + 520) - 500
                xx = x + vx * lt + math.sin(lt * 3 + ph) * 20; w = abs(math.cos(lt * 6 + ph)) * sz + 2
                cd.rectangle([P(xx - w / 2, yy - sz / 2), P(xx + w / 2, yy + sz / 2)], fill=col)
        for t0, t1, s, sz, col, y in POPS:
            if t0 <= st < t1:
                p = st - t0
                al = clamp(p / 0.1) * (1 - clamp((st - t1 + 0.25) / 0.25)) if t1 < 900 else clamp(p / 0.1)
                scl = lerp(2.4, 1.0, ease_out(p / 0.22)) * (1 + (0.06 * math.sin(st * 12) if "DESEMPATE" in s else 0))
                text_layer(fr, s, 640, y, sz * scl, col, alpha=al, rot=math.sin(st * 3) * 3)
        draw_caption(fr, st)
        if OPEN_END <= st < OPEN_END + 0.25:
            fr.alpha_composite(Image.new("RGBA", fr.size, (255, 255, 255, int(255 * (1 - (st - OPEN_END) / 0.25)))))
    if st > DURATION - 0.8:
        fr.alpha_composite(Image.new("RGBA", fr.size, (0, 0, 0, int(255 * clamp((st - DURATION + 0.8) / 0.8)))))
    return fr.convert("RGB").resize((W, H), Image.LANCZOS)

# ---------------------------------------------------------------- ÁUDIO
def make_audio(path):
    n = int((DURATION + 0.5) * SR); music = np.zeros(n); fx = np.zeros(n); voice = np.zeros(n)
    rng = np.random.default_rng(5)
    def put(buf, t, sig, g=1.0):
        i = int(t * SR)
        if 0 <= i < n: s_ = sig[: n - i]; buf[i:i + len(s_)] += s_ * g
    def tt_(L): return np.linspace(0, L, int(L * SR))
    def tone(f, L, dec=4, shape="sine"):
        t = tt_(L); w = np.sin(2 * np.pi * f * t)
        if shape == "square": w = np.sign(w) * 0.5
        if shape == "saw": w = 2 * (t * f % 1) - 1
        return w * np.exp(-t * dec)
    def kick():
        t = tt_(0.3); return np.sin(2 * np.pi * np.cumsum(110 * np.exp(-t * 20) + 45) / SR) * np.exp(-t * 10)
    def snare(L=0.18): return rng.normal(0, 1, int(L * SR)) * np.exp(-tt_(L) * 25) * 0.5
    def applause(L):
        s = np.zeros(int(L * SR))
        for _ in range(int(L * 280)):
            i = rng.integers(0, len(s) - 800); s[i:i + 600] += rng.normal(0, 1, 600) * np.exp(-np.arange(600) / 90) * rng.uniform(.2, 1)
        k = np.arange(len(s)); return s * np.minimum(1, np.minimum(k / (0.2 * SR), (len(s) - k) / (0.8 * SR))) * 0.35
    def chord(fs, L, dec=3, shape="saw"): return sum(tone(f, L, dec, shape) for f in fs) * 0.12
    # trilha: base "de programa de TV" (baixo + bateria + acordes), 124 bpm
    beat = 60 / 124; t = OPEN_END; prog = [(130.8, [261.6, 329.6, 392]), (110, [220, 261.6, 329.6]),
                                            (87.3, [174.6, 220, 261.6]), (98, [196, 246.9, 293.7])]
    b = 0
    while t < DURATION - 1:
        root, ch = prog[(b // 8) % 4]
        put(music, t, kick(), 0.6 if b % 2 == 0 else 0.25)
        if b % 2 == 1: put(music, t, snare(), 0.4)
        put(music, t, tone(root, beat * 0.9, 3, "square"), 0.35)
        put(music, t + beat / 2, tone(root * 2, beat * 0.4, 6, "square"), 0.2)
        if b % 4 == 0: put(music, t, chord(ch, beat * 3, 1.5), 0.6)
        t += beat; b += 1
    # abertura: fanfarra
    for i, f in enumerate([392, 523, 659, 784]): put(fx, 0.25 + i * 0.13, chord([f, f * 1.25], 0.5, 4), 2.2)
    put(fx, 0.8, chord([523, 659, 784, 1047], 1.6, 1.5), 2.4)
    put(fx, 2.6, kick(), 1.4); put(fx, 3.1, kick(), 1.4); put(fx, 3.1, chord([65, 98, 130], 1.4, 2), 3)
    put(fx, OPEN_END, applause(2.5), 1.0)
    for t0, name in SFX:
        if name == "buzz": put(fx, t0, tone(140, 0.45, 2, "square") + tone(143, 0.45, 2, "square"), 0.7)
        elif name == "jingle":
            for i, f in enumerate([523, 659, 784]): put(fx, t0 + i * 0.09, tone(f, 0.3, 6), 0.6)
        elif name == "ding":
            put(fx, t0, tone(1046, 0.8, 4) + tone(1568, 0.8, 5) * .5, 0.7); put(fx, t0 + 0.18, tone(1318, 0.9, 4), 0.7)
        elif name == "applause": put(fx, t0, applause(2.6), 1.0)
        elif name == "tie": put(fx, t0, chord([220, 261, 311], 1.2, 2), 2.0)
        elif name == "boom": put(fx, t0, kick(), 2.0); put(fx, t0, chord([55, 58.3, 82.4], 2.2, 1.5), 3.0)
        elif name == "drumroll":
            for i in range(int(2.5 * 22)): put(fx, t0 + i / 22, snare(0.08), 0.3 + 0.9 * i / 55)
        elif name == "fanfare":
            put(fx, t0, kick(), 1.5)
            for i, f in enumerate([523, 659, 784, 1047]): put(fx, t0 + i * 0.12, chord([f, f * 1.5], 0.5, 4), 2.0)
            put(fx, t0 + 0.5, chord([523, 659, 784, 1047], 2.5, 1), 2.4); put(fx, t0, applause(5), 1.2)
    for t0, w, disp, a, env, dur in LINES: put(voice, t0, a)
    duck = np.ones(n)
    for t0, w, disp, a, env, dur in LINES: duck[max(0, int(t0 * SR) - 4000):int((t0 + dur) * SR) + 4000] = 0.3
    for t0, name in SFX:
        if name == "drumroll": duck[int(t0 * SR):int((t0 + 2.6) * SR)] = 0.0
    duck = np.convolve(duck, np.ones(4410) / 4410, mode="same")
    music = music * duck; music = music / (np.max(np.abs(music)) + 1e-9) * 0.32
    fx = fx / (np.max(np.abs(fx)) + 1e-9) * 0.6
    out = np.tanh((music + fx + voice * 0.9) * 1.1) * 0.95
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())

if __name__ == "__main__":
    if "--timeline" in args:
        for l in LINES: print(round(l[0], 1), l[1], l[2][:50])
        print("TIE", round(TIE, 1), "DES", round(DES[0], 1), "WIN", round(WIN_T, 1), "DUR", round(DURATION, 1)); sys.exit()
    if PREVIEW:
        for t in PREVIEW: render(t).save(f"preview_{t:06.2f}.png")
        print("duração:", round(DURATION, 1)); sys.exit()
    wav = "acre_parana_audio.wav"; mp4 = os.path.join(HERE, "acre_parana.mp4")
    make_audio(wav)
    nfr = int(DURATION * FPS)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", mp4],
                          stdin=subprocess.PIPE)
    for i in range(nfr):
        ff.stdin.write(render(i / FPS).tobytes())
        if i % 300 == 0: print(f"frame {i}/{nfr}", flush=True)
    ff.stdin.close(); ff.wait(); os.remove(wav)
    print("ok:", mp4, f"{DURATION:.1f}s")
