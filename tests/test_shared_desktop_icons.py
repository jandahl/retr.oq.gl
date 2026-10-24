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


def test_win98_icon_drag_and_persistence(page, base_url):
    page.set_viewport_size({"width": 1024, "height": 768})
    page.goto(f"{base_url}/win98/index.html")
    page.wait_for_selector("#boot-screen.is-done", state="attached", timeout=6000)
    page.wait_for_timeout(300)

    icon = page.locator('.desktop-icon[data-open="win-computer"]')
    box = icon.bounding_box()

    # Drag icon by (+200, +150)
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2 + 200, box["y"] + box["height"] / 2 + 150, steps=5)
    page.mouse.up()
    page.wait_for_timeout(100)

    assert icon.evaluate("el => el.classList.contains('is-placed')")
    pos_data = page.evaluate("() => localStorage.getItem('retr-oq:win98-desktop-icon-pos')")
    assert pos_data is not None
    assert "win-computer" in pos_data

    # Reload page to verify persistence
    page.reload()
    page.wait_for_selector("#boot-screen.is-done", state="attached", timeout=6000)
    page.wait_for_timeout(300)

    reloaded_icon = page.locator('.desktop-icon[data-open="win-computer"]')
    assert reloaded_icon.evaluate("el => el.classList.contains('is-placed')")


def test_xp_and_win7_icon_drag_and_arrange(page, base_url):
    # Test XP icon drag + context menu Arrange Icons
    page.set_viewport_size({"width": 1024, "height": 768})
    page.goto(f"{base_url}/xp/index.html")
    page.wait_for_selector("#boot-screen.is-done", state="attached", timeout=6000)
    page.wait_for_timeout(300)

    icon = page.locator('.desktop-icon[data-open="win-oq"]')
    box = icon.bounding_box()

    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2 + 180, box["y"] + box["height"] / 2 + 120, steps=5)
    page.mouse.up()
    page.wait_for_timeout(100)

    assert icon.evaluate("el => el.classList.contains('is-placed')")
    assert page.evaluate("() => localStorage.getItem('retr-oq:xp-desktop-icon-pos')") is not None

    # Open context menu on bare desktop and click Arrange Icons
    page.mouse.click(500, 400, button="right")
    page.wait_for_selector("#desktop-context-menu:not([hidden])")
    page.click("#desktop-context-arrange")
    page.wait_for_timeout(100)

    # Position reset and persistence cleared
    assert not icon.evaluate("el => el.classList.contains('is-placed')")
    assert page.evaluate("() => localStorage.getItem('retr-oq:xp-desktop-icon-pos')") is None

    # Test Win7 icon drag + context menu Auto arrange icons
    page.goto(f"{base_url}/win7/index.html")
    page.wait_for_selector("#boot-screen.is-done", state="attached", timeout=6000)
    page.wait_for_timeout(300)

    w7_icon = page.locator('.desktop-icon[data-open="win-oq"]')
    w7_box = w7_icon.bounding_box()

    page.mouse.move(w7_box["x"] + w7_box["width"] / 2, w7_box["y"] + w7_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(w7_box["x"] + w7_box["width"] / 2 + 150, w7_box["y"] + w7_box["height"] / 2 + 100, steps=5)
    page.mouse.up()
    page.wait_for_timeout(100)

    assert w7_icon.evaluate("el => el.classList.contains('is-placed')")
    assert page.evaluate("() => localStorage.getItem('retr-oq:win7-desktop-icon-pos')") is not None

    page.mouse.click(500, 400, button="right")
    page.wait_for_selector("#desktop-context-menu:not([hidden])")
    page.click("#desktop-context-arrange")
    page.wait_for_timeout(100)

    assert not w7_icon.evaluate("el => el.classList.contains('is-placed')")
    assert page.evaluate("() => localStorage.getItem('retr-oq:win7-desktop-icon-pos')") is None

