#!/usr/bin/env python3
"""
Generate usa_enemies.wad overlay for DOOM:
1. Former Human Trooper (POSS*) -> MAGA Zombie Trooper (fitted red cap & blue gear).
2. Imp (TROO*) -> Uncle Sam Imp (striped top hat, blue tailcoat, striped trousers).
3. Green Armor (ARM1A0, ARM1B0) -> Classic Greenlandic White Male Anorak with upright hood.
Total: 49 POSS frames + 53 TROO frames + 2 ARM1 frames = 104 sprite frames.
"""

import os
import struct

def decode_doom_patch(data):
    width, height, left, top = struct.unpack('<hhhh', data[:8])
    col_offsets = struct.unpack(f'<{width}I', data[8:8 + width * 4])
    grid = [[None] * width for _ in range(height)]
    for x in range(width):
        ptr = col_offsets[x]
        while True:
            topdelta = data[ptr]
            if topdelta == 0xFF:
                break
            length = data[ptr + 1]
            pixels = data[ptr + 3 : ptr + 3 + length]
            for dy, p in enumerate(pixels):
                y = topdelta + dy
                if 0 <= y < height:
                    grid[y][x] = p
            ptr += length + 4
    return width, height, left, top, grid

def encode_doom_patch(width, height, left, top, grid):
    col_data = []
    col_offsets = []
    curr_offset = 8 + width * 4

    for x in range(width):
        col_offsets.append(curr_offset)
        posts = []
        y = 0
        while y < height:
            while y < height and grid[y][x] is None:
                y += 1
            if y >= height:
                break
            start_y = y
            pixels = []
            while y < height and grid[y][x] is not None:
                pixels.append(grid[y][x])
                y += 1
            posts.append((start_y, pixels))

        col_bytes = bytearray()
        for topdelta, pixels in posts:
            length = len(pixels)
            col_bytes.append(topdelta)
            col_bytes.append(length)
            col_bytes.append(0)  # pad
            col_bytes.extend(pixels)
            col_bytes.append(0)  # pad
        col_bytes.append(0xFF)  # end of column
        col_data.append(col_bytes)
        curr_offset += len(col_bytes)

    header = struct.pack('<hhhh', width, height, left, top)
    offsets_bin = struct.pack(f'<{width}I', *col_offsets)
    return header + offsets_bin + b''.join(col_data)

# Palette mappings
HELMET_TO_RED = {
    152: 178, 153: 179, 154: 180, 155: 182, 156: 184, 157: 186, 158: 188, 159: 190,
    119: 178, 120: 180, 121: 182, 122: 184, 123: 186, 124: 188, 125: 190, 126: 191
}

BLUE_TAILCOAT_RAMP = [
    196, 197, 198, 203, 203, 204, 204, 205, 205, 206, 206, 207, 240, 241, 242, 243
]

RED_PANTS_RAMP = [
    176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191
]

WHITE_PANTS_RAMP = [
    4, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94
]

def reskin_poss_trooper(name, width, height, left, top, grid):
    """Reskins Former Human trooper (POSS*) into MAGA Trooper."""
    new_grid = [row[:] for row in grid]
    filled_rows = [y for y in range(height) if any(new_grid[y][x] is not None for x in range(width))]
    if not filled_rows:
        return new_grid
    min_y = min(filled_rows)

    is_death = any(name.startswith(f'POSS{c}') for c in 'HIJKLMNOPQRSTU')

    # Recolor helmet pixels to red cap ramp
    for y in range(min_y, min(height, min_y + 7)):
        for x in range(width):
            c = new_grid[y][x]
            if c in HELMET_TO_RED:
                new_grid[y][x] = HELMET_TO_RED[c]

    # Specific front / front-diagonal cap styling
    if not is_death and ('1' in name or '2' in name or '8' in name):
        head_xs_top = [x for x in range(width) if new_grid[min_y][x] is not None]
        if head_xs_top and len(head_xs_top) <= 9:
            top_y = min_y + 1
            if top_y < height:
                xs = [x for x in range(width) if new_grid[top_y][x] is not None]
                if xs:
                    mid_x = (min(xs) + max(xs)) // 2
                    emb_y = min_y + 2
                    if emb_y < height and new_grid[emb_y][mid_x] is not None:
                        new_grid[emb_y][mid_x] = 178
                        if mid_x - 1 >= 0 and new_grid[emb_y][mid_x - 1] is not None:
                            new_grid[emb_y][mid_x - 1] = 82
                        if mid_x + 1 < width and new_grid[emb_y][mid_x + 1] is not None:
                            new_grid[emb_y][mid_x + 1] = 82

                    visor_y = min_y + 4
                    if visor_y < height:
                        vxs = [x for x in range(width) if new_grid[visor_y][x] is not None]
                        for x in vxs:
                            dist = abs(x - mid_x)
                            if dist <= 2:
                                new_grid[visor_y][x] = 177
                            elif dist <= 4:
                                new_grid[visor_y][x] = 181
                            else:
                                new_grid[visor_y][x] = 186

    # Uniform olive accents -> navy blue
    for y in range(min_y + 7, height):
        for x in range(width):
            c = new_grid[y][x]
            if c in (154, 155):
                new_grid[y][x] = 204
            elif c in (156, 157):
                new_grid[y][x] = 206
            elif c in (158, 159):
                new_grid[y][x] = 241

    return new_grid

def reskin_troo_imp(name, width, height, left, top, grid):
    """Reskins Imp (TROO*) into Uncle Sam Imp."""
    new_grid = [row[:] for row in grid]
    filled_rows = [y for y in range(height) if any(new_grid[y][x] is not None for x in range(width))]
    if not filled_rows:
        return new_grid
    min_y = min(filled_rows)

    is_death = any(name.startswith(f'TROO{c}') for c in 'IJKLMNOPQRSTU')

    head_xs = [x for y in range(min_y, min(height, min_y + 4)) for x in range(width) if new_grid[y][x] is not None]
    if not head_xs:
        return new_grid
    min_hx, max_hx = min(head_xs), max(head_xs)
    head_w = max_hx - min_hx + 1
    mid_hx = (min_hx + max_hx) / 2.0

    # 1. Uncle Sam Top Hat (min_y .. min_y + 5)
    if not is_death and head_w >= 6:
        # Crown: red & white stripes
        for y in range(min_y, min(height, min_y + 4)):
            for x in range(min_hx, max_hx + 1):
                if new_grid[y][x] is not None:
                    stripe_phase = (int(x - min_hx) // 2) % 2
                    is_edge = (x == min_hx or x == max_hx)
                    if stripe_phase == 1:
                        new_grid[y][x] = 82 if is_edge else 80
                    else:
                        new_grid[y][x] = 184 if is_edge else 178

        # Royal blue ribbon with stars
        ribbon_y = min_y + 4
        if ribbon_y < height:
            for x in range(max(0, min_hx - 1), min(width, max_hx + 2)):
                if new_grid[ribbon_y][x] is not None:
                    if int(abs(x - mid_hx)) in (1, 4):
                        new_grid[ribbon_y][x] = 4
                    else:
                        new_grid[ribbon_y][x] = 203

        # Dark hat brim
        brim_y = min_y + 5
        if brim_y < height:
            for x in range(max(0, min_hx - 2), min(width, max_hx + 3)):
                if new_grid[brim_y][x] is not None and 64 <= new_grid[brim_y][x] <= 79:
                    new_grid[brim_y][x] = 206

        # Goatee on chin
        if '1' in name or '2' in name or '8' in name:
            for gy in (min_y + 10, min_y + 11):
                if gy < height:
                    for gx in (int(mid_hx), int(mid_hx) + 1):
                        if 0 <= gx < width and new_grid[gy][gx] is not None:
                            if 64 <= new_grid[gy][gx] <= 79:
                                new_grid[gy][gx] = 80

    # 2. Blue Tailcoat on Torso (min_y + 8 .. min_y + 34)
    torso_end_y = min(height, min_y + 35)
    for y in range(min_y + 7, torso_end_y):
        for x in range(width):
            c = new_grid[y][x]
            if c is not None and (64 <= c <= 79):
                if not is_death and ('1' in name) and (min_y + 12 <= y <= min_y + 14) and (abs(x - mid_hx) <= 2):
                    if abs(x - mid_hx) <= 0.8:
                        new_grid[y][x] = 178
                    else:
                        new_grid[y][x] = 80
                else:
                    shade_rank = c - 64
                    new_grid[y][x] = BLUE_TAILCOAT_RAMP[min(len(BLUE_TAILCOAT_RAMP) - 1, shade_rank)]

    # 3. Striped Trousers on Legs
    for y in range(torso_end_y, height):
        for x in range(width):
            c = new_grid[y][x]
            if c is not None and (64 <= c <= 79):
                stripe_phase = (x // 2) % 2
                shade_rank = c - 64
                if stripe_phase == 0:
                    new_grid[y][x] = RED_PANTS_RAMP[min(len(RED_PANTS_RAMP) - 1, shade_rank)]
                else:
                    new_grid[y][x] = WHITE_PANTS_RAMP[min(len(WHITE_PANTS_RAMP) - 1, shade_rank)]

    return new_grid

def build_greenlandic_anorak_frame(sparkle=False):
    """Constructs pure white Greenlandic male anorak with upright hood and draped sleeves."""
    w, h = 27, 23
    grid = [[None] * w for _ in range(h)]

    # 1. Full Upright Hood (rows 0..6):
    for x in range(11, 16):
        grid[0][x] = (4 if sparkle else 80) if abs(x - 13) <= 1 else 82

    for x in range(9, 18):
        dx = abs(x - 13)
        grid[1][x] = 4 if dx <= 1 else (80 if dx <= 3 else 82)

    for x in range(8, 19):
        dx = abs(x - 13)
        grid[2][x] = 80 if dx <= 3 else 83

    for x in range(8, 19):
        dx = abs(x - 13)
        if dx <= 2:
            grid[3][x] = 108 if dx <= 1 else 105
        else:
            grid[3][x] = 80

    for x in range(7, 20):
        dx = abs(x - 13)
        if dx <= 3:
            grid[4][x] = 109 if dx <= 1 else 106
        else:
            grid[4][x] = 4 if (dx == 4 or (sparkle and dx == 3)) else 80

    for x in range(7, 20):
        dx = abs(x - 13)
        if dx <= 3:
            grid[5][x] = 108 if dx <= 1 else 106
        else:
            grid[5][x] = 80

    for x in range(7, 20):
        dx = abs(x - 13)
        if dx <= 2:
            grid[6][x] = 107
        elif dx == 3:
            grid[6][x] = 82
        else:
            grid[6][x] = 80

    # 2. Shoulders & Naturally Draped Sleeves (rows 7..14):
    for x in range(4, 23):
        dx = abs(x - 13)
        if dx <= 1:
            grid[7][x] = 106
        elif dx in (2, 3):
            grid[7][x] = 4
        elif dx <= 6:
            grid[7][x] = 80
        else:
            grid[7][x] = 82

    for x in range(2, 25):
        dx = abs(x - 13)
        if dx <= 1:
            grid[8][x] = 107
        elif dx == 2:
            grid[8][x] = 82
        elif dx <= 5:
            grid[8][x] = 4 if (dx in (3, 4) or (sparkle and dx == 5)) else 80
        elif dx <= 8:
            grid[8][x] = 80
        else:
            grid[8][x] = 82

    for x in range(1, 26):
        dx = abs(x - 13)
        if dx == 0:
            grid[9][x] = 84
        elif dx <= 5:
            grid[9][x] = 80
        elif dx in (6, 7):
            grid[9][x] = 86
        elif dx <= 10:
            grid[9][x] = 80
        else:
            grid[9][x] = 84

    for x in range(2, 25):
        dx = abs(x - 13)
        if dx in (6, 7):
            grid[10][x] = 88
        elif dx <= 5:
            grid[10][x] = 80
        elif dx <= 9:
            grid[10][x] = 80
        else:
            grid[10][x] = 83

    for x in range(2, 25):
        dx = abs(x - 13)
        if dx in (6, 7):
            grid[11][x] = 89
        elif dx <= 5:
            grid[11][x] = 80
        elif dx <= 9:
            grid[11][x] = 82
        else:
            grid[11][x] = 84

    for x in range(3, 24):
        dx = abs(x - 13)
        if dx in (6, 7):
            grid[12][x] = None
        elif dx <= 5:
            grid[12][x] = 80
        elif dx <= 9:
            grid[12][x] = 80
        else:
            grid[12][x] = 85

    for x in range(3, 24):
        dx = abs(x - 13)
        if dx in (6, 7):
            grid[13][x] = None
        elif dx <= 5:
            grid[13][x] = 80
        elif dx in (8, 9, 10):
            grid[13][x] = 85

    for x in (3, 4, 5, 21, 22, 23):
        grid[14][x] = 89

    # 3. Torso Body & Hem (rows 12..22):
    for y in range(12, 21):
        for x in range(8, 19):
            dx = abs(x - 13)
            if dx == 5:
                grid[y][x] = 86
            elif dx == 4:
                grid[y][x] = 83
            elif dx in (1, 2) and y in (13, 14):
                grid[y][x] = 4 if not sparkle else 80
            elif dx == 3 and y in (15, 16):
                grid[y][x] = 82
            elif dx == 0 and y >= 14:
                grid[y][x] = 82
            else:
                grid[y][x] = 80

    for x in range(8, 19):
        dx = abs(x - 13)
        grid[21][x] = 107 if dx == 5 else 84

    for x in range(9, 18):
        grid[22][x] = 89

    return w, h, 13, 22, grid

def build_usa_pwad(iwad_path, pwad_path):
    print(f"Reading base assets from {iwad_path}...")
    with open(iwad_path, 'rb') as f:
        wad_type, num_lumps, dir_offset = struct.unpack('<4sII', f.read(12))
        f.seek(dir_offset)
        lumps = [struct.unpack('<II8s', f.read(16)) for _ in range(num_lumps)]
        lump_dict = {name.rstrip(b'\x00').decode('latin1'): (pos, size) for pos, size, name in lumps}

        poss_lumps = [name for name in lump_dict if name.startswith('POSS')]
        troo_lumps = [name for name in lump_dict if name.startswith('TROO')]
        print(f"Found {len(poss_lumps)} Former Human frames and {len(troo_lumps)} Imp frames.")

        pwad_lumps = []
        pwad_lumps.append(('S_START', b''))

        # 1. POSS (MAGA Trooper)
        for name in sorted(poss_lumps):
            pos, size = lump_dict[name]
            f.seek(pos)
            data = f.read(size)
            w, h, l, t, grid = decode_doom_patch(data)
            reskinned = reskin_poss_trooper(name, w, h, l, t, grid)
            patch_bin = encode_doom_patch(w, h, l, t, reskinned)
            pwad_lumps.append((name, patch_bin))

        # 2. TROO (Uncle Sam Imp)
        for name in sorted(troo_lumps):
            pos, size = lump_dict[name]
            f.seek(pos)
            data = f.read(size)
            w, h, l, t, grid = decode_doom_patch(data)
            reskinned = reskin_troo_imp(name, w, h, l, t, grid)
            patch_bin = encode_doom_patch(w, h, l, t, reskinned)
            pwad_lumps.append((name, patch_bin))

        # 3. ARM1 (Greenlandic White Male Anorak Armor)
        wA, hA, lA, tA, gA = build_greenlandic_anorak_frame(sparkle=False)
        wB, hB, lB, tB, gB = build_greenlandic_anorak_frame(sparkle=True)
        pwad_lumps.append(('ARM1A0', encode_doom_patch(wA, hA, lA, tA, gA)))
        pwad_lumps.append(('ARM1B0', encode_doom_patch(wB, hB, lB, tB, gB)))

        pwad_lumps.append(('S_END', b''))

    print(f"Packing {len(pwad_lumps)} lumps into PWAD: {pwad_path}...")
    with open(pwad_path, 'wb') as out_file:
        out_file.write(struct.pack('<4sII', b'PWAD', len(pwad_lumps), 0))
        dir_entries = []
        curr_pos = 12
        for name, data in pwad_lumps:
            size = len(data)
            out_file.write(data)
            padded_name = name.encode('latin1')[:8].ljust(8, b'\x00')
            dir_entries.append((curr_pos, size, padded_name))
            curr_pos += size

        dir_offset = curr_pos
        for pos, size, padded_name in dir_entries:
            out_file.write(struct.pack('<II8s', pos, size, padded_name))

        out_file.seek(8)
        out_file.write(struct.pack('<I', dir_offset))

    total_size = os.path.getsize(pwad_path)
    print(f"Successfully generated {pwad_path} ({total_size / 1024:.1f} KB, {len(pwad_lumps)} lumps).")

if __name__ == '__main__':
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    iwad = os.path.join(repo_root, 'vendor', 'dwasm', 'doom1.wad')
    pwad = os.path.join(repo_root, 'vendor', 'dwasm', 'usa_enemies.wad')
    build_usa_pwad(iwad, pwad)
