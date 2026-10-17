"""itumak/ regression test suite.

Tests for Itumak Tallimat (Palm V / Vx handheld theme):
- LCD rendering and chassis
- Navigation (OQ! Dictionary, Decon, Morph, About)
- Hardware shortcut buttons & Up/Down rocker
- Silk-screened Graffiti canvas and unistroke recognition
- Virtual pixel keyboard popup (abc / 123)
- Reverse-EL Indiglo backlight toggle
- Shareable ?screen= router params
"""


def goto_itumak(page, base_url, query=""):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    unexpected_404s = []
    page.on(
        "response",
        lambda r: unexpected_404s.append(r.url)
        if r.status == 404 and not r.url.endswith("/favicon.ico")
        else None,
    )
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.goto(f"{base_url}/itumak/index.html{query}")
    page.wait_for_timeout(300)
    return errors, console_errors, unexpected_404s


def assert_clean(errors, console_errors, unexpected_404s):
    assert errors == []
    assert unexpected_404s == []
    real_errors = [e for e in console_errors if "404" not in e]
    assert real_errors == []


def test_itumak_loads_without_errors(page, base_url):
    errors, console_errors, unexpected_404s = goto_itumak(page, base_url)
    assert_clean(errors, console_errors, unexpected_404s)
    assert page.locator("#screen-oq").is_visible()
    assert page.locator("#palm-app-title").inner_text() == "OQ! Dictionary"
    assert page.locator("#palm-lcd").is_visible()
    assert page.locator("#graffiti-box").is_visible()


def test_hardware_buttons_navigation(page, base_url):
    goto_itumak(page, base_url)
    # Date Book -> Morph screen
    page.locator("#hw-btn-datebook").click()
    page.wait_for_timeout(100)
    assert page.locator("#screen-morph").is_visible()
    assert page.locator("#screen-oq").is_hidden()
    assert "screen=morph" in page.url

    # To Do -> Decon screen
    page.locator("#hw-btn-todo").click()
    page.wait_for_timeout(100)
    assert page.locator("#screen-decon").is_visible()
    assert "screen=decon" in page.url

    # Address Book -> OQ screen
    page.locator("#hw-btn-address").click()
    page.wait_for_timeout(100)
    assert page.locator("#screen-oq").is_visible()
    assert "screen=oq" in page.url


def test_backlight_toggle(page, base_url):
    goto_itumak(page, base_url)
    body = page.locator("body")
    assert "backlight-on" not in (body.get_attribute("class") or "")
    
    # Toggle Power / EL button
    page.locator("#btn-power").click()
    page.wait_for_timeout(100)
    assert "backlight-on" in page.locator("body").get_attribute("class")

    # Toggle off
    page.locator("#btn-power").click()
    page.wait_for_timeout(100)
    assert "backlight-on" not in (body.get_attribute("class") or "")


def test_virtual_keyboard_popup(page, base_url):
    goto_itumak(page, base_url)
    assert page.locator("#palm-keyboard").is_hidden()
    
    # Click dot abc
    page.locator("#dot-abc").click()
    page.wait_for_timeout(100)
    assert page.locator("#palm-keyboard").is_visible()
    assert "abc" in page.locator("#kbd-title").inner_text()

    # Close keyboard
    page.locator("#kbd-close").click()
    page.wait_for_timeout(100)
    assert page.locator("#palm-keyboard").is_hidden()
