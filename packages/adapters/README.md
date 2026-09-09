# @promptforge/adapters

Per-site knowledge for the browser extension: which hosts to inject into and
which CSS selectors find the composer and the send button.

Only the browser extension uses this package. The CLI and VS Code shells do not
touch a web page.

```ts
import { adapterForUrl, allHosts } from "@promptforge/adapters";

const adapter = adapterForUrl(location.href);
adapter?.webSelectors.input; // e.g. 'div[contenteditable="true"].ProseMirror'
allHosts;                    // feeds host_permissions in the MV3 manifest
```

## Adding a platform

1. Create `src/<platform>.ts` exporting a `ProviderAdapter`.
2. Register it in `src/index.ts`.
3. Mirror the selectors in `config/selectors.json` at the repo root.
4. Add a case to `src/adapters.test.ts`.

If a site changes its HTML, fix the one file for that site. Nothing else needs
to change.
