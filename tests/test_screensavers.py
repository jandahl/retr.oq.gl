"""Screensaver host regressions.

Guards the bugs that shipped while wiring vendored remakes into the
Redmond / KDE desks:

- Nested overlay iframes composite WebGL as a black rectangle in a live
  preview, so start() navigates this document with ?oqret= when nested.
- Top-level (GitHub Pages, this Playwright suite) still uses the overlay
  iframe host. Unhide before setting iframe src so GL is not 0×0.
- ss-exit.js returns to the launching desk on click/key when ?oqret= is
  present, and does NOT arm inside KDE's settings thumbnail.
- XP Start → Screen Savers is Backrooms II (not the 98 maze). Win98
  keeps maze-backrooms. KDE does not grow either.
- Saver pages load Three.js from vendor/screensavers/lib/, not a CDN.
"""

import re

import pytest

KDE_GL = [
    "flux",
    "euphoria",
    "solarwinds",
    "helios",
    "lattice",
    "hyperspace",
    "cyclone",
    "fieldlines",
    "flocks",
    "pixelcity",
    "lorenz",
    "glmatrix",
    "skyrocket",
]


def goto_desk(page, base_url, theme):
    page.goto(f"{base_url}/{theme}/?nosplash=1")
    page.wait_for_function(
        "() => window.OqScreensaver && (window.OqScreensaver.host || window.OqScreensaver.kde)",
        timeout=8000,
    )


def flyout_labels(page):
    return page.evaluate(
        """() => [...document.querySelectorAll(".start-menu-flyout .start-menu-item")]
            .map((el) => el.textContent.replace(/\\s+/g, " ").trim())"""
    )


def click_flyout(page, label):
    page.evaluate(
        """(text) => {
          const hit = [...document.querySelectorAll(".start-menu-flyout .start-menu-item")]
            .find((el) => el.textContent.replace(/\\s+/g, " ").trim() === text);
          if (!hit) throw new Error("missing flyout item " + text);
          hit.click();
        }""",
        label,
    )


def wait_overlay_saver(page, needle):
    page.wait_for_selector("#oq-ss-overlay:not([hidden])", timeout=8000)
    page.wait_for_function(
        """(needle) => {
          const frame = document.querySelector("#oq-ss-overlay iframe");
          const src = (frame && frame.getAttribute("src")) || "";
          return src.indexOf(needle) !== -1;
        }""",
        arg=needle,
        timeout=8000,
    )
    frame = page.frame_locator("#oq-ss-overlay iframe")
    frame.locator("canvas").first.wait_for(timeout=8000)
    size = page.evaluate(
        """() => {
          const frame = document.querySelector("#oq-ss-overlay iframe");
          const c = frame && frame.contentDocument && frame.contentDocument.querySelector("canvas");
          return c
            ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, src: frame.src }
            : { src: frame && frame.src };
        }"""
    )
    assert size.get("w", 0) >= 200 or size.get("cw", 0) >= 200
    return size


def dismiss_overlay(page):
    page.wait_for_timeout(900)
    page.mouse.click(420, 320)
    page.wait_for_selector("#oq-ss-overlay", state="hidden", timeout=8000)


def test_xp_menu_is_pipes_and_backrooms_ii(page, base_url):
    goto_desk(page, base_url, "xp")
    labels = flyout_labels(page)
    assert labels == ["3D Pipes", "Backrooms II"]
    url = page.evaluate("() => window.OqScreensaver.host.launchUrl()")
    assert "pipes" in url
    assert "oqret=" in url


def test_win98_menu_keeps_1998_backrooms(page, base_url):
    goto_desk(page, base_url, "win98")
    labels = flyout_labels(page)
    assert labels == ["Aquarium", "3D Pipes", "3D Maze", "Backrooms"]
    assert "Backrooms II" not in labels


def test_win7_menu_is_maze_only(page, base_url):
    goto_desk(page, base_url, "win7")
    assert flyout_labels(page) == ["3D Maze"]


def test_kde_menu_has_gl_set_not_backrooms(page, base_url):
    goto_desk(page, base_url, "kde")
    ids = page.evaluate(
        """() => [...document.querySelectorAll("#screensavers-menu [data-saver]")]
            .map((el) => el.getAttribute("data-saver"))"""
    )
    assert ids == KDE_GL
    assert "backrooms-ii" not in ids
    assert "maze-backrooms" not in ids
    body = page.content()
    assert "backrooms-ii" not in body
    assert "maze-backrooms" not in body


@pytest.mark.parametrize(
    "theme,label,needle",
    [
        ("xp", "Backrooms II", "backrooms-ii"),
        ("xp", "3D Pipes", "pipes"),
        ("win98", "Backrooms", "maze-backrooms"),
        ("win98", "Aquarium", "aquarium"),
        ("win7", "3D Maze", "/maze/"),
    ],
)
def test_menu_overlay_and_click_dismiss(page, base_url, theme, label, needle):
    goto_desk(page, base_url, theme)
    overlay = page.query_selector("#oq-ss-overlay")
    assert overlay is not None
    assert overlay.get_attribute("hidden") is not None

    click_flyout(page, label)
    size = wait_overlay_saver(page, needle)
    assert needle.strip("/") in size["src"] or needle in size["src"]
    assert theme in page.url
    dismiss_overlay(page)
    assert theme in page.url
    hidden = page.get_attribute("#start-menu", "hidden")
    assert hidden is not None


def test_kde_flux_overlay_and_dismiss(page, base_url):
    goto_desk(page, base_url, "kde")
    launched = page.evaluate(
        """() => {
          const btn = document.querySelector('[data-saver="flux"]');
          if (!btn) return false;
          btn.click();
          return true;
        }"""
    )
    assert launched
    wait_overlay_saver(page, "flux")
    dismiss_overlay(page)
    assert "/kde/" in page.url


def test_ss_exit_requires_oqret(page, base_url):
    page.goto(f"{base_url}/vendor/screensavers/flux/index.html")
    page.wait_for_timeout(400)
    assert page.evaluate("() => !document.querySelector('[aria-label=\"Exit screen saver\"]')")
    page.mouse.click(400, 300)
    page.wait_for_timeout(300)
    assert "/flux/" in page.url
    assert "oqret=" not in page.url


def test_ss_exit_with_oqret_returns(page, base_url):
    page.goto(f"{base_url}/vendor/screensavers/flux/index.html?oqret=%2Fxp%2F%3Fnosplash%3D1")
    page.wait_for_function(
        "() => !!document.querySelector('[aria-label=\"Exit screen saver\"]')",
        timeout=4000,
    )
    page.keyboard.press("Escape")
    page.wait_for_url(re.compile(r"/xp/\?nosplash=1"), timeout=8000)


def test_host_launch_url_carries_oqret(page, base_url):
    goto_desk(page, base_url, "xp")
    url = page.evaluate("() => window.OqScreensaver.host.launchUrl()")
    assert "pipes" in url
    assert "oqret=" in url
    assert "%2Fxp%2F" in url


def test_xp_run_backrooms_is_ii_not_maze(page, base_url):
    # Dual-path host unhides the overlay, then two rAFs later assigns
    # iframe.src. Waiting only for overlay visibility races that
    # assignment (master CI failed with src '').
    page.goto(f"{base_url}/xp/index.html?nosplash=1&run=backrooms")
    size = wait_overlay_saver(page, "backrooms-ii")
    src = size.get("src") or ""
    assert "maze-backrooms" not in src
    assert "oqret=" not in src


def test_nested_iframe_navigates_with_oqret(page, base_url):
    page.goto(f"{base_url}/xp/?nosplash=1")
    page.wait_for_function("() => window.OqScreensaver && window.OqScreensaver.host", timeout=8000)
    page.evaluate(
        """(url) => {
          document.documentElement.innerHTML = "<body style='margin:0'></body>";
          const f = document.createElement("iframe");
          f.id = "p";
          f.src = url;
          f.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0";
          document.body.appendChild(f);
        }""",
        f"{base_url}/xp/?nosplash=1",
    )
    page.wait_for_function(
        """() => {
          const f = document.getElementById("p");
          try {
            return !!(f && f.contentWindow && f.contentWindow.OqScreensaver
              && f.contentWindow.OqScreensaver.host);
          } catch (e) { return false; }
        }""",
        timeout=8000,
    )
    page.evaluate(
        """() => {
          const w = document.getElementById("p").contentWindow;
          const hit = [...w.document.querySelectorAll(".start-menu-flyout .start-menu-item")]
            .find((el) => el.textContent.replace(/\\s+/g, " ").trim() === "Backrooms II");
          hit.click();
        }"""
    )
    page.wait_for_function(
        """() => {
          const f = document.getElementById("p");
          try {
            return /backrooms-ii/.test(f.contentWindow.location.href)
              && /oqret=/.test(f.contentWindow.location.search);
          } catch (e) { return false; }
        }""",
        timeout=8000,
    )
    page.wait_for_timeout(400)
    page.evaluate(
        """() => {
          const f = document.getElementById("p");
          f.contentWindow.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        }"""
    )
    page.wait_for_function(
        """() => {
          const f = document.getElementById("p");
          try { return /\\/xp\\//.test(f.contentWindow.location.href); }
          catch (e) { return false; }
        }""",
        timeout=8000,
    )


def test_screensaver_suppressed_during_games(page, base_url):
    # DOS: launching Keen suppresses screensaver
    page.goto(f"{base_url}/dos/?nosplash=1")
    page.wait_for_function("() => window.OqScreensaver && window.OqScreensaver.host", timeout=8000)
    page.evaluate("() => document.getElementById('launch-keen').click()")
    page.wait_for_selector("#keen-app:not([hidden])", timeout=8000)
    # Screensaver start() should not display overlay while Keen is active
    page.evaluate("() => window.OqScreensaver.host.start()")
    page.wait_for_timeout(300)
    assert page.evaluate("() => document.getElementById('oq-ss-overlay').hidden") is True

    # Windows 95: opening Doom 95 suppresses screensaver
    page.goto(f"{base_url}/win95/?nosplash=1")
    page.wait_for_function("() => window.OqScreensaver && window.OqScreensaver.host", timeout=8000)
    page.dblclick(".desktop-icon[data-open='win-doom95']")
    page.wait_for_selector("#win-doom95:not(.minimized)", timeout=8000)
    page.evaluate("() => window.OqScreensaver.host.start()")
    page.wait_for_timeout(300)
    assert page.evaluate("() => document.getElementById('oq-ss-overlay').hidden") is True


def test_doom95_keyboard_controls(page, base_url):
    page.unroute("**/*.wad")
    page_errors = []
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.goto(f"{base_url}/win95/?nosplash=1")
    page.dblclick(".desktop-icon[data-open='win-doom95']")
    page.wait_for_selector("#win-doom95:not(.minimized)", timeout=8000)
    page.wait_for_function(
        """() => {
          const f = document.getElementById('doom95-frame');
          return f && f.contentDocument && f.contentDocument.getElementById('canvas') && f.contentDocument.getElementById('canvas').style.display === 'block';
        }""",
        timeout=20000,
    )
    page.wait_for_timeout(500)

    # Press Enter from parent window to verify key handling doesn't error
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)

    assert len(page_errors) == 0, f"Unexpected page errors: {page_errors}"



