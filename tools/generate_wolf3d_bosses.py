#!/usr/bin/env python3
"""Reskin the three Wolf3D boss sprite sheets (Fake Hitler, Mecha-Hitler, Hitler)
into Fake Trump, Mecha-Trump and Trump with dual chainguns.

Every frame is derived from the pristine original in art-original/sprites, so all
animation poses, hitboxes and frame timings stay 100% authentic:
  * face   -> orange tan, moustache removed, clean mouth
  * hair   -> authentic swept golden-blonde pompadour (curved volume, highlights)
  * teal mecha armour / brown uniform -> navy blue
  * red necktie on the walking and shooting frames
  * Hitler's death gore -> green (matches the guards' green blood)

Head coordinates are precisely mapped per-frame to eliminate artifacts.

Run:  uv run --no-project --with pillow python3 tools/generate_wolf3d_bosses.py
Sheets: 325_337 (Fake, 13 frames), 338_363 (Mecha + Hitler, 26 frames).
"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'vendor', 'wolf3d', 'art-original', 'sprites')
DST = os.path.join(BASE, 'vendor', 'wolf3d', 'art', 'sprites')

# Precise face bounding boxes per frame: (x0, x1, y0, y1)
# y0 is brow/eyes, y1 is chin. Hair is grown upward and outward from y0.
SHEETS = {
    '325_337': dict(
        n=13, recolor=False, tie=range(0, 5), tie_len=8, gore=(),
        # 0..4: walking, 5..6: fireballs, 7: dying start, 8: dying middle, 9..12: puddle
        face_boxes={
            0: (29, 36, 15, 23),
            1: (29, 36, 15, 23),
            2: (29, 36, 15, 23),
            3: (29, 36, 15, 23),
            4: (29, 36, 15, 23),
            7: (29, 36, 21, 28),
            8: (30, 36, 28, 33),
        }
    ),
    '338_363': dict(
        n=26, recolor=True, tie=range(11, 18), tie_len=9, gore=range(18, 26),
        # 0..3: mecha walk, 4..6: mecha shoot, 7: dead chassis,
        # 8..10: mecha break / emerge, 11..14: hitler walk, 15..17: hitler shoot,
        # 18: hitler dead puddle 1, 19..24: hitler melting/dying, 25: dead puddle 2
        face_boxes={
            0: (29, 37, 5, 14),
            1: (29, 37, 7, 16),
            2: (29, 37, 5, 14),
            3: (29, 37, 7, 16),
            4: (29, 37, 9, 16),
            5: (29, 37, 9, 16),
            6: (29, 37, 9, 16),
            8: (27, 37, 8, 17),
            9: (27, 37, 8, 18),
            10: (25, 36, 13, 22),
            11: (26, 35, 13, 22),
            12: (26, 35, 11, 21),
            13: (26, 35, 14, 23),
            14: (26, 35, 11, 21),
            15: (26, 35, 15, 22),
            16: (26, 35, 17, 23),
            17: (26, 35, 15, 22),
            19: (26, 35, 10, 20),
            20: (26, 35, 13, 21),
            21: (26, 34, 19, 27),
            22: (27, 36, 29, 38),
            23: (26, 36, 38, 46),
        }
    ),
}

def lum(p):
    return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]

def is_warm(p):
    r, g, b, a = p
    return a > 0 and r >= 115 and r > g >= b * 0.85 and r - b >= 35

def orange(p):
    return (min(255, p[0]), int(p[1] * 0.82), int(p[2] * 0.55), 255)

def gold(t):
    t = max(0.0, min(1.0, t))
    return (int(160 + 95 * t), int(115 + 85 * t), int(25 + 55 * t), 255)

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

def paint_hair(px, w, h, k, box, is_mecha=False):
    x0, x1, y0, y1 = box
    fw = x1 - x0 + 1
    cx = (x0 + x1) / 2.0
    
    # Trump hair profile:
    # High swept pompadour lifted by 4px, sweeping gracefully to the right side
    lift_height = 4 * k
    side_drop = 3 * k
    
    for x in range(max(0, x0 - 2 * k), min(w, x1 + 3 * k + 1)):
        rx = (x - cx) / (fw / 2.0 + k)  # -1..1 across the head
        
        # Arch height over head: highest in center/right
        arch = max(0, 1.0 - (rx - 0.1)**2 * 0.9)
        top = int(y0 - lift_height * arch)
        
        # Bottom edge of hair: swoops across brow, drops at the temples
        if rx < -0.7:
            bot = y0 + side_drop
        elif rx > 0.8:
            bot = y0 + side_drop
        else:
            # Forehead swoop: lower on the right than left
            bot = int(y0 + (1.2 + 0.8 * rx) * k)
            
        top = max(0, top)
        bot = min(h - 1, bot)
        
        for y in range(top, bot + 1):
            p = px[x, y]
            # Protect Mecha glass canopy highlights
            if is_mecha and p[3] and lum(p) > 200 and abs(p[0] - p[2]) < 25:
                continue
            # Protect gore particles
            if p[3] and is_blood(p):
                continue
                
            # Golden highlight gradient with directional sweep
            grad = (y - top) / float(max(1, bot - top))
            t = 0.9 - 0.55 * grad
            # Fine highlight ridge
            if (x + y // max(1, k)) % 3 == 0:
                t = min(1.0, t + 0.15)
            px[x, y] = gold(t)

def reskin_frame(fr, idx, cfg):
    w, h = fr.size
    k = h // 64
    px = fr.load()

    face = cfg['face_boxes'].get(idx)
    if face:
        face = tuple(v * k for v in face)
        x0, x1, y0, y1 = face
        fw, fh = x1 - x0 + 1, y1 - y0 + 1
        cx = (x0 + x1) // 2
    else:
        x0 = x1 = y0 = y1 = fw = fh = cx = 0

    def in_head(x, y):
        if not face: return False
        return (x0 - 3 * k <= x <= x1 + 4 * k and y0 - 6 * k <= y <= y1 + 2 * k)

    # 1. Uniforms, armor & gore outside the head
    is_mecha_frame = (idx < 8) and cfg['recolor']
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0:
                continue
            if is_blood(p) and idx in cfg['gore']:
                px[x, y] = green(p)
            elif cfg['recolor'] and not in_head(x, y) and (is_teal(p) or is_brown(p)):
                px[x, y] = navy(p)

    if face:
        # 2. Skin tone: convert warm pixels in face area to orange tan
        for y in range(y0, y1 + 1):
            for x in range(x0 - k, x1 + 2 * k):
                if 0 <= x < w and is_warm(px[x, y]):
                    px[x, y] = orange(px[x, y])

        # 3. Clean face & moustache removal:
        # Overwrite moustache and old lower mouth with smooth skin tone
        skin_tone = orange((232, 136, 88, 255))
        shade_tone = orange((200, 112, 64, 255))
        
        # Clear moustache region cleanly
        for y in range(y1 - 4 * k, y1 + 1):
            for x in range(cx - 2 * k, cx + 2 * k + 1):
                p = px[x, y]
                if p[3] and not is_blood(p):
                    # Replace dark hair/shadow with skin
                    if lum(p) < 140 or (p[0] < 170 and p[1] < 120):
                        px[x, y] = skin_tone
                        
        # Draw neat subtle mouth
        mouth_y = y1 - 2 * k
        for x in range(cx - k, cx + k + 1):
            px[x, mouth_y] = (165, 60, 50, 255)
            px[x, mouth_y + 1] = shade_tone

        # 4. Paint signature blonde pompadour
        paint_hair(px, w, h, k, face, is_mecha=is_mecha_frame)

        # 5. Clean up any leftover dark hair fringing around the head
        for y in range(max(0, y0 - 6 * k), min(h, y1 + k)):
            for x in range(max(0, x0 - 3 * k), min(w, x1 + 4 * k)):
                p = px[x, y]
                # Any leftover dark grey/black Nazi hair gets turned into gold
                if p[3] and lum(p) < 95 and abs(p[0] - p[2]) < 25 and not is_blood(p):
                    px[x, y] = gold(0.4)

        # 6. Red necktie on walking / standing / shooting frames
        if idx in cfg['tie']:
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
