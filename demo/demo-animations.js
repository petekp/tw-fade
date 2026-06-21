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
    stiffness: 250,
    damping: 42,
    mass: 0.9,
    restDelta: 0.001,
  },
  installIcon: {
    // Soft + underdamped (ζ≈0.34): low stiffness gives a rubbery squish on
    // press/release rather than a stiff snap, while staying bouncy.
    type: "spring",
    stiffness: 340,
    damping: 10,
    mass: 0.62,
    restDelta: 0.001,
  },
  installCheck: {
    // Click pop: an upward initial velocity kicks the checkmark up to ~1.5
    // then it settles back to 1.0 in one continuous, satisfying bounce.
    // The damping ratio (zeta ~0.59) keeps the return calm: a single mild
    // dip to ~0.96 with a negligible secondary overshoot, not erratic ringing.
    type: "spring",
    stiffness: 200,
    damping: 10,
    mass: 0.8,
    velocity: 10,
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
  lexBar: {
    // Notch grow-in (zeta ~0.63): the bar springs from 0 to full height with
    // one gentle, elegant overshoot — present but never bouncy or erratic.
    type: "spring",
    stiffness: 500,
    damping: 28,
    mass: 1,
    restDelta: 0.001,
  },
};
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
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
    return Number(matrix3d[1].split(",")[axis === "x" ? 12 : 13]) || 0;
  }
  const matrix = transform.match(/^matrix\((.+)\)$/);
  if (matrix) {
    return Number(matrix[1].split(",")[axis === "x" ? 4 : 5]) || 0;
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
    const entries = elements.filter(Boolean).flatMap((element) =>
      Object.entries(keyframes).map(([property, to]) => ({
        element,
        property,
        target: Number(Array.isArray(to) ? to[to.length - 1] : to),
        value: readValue(element, property),
        // Optional initial velocity kick — lets a spring overshoot
        // past its target (e.g. a checkmark popping up to 1.2 on the
        // way to a 1.0 rest) instead of only easing in from rest.
        velocity: Number(transition.velocity) || 0,
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
      const dt = Math.min(0.034, Math.max(0.001, (now - previous) / 1000));
      previous = now;
      let settled = true;

      for (const entry of entries) {
        const force = -stiffness * (entry.value - entry.target);
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
        writeValue(entry.element, entry.property, entry.value);
      }

      if (settled) {
        for (const entry of entries)
          writeValue(entry.element, entry.property, entry.target);
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
document.documentElement.dataset.motionAnimations = prefersReducedMotion
  ? "reduced"
  : "local-spring";
document.addEventListener("tw-fade:copy-sweep", () => {
  motionAnimations.copySweep();
});

if (!prefersReducedMotion) {
  function initCopySweep() {
    const sweep = document.querySelector("[data-install-sweep]");
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
      sweepControl = animate(sweep, { x: distance }, spring.sweep);
      sweepOpacityControl = animate(sweep, { opacity: 1 }, spring.fade);
      sleep(460).then(() => {
        sweepOpacityControl = animate(sweep, { opacity: 0 }, spring.fade);
      });
    };
  }

  function initWaveBackground() {
    const field = document.querySelector("[data-demo-wave-field]");
    const pattern = document.querySelector("[data-demo-wave-pattern]");
    const path = document.querySelector("[data-demo-wave-path]");
    const strips = document.querySelector("[data-demo-wave-strips]");
    const svg = field?.querySelector("svg");
    const scroller = document.body;
    if (!field || !pattern || !path || !scroller) return;

    const params = {
      amplitudeTop: 60,
      amplitudeBottom: 28,
      wavelengthTop: 543,
      wavelengthBottom: 402,
      cycles: 3,
      spacing: 128,
      columns: 1,
      stagger: false,
    };

    // Stepped per-strip fill (tuned in wave-lab.html): every band between wave
    // lines gets ONE flat shade, stepping across the screen along `angle`.
    // Color comes from --demo-wave-fill (CSS); only opacity is set per strip.
    const fill = {
      angle: 0,
      opacityStart: 0.07,
      opacityEnd: 0.0,
      offsetStart: 0,
      offsetEnd: 100,
    };

    const round = (value) => Number(value.toFixed(3));
    const lerp = (from, to, amount) => from + (to - from) * amount;
    const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
    const currentScrollProgress = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      return max > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0;
    };
    const buildWave = (amplitude, wavelength) => {
      const halfWave = wavelength / 2;
      const segmentCount = 2 * Math.round(params.cycles);
      const columnCount = Math.round(params.columns);
      const tileWidth = Math.round(params.spacing) * columnCount;
      const tileHeight = Math.round(params.cycles) * wavelength;
      let d = "";

      for (let column = 0; column < columnCount; column += 1) {
        const centerX = params.spacing * column + params.spacing / 2;
        const initialSign = params.stagger && column % 2 === 1 ? -1 : 1;
        d += `M${round(centerX)} 0`;
        d += `C${round(centerX + initialSign * amplitude)} ${round(0.25 * halfWave)} ${round(centerX + initialSign * amplitude)} ${round(0.75 * halfWave)} ${round(centerX)} ${round(halfWave)}`;

        for (let segment = 1; segment < segmentCount; segment += 1) {
          const sign = initialSign * (segment % 2 === 0 ? 1 : -1);
          d += `S${round(centerX + sign * amplitude)} ${round(segment * halfWave + 0.75 * halfWave)} ${round(centerX)} ${round((segment + 1) * halfWave)}`;
        }
      }

      return { d, tileWidth, tileHeight };
    };

    // Explicit cubic segments for one wave column (same shape as the stroke
    // path), so the negative-space strips trace the exact wave edges.
    const columnCubics = (centerX, sign0, amplitude, halfWave, segmentCount) => {
      const cubics = [
        {
          p0: { x: centerX, y: 0 },
          p1: { x: centerX + sign0 * amplitude, y: 0.25 * halfWave },
          p2: { x: centerX + sign0 * amplitude, y: 0.75 * halfWave },
          p3: { x: centerX, y: halfWave },
        },
      ];
      let prevP2 = cubics[0].p2;
      let prevP3 = cubics[0].p3;
      for (let segment = 1; segment < segmentCount; segment += 1) {
        const sign = sign0 * (segment % 2 === 0 ? 1 : -1);
        const cp1 = { x: 2 * prevP3.x - prevP2.x, y: 2 * prevP3.y - prevP2.y };
        const cp2 = { x: centerX + sign * amplitude, y: segment * halfWave + 0.75 * halfWave };
        const end = { x: centerX, y: (segment + 1) * halfWave };
        cubics.push({ p0: prevP3, p1: cp1, p2: cp2, p3: end });
        prevP2 = cp2;
        prevP3 = end;
      }
      return cubics;
    };

    const shiftCubics = (cubics, dx) =>
      cubics.map((c) => ({
        p0: { x: c.p0.x + dx, y: c.p0.y },
        p1: { x: c.p1.x + dx, y: c.p1.y },
        p2: { x: c.p2.x + dx, y: c.p2.y },
        p3: { x: c.p3.x + dx, y: c.p3.y },
      }));

    // Closed path for the strip between two adjacent wave lines: down the left
    // edge, across the bottom, up the right edge (reversed), close across top.
    const stripPath = (left, right, cxLeft, cxRight, totalHeight) => {
      let d = `M${round(cxLeft)} 0`;
      for (const c of left) {
        d += `C${round(c.p1.x)} ${round(c.p1.y)} ${round(c.p2.x)} ${round(c.p2.y)} ${round(c.p3.x)} ${round(c.p3.y)}`;
      }
      d += `L${round(cxRight)} ${round(totalHeight)}`;
      for (let i = right.length - 1; i >= 0; i -= 1) {
        const c = right[i];
        d += `C${round(c.p2.x)} ${round(c.p2.y)} ${round(c.p1.x)} ${round(c.p1.y)} ${round(c.p0.x)} ${round(c.p0.y)}`;
      }
      return `${d}Z`;
    };

    // A strip's flat shade: project its horizontal center onto the gradient
    // direction (0°=left→right), remap through the start/end stop offsets.
    const stripShade = (centerX, fieldWidth, fieldHeight) => {
      const rad = (fill.angle * Math.PI) / 180;
      const dirX = Math.cos(rad);
      const dirY = Math.sin(rad);
      const half = (Math.abs(dirX) * fieldWidth + Math.abs(dirY) * fieldHeight) / 2 || 1;
      const t = ((centerX - fieldWidth / 2) * dirX + half) / (2 * half);
      const o0 = fill.offsetStart / 100;
      const o1 = fill.offsetEnd / 100;
      const span = o1 - o0 || 1e-6;
      return lerp(fill.opacityStart, fill.opacityEnd, clamp01((t - o0) / span));
    };

    const buildStrips = (amplitude, wavelength, fieldWidth, fieldHeight) => {
      if (!fieldWidth || !fieldHeight) return "";
      const halfWave = wavelength / 2;
      const spacing = Math.round(params.spacing);
      const segmentCount = 2 * (Math.ceil(fieldHeight / wavelength) + 1);
      const totalHeight = segmentCount * halfWave;
      const base = columnCubics(0, 1, amplitude, halfWave, segmentCount);
      const columnMax = Math.ceil(fieldWidth / spacing) + 1;
      let markup = "";
      for (let column = -1; column < columnMax; column += 1) {
        const cxLeft = column * spacing + spacing / 2;
        const cxRight = cxLeft + spacing;
        const d = stripPath(
          shiftCubics(base, cxLeft),
          shiftCubics(base, cxRight),
          cxLeft,
          cxRight,
          totalHeight,
        );
        const opacity = round(stripShade(cxLeft + spacing / 2, fieldWidth, fieldHeight));
        markup += `<path d="${d}" fill-opacity="${opacity}" shape-rendering="geometricPrecision"/>`;
      }
      return markup;
    };

    // Field pixel size only changes on resize, so cache it (avoids a layout
    // read every scroll frame).
    let fieldWidth = 0;
    let fieldHeight = 0;
    const measureField = () => {
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      fieldWidth = Math.round(rect.width);
      fieldHeight = Math.round(rect.height);
    };

    let lastKey = "";
    let lastStripsKey = "";
    const render = () => {
      const progress = currentScrollProgress();
      const amplitude = lerp(
        params.amplitudeTop,
        params.amplitudeBottom,
        progress,
      );
      const wavelength = Math.round(
        lerp(params.wavelengthTop, params.wavelengthBottom, progress),
      );
      const wave = buildWave(amplitude, wavelength);
      const key = `${wave.tileWidth}:${wave.tileHeight}:${wave.d}`;
      if (key !== lastKey) {
        pattern.setAttribute("width", String(wave.tileWidth));
        pattern.setAttribute("height", String(wave.tileHeight));
        path.setAttribute("d", wave.d);
        lastKey = key;
      }

      if (strips) {
        const stripsKey = `${fieldWidth}:${fieldHeight}:${round(amplitude)}:${wavelength}`;
        if (stripsKey !== lastStripsKey) {
          strips.innerHTML = buildStrips(amplitude, wavelength, fieldWidth, fieldHeight);
          lastStripsKey = stripsKey;
        }
      }
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

    // Reveal the SVG field first so it has a layout box; measuring before the
    // display flip would read 0×0 and emit no strips until the first scroll.
    document.documentElement.dataset.waveField = "svg";
    measureField();
    render();
    scroller.addEventListener("scroll", queueRender, {
      passive: true,
    });
    window.addEventListener("resize", () => {
      measureField();
      queueRender();
    });
  }

  function initScrollAwareGraphic() {
    const rows = document.querySelector(".scroll-aware-rows");
    const topFade = document.querySelector(".scroll-aware-top-fade");
    const bottomFade = document.querySelector(".scroll-aware-bottom-fade");
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
        return smoothstep((time - holdStart) / (travelEnd - holdStart));
      if (time < holdEnd) return 1;
      return 1 - smoothstep((time - holdEnd) / (1 - holdEnd));
    };
    const frames = Array.from({ length: sampleCount + 1 }, (_, index) => {
      const offset = index / sampleCount;
      const progress = scrollProgressAt(offset);
      return {
        offset,
        rowsY: -78 * progress,
        thumbY: 82 * progress,
        topFade: smoothstep(progress / 0.22),
        bottomFade: 1 - 0.75 * smoothstep(Math.max(0, progress - 0.74) / 0.26),
      };
    });
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

    // Samples used to discretise the path. 220 is plenty for a smooth
    // velocity profile while keeping each rebuild cheap during drift.
    const sampleCount = 220;
    // Live "feel" knobs. Mutable so the debug tuner (?tune) can adjust them
    // at runtime; the defaults here are the shipped values.
    //   lapDuration — wall-clock ms for one full traversal. The dash always
    //     completes a lap in this time; only its velocity *within* the lap
    //     varies with the terrain.
    //   downhillBoost — how hard each *descent* speeds the dash up. Keys on
    //     the local slope only (not absolute height): 0 = no surge, higher =
    //     a more pronounced rush down each slope.
    //   uphillDrag — the mirror knob for *climbs*: how hard each ascent slows
    //     the dash down. Separated from downhillBoost so the up/down asymmetry
    //     is yours to dial — e.g. ease the drag to keep the climb from
    //     flat-lining at the floor.
    //   minSpeed — the floor, reached on the steepest climbs, so the dash
    //     eases up but never stalls.
    const config = {
      lapDuration: 3200,
      downhillBoost: 0.9,
      uphillDrag: 0.6,
      minSpeed: 0.35,
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    // Spring-like ease used by the handle drift below (kept from the
    // original implementation).
    const springStep = (value) => {
      const t = clamp(value, 0, 1);
      const tension = 7;
      const response = 1 - Math.exp(-tension * t) * (1 + tension * t);
      const responseMax = 1 - Math.exp(-tension) * (1 + tension);
      return response / responseMax;
    };
    const smoothValues = (values, passes = 3) => {
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

    // Discretise the path into a phase->distance lookup. The dash advances
    // linearly in *time* (a normalised phase), and we invert this table to
    // find where on the path that phase lands. Because the time to cross
    // each slice is `sliceLength / localSpeed`, fast (low) stretches are
    // crossed quickly and slow (high) stretches are dwelt on — all without
    // any per-frame velocity accumulation that could drift or stutter.
    const measureCurveGeometry = () => {
      const length = curve.getTotalLength();
      if (!length) return null;
      const dashLength = Math.min(76, length * 0.2);

      const points = new Array(sampleCount + 1);
      for (let index = 0; index <= sampleCount; index += 1) {
        points[index] = curve.getPointAtLength((length * index) / sampleCount);
      }

      // Signed-slope model: speed responds to the *local* incline/decline,
      // not absolute height. For each sample we take the tangent's signed
      // verticality in the direction of travel:
      //   slope = dy / chordLength   (SVG y grows downward)
      // so slope > 0 means heading downhill and slope < 0 uphill, in the
      // range [-1, 1]. Speed deviates from a baseline of 1 by the slope
      // scaled by a direction-specific gain: downhillBoost on descents,
      // uphillDrag on climbs. The result is floored at minSpeed so the
      // steepest climbs ease up without stalling. Because it keys only on
      // slope direction, every climb slows the dash and every descent
      // speeds it up — on every hill, regardless of where the curve sits
      // vertically. This is what "synced to the incline and decline"
      // actually means; height-based models drift with the curve's overall
      // trend instead.
      const slopes = points.map((_, index) => {
        const previous = points[Math.max(0, index - 1)];
        const following = points[Math.min(sampleCount, index + 1)];
        const dx = following.x - previous.x;
        const dy = following.y - previous.y;
        const chord = Math.hypot(dx, dy) || 1;
        return dy / chord;
      });

      const speeds = smoothValues(
        slopes.map((slope) => {
          const gain = slope >= 0 ? config.downhillBoost : config.uphillDrag;
          return Math.max(config.minSpeed, 1 + gain * slope);
        }),
      );

      // Cumulative traversal time (unnormalised) via time = distance / speed.
      const sliceLength = length / sampleCount;
      const cumulativeTime = new Array(sampleCount + 1);
      cumulativeTime[0] = 0;
      for (let index = 1; index <= sampleCount; index += 1) {
        const averageSpeed = (speeds[index - 1] + speeds[index]) / 2;
        cumulativeTime[index] =
          cumulativeTime[index - 1] + sliceLength / averageSpeed;
      }

      const gapLength = Math.max(0, length - dashLength);
      curve.style.strokeDasharray = `${dashLength.toFixed(3)} ${gapLength.toFixed(3)}`;

      return {
        length,
        cumulativeTime,
        totalTime: cumulativeTime[sampleCount] || 1,
      };
    };

    // Invert the cumulative-time table: map a normalised phase (0..1, linear
    // in time) to a distance along the path. This is the step that couples
    // the dash's velocity to the curve's slope.
    const distanceAtPhase = (geometry, phase) => {
      const table = geometry.cumulativeTime;
      const targetTime = phase * geometry.totalTime;
      let low = 0;
      let high = sampleCount;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (table[mid] < targetTime) low = mid + 1;
        else high = mid;
      }
      const index = Math.max(1, low);
      const previousTime = table[index - 1];
      const span = table[index] - previousTime || 1;
      const fraction = clamp((targetTime - previousTime) / span, 0, 1);
      return (index - 1 + fraction) * (geometry.length / sampleCount);
    };

    let curveGeometry = measureCurveGeometry();
    let curveGeometryDirty = false;
    let lastCurveMeasure = 0;
    let lastCurveFrame = 0;
    // Normalised position in the lap, continuous across geometry rebuilds so
    // the dash never lurches when the curve morphs during the handle drift.
    let phase = 0;

    const markCurveGeometryDirty = () => {
      curveGeometryDirty = true;
    };
    const animateCurveDash = (now) => {
      if (!lastCurveFrame) lastCurveFrame = now;
      const dt = Math.min(40, Math.max(0, now - lastCurveFrame));
      lastCurveFrame = now;

      // Rebuild the table only when the path actually morphs, and throttle
      // it. Phase continuity keeps velocity smooth across rebuilds.
      if (curveGeometryDirty && now - lastCurveMeasure > 90) {
        const fresh = measureCurveGeometry();
        if (fresh) curveGeometry = fresh;
        curveGeometryDirty = false;
        lastCurveMeasure = now;
      }

      if (curveGeometry) {
        phase = (phase + dt / config.lapDuration) % 1;
        const distance = distanceAtPhase(curveGeometry, phase);
        curve.style.strokeDashoffset = `${(-distance).toFixed(3)}px`;
      }

      requestAnimationFrame(animateCurveDash);
    };

    curve.style.strokeDashoffset = "0px";
    requestAnimationFrame(animateCurveDash);

    // ── Debug tuner ──────────────────────────────────────────────────
    // Live sliders for the feel knobs above. Renders only when the page is
    // loaded with ?tune in the URL, so it never appears in the published
    // demo. Tune visually, then "Copy values" to paste the literals back
    // into the `config` object in source.
    if (
      new URLSearchParams(window.location.search).has("tune") &&
      !document.querySelector(".eased-tuner")
    ) {
      const defaults = { ...config };
      const fields = [
        {
          key: "lapDuration",
          label: "Lap duration",
          min: 1000,
          max: 8000,
          step: 50,
          rebuild: false,
          format: (value) => `${Math.round(value)} ms`,
        },
        {
          key: "downhillBoost",
          label: "Downhill boost",
          min: 0,
          max: 4,
          step: 0.1,
          rebuild: true,
          format: (value) => value.toFixed(1),
        },
        {
          key: "uphillDrag",
          label: "Uphill drag",
          min: 0,
          max: 4,
          step: 0.1,
          rebuild: true,
          format: (value) => value.toFixed(1),
        },
        {
          key: "minSpeed",
          label: "Min speed",
          min: 0.1,
          max: 1.5,
          step: 0.05,
          rebuild: true,
          format: (value) => value.toFixed(2),
        },
      ];

      if (!document.getElementById("eased-tuner-style")) {
        const style = document.createElement("style");
        style.id = "eased-tuner-style";
        style.textContent = `
.eased-tuner{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:228px;
  padding:12px 14px 13px;border-radius:12px;border:1px solid rgba(255,255,255,.1);
  background:rgba(18,18,20,.86);backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);box-shadow:0 8px 30px rgba(0,0,0,.45);
  color:#e6e6e6;font:500 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.eased-tuner[data-collapsed="true"] .eased-tuner-body{display:none}
.eased-tuner-head{display:flex;align-items:center;justify-content:space-between;
  margin-bottom:10px}
.eased-tuner-title{letter-spacing:.04em;text-transform:uppercase;font-size:10px;
  color:#9b9b9b}
.eased-tuner-toggle{cursor:pointer;border:none;background:none;color:#9b9b9b;
  font:inherit;padding:0 4px;line-height:1}
.eased-tuner-row{margin-bottom:10px}
.eased-tuner-label{display:flex;justify-content:space-between;margin-bottom:5px}
.eased-tuner-label span:last-child{color:var(--demo-accent-text,#7dd3fc)}
.eased-tuner input[type=range]{width:100%;height:4px;-webkit-appearance:none;
  appearance:none;background:rgba(255,255,255,.14);border-radius:999px;outline:none;
  margin:0;cursor:pointer}
.eased-tuner input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;
  appearance:none;width:13px;height:13px;border-radius:50%;
  background:var(--demo-accent-text,#7dd3fc);border:none;
  box-shadow:0 0 0 3px rgba(125,211,252,.18)}
.eased-tuner input[type=range]::-moz-range-thumb{width:13px;height:13px;
  border-radius:50%;background:var(--demo-accent-text,#7dd3fc);border:none}
.eased-tuner-actions{display:flex;gap:8px;margin-top:12px}
.eased-tuner-btn{flex:1;cursor:pointer;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.04);color:#d4d4d4;font:inherit;padding:6px 0;
  border-radius:7px}
.eased-tuner-btn:hover{background:rgba(255,255,255,.09)}`;
        document.head.appendChild(style);
      }

      const panel = document.createElement("div");
      panel.className = "eased-tuner";
      const accent = getComputedStyle(curve)
        .getPropertyValue("--demo-accent-text")
        .trim();
      if (accent) panel.style.setProperty("--demo-accent-text", accent);

      const head = document.createElement("div");
      head.className = "eased-tuner-head";
      const title = document.createElement("span");
      title.className = "eased-tuner-title";
      title.textContent = "Eased gradient";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "eased-tuner-toggle";
      toggle.textContent = "–";
      toggle.addEventListener("click", () => {
        const collapsed = panel.dataset.collapsed === "true";
        panel.dataset.collapsed = collapsed ? "false" : "true";
        toggle.textContent = collapsed ? "–" : "+";
      });
      head.append(title, toggle);

      const body = document.createElement("div");
      body.className = "eased-tuner-body";
      const inputEls = {};
      const valueEls = {};

      for (const field of fields) {
        const row = document.createElement("div");
        row.className = "eased-tuner-row";

        const label = document.createElement("div");
        label.className = "eased-tuner-label";
        const name = document.createElement("span");
        name.textContent = field.label;
        const value = document.createElement("span");
        value.textContent = field.format(config[field.key]);
        label.append(name, value);

        const input = document.createElement("input");
        input.type = "range";
        input.min = String(field.min);
        input.max = String(field.max);
        input.step = String(field.step);
        input.value = String(config[field.key]);
        input.addEventListener("input", () => {
          const next = Number(input.value);
          config[field.key] = next;
          value.textContent = field.format(next);
          if (field.rebuild) markCurveGeometryDirty();
        });

        inputEls[field.key] = input;
        valueEls[field.key] = value;
        row.append(label, input);
        body.appendChild(row);
      }

      const syncControls = () => {
        for (const field of fields) {
          inputEls[field.key].value = String(config[field.key]);
          valueEls[field.key].textContent = field.format(config[field.key]);
        }
      };

      const actions = document.createElement("div");
      actions.className = "eased-tuner-actions";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "eased-tuner-btn";
      copyBtn.textContent = "Copy values";
      copyBtn.addEventListener("click", async () => {
        const text = fields
          .map((field) => {
            const raw = config[field.key];
            const value =
              field.key === "lapDuration"
                ? Math.round(raw)
                : Math.round(raw * 100) / 100;
            return `    ${field.key}: ${value},`;
          })
          .join("\n");
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = "Copied!";
        } catch {
          copyBtn.textContent = "Copy failed";
          window.prompt("Copy these values:", text);
        }
        window.setTimeout(() => {
          copyBtn.textContent = "Copy values";
        }, 1200);
      });

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "eased-tuner-btn";
      resetBtn.textContent = "Reset";
      resetBtn.addEventListener("click", () => {
        Object.assign(config, defaults);
        syncControls();
        markCurveGeometryDirty();
      });

      actions.append(copyBtn, resetBtn);
      body.appendChild(actions);
      panel.append(head, body);
      document.body.appendChild(panel);
    }
    // ─────────────────────────────────────────────────────────────────

    const handleLine = document.querySelector(".eased-handle-line");
    const curves = Array.from(
      document.querySelectorAll(".eased-curve-base, .eased-curve-active"),
    );
    const handlePoints = Array.from(
      document.querySelectorAll(".eased-handle-point"),
    ).sort(
      (a, b) => Number(a.dataset.easedHandle) - Number(b.dataset.easedHandle),
    );
    if (!handleLine || curves.length < 2 || handlePoints.length !== 4) return;

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
    const point = ({ x, y }) => `${x.toFixed(3)} ${y.toFixed(3)}`;
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
        handlePoints[index].setAttribute("cx", handle.x.toFixed(3));
        handlePoints[index].setAttribute("cy", handle.y.toFixed(3));
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
          const progress = Math.min(1, (now - startedAt) / duration);
          setHandles(mixHandles(from, to, springStep(progress)));
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
        await driftHandles(variants[index], variants[next], 4200);
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
        animate(token, { opacity: 1, y: 0, "--kin-blur": 0 }, spring.token),
      );
    };
    const hide = (token, toY = -11) =>
      finish(
        animate(token, { opacity: 0, y: toY, "--kin-blur": 6 }, spring.token),
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
        await together([hide(tokens.r), show(tokens.range)]);
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
