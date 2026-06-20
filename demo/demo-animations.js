// Motion runtime and decorative SVG animations for demo/index.html.
// This file sets window.demoAnimations before demo-controls.js runs.

const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
).matches;
const spring = {
    fade: {
        type: "spring",
        stiffness: 320,
        damping: 36,
        mass: 0.85,
        restDelta: 0.001,
    },
    scroll: {
        type: "spring",
        stiffness: 260,
        damping: 34,
        mass: 0.85,
        restDelta: 0.001,
    },
    sweep: {
        type: "spring",
        stiffness: 360,
        damping: 42,
        mass: 0.9,
        restDelta: 0.001,
    },
    surface: {
        type: "spring",
        stiffness: 520,
        damping: 46,
        mass: 0.72,
        restDelta: 0.001,
    },
    edge: {
        type: "spring",
        stiffness: 560,
        damping: 46,
        mass: 0.7,
        restDelta: 0.001,
    },
    rail: {
        type: "spring",
        stiffness: 520,
        damping: 48,
        mass: 0.75,
        restDelta: 0.001,
    },
    token: {
        type: "spring",
        stiffness: 420,
        damping: 44,
        mass: 0.75,
        restDelta: 0.001,
    },
};
const sleep = (ms) =>
    new Promise((resolve) => window.setTimeout(resolve, ms));
const finish = (control) =>
    control?.finished?.catch(() => {}) ?? Promise.resolve();
const setNumber = (element, property, value) => {
    element?.style.setProperty(property, String(value));
};
const readTranslate = (element, axis) => {
    const transform = getComputedStyle(element).transform;
    if (!transform || transform === "none") return 0;
    const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
    if (matrix3d) {
        return (
            Number(
                matrix3d[1].split(",")[axis === "x" ? 12 : 13],
            ) || 0
        );
    }
    const matrix = transform.match(/^matrix\((.+)\)$/);
    if (matrix) {
        return (
            Number(matrix[1].split(",")[axis === "x" ? 4 : 5]) || 0
        );
    }
    return 0;
};
const readValue = (element, property) => {
    const styles = getComputedStyle(element);
    if (property === "opacity") return Number(styles.opacity) || 0;
    if (property === "x" || property === "y")
        return readTranslate(element, property);
    if (property === "strokeDashoffset")
        return parseFloat(styles.strokeDashoffset) || 0;
    if (property.startsWith("--"))
        return Number(styles.getPropertyValue(property)) || 0;
    return parseFloat(styles[property]) || 0;
};
const writeValue = (element, property, value) => {
    if (property === "opacity") {
        element.style.opacity = String(value);
        return;
    }
    if (property === "x") {
        element.style.transform = `translate3d(${value}px, 0, 0)`;
        return;
    }
    if (property === "y") {
        element.style.transform = `translate3d(0, ${value}px, 0)`;
        return;
    }
    if (property === "strokeDashoffset") {
        element.style.strokeDashoffset = `${value}px`;
        return;
    }
    if (property.startsWith("--")) {
        element.style.setProperty(property, String(value));
        return;
    }
    element.style[property] = String(value);
};
const createLocalSpringAnimate =
    () =>
    (target, keyframes, transition = spring.fade) => {
        const elements =
            typeof target === "string"
                ? Array.from(document.querySelectorAll(target))
                : target instanceof NodeList
                  ? Array.from(target)
                  : Array.isArray(target)
                    ? target
                    : [target];
        const entries = elements
            .filter(Boolean)
            .flatMap((element) =>
                Object.entries(keyframes).map(([property, to]) => ({
                    element,
                    property,
                    target: Number(
                        Array.isArray(to) ? to[to.length - 1] : to,
                    ),
                    value: readValue(element, property),
                    velocity: 0,
                })),
            );
        const stiffness = transition.stiffness ?? 300;
        const damping = transition.damping ?? 36;
        const mass = transition.mass ?? 1;
        const restDelta = transition.restDelta ?? 0.001;
        const restSpeed = transition.restSpeed ?? 0.02;
        let frame = 0;
        let previous = performance.now();
        let resolveFinished;
        const finished = new Promise((resolve) => {
            resolveFinished = resolve;
        });

        const step = (now) => {
            const dt = Math.min(
                0.034,
                Math.max(0.001, (now - previous) / 1000),
            );
            previous = now;
            let settled = true;

            for (const entry of entries) {
                const force =
                    -stiffness * (entry.value - entry.target);
                const drag = -damping * entry.velocity;
                const acceleration = (force + drag) / mass;
                entry.velocity += acceleration * dt;
                entry.value += entry.velocity * dt;

                if (
                    Math.abs(entry.velocity) > restSpeed ||
                    Math.abs(entry.target - entry.value) > restDelta
                ) {
                    settled = false;
                }
                writeValue(
                    entry.element,
                    entry.property,
                    entry.value,
                );
            }

            if (settled) {
                for (const entry of entries)
                    writeValue(
                        entry.element,
                        entry.property,
                        entry.target,
                    );
                resolveFinished();
                return;
            }
            frame = requestAnimationFrame(step);
        };

        frame = requestAnimationFrame(step);
        return {
            finished,
            stop() {
                cancelAnimationFrame(frame);
                resolveFinished();
            },
        };
    };
const localSpringAnimate = createLocalSpringAnimate();
let motionAnimate = null;
const animate = (target, keyframes, transition) => {
    if (motionAnimate) {
        try {
            return motionAnimate(target, keyframes, transition);
        } catch {
            document.documentElement.dataset.motionAnimations =
                "local-spring";
        }
    }
    return localSpringAnimate(target, keyframes, transition);
};
const motionAnimations = {
    animate: (target, keyframes, transition) =>
        animate(target, keyframes, transition),
    copySweep: () => {},
    spring,
};
window.demoAnimations = motionAnimations;
document.documentElement.dataset.motionAnimations =
    prefersReducedMotion ? "reduced" : "local-spring";
document.addEventListener("tw-fade:copy-sweep", () => {
    motionAnimations.copySweep();
});
import("https://cdn.jsdelivr.net/npm/motion@12.40.0/mini/+esm")
    .then((motion) => {
        motionAnimate = motion.animate;
        if (!prefersReducedMotion) {
            document.documentElement.dataset.motionAnimations =
                "motion-mini";
        }
    })
    .catch(() => {
        if (!prefersReducedMotion) {
            document.documentElement.dataset.motionAnimations =
                "local-spring";
        }
    });

if (!prefersReducedMotion) {
    function initCopySweep() {
        const sweep = document.querySelector(
            "[data-install-sweep]",
        );
        if (!sweep) return;

        let sweepControl = null;
        let sweepOpacityControl = null;
        motionAnimations.copySweep = () => {
            sweepControl?.stop();
            sweepOpacityControl?.stop();
            const distance = Math.max(
                280,
                sweep.getBoundingClientRect().width * 1.25,
            );
            sweep.style.transform = `translate3d(${-distance}px, 0, 0)`;
            sweep.style.opacity = "0";
            sweepControl = animate(
                sweep,
                { x: distance },
                spring.sweep,
            );
            sweepOpacityControl = animate(
                sweep,
                { opacity: 1 },
                spring.fade,
            );
            sleep(460).then(() => {
                sweepOpacityControl = animate(
                    sweep,
                    { opacity: 0 },
                    spring.fade,
                );
            });
        };
    }

    function initScrollAwareGraphic() {
        const rows = document.querySelector(".scroll-aware-rows");
        const topFade = document.querySelector(
            ".scroll-aware-top-fade",
        );
        const bottomFade = document.querySelector(
            ".scroll-aware-bottom-fade",
        );
        const thumb = document.querySelector(".scroll-aware-thumb");
        if (!rows || !topFade || !bottomFade || !thumb) return;

        const duration = 8200;
        const sampleCount = 96;
        const holdStart = 0.08;
        const travelEnd = 0.66;
        const holdEnd = 0.78;
        const smoothstep = (value) => {
            const t = Math.min(1, Math.max(0, value));
            return t * t * (3 - 2 * t);
        };
        const scrollProgressAt = (time) => {
            if (time < holdStart) return 0;
            if (time < travelEnd)
                return smoothstep(
                    (time - holdStart) / (travelEnd - holdStart),
                );
            if (time < holdEnd) return 1;
            return 1 - smoothstep((time - holdEnd) / (1 - holdEnd));
        };
        const frames = Array.from(
            { length: sampleCount + 1 },
            (_, index) => {
                const offset = index / sampleCount;
                const progress = scrollProgressAt(offset);
                return {
                    offset,
                    rowsY: -78 * progress,
                    thumbY: 82 * progress,
                    topFade: smoothstep(progress / 0.22),
                    bottomFade:
                        1 -
                        0.75 *
                            smoothstep(
                                Math.max(0, progress - 0.74) / 0.26,
                            ),
                };
            },
        );
        const animateProgress = (element, keyframes) => {
            element.animate(keyframes, {
                duration,
                easing: "linear",
                iterations: Infinity,
            });
        };

        animateProgress(
            rows,
            frames.map((frame) => ({
                offset: frame.offset,
                transform: `translate3d(0, ${frame.rowsY.toFixed(3)}px, 0)`,
            })),
        );
        animateProgress(
            thumb,
            frames.map((frame) => ({
                offset: frame.offset,
                transform: `translate3d(0, ${frame.thumbY.toFixed(3)}px, 0)`,
            })),
        );
        animateProgress(
            topFade,
            frames.map((frame) => ({
                offset: frame.offset,
                opacity: frame.topFade.toFixed(3),
            })),
        );
        animateProgress(
            bottomFade,
            frames.map((frame) => ({
                offset: frame.offset,
                opacity: frame.bottomFade.toFixed(3),
            })),
        );
    }

    function initEasedCurveGraphic() {
        const curve = document.querySelector(".eased-curve-active");
        if (!curve) return;

        const length = 506;
        const sampleCount = 120;
        const springStep = (value) => {
            const t = Math.min(1, Math.max(0, value));
            const tension = 7;
            const response =
                1 - Math.exp(-tension * t) * (1 + tension * t);
            const responseMax =
                1 - Math.exp(-tension) * (1 + tension);
            return response / responseMax;
        };
        const windowedSpeed = (progress) => {
            const enter = springStep((progress - 0.16) / 0.1);
            const exit = springStep((progress - 0.5) / 0.14);
            return 1 + 1.7 * enter * (1 - exit);
        };

        let progress = 0;
        const progressSamples = [0];
        for (let index = 1; index <= sampleCount; index += 1) {
            progress += windowedSpeed(progress) / sampleCount;
            progressSamples.push(progress);
        }

        const scale =
            progressSamples[progressSamples.length - 1] || 1;
        const keyframes = progressSamples.map((sample, index) => ({
            offset: index / sampleCount,
            strokeDashoffset: `${(-Math.min(1, sample / scale) * length).toFixed(3)}px`,
        }));

        curve.style.strokeDashoffset = "0px";
        curve.animate(keyframes, {
            duration: 4300,
            easing: "linear",
            iterations: Infinity,
        });

        const handleLine =
            document.querySelector(".eased-handle-line");
        const curves = Array.from(
            document.querySelectorAll(
                ".eased-curve-base, .eased-curve-active",
            ),
        );
        const handlePoints = Array.from(
            document.querySelectorAll(".eased-handle-point"),
        ).sort(
            (a, b) =>
                Number(a.dataset.easedHandle) -
                Number(b.dataset.easedHandle),
        );
        if (
            !handleLine ||
            curves.length < 2 ||
            handlePoints.length !== 4
        )
            return;

        const anchors = [
            { x: 34, y: 174 },
            { x: 156, y: 116 },
            { x: 288, y: 70 },
        ];
        const variants = [
            [
                { x: 72, y: 44 },
                { x: 118, y: 44 },
                { x: 200, y: 188 },
                { x: 244, y: 188 },
            ],
            [
                { x: 68, y: 50 },
                { x: 125, y: 41 },
                { x: 196, y: 184 },
                { x: 251, y: 181 },
            ],
            [
                { x: 76, y: 42 },
                { x: 112, y: 50 },
                { x: 206, y: 193 },
                { x: 238, y: 190 },
            ],
            [
                { x: 70, y: 47 },
                { x: 122, y: 46 },
                { x: 202, y: 186 },
                { x: 247, y: 185 },
            ],
        ];
        const point = ({ x, y }) =>
            `${x.toFixed(3)} ${y.toFixed(3)}`;
        const setHandles = (handles) => {
            handleLine.setAttribute(
                "d",
                `M${point(anchors[0])}L${point(handles[0])}M${point(anchors[1])}L${point(handles[1])}M${point(anchors[1])}L${point(handles[2])}M${point(anchors[2])}L${point(handles[3])}`,
            );
            const curveD = `M${point(anchors[0])}C${point(handles[0])} ${point(handles[1])} ${point(anchors[1])}C${point(handles[2])} ${point(handles[3])} ${point(anchors[2])}`;
            for (const curvePath of curves) {
                curvePath.setAttribute("d", curveD);
            }
            handles.forEach((handle, index) => {
                handlePoints[index].setAttribute(
                    "cx",
                    handle.x.toFixed(3),
                );
                handlePoints[index].setAttribute(
                    "cy",
                    handle.y.toFixed(3),
                );
            });
        };
        const mixHandles = (from, to, amount) =>
            from.map((handle, index) => ({
                x: handle.x + (to[index].x - handle.x) * amount,
                y: handle.y + (to[index].y - handle.y) * amount,
            }));
        const driftHandles = (from, to, duration) =>
            new Promise((resolve) => {
                const startedAt = performance.now();
                const step = (now) => {
                    const progress = Math.min(
                        1,
                        (now - startedAt) / duration,
                    );
                    setHandles(
                        mixHandles(from, to, springStep(progress)),
                    );
                    if (progress < 1) {
                        requestAnimationFrame(step);
                        return;
                    }
                    resolve();
                };
                requestAnimationFrame(step);
            });

        setHandles(variants[0]);
        void (async () => {
            let index = 0;
            await sleep(1800);
            while (true) {
                const next = (index + 1) % variants.length;
                await driftHandles(
                    variants[index],
                    variants[next],
                    4200,
                );
                index = next;
                await sleep(index === 0 ? 5200 : 3600);
            }
        })();
    }

    function initComposableGraphic() {
        const tokens = {
            l2p: document.querySelector(".kin-l2p"),
            range: document.querySelector(".kin-s-range"),
            r: document.querySelector(".kin-s-r"),
            size: document.querySelector(".kin-s-size"),
            t: document.querySelector(".kin-s-t"),
            x: document.querySelector(".kin-s-x"),
            xy: document.querySelector(".kin-s-xy"),
            y: document.querySelector(".kin-s-y"),
        };
        if (Object.values(tokens).some((token) => !token)) return;

        const setToken = (token, opacity, y, blur) => {
            token.style.opacity = String(opacity);
            token.style.transform = `translate3d(0, ${y}px, 0)`;
            setNumber(token, "--kin-blur", blur);
        };
        const show = (token, fromY = 11) => {
            setToken(token, 0, fromY, 6);
            return finish(
                animate(
                    token,
                    { opacity: 1, y: 0, "--kin-blur": 0 },
                    spring.token,
                ),
            );
        };
        const hide = (token, toY = -11) =>
            finish(
                animate(
                    token,
                    { opacity: 0, y: toY, "--kin-blur": 6 },
                    spring.token,
                ),
            );
        const together = (actions) => Promise.all(actions);

        for (const token of Object.values(tokens)) {
            setToken(token, 0, 11, 6);
        }
        setToken(tokens.y, 1, 0, 0);

        const loop = async () => {
            while (true) {
                await sleep(1100);
                await together([hide(tokens.y), show(tokens.xy)]);
                await sleep(950);
                await together([
                    hide(tokens.xy),
                    show(tokens.t),
                    show(tokens.l2p, 14),
                    show(tokens.r, 14),
                ]);
                await sleep(1100);
                await together([
                    hide(tokens.r),
                    show(tokens.range),
                ]);
                await sleep(950);
                await together([
                    hide(tokens.t),
                    show(tokens.x),
                    hide(tokens.range),
                    show(tokens.size),
                ]);
                await sleep(1150);
                await together([
                    hide(tokens.x),
                    show(tokens.y),
                    hide(tokens.l2p, 14),
                    hide(tokens.size, 14),
                ]);
            }
        };
        void loop();
    }

    initCopySweep();
    initScrollAwareGraphic();
    initEasedCurveGraphic();
    initComposableGraphic();
}
