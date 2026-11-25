"""Render THE POWER OF OPUS 5.5 — 3840x2160 @ 60 fps.
usage: render.py preview t1 t2 ...      -> PNG stills in out/preview
       render.py chunk  start end name   -> out/chunks/name.mp4 (video only)
"""
import sys, os, json, math, subprocess, time
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFilter
from engine import *
import scenes as S

ROOT = os.path.join(os.path.dirname(__file__), '..')
META = json.load(open(os.path.join(ROOT, 'assets', 'vo', 'meta.json')))

# ---------------- subtitles ----------------
def build_subs():
    subs = []
    for m in META:
        text, t0, d = m['sub'], m['start'], m['dur']
        chunks = [text]
        if len(text) > 72:
            mid = len(text) / 2
            cands = [i for i, ch in enumerate(text) if ch in ',:'] or [i for i, ch in enumerate(text) if ch == ' ']
            cut = min(cands, key=lambda i: abs(i - mid))
            chunks = [text[:cut + 1].strip(), text[cut + 1:].strip()]
        total = sum(len(c) for c in chunks); acc = 0
        for c in chunks:
            a = t0 + d * acc / total; acc += len(c); b = t0 + d * acc / total
            subs.append((a, b + 0.35, c))
    # avoid overlaps
    for i in range(len(subs) - 1):
        if subs[i][1] > subs[i + 1][0]: subs[i] = (subs[i][0], subs[i + 1][0] - 0.02, subs[i][2])
    return subs
SUBS = build_subs()

def write_srt(path):
    def ts(x):
        ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
        return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'
    with open(path, 'w') as f:
        for i, (a, b, c) in enumerate(SUBS, 1): f.write(f'{i}\n{ts(a)} --> {ts(b)}\n{c}\n\n')

_SHADE = None
def draw_subs(img, t):
    global _SHADE
    for a, b, c in SUBS:
        if a - 0.15 <= t <= b + 0.15:
            al = min(1.0, (t - (a - 0.15)) / 0.15, ((b + 0.15) - t) / 0.15)
            spr = text_sprite(c, 'med', 64, (250, 248, 255), 0)
            w, h = spr.size
            x, y = (W - w) // 2, H - 205 - h // 2
            # soft dark backing for legibility
            pad = 34
            box = Image.new('L', (w + 2 * pad, h + 2 * pad), 0)
            ImageDraw.Draw(box).rounded_rectangle((0, 0, w + 2 * pad - 1, h + 2 * pad - 1), 22, fill=int(150 * al))
            img.paste((0, 0, 0), (x - pad, y - pad), box)
            img.paste(spr, (x, y), with_alpha(spr, al).getchannel('A'))
            break
    return img

# ---------------- frame composition ----------------
CUTS = S.CUTS
def scene_index(t):
    for i in range(len(CUTS) - 1):
        if CUTS[i] <= t < CUTS[i + 1]: return i
    return len(CUTS) - 2

def render_frame(f):
    t = f / FPS
    i = scene_index(t)
    F = Frame(t)
    S.SCENES[i](F, t)
    # beat-synced transitions: flash + zoom punch on every cut
    c0 = CUTS[i]
    if i > 0:
        k = t - c0
        F.flash = max(F.flash, 0.9 * math.exp(-k * 9))
        F.cam_scale *= 1 + 0.06 * (1 - ease_out(lin(k, 0, 0.8)))
    c1 = CUTS[i + 1]
    if i < len(CUTS) - 2:
        k = lin(t, c1 - 0.45, c1)
        F.cam_scale *= 1 + 0.10 * ease_in(k)
        F.flash = max(F.flash, 0.6 * ease_in(k))
    img = F.finish(f)
    # global fades
    dim = 1.0
    if t < 0.4: dim = t / 0.4
    if t > 163.6: dim = max(0.0, (165 - t) / 1.4)
    if i < len(CUTS) - 2:
        dim *= 1 - 0.5 * ease_in(lin(t, CUTS[i + 1] - 0.25, CUTS[i + 1]))
    if dim < 0.999: img = img.point(lambda v: int(v * dim))
    if t < 163.8: img = draw_subs(img, t)
    return img

def render_bytes(f): return render_frame(f).tobytes()

def encode_chunk(f0, f1, out, workers=3):
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-tune', 'film',
           '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '5.2', '-color_primaries', 'bt709',
           '-color_trc', 'bt709', '-colorspace', 'bt709', '-g', '120', '-threads', '2', out + '.part.mp4']
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    with Pool(workers) as pool:
        for k, b in enumerate(pool.imap(render_bytes, range(f0, f1), chunksize=2)):
            p.stdin.write(b)
            if k % 120 == 0:
                el = time.time() - t0
                print(f'{out}: {k}/{f1 - f0} frames, {el:.0f}s, {(k + 1) / max(el, 1e-3):.2f} fps', flush=True)
    p.stdin.close(); p.wait()
    os.replace(out + '.part.mp4', out)

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'preview':
        os.makedirs(os.path.join(ROOT, 'out', 'preview'), exist_ok=True)
        for ts in sys.argv[2:]:
            t = float(ts); t0 = time.time()
            img = render_frame(int(round(t * FPS)))
            print(ts, f'{time.time() - t0:.2f}s')
            img.resize((1920, 1080), Image.LANCZOS).save(os.path.join(ROOT, 'out', 'preview', f'p_{t:06.2f}.png'))
    elif mode == 'chunk':
        a, b, name = float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
        os.makedirs(os.path.join(ROOT, 'out', 'chunks'), exist_ok=True)
        encode_chunk(int(round(a * FPS)), int(round(b * FPS)), os.path.join(ROOT, 'out', 'chunks', name + '.mp4'),
                     int(sys.argv[5]) if len(sys.argv) > 5 else 3)
    elif mode == 'srt':
        write_srt(sys.argv[2])
