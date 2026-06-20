# Demo Code Map

This demo is intentionally static: opening `index.html` directly from disk should work.

- `index.html` contains document structure, metadata, and demo content.
- `styles.css` is generated Tailwind utility output from `demo/input.css`.
- `demo.css` is hand-authored theme, component, and graphic styling.
- `demo-animations.js` owns the local spring runtime, Motion Mini fallback wiring, and decorative SVG animations. It must run before `demo-controls.js`.
- `demo-controls.js` owns user-facing controls: theme switching, rail card selection, install-command copy state, advanced fade controls, and edge toggles.
- `demo-waves.js` owns the scroll-reactive background wave and is independent from the control scripts.

Before finishing demo edits, run:

```sh
node --test
node --check demo/demo-animations.js
node --check demo/demo-controls.js
node --check demo/demo-waves.js
node -e "const fs=require('fs'); const html=fs.readFileSync('demo/index.html','utf8'); const scripts=[...html.matchAll(/<script(.*?)>([\\s\\S]*?)<\\/script>/g)]; for (const match of scripts) { if (match[1].includes('application/ld+json')) continue; new Function(match[2]); } console.log('inline script syntax ok');"
git diff --check -- demo/index.html demo/styles.css demo/demo.css demo/demo-animations.js demo/demo-controls.js demo/demo-waves.js demo/README.md
```

For visual changes, smoke-test the file URL in Chromium and check the masthead, theme switcher, horizontal rail default state, vertical list, advanced controls, edge toggles, and animated graphics.
