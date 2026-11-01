/**
 * Client half of `dsh-document-path-copy`.
 *
 * Two ways to put the previewed file's full path on the clipboard:
 *
 * 1. A copy button in the document preview header, registered into the shipped
 *    `sidebar.right.tab.document.actions` list slot.
 * 2. A "Copy full path" item on right-click over the preview's path label
 *    (`[data-textpreview-path]`), which clips long paths.
 *
 * Both use the slot owner prop `absolutePath` - the Host path the preview was
 * opened with - so the path is never reconstructed from the clipped label.
 *
 * Neither affordance relies on the tooltip to report the outcome: the tooltip
 * withdraws on the click that starts the copy, so the result is also written to
 * a live status message that outlives it.
 */
window.__ModuleLoader__.load({
  id: "dsh-document-path-copy",
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const { jsx, jsxs, Fragment } = require("react/jsx-runtime");
    const React = require("react");
    const P = require("@deepseek-ai/dsh-client-ui-primitives");

    const NS = "documentPathCopy";
    const SLOT = "sidebar.right.tab.document.actions";
    const PATH_SELECTOR = "[data-textpreview-path]";
    const COPIED_MS = 1500;
    const FAILED_MS = 4000;

    const zh = {
      copy: "复制完整路径",
      copied: "已复制完整路径",
      failed: "复制失败",
    };

    const en = {
      copy: "Copy full path",
      copied: "Copied full path",
      failed: "Copy failed",
    };

    const css = `
.dsh-document-path-copy{position:relative;display:inline-flex;align-items:center}
.dsh-document-path-copy__tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:6px;line-height:1;display:inline-flex}
.dsh-document-path-copy__tool:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-document-path-copy__tool svg{width:15px;height:15px}
.dsh-document-path-copy__status{position:absolute;top:100%;right:0;margin-top:4px;z-index:1;white-space:nowrap;pointer-events:none;padding:2px 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-size:11px;line-height:16px}
.dsh-document-path-copy__status[data-document-path-copy-status="failed"]{color:var(--dsw-alias-state-error-primary)}
`;

    /** Required client services: the slot registry and the locale dictionaries. */
    const inject = ["slots", "locale"];

    function injectStyle() {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-document-path-copy";
      tag.textContent = css;
      document.head.appendChild(tag);
      return () => {
        tag.remove();
      };
    }

    /**
     * The previewed file's path controls: the header copy button plus the
     * right-click menu on the preview's own path label.
     * @param props - slot owner inputs (`absolutePath`) plus the bound translator.
     * @returns the header button and, while open, its context menu.
     */
    function CopyPathAction(props) {
      const t = props.t;
      const path = props.absolutePath;
      const [state, setState] = React.useState("idle");
      const [menu, setMenu] = React.useState(null);
      const timer = React.useRef(undefined);

      React.useEffect(() => () => clearTimeout(timer.current), []);

      const copy = React.useCallback(async () => {
        const ok = await P.writeClipboard(path);
        setState(ok ? "copied" : "failed");
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), ok ? COPIED_MS : FAILED_MS);
      }, [path]);

      // The path label clips long paths, so right-click offers the whole one.
      // Scoped to the preview's attribute so no other span is intercepted.
      React.useEffect(() => {
        const openAt = (event) => {
          const target = event.target instanceof Element ? event.target.closest(PATH_SELECTOR) : null;
          if (target === null) return;
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        };
        document.addEventListener("contextmenu", openAt);
        return () => document.removeEventListener("contextmenu", openAt);
      }, []);

      const tooltip = state === "idle" ? t("copy") : t(state);

      return jsxs(Fragment, {
        children: [
          jsxs("span", {
            className: "dsh-document-path-copy",
            children: [
              jsx(P.Tooltip, {
                label: tooltip,
                side: "bottom",
                delayMs: 400,
                children: jsx("button", {
                  type: "button",
                  className: "dsh-document-path-copy__tool",
                  "aria-label": t("copy"),
                  "data-document-path-copy": true,
                  onClick: copy,
                  children:
                    state === "copied"
                      ? jsx(P.IconCheckOutlineRegular, {})
                      : jsx(P.IconCopyOutlineRegular, {}),
                }),
              }),
              state === "idle"
                ? null
                : jsx("span", {
                    className: "dsh-document-path-copy__status",
                    role: "status",
                    "aria-live": "polite",
                    "data-document-path-copy-status": state,
                    children: t(state),
                  }),
            ],
          }),
          jsx(P.Menu, {
            open: menu !== null,
            items: [{ id: "copy", label: t("copy") }],
            portal: true,
            getAnchorRect: () => new DOMRect(menu?.x ?? 0, menu?.y ?? 0, 0, 0),
            onSelect: () => {
              setMenu(null);
              copy();
            },
            onClose: () => setMenu(null),
          }),
        ],
      });
    }

    /**
     * Client plugin body: install the button stylesheet, register the English
     * and Chinese labels, and claim the preview header's action cell.
     */
    function apply(ctx) {
      ctx.effect(() => injectStyle(), "document-path-copy: styles");
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "document-path-copy: dictionaries");
      ctx.effect(
        () =>
          ctx.slots.inject(SLOT, () =>
            ctx.slots.register(
              {
                name: SLOT,
                id: "copy-path",
                locale: NS,
              },
              CopyPathAction,
            ),
          ),
        "document-path-copy: header button",
      );
    }

    exports.name = "dsh-document-path-copy";
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
