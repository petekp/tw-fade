# Demo Code Map

This demo is intentionally static: opening `index.html` directly from disk should work.

- `index.html` contains document structure, metadata, and demo content.
- `styles.css` is generated Tailwind utility output from `demo/input.css`.
- `demo.css` is hand-authored theme, component, and graphic styling.
- `demo.css` also owns the background wave field; it is static by default and scroll-timeline driven in browsers that support CSS scroll animations.
- `demo-animations.js` owns the local spring runtime and decorative SVG animations. It must run before `demo-controls.js`.
- `demo-controls.js` owns user-facing controls: theme switching, rail card selection, install-command copy state, advanced fade controls, and edge toggles.
- `hero-lab.html` and `wave-lab.html` are noindex design scratchpads. They are intentionally excluded from the production `/tw-fade` static export and should be treated as source references, not shipped demo code.
- `../build/demo-static.mjs` owns the production static export contract for `/tw-fade`.
- `../build/verify-demo-assets.mjs` checks local asset links, script order, static export rewriting, spring rest thresholds, and the absence of scroll-repaint background code.
- `../build/verify-demo-runtime.mjs` runs browser smoke checks for the file URL and exported `/tw-fade` route across desktop, mobile, WebKit iPhone, keyboard, and reduced-motion contexts.

Before finishing demo edits, run:

```sh
node --test
node --check demo/demo-animations.js
node --check demo/demo-controls.js
node --check build/demo-static.mjs
node --check build/verify-demo-assets.mjs
node --check build/verify-demo-runtime.mjs
node --check scripts/export-demo-static.mjs
node build/verify-demo-assets.mjs
node build/verify-demo-runtime.mjs
npm run export:demo -- --out .tmp/demo-static
node -e "const fs=require('fs'); const html=fs.readFileSync('demo/index.html','utf8'); const scripts=[...html.matchAll(/<script(.*?)>([\\s\\S]*?)<\\/script>/g)]; for (const match of scripts) { if (match[1].includes('application/ld+json')) continue; new Function(match[2]); } console.log('inline script syntax ok');"
git diff --check -- demo/index.html demo/styles.css demo/demo.css demo/demo-animations.js demo/demo-controls.js demo/README.md build/demo-static.mjs build/verify-demo-assets.mjs build/verify-demo-runtime.mjs scripts/export-demo-static.mjs
```

For visual changes, smoke-test the file URL in Chromium and check the masthead, theme switcher, horizontal rail default state, vertical list, advanced controls, edge toggles, and animated graphics. Run `npm run export:demo -- --out .tmp/demo-static` when you need the same `/tw-fade` asset paths used by production.
