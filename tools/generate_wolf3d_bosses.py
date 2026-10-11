#!/usr/bin/env python3
"""Pack generated Trump boss action frames into Wolf3D sprite sheets.

The source art in tools/assets is image-generator pixel art. This script only
extracts transparent action frames, removes the attack sheet's magenta key, and
packs art into the engine's existing frame cells. Original attack/death poses,
projectiles, transformation frames, and corpses without a generated equivalent
stay in their original slots.

Run: uv run --no-project --with pillow python3 tools/generate_wolf3d_bosses.py
"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAL = os.path.join(BASE, 'vendor', 'wolf3d', 'art-original', 'sprites')
OUTPUT = os.path.join(BASE, 'vendor', 'wolf3d', 'art', 'sprites')
ASSETS = os.path.join(BASE, 'tools', 'assets')

SUIT_WALK_ART = os.path.join(ASSETS, 'wolf3d-djt-walk-gatlings.png')
MECHA_WALK_ART = os.path.join(ASSETS, 'wolf3d-djt-mecha-walk-gatlings.png')
FAKE_ROBE_WALK_ART = os.path.join(ASSETS, 'wolf3d-djt-fake-robe-walk-wide.png')
FAKE_ROBE_ATTACK_ART = os.path.join(ASSETS, 'wolf3d-djt-fake-robe-attack.png')
ATTACK_ART = os.path.join(ASSETS, 'wolf3d-djt-attack.png')

SUIT_WALK_FRAMES = {i: i for i in range(4)}
MECHA_WALK_FRAMES = {i: i for i in range(4)}
FAKE_ATTACK_FRAME = {4: 4}
FAKE_ROBE_WIDTHS = {i: 56 for i in range(5)}
# 338-363 layout: mecha walk 0-3, attack 4-6, dead 7, death 8-10;
# exposed Hitler walk 11-14, attack 15-17, dead 18, death 19-25.
HITLER_SUIT_WALK_FRAMES = {11 + i: 4 + i for i in range(4)}
# The engine cycles shoot1 -> shoot2 -> shoot3. Its generated strip has a
# ready pose and a firing pose, so the latter occupies both muzzle-flash states.
HITLER_SUIT_ATTACK_FRAMES = {15: 8, 16: 9, 17: 9}


def keyed_views(path, cols=4, rows=2):
    """Return character crops from a generated regular-grid master sheet."""
    sheet = Image.open(path).convert('RGBA')
    cell_w, cell_h = sheet.width // cols, sheet.height // rows
    views = []
    for row in range(rows):
        for col in range(cols):
            cell = sheet.crop((col * cell_w, row * cell_h,
                               (col + 1) * cell_w, (row + 1) * cell_h))
            px = cell.load()
            for y in range(cell.height):
                for x in range(cell.width):
                    r, g, b, _ = px[x, y]
                    # The model's flat magenta key varies slightly at the edges.
                    if r > 180 and b > 180 and g < 65 and abs(r - b) < 75:
                        px[x, y] = (0, 0, 0, 0)
                    else:
                        px[x, y] = (r, g, b, 255)
            bounds = cell.getchannel('A').getbbox()
            if not bounds:
                raise ValueError(f'No character found in turnaround cell {col},{row}: {path}')
            views.append(cell.crop(bounds))
    return views


def transparent_views(path, cols=4):
    """Split a generated transparent-background action strip into frames."""
    sheet = Image.open(path).convert('RGBA')
    views = []
    for col in range(cols):
        left = round(col * sheet.width / cols)
        right = round((col + 1) * sheet.width / cols)
        cell = sheet.crop((left, 0, right, sheet.height))
        bounds = cell.getchannel('A').getbbox()
        if not bounds:
            raise ValueError(f'No character found in walk frame {col}: {path}')
        views.append(cell.crop(bounds))
    return views


def fit_view(view, resolution, target_height, target_width=None):
    """Nearest-neighbor pixel-art fit, centered on a Wolf3D frame baseline."""
    cell = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    max_h, max_w = target_height, target_width or 62
    if target_width:
        # Fake's original robe frames are deliberately broad, with arms spread
        # across nearly the full 64px cell; match that silhouette.
        width, height = max_w, max_h
    else:
        factor = min(max_h / view.height, max_w / view.width)
        width = max(1, round(view.width * factor))
        height = max(1, round(view.height * factor))
    scaled = view.resize((width, height), Image.Resampling.NEAREST)
    x = (64 - width) // 2
    y = 64 - height
    cell.alpha_composite(scaled, (x, y))
    if resolution == 64:
        return cell
    return cell.resize((resolution, resolution), Image.Resampling.NEAREST)


def pack(sheet_name, frame_count, replacements, view_set, resolution,
         target_heights=None, target_widths=None, default_height=54):
    original = Image.open(os.path.join(ORIGINAL, str(resolution), sheet_name + '.png')).convert('RGBA')
    output = Image.new('RGBA', original.size, (0, 0, 0, 0))
    target_heights = target_heights or {}
    target_widths = target_widths or {}
    for index in range(frame_count):
        x = index * resolution
        if index in replacements:
            view_index = replacements[index]
            frame = fit_view(view_set[view_index], resolution,
                             target_heights.get(index, default_height),
                             target_widths.get(index))
        else:
            frame = original.crop((x, 0, x + resolution, resolution))
        output.paste(frame, (x, 0))
    path = os.path.join(OUTPUT, str(resolution), sheet_name + '.png')
    output.save(path)
    return path


def main():
    suit_walk = transparent_views(SUIT_WALK_ART)
    mecha_walk = transparent_views(MECHA_WALK_ART)
    fake_robe_walk = transparent_views(FAKE_ROBE_WALK_ART)
    fake_robe_attack = transparent_views(FAKE_ROBE_ATTACK_ART, cols=2)
    attacks = keyed_views(ATTACK_ART, cols=2, rows=1)
    # 325-337 layout: Fake walk 0-3, attack 4, fire effects 5-6,
    # death animation 7-11, corpse 12.
    fake_views = fake_robe_walk + fake_robe_attack[:1]
    mixed_views = mecha_walk + suit_walk + attacks
    mixed_frames = {
        **MECHA_WALK_FRAMES,
        **HITLER_SUIT_WALK_FRAMES,
        **HITLER_SUIT_ATTACK_FRAMES,
    }
    for resolution in (64, 128):
        pack('325_337', 13, {**SUIT_WALK_FRAMES, **FAKE_ATTACK_FRAME},
             fake_views, resolution, target_widths=FAKE_ROBE_WIDTHS,
             default_height=50)
        heights = {**{i: 60 for i in MECHA_WALK_FRAMES},
                   **{i: 50 for i in HITLER_SUIT_WALK_FRAMES},
                   **{i: 52 for i in HITLER_SUIT_ATTACK_FRAMES}}
        pack('338_363', 26, mixed_frames, mixed_views, resolution,
             target_heights=heights)
        print('wrote', resolution, 'boss sprite sheets')


if __name__ == '__main__':
    main()
