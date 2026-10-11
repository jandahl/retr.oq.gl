#!/usr/bin/env python3
"""Reskin the three Wolf3D boss sprite sheets (Fake Hitler, Mecha-Hitler, Hitler)
into Fake Trump, Mecha-Trump and Trump with dual chainguns.

Every frame is derived from the pristine original in art-original/sprites, so all
animation poses, hitboxes and frame timings stay 100% authentic:
  * face   -> orange tan, moustache removed
  * hair   -> swept golden-blonde pompadour
  * teal mecha armour / brown uniform -> navy blue
  * red necktie on the walking and shooting frames
  * Hitler's death gore -> green (matches the guards' green blood)

Run:  uv run --no-project --with pillow python3 tools/generate_wolf3d_bosses.py
Sheets: 325_337 (Fake, 13 frames), 338_363 (Mecha + Hitler, 26 frames).
"""
import os
from collections import deque
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'vendor', 'wolf3d', 'art-original', 'sprites')
DST = os.path.join(BASE, 'vendor', 'wolf3d', 'art', 'sprites')

# (sheet, frames, tie frame indices, tie length in 64px rows, green-gore frame indices)
SHEETS = {
    '325_337': dict(n=13, tie=range(0, 5), tie_len=8, gore=()),
    '338_363': dict(n=26, tie=range(11, 18), tie_len=9, gore=range(18, 26)),
}


def lum(p):
    return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]


def is_skin_core(p):
    r, g, b, a = p
    return a > 0 and r >= 208 and g >= 120 and 70 <= b <= 150 and r > g > b and r - b >= 90


def is_warm(p):
    r, g, b, a = p
    return a > 0 and r >= 150 and r > g > b and r - b >= 50


def orange(p):
    return (min(255, p[0]), int(p[1] * 0.80), int(p[2] * 0.55), 255)


def gold(p):
    t = min(1.0, lum(p) / 110.0)
    return (int(150 + 100 * t), int(100 + 95 * t), int(20 + 50 * t), 255)


def navy(p):
    l = lum(p)
    return (int(l * 0.12), int(l * 0.20), min(255, int(l * 0.85) + 25), 255)


def is_teal(p):
    return p[3] > 0 and p[2] > p[0] + 15 and p[1] > p[0] + 15


def is_brown(p):
    r, g, b, a = p
    return (a > 0 and r <= 225 and r > b + 12 and r >= g >= b and g > 18
            and g < 0.85 * r and b >= 0.18 * r)


def is_blood(p):
    return p[3] > 0 and p[0] >= 60 and p[1] <= 50 and p[2] <= 50 and p[0] > 2 * p[1]


def green(p):
    return (int(p[1] + p[0] * 0.15), int(min(255, p[0] * 1.15)), int(p[2] + p[0] * 0.1), 255)


def find_face(px, w, h):
    """Largest warm-skin blob in the upper 65% of the frame -> bbox, or None."""
    seen = [[False] * w for _ in range(h)]
    best = None
    for y in range(int(h * 0.65)):
        for x in range(w):
            if seen[y][x] or not is_skin_core(px[x, y]):
                continue
            q, pts = deque([(x, y)]), []
            seen[y][x] = True
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < int(h * 0.65) and not seen[ny][nx] and is_skin_core(px[nx, ny]):
                        seen[ny][nx] = True
                        q.append((nx, ny))
            if best is None or len(pts) > len(best):
                best = pts
    k = h / 64.0
    if not best or len(best) < 8 * k * k:
        return None
    xs = [p[0] for p in best]
    ys = [p[1] for p in best]
    return min(xs), max(xs), min(ys), max(ys)


def reskin_frame(fr, idx, cfg):
    w, h = fr.size
    k = h // 64
    px = fr.load()
    face = find_face(px, w, h)

    if face:
        face = (face[0], face[1], max(0, face[2] - int((face[3] - face[2] + 1) * 0.35)), face[3])

    def in_face(x, y):
        return face and face[0] - 2 * k <= x <= face[1] + 2 * k and face[2] - 8 * k <= y <= face[3]

    # 1. uniforms / armour (everything outside the face box)
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0 or in_face(x, y):
                continue
            if is_blood(p) and idx in cfg['gore']:
                px[x, y] = green(p)
            elif is_teal(p) or is_brown(p):
                px[x, y] = navy(p)

    if face:
        x0, x1, y0, y1 = face
        fw, fh = x1 - x0 + 1, y1 - y0 + 1
        # 2. skin -> orange, moustache out
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if is_warm(px[x, y]):
                    px[x, y] = orange(px[x, y])
        skin = orange((232, 136, 88, 255))
        for y in range(y0 + int(fh * 0.50), y0 + int(fh * 0.66)):
            for x in range(x0 + int(fw * 0.22), x1 - int(fw * 0.22) + 1):
                p = px[x, y]
                if p[3] and lum(p) < 100 and not is_blood(p):
                    px[x, y] = skin
        # 3. hair: recolour the dark grey cap, then grow a swept pompadour
        hair_rows = range(max(0, y0 - 8 * k), y0 + int(fh * 0.22))
        hair = []
        for y in hair_rows:
            for x in range(max(0, x0 - k), min(w, x1 + k + 1)):
                p = px[x, y]
                if p[3] and lum(p) < 120 and not is_blood(p):
                    px[x, y] = gold(p)
                    hair.append((x, y))
        if hair:
            top = min(y for _, y in hair)
            for x in range(x0, x1 + k + 1):
                col = [y for hx, y in hair if hx == x]
                if not col:
                    continue
                t = min(col)
                lift = 2 * k if x > x0 + fw * 0.3 else k
                for dy in range(1, lift + 1):
                    if t - dy >= 0 and px[x, t - dy][3] == 0:
                        px[x, t - dy] = gold((120 - dy * 10,) * 3 + (255,))
            # forehead sweep to the right
            for y in range(top, y0 + int(fh * 0.25)):
                row = [x for x, hy in hair if hy == y]
                if row and px[max(row) + 1, y][3] == 0 and max(row) + 1 < w:
                    px[max(row) + 1, y] = gold((100, 100, 100, 255))
        # 4. red necktie
        if idx in cfg['tie']:
            cx = (x0 + x1) // 2
            cy = y1 + k
            for dx in range(-3 * k, 3 * k + 1):
                px[cx + dx, cy] = (240, 240, 240, 255)
            for dx in range(-2 * k, 2 * k + 1):
                px[cx + dx, cy + k] = (225, 225, 225, 255)
            length = cfg['tie_len'] * k
            for dy in range(k, length):
                half = k if dy < length - 3 * k else 2 * k
                for dx in range(-half + 1, half + 1):
                    px[cx + dx, cy + dy] = (215, 0, 0, 255) if dx <= 0 else (150, 0, 0, 255)
    return fr


def process(sheet, cfg, res):
    src = Image.open(os.path.join(SRC, str(res), sheet + '.png')).convert('RGBA')
    out = Image.new('RGBA', src.size, (0, 0, 0, 0))
    for i in range(cfg['n']):
        fr = src.crop((i * res, 0, (i + 1) * res, res))
        out.paste(reskin_frame(fr, i, cfg), (i * res, 0))
    out.save(os.path.join(DST, str(res), sheet + '.png'))
    return out


if __name__ == '__main__':
    for res in (64, 128):
        for sheet, cfg in SHEETS.items():
            process(sheet, cfg, res)
            print('wrote', res, sheet)
