// Interactive controls for the demo page.
// Depends on window.demoAnimations from demo-animations.js.

const surfaceButtons = Array.from(
    document.querySelectorAll("[data-surface-option]"),
);
const floatingSurfacePalette = document.querySelector(
    "[data-floating-surface-palette]",
);
const rail = document.querySelector('[data-demo="rail"]');
const railCards = rail
    ? Array.from(rail.querySelectorAll(".rail-card"))
    : [];
const initialRailCardInset = 140;
const installCommand = document.querySelector(
    "[data-install-command]",
);
const installCopyButton = document.querySelector(
    "[data-copy-install]",
);
const installCopyStatus = document.querySelector(
    "[data-copy-install-status]",
);
const fadeDepthSlider = document.querySelector(
    "[data-fade-depth-slider]",
);
const fadeRangeSlider = document.querySelector(
    "[data-fade-range-slider]",
);
const fadeOptionLabel = document.querySelector(
    "[data-fade-option-label]",
);
const fadeDepthValue = document.querySelector(
    "[data-fade-depth-value]",
);
const fadeRangeValue = document.querySelector(
    "[data-fade-range-value]",
);
const fadeSpecimen = document.querySelector(
    '[data-demo="type-specimen"]',
);
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
const fadeEdgeClassNames = fadeEdgeOrder.map(
    (edge) => `fade-${edge}`,
);
let installCopyResetTimer = 0;
const surfaceSpringControls = new WeakMap();
const surfaceInteractionState = new WeakMap();
const edgeToggleSpringControls = new WeakMap();
const edgeToggleInteractionState = new WeakMap();
const railSpringControls = new WeakMap();
const railLetterSpringControls = new WeakMap();
const railInteractionState = new WeakMap();
const fadeOptionFlashControls = new WeakMap();
let fadeOptionReadoutState = null;

function prefersReducedSurfaceMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")
        .matches;
}

function surfaceStateFor(button) {
    const existing = surfaceInteractionState.get(button);
    if (existing) return existing;
    const next = { hovered: false, pressed: false };
    surfaceInteractionState.set(button, next);
    return next;
}

function setSurfaceScale(
    button,
    buttonScale,
    swatchScale,
    animated = true,
) {
    const control = surfaceSpringControls.get(button);
    control?.stop?.();

    const values = {
        "--surface-button-scale": buttonScale,
        "--surface-swatch-scale": swatchScale,
    };
    const animation = window.demoAnimations;

    if (
        !animated ||
        prefersReducedSurfaceMotion() ||
        !animation?.animate
    ) {
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
    const gradientStops = button.querySelectorAll(
        ".edge-toggle-gradient-stop",
    );
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
    if (
        !animated ||
        prefersReducedSurfaceMotion() ||
        !animation?.animate
    ) {
        if (svg) {
            for (const [property, value] of Object.entries(
                svgValues,
            )) {
                svg.style.setProperty(property, String(value));
            }
        }
        if (gradientStops.length) {
            for (const [property, value] of Object.entries(
                gradientValues,
            )) {
                gradientStops.forEach((stop) => {
                    stop.style.setProperty(
                        property,
                        String(value),
                    );
                });
            }
        }
        if (glow) {
            for (const [property, value] of Object.entries(
                glowValues,
            )) {
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
        nextControls.push(
            animation.animate(svg, svgValues, edgeSpring),
        );
    }
    if (gradientStops.length && Object.keys(gradientValues).length) {
        gradientStops.forEach((stop) => {
            nextControls.push(
                animation.animate(stop, gradientValues, edgeSpring),
            );
        });
    }
    if (glow && Object.keys(glowValues).length) {
        nextControls.push(
            animation.animate(glow, glowValues, edgeSpring),
        );
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
    const glowOpacity = active ? 0 : state.hovered ? 0.38 : 0.28;

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
            edgeGlowOpacity: active ? 0 : 0.42,
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

function setRailValues(
    card,
    cardValues,
    letterValues,
    animated = true,
) {
    const cardControl = railSpringControls.get(card);
    const letterControl = railLetterSpringControls.get(card);
    const letter = card.querySelector(".rail-card-initial");
    cardControl?.stop?.();
    letterControl?.stop?.();

    const animation = window.demoAnimations;
    if (
        !animated ||
        prefersReducedSurfaceMotion() ||
        !animation?.animate
    ) {
        for (const [property, value] of Object.entries(
            cardValues,
        )) {
            card.style.setProperty(property, String(value));
        }
        if (letter) {
            for (const [property, value] of Object.entries(
                letterValues,
            )) {
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
    railSpringControls.set(
        card,
        animation.animate(card, cardValues, railSpring),
    );
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
            "--rail-card-active": selected ? 1 : 0,
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
            "--rail-card-active": 1,
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

function setSurface(nextSurface, sourceButton = null) {
    document.documentElement.dataset.surface = nextSurface;
    for (const button of surfaceButtons) {
        const checked =
            button.dataset.surfaceOption === nextSurface;
        button.setAttribute("aria-checked", String(checked));
        syncSurfaceButtonSpring(button, true);
    }
    if (sourceButton) springSurfaceSelection(sourceButton);
}

function selectRailCard(nextCard, animated = true) {
    for (const card of railCards) {
        card.setAttribute(
            "aria-selected",
            String(card === nextCard),
        );
        syncRailCardSpring(card, animated);
    }
    if (animated) springRailSelection(nextCard);
}

function alignInitialRailScroll() {
    if (!rail || !railCards.length) return;

    const selectedCard =
        railCards.find(
            (card) =>
                card.getAttribute("aria-selected") === "true",
        ) ?? railCards[0];
    const railRect = rail.getBoundingClientRect();
    const cardRect = selectedCard.getBoundingClientRect();
    const nextScrollLeft =
        rail.scrollLeft +
        cardRect.left -
        railRect.left -
        initialRailCardInset;
    const maxScrollLeft = Math.max(
        0,
        rail.scrollWidth - rail.clientWidth,
    );

    rail.scrollLeft = Math.min(
        maxScrollLeft,
        Math.max(0, nextScrollLeft),
    );
}

function edgeUtilities(activeEdges) {
    const has = (edge) => activeEdges.includes(edge);

    if (has("t") && has("r") && has("b") && has("l"))
        return ["fade-xy"];
    if (has("t") && has("b") && activeEdges.length === 2)
        return ["fade-y"];
    if (has("l") && has("r") && activeEdges.length === 2)
        return ["fade-x"];
    return activeEdges.map((edge) => `fade-${edge}`);
}

function syncSliderKnob(slider) {
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const value = Number(slider.value || min);
    const progress = max === min ? 0 : (value - min) / (max - min);
    const clampedProgress = Math.min(1, Math.max(0, progress));
    const wrapper = slider.closest(".option-slider-control");
    wrapper?.style.setProperty(
        "--slider-progress",
        String(clampedProgress),
    );
    wrapper?.style.setProperty(
        "--slider-fill",
        `${clampedProgress * 100}%`,
    );
}

function syncEdgeGradientDepth(depthIndex) {
    const maxDepthIndex = Math.max(1, fadeDepthSizes.length - 1);
    const depthProgress = Math.min(
        1,
        Math.max(0, depthIndex / maxDepthIndex),
    );
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
        existing?.cancel?.();

        if (prefersReducedSurfaceMotion()) {
            part.style.removeProperty("--fade-option-flash");
            fadeOptionFlashControls.delete(part);
            continue;
        }

        const animation = part.animate(
            [
                { "--fade-option-flash": "1" },
                { "--fade-option-flash": "0" },
            ],
            {
                duration: 6000,
                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                fill: "both",
            },
        );
        fadeOptionFlashControls.set(part, animation);
        animation.finished
            .catch(() => {})
            .finally(() => {
                if (fadeOptionFlashControls.get(part) !== animation)
                    return;
                animation.cancel();
                fadeOptionFlashControls.delete(part);
            });
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
    const fullClassName = [
        ...edgeClasses,
        sizeClass,
        rangeClass,
    ].join(" ");
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

    appendToken(
        sizeClass,
        previous?.sizeClass === sizeClass ? "none" : "stem",
    );
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
            (candidate) =>
                candidate.dataset.fadeEdgeToggle === edge,
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
    setFadeOptionLabel(
        edgeClasses,
        nextSize.className,
        nextRange.className,
    );
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
    floatingSurfacePalette.setAttribute(
        "aria-hidden",
        String(!nextVisible),
    );
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
                : event.key === "ArrowLeft" ||
                    event.key === "ArrowUp"
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
            (groupButtons.indexOf(button) +
                direction +
                groupButtons.length) %
            groupButtons.length;
        groupButtons[nextIndex].focus();
        setSurface(
            groupButtons[nextIndex].dataset.surfaceOption,
            groupButtons[nextIndex],
        );
    });
}

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

installCopyButton?.addEventListener("click", async () => {
    const command =
        installCommand?.textContent.trim() || "npm i tw-fade";
    window.clearTimeout(installCopyResetTimer);

    try {
        await copyText(command);
        document.dispatchEvent(
            new CustomEvent("tw-fade:copy-sweep"),
        );
        installCopyButton.dataset.copied = "true";
        installCopyButton.setAttribute(
            "aria-label",
            "Copied npm install command",
        );
        installCopyStatus.textContent = `Copied ${command}`;
    } catch {
        installCopyButton.dataset.copied = "false";
        installCopyButton.setAttribute(
            "aria-label",
            "Copy npm install command",
        );
        installCopyStatus.textContent = "Copy failed";
        return;
    }

    installCopyResetTimer = window.setTimeout(() => {
        installCopyButton.dataset.copied = "false";
        installCopyButton.setAttribute(
            "aria-label",
            "Copy npm install command",
        );
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
        const isPressed =
            button.getAttribute("aria-pressed") === "true";
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
