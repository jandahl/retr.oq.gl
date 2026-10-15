#!/usr/bin/env python3
"""
Generate maga_trooper.wad overlay for DOOM:
Reskins all 49 frames of the Former Human / Zombie Trooper (POSS*)
with a fitted Red MAGA baseball cap and crisp tactical uniform accents,
without modifying player sprites or caricature elements.
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
            col_bytes.append(0)  # dummy pad
            col_bytes.extend(pixels)
            col_bytes.append(0)  # dummy pad
        col_bytes.append(0xFF)  # end of column
        col_data.append(col_bytes)
        curr_offset += len(col_bytes)

    header = struct.pack('<hhhh', width, height, left, top)
    offsets_bin = struct.pack(f'<{width}I', *col_offsets)
    return header + offsets_bin + b''.join(col_data)

def reskin_trooper_sprite(name, width, height, left, top, grid):
    """
    Transforms Former Human trooper (POSS*) sprite into MAGA Trooper:
    1. Recolor olive helmet/hair (rows min_y .. min_y+4) to a fitted red baseball cap with visor.
    2. Recolor olive uniform accents to deep navy/slate blue gear.
    """
    new_grid = [row[:] for row in grid]

    # Find the top of the sprite
    filled_rows = [y for y in range(height) if any(new_grid[y][x] is not None for x in range(width))]
    if not filled_rows:
        return new_grid
    min_y = min(filled_rows)

    # Detect angle from lump name:
    # '1': front
    # '2' or '8': front-diagonal
    # '3' or '7': side profile
    # '4' or '6': rear-diagonal
    # '5': back
    # death frames: H, I, J, K, L, M, N, O, P, Q, R, S, T, U (no rotation digit)
    is_death = any(name.startswith(f'POSS{c}') for c in 'HIJKLMNOPQRSTU')

    # Mapping of helmet palette indices to rich red baseball cap ramp:
    # 152..159 (olive helmet) -> 178..190 (red ramp)
    # 119..126 (green helmet) -> 178..190 (red ramp)
    helmet_to_red = {
        152: 178, 153: 179, 154: 180, 155: 182, 156: 184, 157: 186, 158: 188, 159: 190,
        119: 178, 120: 180, 121: 182, 122: 184, 123: 186, 124: 188, 125: 190, 126: 191
    }

    # Recolor helmet pixels in head region (min_y .. min_y + 6):
    for y in range(min_y, min(height, min_y + 7)):
        for x in range(width):
            c = new_grid[y][x]
            if c in helmet_to_red:
                new_grid[y][x] = helmet_to_red[c]

    # Specific front / front-diagonal cap styling (standing / walking / attack):
    if not is_death and ('1' in name or '2' in name or '8' in name):
        # Flatten conical tip on row min_y if it exists:
        head_xs_top = [x for x in range(width) if new_grid[min_y][x] is not None]
        if head_xs_top and len(head_xs_top) <= 9:
            # Row min_y+1 becomes top crown:
            top_y = min_y + 1
            if top_y < height:
                xs = [x for x in range(width) if new_grid[top_y][x] is not None]
                if xs:
                    mid_x = (min(xs) + max(xs)) // 2
                    # White embroidered stitch detail in center of crown (min_y+2):
                    emb_y = min_y + 2
                    if emb_y < height and new_grid[emb_y][mid_x] is not None:
                        new_grid[emb_y][mid_x] = 178
                        if mid_x - 1 >= 0 and new_grid[emb_y][mid_x - 1] is not None:
                            new_grid[emb_y][mid_x - 1] = 82
                        if mid_x + 1 < width and new_grid[emb_y][mid_x + 1] is not None:
                            new_grid[emb_y][mid_x + 1] = 82

                    # Cap visor / bill in row min_y+4:
                    visor_y = min_y + 4
                    if visor_y < height:
                        vxs = [x for x in range(width) if new_grid[visor_y][x] is not None]
                        for x in vxs:
                            # Curved red brim
                            dist = abs(x - mid_x)
                            if dist <= 2:
                                new_grid[visor_y][x] = 177  # bright brim edge
                            elif dist <= 4:
                                new_grid[visor_y][x] = 181
                            else:
                                new_grid[visor_y][x] = 186

    # 2. Recolor uniform olive accents (154..160) below head to dark navy blue gear (204..207, 240..242)
    for y in range(min_y + 7, height):
        for x in range(width):
            c = new_grid[y][x]
            if c in (154, 155):
                new_grid[y][x] = 204  # slate navy
            elif c in (156, 157):
                new_grid[y][x] = 206  # dark navy
            elif c in (158, 159):
                new_grid[y][x] = 241  # deep shadow blue

    return new_grid

def build_maga_pwad(iwad_path, pwad_path):
    print(f"Reading base assets from {iwad_path}...")
    with open(iwad_path, 'rb') as f:
        wad_type, num_lumps, dir_offset = struct.unpack('<4sII', f.read(12))
        f.seek(dir_offset)
        lumps = [struct.unpack('<II8s', f.read(16)) for _ in range(num_lumps)]
        lump_dict = {name.rstrip(b'\x00').decode('latin1'): (pos, size) for pos, size, name in lumps}

        poss_lumps = [name for name in lump_dict.keys() if name.startswith('POSS')]
        print(f"Processing {len(poss_lumps)} Former Human / Zombie Trooper sprite frames...")

        pwad_lumps = []
        pwad_lumps.append(('S_START', b''))
        for name in sorted(poss_lumps):
            pos, size = lump_dict[name]
            f.seek(pos)
            data = f.read(size)
            w, h, l, t, grid = decode_doom_patch(data)
            reskinned_grid = reskin_trooper_sprite(name, w, h, l, t, grid)
            patch_bin = encode_doom_patch(w, h, l, t, reskinned_grid)
            pwad_lumps.append((name, patch_bin))
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
    pwad = os.path.join(repo_root, 'vendor', 'dwasm', 'maga_trooper.wad')
    build_maga_pwad(iwad, pwad)
