# dsh-document-path-copy

Copies the full path of the file open in DSH's right-sidebar document preview.
Two ways in, both reading the Host path the preview was opened with:

- **Header button.** A copy button joins the preview's own controls, in the
  shipped `sidebar.right.tab.document.actions` slot that the open-in-app button
  also uses.
- **Right-click the path label.** The menu replaces the browser's own context
  menu on that label with a single "Copy full path" item, because the label
  clips long paths and the browser menu cannot produce the whole path.

The button reports the outcome in its tooltip (`Copied full path`, `Copy
failed`) and switches to a check mark for a moment. Labels are registered in
English and Chinese, so they follow the app locale instead of the plugin.

## Install

```bash
dsh plugin --profile web add /path/to/dsh-document-path-copy
```

Then restart the host so it loads the browser half. The package has no host-side
behavior, no routes, no credentials, and no configuration.

## Contract it depends on

- Slot `sidebar.right.tab.document.actions`, a list slot whose owner props are
  `{ absolutePath }`, rendered only when the preview resolves to a real Host
  file. Reusing a shipped id would replace that entry; this plugin registers its
  own id, `copy-path`.
- The preview path label carries `data-textpreview-path` and its `title`
  attribute holds the full path. The context menu is scoped to that attribute,
  so it does not touch any other span in the app.
- Clipboard writes go through `writeClipboard` from
  `@deepseek-ai/dsh-client-ui-primitives`, which prefers the async Clipboard API
  and falls back to `execCommand('copy')`.
