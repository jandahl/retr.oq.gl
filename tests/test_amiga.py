"""Amiga Workbench desktop icons regression suite.

Tests icon wrapping when screen height is constrained, drag-and-drop repositioning,
position persistence via localStorage, and Clean Up reset.
"""


def goto_amiga(page, base_url):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    unexpected_404s = []
    page.on(
        "response",
        lambda r: unexpected_404s.append(r.url)
        if r.status == 404
        and not r.url.endswith("/favicon.ico")
        and r.url.startswith(base_url)
        else None,
    )
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.goto(f"{base_url}/amiga/index.html")
    # Click to dismiss boot screen immediately
    page.locator("#boot-screen").click()
    page.wait_for_timeout(200)
    return errors, console_errors, unexpected_404s


def test_amiga_desktop_icons_wrap_on_short_screen(page, base_url):
    page.set_viewport_size({"width": 800, "height": 350})
    errors, console_errors, unexpected_404s = goto_amiga(page, base_url)
    assert not errors, f"Page errors: {errors}"
    assert not unexpected_404s, f"404s: {unexpected_404s}"

    # Get bounding boxes for left desktop icons
    icons = page.locator(".desktop-icons-left .desktop-icon")
    count = icons.count()
    assert count >= 6, "Expected at least 6 icons in desktop-icons-left"

    first_box = icons.nth(0).bounding_box()
    last_box = icons.nth(count - 1).bounding_box()

    # The last icon (ROM switch) should wrap to a new column (i.e. x position > first icon's x)
    assert last_box["x"] > first_box["x"], f"Expected last icon to wrap to next column: first={first_box}, last={last_box}"
    # And both icons should be well within the viewport height
    assert last_box["y"] + last_box["height"] <= 350, f"Last icon clipped below viewport: {last_box}"


def test_amiga_desktop_icon_drag_and_cleanup(page, base_url):
    page.set_viewport_size({"width": 1024, "height": 768})
    goto_amiga(page, base_url)

    # Initial position of RAM:
    ram_icon = page.locator('.desktop-icon[data-open="win-ram"]')
    initial_box = ram_icon.bounding_box()

    # Drag RAM: icon by (+150, +100)
    ram_icon.hover()
    center_x = initial_box["x"] + initial_box["width"] / 2
    center_y = initial_box["y"] + initial_box["height"] / 2
    page.mouse.move(center_x, center_y)
    page.mouse.down()
    page.mouse.move(center_x + 150, center_y + 100, steps=5)
    page.mouse.up()
    page.wait_for_timeout(100)

    # Verify style was applied and position changed
    new_box = ram_icon.bounding_box()
    assert abs(new_box["x"] - (initial_box["x"] + 150)) < 15
    assert abs(new_box["y"] - (initial_box["y"] + 100)) < 15

    # Check localStorage
    stored = page.evaluate("() => localStorage.getItem('retr-oq:amiga-desktop-icon-pos')")
    assert stored is not None and "win-ram" in stored

    # Reload page to check persistence
    page.reload()
    page.wait_for_timeout(200)
    persisted_box = page.locator('.desktop-icon[data-open="win-ram"]').bounding_box()
    assert abs(persisted_box["x"] - new_box["x"]) < 5
    assert abs(persisted_box["y"] - new_box["y"]) < 5

    # Clean Up menu item clears positions
    page.evaluate(
        """() => {
          const item = document.getElementById('menu-cleanup');
          item.querySelector('a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }"""
    )
    page.wait_for_timeout(100)

    cleared = page.evaluate("() => localStorage.getItem('retr-oq:amiga-desktop-icon-pos')")
    assert cleared in (None, "")

    cleaned_box = page.locator('.desktop-icon[data-open="win-ram"]').bounding_box()
    assert abs(cleaned_box["x"] - initial_box["x"]) < 5
    assert abs(cleaned_box["y"] - initial_box["y"]) < 5
