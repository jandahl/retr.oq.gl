"""Smoke tests for the OQ!2 Workplace Shell host and guest sessions."""


def open_theme(page, base_url):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{base_url}/os2/index.html")
    page.wait_for_timeout(150)
    return errors


def test_os2_desktop_and_system_folder_load(page, base_url):
    assert open_theme(page, base_url) == []
    assert page.locator("#desktop").is_visible()
    assert not page.locator("#system-window").is_visible()
    assert page.locator(".warpcenter").count() == 0


def test_os2_opens_win_os2_and_dos_guests(page, base_url):
    assert open_theme(page, base_url) == []
    page.locator("[data-open='win-os2-window']").first.click()
    page.locator("[data-open='dos-window']").first.click()
    assert page.locator("#win-os2-window").is_visible()
    assert page.locator("#dos-window").is_visible()
    assert page.locator("#win-os2-window iframe").get_attribute("src") == "../win31/index.html?standalone=1&screen=oq"
    assert page.locator("#dos-window iframe").get_attribute("src") == "../dos/index.html"


def test_os2_window_can_close_and_menu_dropdown_works(page, base_url):
    assert open_theme(page, base_url) == []
    page.locator("[data-open='system-window']").first.click()
    page.locator("#system-window [data-menu='system-object-menu']").click()
    assert page.locator("#system-object-menu").is_visible()
    page.locator("#system-window .close-window").click()
    assert not page.locator("#system-window").is_visible()


def test_os2_opens_word_deconstructor_guest(page, base_url):
    assert open_theme(page, base_url) == []
    page.locator("[data-open='decon-window']").first.click()
    assert page.locator("#decon-window").is_visible()
    assert page.locator("#decon-window iframe").get_attribute("src") == "../win31/index.html?screen=decon"
    assert "Word Deconstructor" in page.locator("#decon-window .os2-titlebar").inner_text()



def test_os2_minimize_does_not_close(page, base_url):
    assert open_theme(page, base_url) == []
    page.locator("[data-open='system-window']").first.click()
    assert page.locator("#system-window").is_visible()
    page.locator("#system-window .minimize").click()
    assert not page.locator("#system-window").is_visible()
    assert page.locator('#minimized-tray [data-restore="system-window"]').count() == 1
    page.locator('#minimized-tray [data-restore="system-window"]').click()
    assert page.locator("#system-window").is_visible()
    assert page.locator('#minimized-tray [data-restore="system-window"]').count() == 0


def test_os2_shutdown_leaves_to_hub(page, base_url):
    assert open_theme(page, base_url) == []
    page.locator(".object-icon[data-shutdown]").first.click()
    page.wait_for_function(
        "() => !location.pathname.includes('/os2/')",
        timeout=4000,
    )


def test_os2_desktop_context_menu_arrange_and_refresh(page, base_url):
    assert open_theme(page, base_url) == []
    menu = page.locator("#desktop-context-menu")
    assert not menu.is_visible()

    # Right-click bare desktop
    page.click("#desktop", button="right", position={"x": 400, "y": 300})
    page.wait_for_timeout(100)
    assert menu.is_visible()

    # Drag an icon to reposition it first
    icon = page.locator(".object-icon[data-open='system-window']")
    initial_box = icon.bounding_box()
    page.mouse.move(initial_box["x"] + initial_box["width"] / 2, initial_box["y"] + initial_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(initial_box["x"] + initial_box["width"] / 2 + 100, initial_box["y"] + initial_box["height"] / 2 + 60, steps=5)
    page.mouse.up()
    page.wait_for_timeout(100)
    moved_box = icon.bounding_box()
    assert abs((moved_box["x"] - initial_box["x"]) - 100) < 15

    # Re-open context menu and click Arrange icons
    page.click("#desktop", button="right", position={"x": 400, "y": 300})
    page.wait_for_timeout(100)
    page.locator("#desktop-ctx-arrange").click()
    page.wait_for_timeout(100)

    # Menu closed and icon restored to original position
    assert not menu.is_visible()
    restored_box = icon.bounding_box()
    assert abs(restored_box["x"] - initial_box["x"]) < 5
    assert abs(restored_box["y"] - initial_box["y"]) < 5
