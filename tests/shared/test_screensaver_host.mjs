// Behavior of the screensaver host that source scans cannot see:
// setIdleMs(0) must cancel an armed timer, destroy() must not rearm on
// pointermove, and win95 must not fetch Win98's start-extra.js.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = readFileSync(path.join(repoRoot, "shared/redmond/screensaver.js"), "utf8");

function loadHost({ pathname = "/win98/", readyState = "loading", reduced = false } = {}) {
  const timeouts = [];
  let seq = 1;
  const byId = new Map();
  const windowListeners = [];

  function remember(list, type, fn, capture) {
    list.push({ type, fn, capture: !!capture });
  }
  function forget(list, type, fn, capture) {
    const i = list.findIndex((entry) => entry.type === type && entry.fn === fn && entry.capture === !!capture);
    if (i >= 0) list.splice(i, 1);
  }
  function makeEl(tag) {
    const listeners = [];
    const el = {
      tag,
      hidden: false,
      style: {},
      attrs: {},
      children: [],
      className: "",
      loading: "",
      src: "",
      title: "",
      listeners,
      setAttribute(name, value) { this.attrs[name] = String(value); },
      getAttribute(name) { return this.attrs[name]; },
      removeAttribute(name) { delete this.attrs[name]; },
      appendChild(child) { this.children.push(child); return child; },
      append(...nodes) { for (const node of nodes) this.children.push(node); },
      insertBefore(node) { this.children.push(node); return node; },
      addEventListener(type, fn, opts) {
        remember(listeners, type, fn, opts === true || !!(opts && opts.capture));
      },
      removeEventListener(type, fn, capture) {
        forget(listeners, type, fn, capture === true);
      },
      querySelector(sel) {
        if (sel === "iframe") return this.children.find((child) => child.tag === "iframe") || null;
        if (sel === "#start-menu-shutdown" || sel === '[data-open="win-about"]') return null;
        return null;
      },
      set innerHTML(html) {
        this.children = [];
        if (String(html).includes("<iframe")) this.children.push(makeEl("iframe"));
      },
      classList: { add() {}, remove() {}, toggle() {} },
    };
    let id = "";
    Object.defineProperty(el, "id", {
      get() { return id; },
      set(value) {
        if (id) byId.delete(id);
        id = value;
        if (value) byId.set(value, el);
      },
    });
    return el;
  }

  const head = makeEl("head");
  const body = makeEl("body");
  const document = {
    readyState,
    hidden: false,
    head,
    body,
    documentElement: makeEl("html"),
    getElementById(id) { return byId.get(id) || null; },
    createElement(tag) { return makeEl(tag); },
    addEventListener(type, fn) { remember(windowListeners, "doc:" + type, fn, false); },
    removeEventListener(type, fn) { forget(windowListeners, "doc:" + type, fn, false); },
    querySelector() { return null; },
  };
  const sandbox = {
    document,
    location: { pathname, href: "http://127.0.0.1" + pathname, search: "", hash: "" },
    getComputedStyle() { return { zoom: "1" }; },
    clearTimeout(id) {
      const i = timeouts.findIndex((item) => item.id === id);
      if (i >= 0) timeouts.splice(i, 1);
    },
    setTimeout(fn, ms) {
      const id = seq++;
      timeouts.push({ id, fn, ms });
      return id;
    },
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  const motion = {
    matches: reduced,
    listeners: [],
    addEventListener(type, fn) { if (type === "change") this.listeners.push(fn); },
    removeEventListener(type, fn) {
      this.listeners = this.listeners.filter((listener) => listener !== fn);
    },
  };
  sandbox.window.matchMedia = () => motion;
  sandbox.window.addEventListener = (type, fn, opts) => {
    remember(windowListeners, type, fn, opts === true || !!(opts && opts.capture));
  };
  sandbox.window.removeEventListener = (type, fn, capture) => {
    forget(windowListeners, type, fn, capture === true);
  };
  sandbox.window.setTimeout = sandbox.setTimeout;
  sandbox.window.self = sandbox.window;
  sandbox.window.top = sandbox.window;
  sandbox.window.innerWidth = 800;
  sandbox.window.innerHeight = 600;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "screensaver.js" });
  return {
    sandbox,
    timeouts,
    windowListeners,
    head,
    motion,
    dispatch(type) {
      for (const entry of windowListeners.filter((item) => item.type === type)) entry.fn({ preventDefault() {}, stopPropagation() {} });
    },
  };
}

test("setIdleMs(0) cancels the armed idle timeout", () => {
  const host = loadHost({ readyState: "loading" });
  const api = host.sandbox.OqScreensaver.attach({ src: "../vendor/screensavers/maze/index.html?v=ss4", idleMs: 45000 });
  assert.deepEqual(host.timeouts.map((item) => item.ms), [45000]);
  api.setIdleMs(0);
  assert.deepEqual(host.timeouts, []);
});

test("destroy does not rearm the saver on pointermove", () => {
  const host = loadHost({ readyState: "loading" });
  const api = host.sandbox.OqScreensaver.attach({ src: "../vendor/screensavers/maze/index.html?v=ss4", idleMs: 45000 });
  api.destroy();
  assert.deepEqual(host.timeouts, []);
  host.dispatch("pointermove");
  assert.deepEqual(host.timeouts, []);
});

test("win95 does not inject Win98 start-extra.js; win98 still does", () => {
  const win95 = loadHost({ pathname: "/win95/", readyState: "complete" });
  const win98 = loadHost({ pathname: "/win98/", readyState: "complete" });
  const scripts = (head) => head.children.filter((node) => node.tag === "script").map((node) => node.src);
  assert.deepEqual(scripts(win95.head), []);
  assert.deepEqual(scripts(win98.head), ["start-extra.js?v=1"]);
});

test("turning reduced motion off restores Aqua's 75s idle", () => {
  const host = loadHost({ pathname: "/aqua/", readyState: "complete", reduced: true });
  assert.equal(host.timeouts.length, 0);
  host.motion.matches = false;
  for (const fn of host.motion.listeners) fn();
  assert.deepEqual(host.timeouts.map((item) => item.ms), [75000]);
});
