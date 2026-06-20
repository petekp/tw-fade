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
    installIcon: {
        type: "spring",
        stiffness: 650,
        damping: 22,
        mass: 0.55,
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
const animate = (target, keyframes, transition) =>
    localSpringAnimate(target, keyframes, transition);
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

    function initWaveBackground() {
        const field = document.querySelector("[data-demo-wave-field]");
        const pattern = document.querySelector(
            "[data-demo-wave-pattern]",
        );
        const path = document.querySelector("[data-demo-wave-path]");
        const scroller = document.body;
        if (!field || !pattern || !path || !scroller) return;

        const params = {
            amplitudeTop: 26,
            amplitudeBottom: 74,
            wavelengthTop: 386,
            wavelengthBottom: 160,
            cycles: 3,
            spacing: 128,
            columns: 1,
            stagger: false,
        };
        const round = (value) => Number(value.toFixed(3));
        const lerp = (from, to, amount) =>
            from + (to - from) * amount;
        const currentScrollProgress = () => {
            const max = scroller.scrollHeight - scroller.clientHeight;
            return max > 0
                ? Math.min(
                      1,
                      Math.max(0, scroller.scrollTop / max),
                  )
                : 0;
        };
        const buildWave = (amplitude, wavelength) => {
            const halfWave = wavelength / 2;
            const segmentCount = 2 * Math.round(params.cycles);
            const columnCount = Math.round(params.columns);
            const tileWidth =
                Math.round(params.spacing) * columnCount;
            const tileHeight =
                Math.round(params.cycles) * wavelength;
            let d = "";

            for (let column = 0; column < columnCount; column += 1) {
                const centerX =
                    params.spacing * column + params.spacing / 2;
                const initialSign =
                    params.stagger && column % 2 === 1 ? -1 : 1;
                d += `M${round(centerX)} 0`;
                d += `C${round(centerX + initialSign * amplitude)} ${round(0.25 * halfWave)} ${round(centerX + initialSign * amplitude)} ${round(0.75 * halfWave)} ${round(centerX)} ${round(halfWave)}`;

                for (
                    let segment = 1;
                    segment < segmentCount;
                    segment += 1
                ) {
                    const sign =
                        initialSign *
                        (segment % 2 === 0 ? 1 : -1);
                    d += `S${round(centerX + sign * amplitude)} ${round(segment * halfWave + 0.75 * halfWave)} ${round(centerX)} ${round((segment + 1) * halfWave)}`;
                }
            }

            return { d, tileWidth, tileHeight };
        };

        let lastKey = "";
        let lastProgress = -1;
        const render = () => {
            const progress = currentScrollProgress();
            if (Math.abs(progress - lastProgress) < 0.001) return;
            lastProgress = progress;

            const amplitude = lerp(
                params.amplitudeTop,
                params.amplitudeBottom,
                progress,
            );
            const wavelength = Math.round(
                lerp(
                    params.wavelengthTop,
                    params.wavelengthBottom,
                    progress,
                ),
            );
            const wave = buildWave(amplitude, wavelength);
            const key = `${wave.tileWidth}:${wave.tileHeight}:${wave.d}`;
            if (key === lastKey) return;

            pattern.setAttribute("width", String(wave.tileWidth));
            pattern.setAttribute("height", String(wave.tileHeight));
            path.setAttribute("d", wave.d);
            lastKey = key;
        };

        let pending = false;
        const queueRender = () => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                render();
            });
        };

        render();
        document.documentElement.dataset.waveField = "svg";
        scroller.addEventListener("scroll", queueRender, {
            passive: true,
        });
        window.addEventListener("resize", queueRender);
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

        const sampleCount = 360;
        const targetLapDuration = 3200;
        const springStep = (value) => {
            const t = Math.min(1, Math.max(0, value));
            const tension = 7;
            const response =
                1 - Math.exp(-tension * t) * (1 + tension * t);
            const responseMax =
                1 - Math.exp(-tension) * (1 + tension);
            return response / responseMax;
        };
        const clamp = (value, min, max) =>
            Math.min(max, Math.max(min, value));
        const trendSign = (value) => {
            if (value > 0.05) return 1;
            if (value < -0.05) return -1;
            return 0;
        };
        const smoothValues = (values, passes = 5) => {
            let next = values;
            for (let pass = 0; pass < passes; pass += 1) {
                next = next.map((value, index) => {
                    const previous = next[index - 1] ?? value;
                    const following = next[index + 1] ?? value;
                    return (previous + value * 2 + following) / 4;
                });
            }
            return next;
        };
        const findVerticalExtrema = (points, distances, length) => {
            const extrema = [];
            let trend = trendSign(points[1].y - points[0].y);
            const minimumSeparation = length * 0.075;

            for (let index = 2; index < points.length; index += 1) {
                const nextTrend = trendSign(
                    points[index].y - points[index - 1].y,
                );
                if (!nextTrend) continue;

                if (trend && nextTrend !== trend) {
                    const distance = distances[index - 1];
                    const previous = extrema[extrema.length - 1];
                    if (
                        !previous ||
                        distance - previous.distance > minimumSeparation
                    ) {
                        extrema.push({
                            distance,
                            type:
                                trend < 0 && nextTrend > 0
                                    ? "peak"
                                    : "valley",
                        });
                    }
                }
                trend = nextTrend;
            }

            return extrema;
        };
        const turningPhase = (distance, turns) => {
            let rightIndex = turns.findIndex((turn) => turn >= distance);
            if (rightIndex === -1) rightIndex = turns.length - 1;
            const left = turns[Math.max(0, rightIndex - 1)];
            const right = turns[rightIndex];
            const span = Math.max(1, right - left);
            const nearestTurn = Math.min(
                distance - left,
                right - distance,
            );
            const phase = clamp(nearestTurn / (span / 2), 0, 1);

            return 0.5 - Math.cos(phase * Math.PI) * 0.5;
        };
        const measureCurveGeometry = () => {
            const length = curve.getTotalLength();
            const dashLength = Math.min(76, length * 0.2);
            const distances = Array.from(
                { length: sampleCount + 1 },
                (_, index) => (length * index) / sampleCount,
            );
            const points = distances.map((distance) =>
                curve.getPointAtLength(distance),
            );
            const extrema = findVerticalExtrema(
                points,
                distances,
                length,
            );
            const turns = [
                0,
                ...extrema.map((extremum) => extremum.distance),
                length,
            ];
            const tangentWindow = Math.max(2, (length / sampleCount) * 2);

            // Measure against real path geometry: slow at peaks/valleys,
            // quickest between them, and biased faster when moving downhill.
            const speeds = smoothValues(
                distances.map((distance) => {
                    const before = curve.getPointAtLength(
                        Math.max(0, distance - tangentWindow),
                    );
                    const after = curve.getPointAtLength(
                        Math.min(length, distance + tangentWindow),
                    );
                    const dx = after.x - before.x;
                    const dy = after.y - before.y;
                    const tangentLength = Math.hypot(dx, dy) || 1;
                    const tangentY = dy / tangentLength;
                    const downhill = Math.max(0, tangentY);
                    const uphill = Math.max(0, -tangentY);
                    const verticality = Math.abs(tangentY);
                    const distanceFromTurn = turningPhase(
                        distance,
                        turns,
                    );
                    const directionBias =
                        0.72 +
                        downhill * 1.06 -
                        uphill * 0.2 +
                        (1 - verticality) * 0.16;

                    return clamp(
                        0.5,
                        2.15,
                        0.5 + distanceFromTurn * directionBias,
                    );
                }),
            );
            let weightedSpeed = 0;

            for (let index = 1; index < distances.length; index += 1) {
                const distance =
                    distances[index] - distances[index - 1];
                const speed =
                    (speeds[index - 1] + speeds[index]) / 2;
                weightedSpeed += speed * distance;
            }

            const gapLength = Math.max(0, length - dashLength);
            curve.style.strokeDasharray = `${dashLength.toFixed(3)} ${gapLength.toFixed(3)}`;
            curve.dataset.easedTiming = "peak-valley";
            curve.dataset.easedExtrema = extrema
                .map(
                    (extremum) =>
                        `${extremum.type}:${extremum.distance.toFixed(1)}`,
                )
                .join(" ");

            return {
                length,
                speeds,
                averageSpeed: weightedSpeed / length || 1,
            };
        };
        const speedAtDistance = (geometry, distance) => {
            const position =
                (clamp(distance / geometry.length, 0, 1) *
                    sampleCount) ||
                0;
            const index = Math.min(
                sampleCount - 1,
                Math.max(0, Math.floor(position)),
            );
            const mix = position - index;
            const current = geometry.speeds[index] ?? 1;
            const next = geometry.speeds[index + 1] ?? current;
            return current + (next - current) * mix;
        };
        let curveGeometry = null;
        let curveGeometryDirty = true;
        let curveDistance = 0;
        let lastCurveFrame = 0;
        let lastCurveMeasure = 0;

        const markCurveGeometryDirty = () => {
            curveGeometryDirty = true;
        };
        const refreshCurveGeometry = (now, force = false) => {
            if (
                !force &&
                (!curveGeometryDirty || now - lastCurveMeasure < 96)
            )
                return;

            const progress =
                curveGeometry?.length > 0
                    ? curveDistance / curveGeometry.length
                    : 0;
            curveGeometry = measureCurveGeometry();
            curveDistance =
                ((progress % 1) + 1) % 1 * curveGeometry.length;
            curveGeometryDirty = false;
            lastCurveMeasure = now;
        };
        const animateCurveDash = (now) => {
            refreshCurveGeometry(now);
            if (!lastCurveFrame) lastCurveFrame = now;
            const dt = Math.min(34, Math.max(1, now - lastCurveFrame));
            lastCurveFrame = now;

            if (curveGeometry?.length) {
                const pixelsPerMillisecond =
                    curveGeometry.length /
                    targetLapDuration /
                    curveGeometry.averageSpeed;
                curveDistance =
                    (curveDistance +
                        pixelsPerMillisecond *
                            speedAtDistance(
                                curveGeometry,
                                curveDistance,
                            ) *
                            dt) %
                    curveGeometry.length;
                curve.style.strokeDashoffset = `${(-curveDistance).toFixed(3)}px`;
            }

            requestAnimationFrame(animateCurveDash);
        };

        curve.style.strokeDashoffset = "0px";
        refreshCurveGeometry(performance.now(), true);
        requestAnimationFrame(animateCurveDash);

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
            markCurveGeometryDirty();
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
    initWaveBackground();
    initScrollAwareGraphic();
    initEasedCurveGraphic();
    initComposableGraphic();
}
