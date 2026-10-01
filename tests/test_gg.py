"""gg/ regression suite.

A handheld theme, not a window manager -- Game Gear as a pocket Master
System (landscape color VDP, 160×144, 32/4096). Same verbs as gb/
(face buttons 1/2 map to B/A). No on-screen Select; Tab still cycles
the menu. Dictionary content itself is upstream data; we only assert
the chrome around it actually opens.
"""


def goto_gg(page, base_url, query=""):
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
    page.goto(f"{base_url}/gg/index.html{query}")
    page.wait_for_timeout(300)
    return errors, console_errors, unexpected_404s


def assert_clean(errors, console_errors, unexpected_404s):
    assert errors == []
    assert unexpected_404s == []
    real_errors = [e for e in console_errors if "404" not in e]
    assert real_errors == []


def test_loads_without_errors(page, base_url):
    errors, console_errors, unexpected_404s = goto_gg(page, base_url)
    assert_clean(errors, console_errors, unexpected_404s)
    assert page.locator("#title-screen").is_visible()
    assert page.locator(".title-logo").inner_text() == "OQ!"
    assert page.locator("#menu-screen").is_hidden()


def test_start_opens_menu(page, base_url):
    goto_gg(page, base_url)
    page.keyboard.press("Enter")
    page.wait_for_timeout(100)
    assert page.locator("#menu-screen").is_visible()
    assert page.locator("#title-screen").is_hidden()
    assert "is-selected" in page.locator("#menu-oq").get_attribute("class")


def test_menu_a_opens_oq(page, base_url):
    goto_gg(page, base_url)
    page.keyboard.press("Enter")  # title -> menu
    page.wait_for_timeout(50)
    page.keyboard.press("Enter")  # menu OQ!
    page.wait_for_timeout(100)
    assert page.locator("#oq-screen").is_visible()
    assert "screen=oq" in page.url


def test_deeplink_oq_loads_rows(page, base_url):
    goto_gg(page, base_url, "?screen=oq")
    page.wait_for_function(
        """() => {
          const s = document.getElementById('oq-status');
          return s && s.textContent && !s.textContent.includes('LOADING')
            && !s.textContent.includes('LOAD ERROR');
        }""",
        timeout=20000,
    )
    assert page.locator("#oq-screen").is_visible()
    assert page.locator(".oq-row").count() > 0
    assert "is-selected" in page.locator(".oq-row").first.get_attribute("class")
    line = page.locator(".oq-row.is-selected .oq-gloss-line").inner_text().strip()
    assert line, "selected row must show the English gloss, not just the lexeme"
    assert page.locator("#oq-balloon").count() == 0
    assert "Oqaasileriffik" in page.locator("#oq-attribution").inner_text()


def test_deeplink_oq_filter(page, base_url):
    goto_gg(page, base_url, "?screen=oq&filter=nuna")
    page.wait_for_function(
        """() => {
          const s = document.getElementById('oq-status');
          return s && s.textContent && !s.textContent.includes('LOADING');
        }""",
        timeout=20000,
    )
    assert page.locator("#oq-filter").input_value() == "nuna"
    rows = page.locator(".oq-row")
    assert rows.count() > 0
    # Matches can hit the gloss, not just the lexeme (filterDictEntries
    # searches both), and syllabify() inserts soft hyphens -- strip those
    # before looking for the query.
    blob = " ".join(rows.nth(i).inner_text() for i in range(min(rows.count(), 15)))
    blob = blob.replace("\xad", "").lower()
    assert "nuna" in blob
    assert "NO MATCHES" not in page.locator("#oq-status").inner_text()


def test_b_from_menu_returns_to_title(page, base_url):
    goto_gg(page, base_url)
    page.keyboard.press("Enter")
    page.wait_for_timeout(50)
    page.keyboard.press("Escape")
    page.wait_for_timeout(50)
    assert page.locator("#title-screen").is_visible()
    assert page.locator("#menu-screen").is_hidden()


def test_konami_code_opens_gameover(page, base_url):
    goto_gg(page, base_url)
    for key in [
        "ArrowUp",
        "ArrowUp",
        "ArrowDown",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowLeft",
        "ArrowRight",
        "b",
        "a",
    ]:
        page.keyboard.press(key)
        page.wait_for_timeout(20)
    assert page.locator("#gameover-screen").is_visible()
    assert "30 LIVES" in page.locator("#gameover-screen").inner_text()
    assert "screen=gameover" in page.url


def test_on_screen_start_opens_menu(touch_page, base_url):
    goto_gg(touch_page, base_url)
    touch_page.locator("[data-input=start]").tap()
    touch_page.wait_for_timeout(100)
    assert touch_page.locator("#menu-screen").is_visible()


def test_about_deeplink(page, base_url):
    goto_gg(page, base_url, "?screen=about")
    assert page.locator("#about-screen").is_visible()
    assert "Kalaallisut" in page.locator("#about-screen").inner_text()
    assert "WORD DECONSTRUCTOR" in page.locator("#about-screen").inner_text()


def test_search_input_is_at_least_16px(page, base_url):
    """iOS Safari auto-zooms focused inputs under 16px -- keep the floor."""
    goto_gg(page, base_url, "?screen=oq")
    size = page.locator("#oq-filter").evaluate(
        "el => parseFloat(getComputedStyle(el).fontSize)"
    )
    assert size >= 16


def test_controller_hides_while_search_focused(page, base_url):
    goto_gg(page, base_url, "?screen=oq")
    pad = page.locator(".pad-dpad")
    # launchOq focuses SEARCH on open -- pad should already be gone.
    assert pad.is_hidden()
    page.locator("#oq-filter").blur()
    page.wait_for_timeout(50)
    assert pad.is_visible()
    page.locator("#oq-filter").focus()
    page.wait_for_timeout(50)
    assert pad.is_hidden()


def test_select_cycles_menu(page, base_url):
    goto_gg(page, base_url)
    page.keyboard.press("Enter")
    page.wait_for_timeout(80)
    assert "is-selected" in page.locator("#menu-oq").get_attribute("class")
    page.keyboard.press("Tab")
    page.wait_for_timeout(40)
    assert "WORD DECONSTRUCTOR" in page.locator("#menu-decon").inner_text()
    assert "is-selected" in page.locator("#menu-decon").get_attribute("class")
    page.keyboard.press("Tab")
    page.wait_for_timeout(40)
    assert "is-selected" in page.locator("#menu-about").get_attribute("class")


def test_tab_on_title_does_not_open_menu(page, base_url):
    """Tab is Select. On the title it must not act as Start."""
    goto_gg(page, base_url)
    assert page.locator("#title-screen").is_visible()
    page.keyboard.press("Tab")
    assert page.locator("#title-screen").is_visible()
    assert page.locator("#menu-screen").is_hidden()


def test_attract_is_in_lcd_not_fullscreen(page, base_url):
    """Attract paints the LCD only -- the landscape slab stays on screen."""
    goto_gg(page, base_url)
    info = page.evaluate(
        """() => {
          const lcd = document.getElementById("gg-lcd");
          const attract = document.getElementById("gg-attract");
          const pad = document.querySelector(".pad-dpad");
          return {
            inLcd: !!(lcd && attract && lcd.contains(attract)),
            padOutside: !!(pad && attract && !attract.contains(pad) && !lcd.contains(pad)),
            w: attract && attract.width,
            h: attract && attract.height,
            hidden: attract && attract.hidden,
          };
        }"""
    )
    assert info["inLcd"]
    assert info["padOutside"]
    assert info["w"] == 160
    assert info["h"] == 144
    assert info["hidden"]
    assert page.locator(".gg-body").is_visible()
    assert page.locator(".pad-dpad").is_visible()
    assert page.locator("#title-screen").is_visible()


def test_attract_idle_then_input_dismisses(page, base_url):
    """45s idle shows the in-LCD attract; any handleInput/pad dismisses it
    without also activating Start on the title screen."""
    if not hasattr(page, "clock"):
        import pytest
        pytest.skip("playwright clock API required")
    page.clock.install()
    goto_gg(page, base_url)
    assert page.locator("#gg-attract").is_hidden()
    page.clock.fast_forward(45000)
    page.wait_for_function("() => !document.getElementById('gg-attract').hidden", timeout=2000)
    assert page.locator("#gg-attract").is_visible()
    assert page.locator(".gg-body").is_visible()
    page.keyboard.press("Enter")
    page.wait_for_function("() => document.getElementById('gg-attract').hidden", timeout=2000)
    assert page.locator("#title-screen").is_visible()
    assert page.locator("#menu-screen").is_hidden()


def test_attract_pad_dismisses(touch_page, base_url):
    if not hasattr(touch_page, "clock"):
        import pytest
        pytest.skip("playwright clock API required")
    touch_page.clock.install()
    goto_gg(touch_page, base_url)
    touch_page.clock.fast_forward(45000)
    touch_page.wait_for_function("() => !document.getElementById('gg-attract').hidden", timeout=2000)
    touch_page.locator("[data-input=start]").tap()
    touch_page.wait_for_function("() => document.getElementById('gg-attract').hidden", timeout=2000)
    assert touch_page.locator("#title-screen").is_visible()
    assert touch_page.locator("#menu-screen").is_hidden()
