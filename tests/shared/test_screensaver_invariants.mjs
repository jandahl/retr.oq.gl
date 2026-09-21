// Static guards for the screensaver host. No browser: these are the
// invariants that went missing when overlay-iframe WebGL went black in
// the live preview, when XP reused the 98 maze saver, and when saver
// pages loaded Three.js from a CDN the preview can block.
//
// Picked up by theme-tests.yml's shared-node-tests job
// (`node --test tests/shared/*.mjs`) on every push/PR.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ssRoot = path.join(repoRoot, "vendor", "screensavers");
const CDN = /https?:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)/i;

function read(rel) {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

function saverDirs() {
  return readdirSync(ssRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "lib")
    .map((d) => d.name)
    .sort();
}

test("every saver page loads ss-exit.js and no CDN scripts", () => {
  const dirs = saverDirs();
  assert.ok(dirs.length >= 20, "expected a full vendor/screensavers tree, got " + dirs.length);
  for (const name of dirs) {
    const html = read(path.join("vendor", "screensavers", name, "index.html"));
    assert.match(
      html,
      /shared\/redmond\/ss-exit\.js/,
      name + " is missing ss-exit.js (click-to-exit will not return to the desk)",
    );
    const cdn = html.match(CDN);
    assert.equal(cdn, null, name + " still loads a CDN script: " + (cdn && cdn[0]));
  }
});

test("every vendored saver has period metadata", () => {
  const catalog = read("shared/redmond/screensaver-catalog.js");
  const ids = [...catalog.matchAll(/\["([a-z0-9-]+)",\s*"[^"]+",\s*\[/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "screen saver catalog contains duplicate ids");
  for (const name of saverDirs()) {
    assert.match(catalog, new RegExp('\\["' + name + '",'), name + " is missing catalog metadata");
  }
  assert.equal(ids.length, saverDirs().length, "catalog has stale or missing saver metadata");
});

test("router loads catalog before the saver host and preserves script order", () => {
  const src = read("shared/router.js");
  const catalog = src.indexOf('redmond/screensaver-catalog.js?v=1');
  const host = src.indexOf('redmond/screensaver.js?v=31');
  assert.ok(catalog >= 0 && host > catalog, "catalog must load before host");
  assert.match(src, /s\.async\s*=\s*false/);
});

test("GL savers use vendored three.js builds that exist on disk", () => {
  const needed = {
    "three-r125.min.js": 100000,
    "three-r98.min.js": 100000,
    "three-r71.min.js": 100000,
    "pipes-screensaver.js": 1000,
    "pipes-OrbitControls.js": 1000,
    "pipes-TeapotBufferGeometry.js": 1000,
    "flying-windows-256-colors.js": 100,
  };
  for (const [file, min] of Object.entries(needed)) {
    const full = path.join(ssRoot, "lib", file);
    const st = statSync(full);
    assert.ok(st.size >= min, file + " is missing or tiny (" + st.size + " bytes)");
  }
  const threeSavers = {
    "backrooms-ii": "three-r125.min.js",
    flux: "three-r125.min.js",
    pipes: "three-r98.min.js",
    maze: "three-r71.min.js",
    "maze-backrooms": "three-r71.min.js",
    "flying-windows": "three-r125.min.js",
  };
  for (const [name, lib] of Object.entries(threeSavers)) {
    const html = read(path.join("vendor", "screensavers", name, "index.html"));
    assert.ok(
      html.includes("../lib/" + lib),
      name + " should load ../lib/" + lib,
    );
  }
});

test("host navigates with oqret when nested; overlay when top-level", () => {
  const src = read("shared/redmond/screensaver.js");
  const start = src.match(/function start\(\) \{[\s\S]*?\n    \}/);
  assert.ok(start, "missing start()");
  assert.match(src, /function nestedFrame\(/);
  assert.match(start[0], /nestedFrame\(\)/);
  assert.match(start[0], /location\.href\s*=\s*launchUrl\(\)/);
  assert.match(start[0], /overlay\.hidden\s*=\s*false/);
  assert.match(src, /oqret=/);
  assert.match(src, /encodeURIComponent\(returnUrl\(\)\)/);
  assert.match(src, /OqScreensaver\.host\s*=\s*api/);
  assert.match(src, /function layoutOverlay\(/);
  assert.match(src, /getComputedStyle\(document\.documentElement\)\.zoom/);
  // Unhide before assigning iframe src so WebGL does not init at 0×0.
  const unhide = start[0].indexOf("overlay.hidden = false");
  const assign = start[0].indexOf("frame.src = resolveSrc()");
  assert.ok(unhide >= 0 && assign > unhide, "overlay must unhide before setting iframe src");
});

test("ss-exit only arms with a same-origin oqret and delays the click", () => {
  const src = read("shared/redmond/ss-exit.js");
  assert.match(src, /oqret/);
  assert.match(src, /function safeRet/);
  assert.match(src, /setTimeout\(/);
  assert.match(src, /location\.href\s*=\s*ret/);
  assert.match(src, /if \(!ret\) return/);
});

test("XP menu is Backrooms II; Win98 keeps maze-backrooms; KDE has neither", () => {
  const host = read("shared/redmond/screensaver.js");
  const xp = host.slice(host.indexOf('if (theme === "xp")'), host.indexOf('if (theme === "win7")'));
  assert.match(xp, /Backrooms II/);
  assert.match(xp, /vendor\("backrooms-ii"\)/);
  assert.doesNotMatch(xp, /maze-backrooms/);
  assert.doesNotMatch(xp, /addStartItem\(menu, "Backrooms"/);

  const win98 = host.slice(host.indexOf('if (theme === "win98")'), host.indexOf('if (theme === "xp")'));
  assert.match(win98, /vendor\("maze-backrooms"\)/);
  assert.match(win98, /addStartItem\(menu, "Backrooms"/);
  assert.doesNotMatch(win98, /backrooms-ii/);
  assert.doesNotMatch(win98, /Backrooms II/);

  const kde = host.slice(host.indexOf('if (theme === "kde")'), host.indexOf('if (theme === "mac8")'));
  assert.doesNotMatch(kde, /backrooms/);

  const kdeApp = read("kde/app.js");
  const kdeHtml = read("kde/index.html");
  assert.doesNotMatch(kdeApp, /backrooms/);
  assert.doesNotMatch(kdeHtml, /backrooms/);
  assert.match(kdeApp, /\.kde\.start\(\)/);
});

test("Run on XP maps backrooms to Backrooms II, not the 98 maze", () => {
  const src = read("shared/redmond/run.js");
  assert.match(src, /theme === "xp"\s*\?\s*"backrooms-ii"\s*:\s*"maze-backrooms"/);
  assert.doesNotMatch(src, /frame\.src\s*=\s*vendor/);
  assert.match(src, /host\.start\(\)/);
});

test("Win 3.1 Marquee is Times New Roman fuchsia oq!", () => {
  const src = read("vendor/screensavers/marquee/app.js");
  assert.match(src, /["']oq!["']/);
  assert.match(src, /Times New Roman/);
  assert.match(src, /#ff00ff/i);
  assert.doesNotMatch(src, /Windows 3\.1/);
  assert.doesNotMatch(src, /MS Sans Serif/);
});

test("Starfield keeps warp trails short and adds shooting stars", () => {
  const src = read("vendor/screensavers/starfield/app.js");
  assert.match(src, /spawnMeteor/);
  assert.match(src, /maxTrail/);
  assert.match(src, /nextMeteor/);
});

test("Flying Windows face is the Greenland flag, not a four-pane logo", () => {
  const src = read("vendor/screensavers/flying-windows/app.js");
  const html = read("vendor/screensavers/flying-windows/index.html");
  assert.match(src, /greenlandFlagTexture/);
  assert.match(src, /#C8102E/);
  assert.match(src, /PlaneGeometry/);
  assert.doesNotMatch(src, /gagWindowTexture/);
  assert.doesNotMatch(src, /#c00000/);
  assert.doesNotMatch(src, /BoxGeometry/);
  assert.doesNotMatch(src, /getRandomColor/);
  assert.doesNotMatch(src, /THREE\.BackSide/);
  assert.doesNotMatch(html, /flying-windows-256-colors/);
  // White over red (Erfalasorput). Red-on-top was the upside-down paint.
  assert.match(src, /fillStyle = white;\s*\n\s*g\.fillRect\(0, 0,/);
  assert.match(src, /fillStyle = red;\s*\n\s*g\.fillRect\(0, c\.height \/ 2,/);
});
