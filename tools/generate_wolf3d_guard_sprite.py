#!/usr/bin/env python3
"""Convert a generated, magenta-backed character render into a Wolf3D-style sprite.

Pipeline: key out the VGA transparency colour -> block-average down to the
sprite grid (ignoring background) -> median-cut palette -> hard alpha.

Usage: python3 tools/generate_wolf3d_guard_sprite.py SRC.jpg OUT_PREFIX
Writes OUT_PREFIX_64.png and OUT_PREFIX_128.png (RGBA, one 64/128 cell each).
"""
import struct
import subprocess
import sys
import zlib

BG = (152, 0, 136)           # Wolf3D's transparent magenta (VGA palette index 255)
FFMPEG = '/opt/homebrew/bin/ffmpeg'


def decode(path):
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height',
                            '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
    w, h = [int(v) for v in probe.strip().split(',')]
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-pix_fmt', 'rgb24',
                          '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    return w, h, raw


def encode_rgba(w, h, rows):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    raw = bytearray()
    for row in rows:
        raw.append(0)
        for px in row:
            raw.extend(px)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) +
            chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))


def is_bg(r, g, b):
    return abs(r - BG[0]) + abs(g - BG[1]) + abs(b - BG[2]) < 90


def median_cut(colors, n):
    boxes = [list(colors)]
    while len(boxes) < n:
        boxes.sort(key=len, reverse=True)
        box = boxes.pop(0)
        if len(box) < 2:
            boxes.append(box)
            break
        ch = max(range(3), key=lambda c: max(p[c] for p in box) - min(p[c] for p in box))
        box.sort(key=lambda p: p[ch])
        mid = len(box) // 2
        boxes.extend([box[:mid], box[mid:]])
    return [tuple(sum(p[c] for p in b) // len(b) for c in range(3)) for b in boxes if b]


def sprite(w, h, raw, cell, fig_h):
    """Downscale the figure to fig_h rows tall, bottom-centred in a cell x cell frame."""
    xs, ys = [], []
    for y in range(h):
        base = y * w * 3
        for x in range(w):
            if not is_bg(raw[base + x * 3], raw[base + x * 3 + 1], raw[base + x * 3 + 2]):
                xs.append(x)
                ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    scale = (y1 - y0) / fig_h
    fig_w = max(1, round((x1 - x0) / scale))
    grid = [[None] * fig_w for _ in range(fig_h)]
    for ty in range(fig_h):
        for tx in range(fig_w):
            sx0, sx1 = int(x0 + tx * scale), int(x0 + (tx + 1) * scale)
            sy0, sy1 = int(y0 + ty * scale), int(y0 + (ty + 1) * scale)
            px, bgc = [], 0
            for sy in range(sy0, max(sy1, sy0 + 1)):
                for sx in range(sx0, max(sx1, sx0 + 1)):
                    if sx >= w or sy >= h:
                        continue
                    i = (sy * w + sx) * 3
                    p = (raw[i], raw[i + 1], raw[i + 2])
                    if is_bg(*p):
                        bgc += 1
                    else:
                        px.append(p)
            if px and len(px) > bgc:
                grid[ty][tx] = tuple(sum(p[c] for p in px) // len(px) for c in range(3))
    palette = median_cut([p for row in grid for p in row if p], 28)
    def nearest(p):
        return min(palette, key=lambda q: sum((p[i] - q[i]) ** 2 for i in range(3)))
    out = [[(0, 0, 0, 0)] * cell for _ in range(cell)]
    ox, oy = (cell - fig_w) // 2, cell - fig_h
    for ty in range(fig_h):
        for tx in range(fig_w):
            if grid[ty][tx]:
                out[oy + ty][ox + tx] = nearest(grid[ty][tx]) + (255,)
    return out


def main():
    src, prefix = sys.argv[1], sys.argv[2]
    w, h, raw = decode(src)
    for cell, fig_h in ((64, 52), (128, 104)):
        rows = sprite(w, h, raw, cell, fig_h)
        with open(f'{prefix}_{cell}.png', 'wb') as f:
            f.write(encode_rgba(cell, cell, rows))
        print('wrote', f'{prefix}_{cell}.png')


if __name__ == '__main__':
    main()
