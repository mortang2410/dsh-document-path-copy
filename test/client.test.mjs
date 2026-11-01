/**
 * Contract test for the client half, run without a browser.
 *
 * It pins the naming contract that must agree across four sites (package name,
 * loader id, row name, exported plugin names), the bundle patch row, the
 * injection list, the slot cell this plugin claims, and the dictionary shape.
 * Rendering and clipboard behavior are pinned by component.test.mjs; the live
 * page is the only place that can prove the button draws.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

let captured;
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition;
    },
  },
};
globalThis.document = {
  createElement: () => ({ dataset: {}, remove() {}, textContent: "" }),
  head: { appendChild() {} },
};

await import(join(root, "client.js"));

const noop = () => undefined;
const primitives = new Proxy({}, { get: () => noop });
const exported = captured.factory((id) => {
  if (id === "react") return { useState: noop, useRef: noop, useEffect: noop, useCallback: noop };
  if (id === "react/jsx-runtime") return { jsx: noop, jsxs: noop, Fragment: Symbol("Fragment") };
  if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
  throw new Error(`unexpected require(${id})`);
});

assert.equal(captured.id, pkg.name, "loader id must equal the package name");
assert.equal(pkg.dsh.client.platform, "web");
assert.equal(pkg.exports["./client"], "./client.js");
assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");

assert.equal(typeof exported.apply, "function");
assert.equal(exported.name, pkg.name, "browser half must export the bundle key as its name");
assert.deepEqual(exported.inject, ["slots", "locale"]);

const host = await import(join(root, "index.js"));
assert.equal(host.name, pkg.name, "host half must export the bundle key as its name");
assert.equal(typeof host.apply, "function");

const patch = await readFile(join(root, "cordis.patch.yml"), "utf8");
const row = patch.match(/-\s*id:\s*(\S+)\s*\n\s*name:\s*'([^']+)'/);
assert.ok(row !== null, "bundle patch must declare one row with an id and a name");
assert.equal(row[1], "document-path-copy", "row id is the mount id and stays distinct");
assert.equal(row[2], pkg.name, "row name must equal the package name");

const seen = { dictionaries: undefined, namespace: undefined, slot: undefined };
const ctx = {
  effect(callback) {
    return callback();
  },
  locale: {
    bind: () => (key) => key,
    register(namespace, dictionaries) {
      seen.namespace = namespace;
      seen.dictionaries = dictionaries;
      return () => {};
    },
  },
  slots: {
    inject(name, callback) {
      assert.equal(name, "sidebar.right.tab.document.actions");
      return callback();
    },
    register(definition, component) {
      seen.slot = { definition, component };
      return () => {};
    },
  },
};

exported.apply(ctx);

assert.equal(seen.namespace, "documentPathCopy");
assert.equal(seen.slot.definition.id, "copy-path");
assert.equal(seen.slot.definition.name, "sidebar.right.tab.document.actions");
assert.equal(seen.slot.definition.locale, "documentPathCopy");
assert.equal(typeof seen.slot.component, "function");

const zhKeys = Object.keys(seen.dictionaries.zh).sort();
const enKeys = Object.keys(seen.dictionaries.en).sort();
assert.deepEqual(zhKeys, enKeys, "both dictionaries must carry the same keys");
assert.deepEqual(zhKeys, ["copied", "copy", "failed"]);
