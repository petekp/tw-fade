# Demo Code Map

This demo is intentionally static: opening `index.html` directly from disk should work.

- `index.html` contains document structure, metadata, and demo content.
- `styles.css` is generated Tailwind utility output from `demo/input.css`. Its scan includes the main demo and blur lab; the safelist supplies complete class names selected dynamically by controls.
- `demo.css` is hand-authored theme, component, and graphic styling.
- `demo.css` also owns the static fallback for the background wave field.
- `torph.js` is the vendored [torph](https://github.com/lochie/torph) text-morph library wrapped for a classic script (`window.Torph`). It must load before `demo-controls.js`, which morphs the Advanced class readout with it.
- `demo-animations.js` owns the local spring runtime, decorative SVG animations, and the scroll-modulated SVG wave path. It must run before `demo-controls.js`.
- `demo-controls.js` owns user-facing controls: theme switching, rail card selection, clipboard feedback, advanced fade controls, and edge toggles.
- The hero entrance, pointer tilt, and theme selector use the pinned Motion browser script loaded by `index.html`. The pointer tilt keeps the root blur layer anchored and is inactive for touch or reduced motion. Button scales change immediately for touch, reduced motion, or an unavailable Motion script. The other controls use the local spring runtime.
- `hero-lab.html`, `wave-lab.html`, and `blur-lab.html` are noindex design scratchpads. They are excluded from the production `/tw-fade` static export.
- `blur-lab.html` consumes the independent public opacity and blur selectors from `styles.css`. Its existing variants cover opacity only, single blur with opacity, progressive blur with opacity, and blur only. `blur-lab.css` and `blur-lab.js` provide presentation, separate effect selection maps, shared scrolling, and controls. Strength classes configure blur; they do not activate it.
- `../build/demo-static.mjs` owns the production static export contract for `/tw-fade`.
- `../build/verify-demo-assets.mjs` checks local asset links, script order, static export rewriting, spring rest thresholds, and the SVG wave morph contract.
- `../build/verify-demo-runtime.mjs` runs browser smoke checks for the file URL and exported `/tw-fade` route across desktop, mobile, WebKit iPhone, keyboard, and reduced-motion contexts.
- `../build/verify-dist.mjs` checks the public effect API and blur pixels through both the prebuilt and Tailwind source paths. `../build/verify-blur-lab.mjs` checks the existing lab and its controls. Follow the [root README](../README.md) for API semantics and [migration guide](../MIGRATING.md#migrating-to-090) for old draft classes.

Before finishing demo edits, run:

```sh
npm run build
npm run build:demo
node --test
node --check demo/demo-animations.js
node --check demo/demo-controls.js
node --check demo/blur-lab.js
node --check build/demo-static.mjs
node --check build/verify-demo-assets.mjs
node --check build/verify-demo-runtime.mjs
node --check scripts/export-demo-static.mjs
node build/verify-demo-assets.mjs
node build/verify-demo-runtime.mjs
node build/verify-dist.mjs
node build/verify-blur-lab.mjs
npm run export:demo -- --out .tmp/demo-static
node -e "const fs=require('fs'); const html=fs.readFileSync('demo/index.html','utf8'); const scripts=[...html.matchAll(/<script(.*?)>([\\s\\S]*?)<\\/script>/g)]; for (const match of scripts) { if (match[1].includes('application/ld+json')) continue; new Function(match[2]); } console.log('inline script syntax ok');"
git diff --check -- demo/index.html demo/input.css demo/styles.css demo/demo.css demo/demo-animations.js demo/demo-controls.js demo/blur-lab.html demo/blur-lab.css demo/blur-lab.js demo/README.md build/demo-static.mjs build/verify-demo-assets.mjs build/verify-demo-runtime.mjs build/verify-dist.mjs build/verify-blur-lab.mjs scripts/export-demo-static.mjs
```

For visual changes, smoke-test the file URL in Chromium and check the masthead, theme switcher, horizontal rail default state, vertical list, advanced controls, edge toggles, and animated graphics. Run `npm run export:demo -- --out .tmp/demo-static` when you need the same `/tw-fade` asset paths used by production.

The chat card, Advanced preview panel, and blur lab shells use `fade-blur-frame` and own effect configuration. Their first children own scrolling. Progressive spans are frame children after the scroller. The [blur setup](../README.md#blur-setup) documents the same CSS-only structure.

For blur changes, check the existing lab with separate opacity and blur selections. Verify axis changes replace prior selectors, readouts match active classes, and reset restores both effects' configuration. Blur-only fallback must not introduce opacity fading. A bundled WebKit viewport does not establish physical iPhone or current Safari blur behavior; record those verification gaps separately.
