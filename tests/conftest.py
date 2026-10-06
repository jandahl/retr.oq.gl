"""Shared pytest fixtures for the Playwright test suite.

Serves the repo root over plain http(s) (this repo explicitly does not
target file://, see CLAUDE.md), and launches a single Chromium instance
for the whole test session -- individual tests get a fresh page/context
each so state (localStorage, URL) never leaks between them.
"""

import functools
import http.server
import threading

import pytest
from playwright.sync_api import Error as PlaywrightError, sync_playwright

REPO_ROOT = __import__("pathlib").Path(__file__).resolve().parent.parent

# This sandbox's pre-installed Chromium lives at a fixed path outside
# Playwright's own browser cache (see the environment notes this suite was
# written against); a real CI runner instead installs its browsers where
# Playwright expects and needs no override. Only pass executable_path when
# that sandbox-specific binary actually exists, so the same test file works
# unmodified in both places.
_SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium"


class TestHTTPServer(http.server.ThreadingHTTPServer):
    # Chromium opens parallel connections for each page's scripts and fonts.
    # Keep those bursts from overflowing the default five-connection queue.
    request_queue_size = 128


class TestHTTPHandler(http.server.SimpleHTTPRequestHandler):

    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
    })


@pytest.fixture(scope="session")
def base_url():
    handler = functools.partial(TestHTTPHandler, directory=str(REPO_ROOT))
    server = TestHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    yield f"http://127.0.0.1:{port}"
    server.shutdown()
    thread.join()


@pytest.fixture(scope="session")
def browser():
    import os

    launch_kwargs = {}
    if os.path.exists(_SANDBOX_CHROMIUM):
        launch_kwargs["executable_path"] = _SANDBOX_CHROMIUM
    with sync_playwright() as p:
        b = p.chromium.launch(**launch_kwargs)
        yield b
        b.close()


@pytest.fixture
def page(browser):
    context = browser.new_context()
    pg = context.new_page()
    yield pg
    # Module route callbacks must settle before their request context is disposed.
    pg.unroute_all(behavior="wait")
    context.close()


@pytest.fixture
def touch_page(browser):
    """A context with touch support enabled, for tests that need real
    page.touchscreen.tap() -- (pointer: coarse) CSS and touch event
    handling both depend on this, unlike a plain mouse-only page."""
    context = browser.new_context(has_touch=True, viewport={"width": 390, "height": 844})
    pg = context.new_page()
    yield pg
    # Module route callbacks must settle before their request context is disposed.
    pg.unroute_all(behavior="wait")
    context.close()


_FROZEN_API_RESPONSES = {}


def _mirror_frozen_api(route):
    """Load the same frozen API archive without Cloudflare's runner-dependent HTML.

    Keep the browser request URL (and relative module resolution) unchanged.
    GitHub Pages publishes the same versioned modules as api.oq.gl.
    """
    mirror_url = route.request.url.replace(
        "https://api.oq.gl/", "https://jandahl.github.io/api.oq.gl/", 1
    )
    # A fresh browser context per test must not refetch the immutable archive.
    # Store bytes, not APIResponse objects tied to a disposed request context.
    if mirror_url not in _FROZEN_API_RESPONSES:
        response = route.fetch(url=mirror_url)
        content_type = response.headers.get("content-type", "")
        if response.status != 200 or not any(
            kind in content_type for kind in ("javascript", "json")
        ):
            raise AssertionError(
                f"Frozen API module unavailable: {mirror_url} "
                f"({response.status}, {content_type})"
            )
        _FROZEN_API_RESPONSES[mirror_url] = {
            "status": response.status,
            "headers": {
                key: value for key, value in response.headers.items()
                if key not in ("content-encoding", "content-length", "transfer-encoding")
            },
            "body": response.body(),
        }
    try:
        route.fulfill(**_FROZEN_API_RESPONSES[mirror_url])
    except PlaywrightError as error:
        # A screensaver navigation can cancel its old iframe's module request.
        # That route is already settled by Chromium; other failures stay fatal.
        if "Route is already handled!" not in str(error):
            raise


def _block_heavy_assets(page):
    """404 heavy assets and load frozen API modules from their archive mirror."""
    page.route("https://api.oq.gl/api/v*/**", _mirror_frozen_api)
    page.route(
        "**/Oqaasileriffik-katersat/**",
        lambda route: route.fulfill(status=404, body="blocked in tests"),
    )
    # Block heavy DOOM wad/wasm in general browser test sweeps to keep CI fast
    page.route(
        "**/*.wad",
        lambda route: route.fulfill(status=404, body="doom wad blocked in tests"),
    )


@pytest.fixture(autouse=True)
def block_heavy_assets_fetch(request):
    """Default: block katersat and heavy DOOM binary assets in Playwright tests."""
    for name in ("page", "touch_page"):
        if name in request.fixturenames:
            _block_heavy_assets(request.getfixturevalue(name))
    yield

