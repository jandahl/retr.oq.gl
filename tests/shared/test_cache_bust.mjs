// One shared script must have one ?v= across every theme page.
// A stale query string is a shipped bug: the server ignores it, so a
// browser that cached the old URL keeps those bytes forever.
//
// Picked up by theme-tests.yml's shared-node-tests job and by html-lint.yml
// so an HTML-only edit still runs this check.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKIP = new Set(["vendor", "node_modules", "oq-integration", ".git"]);

function themeIndexFiles() {
  const found = [];
  for (const entry of readdirSync(repoRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    const index = path.join(repoRoot, entry.name, "index.html");
    try {
      if (statSync(index).isFile()) found.push(index);
    } catch {
      // theme dir without an index.html
    }
  }
  found.sort();
  return found;
}

function sharedScriptRefs(html, htmlPath) {
  const refs = [];
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attr = tag.match(/\b(?:src|href)\s*=\s*"([^"]+)"/i);
    if (!attr) continue;
    const url = attr[1];
    if (/^(?:https?:|data:|#)/i.test(url)) continue;
    const [beforeHash] = url.split("#");
    const [pathname, query = ""] = beforeHash.split("?");
    if (!pathname.endsWith(".js")) continue;
    const abs = path.normalize(path.join(path.dirname(htmlPath), pathname));
    const rel = path.relative(repoRoot, abs);
    if (!rel.startsWith(`shared${path.sep}`) || rel.startsWith("..")) continue;
    const version = new URLSearchParams(query).get("v");
    refs.push({
      page: path.relative(repoRoot, htmlPath),
      file: rel.split(path.sep).join("/"),
      version,
    });
  }
  return refs;
}

test("every theme index.html pins each shared script to one ?v=", () => {
  const byFile = new Map();
  for (const index of themeIndexFiles()) {
    const html = readFileSync(index, "utf8");
    for (const ref of sharedScriptRefs(html, index)) {
      if (!byFile.has(ref.file)) byFile.set(ref.file, []);
      byFile.get(ref.file).push(ref);
    }
  }

  assert.ok(byFile.size > 0, "no shared script references found; the scanner drifted");

  const problems = [];
  for (const [file, refs] of [...byFile.entries()].sort()) {
    const missing = refs.filter((ref) => ref.version === null);
    for (const ref of missing) {
      problems.push(`${ref.page} loads ${file} with no ?v=`);
    }
    const versions = [...new Set(refs.map((ref) => ref.version).filter((v) => v !== null))];
    if (versions.length > 1) {
      const where = refs
        .map((ref) => `${ref.page}=${ref.version === null ? "(none)" : ref.version}`)
        .join(", ");
      problems.push(`${file} has versions ${versions.join(" and ")} (${where})`);
    }
  }

  assert.deepEqual(problems, []);
});
