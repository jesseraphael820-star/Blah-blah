"""Small 4K compositing engine on top of Pillow: crisp layer + quarter-res emissive (glow) layer,
camera push/drift, vignette, film grain, cached typography."""
import math, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H = 3840, 2160
GS = 4                      # glow layer downscale
GW, GH = W // GS, H // GS
FPS = 60

FONT_DIR = '/usr/share/fonts/opentype/inter/'
FONTS = {
    'thin': FONT_DIR + 'InterDisplay-Thin.otf',
    'xlight': FONT_DIR + 'InterDisplay-ExtraLight.otf',
    'light': FONT_DIR + 'InterDisplay-Light.otf',
    'reg': FONT_DIR + 'Inter-Regular.otf',
    'med': FONT_DIR + 'Inter-Medium.otf',
    'semi': FONT_DIR + 'Inter-SemiBold.otf',
    'bold': FONT_DIR + 'InterDisplay-Bold.otf',
    'black': FONT_DIR + 'InterDisplay-Black.otf',
    'mono': '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf',
    'monob': '/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf',
}

VIOLET = (139, 92, 246)
VIOLET2 = (168, 128, 255)
BLUE = (56, 189, 248)
EBLUE = (40, 120, 255)
WHITE = (240, 238, 255)
MUTED = (140, 134, 180)
GREEN = (74, 222, 128)
RED = (248, 113, 113)
AMBER = (251, 191, 36)


@functools.lru_cache(maxsize=64)
def font(name, size):
    return ImageFont.truetype(FONTS[name], int(size))


# ---------------- easing ----------------
def clamp(x, a=0.0, b=1.0): return a if x < a else b if x > b else x
def lin(t, t0, t1): return clamp((t - t0) / (t1 - t0)) if t1 != t0 else float(t >= t1)
def ease_out(x): return 1 - (1 - x) ** 3
def ease_in(x): return x ** 3
def ease_io(x): return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
def ease_out_back(x, s=1.4): return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2
def fade(t, t_in, t_out, d_in=0.5, d_out=0.5):
    return ease_io(lin(t, t_in, t_in + d_in)) * (1 - ease_io(lin(t, t_out - d_out, t_out)))
def mix(a, b, k): return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))
def scale(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)


# ---------------- cached text sprites ----------------
@functools.lru_cache(maxsize=512)
def text_sprite(text, fname, size, color=WHITE, tracking=0):
    """RGBA sprite of a string (supports letter tracking)."""
    f = font(fname, size)
    if tracking == 0:
        l, t, r, b = f.getbbox(text)
        im = Image.new('RGBA', (r - l + 4, b - t + 4), color + (0,))
        ImageDraw.Draw(im).text((2 - l, 2 - t), text, font=f, fill=color + (255,), features=['-calt', '-liga'] if 'mono' in fname else None)
        return im
    widths = [f.getlength(ch) for ch in text]
    total = int(sum(widths) + tracking * (len(text) - 1)) + 8
    asc, desc = f.getmetrics()
    im = Image.new('RGBA', (total, asc + desc + 8), color + (0,))
    d = ImageDraw.Draw(im); x = 4
    for ch, w in zip(text, widths):
        d.text((x, 4), ch, font=f, fill=color + (255,)); x += w + tracking
    return im.crop(im.getbbox() or (0, 0, 1, 1))


@functools.lru_cache(maxsize=64)
def gradient_text(text, fname, size, c1=VIOLET2, c2=BLUE, tracking=0):
    m = text_sprite(text, fname, size, (255, 255, 255), tracking).getchannel('A')
    w, h = m.size
    g = np.linspace(0, 1, w)[None, :, None]
    arr = (np.array(c1)[None, None] * (1 - g) + np.array(c2)[None, None] * g).repeat(h, 0).astype(np.uint8)
    im = Image.fromarray(arr, 'RGB').convert('RGBA'); im.putalpha(m)
    return im


def with_alpha(im, a):
    if a >= 0.999: return im
    im = im.copy(); im.putalpha(im.getchannel('A').point(lambda v: int(v * a))); return im


@functools.lru_cache(maxsize=40)
def load_img(path, w, h):
    return Image.open(path).convert('RGB').resize((int(w), int(h)), Image.LANCZOS)


# ---------------- precomputed grade layers ----------------
def _vignette():
    y, x = np.mgrid[0:H // 4, 0:W // 4]
    nx = (x / (W / 4) - .5) * 1.0; ny = (y / (H / 4) - .5) * 1.0 * H / W * 1.7
    v = 1 - 0.55 * np.clip((nx ** 2 + ny ** 2) * 2.0, 0, 1) ** 1.4
    im = Image.fromarray((v * 255).astype(np.uint8), 'L').resize((W, H), Image.BILINEAR)
    return Image.merge('RGB', (im, im, im))

_VIG = None; _GRAIN = None; _BG = None
def grade_layers():
    global _VIG, _GRAIN, _BG
    if _VIG is None:
        _VIG = _vignette()
        rng = np.random.default_rng(3)
        _GRAIN = [Image.fromarray(rng.integers(0, 5, (H // 3, W // 3, 1), dtype=np.uint8).repeat(3, 2), 'RGB')
                  .resize((W, H), Image.BILINEAR) for _ in range(6)]
        y, x = np.mgrid[0:H // 8, 0:W // 8]
        r = np.sqrt(((x - W / 16) / (W / 8)) ** 2 + ((y - H / 16 * 1.15) / (H / 8) * .6) ** 2)
        k = np.clip(1 - r * 1.25, 0, 1) ** 2
        bg = np.stack([5 + 16 * k, 4 + 6 * k, 10 + 30 * k], -1).astype(np.uint8)
        _BG = Image.fromarray(bg, 'RGB').resize((W, H), Image.BICUBIC)
    return _VIG, _GRAIN, _BG


class Frame:
    def __init__(self, t, bg=True):
        vig, grain, bgim = grade_layers()
        self.t = t
        self.img = bgim.copy() if bg else Image.new('RGB', (W, H), (2, 2, 5))
        self.glow = Image.new('RGB', (GW, GH), (0, 0, 0))
        self.d = ImageDraw.Draw(self.img)
        self.g = ImageDraw.Draw(self.glow)
        self.cam_scale = 1.0; self.cam_x = 0.0; self.cam_y = 0.0
        self.glow_gain = 1.0; self.flash = 0.0

    # --- primitives (crisp) ---
    def sprite(self, im, x, y, alpha=1.0, anchor='mm', glow=0.0):
        if alpha <= 0.003: return
        w, h = im.size
        if anchor == 'mm': x -= w / 2; y -= h / 2
        elif anchor == 'lm': y -= h / 2
        elif anchor == 'rm': x -= w; y -= h / 2
        elif anchor == 'mt': x -= w / 2
        x, y = int(x), int(y)
        self.img.paste(im, (x, y), with_alpha(im, alpha).getchannel('A'))
        if glow > 0:
            gw, gh = max(1, w // GS), max(1, h // GS)
            small = im.resize((gw, gh), Image.BILINEAR)
            rgb = Image.new('RGB', (gw, gh)); rgb.paste(small, (0, 0), small)
            rgb = rgb.point(lambda v: int(min(255, v * glow * alpha)))
            self.glow.paste(ImageChops.add(self.glow.crop((x // GS, y // GS, x // GS + gw, y // GS + gh)), rgb),
                            (x // GS, y // GS))

    def text(self, s, x, y, size, fname='reg', color=WHITE, alpha=1.0, anchor='mm', tracking=0, glow=0.0):
        self.sprite(text_sprite(s, fname, int(size), color, tracking), x, y, alpha, anchor, glow)
        return text_sprite(s, fname, int(size), color, tracking).size

    def glass(self, box, alpha=0.82, tint=(9, 7, 22), border=VIOLET, border_a=0.55, radius=28, bw=3, glow=0.25):
        x0, y0, x1, y1 = [int(v) for v in box]
        x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
        if x1 <= x0 or y1 <= y0 or alpha <= 0: return
        reg = self.img.crop((x0, y0, x1, y1))
        mask = Image.new('L', reg.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, x1 - x0 - 1, y1 - y0 - 1), radius, fill=int(255 * alpha))
        reg.paste(Image.new('RGB', reg.size, tint), (0, 0), mask)
        self.img.paste(reg, (x0, y0))
        if border_a > 0:
            self.d.rounded_rectangle((x0, y0, x1, y1), radius, outline=scale(border, border_a * alpha), width=bw)
            if glow > 0:
                self.g.rounded_rectangle((x0 / GS, y0 / GS, x1 / GS, y1 / GS), radius / GS,
                                         outline=scale(border, glow * alpha), width=2)

    def line(self, p0, p1, color, width=3, glow=0.0):
        self.d.line([p0, p1], fill=color, width=width)
        if glow > 0:
            self.g.line([(p0[0] / GS, p0[1] / GS), (p1[0] / GS, p1[1] / GS)], fill=scale(color, glow), width=max(1, width // 2))

    def dot(self, x, y, r, color, glow=0.0, glow_r=None):
        self.d.ellipse((x - r, y - r, x + r, y + r), fill=color)
        if glow > 0:
            gr = (glow_r or r * 3) / GS
            self.g.ellipse((x / GS - gr, y / GS - gr, x / GS + gr, y / GS + gr), fill=scale(color, glow))

    def corner_brackets(self, box, color, a=1.0, L=60, w=4):
        x0, y0, x1, y1 = box; c = scale(color, a)
        for (x, y, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
            self.d.line([(x, y), (x + dx * L, y)], fill=c, width=w)
            self.d.line([(x, y), (x, y + dy * L)], fill=c, width=w)

    # --- finish ---
    def finish(self, frame_idx):
        vig, grain, _ = grade_layers()
        g = self.glow
        if self.flash > 0:
            g = ImageChops.add(g, Image.new('RGB', (GW, GH), scale((150, 120, 255), self.flash)))
        b1 = g.filter(ImageFilter.GaussianBlur(5))
        b2 = g.filter(ImageFilter.GaussianBlur(22))
        bloom = ImageChops.add(b1, b2)
        if self.glow_gain != 1.0: bloom = bloom.point(lambda v: int(min(255, v * self.glow_gain)))
        img = ImageChops.add(self.img, bloom.resize((W, H), Image.BILINEAR))
        if abs(self.cam_scale - 1) > 1e-4 or abs(self.cam_x) > 0.5 or abs(self.cam_y) > 0.5:
            s = self.cam_scale
            cx, cy = W / 2 + self.cam_x, H / 2 + self.cam_y
            img = img.transform((W, H), Image.AFFINE, (1 / s, 0, cx - W / 2 / s, 0, 1 / s, cy - H / 2 / s), Image.BILINEAR)
        img = ImageChops.multiply(img, vig)
        img = ImageChops.add(img, grain[frame_idx % 6], 1.0, -2)
        return img
