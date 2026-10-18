"""itumak/ regression test suite.

Tests for Itumak Tallimat (Palm V / Vx handheld theme):
- LCD rendering and chassis
- Navigation (OQ! Dictionary, Decon, Morph, About)
- Hardware shortcut buttons & Up/Down rocker
- Silk-screened Graffiti canvas and unistroke recognition
- Virtual pixel keyboard popup (abc / 123)
- Reverse-EL Indiglo backlight toggle
- Shareable ?screen= router params
- Lexeme (headword) and English gloss (translation) rendering
"""


def goto_itumak(page, base_url, query=""):
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


FIXTURE_ENTRIES = [
    {"lexeme": "illu", "gloss_en": "house"},
    {"lexeme": "nuna", "gloss_en": "land"},
    {"lexeme": "qajaq", "gloss_en": "kayak"},
]


def mock_dict_source(page):
    page.route(
        "**/Oqaasileriffik-dicts/all_entries.json",
        lambda route: route.fulfill(
            json={"dictionary_entries": FIXTURE_ENTRIES}
        ),
    )
    page.route(
        "**/Oqaasileriffik-katersat/**",
        lambda route: route.abort("failed"),
    )


def test_dictionary_renders_lexeme_and_gloss(page, base_url):
    mock_dict_source(page)
    goto_itumak(page, base_url, "?screen=oq")
    page.wait_for_function(
        """() => {
          const s = document.getElementById('oq-status');
          return s && s.textContent && !s.textContent.includes('Loading')
            && !s.textContent.includes('Error');
        }""",
        timeout=15000,
    )
    items = page.locator(".palm-list-item")
    assert items.count() > 0

    first_item = items.first
    headword = first_item.locator(".palm-item-headword").inner_text().strip()
    gloss = first_item.locator(".palm-item-gloss").inner_text().strip()
    assert headword, "headword must show the Kalaallisut lexeme"
    assert gloss, "gloss must show the translation"


def test_rocker_scrolling(page, base_url):
    mock_dict_source(page)
    goto_itumak(page, base_url, "?screen=oq")
    page.wait_for_function(
        """() => {
          const s = document.getElementById('oq-status');
          return s && s.textContent && !s.textContent.includes('Loading');
        }""",
        timeout=15000,
    )
    items = page.locator(".palm-list-item")
    assert items.count() > 1
    assert "selected" in (items.nth(0).get_attribute("class") or "")

    # Click rocker down
    page.locator("#hw-rocker-down").click()
    page.wait_for_timeout(100)
    assert "selected" in (items.nth(1).get_attribute("class") or "")

    # Click rocker up
    page.locator("#hw-rocker-up").click()
    page.wait_for_timeout(100)
    assert "selected" in (items.nth(0).get_attribute("class") or "")


def test_graffiti_stroke_recognition(page, base_url):
    goto_itumak(page, base_url, "?screen=oq")
    canvas = page.locator("#graffiti-canvas")
    box = canvas.bounding_box()
    assert box is not None

    # Simulate horizontal right swipe (Space) in letters zone: x from 20 to 60, y around 25
    start_x = box["x"] + 20
    start_y = box["y"] + 25
    end_x = box["x"] + 65
    end_y = box["y"] + 25

    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(end_x, end_y, steps=5)
    page.mouse.up()
    page.wait_for_timeout(150)

    # Indicator should have shown space (␣)
    assert page.locator("#graffiti-indicator").is_visible() or page.locator("#oq-filter").input_value().endswith(" ")
