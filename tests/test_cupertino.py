"""Cupertino family coverage for the native Classic Time Machine adapter."""

import pytest


def test_canonical_shell_and_aqua_compatibility_redirect(page, base_url):
    page.goto(f"{base_url}/cupertino/index.html?era=lion#desktop")
    assert "/cupertino/" in page.url
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "lion"
    page.goto(f"{base_url}/aqua/index.html?era=tiger#desktop")
    assert "/cupertino/" in page.url
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"


@pytest.mark.parametrize(
    ("theme", "skin"),
    [("mac1984", "system1"), ("mac8", "mac8")],
)
def test_classic_time_machine_is_native_to_each_skin(page, base_url, theme, skin):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{base_url}/{theme}/index.html")
    page.wait_for_timeout(1600)
    assert errors == []
    assert page.locator("#cupertino-classic-time-machine").count() == 1

    page.locator('[role="menu-bar"] > [role="menu-item"]').first.click()
    page.click("#cupertino-classic-time-machine")
    overlay = page.locator(f".cupertino-classic-tm.{skin}")
    assert overlay.is_visible()
    assert overlay.locator('[data-era="system1"]').count() == 1
    assert overlay.locator('[data-era="mac8"]').count() == 1
    assert overlay.locator('[data-era="aqua"]').count() == 1

    page.click('[data-era="mac8"]')
    assert page.locator(".cupertino-classic-tm__preview").inner_text().startswith("Mac OS 8.1")
    page.click('[data-action="restore"]')
    assert page.locator(".cupertino-classic-tm").is_hidden()
    assert page.evaluate("() => localStorage.getItem('retr-oq:cupertino-era')") == "mac8"


@pytest.mark.parametrize("theme", ["mac1984", "mac8"])
def test_classic_mac_desktop_drag_rubberband_selection(page, base_url, theme):
    page.goto(f"{base_url}/{theme}/index.html")
    page.wait_for_selector("#boot-screen.hidden", state="attached", timeout=6000)
    page.wait_for_timeout(300)
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

