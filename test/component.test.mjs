/**
 * Behaviour test for the copy action.
 *
 * The real component is invoked with a stub React, a stub jsx runtime and stub
 * primitives, then its returned tree is inspected. That proves which node
 * carries the outcome, that a failed write is reported after the click that
 * dismissed the tooltip, and that both affordances report through the same
 * node. It does not prove pixels, layout, or a real clipboard write; only a
 * browser preview can show those.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PATH = "/mnt/data/report final.pdf";

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
  addEventListener() {},
  removeEventListener() {},
};

await import(join(dirname(fileURLToPath(import.meta.url)), "..", "client.js"));

const Fragment = Symbol("Fragment");
const jsx = (type, props) => ({ type, props: props ?? {} });

/** Render a stub component in place, so the tree holds the wide-intent output. */
function* walk(node) {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
    return;
  }
  if (node === null || typeof node !== "object") return;
  const { type, props } = node;
  if (typeof type === "function") {
    yield node;
    yield* walk(type(props));
    return;
  }
  yield node;
  yield* walk(props.children);
}

function find(tree, predicate) {
  for (const node of walk(tree)) if (node.type !== undefined && predicate(node)) return node;
  return undefined;
}

/**
 * Build one mounting of the plugin with a fake React whose hooks keep identity
 * across renders, and run `apply` so the registered component is captured.
 * @param accepted - what the stubbed clipboard write resolves to.
 */
function mount({ accepted }) {
  const state = [];
  const refs = [];
  const cleanups = [];
  const writes = [];
  let cursor = 0;

  const React = {
    useState(initial) {
      const at = cursor++;
      if (!(at in state)) state[at] = initial;
      return [
        state[at],
        (next) => {
          state[at] = typeof next === "function" ? next(state[at]) : next;
        },
      ];
    },
    useRef(value) {
      const at = cursor++;
      if (!(at in refs)) refs[at] = { current: value };
      return refs[at];
    },
    useEffect(effect) {
      const cleanup = effect();
      if (typeof cleanup === "function") cleanups.push(cleanup);
    },
    useCallback(fn) {
      return fn;
    },
  };

  const primitives = {
    Tooltip: (props) => props.children,
    Menu: () => null,
    IconCopyOutlineRegular: () => null,
    IconCheckOutlineRegular: () => null,
    writeClipboard: async (text) => {
      writes.push(text);
      return accepted;
    },
  };

  const exported = captured.factory((id) => {
    if (id === "react") return React;
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment };
    if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
    throw new Error(`unexpected require(${id})`);
  });

  let component;
  exported.apply({
    effect: (callback) => callback(),
    locale: { register: () => () => {} },
    slots: {
      inject: (name, callback) => callback(),
      register: (definition, registered) => {
        component = registered;
        return () => {};
      },
    },
  });

  return {
    primitives,
    writes,
    render() {
      cursor = 0;
      return component({ t: (key) => key, absolutePath: PATH });
    },
    dispose() {
      for (const cleanup of cleanups) cleanup();
    },
  };
}

const failed = mount({ accepted: false });
let tree = failed.render();
assert.equal(find(tree, (node) => node.props.role === "status"), undefined, "idle must show no status");

const button = find(tree, (node) => node.type === "button");
assert.ok(button, "the header affordance must render a button");
assert.equal(button.props["aria-label"], "copy");
assert.equal(button.props["data-document-path-copy"], true);

await button.props.onClick();
tree = failed.render();

const failure = find(tree, (node) => node.props.role === "status");
assert.ok(failure, "a rejected clipboard write must leave a status node after the click");
assert.equal(failure.props["data-document-path-copy-status"], "failed");
assert.equal(failure.props.children, "failed");
assert.equal(failure.props["aria-live"], "polite");
assert.deepEqual(failed.writes, [PATH], "the owner path is copied, never the label text");
assert.equal(
  find(tree, (node) => node.type === failed.primitives.IconCheckOutlineRegular),
  undefined,
  "a failed copy must not show the success icon",
);
failed.dispose();

const copied = mount({ accepted: true });
tree = copied.render();
await find(tree, (node) => node.type === "button").props.onClick();
tree = copied.render();

const success = find(tree, (node) => node.props.role === "status");
assert.ok(success, "a successful write must leave the same status node");
assert.equal(success.props["data-document-path-copy-status"], "copied");
assert.equal(success.props.children, "copied");
assert.ok(
  find(tree, (node) => node.type === copied.primitives.IconCheckOutlineRegular),
  "a successful copy shows the check icon",
);

// The context menu shares that node: its selection is the same copy path.
const menu = find(tree, (node) => Array.isArray(node.props.items));
assert.ok(menu, "the context menu must be registered with its item list");
menu.props.onSelect();
await new Promise((resolve) => setTimeout(resolve, 0));
tree = copied.render();
assert.equal(
  find(tree, (node) => node.props.role === "status").props["data-document-path-copy-status"],
  "copied",
  "copying from the context menu reports through the same status node",
);
copied.dispose();
