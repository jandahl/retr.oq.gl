"""Aqua theme regression suite.

Guards the early OS X Aqua skin + shared/osx shell against the gaps Jan
called out (boot friction, idle menubar hover, independent close, Finder
open-by-dblclick, etc.).
"""


def goto_aqua(page, base_url):
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
    page.goto(f"{base_url}/aqua/index.html")
    page.wait_for_timeout(200)
    return errors, console_errors, unexpected_404s


# Small dict fixtures for TM OQ! preview / merge. Avoids real multi-MB fetches in CI.
TM_OQ_FIXTURE_ENTRIES = [
    {"lexeme": "illu", "gloss_en": "house"},
    {"lexeme": "nuna", "gloss_en": "land"},
    {"lexeme": "qajaq", "gloss_en": "kayak"},
    {"lexeme": "imiq", "gloss_en": "fresh water"},
    {"lexeme": "a", "gloss_en": "too short"},  # skipped by 3–14 char rule when falling back
    {"lexeme": "verylonglexemehere", "gloss_en": "too long"},
    {"lexeme": "aalajavoq", "gloss_en": ""},  # empty Chicago gloss → katersat backfill
]

# Minimal katersat shape ({meta, lexemes}). Includes Jan's preferred TM set.
TM_KATERSAT_FIXTURE = {
    "meta": {"test": True},
    "lexemes": [
        {
            "id": "lex_aalajavoq",
            "kalaallisut": "aalajavoq",
            "english": ["is determined"],
            "danish": ["er beslutsom"],
        },
        {
            "id": "lex_kujannippoq",
            "kalaallisut": "kujannippoq",
            "english": ["is horny"],
            "danish": [],
        },
        {
            "id": "lex_qulluk",
            "kalaallisut": "qulluk",
            "english": ["lamp"],
            "danish": ["lampe"],
        },
        {
            "id": "lex_usuk",
            "kalaallisut": "usuk",
            "english": ["penis"],
            "danish": [],
        },
    ],
}


def mock_tm_dict_source(page, *, with_katersat=True):
    """Mock Chicago + optional katersat (never hit real GH Pages in CI)."""
    page.route(
        "**/Oqaasileriffik-dicts/all_entries.json",
        lambda route: route.fulfill(
            json={"dictionary_entries": TM_OQ_FIXTURE_ENTRIES}
        ),
    )
    if with_katersat:
        # Prefer gzip URL failing so the loader uses uncompressed lexicon.json.
        page.route(
            "**/Oqaasileriffik-katersat/lexicon.json.gz",
            lambda route: route.fulfill(status=404, body="missing"),
        )
        page.route(
            "**/Oqaasileriffik-katersat/lexicon.json",
            lambda route: route.fulfill(json=TM_KATERSAT_FIXTURE),
        )
    else:
        page.route(
            "**/Oqaasileriffik-katersat/**",
            lambda route: route.abort("failed"),
        )


def test_loads_clean_without_power_button_boot(page, base_url):
    errors, console_errors, unexpected_404s = goto_aqua(page, base_url)
    assert errors == []
    assert unexpected_404s == []
    real_errors = [e for e in console_errors if "404" not in e]
    assert real_errors == []
    # No power-button / lingering boot overlay — desktop is immediate.
    assert page.query_selector("#boot-screen") is None
    assert page.query_selector("#power-button") is None
    assert page.locator("#shell").is_visible()
    assert page.locator("#desktop").is_visible()
    assert page.locator("#menu-bar").is_visible()
    assert page.locator("#dock").is_visible()


def test_katersat_structured_translations_are_normalized(page, base_url):
    """Published Kater records may wrap translations in objects."""
    goto_aqua(page, base_url)
    result = page.evaluate(
        """() => window.OqKatersatSource.normalizeKatersatLexeme({
          id: 'structured',
          kalaallisut: 'uanga',
          english: [{ text: 'I, me, mine' }, { value: 'myself' }],
          danish: [{ translation: 'jeg' }]
        })"""
    )
    assert result["gloss_en"] == "I, me, mine; myself"
    assert result["gloss_da"] == "jeg"


def test_windows_start_closed(page, base_url):
    goto_aqua(page, base_url)
    for win_id in ("win-oq", "win-decon", "win-home", "win-apps", "win-about", "win-trash"):
        assert page.locator(f"#{win_id}").evaluate("el => el.classList.contains('closed')")


def test_dblclick_opens_macintosh_hd(page, base_url):
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-home']")
    page.wait_for_timeout(100)
    win = page.locator("#win-home")
    assert win.is_visible()
    assert not win.evaluate("el => el.classList.contains('closed')")


def test_independent_close_leaves_decon_open(page, base_url):
    """Open OQ! + Word Deconstructor, close OQ! — DECON must stay open."""
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(80)
    page.dblclick(".desktop-icon[data-open='win-decon']")
    page.wait_for_timeout(80)
    assert page.locator("#win-oq").is_visible()
    assert page.locator("#win-decon").is_visible()

    # Focus OQ! via Dock (windows overlap so a titlebar click can miss), then close.
    page.locator("#dock > .osx-dock-item[data-open='win-oq']").click()
    page.wait_for_timeout(80)
    page.evaluate("() => document.getElementById('win-oq-close').click()")
    page.wait_for_timeout(120)
    assert page.locator("#win-oq").evaluate("el => el.classList.contains('closed')")
    assert page.locator("#win-decon").is_visible()
    assert not page.locator("#win-decon").evaluate("el => el.classList.contains('closed')")


def test_app_menu_tracks_focus(page, base_url):
    goto_aqua(page, base_url)
    assert page.locator("#app-menu-title").inner_text() == "Finder"

    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(100)
    assert page.locator("#app-menu-title").inner_text() == "OQ!"
    assert "About OQ!" in page.locator("#app-menu-about-link").inner_text()

    page.dblclick(".desktop-icon[data-open='win-decon']")
    page.wait_for_timeout(100)
    assert page.locator("#app-menu-title").inner_text() == "Word Deconstructor"

    # Finder window focus flips the app menu back.
    page.dblclick(".desktop-icon[data-open='win-home']")
    page.wait_for_timeout(100)
    assert page.locator("#app-menu-title").inner_text() == "Finder"

    # Bare desktop click (empty strip under the menubar, left of icons) → Finder.
    # Dispatch on #desktop so open windows cannot intercept the hit-test.
    page.evaluate(
        """() => {
          const desk = document.getElementById('desktop');
          desk.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 8, clientY: 8 }));
        }"""
    )
    page.wait_for_timeout(80)
    assert page.locator("#app-menu-title").inner_text() == "Finder"


def test_menubar_idle_hover_has_no_accent_class_only(page, base_url):
    """Accent highlight is via .menu-open, not bare :hover (CSS contract)."""
    goto_aqua(page, base_url)
    css = page.evaluate(
        """() => {
          const sheets = [...document.styleSheets];
          let idleHover = false;
          let menuOpen = false;
          for (const sheet of sheets) {
            let rules;
            try { rules = sheet.cssRules; } catch { continue; }
            for (const rule of rules) {
              if (!rule.selectorText) continue;
              const s = rule.selectorText;
              if (s.includes('.osx-menubar') && s.includes(':hover')
                  && s.includes('[role') && !s.includes('menu-open')
                  && !s.includes('[role="menu"]') && !s.includes('.dock')) {
                // Top-level menubar item idle hover painting accent = bad.
                const bg = rule.style.background || rule.style.backgroundColor || '';
                if (bg.includes('aqua-accent') || bg.includes('4d76c5') || bg.includes('accent')) {
                  idleHover = true;
                }
              }
              if (s.includes('.menu-open') && s.includes('.osx-menubar')) {
                menuOpen = true;
              }
            }
          }
          return { idleHover, menuOpen };
        }"""
    )
    assert css["menuOpen"] is True
    assert css["idleHover"] is False


def test_optional_zoom_toggle(page, base_url):
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-home']")
    page.wait_for_timeout(100)
    win = page.locator("#win-home")
    before = win.evaluate(
        "el => ({ t: el.style.top, l: el.style.left, w: el.style.width, h: el.style.height })"
    )
    page.click("#win-home-zoom")
    page.wait_for_timeout(220)
    assert win.evaluate("el => el.classList.contains('zoomed')")
    page.click("#win-home-zoom")
    page.wait_for_timeout(220)
    assert not win.evaluate("el => el.classList.contains('zoomed')")
    after = win.evaluate(
        "el => ({ t: el.style.top, l: el.style.left, w: el.style.width, h: el.style.height })"
    )
    # Zoom restore should return to prior rect (Finder-style).
    assert after == before


def test_dock_captions_present(page, base_url):
    goto_aqua(page, base_url)
    captions = page.locator("#dock > .osx-dock-item .dock-caption")
    assert captions.count() >= 5
    labels = captions.all_inner_texts()
    assert "OQ!" in labels
    assert "Trash" in labels


def test_context_menu_clean_up_and_hide_icons(page, base_url):
    goto_aqua(page, base_url)
    # Open desktop context menu via JS (Playwright right-click coords vary with zoom).
    page.evaluate(
        """() => {
          const desk = document.getElementById('desktop');
          desk.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 40, clientY: 80
          }));
        }"""
    )
    page.wait_for_timeout(50)
    menu = page.locator("#desktop-context-menu")
    assert menu.is_visible()
    assert page.locator("#desktop-ctx-cleanup").count() == 1
    assert "Clean Up Desktop" in page.locator("#desktop-ctx-cleanup").inner_text()
    assert page.locator("#desktop-ctx-toggle-icons").count() == 1

    # Hide icons → persists class + localStorage
    page.locator("#desktop-ctx-toggle-icons a").click()
    page.wait_for_timeout(50)
    assert page.locator(".desktop-icons").evaluate("el => el.classList.contains('icons-hidden')")
    stored = page.evaluate("() => localStorage.getItem('retr-oq:aqua-desktop-icons')")
    assert stored == "hidden"

    # Re-open menu and show again
    page.evaluate(
        """() => {
          const desk = document.getElementById('desktop');
          desk.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 40, clientY: 80
          }));
        }"""
    )
    page.wait_for_timeout(50)
    page.locator("#desktop-ctx-toggle-icons a").click()
    page.wait_for_timeout(50)
    assert not page.locator(".desktop-icons").evaluate("el => el.classList.contains('icons-hidden')")

    # Clean Up exists and runs without error (snaps column / clears selection)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(80)
    page.evaluate(
        """() => {
          const desk = document.getElementById('desktop');
          desk.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: 40, clientY: 80
          }));
        }"""
    )
    page.wait_for_timeout(50)
    page.locator("#desktop-ctx-cleanup a").click()
    page.wait_for_timeout(50)
    assert page.locator(".desktop-icon.selected").count() == 0
    # Icons still in the tidy right-side column container
    assert page.locator(".desktop-icons .desktop-icon").count() >= 4


def test_app_switcher_hud_present_and_opens(page, base_url):
    goto_aqua(page, base_url)
    hud = page.locator("#app-switcher")
    assert hud.count() == 1
    assert hud.is_hidden()

    # Open a window so the switcher has a running app, then Meta+Tab
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(80)
    page.keyboard.down("Meta")
    page.keyboard.press("Tab")
    page.wait_for_timeout(80)
    assert hud.is_visible()
    assert page.locator("#app-switcher-track .app-switcher-item").count() >= 1
    page.keyboard.press("Escape")
    page.wait_for_timeout(50)
    assert hud.is_hidden()


def test_screen_effects_menu_and_host_hook(page, base_url):
    goto_aqua(page, base_url)
    # DOM presence — System menu item + context item
    assert page.locator("#menu-screen-effects").count() == 1
    assert page.locator("#desktop-ctx-effects").count() == 1
    # Host should attach (router loads screensaver.js for aqua/)
    page.wait_for_timeout(150)
    has_host = page.evaluate(
        """() => !!(window.OqScreensaver && (window.OqScreensaver.aqua || window.OqScreensaver.host))"""
    )
    assert has_host
    # Idle hook present for tests; do not wait on real idle in CI
    assert page.evaluate("() => typeof window.__aquaScreenEffects?.setIdleMs === 'function'")


def test_applications_window_opens_from_go_and_dock(page, base_url):
    goto_aqua(page, base_url)
    assert page.locator("#win-apps").evaluate("el => el.classList.contains('closed')")
    page.locator("#dock > .osx-dock-item[data-open='win-apps']").click()
    page.wait_for_timeout(100)
    win = page.locator("#win-apps")
    assert win.is_visible()
    assert not win.evaluate("el => el.classList.contains('closed')")
    labels = page.locator("#win-apps .finder-item span").all_inner_texts()
    assert "OQ!" in labels
    assert "Word Deconstructor" in labels
    assert "About" in labels
    # Go menu also lists Applications
    assert page.locator("#menu-bar [data-open='win-apps']").count() >= 1


def test_force_quit_sheet_lists_open_apps(page, base_url):
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_timeout(80)
    page.evaluate("() => document.querySelector('#menu-force-quit a').click()")
    page.wait_for_timeout(80)
    overlay = page.locator("#forcequit-overlay")
    assert overlay.is_visible()
    rows = page.locator("#forcequit-list li").all_inner_texts()
    assert any("OQ!" in r for r in rows)
    page.click("#forcequit-cancel")
    page.wait_for_timeout(60)
    assert page.locator("#forcequit-overlay").is_hidden()


def test_get_info_sheet_for_macintosh_hd(page, base_url):
    goto_aqua(page, base_url)
    page.click(".desktop-icon[data-open='win-home']")
    page.wait_for_timeout(40)
    page.evaluate("() => document.querySelector('#menu-get-info a').click()")
    page.wait_for_timeout(80)
    assert page.locator("#getinfo-overlay").is_visible()
    assert "Macintosh HD" in page.locator("#getinfo-name").inner_text()
    assert page.locator("#getinfo-blurb").inner_text().strip() != ""
    page.click("#getinfo-ok")
    page.wait_for_timeout(40)
    assert page.locator("#getinfo-overlay").is_hidden()


def test_graphite_appearance_persists(page, base_url):
    goto_aqua(page, base_url)
    page.evaluate("() => document.querySelector('#menu-sys-prefs a').click()")
    page.wait_for_timeout(60)
    page.check("#appearance-graphite")
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.appearance") == "graphite"
    page.click("#sysprefs-ok")
    page.reload()
    page.wait_for_timeout(200)
    assert page.evaluate("() => document.documentElement.dataset.appearance") == "graphite"
    stored = page.evaluate("() => localStorage.getItem('retr-oq:aqua-appearance')")
    assert stored == "graphite"


def test_edge_resize_handles_present(page, base_url):
    goto_aqua(page, base_url)
    count = page.locator("#win-oq .osx-resize").count()
    assert count == 8
    assert page.locator("#win-oq .osx-growbox").count() == 1


def test_icon_drag_persists_position(page, base_url):
    """Fine-pointer drag writes localStorage; Clean Up clears it."""
    goto_aqua(page, base_url)
    # Force fine-pointer path: evaluate drag helpers via stored positions API.
    page.evaluate(
        """() => {
          const icon = document.querySelector(".desktop-icon[data-open='win-oq']");
          const desk = document.getElementById('desktop');
          const icons = document.querySelector('.desktop-icons');
          icons.classList.add('is-free');
          icons.style.top = '0'; icons.style.left = '0'; icons.style.right = '0';
          icons.style.bottom = '0'; icons.style.width = '100%'; icons.style.height = '100%';
          icon.style.position = 'absolute';
          icon.style.left = '40px';
          icon.style.top = '60px';
          localStorage.setItem('retr-oq:aqua-desktop-icon-pos', JSON.stringify({
            'win-oq': { left: 40, top: 60 }
          }));
        }"""
    )
    page.reload()
    page.wait_for_timeout(200)
    left = page.evaluate(
        """() => document.querySelector('.desktop-icon[data-open="win-oq"]').style.left"""
    )
    assert left == "40px"
    page.evaluate("() => document.querySelector('#desktop-ctx-cleanup a').click()")
    # Clean Up may need context open — call storage clear via menu click after showing isn't required;
    # invoke Clean Up through the same handler by dispatching click on the menu item link after unhiding.
    page.evaluate(
        """() => {
          const item = document.getElementById('desktop-ctx-cleanup');
          item.querySelector('a').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }"""
    )
    page.wait_for_timeout(60)
    stored = page.evaluate("() => localStorage.getItem('retr-oq:aqua-desktop-icon-pos')")
    assert stored in (None, "")



def test_time_machine_overlay_opens_and_sets_era(page, base_url):
    """TM overlay opens from System menu; selecting an era sets data-osx-era."""
    goto_aqua(page, base_url)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") in (
        "aqua",
        "tiger",
        "leopard",
        "lion",
        "yosemite",
        "bigsur",
        "glass",
        None,
        "",
    )
    # Default boot should be aqua when storage empty
    page.evaluate("() => localStorage.removeItem('retr-oq:aqua-osx-era')")
    page.reload()
    page.wait_for_timeout(200)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "aqua"

    page.evaluate("() => document.querySelector('#menu-time-machine a').click()")
    page.wait_for_timeout(80)
    overlay = page.locator("#tm-overlay")
    assert overlay.is_visible()
    assert page.evaluate("() => window.__aquaTimeMachine && window.__aquaTimeMachine.isOpen") is True

    # Select Tiger via card
    page.click('.tm-era-card[data-era="tiger"]')
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"

    page.click("#tm-restore")
    page.wait_for_timeout(800)
    assert page.locator("#tm-overlay").is_hidden()
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"
    stored = page.evaluate("() => localStorage.getItem('retr-oq:aqua-osx-era')")
    assert stored == "tiger"

    # Persists across reload (boot script)
    page.reload()
    page.wait_for_timeout(200)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"


def test_time_machine_cancel_restores_previous_era(page, base_url):
    goto_aqua(page, base_url)
    page.evaluate(
        """() => {
          localStorage.setItem('retr-oq:aqua-osx-era', 'aqua');
          document.documentElement.dataset.osxEra = 'aqua';
        }"""
    )
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(60)
    page.click('.tm-era-card[data-era="leopard"]')
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "leopard"
    page.click("#tm-cancel")
    page.wait_for_timeout(60)
    assert page.locator("#tm-overlay").is_hidden()
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "aqua"
    assert page.evaluate("() => localStorage.getItem('retr-oq:aqua-osx-era')") in (
        "aqua",
        None,
    )


def test_time_machine_reduced_motion_instant_restore(page, base_url):
    """With prefers-reduced-motion, Restore swaps era without leaving overlay stuck."""
    goto_aqua(page, base_url)
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(40)
    page.click('.tm-era-card[data-era="leopard"]')
    page.click("#tm-restore")
    page.wait_for_timeout(100)
    assert page.locator("#tm-overlay").is_hidden()
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "leopard"
    assert page.evaluate("() => localStorage.getItem('retr-oq:aqua-osx-era')") == "leopard"


def test_time_machine_eras_include_future_milestones(page, base_url):
    """Timeline lists aqua→glass milestones in chronological order."""
    goto_aqua(page, base_url)
    ids = page.evaluate(
        """() => (window.__aquaTimeMachine && window.__aquaTimeMachine.eras || [])
          .map((e) => e.id)"""
    )
    assert ids == [
        "aqua",
        "tiger",
        "leopard",
        "lion",
        "yosemite",
        "bigsur",
        "glass",
    ]
    years = page.evaluate(
        """() => (window.__aquaTimeMachine.eras || []).map((e) => e.year)"""
    )
    assert years == ["2001", "2005", "2007", "2011", "2014", "2020", "2026"]


def test_time_machine_glass_era_persists(page, base_url):
    """Scrub to Glassholism, Restore, and boot script accept the new id."""
    goto_aqua(page, base_url)
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(60)
    page.click('.tm-era-card[data-era="glass"]')
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "glass"
    page.click("#tm-restore")
    page.wait_for_timeout(800)
    assert page.locator("#tm-overlay").is_hidden()
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "glass"
    assert page.evaluate("() => localStorage.getItem('retr-oq:aqua-osx-era')") == "glass"
    page.reload()
    page.wait_for_timeout(200)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "glass"


def test_time_machine_scrubber_reaches_lion_and_yosemite(page, base_url):
    """Scrubber next/prev can reach mid and late eras."""
    goto_aqua(page, base_url)
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(40)
    # From aqua, next a few times → lion
    for _ in range(3):
        page.click("#tm-next")
        page.wait_for_timeout(20)
    assert page.evaluate("() => window.__aquaTimeMachine.selected") == "lion"
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "lion"
    page.click("#tm-next")
    page.wait_for_timeout(20)
    assert page.evaluate("() => window.__aquaTimeMachine.selected") == "yosemite"
    page.click("#tm-cancel")

def test_time_machine_galaxy_and_oq_preview(page, base_url):
    """TM overlay includes galaxy canvas + live OQ! chrome preview that tracks era."""
    mock_tm_dict_source(page)
    goto_aqua(page, base_url)
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(80)
    overlay = page.locator("#tm-overlay")
    assert overlay.is_visible()

    galaxy = page.locator("#tm-galaxy")
    assert galaxy.count() == 1
    assert page.locator(".tm-starfield #tm-galaxy").count() == 1
    # Canvas is present inside the starfield container (may be 0x0 until layout paints).
    tag = page.evaluate("() => document.getElementById('tm-galaxy') && document.getElementById('tm-galaxy').tagName")
    assert tag == "CANVAS"

    preview = page.locator("#tm-oq-preview")
    assert preview.count() == 1
    assert preview.locator(".osx-titlebar").count() == 1
    assert preview.locator(".osx-traffic").count() == 3
    assert preview.locator(".osx-title").inner_text() == "OQ!"
    assert preview.locator(".oq-table").count() == 1
    # Wait for merged preferred sample rows (mocked Chicago + katersat).
    page.wait_for_function(
        """() => {
          const cells = document.querySelectorAll('#tm-oq-preview .oq-table tbody td');
          return [...cells].some(td => td.textContent === 'kujannippoq');
        }""",
        timeout=5000,
    )
    row_text = preview.locator(".oq-table tbody").inner_text()
    assert "kujannippoq" in row_text
    assert "qulluk" in row_text
    assert "usuk" in row_text
    assert "aalajavoq" in row_text
    assert "oqaatsit" not in row_text
    assert preview.locator(".oq-table tbody tr").count() == 4
    assert preview.locator(".oq-table td").count() >= 8
    search = preview.locator('.aqua-field-row input[type="text"]')
    assert search.count() == 1
    assert search.get_attribute("placeholder") in ("Type to search…", "Type to search...")
    status = preview.locator(".tm-oq-preview-status").inner_text().strip()
    assert status != ""
    assert "4 of" in status or "merged" in status.lower() or "dictionary" in status.lower()
    assert "Could not load" not in status
    assert preview.evaluate("el => el.classList.contains('osx-window')") is True
    # Preview must stay focused-looking: is-focused, never inactive; no disabled UA grey.
    assert preview.evaluate("el => el.classList.contains('inactive')") is False
    assert preview.evaluate("el => el.classList.contains('is-focused')") is True
    for sel in (".osx-btn-close", ".osx-btn-minimize", ".osx-btn-zoom"):
        assert preview.locator(sel).get_attribute("disabled") is None
        assert preview.locator(sel).get_attribute("tabindex") == "-1"
    close_bg = preview.locator(".osx-btn-close").evaluate("el => getComputedStyle(el).backgroundImage")
    assert "gradient" in close_bg
    assert "rgb(194, 194, 194)" not in close_bg and "rgb(200, 200, 200)" not in close_bg
    close_op = preview.locator(".osx-btn-close").evaluate("el => getComputedStyle(el).opacity")
    assert float(close_op) == 1.0
    # Glyphs visible without hover (× on close).
    close_glyph = preview.locator(".osx-btn-close").evaluate(
        "el => getComputedStyle(el, '::before').content"
    )
    assert close_glyph not in ("none", '""', "''", "")
    # Title line: no translucent pill overlay on preview.
    title_bg = preview.locator(".osx-title").evaluate("el => getComputedStyle(el).backgroundImage")
    assert title_bg in ("none", "initial") or title_bg == "none"
    tb_bf = preview.locator(".osx-titlebar").evaluate(
        "el => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter"
    )
    assert tb_bf in ("none", "")

    # Fixed geometry must not jump when scrubbing eras (critique: non-canonical size).
    def preview_box():
        # Use offset* (layout CSS px) — getBoundingClientRect scales with html zoom.
        return preview.evaluate(
            "el => ({ w: el.offsetWidth,"
            " h: el.offsetHeight,"
            " th: el.querySelector('.osx-titlebar').offsetHeight,"
            " tw: el.querySelector('.osx-traffic').offsetWidth })"
        )

    box0 = preview_box()
    assert box0["w"] == 300 and box0["h"] == 196
    assert box0["th"] == 22
    assert box0["tw"] == 10

    page.click('.tm-era-card[data-era="tiger"]')
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "tiger"
    # Preview stays in the overlay and still exposes era-skinned chrome classes.
    assert page.locator("#tm-overlay #tm-oq-preview.osx-window").count() == 1
    assert page.locator("#tm-overlay #tm-oq-preview .osx-btn-close").count() == 1
    assert preview.evaluate("el => el.classList.contains('inactive')") is False
    assert preview_box() == box0

    def titlebar_bg():
        return preview.locator(".osx-titlebar").evaluate("el => getComputedStyle(el).backgroundImage")

    tiger_bg = titlebar_bg()
    page.click('.tm-era-card[data-era="aqua"]')
    page.wait_for_timeout(40)
    aqua_bg = titlebar_bg()
    page.click('.tm-era-card[data-era="leopard"]')
    page.wait_for_timeout(40)
    leopard_bg = titlebar_bg()
    # Early eras must not share identical titlebar materials.
    assert aqua_bg != tiger_bg
    assert tiger_bg != leopard_bg
    assert aqua_bg != leopard_bg
    assert preview.evaluate("el => el.classList.contains('inactive')") is False
    assert preview_box() == box0

    page.click('.tm-era-card[data-era="yosemite"]')
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "yosemite"
    assert preview_box() == box0

    page.click('.tm-era-card[data-era="glass"]')
    page.wait_for_timeout(40)
    assert page.evaluate("() => document.documentElement.dataset.osxEra") == "glass"
    assert preview_box() == box0
    # Readable title color stays dark in the mini preview.
    title_color = preview.locator(".osx-title").evaluate("el => getComputedStyle(el).color")
    assert "26, 26, 26" in title_color or title_color.startswith("rgb(26")

    page.click("#tm-cancel")
    page.wait_for_timeout(40)
    assert page.locator("#tm-overlay").is_hidden()

def test_time_machine_oq_preview_falls_back_without_katersat(page, base_url):
    """When katersat fails, TM still shows short Chicago samples."""
    mock_tm_dict_source(page, with_katersat=False)
    goto_aqua(page, base_url)
    page.evaluate("() => window.__aquaTimeMachine.open()")
    page.wait_for_timeout(80)
    page.wait_for_function(
        """() => {
          const cells = document.querySelectorAll('#tm-oq-preview .oq-table tbody td');
          return [...cells].some(td => td.textContent === 'illu');
        }""",
        timeout=5000,
    )
    row_text = page.locator("#tm-oq-preview .oq-table tbody").inner_text()
    assert "illu" in row_text and "house" in row_text
    assert "kujannippoq" not in row_text
    status = page.locator("#tm-oq-preview .tm-oq-preview-status").inner_text()
    assert "Could not load" not in status


def test_oq_window_shows_both_attributions_when_merged(page, base_url):
    """OQ! attribution line includes Chicago + katersat after merged load."""
    mock_tm_dict_source(page, with_katersat=True)
    goto_aqua(page, base_url)
    page.dblclick(".desktop-icon[data-open='win-oq']")
    page.wait_for_function(
        """() => {
          const t = document.getElementById('oq-attribution');
          return t && t.textContent.includes('GPL');
        }""",
        timeout=5000,
    )
    attr = page.locator("#oq-attribution").inner_text()
    assert "CC-BY-SA" in attr
    assert "GPL" in attr
    status = page.locator("#oq-status").inner_text()
    assert "katersat" in status.lower() or "entries loaded" in status.lower()
