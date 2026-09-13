#!/usr/bin/env python3
"""Palette CI: keep each console theme's hex colors inside its own family --
and, where the hardware actually enforced one, inside its real gamut.

Two different things get called "the palette" here, and they're not the
same size:

  1. POSSIBLE GAMUT -- every color the hardware could physically produce.
     For a fixed-palette machine (C64: 16 colors, full stop; DMG Game Boy:
     4 shades of green on its LCD) this is a short, exact, non-negotiable
     list. For a wide-DAC machine (SNES: 15-bit, 32768 colors; Game Gear:
     12-bit, 4096 colors) it's so dense that almost any 24-bit color a
     human picks already lands within half a quantization step of some
     representable value -- there's no real "outside the gamut" to catch,
     so this script doesn't pretend to gate on it there. NES sits between:
     a real, sparse 64-entry PPU master palette exists, but it constrains
     the *picture* the video chip drew, not the gray injection-molded
     plastic of the cartridge/console this theme's chrome represents --
     applying it to chrome would be checking the wrong thing.

  2. CURRENT PALETTE -- the handful of colors a theme actually declared as
     --<theme>-* CSS custom properties on :root, i.e. what's really on
     screen in this one theme, chosen from within (1). This is the "family"
     a theme's own literals should stay inside, and unlike (1) it applies
     everywhere (chrome included) because it's just "the colors this UI
     actually uses," not a hardware limit.

So this script runs up to two checks per theme:
  - FAMILY (every PALETTE_THEME): every hex literal in that theme's own
    style.css/app.js (never shared/ or vendor/) must be the theme's own
    canon, plain black/white, within PALETTE_DISTANCE of canon (a
    legitimate shade/tint -- gradients and box-shadows produce these
    constantly), or already in palette-baseline.json (grandfathered: it
    predates this check and nobody's touched it since).
  - GAMUT (c64, gb only -- the two fixed-palette platforms in scope): hex
    literals must be within GAMUT_DISTANCE of one of that hardware's real,
    exact colors. For c64 this covers the whole theme (a real C64's
    display -- border included -- truly could not show anything else).
    For gb it's scoped to the four --gb-lightest/light/dark/darkest vars,
    the DMG LCD's actual 4 greens -- gb's other colors are the plastic
    shell, which isn't gamut-limited the way the screen is.

Regenerate the family baseline (rare; only for a real, reviewed new
addition to a theme's own palette outside PALETTE_DISTANCE) with:
    python3 tools/check_palette.py --write-baseline
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE_PATH = Path(__file__).resolve().parent / "palette-baseline.json"
PALETTE_DISTANCE = 75  # RGB Euclidean distance -- catches a wrong *family* of color, not a slightly-off shade
GAMUT_DISTANCE = 20  # tighter: this is "is it actually one of the hardware's fixed colors", not just "close"

PALETTE_THEMES = ["nes", "gb", "gg", "snes", "c64", "compy"]

# Real hardware color counts, for context in the report -- see module
# docstring for why only c64/gb get a hard GAMUT check below.
GAMUT_INFO = {
    "nes": "64-color 2C02 master palette (~25 simultaneous) -- applies to the picture the PPU drew, not this theme's plastic-case chrome, so not gamut-checked here",
    "gb": "DMG LCD: exactly 4 fixed shades of green, all on screen at once -- gamut-checked below (--gb-lightest/light/dark/darkest only; the rest is the plastic shell)",
    "gg": "12-bit VDP, 4096 possible colors, 32 simultaneous -- dense enough that ~any 24-bit color already lands within half a quantization step of a real one, so there's no meaningful 'unreachable' to gate on",
    "snes": "15-bit palette, 32768 possible colors, up to 256 simultaneous -- same reasoning as gg: too dense for a hard gamut check to ever actually fire",
    "compy": "VGA 6-bit DAC / EGA 16 -- tube pens are a declared family, beige plastic is not gamut-limited, so FAMILY only (same split as SNES chrome vs picture)",
    "c64": "VIC-II: exactly 16 fixed colors, full stop -- gamut-checked below across the whole theme (a real C64's screen, border included, truly could not show anything else)",
}

# The real C64 16-color VIC-II palette -- the same table already
# documented in c64/style.css's .c64-palette-cycle keyframes (POKE
# 53280/53281 order), repeated here as the ground truth for this check
# rather than an external reference that might round differently.
C64_PALETTE = [
    "#000000", "#ffffff", "#883932", "#67b6bd", "#8b3f96", "#55a049",
    "#40318d", "#bfce72", "#8b5429", "#574200", "#b86962", "#505050",
    "#787878", "#94e089", "#7c70da", "#a3a3a3",
]

# The original DMG-01's 4 fixed LCD shades (lightest to darkest) -- the
# same values gb/style.css's --gb-lightest/light/dark/darkest already use.
GB_DMG_GREENS = ["#9bbc0f", "#8bac0f", "#306230", "#0f380f"]

# theme -> (files to check, real hardware colors) for the hard GAMUT check.
# gb is restricted to its four screen-color var declarations, not the
# whole theme -- see module docstring.
GAMUT_CHECKS = {
    "c64": {"vars_only": None, "colors": C64_PALETTE},
    "gb": {"vars_only": {"gb-lightest", "gb-light", "gb-dark", "gb-darkest"}, "colors": GB_DMG_GREENS},
}

# A hex-looking run of digits is only a color when it's not part of an
# identifier like `#c64-controller` (a CSS id selector, not a literal
# color) -- lookaround excludes runs glued to more word chars or a hyphen
# on either side.
# Alternation tries {6} before {3} -- {3} first would greedily match just
# the first half of any 6-digit code and stop there (regex alternation
# takes the first branch that matches at all, not the longest).
HEX_RE = re.compile(r"(?<![\w-])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])")
VAR_DEF_RE = re.compile(r"--([a-z0-9-]+)\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))")

UNIVERSAL = ["#000000", "#ffffff"]
SKIP_DIR_PARTS = {"vendor", "shared", "node_modules", ".git"}


def normalize(hexcolor):
    h = hexcolor.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return h.lower()


def to_rgb(hexcolor):
    h = normalize(hexcolor)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def distance(a, b):
    ra, ga, ba = to_rgb(a)
    rb, gb, bb = to_rgb(b)
    return ((ra - rb) ** 2 + (ga - gb) ** 2 + (ba - bb) ** 2) ** 0.5


def find_canon(theme_dir):
    """This theme's own declared CURRENT palette: --<theme>-<name>: #hex on :root."""
    style = theme_dir / "style.css"
    if not style.exists():
        return {}
    canon = {}
    prefix = f"{theme_dir.name}-"
    for name, hexcolor in VAR_DEF_RE.findall(style.read_text(encoding="utf-8")):
        if name.startswith(prefix):
            canon.setdefault(normalize(hexcolor), f"--{name}")
    return canon


def find_var_values(theme_dir, var_names):
    """Resolves specific --name: #hex declarations, e.g. the 4 DMG greens."""
    style = theme_dir / "style.css"
    if not style.exists():
        return {}
    values = {}
    for name, hexcolor in VAR_DEF_RE.findall(style.read_text(encoding="utf-8")):
        if name in var_names:
            values.setdefault(name, normalize(hexcolor))
    return values


def iter_source_files(theme_dir):
    for path in sorted(theme_dir.rglob("*")):
        if not path.is_file() or path.suffix not in (".css", ".js"):
            continue
        if any(part in SKIP_DIR_PARTS for part in path.relative_to(theme_dir).parts):
            continue
        yield path


def find_hex_literals(theme_dir):
    """All normalized hex literals actually used in a theme's own files."""
    found = set()
    for path in iter_source_files(theme_dir):
        for match in HEX_RE.finditer(path.read_text(encoding="utf-8")):
            found.add(normalize(match.group(0)))
    return found


def load_baseline():
    if not BASELINE_PATH.exists():
        return {}
    return json.loads(BASELINE_PATH.read_text(encoding="utf-8"))


def write_baseline():
    baseline = {}
    for theme in PALETTE_THEMES:
        theme_dir = ROOT / theme
        canon = find_canon(theme_dir)
        allowed = set(canon) | {normalize(c) for c in UNIVERSAL}
        grandfathered = sorted(
            h for h in find_hex_literals(theme_dir)
            if h not in allowed and min(distance("#" + h, "#" + c) for c in allowed) > PALETTE_DISTANCE
        )
        baseline[theme] = grandfathered
    BASELINE_PATH.write_text(json.dumps(baseline, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {BASELINE_PATH.relative_to(ROOT)}")


def check_family(theme_dir, baseline_colors):
    canon = find_canon(theme_dir)
    allowed = set(canon) | {normalize(c) for c in UNIVERSAL}
    violations = []
    for path in iter_source_files(theme_dir):
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            for match in HEX_RE.finditer(line):
                hexcolor = match.group(0)
                norm = normalize(hexcolor)
                if norm in allowed or norm in baseline_colors:
                    continue
                nearest_dist = min(distance(hexcolor, "#" + c) for c in allowed)
                if nearest_dist <= PALETTE_DISTANCE:
                    continue
                violations.append((path.relative_to(ROOT), lineno, hexcolor, round(nearest_dist), "family"))
    return violations


def check_gamut(theme, theme_dir):
    spec = GAMUT_CHECKS.get(theme)
    if not spec:
        return []
    gamut = {normalize(c) for c in spec["colors"]}
    violations = []
    if spec["vars_only"] is None:
        # Whole-theme gamut (c64): every literal, everywhere in the theme.
        for path in iter_source_files(theme_dir):
            for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
                for match in HEX_RE.finditer(line):
                    hexcolor = match.group(0)
                    norm = normalize(hexcolor)
                    if norm in gamut:
                        continue
                    nearest_dist = min(distance(hexcolor, "#" + c) for c in gamut)
                    if nearest_dist <= GAMUT_DISTANCE:
                        continue
                    violations.append((path.relative_to(ROOT), lineno, hexcolor, round(nearest_dist), "gamut"))
    else:
        # Scoped gamut (gb): only the named screen-color vars.
        values = find_var_values(theme_dir, spec["vars_only"])
        style_path = (theme_dir / "style.css").relative_to(ROOT)
        for name, norm in values.items():
            if norm in gamut:
                continue
            nearest_dist = min(distance("#" + norm, "#" + c) for c in gamut)
            if nearest_dist <= GAMUT_DISTANCE:
                continue
            violations.append((style_path, None, f"--{name}: #{norm}", round(nearest_dist), "gamut"))
    return violations


def main():
    if "--write-baseline" in sys.argv[1:]:
        write_baseline()
        return 0

    baseline = load_baseline()
    total = 0
    for theme in PALETTE_THEMES:
        theme_dir = ROOT / theme
        canon = find_canon(theme_dir)
        if not canon:
            print(f"skipping {theme}/: no --{theme}-* canon palette declared in style.css", file=sys.stderr)
            continue
        print(f"{theme}/: {len(canon)} colors in current palette -- possible gamut: {GAMUT_INFO[theme]}")

        violations = check_family(theme_dir, set(baseline.get(theme, []))) + check_gamut(theme, theme_dir)
        if not violations:
            continue
        total += len(violations)
        print(f"  {len(violations)} violation(s):")
        for path, lineno, hexcolor, dist, kind in violations:
            where = f"{path}:{lineno}" if lineno else str(path)
            label = "off-family" if kind == "family" else "not a real hardware color"
            print(f"    {where}: {hexcolor} ({label}, distance {dist})")

    if total:
        print(f"\n{total} violation(s) found. A family violation: use the theme's own --<theme>-* colors "
              "(adding a new named one if this is a deliberate palette addition), or if it's a shade CI "
              "shouldn't flag, regenerate tools/palette-baseline.json with --write-baseline and explain why "
              "in the PR. A gamut violation: that hardware genuinely cannot produce that color -- pick one "
              "from its real fixed palette instead.")
        return 1
    print("\nPalette check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
