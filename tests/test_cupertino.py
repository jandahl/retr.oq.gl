"""Cupertino family coverage for unified Classic + OS X skins and redirects."""

import pytest


def test_canonical_shell_and_compatibility_redirects(page, base_url):
    page.goto(f"{base_url}/cupertino/index.html?era=lion#desktop")
    assert "/cupertino/" in page.url
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "lion"

    page.goto(f"{base_url}/aqua/index.html?era=tiger#desktop")
    assert "/cupertino/" in page.url
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"

    page.goto(f"{base_url}/mac1984/index.html")
    assert "/cupertino/" in page.url
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "system1"
    assert page.evaluate("() => localStorage.getItem('retr-oq:cupertino-era')") == "system1"

    page.goto(f"{base_url}/mac8/index.html")
    assert "/cupertino/" in page.url
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "mac8"
    assert page.evaluate("() => localStorage.getItem('retr-oq:cupertino-era')") == "mac8"


@pytest.mark.parametrize("era", ["system1", "mac8"])
def test_classic_eras_in_cupertino_hide_dock_and_persist(page, base_url, era):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{base_url}/cupertino/index.html")
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(40)
    page.click(f'.tm-era-card[data-era="{era}"]')
    page.click("#tm-restore")
    page.wait_for_timeout(100)
    assert errors == []
    assert page.locator("#tm-overlay").is_hidden()
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == era
    assert page.evaluate("() => localStorage.getItem('retr-oq:cupertino-era')") == era
    assert page.locator("#dock").is_hidden()

    # Reload without query parameter: Cupertino remembers the Classic era.
    page.goto(f"{base_url}/cupertino/index.html")
    page.wait_for_timeout(100)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == era
    assert page.locator("#dock").is_hidden()


@pytest.mark.parametrize("era", ["system1", "mac8"])
def test_classic_mac_desktop_drag_rubberband_selection(page, base_url, era):
    page.goto(f"{base_url}/cupertino/index.html?era={era}")
    page.wait_for_timeout(200)
    viewport = page.viewport_size
    start_x = viewport["width"] - 220
    end_x = viewport["width"] - 10
    page.mouse.move(start_x, 60)
    page.mouse.down()
    page.mouse.move(end_x, 300)
    marquee = page.query_selector(".desktop-marquee")
    assert marquee is not None
    page.mouse.up()
    page.wait_for_timeout(100)
    assert page.query_selector(".desktop-marquee") is None

    selected = page.query_selector_all(".desktop-icon.selected")
    assert len(selected) >= 1


def test_amiga_desktop_drag_rubberband_selection(page, base_url):
    page.goto(f"{base_url}/amiga/index.html")
    page.wait_for_selector("#boot-screen.is-done", state="attached", timeout=6000)
    page.wait_for_timeout(300)
    # Start on empty space next to icons (icons left edge ~10, right edge ~98)
    page.mouse.move(140, 50)
    page.mouse.down()
    page.mouse.move(5, 200)
    marquee = page.query_selector(".desktop-marquee")
    assert marquee is not None
    page.mouse.up()
    page.wait_for_timeout(100)
    assert page.query_selector(".desktop-marquee") is None

    selected = page.query_selector_all(".desktop-icon.is-selected")
    assert len(selected) >= 1
