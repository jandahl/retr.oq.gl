#!/usr/bin/env python3
"""Generate complete redrawn Wolf3D MAGA guard sprite sheets (64px & 128px).

Transforms all 49 frames of 054_102.png:
- 8 Standing rotations (0..7) cleanly extracted from approved reference art
- 32 Walking frames (4 phases x 8 rotations: 8..39) seamlessly articulated:
  * Phase 1: Left foot step forward, right foot push back, right arm swings
  * Phase 2: Passing step (stride crossing, +1px body bob)
  * Phase 3: Right foot step forward, left foot push back, left arm swings
  * Phase 4: Passing step (stride crossing, 0px body bob)
- 2 Pain frames (40, 44): Fully redrawn pain recoil with neon green blood splash
- 3 Dying frames (41..43): Fully redrawn falling sequence with red MAGA cap flying off and floor tumble
- 1 Dead corpse frame (45): Fully redrawn fallen guard in blue jeans & red shirt with red cap and green blood pool
- 3 Shooting frames (46..48): Fully redrawn pistol draw, forward-aiming stance, and fiery muzzle flash
"""
import struct, zlib, subprocess, os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_64 = os.path.join(BASE_DIR, "vendor", "wolf3d", "art", "sprites", "64", "054_102.png")
OUT_128 = os.path.join(BASE_DIR, "vendor", "wolf3d", "art", "sprites", "128", "054_102.png")
REF_IMG = os.path.join(os.path.expanduser("~"), ".gemini", "antigravity", "brain", "be340d3f-4955-4010-9bf2-81c12657817a", ".user_uploaded", "media_1791629950597_cbdd5435.jpg")
ACTIONS_IMG = os.path.join(os.path.expanduser("~"), ".gemini", "antigravity", "brain", "be340d3f-4955-4010-9bf2-81c12657817a", "maga_guard_actions_sheet_1791639996734.jpg")

# 1. Extract 8 stand angles
raw_ref = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', REF_IMG, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
w_ref, h_ref = 1024, 571

def is_green(r, g, b):
    return g > 170 and r < 90 and b < 90

r1_cols = [
    (23, 148), (179, 290), (329, 397), (439, 542),
    (563, 679), (702, 788), (796, 862), (898, 1007)
]

def extract_sprite(min_x, max_x, min_y, max_y, target_size=64, fig_height=52):
    src_w = max_x - min_x + 1
    src_h = max_y - min_y + 1
    scale = src_h / float(fig_height)
    target_w = max(1, round(src_w / scale))
    grid = [[None for _ in range(target_w)] for _ in range(fig_height)]
    for ty in range(fig_height):
        for tx in range(target_w):
            sx0 = int(min_x + tx * scale)
            sx1 = int(min_x + (tx + 1) * scale)
            sy0 = int(min_y + ty * scale)
            sy1 = int(min_y + (ty + 1) * scale)
            px_list = []
            for sy in range(sy0, max(sy1, sy0 + 1)):
                for sx in range(sx0, max(sx1, sx0 + 1)):
                    if sx < w_ref and sy < h_ref:
                        idx = (sy * w_ref + sx) * 3
                        r, g, b = raw_ref[idx], raw_ref[idx+1], raw_ref[idx+2]
                        if not is_green(r, g, b):
                            px_list.append((r, g, b))
            if px_list:
                grid[ty][tx] = (
                    sum(p[0] for p in px_list) // len(px_list),
                    sum(p[1] for p in px_list) // len(px_list),
                    sum(p[2] for p in px_list) // len(px_list)
                )
    canvas = [[(0, 0, 0, 0) for _ in range(target_size)] for _ in range(target_size)]
    ox = (target_size - target_w) // 2
    oy = target_size - fig_height - 2
    for ty in range(fig_height):
        for tx in range(target_w):
            if grid[ty][tx]:
                r, g, b = grid[ty][tx]
                canvas[oy + ty][ox + tx] = (
                    max(0, min(255, int((r - 128)*1.25 + 128))),
                    max(0, min(255, int((g - 128)*1.25 + 128))),
                    max(0, min(255, int((b - 128)*1.25 + 128))),
                    255
                )
    # Remove tiny disconnected islands (< 12 pixels)
    visited = [[False]*64 for _ in range(64)]
    for y in range(64):
        for x in range(64):
            if canvas[y][x][3] > 0 and not visited[y][x]:
                q = [(x, y)]
                visited[y][x] = True
                pts = []
                while q:
                    cx, cy = q.pop()
                    pts.append((cx, cy))
                    for dy, dx in ((-1,0), (1,0), (0,-1), (0,1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < 64 and 0 <= nx < 64 and canvas[ny][nx][3] > 0 and not visited[ny][nx]:
                            visited[ny][nx] = True
                            q.append((nx, ny))
                if len(pts) < 12:
                    for px, py in pts:
                        canvas[py][px] = (0, 0, 0, 0)

    outlined = [list(r) for r in canvas]
    for y in range(target_size):
        for x in range(target_size):
            if canvas[y][x][3] > 0:
                is_edge = False
                for dy, dx in ((-1,0), (1,0), (0,-1), (0,1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < target_size and 0 <= nx < target_size and canvas[ny][nx][3] == 0:
                        is_edge = True
                        break
                if is_edge:
                    outlined[y][x] = (int(r * 0.25), int(g * 0.25), int(b * 0.25), 255)
    return outlined

stand_8 = []
for min_x, max_x in r1_cols:
    ys = [y for y in range(40, 270) for x in range(min_x, max_x+1) if not is_green(raw_ref[(y*w_ref+x)*3], raw_ref[(y*w_ref+x)*3+1], raw_ref[(y*w_ref+x)*3+2])]
    stand_8.append(extract_sprite(min_x, max_x, min(ys), max(ys)))

# 2. Articulate seamless walking frames from base standing frames
def articulate_walk(base_frame, phase, rot):
    res = [[(0,0,0,0) for _ in range(64)] for _ in range(64)]
    bob = -1 if phase in (0, 2) else 0
    for y in range(39):
        ny = y + bob
        if 0 <= ny < 64:
            for x in range(64):
                res[ny][x] = base_frame[y][x]
                
    arm_shift = 0
    if phase == 0:
        arm_shift = -1
    elif phase == 2:
        arm_shift = 1
        
    if rot in (2, 6):
        for y in range(25, 38):
            ny = y + bob
            if 0 <= ny < 64:
                for x in range(64):
                    if base_frame[y][x][3] > 0 and (base_frame[y][x][0] > 180 or base_frame[y][x][1] > 100):
                        nx = x + (arm_shift if rot == 2 else -arm_shift)
                        if 0 <= nx < 64:
                            res[ny][nx] = base_frame[y][x]
                            
    if rot in (0, 4):
        cx = 31
        for y in range(39, 64):
            for x in range(64):
                px = base_frame[y][x]
                if px[3] == 0:
                    continue
                if x < cx:
                    shift_x = 1 if phase == 0 else (-1 if phase == 2 else 0)
                else:
                    shift_x = -1 if phase == 0 else (1 if phase == 2 else 0)
                target_y = y + bob
                target_x = x + shift_x
                if 0 <= target_y < 64 and 0 <= target_x < 64:
                    res[target_y][target_x] = px
                    
    elif rot in (2, 6):
        direction = 1 if rot == 2 else -1
        stride = 2 if phase == 0 else (-2 if phase == 2 else 0)
        for y in range(39, 64):
            for x in range(64):
                px = base_frame[y][x]
                if px[3] == 0:
                    continue
                factor = (y - 38) / 25.0
                offset_x = int(stride * factor * direction)
                target_y = y + bob
                target_x = x + offset_x
                if 0 <= target_y < 64 and 0 <= target_x < 64:
                    res[target_y][target_x] = px
                if stride != 0 and y >= 54:
                    trailing_x = x - offset_x
                    if 0 <= target_y < 64 and 0 <= trailing_x < 64:
                        res[target_y][trailing_x] = (int(px[0]*0.7), int(px[1]*0.7), int(px[2]*0.7), px[3])
                    
    else:
        scissor = 1 if phase == 0 else (-1 if phase == 2 else 0)
        direction = 1 if rot in (1, 3) else -1
        for y in range(39, 64):
            for x in range(64):
                px = base_frame[y][x]
                if px[3] == 0:
                    continue
                offset_x = int(scissor * ((y - 39) / 24.0) * direction)
                target_y = y + bob
                target_x = x + offset_x
                if 0 <= target_y < 64 and 0 <= target_x < 64:
                    res[target_y][target_x] = px

    outlined = [list(r) for r in res]
    for y in range(64):
        for x in range(64):
            if res[y][x][3] > 0:
                is_edge = False
                for dy, dx in ((-1,0), (1,0), (0,-1), (0,1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < 64 and 0 <= nx < 64 and res[ny][nx][3] == 0:
                        is_edge = True
                        break
                if is_edge:
                    outlined[y][x] = (20, 20, 25, 255)
    return outlined

# 3. Extract redrawn actions (Shoot, Pain, Die, Dead) from redrawn actions sheet
raw_act = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', ACTIONS_IMG, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
w_act, h_act = 1024, 1024

def is_act_bg(r, g, b):
    return abs(r - 133) < 45 and abs(g - 11) < 45 and abs(b - 84) < 45

action_boxes = {
    "shoot1": (20, 218, 52, 450, False, 52),       # Frame 46: draw handgun
    "shoot2": (260, 506, 52, 450, False, 52),      # Frame 47: two-handed aim forward
    "shoot3": (512, 780, 52, 450, False, 52),      # Frame 48: fire with muzzle flash
    "pain":   (800, 1002, 56, 454, False, 52),     # Frame 40 & 44: pain with green blood
    "die1":   (20, 362, 506, 776, False, 50),      # Frame 41: reeling backward
    "die2":   (368, 716, 518, 782, False, 46),     # Frame 42: red cap flying off
    "die3":   (82, 424, 814, 982, True, 36),       # Frame 43: collapsing to floor
    "dead":   (512, 992, 856, 990, True, 26)       # Frame 45: corpse with green blood pool & cap
}

def extract_action(min_x, max_x, min_y, max_y, is_floor, target_fig_h):
    src_w = max_x - min_x + 1
    src_h = max_y - min_y + 1
    if is_floor:
        scale = max(src_w / 58.0, src_h / float(target_fig_h))
    else:
        scale = src_h / float(target_fig_h)
        
    target_w = min(62, max(1, round(src_w / scale)))
    target_h = min(62, max(1, round(src_h / scale)))
    oy = max(0, 64 - target_h - 2)
    ox = max(0, (64 - target_w) // 2)
        
    grid = [[None for _ in range(target_w)] for _ in range(target_h)]
    for ty in range(target_h):
        for tx in range(target_w):
            sx0 = int(min_x + tx * scale)
            sx1 = int(min_x + (tx + 1) * scale)
            sy0 = int(min_y + ty * scale)
            sy1 = int(min_y + (ty + 1) * scale)
            px_list = []
            for sy in range(sy0, max(sy1, sy0 + 1)):
                for sx in range(sx0, max(sx1, sx0 + 1)):
                    if sx < w_act and sy < h_act:
                        idx = (sy * w_act + sx) * 3
                        r, g, b = raw_act[idx], raw_act[idx+1], raw_act[idx+2]
                        if not is_act_bg(r, g, b):
                            # Ignore stray muzzle flash spark from neighboring shooter sprite
                            if sx < 812 and sy < 165 and r > 200 and g > 180 and b < 80:
                                continue
                            px_list.append((r, g, b))
            if px_list:
                grid[ty][tx] = (
                    sum(p[0] for p in px_list) // len(px_list),
                    sum(p[1] for p in px_list) // len(px_list),
                    sum(p[2] for p in px_list) // len(px_list)
                )
    canvas = [[(0,0,0,0) for _ in range(64)] for _ in range(64)]
    for ty in range(target_h):
        for tx in range(target_w):
            if grid[ty][tx]:
                r, g, b = grid[ty][tx]
                if oy + ty < 64 and ox + tx < 64:
                    canvas[oy + ty][ox + tx] = (r, g, b, 255)
                
    # Remove tiny disconnected islands (< 12 pixels)
    visited = [[False]*64 for _ in range(64)]
    for y in range(64):
        for x in range(64):
            if canvas[y][x][3] > 0 and not visited[y][x]:
                q = [(x, y)]
                visited[y][x] = True
                pts = []
                while q:
                    cx, cy = q.pop()
                    pts.append((cx, cy))
                    for dy, dx in ((-1,0), (1,0), (0,-1), (0,1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < 64 and 0 <= nx < 64 and canvas[ny][nx][3] > 0 and not visited[ny][nx]:
                            visited[ny][nx] = True
                            q.append((nx, ny))
                if len(pts) < 12:
                    for px, py in pts:
                        canvas[py][px] = (0, 0, 0, 0)

    outlined = [list(r) for r in canvas]
    for y in range(64):
        for x in range(64):
            if canvas[y][x][3] > 0:
                is_edge = False
                for dy, dx in ((-1,0), (1,0), (0,-1), (0,1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < 64 and 0 <= nx < 64 and canvas[ny][nx][3] == 0:
                        is_edge = True
                        break
                if is_edge:
                    outlined[y][x] = (20, 20, 25, 255)
    return outlined

act_sprites = {}
for k, v in action_boxes.items():
    act_sprites[k] = extract_action(*v)

# 4. Assemble complete 49 frames:
all_frames = []

# Frames 0..7: Stand (8 rotations)
for s in stand_8:
    all_frames.append(s)

# Frames 8..39: Walk cycles (4 phases x 8 rotations)
for phase in range(4):
    for rot in range(8):
        all_frames.append(articulate_walk(stand_8[rot], phase, rot))

# Frames 40..45: Pain, Death, Dead
all_frames.append(act_sprites["pain"])     # 40: SPR_GRD_PAIN_1
all_frames.append(act_sprites["die1"])     # 41: SPR_GRD_DIE_1
all_frames.append(act_sprites["die2"])     # 42: SPR_GRD_DIE_2
all_frames.append(act_sprites["die3"])     # 43: SPR_GRD_DIE_3
all_frames.append(act_sprites["pain"])     # 44: SPR_GRD_PAIN_2
all_frames.append(act_sprites["dead"])     # 45: SPR_GRD_DEAD

# Frames 46..48: Shoot 1, 2, 3
all_frames.append(act_sprites["shoot1"])   # 46: SPR_GRD_SHOOT1
all_frames.append(act_sprites["shoot2"])   # 47: SPR_GRD_SHOOT2
all_frames.append(act_sprites["shoot3"])   # 48: SPR_GRD_SHOOT3

assert len(all_frames) == 49, f"Expected 49 frames, got {len(all_frames)}"

# 5. Encode 64px master PNG
sheet_64 = [[(0,0,0,0) for _ in range(3136)] for _ in range(64)]
for f_idx, frame in enumerate(all_frames):
    start_x = f_idx * 64
    for y in range(64):
        for x in range(64):
            sheet_64[y][start_x + x] = frame[y][x]

def encode_png_rgba(width, height, rows):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    raw_bytes = bytearray()
    for row in rows:
        raw_bytes.append(0)
        for px in row:
            raw_bytes.extend(px)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) +
            chunk(b'IDAT', zlib.compress(bytes(raw_bytes), 9)) + chunk(b'IEND', b''))

with open(OUT_64, "wb") as f:
    f.write(encode_png_rgba(3136, 64, sheet_64))

# 6. Encode 128px master PNG (nearest-neighbor scaled)
sheet_128 = [[(0,0,0,0) for _ in range(6272)] for _ in range(128)]
for y in range(64):
    for x in range(3136):
        px = sheet_64[y][x]
        sheet_128[y*2][x*2] = px
        sheet_128[y*2][x*2+1] = px
        sheet_128[y*2+1][x*2] = px
        sheet_128[y*2+1][x*2+1] = px

with open(OUT_128, "wb") as f:
    f.write(encode_png_rgba(6272, 128, sheet_128))

print("Successfully regenerated all 49 redrawn frames with green blood and clean action sprites!")
