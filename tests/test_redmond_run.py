"""Start → Run across win95 / win98 / xp / win7 via router query params.

?nosplash=1 skips the boot overlay.
?run=CMD runs that command through OqRedmondRun (empty ?run= opens the dialog).
?wizard=1 opens the Upgrade Wizard dialog.
"""

import pytest

THEMES = ("win95", "win98", "xp", "win7")


def goto_theme(page, base_url, theme, extra=""):
    q = "nosplash=1" + (("&" + extra) if extra else "")
    page.goto(f"{base_url}/{theme}/index.html?{q}")
    page.wait_for_function(
        "() => window.OqRedmondRun && window.OqScreensaver && window.OqScreensaver.host",
        timeout=8000,
    )


@pytest.mark.parametrize("theme", THEMES)
def test_nosplash_hides_boot(page, base_url, theme):
    goto_theme(page, base_url, theme)
    boot = page.query_selector("#boot-screen")
    if boot:
        assert "is-done" in (boot.get_attribute("class") or "")


@pytest.mark.parametrize("theme", THEMES)
def test_run_query_opens_dialog(page, base_url, theme):
    goto_theme(page, base_url, theme, extra="run=")
    page.wait_for_selector("#run-overlay:not([hidden])", timeout=4000)
    assert page.is_visible("#run-input")


@pytest.mark.parametrize(
    "theme,needle",
    [
        ("win95", "maze-backrooms"),
        ("win98", "maze-backrooms"),
        ("xp", "backrooms-ii"),
        ("win7", "maze-backrooms"),
    ],
)
def test_run_backrooms_query(page, base_url, theme, needle):
    # Dual-path host: top-level (this suite) unhides the overlay, then two
    # rAFs later assigns iframe.src. Waiting only for the overlay being
    # visible races that assignment (CI failed with src ''). Nested
    # preview iframes instead navigate this document with ?oqret=.
    page.goto(f"{base_url}/{theme}/index.html?nosplash=1&run=backrooms")
    page.wait_for_function(
        """(needle) => {
          if (location.href.indexOf(needle) !== -1) return true;
          const frame = document.querySelector("#oq-ss-overlay iframe");
          const src = (frame && (frame.getAttribute("src") || frame.src)) || "";
          return src.indexOf(needle) !== -1;
        }""",
        arg=needle,
        timeout=8000,
    )
    if needle in page.url:
        assert "oqret=" in page.url
        return
    src = page.get_attribute("#oq-ss-overlay iframe", "src") or ""
    assert needle in src
    assert "oqret=" not in src


@pytest.mark.parametrize("theme", THEMES)
def test_run_winver_query(page, base_url, theme):
    goto_theme(page, base_url, theme, extra="run=WINVER.EXE")
    page.wait_for_selector("#winver-overlay:not([hidden])", timeout=4000)
    body = page.text_content("#winver-overlay")
    assert "oq-api" in body.lower() or "Oq!" in body


@pytest.mark.parametrize("theme", THEMES)
def test_unknown_command_stays_in_dialog(page, base_url, theme):
    goto_theme(page, base_url, theme, extra="run=")
    page.wait_for_selector("#run-input", timeout=4000)
    page.fill("#run-input", "not-a-real-program")
    page.click("#run-ok")
    page.wait_for_timeout(150)
    assert page.get_attribute("#run-overlay", "hidden") is None
    err = page.text_content("#run-error")
    assert "cannot find" in err.lower()
    assert "not-a-real-program" in err


@pytest.mark.parametrize("theme", THEMES)
def test_wizard_query_opens_dialog(page, base_url, theme):
    goto_theme(page, base_url, theme, extra="wizard=1")
    page.wait_for_selector("#oq-wizard-overlay:not([hidden])", timeout=4000)
    assert page.is_visible("#oq-wizard-dialog")
    # Verify chameleon class is applied
    dialog_cls = page.get_attribute("#oq-wizard-dialog", "class") or ""
    assert f"oq-wizard-{theme}" in dialog_cls
    # Check that eras are listed
    options = page.query_selector_all(".oq-wizard-era-option")
    assert len(options) == 5


@pytest.mark.parametrize("theme", THEMES)
def test_wizard_desktop_icon_and_start_menu_exist(page, base_url, theme):
    goto_theme(page, base_url, theme)
    # Desktop icon exists
    assert page.query_selector('.desktop-icon[data-open="wizard"]') is not None
    # Start menu item exists
    assert page.query_selector("#start-menu-wizard") is not None


@pytest.mark.parametrize("theme", THEMES)
def test_wizard_desktop_icon_select_and_unselect(page, base_url, theme):
    goto_theme(page, base_url, theme)
    icon = page.wait_for_selector('.desktop-icon[data-open="wizard"]', timeout=4000)
    assert icon is not None
    # Single click selects
    icon.click()
    page.wait_for_timeout(100)
    cls = icon.get_attribute("class") or ""
    assert "selected" in cls

    # Clicking empty desktop unselects
    page.mouse.click(600, 300)
    page.wait_for_timeout(100)
    cls_after = icon.get_attribute("class") or ""
    assert "selected" not in cls_after


def test_win31_wizard_affordance_and_query(page, base_url):
    page.goto(f"{base_url}/win31/index.html?nosplash=1&wizard=1")
    page.wait_for_selector("#oq-wizard-overlay:not([hidden])", timeout=4000)
    assert page.is_visible("#oq-wizard-dialog")
    dialog_cls = page.get_attribute("#oq-wizard-dialog", "class") or ""
    assert "oq-wizard-win31" in dialog_cls
    # Check that Program Manager Main group has the icon
    assert page.query_selector('#win-group-main .prog-icon[data-open="wizard"]') is not None

    # Verify no Hot Dog Stand mention in era options
    content = page.text_content("#oq-wizard-dialog")
    assert "Hot Dog Stand" not in content

    # Test Win 3.1 upgrading to Win95: clicking Continue starts warp and transitions without throwing error
    opt_win95 = page.wait_for_selector('.oq-wizard-era-option[data-era="win95"]')
    opt_win95.click()
    page.wait_for_timeout(50)
    assert "selected" in (opt_win95.get_attribute("class") or "")
    page.click("#oq-wizard-next")
    # Progress step becomes visible
    page.wait_for_selector("#oq-wizard-step-progress:not([hidden])", timeout=4000)


@pytest.mark.parametrize("theme", THEMES)
def test_wizard_centering_and_active_state(page, base_url, theme):
    goto_theme(page, base_url, theme, extra="wizard=1")
    page.wait_for_selector("#oq-wizard-overlay:not([hidden])", timeout=4000)

    # Check centered bounding box: center of dialog should be near center of viewport
    box = page.locator("#oq-wizard-dialog").bounding_box()
    assert box is not None
    viewport = page.viewport_size
    dialog_center_x = box["x"] + box["width"] / 2
    dialog_center_y = box["y"] + box["height"] / 2
    assert abs(dialog_center_x - viewport["width"] / 2) < 20
    assert abs(dialog_center_y - viewport["height"] / 2) < 30

    # Verify selected era has .selected class and active highlight
    selected_opt = page.wait_for_selector(".oq-wizard-era-option.selected")
    assert selected_opt is not None
    # No mention of Hot Dog Stand
    dialog_text = page.text_content("#oq-wizard-dialog")
    assert "Hot Dog Stand" not in dialog_text


def test_win31_wizard_icon_select_and_unselect(page, base_url):
    page.goto(f"{base_url}/win31/index.html?nosplash=1")
    icon = page.wait_for_selector('#win-group-main .prog-icon[data-open="wizard"]', state="attached", timeout=4000)
    assert icon is not None
    # Program Manager is visible; double-click group icon to open Main group window
    page.dblclick(".prog-icon[data-open='win-group-main']")
    page.wait_for_selector('#win-group-main:not(.minimized)', timeout=4000)
    icon.click()
    page.wait_for_timeout(100)
    cls = icon.get_attribute("class") or ""
    assert "selected" in cls

    # Clicking empty space in Program Manager window deselects
    page.mouse.click(50, 50)
    page.wait_for_timeout(100)
    cls_after = icon.get_attribute("class") or ""
    assert "selected" not in cls_after


@pytest.mark.parametrize("theme", THEMES)
def test_desktop_drag_rubberband_selection(page, base_url, theme):
    goto_theme(page, base_url, theme)
    # Drag from (5, 5) to (120, 200) across desktop icons
    page.mouse.move(5, 5)
    page.mouse.down()
    page.mouse.move(120, 200)
    # Marquee element should be active during drag
    marquee = page.query_selector(".desktop-marquee")
    assert marquee is not None
    page.mouse.up()
    page.wait_for_timeout(100)
    # Marquee element removed after release
    assert page.query_selector(".desktop-marquee") is None

    selected = page.query_selector_all(".desktop-icon.selected")
    assert len(selected) >= 1


