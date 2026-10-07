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
