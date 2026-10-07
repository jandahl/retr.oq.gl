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


def test_win31_wizard_affordance_and_query(page, base_url):
    page.goto(f"{base_url}/win31/index.html?nosplash=1&wizard=1")
    page.wait_for_selector("#oq-wizard-overlay:not([hidden])", timeout=4000)
    assert page.is_visible("#oq-wizard-dialog")
    dialog_cls = page.get_attribute("#oq-wizard-dialog", "class") or ""
    assert "oq-wizard-win31" in dialog_cls
    # Check that Program Manager Main group has the icon
    assert page.query_selector('#win-group-main .prog-icon[data-open="wizard"]') is not None


