"""The seven scenes of THE POWER OF OPUS 5.5. Every function draws scene content for global time t."""
import math, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pygments import lex
from pygments.lexers import JavascriptLexer
from pygments.token import Token
from engine import *

ROOT = os.path.join(os.path.dirname(__file__), '..')
A = lambda p: os.path.join(ROOT, 'assets', p)
CUTS = [0, 15, 40, 65, 90, 115, 145, 165]
LOGO_HIT, FINAL_HIT = 9.85, 155.85
BEAT = 60 / 96

rng = np.random.default_rng(11)

# ======================= shared 3D particle field =======================
NP = 2600
P_dir = rng.standard_normal((NP, 3)); P_dir /= np.linalg.norm(P_dir, axis=1, keepdims=True)
P_r = rng.uniform(1.4, 4.2, NP)
P_col = rng.random(NP)
P_size = rng.uniform(0.6, 1.6, NP)
P_phase = rng.random(NP) * 6.28

def rot_y(p, a):
    c, s = math.cos(a), math.sin(a)
    return np.stack([p[:, 0] * c + p[:, 2] * s, p[:, 1], -p[:, 0] * s + p[:, 2] * c], 1)
def rot_x(p, a):
    c, s = math.cos(a), math.sin(a)
    return np.stack([p[:, 0], p[:, 1] * c - p[:, 2] * s, p[:, 1] * s + p[:, 2] * c], 1)

def project(p, dist, fov=1900):
    z = p[:, 2] + dist
    ok = z > 0.15
    sx = W / 2 + p[:, 0] * fov / np.maximum(z, 0.15)
    sy = H / 2 + p[:, 1] * fov / np.maximum(z, 0.15)
    return sx, sy, z, ok

def draw_particles(F, pts, dist, bright=1.0, size=1.0, glow=0.8, col_mix=None, alpha=1.0):
    sx, sy, z, ok = project(pts, dist)
    depth = np.clip(1.6 / z, 0, 2.2)
    for i in np.nonzero(ok & (sx > -50) & (sx < W + 50) & (sy > -50) & (sy < H + 50))[0]:
        k = P_col[i % NP] if col_mix is None else col_mix[i]
        c = mix(VIOLET2, BLUE, k) if k < .85 else WHITE
        b = min(1.0, depth[i] * 0.55) * bright * alpha
        r = max(1.2, 3.2 * depth[i] * P_size[i % NP] * size)
        F.dot(sx[i], sy[i], r, scale(c, b), glow=glow * b, glow_r=r * 2.5)

def light_rays(F, cx, cy, intensity, t, n=14, color=VIOLET):
    if intensity <= 0.01: return
    g = ImageDraw.Draw(F.glow)
    for i in range(n):
        a0 = i * 2 * math.pi / n + t * 0.06 + 0.25 * math.sin(i * 1.7)
        wdt = 0.035 + 0.03 * (i % 3)
        L = 1400 / GS
        pts = [(cx / GS, cy / GS), (cx / GS + L * math.cos(a0 - wdt), cy / GS + L * math.sin(a0 - wdt)),
               (cx / GS + L * math.cos(a0 + wdt), cy / GS + L * math.sin(a0 + wdt))]
        g.polygon(pts, fill=scale(color if i % 2 else EBLUE, intensity * (0.18 + 0.12 * (i % 3))))

def logo(F, t, t0, cy=H / 2, intro=True):
    """CLAUDE / OPUS 5.5 lockup with wipe reveal, bloom and rays."""
    lt = t - t0
    if lt < 0: return
    k = ease_out(lin(lt, 0, 1.1))
    rays = (1.0 * math.exp(-lt * 1.5) + 0.35) * clamp(lt * 8)
    light_rays(F, W / 2, cy, rays, t)
    top = text_sprite('CLAUDE', 'light', 150, WHITE, 70)
    big = gradient_text('OPUS 5.5', 'bold', 400, VIOLET2, BLUE, 18)
    s = 1.0 + 0.10 * (1 - k)
    if s != 1.0:
        big = big.resize((int(big.width * s), int(big.height * s)), Image.BICUBIC)
    # horizontal wipe from centre
    wv = k
    def wipe(im):
        w, h = im.size; m = Image.new('L', (w, h), 0)
        half = int(w / 2 * wv) + 2
        ImageDraw.Draw(m).rectangle((w // 2 - half, 0, w // 2 + half, h), fill=255)
        out = im.copy(); out.putalpha(Image.fromarray(np.minimum(np.array(im.getchannel('A')), np.array(m)), 'L'))
        return out
    F.sprite(wipe(top), W / 2, cy - 260, alpha=ease_out(lin(lt, 0.25, 1.2)), glow=0.5)
    F.sprite(wipe(big), W / 2, cy + 40, alpha=1.0, glow=0.9 + 1.2 * math.exp(-lt * 2))
    # underline sweep
    lw = 1500 * ease_io(lin(lt, 0.5, 1.6))
    if lw > 2:
        F.line((W / 2 - lw / 2, cy + 330), (W / 2 + lw / 2, cy + 330), scale(VIOLET2, 0.9), 3, glow=1.0)
    if intro:
        F.flash = max(F.flash, 1.4 * math.exp(-lt * 5))


# ======================= SCENE 1 — intro =======================
def scene1(F, t):
    # lens streak
    k = lin(t, 0.6, 2.6)
    if 0.6 < t < 3.2:
        a = math.sin(math.pi * k) if k < 1 else 0
        a *= 1 - lin(t, 2.6, 3.2)
        w = 2600 * ease_out(k)
        F.line((W / 2 - w / 2, H / 2), (W / 2 + w / 2, H / 2), scale((200, 190, 255), a), 3, glow=1.4 * a)
        F.g.ellipse((GW / 2 - 60, GH / 2 - 6, GW / 2 + 60, GH / 2 + 6), fill=scale(VIOLET, a))
    # tagline
    tag = 'THE FUTURE OF ARTIFICIAL INTELLIGENCE'
    if 2.4 < t < 9.0:
        a_out = 1 - ease_io(lin(t, 7.4, 8.4))
        track = 22 + 14 * lin(t, 2.4, 8.4)
        f = font('xlight', 92)
        x = W / 2 - (sum(f.getlength(ch) for ch in tag) + track * (len(tag) - 1)) / 2
        for i, ch in enumerate(tag):
            ca = ease_out(lin(t, 2.6 + i * 0.045, 3.4 + i * 0.045)) * a_out
            if ch != ' ' and ca > 0:
                yoff = 30 * (1 - ease_out(lin(t, 2.6 + i * 0.045, 3.6 + i * 0.045)))
                F.text(ch, x, H / 2 + yoff, 92, 'xlight', WHITE, ca, 'lm', glow=0.35)
            x += f.getlength(ch) + track
        sub_a = ease_out(lin(t, 4.6, 5.6)) * a_out
        F.text('A CINEMATIC STUDY  ·  2026', W / 2, H / 2 + 150, 40, 'mono', MUTED, sub_a, tracking=14)
    # particle vortex converging into the reveal
    if t > 5.5:
        conv = ease_in(lin(t, 6.0, LOGO_HIT))
        burst = ease_out(lin(t, LOGO_HIT, LOGO_HIT + 3.5))
        r = P_r * (1 - 0.93 * conv) + (P_r * 1.6) * burst * (t > LOGO_HIT)
        ang = t * 0.25 + conv * 3.0
        pts = P_dir * r[:, None]
        pts = rot_y(pts, ang); pts = rot_x(pts, 0.35)
        appear = ease_out(lin(t, 5.5, 7.5))
        draw_particles(F, pts, 5.2 - 0.8 * burst, bright=appear * (0.8 if t < LOGO_HIT else 0.55),
                       size=0.9, glow=0.9)
    if t >= LOGO_HIT:
        logo(F, t, LOGO_HIT)
        F.cam_scale = 1.0 + 0.05 * ease_io(lin(t, LOGO_HIT, 15))
    else:
        F.cam_scale = 1.0 + 0.03 * lin(t, 2.4, LOGO_HIT)


# ======================= SCENE 2 — intelligence network =======================
NN = 360
N_pos = []
for c in range(6):
    centre = rng.standard_normal(3) * 0.9
    N_pos.append(centre + rng.standard_normal((NN // 6, 3)) * 0.55)
N_pos = np.concatenate(N_pos); N_pos *= 1.25
_d = np.linalg.norm(N_pos[:, None] - N_pos[None], axis=2)
EDGES = set()
for i in range(NN):
    for j in np.argsort(_d[i])[1:4]: EDGES.add((min(i, j), max(i, j)))
EDGES = sorted(EDGES)
# BFS hops from a source for propagation waves
adj = [[] for _ in range(NN)]
for i, j in EDGES: adj[i].append(j); adj[j].append(i)
def bfs(src):
    h = np.full(NN, 99.0); h[src] = 0; q = [src]
    while q:
        n = q.pop(0)
        for m in adj[n]:
            if h[m] > h[n] + 1: h[m] = h[n] + 1; q.append(m)
    return h
HOPS = [bfs(s) for s in (0, 150, 300)]
LABELS = {12: 'contexto', 77: 'dados', 133: 'hipótese', 201: 'evidência', 260: 'restrições', 330: 'solução'}

def node_activation(t):
    act = np.zeros(NN)
    for k, h in enumerate(HOPS):
        period = 5.0; ph = (t - 15 + k * 1.7) % period
        front = ph * 4.2
        act = np.maximum(act, np.exp(-((h - front) ** 2) / 1.6) * (h < 50))
    return act

def scene2(F, t):
    lt = t - 15
    ang = 0.5 + lt * 0.07; tilt = 0.25 + 0.06 * math.sin(lt * 0.2)
    p = rot_x(rot_y(N_pos, ang), tilt)
    dist = 7.2 - 2.2 * ease_io(lin(t, 15, 40))
    sx, sy, z, ok = project(p, dist, 2000)
    sx = sx - 330  # leave room for HUD on the right
    appear = ease_out(lin(t, 15, 17.5))
    act = node_activation(t)
    # edges
    order = sorted(range(len(EDGES)), key=lambda e: -(z[EDGES[e][0]] + z[EDGES[e][1]]))
    for e in order:
        i, j = EDGES[e]
        if not (ok[i] and ok[j]): continue
        dz = clamp(2.2 / ((z[i] + z[j]) / 2))
        a = (0.12 + 0.75 * max(act[i], act[j])) * dz * appear
        c = mix(VIOLET, BLUE, max(act[i], act[j]))
        F.line((sx[i], sy[i]), (sx[j], sy[j]), scale(c, a), 2 if a < .4 else 3, glow=0.6 * a if a > .25 else 0)
    # nodes
    for i in np.argsort(-z):
        if not ok[i]: continue
        dz = clamp(2.4 / z[i], 0, 1.6)
        r = (5 + 9 * act[i]) * dz
        c = mix(VIOLET2, (200, 235, 255), act[i])
        F.dot(sx[i], sy[i], r, scale(c, (0.45 + 0.55 * act[i]) * appear), glow=(0.3 + act[i]) * appear * dz, glow_r=r * 3)
    # floating labels
    for i, lab in LABELS.items():
        if ok[i]:
            a = appear * ease_out(lin(t, 17 + (i % 7) * 0.4, 18.5 + (i % 7) * 0.4)) * clamp(2.6 / z[i])
            F.line((sx[i], sy[i]), (sx[i] + 70, sy[i] - 70), scale(BLUE, 0.6 * a), 2)
            F.text(lab.upper(), sx[i] + 80, sy[i] - 82, 34, 'mono', BLUE, a, 'lm', tracking=6, glow=0.3)
    # HUD right panel — reasoning chain
    hx0, hy0 = 2760, 520
    pa = ease_out(lin(t, 18, 19.5))
    F.glass((hx0, hy0, hx0 + 900, hy0 + 1130), alpha=0.75 * pa, border_a=0.5 * pa)
    F.text('CADEIA DE RACIOCÍNIO', hx0 + 60, hy0 + 80, 34, 'monob', VIOLET2, pa, 'lm', tracking=6)
    steps = [('01', 'LER', 'entender o problema', 29.15), ('02', 'CONECTAR', 'relacionar informações', 29.95),
             ('03', 'RACIOCINAR', 'passo a passo', 30.9), ('04', 'CAMINHO', 'uma solução possível', 32.4)]
    for k, (n, ttl, sub, ts) in enumerate(steps):
        y = hy0 + 220 + k * 230
        on = ease_out(lin(t, ts, ts + 0.5))
        base = 0.35 * pa
        col = mix(MUTED, BLUE if k < 3 else GREEN, on)
        F.d.rounded_rectangle((hx0 + 60, y - 70, hx0 + 840, y + 80), 18, outline=scale(col, max(base, on)), width=3)
        F.text(n, hx0 + 110, y, 44, 'monob', col, max(base, on), 'lm', glow=0.6 * on)
        F.text(ttl, hx0 + 220, y - 22, 54, 'semi', mix(MUTED, WHITE, on), max(base, on), 'lm', glow=0.25 * on)
        F.text(sub, hx0 + 220, y + 38, 34, 'reg', MUTED, max(base, on), 'lm')
        if k < 3:
            F.line((hx0 + 450, y + 82), (hx0 + 450, y + 158), scale(col, max(base, on)), 3)
    # HUD top-left
    hud_a = ease_out(lin(t, 16, 17.5))
    F.corner_brackets((120, 120, W - 120, H - 120), VIOLET, 0.5 * hud_a)
    F.text('SYS.ANÁLISE  //  REDE DE CONCEITOS', 180, 200, 34, 'mono', VIOLET2, hud_a, 'lm', tracking=4)
    links = int(2400 + 46000 * ease_in(lin(t, 15, 40)))
    F.text(f'CONEXÕES AVALIADAS  {links:>6,}'.replace(',', '.'), 180, 260, 34, 'mono', MUTED, hud_a, 'lm', tracking=4)
    F.text('VISUALIZAÇÃO ILUSTRATIVA', W - 180, 200, 30, 'mono', MUTED, hud_a * 0.9, 'rm', tracking=6)
    F.cam_scale = 1.0 + 0.04 * ease_io(lin(t, 15, 40))


# ======================= code helpers =======================
TOKC = {Token.Keyword: (198, 160, 255), Token.Name.Function: (110, 200, 255), Token.Literal.String: (152, 230, 170),
        Token.Comment: (110, 104, 150), Token.Literal.Number: (251, 191, 36), Token.Operator: (190, 186, 220),
        Token.Name.Builtin: (110, 200, 255), Token.Name.Other: (225, 222, 245), Token.Punctuation: (160, 156, 195)}
def tok_color(tt):
    while tt is not None:
        if tt in TOKC: return TOKC[tt]
        tt = tt.parent
    return (225, 222, 245)

def highlight(code):
    lines = [[]]
    for tt, val in lex(code, JavascriptLexer()):
        parts = val.split('\n')
        for k, p in enumerate(parts):
            if k > 0: lines.append([])
            if p: lines[-1].append((p, tok_color(tt)))
    return lines

CODE_TASKS = open(os.path.join(ROOT, 'demo-app', 'tasks.js')).read()
CODE_APP = open(os.path.join(ROOT, 'demo-app', 'app.js')).read()
HL_TASKS = highlight(CODE_TASKS)
HL_APP = highlight(CODE_APP)
FIX_LINE = '  if (board.tasks.length === 0) return 0;'
# buggy version = tasks.js without the guard line
HL_BUGGY = [l for l in HL_TASKS if ''.join(s for s, _ in l) != FIX_LINE]
FIX_IDX = [i for i, l in enumerate(HL_TASKS) if ''.join(s for s, _ in l) == FIX_LINE][0]

def draw_code(F, lines, x, y, n_chars=None, size=36, lh=54, alpha=1.0, max_lines=40, first=0, hl_line=None, hl_col=GREEN, hl_a=0.0, gutter=True):
    f = font('mono', size); cw = f.getlength('M')
    shown = 0
    for li, segs in enumerate(lines[first:first + max_lines]):
        L = li + first
        yy = y + li * lh
        if hl_line is not None and L == hl_line and hl_a > 0:
            F.d.rectangle((x - 20, yy - lh / 2 + 4, x + 1640, yy + lh / 2 - 2), fill=scale((20, 80, 45), hl_a))
            F.text('+', x - 60, yy, size, 'monob', hl_col, hl_a, 'lm')
        if gutter:
            F.text(f'{L + 1:>2}', x - 120, yy, size * 0.85, 'mono', (80, 74, 115), alpha, 'lm')
        cx = x
        for s, c in segs:
            if n_chars is not None:
                if shown >= n_chars: return
                s = s[:max(0, n_chars - shown)]
            shown += len(s)
            if s.strip():
                F.d.text((cx, yy), s, font=f, fill=scale(c, alpha), anchor='lm', features=['-calt', '-liga'])
            cx += cw * len(s)
        shown += 1

def window(F, box, title, a=1.0, accent=VIOLET):
    x0, y0, x1, y1 = box
    F.glass(box, alpha=0.88 * a, tint=(8, 7, 18), border=accent, border_a=0.6 * a, glow=0.35 * a)
    F.d.line((x0 + 2, y0 + 84, x1 - 2, y0 + 84), fill=scale((50, 42, 95), a), width=2)
    for k, c in enumerate(((255, 95, 87), (254, 188, 46), (40, 200, 64))):
        F.dot(x0 + 50 + k * 42, y0 + 42, 11, scale(c, 0.85 * a))
    F.text(title, (x0 + x1) / 2, y0 + 42, 32, 'mono', MUTED, a)

def screenshot(F, name, box, a=1.0):
    x0, y0, x1, y1 = [int(v) for v in box]
    im = load_img(A(name), x1 - x0, y1 - y0)
    if a >= .999: F.img.paste(im, (x0, y0))
    else:
        reg = F.img.crop((x0, y0, x1, y1)); F.img.paste(Image.blend(reg, im, a), (x0, y0))

def terminal_lines(path):
    return [l.rstrip() for l in open(path).read().splitlines()]
T_FAIL = terminal_lines(A('test_fail_spec.txt'))
T_PASS = terminal_lines(A('test_pass.txt'))

def draw_term(F, lines, x, y, n, size=34, lh=50, a=1.0):
    for k, l in enumerate(lines[:n]):
        c = GREEN if l.startswith('✔') or 'pass 6' in l or 'fail 0' in l else RED if (l.startswith('✖') or 'fail 1' in l or 'NaN' in l or 'Assertion' in l) else (200, 196, 230)
        if l.startswith('ℹ') and c == (200, 196, 230): c = MUTED
        F.d.text((x, y + k * lh), l.replace('ℹ', 'i').replace('✔', '✓').replace('✖', '✕'), font=font('mono', size), fill=scale(c, a), anchor='lm', features=['-calt', '-liga'])


# ======================= SCENE 3 — programming =======================
def scene3(F, t):
    lt = t - 40
    # layout: editor left, browser right; terminal slides in during bug fix
    ea = ease_out(lin(t, 40, 41.2))
    ex = -300 * (1 - ea)
    ed = (180 + ex, 300, 2020 + ex, 1880)
    window(F, ed, 'demo-app / tasks.js', ea)
    if t < 48.6:
        n = int(lin(t, 40.6, 48.2) * len(CODE_TASKS) * 1.0)
        draw_code(F, HL_TASKS, ed[0] + 180, ed[1] + 150, n_chars=n, size=34, lh=47, alpha=ea)
        # caret
        if int(t * 2.5) % 2 == 0:
            pass
    else:
        fixed = t > 52.2
        lines = HL_TASKS if fixed else HL_BUGGY
        draw_code(F, lines, ed[0] + 180, ed[1] + 150, size=34, lh=47, alpha=ea,
                  hl_line=FIX_IDX if fixed else None, hl_a=ease_out(lin(t, 52.2, 52.8)))
        if not fixed and t > 50.3:  # pointing at the bug
            k = ease_out(lin(t, 50.3, 50.9))
            yy = ed[1] + 150 + (FIX_IDX) * 47 - 23
            F.d.rectangle((ed[0] + 160, yy - 2, ed[0] + 1800, yy + 2), fill=scale(RED, k))
            F.glass((ed[0] + 860, yy - 150, ed[0] + 1800, yy - 40), alpha=0.92 * k, tint=(40, 8, 16), border=RED, border_a=0.8 * k, radius=16, glow=0.5 * k)
            F.text('bug: quadro vazio → divisão por zero → NaN', ed[0] + 1330, yy - 95, 32, 'mono', RED, k, glow=0.3)
    # browser
    ba = ease_out(lin(t, 41.5, 42.7))
    bx = 300 * (1 - ba)
    br = (2140 + bx, 300, 3660 + bx, 1240)
    window(F, br, 'localhost:8765 — Orbit', ba, BLUE)
    shot_i = 2 + int(lin(t, 43, 47.5) * 6)
    screenshot(F, f'app_{shot_i:02d}.png', (br[0] + 4, br[1] + 88, br[2] - 4, br[1] + 88 + 851), ba)
    # terminal
    ta = ease_out(lin(t, 48.6, 49.6))
    ty = 300 * (1 - ta)
    tm = (2140, 1300 + ty, 3660, 1880 + ty)
    if ta > 0:
        window(F, tm, 'terminal — node --test', ta, RED if t < 53 else GREEN)
        if t < 53:
            F.text('$ node --test', tm[0] + 60, tm[1] + 140, 34, 'mono', WHITE, ta, 'lm')
            n = int(lin(t, 49.2, 50.4) * 14)
            seq = T_FAIL[:6] + ['', T_FAIL[6 + 3]] + [l for l in T_FAIL if 'NaN' in l][:1]
            sel = T_FAIL[:2] + [l for l in T_FAIL if 'pass 5' in l or 'fail 1' in l] + [l for l in T_FAIL if 'NaN' in l][:1]
            draw_term(F, sel, tm[0] + 60, tm[1] + 210, min(n, len(sel)), 32, 52, ta)
        else:
            F.text('$ node --test', tm[0] + 60, tm[1] + 140, 34, 'mono', WHITE, ta, 'lm')
            sel = [l for l in T_PASS if l.startswith('✔')][:3] + ['…'] + [l for l in T_PASS if 'pass 6' in l or 'fail 0' in l]
            n = int(lin(t, 53.3, 54.6) * 7)
            draw_term(F, sel, tm[0] + 60, tm[1] + 210, n, 32, 52, ta)
    # REAL badge
    if t > 56.8:
        k = ease_out_back(lin(t, 56.8, 57.6))
        a = ease_out(lin(t, 56.8, 57.4))
        F.glass((W - 1000, 140, W - 180, 240), alpha=0.9 * a, border=GREEN, border_a=0.9 * a, radius=50, glow=0.8 * a)
        F.text('●  EXECUÇÃO REAL', W - 590, 190, 40 * max(0.6, k), 'monob', GREEN, a, tracking=6, glow=0.5)
    # title chip
    F.text('PROGRAMAÇÃO', 180, 190, 40, 'monob', VIOLET2, ea, 'lm', tracking=14, glow=0.4)
    F.text('escrever · revisar · depurar · testar', 640, 190, 34, 'mono', MUTED, ea, 'lm')
    F.cam_scale = 1.0 + 0.035 * ease_io(lin(t, 40, 65))
    F.cam_y = 0


# ======================= SCENE 4 — creativity & reasoning =======================
CHIPS = 400
CH_xy = np.stack([rng.uniform(250, W - 250, CHIPS), rng.uniform(420, H - 360, CHIPS)], 1)
CH_cat = rng.integers(0, 4, CHIPS)
CH_vel = rng.standard_normal((CHIPS, 2)) * 30
CAT = [('ESTRATÉGIA', VIOLET2), ('DOCUMENTOS', BLUE), ('PROBLEMAS', (236, 120, 255)), ('IDEIAS', (150, 170, 255))]

def card(F, box, title, a, accent):
    F.glass(box, alpha=0.86 * a, border=accent, border_a=0.7 * a, glow=0.5 * a)
    F.text(title, box[0] + 60, box[1] + 80, 40, 'monob', accent, a, 'lm', tracking=8, glow=0.3)

def scene4(F, t):
    # kinetic title
    if t < 70.2:
        a = fade(t, 65.2, 70.2, 0.6, 0.6)
        s = 1 + 0.06 * lin(t, 65, 70)
        F.text('ALÉM DO CÓDIGO', W / 2, H / 2 - 40, 230 * s, 'bold', WHITE, a, tracking=30, glow=0.6)
        F.text('planejamento · análise · solução · organização', W / 2, H / 2 + 170, 50, 'light', MUTED, a, tracking=8)
    # three cards
    if 69.6 < t < 79.0:
        out = 1 - ease_io(lin(t, 78.2, 79.0))
        cw, chh, gap = 1080, 1240, 90
        x0 = (W - 3 * cw - 2 * gap) / 2; y0 = 440
        for k, (ttl, acc, ts) in enumerate((('ESTRATÉGIA', VIOLET2, 69.8), ('DOCUMENTO', BLUE, 71.5), ('PROBLEMA', (236, 120, 255), 73.6))):
            a = ease_out(lin(t, ts, ts + 0.7)) * out
            dy = 80 * (1 - ease_out(lin(t, ts, ts + 0.9)))
            bx = (x0 + k * (cw + gap), y0 + dy, x0 + k * (cw + gap) + cw, y0 + dy + chh)
            if a <= 0: continue
            card(F, bx, ttl, a, acc)
            lt = t - ts
            if k == 0:  # roadmap
                for q in range(4):
                    qa = ease_out(lin(lt, 0.5 + q * 0.4, 1.0 + q * 0.4)) * a
                    yy = bx[1] + 280 + q * 230
                    F.dot(bx[0] + 120, yy, 18, scale(acc, qa), glow=qa)
                    if q < 3: F.line((bx[0] + 120, yy + 24), (bx[0] + 120, yy + 206), scale(acc, 0.5 * qa), 3)
                    F.text(f'FASE {q + 1}', bx[0] + 180, yy - 30, 32, 'monob', acc, qa, 'lm', tracking=4)
                    wbar = [620, 480, 700, 540][q] * ease_out(lin(lt, 0.8 + q * 0.4, 1.8 + q * 0.4))
                    F.d.rounded_rectangle((bx[0] + 180, yy + 10, bx[0] + 180 + max(8, wbar), yy + 40), 15, fill=scale(acc, 0.35 * qa))
            elif k == 1:  # document scan
                for li in range(17):
                    yy = bx[1] + 200 + li * 58
                    wl = [820, 760, 900, 640, 880, 700][li % 6]
                    hit = li in (3, 4, 9, 13)
                    scanned = lt * 6.5 > li
                    c = (70, 66, 110)
                    F.d.rounded_rectangle((bx[0] + 80, yy, bx[0] + 80 + wl, yy + 22), 11, fill=scale(c, a))
                    if hit and scanned:
                        ha = ease_out(clamp(lt * 6.5 - li)) * a
                        F.d.rounded_rectangle((bx[0] + 70, yy - 8, bx[0] + 90 + wl, yy + 30), 15, outline=scale(acc, ha), width=3)
                        F.g.rectangle(((bx[0] + 80) / GS, yy / GS, (bx[0] + 80 + wl) / GS, (yy + 22) / GS), fill=scale(acc, 0.35 * ha))
                sy = bx[1] + 190 + min(lt * 6.5, 17) * 58
                if lt * 6.5 < 17.5:
                    F.line((bx[0] + 40, sy), (bx[2] - 40, sy), scale(acc, a), 3, glow=1.2 * a)
            else:  # problem tree
                root = ((bx[0] + bx[2]) / 2, bx[1] + 240)
                kids = [(bx[0] + 220 + i * 320, bx[1] + 560) for i in range(3)]
                leaves = [(kids[i][0] + dx, bx[1] + 880) for i in range(3) for dx in (-90, 90)]
                ga = ease_out(lin(lt, 0.3, 1.0)) * a
                F.dot(*root, 26, scale(acc, ga), glow=ga)
                for i, kp in enumerate(kids):
                    ka = ease_out(lin(lt, 0.6 + i * 0.2, 1.2 + i * 0.2)) * a
                    F.line(root, kp, scale(acc, 0.6 * ka), 3); F.dot(*kp, 20, scale(acc, ka), glow=0.6 * ka)
                for i, lp in enumerate(leaves):
                    la = ease_out(lin(lt, 1.2 + i * 0.12, 1.7 + i * 0.12)) * a
                    good = i == 3
                    col = GREEN if (good and lt > 2.8) else (110, 100, 150)
                    F.line(kids[i // 2], lp, scale(col, 0.6 * la), 3); F.dot(*lp, 16, scale(col, la), glow=(1.0 if good and lt > 2.8 else 0) * la)
                if lt > 2.8:
                    sa = ease_out(lin(lt, 2.8, 3.4)) * a
                    F.text('✓ caminho escolhido', leaves[3][0], leaves[3][1] + 110, 38, 'semi', GREEN, sa, glow=0.4)
    # chaos -> order
    if t > 78.0:
        a = ease_out(lin(t, 78.0, 79.0))
        k = ease_io(lin(t, 81.0, 86.0))
        cols_x = [W / 2 + (c - 1.5) * 820 for c in range(4)]
        counters = [0, 0, 0, 0]; order_idx = np.zeros(CHIPS, int)
        for i in range(CHIPS):
            c = CH_cat[i]; order_idx[i] = counters[c]; counters[c] += 1
        for i in range(CHIPS):
            c = CH_cat[i]
            cx = CH_xy[i, 0] + CH_vel[i, 0] * math.sin((t - 78) * 0.6 + i)
            cy = CH_xy[i, 1] + CH_vel[i, 1] * math.cos((t - 78) * 0.5 + i)
            col_i = order_idx[i] % 6; row_i = order_idx[i] // 6
            tx = cols_x[c] - 325 + col_i * 130; ty = 640 + row_i * 50
            kk = ease_io(clamp((k * 1.4) - (i % 37) / 37 * 0.4))
            x = cx + (tx - cx) * kk; y = cy + (ty - cy) * kk
            colr = CAT[c][1]
            ww, hh = 120 - 10 * kk, 36
            F.d.rounded_rectangle((x - ww / 2, y - hh / 2, x + ww / 2, y + hh / 2), 10, fill=scale(colr, (0.35 + 0.35 * kk) * a))
            if i % 6 == 0: F.g.rectangle(((x - ww / 2) / GS, (y - hh / 2) / GS, (x + ww / 2) / GS, (y + hh / 2) / GS), fill=scale(colr, 0.25 * a))
        for c in range(4):
            ha = ease_out(lin(t, 84.5 + c * 0.2, 85.5 + c * 0.2))
            F.text(CAT[c][0], cols_x[c], 470, 46, 'monob', CAT[c][1], ha, tracking=8, glow=0.5)
            F.text(f'{counters[c]} itens', cols_x[c], 530, 32, 'mono', MUTED, ha)
        oa = ease_out(lin(t, 86, 87))
        F.text('DO CAOS À CLAREZA', W / 2, 300, 72, 'semi', WHITE, oa * a, tracking=20, glow=0.4)
    F.text('CONCEITO ILUSTRATIVO', W - 180, 200, 30, 'mono', MUTED, 0.9 * ease_out(lin(t, 66, 67)), 'rm', tracking=6)
    F.text('CRIATIVIDADE & RACIOCÍNIO', 180, 200, 40, 'monob', VIOLET2, ease_out(lin(t, 66, 67)), 'lm', tracking=14, glow=0.4)
    F.cam_scale = 1.0 + 0.03 * ease_io(lin(t, 65, 90))


# ======================= SCENE 5 — agents & automation =======================
PIPE = [('PLANEJAR', 'dividir em etapas'), ('ORGANIZAR', 'ordem e dependências'), ('EXECUTAR', 'rodar ferramentas'), ('VERIFICAR', 'conferir resultados')]
PIPE_T = [97.85, 98.75, 99.75, 100.75]
JOBS = [('python3 src/narration.py', '22 falas pt-BR (Kokoro TTS local)'),
        ('node src/capture_demo.js', '16 capturas do app real (Chromium)'),
        ('node --test', '6/6 testes aprovados'),
        ('python3 src/audio.py', 'trilha 96 BPM + mixagem −14 LUFS'),
        ('python3 src/render.py', '9.900 quadros 3840×2160 @ 60 fps'),
        ('ffmpeg … -c:v libx264', 'MP4 final + legendas')]
TOOLS = [('Python 3 + NumPy + Pillow', True), ('FFmpeg (libx264)', True), ('Chromium + Playwright', True),
         ('Kokoro TTS (local, pt-BR)', True), ('Blender', False), ('After Effects', False)]

def scene5(F, t):
    F.text('AUTOMAÇÃO & AGENTES', 180, 200, 40, 'monob', VIOLET2, ease_out(lin(t, 90.5, 91.5)), 'lm', tracking=14, glow=0.4)
    F.text('FLUXO REAL USADO NESTA PRODUÇÃO', W - 180, 200, 30, 'mono', MUTED, ease_out(lin(t, 90.5, 91.5)), 'rm', tracking=6)
    # pipeline nodes
    y = 560
    xs = [W / 2 + (i - 1.5) * 860 for i in range(4)]
    base_a = ease_out(lin(t, 91, 92.5))
    for i in range(3):
        on = ease_io(lin(t, PIPE_T[i] + 0.2, PIPE_T[i + 1]))
        F.line((xs[i] + 240, y), (xs[i + 1] - 240, y), scale((60, 52, 110), base_a), 4)
        if on > 0:
            xe = xs[i] + 240 + (xs[i + 1] - xs[i] - 480) * on
            F.line((xs[i] + 240, y), (xe, y), scale(BLUE, base_a), 5, glow=1.0)
    # travelling pulse after all lit
    for i, (ttl, sub) in enumerate(PIPE):
        on = ease_out(lin(t, PIPE_T[i], PIPE_T[i] + 0.5))
        col = mix((90, 84, 140), GREEN if i == 3 else BLUE, on)
        a = base_a
        F.glass((xs[i] - 240, y - 150, xs[i] + 240, y + 150), alpha=0.85 * a, border=col, border_a=(0.4 + 0.6 * on) * a, glow=0.8 * on)
        F.text(f'0{i + 1}', xs[i], y - 75, 36, 'monob', col, a)
        F.text(ttl, xs[i], y + 5, 56, 'semi', mix(MUTED, WHITE, on), a, glow=0.3 * on)
        F.text(sub, xs[i], y + 80, 32, 'reg', MUTED, a)
    # job log (left) — real commands of this production
    la = ease_out(lin(t, 92, 93.2))
    lg = (180, 860, 2280, 1880)
    window(F, lg, 'log de execução', la, BLUE)
    for k, (cmd, res) in enumerate(JOBS):
        ts = 93.0 + k * 1.6
        ja = ease_out(lin(t, ts, ts + 0.4)) * la
        yy = lg[1] + 170 + k * 130
        F.text('$ ' + cmd, lg[0] + 70, yy, 36, 'mono', WHITE, ja, 'lm')
        done = lin(t, ts + 0.9, ts + 1.3)
        if done > 0:
            F.text('✓ ' + res, lg[0] + 110, yy + 52, 32, 'mono', GREEN, ja * ease_out(done), 'lm')
        elif ja > 0:
            sp = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[int(t * 12) % 10]
            F.text('… executando', lg[0] + 110, yy + 52, 32, 'mono', AMBER, ja, 'lm')
    # tool availability panel (right)
    ta = ease_out(lin(t, 104.6, 105.6))
    tp = (2380, 860, 3660, 1880)
    if ta > 0:
        window(F, tp, 'ferramentas neste ambiente', ta, VIOLET)
        for k, (name, ok) in enumerate(TOOLS):
            ts = 105.4 + k * 0.45
            a = ease_out(lin(t, ts, ts + 0.4)) * ta
            yy = tp[1] + 190 + k * 125
            F.text('✓' if ok else '✕', tp[0] + 90, yy, 46, 'monob', GREEN if ok else RED, a, glow=0.5)
            F.text(name, tp[0] + 160, yy, 40, 'reg', WHITE if ok else MUTED, a, 'lm')
            F.text('disponível' if ok else 'não disponível', tp[2] - 70, yy, 30, 'mono', GREEN if ok else RED, a, 'rm')
        na = ease_out(lin(t, 108.6, 109.4)) * ta
        F.text('sem fingir: o que não existe aqui não foi usado', (tp[0] + tp[2]) / 2, tp[3] - 70, 32, 'mono', AMBER, na)
    F.cam_scale = 1.0 + 0.03 * ease_io(lin(t, 90, 115))


# ======================= SCENE 6 — real build from zero =======================
STEPS6 = [('IDEIA', 120.0), ('PLANO', 123.6), ('CÓDIGO', 127.2), ('VISUAL', 131.0), ('TESTES', 135.4), ('RESULTADO', 140.2)]

def scene6(F, t):
    # stepper on top
    sa = ease_out(lin(t, 118.6, 119.6))
    if sa <= 0.01: sa = 0
    xs = [W / 2 + (i - 2.5) * 560 for i in range(6)]
    cur = max([i for i, (_, ts) in enumerate(STEPS6) if t >= ts] or [-1])
    for i, (lab, ts) in enumerate(STEPS6):
        on = ease_out(lin(t, ts, ts + 0.4))
        col = mix((80, 74, 120), GREEN if i < cur else BLUE, on)
        if sa == 0: break
        if i < 5:
            F.line((xs[i] + 40, 250), (xs[i + 1] - 40, 250), scale(mix((60, 52, 100), GREEN, ease_out(lin(t, STEPS6[i + 1][1], STEPS6[i + 1][1] + 0.4))), sa), 4)
        F.d.ellipse((xs[i] - 30, 220, xs[i] + 30, 280), outline=scale(col, sa), width=4, fill=scale(col, 0.25 * on * sa))
        if i == cur: F.g.ellipse(((xs[i] - 40) / GS, 210 / GS, (xs[i] + 40) / GS, 290 / GS), fill=scale(BLUE, 0.6))
        F.text(f'{i + 1}', xs[i], 250, 30, 'monob', col, sa)
        F.text(lab, xs[i], 330, 32, 'mono', mix(MUTED, WHITE, on), sa, tracking=6)
    # intro title
    if t < 120.0:
        a = fade(t, 115.3, 120.0, 0.6, 0.5)
        F.text('DEMONSTRAÇÃO REAL', W / 2, H / 2 - 30, 200, 'bold', WHITE, a, tracking=24, glow=0.6)
        F.text('do zero ao app funcionando', W / 2, H / 2 + 150, 56, 'light', MUTED, a, tracking=8)
    box = (420, 460, W - 420, H - 300)
    # 1 idea
    if 120 <= t < 123.8:
        a = fade(t, 120, 123.8, 0.4, 0.3)
        F.glass(box, alpha=0.85 * a, border=VIOLET2, border_a=0.7 * a, glow=0.5 * a)
        F.text('A IDEIA', box[0] + 100, box[1] + 130, 40, 'monob', VIOLET2, a, 'lm', tracking=10)
        idea = '“Um planejador de tarefas com etapas e um anel de progresso.”'
        n = int(lin(t, 120.3, 122.4) * len(idea))
        F.text(idea[:n] if n else ' ', box[0] + 100, (box[1] + box[3]) / 2, 84, 'light', WHITE, a, 'lm', glow=0.25)
    # 2 plan
    if 123.6 <= t < 127.4:
        a = fade(t, 123.6, 127.4, 0.3, 0.3)
        F.glass(box, alpha=0.85 * a, border=BLUE, border_a=0.7 * a, glow=0.5 * a)
        F.text('O PLANO', box[0] + 100, box[1] + 130, 40, 'monob', BLUE, a, 'lm', tracking=10)
        plan = ['tasks.js — lógica pura e testável', 'tasks.test.js — 6 testes com node:test', 'index.html + style.css — interface',
                'app.js — interação no navegador', 'capture_demo.js — validação no Chromium']
        for k, p in enumerate(plan):
            pa = ease_out(lin(t, 123.8 + k * 0.35, 124.2 + k * 0.35)) * a
            yy = box[1] + 300 + k * 160
            F.d.rounded_rectangle((box[0] + 100, yy - 30, box[0] + 160, yy + 30), 12, outline=scale(BLUE, pa), width=4)
            if t > 125.6 + k * 0.2:
                F.text('✓', box[0] + 130, yy, 44, 'monob', GREEN, pa)
            F.text(p, box[0] + 220, yy, 52, 'reg', WHITE, pa, 'lm')
    # 3 code
    if 127.2 <= t < 131.2:
        a = fade(t, 127.2, 131.2, 0.3, 0.3)
        window(F, box, 'demo-app / app.js', a)
        total = sum(len(''.join(s for s, _ in l)) + 1 for l in HL_APP)
        n = int(lin(t, 127.3, 130.4) * total)
        # scroll so the cursor stays visible
        shown = 0; cur_line = 0
        for li, l in enumerate(HL_APP):
            shown += len(''.join(s for s, _ in l)) + 1
            if shown >= n: cur_line = li; break
        first = max(0, cur_line - 20)
        skip = sum(len(''.join(s for s, _ in l)) + 1 for l in HL_APP[:first])
        draw_code(F, HL_APP, box[0] + 200, box[1] + 160, n_chars=n - skip, size=36, lh=54, alpha=a, first=first, max_lines=24)
    # 4 visual: wireframe -> styled -> tasks being added
    if 131.0 <= t < 135.6:
        a = fade(t, 131.0, 135.6, 0.3, 0.3)
        bh0 = box[3] - box[1]; bw0 = (bh0 - 92) * 16 / 9 + 8
        vb = (W / 2 - bw0 / 2, box[1], W / 2 + bw0 / 2, box[3])
        window(F, vb, 'localhost:8765 — Orbit', a, BLUE)
        inner = (vb[0] + 4, vb[1] + 88, vb[2] - 4, vb[3] - 4)
        wipe = ease_io(lin(t, 131.8, 132.8))
        screenshot(F, 'app_00_wire.png', inner, a)
        if wipe > 0:
            inner = tuple(int(v) for v in inner)
            im = load_img(A('app_01_empty.png' if t < 133.0 else f'app_{min(8, 2 + int((t - 133.0) * 2.6)):02d}.png'),
                          inner[2] - inner[0], inner[3] - inner[1])
            cw = int((inner[2] - inner[0]) * wipe)
            if cw > 0:
                reg = F.img.crop((inner[0], inner[1], inner[0] + cw, inner[3]))
                F.img.paste(Image.blend(reg, im.crop((0, 0, cw, im.height)), a), (inner[0], inner[1]))
            if wipe < 1:
                F.line((inner[0] + cw, inner[1]), (inner[0] + cw, inner[3]), scale(BLUE, a), 4, glow=1.2)
        F.text('estrutura → estilo', vb[2] - 60, vb[1] + 42, 30, 'mono', MUTED, a, 'rm')
    # 5 tests
    if 135.4 <= t < 140.4:
        a = fade(t, 135.4, 140.4, 0.3, 0.3)
        window(F, box, 'terminal — npm test', a, GREEN)
        F.text('$ node --test --test-reporter=spec', box[0] + 100, box[1] + 170, 42, 'mono', WHITE, a, 'lm')
        sel = [l for l in T_PASS if l.startswith('✔')] + [''] + [l for l in T_PASS if l.startswith('ℹ') and any(k in l for k in ('tests', 'pass', 'fail'))]
        n = int(lin(t, 135.6, 137.8) * len(sel)) + 0
        draw_term(F, sel, box[0] + 100, box[1] + 270, n, 40, 72, a)
    # 6 result
    if t >= 140.2:
        a = ease_out(lin(t, 140.2, 140.8)) * (1 - ease_io(lin(t, 144.6, 145)))
        z = 1 + 0.04 * ease_io(lin(t, 140.2, 145))
        cx, cy = W / 2, (box[1] + box[3]) / 2 + 20
        bh0 = box[3] - box[1]; bw, bh = ((bh0 - 92) * 16 / 9 + 8) * z, bh0 * z
        bb = (cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)
        window(F, bb, 'localhost:8765 — Orbit  ·  resultado final', a, GREEN)
        idx = min(15, 9 + int((t - 140.4) * 2.7))
        screenshot(F, f'app_{idx:02d}.png', (bb[0] + 4, bb[1] + 88, bb[2] - 4, bb[3] - 4), a)
        if idx == 15:
            F.g.ellipse(((bb[2] - 330) / GS, (bb[1] + 100) / GS, (bb[2] - 40) / GS, (bb[1] + 390) / GS), fill=scale(BLUE, 0.6 * a))
    F.cam_scale = 1.0 + 0.02 * ease_io(lin(t, 115, 145))


# ======================= SCENE 7 — closing =======================
def scene7(F, t):
    words = [('INTELLIGENCE.', 148.6), ('CREATIVITY.', 149.65), ('POSSIBILITY.', 150.75)]
    out = 1 - ease_io(lin(t, 154.2, 155.4))
    ys = [H / 2 - 260, H / 2, H / 2 + 260]
    for (w, ts), y in zip(words, ys):
        a = ease_out(lin(t, ts, ts + 0.5)) * out
        if a <= 0: continue
        sp = 40 + 30 * (1 - ease_out(lin(t, ts, ts + 1.2)))
        F.text(w, W / 2, y, 170, 'xlight', WHITE, a, tracking=int(sp), glow=0.5 + 1.2 * math.exp(-(t - ts) * 3))
    # ambient particles drifting, converging to the logo hit
    conv = ease_in(lin(t, 152.0, FINAL_HIT))
    burst = ease_out(lin(t, FINAL_HIT, FINAL_HIT + 5))
    r = P_r * (1.3 - 1.2 * conv) + P_r * 1.4 * burst * (t > FINAL_HIT)
    pts = P_dir * r[:, None]
    pts = rot_x(rot_y(pts, t * 0.12 + conv * 2.4), 0.3)
    pa = ease_out(lin(t, 145.3, 147.5)) * (1 - ease_io(lin(t, 162.5, 164.6)))
    draw_particles(F, pts, 5.0, bright=0.6 * pa, size=0.9, glow=0.8)
    if t >= FINAL_HIT:
        la = 1 - ease_io(lin(t, 162.6, 164.6))
        F2 = F
        logo(F, t, FINAL_HIT)
        if la < 1:
            pass
        ca = ease_out(lin(t, 159.0, 160.2)) * la
        F.text('Vídeo produzido com código: Python · NumPy · Pillow · FFmpeg · Kokoro TTS · Playwright', W / 2, H - 420, 34, 'mono', MUTED, ca, tracking=2)
        F.text('Demonstrações de código, testes e app são reais; visualizações abstratas são ilustrativas. Produção independente, não oficial da Anthropic.',
               W / 2, H - 360, 30, 'reg', (110, 104, 150), ca)
        F.glow_gain = la
    F.cam_scale = 1.0 + 0.04 * ease_io(lin(t, 145, 165))


SCENES = [scene1, scene2, scene3, scene4, scene5, scene6, scene7]
