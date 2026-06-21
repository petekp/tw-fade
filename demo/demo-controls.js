// Interactive controls for the demo page.
// Depends on window.demoAnimations from demo-animations.js.

const surfaceButtons = Array.from(
  document.querySelectorAll("[data-surface-option]"),
);
const themeFaviconEnabled = Boolean(
  document.querySelector("[data-theme-favicon]"),
);
const floatingSurfacePalette = document.querySelector(
  "[data-floating-surface-palette]",
);
const rail = document.querySelector('[data-demo="rail"]');
const railCards = rail ? Array.from(rail.querySelectorAll(".rail-card")) : [];
const initialRailCardInset = 140;
const lexiconList = document.querySelector('[data-demo="list"]');
const lexiconRows = lexiconList
  ? Array.from(lexiconList.querySelectorAll(".lexicon-row"))
  : [];
const installCommand = document.querySelector("[data-install-command]");
const installCopyButton = document.querySelector("[data-copy-install]");
const installCopyIconStack = document.querySelector(".install-copy-icon-stack");
const installCopyStatus = document.querySelector("[data-copy-install-status]");
const fadeDepthSlider = document.querySelector("[data-fade-depth-slider]");
const fadeRangeSlider = document.querySelector("[data-fade-range-slider]");
const fadeOptionLabel = document.querySelector("[data-fade-option-label]");
const fadeDepthValue = document.querySelector("[data-fade-depth-value]");
const fadeRangeValue = document.querySelector("[data-fade-range-value]");
const fadeSpecimen = document.querySelector('[data-demo="type-specimen"]');
const fadeEdgeButtons = Array.from(
  document.querySelectorAll("[data-fade-edge-toggle]"),
);
const edgeGradientTipStops = Array.from(
  document.querySelectorAll(".edge-toggle-gradient-tip"),
);
const fadeDepthSizes = [
  { className: "fade-size-sm", value: "sm", aria: "small" },
  { className: "fade-size-md", value: "md", aria: "medium" },
  { className: "fade-size-lg", value: "lg", aria: "large" },
  { className: "fade-size-xl", value: "xl", aria: "extra large" },
  {
    className: "fade-size-2xl",
    value: "2xl",
    aria: "double extra large",
  },
  {
    className: "fade-size-3xl",
    value: "3xl",
    aria: "triple extra large",
  },
  {
    className: "fade-size-4xl",
    value: "4xl",
    aria: "quadruple extra large",
  },
];
const fadeRanges = [
  { className: "fade-range-sm", value: "sm", aria: "small" },
  { className: "fade-range-md", value: "md", aria: "medium" },
  { className: "fade-range-lg", value: "lg", aria: "large" },
  {
    className: "fade-range-xl",
    value: "xl",
    aria: "extra large",
  },
  {
    className: "fade-range-2xl",
    value: "2xl",
    aria: "double extra large",
  },
  {
    className: "fade-range-3xl",
    value: "3xl",
    aria: "triple extra large",
  },
  {
    className: "fade-range-4xl",
    value: "4xl",
    aria: "quadruple extra large",
  },
];
const fadeEdgeOrder = ["t", "r", "b", "l"];
const fadeEdgeClassNames = fadeEdgeOrder.map((edge) => `fade-${edge}`);
const faviconSize = 256;
const faviconCells = 32;
const faviconBayer8 = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
];
const themedFaviconCells = createThemedFaviconCells();
let installCopyResetTimer = 0;
let installCommandFlashTimer = 0;
let installIconStackSpringControl = null;
const surfaceSpringControls = new WeakMap();
const surfaceInteractionState = new WeakMap();
const edgeToggleSpringControls = new WeakMap();
const edgeToggleInteractionState = new WeakMap();
const railSpringControls = new WeakMap();
const railLetterSpringControls = new WeakMap();
const railInteractionState = new WeakMap();
const lexiconWordSpringControls = new WeakMap();
const lexiconBarSpringControls = new WeakMap();
const lexiconInteractionState = new WeakMap();
const fadeOptionFlashControls = new WeakMap();
let fadeOptionReadoutState = null;

function prefersReducedSurfaceMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function createThemedFaviconCells() {
  const cellSize = faviconSize / faviconCells;
  const cells = [];

  for (let y = 0; y < faviconCells; y++) {
    for (let x = 0; x < faviconCells; x++) {
      const diagonal = (x + y) / (2 * (faviconCells - 1));
      const value = Math.max(0, Math.min(1, (diagonal - 0.22) / 0.52));
      const threshold = (faviconBayer8[y % 8][x % 8] + 0.5) / 64;
      cells.push({
        className: value >= threshold ? "favicon-light" : "favicon-dark",
        x: (x * cellSize).toFixed(3),
        y: (y * cellSize).toFixed(3),
        size: cellSize.toFixed(3),
      });
    }
  }

  return cells;
}

function themeColor(propertyName, fallback) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName)
    .trim();
  return value || fallback;
}

// The theme tokens resolve to oklch / display-p3; normalize to a concrete sRGB
// string the 2D canvas always understands before painting.
function resolveColor(value, fallback) {
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = fallback;
  ctx.fillStyle = value;
  return ctx.fillStyle;
}

// Paint the dither to a small canvas and return a PNG data URL. Chrome's
// favicon pipeline renders and refreshes PNG data URLs reliably; SVG data URLs
// are frequently ignored there (even valid ones that render fine in an <img>),
// which is why the tab icon never recolored. This is the canvas->PNG approach
// proven dynamic-favicon libraries rely on.
function renderThemedFaviconDataUrl() {
  const px = 64;
  const scale = px / faviconSize;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  const background = resolveColor(
    themeColor("--demo-page-bg", "#020617"),
    "#020617",
  );
  const accent = resolveColor(
    themeColor("--demo-accent-text", "#f8fafc"),
    "#f8fafc",
  );

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = accent;
  for (const cell of themedFaviconCells) {
    if (cell.className !== "favicon-light") continue;
    ctx.fillRect(
      Number(cell.x) * scale,
      Number(cell.y) * scale,
      Number(cell.size) * scale,
      Number(cell.size) * scale,
    );
  }
  return canvas.toDataURL("image/png");
}

function updateThemeFavicon() {
  if (!themeFaviconEnabled) return;
  const href = renderThemedFaviconDataUrl();
  // Remove every tab icon (the static .ico/.png fallbacks plus any prior
  // dynamic link) and install a single fresh one. A brand-new <link> is what
  // makes Chrome re-read the favicon, and clearing the competitors guarantees
  // this themed icon is the one it paints.
  for (const link of document.querySelectorAll('link[rel~="icon"]')) {
    link.remove();
  }
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.setAttribute("data-theme-favicon", "");
  link.href = href;
  document.head.appendChild(link);
}

function scheduleThemeFaviconUpdate() {
  if (!themeFaviconEnabled) return;
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(updateThemeFavicon);
    return;
  }
  updateThemeFavicon();
}

function setInstallIconStackScale(scale, animated = true, transition) {
  if (!installCopyIconStack) return;
  const animation = window.demoAnimations;
  installIconStackSpringControl?.stop?.();

  if (!animated || prefersReducedSurfaceMotion() || !animation?.animate) {
    installCopyIconStack.style.setProperty(
      "--install-icon-stack-scale",
      String(scale),
    );
    installIconStackSpringControl = null;
    return;
  }

  installIconStackSpringControl = animation.animate(
    installCopyIconStack,
    { "--install-icon-stack-scale": scale },
    transition ??
      animation.spring?.installIcon ?? {
        type: "spring",
        stiffness: 650,
        damping: 22,
        mass: 0.55,
        restDelta: 0.001,
      },
  );
}

function pressInstallCopyIcon() {
  setInstallIconStackScale(0.84, true);
}

function releaseInstallCopyIcon() {
  setInstallIconStackScale(1, true);
}

// On a successful copy: pop the checkmark up to ~1.5 (velocity-kicked spring)
// then let it settle back to 1.0 in one continuous bounce.
function bounceInstallCheckIcon() {
  setInstallIconStackScale(
    1,
    true,
    window.demoAnimations?.spring?.installCheck,
  );
}

function flashInstallCommand() {
  if (!installCommand) return;
  window.clearTimeout(installCommandFlashTimer);

  if (prefersReducedSurfaceMotion()) {
    installCommand.classList.remove("is-flashing");
    return;
  }

  installCommand.classList.add("is-flashing");
  installCommandFlashTimer = window.setTimeout(() => {
    installCommand.classList.remove("is-flashing");
  }, 160);
}

function surfaceStateFor(button) {
  const existing = surfaceInteractionState.get(button);
  if (existing) return existing;
  const next = { hovered: false, pressed: false };
  surfaceInteractionState.set(button, next);
  return next;
}

function setSurfaceScale(button, buttonScale, swatchScale, animated = true) {
  const control = surfaceSpringControls.get(button);
  control?.stop?.();

  const values = {
    "--surface-button-scale": buttonScale,
    "--surface-swatch-scale": swatchScale,
  };
  const animation = window.demoAnimations;

  if (!animated || prefersReducedSurfaceMotion() || !animation?.animate) {
    for (const [property, value] of Object.entries(values)) {
      button.style.setProperty(property, String(value));
    }
    surfaceSpringControls.delete(button);
    return;
  }

  surfaceSpringControls.set(
    button,
    animation.animate(
      button,
      values,
      animation.spring?.surface ?? {
        type: "spring",
        stiffness: 520,
        damping: 46,
        mass: 0.72,
        restDelta: 0.001,
      },
    ),
  );
}

function syncSurfaceButtonSpring(button, animated = true) {
  const state = surfaceStateFor(button);
  const checked = button.getAttribute("aria-checked") === "true";
  const buttonScale = state.pressed
    ? 0.92
    : checked
      ? 1.05
      : state.hovered
        ? 1.04
        : 1;
  const swatchScale = state.pressed
    ? checked
      ? 0.84
      : 0.5
    : checked
      ? 0.92
      : state.hovered
        ? 0.68
        : 0.54;

  setSurfaceScale(button, buttonScale, swatchScale, animated);
}

function springSurfaceSelection(button) {
  setSurfaceScale(button, 1.12, 1, true);
  window.setTimeout(() => {
    syncSurfaceButtonSpring(button, true);
  }, 120);
}

function edgeToggleStateFor(button) {
  const existing = edgeToggleInteractionState.get(button);
  if (existing) return existing;
  const next = { hovered: false, pressed: false };
  edgeToggleInteractionState.set(button, next);
  return next;
}

function setEdgeToggleValues(button, values, animated = true) {
  const controls = edgeToggleSpringControls.get(button);
  controls?.forEach((control) => control?.stop?.());

  const svg = button.querySelector(".edge-toggle-svg");
  const glow = button.querySelector(".edge-toggle-inner-glow");
  const gradientStops = button.querySelectorAll(".edge-toggle-gradient-stop");
  const svgValues = {};
  const glowValues = {};
  const gradientValues = {};

  for (const [property, value] of Object.entries(values)) {
    if (
      property === "--edge-toggle-active" ||
      property === "--edge-toggle-hover"
    ) {
      gradientValues[property] = value;
    } else if (property === "edgeGlowOpacity") {
      glowValues.opacity = value;
    } else {
      svgValues[property] = value;
    }
  }

  const animation = window.demoAnimations;
  if (!animated || prefersReducedSurfaceMotion() || !animation?.animate) {
    if (svg) {
      for (const [property, value] of Object.entries(svgValues)) {
        svg.style.setProperty(property, String(value));
      }
    }
    if (gradientStops.length) {
      for (const [property, value] of Object.entries(gradientValues)) {
        gradientStops.forEach((stop) => {
          stop.style.setProperty(property, String(value));
        });
      }
    }
    if (glow) {
      for (const [property, value] of Object.entries(glowValues)) {
        glow.style.setProperty(property, String(value));
      }
    }
    edgeToggleSpringControls.delete(button);
    return;
  }

  const edgeSpring = animation.spring?.edge ?? {
    type: "spring",
    stiffness: 560,
    damping: 46,
    mass: 0.7,
    restDelta: 0.001,
  };
  const nextControls = [];

  if (svg && Object.keys(svgValues).length) {
    nextControls.push(animation.animate(svg, svgValues, edgeSpring));
  }
  if (gradientStops.length && Object.keys(gradientValues).length) {
    gradientStops.forEach((stop) => {
      nextControls.push(animation.animate(stop, gradientValues, edgeSpring));
    });
  }
  if (glow && Object.keys(glowValues).length) {
    nextControls.push(animation.animate(glow, glowValues, edgeSpring));
  }
  edgeToggleSpringControls.set(button, nextControls);
}

function syncEdgeToggleSpring(button, animated = true) {
  const state = edgeToggleStateFor(button);
  const active = button.getAttribute("aria-pressed") === "true";
  const scale = state.pressed
    ? 0.965
    : active
      ? state.hovered
        ? 1.015
        : 1
      : state.hovered
        ? 1.01
        : 1;
  const glowOpacity = active ? 0 : state.hovered ? 0.16 : 0.08;

  setEdgeToggleValues(
    button,
    {
      "--edge-toggle-active": active ? 1 : 0,
      "--edge-toggle-hover": state.hovered ? 1 : 0,
      "--edge-toggle-scale": scale,
      edgeGlowOpacity: glowOpacity,
    },
    animated,
  );
}

function springEdgeToggleSelection(button) {
  const state = edgeToggleStateFor(button);
  const active = button.getAttribute("aria-pressed") === "true";
  setEdgeToggleValues(
    button,
    {
      "--edge-toggle-active": active ? 1 : 0,
      "--edge-toggle-hover": state.hovered ? 1 : 0,
      "--edge-toggle-scale": active ? 1.035 : 0.975,
      edgeGlowOpacity: active ? 0 : 0.2,
    },
    true,
  );
  window.setTimeout(() => {
    syncEdgeToggleSpring(button, true);
  }, 120);
}

function railStateFor(card) {
  const existing = railInteractionState.get(card);
  if (existing) return existing;
  const next = { hovered: false, pressed: false };
  railInteractionState.set(card, next);
  return next;
}

function setRailValues(card, cardValues, letterValues, animated = true) {
  const cardControl = railSpringControls.get(card);
  const letterControl = railLetterSpringControls.get(card);
  const letter = card.querySelector(".rail-card-initial");
  cardControl?.stop?.();
  letterControl?.stop?.();

  const animation = window.demoAnimations;
  if (!animated || prefersReducedSurfaceMotion() || !animation?.animate) {
    for (const [property, value] of Object.entries(cardValues)) {
      card.style.setProperty(property, String(value));
    }
    if (letter) {
      for (const [property, value] of Object.entries(letterValues)) {
        letter.style.setProperty(property, String(value));
      }
    }
    railSpringControls.delete(card);
    railLetterSpringControls.delete(card);
    return;
  }

  const railSpring = animation.spring?.rail ?? {
    type: "spring",
    stiffness: 520,
    damping: 48,
    mass: 0.75,
    restDelta: 0.001,
  };
  railSpringControls.set(card, animation.animate(card, cardValues, railSpring));
  if (letter) {
    railLetterSpringControls.set(
      card,
      animation.animate(letter, letterValues, railSpring),
    );
  }
}

function syncRailCardSpring(card, animated = true) {
  const state = railStateFor(card);
  const selected = card.getAttribute("aria-selected") === "true";
  const cardScale = state.pressed
    ? 0.965
    : selected
      ? state.hovered
        ? 1.035
        : 1.01
      : state.hovered
        ? 1.03
        : 1;
  const letterScale = state.pressed
    ? selected
      ? 1.04
      : 0.98
    : selected
      ? state.hovered
        ? 1.12
        : 1.08
      : state.hovered
        ? 1.06
        : 1;

  setRailValues(
    card,
    {
      "--rail-card-scale": cardScale,
    },
    {
      "--rail-letter-scale": letterScale,
      "--rail-letter-active": selected ? 1 : 0,
    },
    animated,
  );
}

function springRailSelection(card) {
  const state = railStateFor(card);
  setRailValues(
    card,
    {
      "--rail-card-scale": state.hovered ? 1.04 : 1.03,
    },
    {
      "--rail-letter-scale": 1.15,
      "--rail-letter-active": 1,
    },
    true,
  );
  window.setTimeout(() => {
    syncRailCardSpring(card, true);
  }, 130);
}

function initRailLetterLayers() {
  const letters = railCards
    .map((card) => card.querySelector(".rail-card-initial"))
    .filter(Boolean);
  for (const letter of letters) {
    letter.dataset.railLetter = letter.textContent.trim();
  }
  if (letters.length) {
    document.documentElement.dataset.railLetterLayers = "true";
  }
}

function setSurface(nextSurface, sourceButton = null) {
  document.documentElement.dataset.surface = nextSurface;
  scheduleThemeFaviconUpdate();
  for (const button of surfaceButtons) {
    const checked = button.dataset.surfaceOption === nextSurface;
    button.setAttribute("aria-checked", String(checked));
    syncSurfaceButtonSpring(button, true);
  }
  if (sourceButton) springSurfaceSelection(sourceButton);
}

function selectRailCard(nextCard, animated = true) {
  for (const card of railCards) {
    card.setAttribute("aria-selected", String(card === nextCard));
    syncRailCardSpring(card, animated);
  }
  if (animated) springRailSelection(nextCard);
}

function alignInitialRailScroll() {
  if (!rail || !railCards.length) return;

  const selectedCard =
    railCards.find((card) => card.getAttribute("aria-selected") === "true") ??
    railCards[0];
  const railRect = rail.getBoundingClientRect();
  const cardRect = selectedCard.getBoundingClientRect();
  const nextScrollLeft =
    rail.scrollLeft + cardRect.left - railRect.left - initialRailCardInset;
  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);

  rail.scrollLeft = Math.min(maxScrollLeft, Math.max(0, nextScrollLeft));
}

// --- Lexicon (Vertical / fade-y demo) -------------------------------------
// A scrollable glossary of fade words. Hover/press spring the word, click (or
// arrow keys) spotlights a word in the accent color and scrolls it to the
// crisp center band, so the list reads as words dissolving past the fade edge.

function lexiconStateFor(row) {
  const existing = lexiconInteractionState.get(row);
  if (existing) return existing;
  const next = { hovered: false, pressed: false };
  lexiconInteractionState.set(row, next);
  return next;
}

function setLexiconWordScale(row, scale, animated = true) {
  const word = row.querySelector(".lexicon-word");
  if (!word) return;
  const control = lexiconWordSpringControls.get(row);
  control?.stop?.();

  const animation = window.demoAnimations;
  if (!animated || prefersReducedSurfaceMotion() || !animation?.animate) {
    word.style.setProperty("--lex-word-scale", String(scale));
    lexiconWordSpringControls.delete(row);
    return;
  }

  const railSpring = animation.spring?.rail ?? {
    type: "spring",
    stiffness: 520,
    damping: 48,
    mass: 0.75,
    restDelta: 0.001,
  };
  lexiconWordSpringControls.set(
    row,
    animation.animate(word, { "--lex-word-scale": scale }, railSpring),
  );
}

// The accent notch on a row's leading edge. It grows from --lex-bar-scale 0
// (height collapsed) to 1 (full height) via a soft spring so a freshly
// selected word's marker springs elegantly into place.
function setLexiconBarScale(row, scale, animated = true) {
  const control = lexiconBarSpringControls.get(row);
  control?.stop?.();

  const animation = window.demoAnimations;
  if (!animated || prefersReducedSurfaceMotion() || !animation?.animate) {
    row.style.setProperty("--lex-bar-scale", String(scale));
    lexiconBarSpringControls.delete(row);
    return;
  }

  const barSpring = animation.spring?.lexBar ?? {
    type: "spring",
    stiffness: 500,
    damping: 28,
    mass: 1,
    restDelta: 0.001,
  };
  lexiconBarSpringControls.set(
    row,
    animation.animate(row, { "--lex-bar-scale": scale }, barSpring),
  );
}

function syncLexiconRow(row, animated = true) {
  const state = lexiconStateFor(row);
  const selected = row.getAttribute("aria-selected") === "true";
  const scale = state.pressed
    ? selected
      ? 1.02
      : 0.98
    : selected
      ? state.hovered
        ? 1.07
        : 1.05
      : state.hovered
        ? 1.04
        : 1;
  setLexiconWordScale(row, scale, animated);
}

function springLexiconSelection(row) {
  setLexiconWordScale(row, 1.1, true);
  window.setTimeout(() => {
    syncLexiconRow(row, true);
  }, 130);
}

// Hand-rolled smooth scroll. Native scroll-behavior:smooth is unreliable
// (and untestable in headless), so we tween scrollTop ourselves with an
// ease-out curve — consistent with the demo's local animation runtime.
let lexiconScrollFrame = 0;

function animateLexiconScrollTop(target, duration = 460) {
  if (!lexiconList) return;
  window.cancelAnimationFrame(lexiconScrollFrame);
  const start = lexiconList.scrollTop;
  const delta = target - start;
  if (prefersReducedSurfaceMotion() || Math.abs(delta) < 1) {
    lexiconList.scrollTop = target;
    lexiconList.style.scrollSnapType = "";
    return;
  }
  // Suspend CSS scroll snapping while we drive scrollTop frame-by-frame, so the
  // browser's proximity snap doesn't fight (and stutter against) the tween. It
  // is restored on the final frame, which already lands on a snap point.
  lexiconList.style.scrollSnapType = "none";
  const begin = performance.now();
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const step = (now) => {
    const progress = Math.min(1, (now - begin) / duration);
    lexiconList.scrollTop = start + delta * easeOutCubic(progress);
    if (progress < 1) {
      lexiconScrollFrame = window.requestAnimationFrame(step);
    } else {
      lexiconList.style.scrollSnapType = "";
    }
  };
  lexiconScrollFrame = window.requestAnimationFrame(step);
}

function scrollLexiconRowToCenter(row, animated = true) {
  if (!lexiconList) return;
  const listRect = lexiconList.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const nextScrollTop =
    lexiconList.scrollTop +
    (rowRect.top - listRect.top) -
    (lexiconList.clientHeight - rowRect.height) / 2;
  const maxScrollTop = Math.max(
    0,
    lexiconList.scrollHeight - lexiconList.clientHeight,
  );
  const top = Math.min(maxScrollTop, Math.max(0, nextScrollTop));
  if (animated) {
    animateLexiconScrollTop(top);
  } else {
    window.cancelAnimationFrame(lexiconScrollFrame);
    lexiconList.scrollTop = top;
    // A direct jump may interrupt an in-flight tween; make sure snapping is
    // re-enabled so the resting scroll position still anchors to a row edge.
    lexiconList.style.scrollSnapType = "";
  }
}

function selectLexiconRow(nextRow, { animated = true, scroll = true } = {}) {
  const prevRow = lexiconRows.find(
    (row) => row.getAttribute("aria-selected") === "true",
  );
  const prevIndex = prevRow ? lexiconRows.indexOf(prevRow) : -1;
  const nextIndex = lexiconRows.indexOf(nextRow);
  const movingDown = prevIndex >= 0 && prevIndex < nextIndex;
  // Both bands travel in the direction of the selection. The incoming tint
  // wipes in from the edge facing where we came from; the outgoing tint
  // retreats toward the edge facing where we're going. Moving down: the new
  // row fills from its top while the old row empties toward its bottom; moving
  // up, the reverse. (transform-origin drives the scaleY wipe in CSS.)
  nextRow.dataset.tintFrom = movingDown ? "top" : "bottom";
  if (prevRow && prevRow !== nextRow) {
    prevRow.dataset.tintFrom = movingDown ? "bottom" : "top";
  }

  for (const row of lexiconRows) {
    const isSelected = row === nextRow;
    row.setAttribute("aria-selected", String(isSelected));
    syncLexiconRow(row, animated);
    setLexiconBarScale(row, isSelected ? 1 : 0, animated);
  }
  if (animated) springLexiconSelection(nextRow);
  if (scroll) scrollLexiconRowToCenter(nextRow);
}

function edgeUtilities(activeEdges) {
  const has = (edge) => activeEdges.includes(edge);

  if (has("t") && has("r") && has("b") && has("l")) return ["fade-xy"];
  if (has("t") && has("b") && activeEdges.length === 2) return ["fade-y"];
  if (has("l") && has("r") && activeEdges.length === 2) return ["fade-x"];
  return activeEdges.map((edge) => `fade-${edge}`);
}

function syncSliderKnob(slider) {
  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const value = Number(slider.value || min);
  const progress = max === min ? 0 : (value - min) / (max - min);
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const wrapper = slider.closest(".option-slider-control");
  wrapper?.style.setProperty("--slider-progress", String(clampedProgress));
  wrapper?.style.setProperty("--slider-fill", `${clampedProgress * 100}%`);
}

function syncEdgeGradientDepth(depthIndex) {
  const maxDepthIndex = Math.max(1, fadeDepthSizes.length - 1);
  const depthProgress = Math.min(1, Math.max(0, depthIndex / maxDepthIndex));
  const accentOffset = 0.38 + depthProgress * 0.3;

  for (const stop of edgeGradientTipStops) {
    stop.setAttribute("offset", accentOffset.toFixed(3));
  }
}

function fadeUtilityParts(className) {
  const prefix =
    ["fade-size-", "fade-range-", "fade-"].find((candidate) =>
      className.startsWith(candidate),
    ) ?? "";
  return {
    prefix,
    stem: prefix ? className.slice(prefix.length) : className,
  };
}

function createFadeOptionToken(className, flashMode, flashTargets) {
  const token = document.createElement("span");
  const { prefix, stem } = fadeUtilityParts(className);

  token.className = "fade-option-token";
  token.dataset.fadeOptionToken = className;

  const prefixPart = document.createElement("span");
  prefixPart.className = "fade-option-part";
  prefixPart.textContent = prefix;
  token.append(prefixPart);

  const stemPart = document.createElement("span");
  stemPart.className = "fade-option-part";
  stemPart.dataset.fadeOptionStem = "";
  stemPart.textContent = stem;
  token.append(stemPart);

  if (flashMode === "token") {
    flashTargets.push(prefixPart, stemPart);
  } else if (flashMode === "stem") {
    flashTargets.push(stemPart);
  }

  return token;
}

function flashFadeOptionParts(parts) {
  if (!parts.length) return;

  for (const part of parts) {
    const existing = fadeOptionFlashControls.get(part);
    window.clearTimeout(existing);

    if (prefersReducedSurfaceMotion()) {
      part.classList.remove("is-flashing");
      fadeOptionFlashControls.delete(part);
      continue;
    }

    part.classList.add("is-flashing");
    const timer = window.setTimeout(() => {
      part.classList.remove("is-flashing");
      fadeOptionFlashControls.delete(part);
    }, 160);
    fadeOptionFlashControls.set(part, timer);
  }
}

function setFadeOptionLabel(edgeClasses, sizeClass, rangeClass) {
  const nextState = {
    edgeClasses: [...edgeClasses],
    sizeClass,
    rangeClass,
  };
  const previous = fadeOptionReadoutState;
  const flashTargets = [];
  const fragment = document.createDocumentFragment();
  const fullClassName = [...edgeClasses, sizeClass, rangeClass].join(" ");
  const previousEdgeClasses = previous?.edgeClasses ?? [];
  const edgeStemChanged =
    previous &&
    previousEdgeClasses.length === 1 &&
    edgeClasses.length === 1 &&
    previousEdgeClasses[0] !== edgeClasses[0];

  const appendToken = (className, flashMode) => {
    if (fragment.childNodes.length) {
      fragment.append(document.createTextNode(" "));
    }
    fragment.append(
      createFadeOptionToken(
        className,
        previous ? flashMode : "none",
        flashTargets,
      ),
    );
  };

  for (const className of edgeClasses) {
    const flashMode = edgeStemChanged
      ? "stem"
      : previousEdgeClasses.includes(className)
        ? "none"
        : "token";
    appendToken(className, flashMode);
  }

  appendToken(sizeClass, previous?.sizeClass === sizeClass ? "none" : "stem");
  appendToken(
    rangeClass,
    previous?.rangeClass === rangeClass ? "none" : "stem",
  );

  fadeOptionLabel.replaceChildren(fragment);
  fadeOptionLabel.setAttribute("aria-label", fullClassName);
  fadeOptionReadoutState = nextState;
  flashFadeOptionParts(flashTargets);
}

function setFadeControls() {
  if (
    !fadeDepthSlider ||
    !fadeRangeSlider ||
    !fadeOptionLabel ||
    !fadeDepthValue ||
    !fadeRangeValue ||
    !fadeSpecimen
  )
    return;

  const depthIndex = Math.min(
    fadeDepthSizes.length - 1,
    Math.max(0, Number(fadeDepthSlider.value)),
  );
  const rangeIndex = Math.min(
    fadeRanges.length - 1,
    Math.max(0, Number(fadeRangeSlider.value)),
  );
  const nextSize = fadeDepthSizes[depthIndex];
  const nextRange = fadeRanges[rangeIndex];
  const activeEdges = fadeEdgeOrder.filter((edge) => {
    const button = fadeEdgeButtons.find(
      (candidate) => candidate.dataset.fadeEdgeToggle === edge,
    );
    return button?.getAttribute("aria-pressed") === "true";
  });
  const edgeClasses = edgeUtilities(activeEdges);
  const utilityClasses = [
    ...edgeClasses,
    nextSize.className,
    nextRange.className,
  ];

  fadeSpecimen.classList.remove(
    ...fadeEdgeClassNames,
    "fade-y",
    "fade-x",
    "fade-xy",
    ...fadeDepthSizes.map((size) => size.className),
    ...fadeRanges.map((range) => range.className),
  );
  fadeSpecimen.classList.add(...utilityClasses);
  setFadeOptionLabel(edgeClasses, nextSize.className, nextRange.className);
  fadeDepthValue.textContent = nextSize.value;
  fadeRangeValue.textContent = nextRange.value;
  fadeDepthSlider.setAttribute("aria-valuetext", nextSize.aria);
  fadeRangeSlider.setAttribute("aria-valuetext", nextRange.aria);
  syncSliderKnob(fadeDepthSlider);
  syncSliderKnob(fadeRangeSlider);
  syncEdgeGradientDepth(depthIndex);
}

function setFloatingPaletteVisible(nextVisible) {
  floatingSurfacePalette.dataset.visible = String(nextVisible);
  floatingSurfacePalette.setAttribute("aria-hidden", String(!nextVisible));
  for (const button of floatingSurfacePalette.querySelectorAll(
    "[data-surface-option]",
  )) {
    button.tabIndex = nextVisible ? 0 : -1;
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Local file previews can deny Clipboard API access; fall back below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy command failed");
}

for (const button of surfaceButtons) {
  syncSurfaceButtonSpring(button, false);

  button.addEventListener("pointerenter", () => {
    surfaceStateFor(button).hovered = true;
    syncSurfaceButtonSpring(button, true);
  });
  button.addEventListener("pointerleave", () => {
    const state = surfaceStateFor(button);
    state.hovered = false;
    state.pressed = false;
    syncSurfaceButtonSpring(button, true);
  });
  button.addEventListener("pointerdown", () => {
    surfaceStateFor(button).pressed = true;
    syncSurfaceButtonSpring(button, true);
  });
  button.addEventListener("pointerup", () => {
    surfaceStateFor(button).pressed = false;
    syncSurfaceButtonSpring(button, true);
  });
  button.addEventListener("pointercancel", () => {
    surfaceStateFor(button).pressed = false;
    syncSurfaceButtonSpring(button, true);
  });
  button.addEventListener("blur", () => {
    const state = surfaceStateFor(button);
    state.hovered = false;
    state.pressed = false;
    syncSurfaceButtonSpring(button, true);
  });
  button.addEventListener("click", () => {
    setSurface(button.dataset.surfaceOption, button);
  });
  button.addEventListener("keydown", (event) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!direction) return;
    event.preventDefault();
    const groupButtons = Array.from(
      button
        .closest("[data-surface-group]")
        .querySelectorAll("[data-surface-option]"),
    );
    const nextIndex =
      (groupButtons.indexOf(button) + direction + groupButtons.length) %
      groupButtons.length;
    groupButtons[nextIndex].focus();
    setSurface(
      groupButtons[nextIndex].dataset.surfaceOption,
      groupButtons[nextIndex],
    );
  });
}

updateThemeFavicon();
initRailLetterLayers();

for (const card of railCards) {
  syncRailCardSpring(card, false);

  card.addEventListener("pointerenter", () => {
    railStateFor(card).hovered = true;
    syncRailCardSpring(card, true);
  });
  card.addEventListener("pointerleave", () => {
    const state = railStateFor(card);
    state.hovered = false;
    state.pressed = false;
    syncRailCardSpring(card, true);
  });
  card.addEventListener("pointerdown", () => {
    railStateFor(card).pressed = true;
    syncRailCardSpring(card, true);
  });
  card.addEventListener("pointerup", () => {
    railStateFor(card).pressed = false;
    syncRailCardSpring(card, true);
  });
  card.addEventListener("pointercancel", () => {
    railStateFor(card).pressed = false;
    syncRailCardSpring(card, true);
  });
  card.addEventListener("blur", () => {
    const state = railStateFor(card);
    state.hovered = false;
    state.pressed = false;
    syncRailCardSpring(card, true);
  });
  card.addEventListener("click", () => {
    selectRailCard(card);
  });
}

window.requestAnimationFrame(alignInitialRailScroll);

for (const row of lexiconRows) {
  syncLexiconRow(row, false);
  // Start every notch collapsed; the preselected row's springs in on load.
  setLexiconBarScale(row, 0, false);

  row.addEventListener("pointerenter", () => {
    lexiconStateFor(row).hovered = true;
    syncLexiconRow(row, true);
  });
  row.addEventListener("pointerleave", () => {
    const state = lexiconStateFor(row);
    state.hovered = false;
    state.pressed = false;
    syncLexiconRow(row, true);
  });
  row.addEventListener("pointerdown", () => {
    lexiconStateFor(row).pressed = true;
    syncLexiconRow(row, true);
  });
  row.addEventListener("pointerup", () => {
    lexiconStateFor(row).pressed = false;
    syncLexiconRow(row, true);
  });
  row.addEventListener("pointercancel", () => {
    lexiconStateFor(row).pressed = false;
    syncLexiconRow(row, true);
  });
  row.addEventListener("blur", () => {
    const state = lexiconStateFor(row);
    state.hovered = false;
    state.pressed = false;
    syncLexiconRow(row, true);
  });
  row.addEventListener("click", () => {
    selectLexiconRow(row);
  });
}

if (lexiconList) {
  // Arrow / Home / End move the spotlight; the active word scrolls to center.
  lexiconList.addEventListener("keydown", (event) => {
    const current =
      lexiconRows.find((row) => row.getAttribute("aria-selected") === "true") ??
      lexiconRows[0];
    const index = lexiconRows.indexOf(current);
    let nextIndex = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = Math.min(lexiconRows.length - 1, index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = Math.max(0, index - 1);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lexiconRows.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextRow = lexiconRows[nextIndex];
    selectLexiconRow(nextRow);
    // preventScroll: let our smooth scroll-to-center own the motion instead of
    // the browser snapping focus into view instantly.
    nextRow.focus({ preventScroll: true });
  });

  // Center the pre-selected word on load, without animating the scroll, then
  // spring its notch in from nothing so the default selection announces itself.
  window.requestAnimationFrame(() => {
    const selected =
      lexiconRows.find((row) => row.getAttribute("aria-selected") === "true") ??
      lexiconRows[0];
    if (selected) {
      scrollLexiconRowToCenter(selected, false);
      setLexiconBarScale(selected, 1, true);
    }
  });
}

if (installCopyButton) {
  setInstallIconStackScale(1, false);

  installCopyButton.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    installCopyButton.setPointerCapture?.(event.pointerId);
    pressInstallCopyIcon();
  });
  installCopyButton.addEventListener("pointerup", releaseInstallCopyIcon);
  installCopyButton.addEventListener("pointercancel", releaseInstallCopyIcon);
  installCopyButton.addEventListener(
    "lostpointercapture",
    releaseInstallCopyIcon,
  );
  installCopyButton.addEventListener("blur", releaseInstallCopyIcon);
  installCopyButton.addEventListener("keydown", (event) => {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) {
      return;
    }
    pressInstallCopyIcon();
  });
  installCopyButton.addEventListener("keyup", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    releaseInstallCopyIcon();
  });
}

installCopyButton?.addEventListener("click", async () => {
  const command = installCommand?.textContent.trim() || "npm i tw-fade";
  window.clearTimeout(installCopyResetTimer);

  try {
    await copyText(command);
    document.dispatchEvent(new CustomEvent("tw-fade:copy-sweep"));
    flashInstallCommand();
    bounceInstallCheckIcon();
    installCopyButton.dataset.copied = "true";
    installCopyButton.setAttribute("aria-label", "Copied npm install command");
    installCopyStatus.textContent = `Copied ${command}`;
  } catch {
    installCopyButton.dataset.copied = "false";
    installCopyButton.setAttribute("aria-label", "Copy npm install command");
    installCopyStatus.textContent = "Copy failed";
    return;
  }

  installCopyResetTimer = window.setTimeout(() => {
    installCopyButton.dataset.copied = "false";
    installCopyButton.setAttribute("aria-label", "Copy npm install command");
  }, 2000);
});

fadeDepthSlider?.addEventListener("input", (event) => {
  setFadeControls();
});

fadeRangeSlider?.addEventListener("input", () => {
  setFadeControls();
});

for (const button of fadeEdgeButtons) {
  syncEdgeToggleSpring(button, false);

  button.addEventListener("pointerenter", () => {
    edgeToggleStateFor(button).hovered = true;
    syncEdgeToggleSpring(button, true);
  });
  button.addEventListener("pointerleave", () => {
    const state = edgeToggleStateFor(button);
    state.hovered = false;
    state.pressed = false;
    syncEdgeToggleSpring(button, true);
  });
  button.addEventListener("pointerdown", () => {
    edgeToggleStateFor(button).pressed = true;
    syncEdgeToggleSpring(button, true);
  });
  button.addEventListener("pointerup", () => {
    edgeToggleStateFor(button).pressed = false;
    syncEdgeToggleSpring(button, true);
  });
  button.addEventListener("pointercancel", () => {
    edgeToggleStateFor(button).pressed = false;
    syncEdgeToggleSpring(button, true);
  });
  button.addEventListener("blur", () => {
    const state = edgeToggleStateFor(button);
    state.hovered = false;
    state.pressed = false;
    syncEdgeToggleSpring(button, true);
  });
  button.addEventListener("click", () => {
    const isPressed = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!isPressed));
    springEdgeToggleSelection(button);
    setFadeControls();
  });
}

setFadeControls();

function syncFloatingPalette() {
  setFloatingPaletteVisible(document.body.scrollTop > 24);
}

document.body.addEventListener("scroll", syncFloatingPalette, {
  passive: true,
});
syncFloatingPalette();
