// Scroll-reactive page background wave. Independent from the demo controls.

// Wave background morph: amplitude + wavelength shift with scroll position.
// The page scrolls inside <body> (overflow-y-auto); the wave lives on
// <html data-surface> behind it. So we read body scroll and repaint the
// <html> background each frame. The html[data-surface] CSS rule is the
// static pre-JS / reduced-motion fallback (the scroll-0 state).
(() => {
    const P = {
        amplitudeTop: 26,
        amplitudeBottom: 74,
        wavelengthTop: 386,
        wavelengthBottom: 160,
        cycles: 3,
        spacing: 128,
        columns: 1,
        stagger: false,
        strokeWidth: 1.25,
        strokeOpacity: 0.065,
        strokeColor: "#ffffff",
    };
    const scroller = document.body;
    const target = document.documentElement;
    const r = (v) => Number(Number(v).toFixed(3));
    const lerp = (a, b, t) => a + (b - a) * t;

    // wl is pre-rounded to an int so cycles*wl === the viewBox height — the
    // tile keeps repeating seamlessly at every scroll position.
    const wave = (amp, wl) => {
        const h = wl / 2;
        const segs = 2 * Math.round(P.cycles);
        const cols = Math.round(P.columns);
        const tileW = Math.round(P.spacing) * cols;
        const H = Math.round(P.cycles) * wl;
        let d = "";
        for (let c = 0; c < cols; c++) {
            const cx = P.spacing * c + P.spacing / 2;
            const s0 = P.stagger && c % 2 === 1 ? -1 : 1;
            d += `M${r(cx)} 0C${r(cx + s0 * amp)} ${r(0.25 * h)} ${r(cx + s0 * amp)} ${r(0.75 * h)} ${r(cx)} ${r(h)}`;
            for (let i = 1; i < segs; i++) {
                const sign = s0 * (i % 2 === 0 ? 1 : -1);
                d += `S${r(cx + sign * amp)} ${r(i * h + 0.75 * h)} ${r(cx)} ${r((i + 1) * h)}`;
            }
        }
        const svg =
            `<svg xmlns='http://www.w3.org/2000/svg' width='${tileW}' height='${H}' viewBox='0 0 ${tileW} ${H}'>` +
            `<path d='${d}' fill='none' stroke='${P.strokeColor}' stroke-opacity='${P.strokeOpacity}' ` +
            `stroke-width='${P.strokeWidth}' stroke-linecap='round' stroke-linejoin='round' shape-rendering='geometricPrecision'/></svg>`;
        return {
            uri: `data:image/svg+xml,${encodeURIComponent(svg)}`,
            tileW,
            H,
        };
    };

    let lastUri = "";
    const currentScrollProgress = () => {
        const max = scroller.scrollHeight - scroller.clientHeight;
        return max > 0
            ? Math.min(1, Math.max(0, scroller.scrollTop / max))
            : 0;
    };
    const frame = (p = currentScrollProgress()) => {
        const amp = lerp(P.amplitudeTop, P.amplitudeBottom, p);
        const wl = Math.round(
            lerp(P.wavelengthTop, P.wavelengthBottom, p),
        );
        const w = wave(amp, wl);
        if (w.uri === lastUri) return; // skip frames where the rounded geometry didn't move
        lastUri = w.uri;
        target.style.backgroundImage = `url("${w.uri}")`;
        target.style.backgroundSize = `${w.tileW}px ${w.H}px`;
    };
    let pending = false;
    const queueRender = () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            frame();
        });
    };

    if (
        window.matchMedia &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
    )
        return;
    scroller.addEventListener(
        "scroll",
        () => {
            queueRender();
        },
        { passive: true },
    );
    window.addEventListener("resize", () => {
        queueRender();
    });
    frame(currentScrollProgress());
})();
