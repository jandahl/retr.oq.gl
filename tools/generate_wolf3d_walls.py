#!/usr/bin/env python3
"""
Generate Wolf3D replacement wall textures for feat/wolf3d-trump-reskin.
Replaces Nazi swastika banners and Hitler portraits with authentic
US flags, presidential portraits of Donald Trump, and the Presidential Seal.

Targets:
- w_5.png  (64x128 and 128x256): US Flag banner on grey stone
- w_7.png  (64x128 and 128x256): Trump portrait on grey stone
- w_19.png (64x128 and 128x256): Trump portrait on wood panel
- w_21.png (64x128 and 128x256): Presidential Seal on wood panel
- w_33.png (64x128 and 128x256): US Flag banner on blue brick
- w_35.png (64x128 and 128x256): Trump portrait on blue brick
- w_93.png (64x128 and 128x256): US Flag banner on mossy stone
"""

import os
import sys
import zlib
import struct
import subprocess
import urllib.request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WOLF_WALLS_64 = os.path.join(BASE_DIR, 'vendor', 'wolf3d', 'art', 'walls-shaded', '64')
WOLF_WALLS_128 = os.path.join(BASE_DIR, 'vendor', 'wolf3d', 'art', 'walls-shaded', '128')
TMP_DIR = '/tmp/wolf3d_reskin'

def fetch_file(url, target_path):
    if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
        return
    print(f"Downloading {url} -> {target_path}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        with open(target_path, 'wb') as f:
            f.write(resp.read())

def decode_png(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f"Not a PNG: {path}"
    pos = 8
    plte = None
    idat = b''
    w, h, bit_depth, color_type = 0, 0, 8, 3
    while pos < len(data):
        length, chunk_type = struct.unpack('>I4s', data[pos:pos+8])
        pos += 8
        chunk = data[pos:pos+length]
        pos += length + 4
        if chunk_type == b'IHDR':
            w, h, bit_depth, color_type = struct.unpack('>IIBB', chunk[:10])
        elif chunk_type == b'PLTE':
            plte = chunk
        elif chunk_type == b'IDAT':
            idat += chunk

    decomp = zlib.decompress(idat)
    if color_type == 3: # Indexed-color
        palette = [tuple(plte[i:i+3]) for i in range(0, len(plte), 3)]
        pixels = []
        stride = 1 + w
        for y in range(h):
            row = [palette[decomp[y*stride + 1 + x]] for x in range(w)]
            pixels.append(row)
        return w, h, pixels
    elif color_type == 2: # RGB
        pixels = []
        stride = 1 + w * 3
        for y in range(h):
            row = []
            offset = y * stride + 1
            for x in range(w):
                row.append((decomp[offset + x*3], decomp[offset + x*3 + 1], decomp[offset + x*3 + 2]))
            pixels.append(row)
        return w, h, pixels
    elif color_type == 6: # RGBA
        pixels = []
        stride = 1 + w * 4
        for y in range(h):
            row = []
            offset = y * stride + 1
            for x in range(w):
                row.append((decomp[offset + x*4], decomp[offset + x*4 + 1], decomp[offset + x*4 + 2]))
            pixels.append(row)
        return w, h, pixels
    else:
        raise ValueError(f"Unsupported color_type: {color_type}")

def encode_png_rgb(width, height, pixels):
    raw = bytearray()
    for y in range(height):
        raw.append(0) # Filter type 0
        for x in range(width):
            r, g, b = pixels[y][x][:3]
            raw.append(int(r) & 0xff)
            raw.append(int(g) & 0xff)
            raw.append(int(b) & 0xff)

    compressed = zlib.compress(bytes(raw), 9)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)

    def chunk(tag, data):
        return struct.pack('>I4s', len(data), tag) + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr_data) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')

def render_image_ppm(src_file, out_ppm, width, height, crop_expr=None):
    cmd = ['/opt/homebrew/bin/ffmpeg', '-y', '-i', src_file]
    vf = []
    if crop_expr:
        vf.append(crop_expr)
    vf.append(f'scale={width}:{height}')
    cmd.extend(['-vf', ','.join(vf), '-pix_fmt', 'rgb24', out_ppm])
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    with open(out_ppm, 'rb') as f:
        ppm = f.read()
    # Parse PPM header
    header_end = 0
    tokens = []
    i = 0
    while len(tokens) < 4:
        if ppm[i:i+1] == b'#':
            while ppm[i:i+1] != b'\n':
                i += 1
        elif ppm[i:i+1] in b' \t\r\n':
            i += 1
        else:
            start = i
            while i < len(ppm) and ppm[i:i+1] not in b' \t\r\n#':
                i += 1
            tokens.append(ppm[start:i])
    i += 1 # trailing whitespace after maxval
    pw, ph = int(tokens[1]), int(tokens[2])
    raw_bytes = ppm[i:i + pw * ph * 3]
    pixels = []
    for y in range(ph):
        row = []
        for x in range(pw):
            idx = (y * pw + x) * 3
            row.append((raw_bytes[idx], raw_bytes[idx+1], raw_bytes[idx+2]))
        pixels.append(row)
    return pw, ph, pixels

def generate_us_flag_banner(base_w, base_pixels):
    """
    Generate an authentic vertical US Flag hanging tapestry on the base wall.
    Top edge attaches below the upper stone row, hanging with rich gold finials & fringe.
    """
    scale = base_w // 64
    out = [list(row) for row in base_pixels[:base_w]] # Unshaded top half

    # Dimensions of hanging banner
    bx0 = 12 * scale
    bx1 = 52 * scale
    by0 = 6 * scale
    by1 = 58 * scale
    bw = bx1 - bx0
    bh = by1 - by0

    # Draw hanging crossbar / rod at by0
    rod_color = (212, 175, 55) # Gold
    rod_dark = (140, 110, 30)
    for x in range(bx0 - 2 * scale, bx1 + 2 * scale):
        for dy in range(2 * scale):
            y = by0 + dy
            out[y][x] = rod_color if dy == 0 else rod_dark

    # Finials on ends of rod
    for fin_x in [bx0 - 3 * scale, bx1 + 2 * scale]:
        for y in range(by0 - 1 * scale, by0 + 3 * scale):
            for x in range(fin_x, fin_x + 2 * scale):
                out[y][x] = rod_color

    # US Flag stripes: 13 vertical stripes when hanging vertically as a banner,
    # or horizontal stripes on a hanging banner:
    # Code of Federal Regulations: When displayed vertically, the blue union field is uppermost and to the observer's left.
    banner_top = by0 + 2 * scale
    banner_bot = by1 - 3 * scale
    total_h = banner_bot - banner_top
    union_w = int(bw * 0.45)
    union_h = int(total_h * 0.52)

    # 13 alternating Red & White horizontal stripes
    stripe_h = total_h / 13.0
    for y in range(banner_top, banner_bot):
        stripe_idx = int((y - banner_top) / stripe_h)
        is_red = (stripe_idx % 2 == 0)
        stripe_col = (178, 34, 52) if is_red else (240, 240, 245)
        # Add slight fabric wave shading
        wave = int(10 * ((y % 4) - 2))
        col_shaded = (
            max(0, min(255, stripe_col[0] + wave)),
            max(0, min(255, stripe_col[1] + wave)),
            max(0, min(255, stripe_col[2] + wave))
        )
        for x in range(bx0, bx1):
            out[y][x] = col_shaded

    # Blue Canton in upper-left
    navy_blue = (60, 59, 110)
    star_white = (250, 250, 255)
    for y in range(banner_top, banner_top + union_h):
        for x in range(bx0, bx0 + union_w):
            out[y][x] = navy_blue

    # Add 50-star constellation grid inside union
    stars_x = 5
    stars_y = 5
    step_x = union_w / (stars_x + 1)
    step_y = union_h / (stars_y + 1)
    for sy in range(1, stars_y + 1):
        for sx in range(1, stars_x + 1):
            star_px = int(bx0 + sx * step_x)
            star_py = int(banner_top + sy * step_y)
            for dy in range(max(1, scale)):
                for dx in range(max(1, scale)):
                    if 0 <= star_py + dy < base_w and 0 <= star_px + dx < base_w:
                        out[star_py + dy][star_px + dx] = star_white

    # Gold fringe along bottom of banner
    fringe_gold = (212, 175, 55)
    fringe_dark = (150, 120, 35)
    for y in range(banner_bot, by1):
        for x in range(bx0, bx1):
            out[y][x] = fringe_gold if (x + y) % 2 == 0 else fringe_dark

    # Bottom shadow on wall below fringe
    for x in range(bx0, bx1):
        if by1 < base_w:
            r, g, b = out[by1][x]
            out[by1][x] = (int(r * 0.4), int(g * 0.4), int(b * 0.4))

    return make_shaded_pair(base_w, out)

def generate_portrait_wall(base_w, base_pixels, portrait_ppm):
    """
    Place the presidential portrait inside an ornate gilded/wood picture frame on base wall.
    """
    scale = base_w // 64
    out = [list(row) for row in base_pixels[:base_w]]

    # Outer frame coordinates: x=11..55 (width 45*scale), y=3..61 (height 59*scale)
    fx0 = 11 * scale
    fx1 = 55 * scale
    fy0 = 4 * scale
    fy1 = 60 * scale
    frame_thick = 3 * scale

    gold_light = (235, 195, 75)
    gold_mid   = (190, 150, 45)
    gold_dark  = (110, 80, 20)
    shadow_col = (30, 25, 20)

    # Render frame borders
    for y in range(fy0, fy1):
        for x in range(fx0, fx1):
            is_outer = (x == fx0 or y == fy0)
            is_inner = (x == fx1 - 1 or y == fy1 - 1)
            is_border = (x < fx0 + frame_thick or x >= fx1 - frame_thick or
                         y < fy0 + frame_thick or y >= fy1 - frame_thick)
            if is_border:
                if is_outer:
                    out[y][x] = gold_light
                elif is_inner:
                    out[y][x] = gold_dark
                else:
                    out[y][x] = gold_mid

    # Frame shadow on the right and bottom wall
    for y in range(fy0 + scale, min(base_w, fy1 + scale)):
        if fx1 < base_w:
            r, g, b = out[y][fx1]
            out[y][fx1] = (int(r * 0.4), int(g * 0.4), int(b * 0.4))
    for x in range(fx0 + scale, min(base_w, fx1 + scale)):
        if fy1 < base_w:
            r, g, b = out[fy1][x]
            out[fy1][x] = (int(r * 0.4), int(g * 0.4), int(b * 0.4))

    # Inner canvas area:
    cx0 = fx0 + frame_thick
    cx1 = fx1 - frame_thick
    cy0 = fy0 + frame_thick
    cy1 = fy1 - frame_thick
    cw = cx1 - cx0
    ch = cy1 - cy0

    _, _, port_pixels = render_image_ppm(
        portrait_ppm,
        os.path.join(TMP_DIR, f'temp_port_{base_w}.ppm'),
        cw, ch,
        crop_expr='crop=w=min(iw\\,ih*0.75):h=min(iw*1.33\\,ih):x=(iw-out_w)/2:y=ih*0.06'
    )

    for y in range(ch):
        for x in range(cw):
            out[cy0 + y][cx0 + x] = port_pixels[y][x]

    return make_shaded_pair(base_w, out)

def generate_stained_glass_portrait(base_w, base_pixels, portrait_ppm):
    """
    Replace Hitler stained glass window (w_65) with Donald Trump presidential portrait
    inside the existing stained glass arch/frame on base wall.
    """
    scale = base_w // 64
    out = [list(row) for row in base_pixels[:base_w]]

    # Inner canvas inside stained glass frame:
    cx0 = 12 * scale
    cx1 = 51 * scale
    cy0 = 6 * scale
    cy1 = 57 * scale
    cw = cx1 - cx0
    ch = cy1 - cy0

    _, _, port_pixels = render_image_ppm(
        portrait_ppm,
        os.path.join(TMP_DIR, f'temp_port_w65_{base_w}.ppm'),
        cw, ch,
        crop_expr='crop=w=min(iw\\,ih*0.75):h=min(iw*1.33\\,ih):x=(iw-out_w)/2:y=ih*0.06'
    )

    for y in range(ch):
        for x in range(cw):
            out[cy0 + y][cx0 + x] = port_pixels[y][x]

    return make_shaded_pair(base_w, out)

def generate_red_portrait_wall(base_w, base_pixels, portrait_ppm):
    """
    Replace Hitler shouting portrait on red background (w_97) with presidential
    portrait on red background with red framed border on base wall.
    """
    scale = base_w // 64
    out = [list(row) for row in base_pixels[:base_w]]

    fx0 = 7 * scale
    fx1 = 59 * scale
    fy0 = 2 * scale
    fy1 = 60 * scale
    border_thick = 2 * scale

    red_dark = (100, 10, 10)
    red_mid  = (180, 20, 20)

    for y in range(fy0, fy1):
        for x in range(fx0, fx1):
            is_border = (x < fx0 + border_thick or x >= fx1 - border_thick or
                         y < fy0 + border_thick or y >= fy1 - border_thick)
            out[y][x] = red_dark if is_border else red_mid

    # Frame shadow
    for y in range(fy0 + scale, min(base_w, fy1 + scale)):
        if fx1 < base_w:
            r, g, b = out[y][fx1]
            out[y][fx1] = (int(r * 0.4), int(g * 0.4), int(b * 0.4))
    for x in range(fx0 + scale, min(base_w, fx1 + scale)):
        if fy1 < base_w:
            r, g, b = out[fy1][x]
            out[fy1][x] = (int(r * 0.4), int(g * 0.4), int(b * 0.4))

    # Inner canvas:
    cx0 = fx0 + border_thick
    cx1 = fx1 - border_thick
    cy0 = fy0 + border_thick
    cy1 = fy1 - border_thick
    cw = cx1 - cx0
    ch = cy1 - cy0

    _, _, port_pixels = render_image_ppm(
        portrait_ppm,
        os.path.join(TMP_DIR, f'temp_port_w97_{base_w}.ppm'),
        cw, ch,
        crop_expr='crop=w=min(iw\\,ih*0.75):h=min(iw*1.33\\,ih):x=(iw-out_w)/2:y=ih*0.06'
    )

    for y in range(ch):
        for x in range(cw):
            out[cy0 + y][cx0 + x] = port_pixels[y][x]

    return make_shaded_pair(base_w, out)

def generate_seal_wall(base_w, base_pixels, seal_png):
    """
    Place the Great Seal / Presidential Seal plaque centered on the base wall.
    """
    scale = base_w // 64
    out = [list(row) for row in base_pixels[:base_w]]

    # Center circle plaque: diameter 44 * scale
    radius = 22 * scale
    center_x = 32 * scale
    center_y = 32 * scale

    size = radius * 2
    _, _, seal_pixels = render_image_ppm(
        seal_png,
        os.path.join(TMP_DIR, f'temp_seal_{base_w}.ppm'),
        size, size
    )

    gold_rim = (212, 175, 55)
    gold_dark = (120, 95, 25)

    for y in range(size):
        for x in range(size):
            dx = x - radius
            dy = y - radius
            dist = (dx*dx + dy*dy) ** 0.5
            target_x = center_x - radius + x
            target_y = center_y - radius + y
            if 0 <= target_x < base_w and 0 <= target_y < base_w:
                if dist <= radius:
                    if dist >= radius - 2 * scale:
                        out[target_y][target_x] = gold_rim if dx + dy < 0 else gold_dark
                    else:
                        out[target_y][target_x] = seal_pixels[y][x]
                elif dist <= radius + 1.5 * scale and dx > 0 and dy > 0:
                    # Drop shadow
                    r, g, b = out[target_y][target_x]
                    out[target_y][target_x] = (int(r * 0.4), int(g * 0.4), int(b * 0.4))

    return make_shaded_pair(base_w, out)

def make_shaded_pair(size, top_half):
    """
    Wolfenstein 3D shaded walls have dimensions Size x (Size * 2).
    Top half (0..Size-1) is unshaded (bright, horizontal rays).
    Bottom half (Size..2*Size-1) is shaded (52% brightness, vertical rays).
    """
    full = [list(row) for row in top_half]
    for y in range(size):
        shaded_row = []
        for x in range(size):
            r, g, b = top_half[y][x]
            shaded_row.append((int(r * 0.52), int(g * 0.52), int(b * 0.52)))
        full.append(shaded_row)
    return full

def patch_atlas(ids=(5, 7, 19, 21, 33, 35, 65, 93, 97)):
    """The raycaster's non-XP path reads walls-shaded/64/walls.png, a vertical strip where
    texture N (lit) / N+1 (shaded) live at y=(N-1)*64. Paste the generated 64px walls in."""
    atlas_path = os.path.join(WOLF_WALLS_64, 'walls.png')
    aw, ah, atlas = decode_png(atlas_path)
    for n in ids:
        _, _, tex = decode_png(os.path.join(WOLF_WALLS_64, f'w_{n}.png'))
        for y in range(128):
            atlas[(n - 1) * 64 + y] = [tuple(px[:3]) for px in tex[y]]
    with open(atlas_path, 'wb') as f:
        f.write(encode_png_rgb(aw, ah, [[tuple(px[:3]) for px in row] for row in atlas]))
    print("Patched walls.png atlas")

def process_walls():
    os.makedirs(TMP_DIR, exist_ok=True)
    trump_raw = os.path.join(TMP_DIR, 'trump_raw.jpg')
    flag_raw  = os.path.join(TMP_DIR, 'flag_raw.png')
    seal_raw  = os.path.join(TMP_DIR, 'seal_raw.png')

    fetch_file('https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg', trump_raw)
    fetch_file('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/1280px-Flag_of_the_United_States.svg.png', flag_raw)
    fetch_file('https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Seal_of_the_President_of_the_United_States.svg/1280px-Seal_of_the_President_of_the_United_States.svg.png', seal_raw)

    orig_dir = os.path.join(BASE_DIR, 'vendor', 'wolf3d', 'art-original', 'walls-shaded')

    for res, folder in [(64, WOLF_WALLS_64), (128, WOLF_WALLS_128)]:
        print(f"\n--- Generating {res}x{res*2} wall textures in {folder} ---")

        # 1. Base walls
        w1_w, w1_h, stone_pixels = decode_png(os.path.join(folder, 'w_1.png'))
        w17_w, w17_h, wood_pixels = decode_png(os.path.join(folder, 'w_17.png'))
        w9_w, w9_h, blue_pixels = decode_png(os.path.join(folder, 'w_9.png'))
        w91_w, w91_h, moss_pixels = decode_png(os.path.join(folder, 'w_91.png'))

        # Original backgrounds for w_65 and w_97
        res_orig = os.path.join(orig_dir, str(res))
        _, _, w65_orig_pixels = decode_png(os.path.join(res_orig, 'w_65.png'))
        _, _, w97_orig_pixels = decode_png(os.path.join(res_orig, 'w_97.png'))

        # 2. w_5: US Flag on grey stone
        print("Creating w_5.png (US Flag on Grey Stone)...")
        w5_pixels = generate_us_flag_banner(res, stone_pixels)
        with open(os.path.join(folder, 'w_5.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w5_pixels))

        # 3. w_7: Trump Portrait on grey stone
        print("Creating w_7.png (Donald Trump Portrait on Grey Stone)...")
        w7_pixels = generate_portrait_wall(res, stone_pixels, trump_raw)
        with open(os.path.join(folder, 'w_7.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w7_pixels))

        # 4. w_19: Trump Portrait on wood panel
        print("Creating w_19.png (Donald Trump Portrait on Wood Panel)...")
        w19_pixels = generate_portrait_wall(res, wood_pixels, trump_raw)
        with open(os.path.join(folder, 'w_19.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w19_pixels))

        # 5. w_21: Presidential Seal on wood panel
        print("Creating w_21.png (Presidential Seal on Wood Panel)...")
        w21_pixels = generate_seal_wall(res, wood_pixels, seal_raw)
        with open(os.path.join(folder, 'w_21.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w21_pixels))

        # 6. w_33: US Flag on blue brick
        print("Creating w_33.png (US Flag on Blue Brick)...")
        w33_pixels = generate_us_flag_banner(res, blue_pixels)
        with open(os.path.join(folder, 'w_33.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w33_pixels))

        # 7. w_35: Trump Portrait on blue brick
        print("Creating w_35.png (Donald Trump Portrait on Blue Brick)...")
        w35_pixels = generate_portrait_wall(res, blue_pixels, trump_raw)
        with open(os.path.join(folder, 'w_35.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w35_pixels))

        # 8. w_65: Trump Stained Glass Portrait
        print("Creating w_65.png (Donald Trump Stained Glass Portrait)...")
        w65_pixels = generate_stained_glass_portrait(res, w65_orig_pixels, trump_raw)
        with open(os.path.join(folder, 'w_65.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w65_pixels))

        # 9. w_93: US Flag on mossy stone
        print("Creating w_93.png (US Flag on Mossy Stone)...")
        w93_pixels = generate_us_flag_banner(res, moss_pixels)
        with open(os.path.join(folder, 'w_93.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w93_pixels))

        # 10. w_97: Trump Portrait on Red Background
        print("Creating w_97.png (Donald Trump Portrait on Red Background)...")
        w97_pixels = generate_red_portrait_wall(res, w97_orig_pixels, trump_raw)
        with open(os.path.join(folder, 'w_97.png'), 'wb') as f:
            f.write(encode_png_rgb(res, res * 2, w97_pixels))

    patch_atlas()
    print("\nAll Wolf3D replacement wall textures generated successfully!")

if __name__ == '__main__':
    process_walls()
