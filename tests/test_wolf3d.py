import struct
import os
import zlib
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALLS_64 = os.path.join(BASE_DIR, "vendor", "wolf3d", "art", "walls-shaded", "64")
WALLS_128 = os.path.join(BASE_DIR, "vendor", "wolf3d", "art", "walls-shaded", "128")

TARGET_WALLS = [
    "w_5.png",   # US Flag on stone
    "w_7.png",   # Trump portrait on stone
    "w_19.png",  # Trump portrait on wood
    "w_21.png",  # Presidential Seal on wood
    "w_33.png",  # US Flag on blue brick
    "w_35.png",  # Trump portrait on blue brick
    "w_93.png",  # US Flag on mossy stone
]

class TestWolf3DTextures(unittest.TestCase):
    def check_png_header(self, path, expected_w, expected_h):
        self.assertTrue(os.path.exists(path), f"Missing texture file: {path}")
        with open(path, "rb") as f:
            data = f.read()
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n", f"Invalid PNG magic bytes in {path}")
        w, h = struct.unpack(">II", data[16:24])
        self.assertEqual(w, expected_w, f"{path}: width is {w}, expected {expected_w}")
        self.assertEqual(h, expected_h, f"{path}: height is {h}, expected {expected_h}")

    def test_wolf3d_wall_textures_64(self):
        for wall_name in TARGET_WALLS:
            with self.subTest(wall=wall_name):
                self.check_png_header(os.path.join(WALLS_64, wall_name), 64, 128)

    def test_wolf3d_wall_textures_128(self):
        for wall_name in TARGET_WALLS:
            with self.subTest(wall=wall_name):
                self.check_png_header(os.path.join(WALLS_128, wall_name), 128, 256)

    def test_wolf3d_shading_invariance(self):
        """Verify that Wolf3D dual-height walls have unshaded top and directional-shaded bottom."""
        path = os.path.join(WALLS_64, "w_5.png")
        with open(path, "rb") as f:
            data = f.read()
        pos = 8
        idat = b""
        while pos < len(data):
            length, chunk_type = struct.unpack(">I4s", data[pos:pos+8])
            pos += 8
            chunk = data[pos:pos+length]
            pos += length + 4
            if chunk_type == b"IDAT":
                idat += chunk
        decomp = zlib.decompress(idat)
        stride = 1 + 64 * 3
        top_lum = sum(decomp[y*stride + 1 + x] for y in range(64) for x in range(64*3))
        bot_lum = sum(decomp[(y+64)*stride + 1 + x] for y in range(64) for x in range(64*3))
        ratio = bot_lum / top_lum
        self.assertTrue(0.45 <= ratio <= 0.60, f"Expected shading ratio around 0.52, got {ratio:.2f}")

if __name__ == '__main__':
    unittest.main()
