import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const wmSource = readFileSync(path.join(repoRoot, "shared/redmond/window-manager.js"), "utf8");

function createMockEnvironment() {
  const windowListeners = new Map();
  const timeouts = [];
  let timerSeq = 1;

  const mockWindow = {
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!windowListeners.has(type)) return;
      const list = windowListeners.get(type);
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    dispatch(type, data) {
      const list = windowListeners.get(type) || [];
      for (const fn of list) {
        fn(data);
      }
    },
    setTimeout(fn, ms) {
      const id = timerSeq++;
      timeouts.push({ id, fn, ms });
      return id;
    },
    clearTimeout(id) {
      const idx = timeouts.findIndex((t) => t.id === id);
      if (idx >= 0) timeouts.splice(idx, 1);
    },
  };

  function makeElement(tag = "div") {
    const elListeners = new Map();
    const classList = new Set();
    const children = [];

    const el = {
      tag,
      src: "",
      classList: {
        add: (...names) => names.forEach((n) => classList.add(n)),
        remove: (...names) => names.forEach((n) => classList.delete(n)),
        contains: (name) => classList.has(name),
      },
      contentWindow: null,
      focusCalled: false,
      focus() {
        this.focusCalled = true;
      },
      addEventListener(type, fn) {
        if (!elListeners.has(type)) elListeners.set(type, []);
        elListeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        if (!elListeners.has(type)) return;
        const list = elListeners.get(type);
        const idx = list.indexOf(fn);
        if (idx >= 0) list.splice(idx, 1);
      },
      dispatch(type, event) {
        const list = elListeners.get(type) || [];
        for (const fn of list) {
          fn(event);
        }
      },
      appendChild(child) {
        children.push(child);
        return child;
      },
    };
    return el;
  }

  const mockScreensaverHost = {
    currentIdleMs: null,
    setIdleMs(ms) {
      this.currentIdleMs = ms;
    },
  };

  const sandbox = {
    window: mockWindow,
    document: {
      createElement: makeElement,
    },
    OqRedmond: {},
    OqScreensaver: {
      host: mockScreensaverHost,
    },
  };
  mockWindow.OqRedmond = sandbox.OqRedmond;
  mockWindow.OqScreensaver = sandbox.OqScreensaver;

  vm.createContext(sandbox);
  vm.runInContext(wmSource, sandbox);

  return { sandbox, mockWindow, mockScreensaverHost, makeElement };
}

test("OqRedmond.initGameWindow manages screensaver idle time, lazy iframe loading, and save hooks", () => {
  const env = createMockEnvironment();
  const { sandbox, mockWindow, mockScreensaverHost, makeElement } = env;

  const windowEl = makeElement("div");
  const frameEl = makeElement("iframe");
  let savedChild = null;
  frameEl.contentWindow = {
    focusCalled: false,
    focus() {
      this.focusCalled = true;
    },
    saveDukeLocalChanges() {
      savedChild = this;
    },
  };

  let closedWin = null;
  const game = sandbox.OqRedmond.initGameWindow({
    windowEl,
    frameEl,
    srcGetter: () => "../vendor/duke3d/dosbox-runner.html?v=2&mod=usa",
    closeWindow: (w) => { closedWin = w; },
    exitMessageType: "duke-exit",
    onSave: (child) => {
      if (typeof child.saveDukeLocalChanges === "function") {
        child.saveDukeLocalChanges();
      }
    },
  });

  // 1. onOpen pauses screensaver idle timer, loads src, focuses iframe
  assert.equal(mockScreensaverHost.currentIdleMs, null);
  game.onOpen();
  assert.equal(mockScreensaverHost.currentIdleMs, 0);
  assert.equal(frameEl.src, "../vendor/duke3d/dosbox-runner.html?v=2&mod=usa");
  assert.equal(frameEl.focusCalled, true);
  assert.equal(frameEl.contentWindow.focusCalled, true);

  // 2. onClose restores idle timer, invokes onSave, resets src to about:blank
  game.onClose();
  assert.equal(mockScreensaverHost.currentIdleMs, 45000);
  assert.equal(savedChild, frameEl.contentWindow);
  assert.equal(frameEl.src, "about:blank");

  // 3. runner exit message closes windowEl
  mockWindow.dispatch("message", { data: { type: "duke-exit" } });
  assert.equal(closedWin, windowEl);
});
