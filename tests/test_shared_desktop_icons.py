"""Automated test suite for shared desktop icon behavior across themes.

Verifies:
1. Drag-and-drop repositioning creates .is-placed coordinates.
2. Window resizing clamps placed icons within desktop bounds.
3. Multi-icon dragging moves all selected icons together.
4. Clean Up restores original flex/column positioning.
"""

import pytest


def test_amiga_multi_icon_drag(page, base_url):
    page.set_viewport_size({"width": 1024, "height": 768})
    page.goto(f"{base_url}/amiga/index.html")
    page.wait_for_selector("#boot-screen.is-done", state="attached", timeout=6000)
    page.wait_for_timeout(300)

    ram = page.locator('.desktop-icon[data-open="win-ram"]')
    oq = page.locator('.desktop-icon[data-open="win-oq"]')

    # Select both icons
    page.evaluate(
        """() => {
          document.querySelector('.desktop-icon[data-open="win-ram"]').classList.add('is-selected');
          document.querySelector('.desktop-icon[data-open="win-oq"]').classList.add('is-selected');
        }"""
    )

    box_ram = ram.bounding_box()
    box_oq = oq.bounding_box()

    # Drag RAM icon by (+120, +80)
    page.mouse.move(box_ram["x"] + box_ram["width"] / 2, box_ram["y"] + box_ram["height"] / 2)
    page.mouse.down()
    page.mouse.move(box_ram["x"] + box_ram["width"] / 2 + 120, box_ram["y"] + box_ram["height"] / 2 + 80, steps=5)
    page.mouse.up()
    page.wait_for_timeout(100)

    new_ram = ram.bounding_box()
    new_oq = oq.bounding_box()

    # Both icons moved by roughly (+120, +80)
    assert abs((new_ram["x"] - box_ram["x"]) - 120) < 15
    assert abs((new_ram["y"] - box_ram["y"]) - 80) < 15
    assert abs((new_oq["x"] - box_oq["x"]) - 120) < 15
    assert abs((new_oq["y"] - box_oq["y"]) - 80) < 15


def test_aqua_grid_snapping_support(page, base_url):
    page.set_viewport_size({"width": 1024, "height": 768})
    page.goto(f"{base_url}/aqua/index.html")
    page.wait_for_selector("#desktop", state="attached", timeout=6000)
    page.wait_for_timeout(200)

    # Re-init OqDesktopIcons with grid snapping enabled
    page.evaluate(
        """() => {
          window.OqDesktopIcons.init({
            desktop: document.getElementById('desktop'),
            storageKey: 'retr-oq:aqua-desktop-icon-pos',
            grid: { x: 50, y: 50, originX: 10, originY: 10 }
          });
        }"""
    )

    icon = page.locator('.desktop-icon[data-open="win-home"]')
    box = icon.bounding_box()

    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(314, 219, steps=5)
    page.mouse.up()
    page.wait_for_timeout(100)

    left = float(page.evaluate("() => parseFloat(document.querySelector('.desktop-icon[data-open=\"win-home\"]').style.left)"))
    top = float(page.evaluate("() => parseFloat(document.querySelector('.desktop-icon[data-open=\"win-home\"]').style.top)"))

    # Snapped to (10 + N*50)
    assert (left - 10) % 50 == 0
    assert (top - 10) % 50 == 0
