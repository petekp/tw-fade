/**
 * build-debug.mjs — assemble debug/index.html, a self-contained pressure-test
 * harness for the fade engine.
 *
 *   node scripts/build-debug.mjs
 *
 * It inlines three sources into one standalone file (open via file:// or any
 * static server, no build step at view time):
 *   1. the compiled plugin CSS (compileCss() — the SAME output dist/ ships, so
 *      the harness always reflects the real engine, every named utility present);
 *   2. scripts/debug/harness.css  — UI chrome;
 *   3. scripts/debug/harness.js   — scenario config + controls + scroll sync.
 *
 * The harness drives the engine through its public custom properties, so this
 * generator never needs to know the gradient internals — it just ships the
 * current plugin CSS verbatim.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileCss } from './build-css.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const debugDir = path.join(root, 'debug')
const outFile = path.join(debugDir, 'index.html')

const pluginCss = compileCss()
const harnessCss = fs.readFileSync(path.join(__dirname, 'debug', 'harness.css'), 'utf8')
const harnessJs = fs.readFileSync(path.join(__dirname, 'debug', 'harness.js'), 'utf8')

const ctrl = (label, valId, inner) =>
  `<div class="ctrl"><label>${label}${valId ? `<span class="val" id="${valId}"></span>` : ''}</label>${inner}</div>`

const panel = `
<div class="panel">
  <div class="panel-title">
    <h1>tw-fade · pressure test</h1>
    <span class="sub">every sample is pinned to the same scroll offset — scrub to compare frame-for-frame</span>
    <span class="spacer"></span>
    <button class="btn" id="resetBtn">Reset</button>
  </div>
  <div class="controls">
    ${ctrl('Fade size', 'sizeVal', '<input type="range" id="sizeRange" min="0" max="200" step="2" value="0">')}
    ${ctrl('Travel (band open)', 'travelVal', '<input type="range" id="travelRange" min="0" max="240" step="4" value="0">')}
    ${ctrl('Onset (edge speed)', 'onsetVal', '<input type="range" id="onsetRange" min="1" max="24" step="1" value="8">')}
    ${ctrl('Clear', 'clearVal', '<input type="range" id="clearRange" min="0" max="64" step="2" value="0">')}
    <div class="ctrl" style="flex:1 1 320px">
      <label>Scroll position <span class="val">all scrollers</span></label>
      <div class="scrubrow">
        <input type="range" id="scrollRange" min="0" max="100" step="1" value="0" style="flex:1">
        <span class="seg" id="scrollModeSeg">
          <button data-scrollmode="start" aria-pressed="true">px from start</button>
          <button data-scrollmode="end">px from end</button>
        </span>
        <span class="steps">
          <button data-step="0">flush</button>
          <button data-step="2">2px</button>
          <button data-step="4">4px</button>
          <button data-step="6">6px</button>
          <button data-step="8">8px</button>
          <button data-step="12">12px</button>
          <button data-step="24">24px</button>
          <button data-step="25%">25%</button>
          <button data-step="50%">50%</button>
          <button data-step="75%">75%</button>
          <button data-step="100%">end</button>
        </span>
        <label class="toggle"><input type="checkbox" id="autoChk"> auto</label>
      </div>
    </div>
    ${ctrl('Content', null, '<select id="contentSel"><option value="auto">auto (per scenario)</option><option value="text">text</option><option value="cards">cards</option><option value="images">images</option><option value="code">code</option><option value="dense">dense list</option></select>')}
    ${ctrl('Background', null, '<select id="bgSel"><option value="light">light</option><option value="dark">dark</option><option value="check">checkerboard</option><option value="photo">photo</option></select>')}
    ${ctrl('Container shape', null, '<select id="shapeSel"><option value="rounded">rounded</option><option value="squircle">squircle</option><option value="sharp">sharp</option></select>')}
    <div class="ctrl"><label>Toggles</label><div class="scrubrow">
      <label class="toggle"><input type="checkbox" id="rtlChk"> RTL</label>
      <label class="toggle warn" data-on="false"><input type="checkbox" id="fallbackChk"> static fallback</label>
    </div></div>
  </div>
  <p class="hint">
    <b>onset 1</b> reproduces the old coupled hard-clip (<code>alpha = t</code>); <b>8</b> is the decoupled default.
    <b>static fallback</b> forces <code>fade-always</code> (the no-scroll-driven-animation path). Set scroll to <b>8px from start</b> to inspect the onset edge-coverage window; switch to <b>px from end</b> to probe the trailing edge (<code>fade-bottom</code> / <code>fade-end</code> — a separate range).
  </p>
</div>`

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tw-fade · pressure test</title>
<style>
/* ===== compiled plugin CSS (compileCss — same output dist/ ships) ===== */
${pluginCss}
/* ===== harness chrome ===== */
${harnessCss}
</style>
</head>
<body>
${panel}
<main class="stage bg-light shape-rounded" id="stage"></main>
<script>
${harnessJs}
</script>
</body>
</html>
`

fs.mkdirSync(debugDir, { recursive: true })
fs.writeFileSync(outFile, html)
console.log(`wrote ${path.relative(root, outFile)} (${(html.length / 1024).toFixed(1)} KB)`)
