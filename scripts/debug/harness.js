/* tw-fade debug harness — runtime logic.
 *
 * Drives the inlined plugin via the public custom properties only:
 *   --tw-fade-size / --tw-fade-travel / --tw-fade-onset / --tw-fade-clear
 * (all @property inherits:false, so they are set on each .fade* element
 * directly, never a parent). Structural scenarios + parameter sweeps are
 * generated from the SCENARIOS / SWEEPS config below. The single most useful
 * affordance for a scroll-driven plugin is synchronized scroll: every sample
 * scroller is pinned to the same offset so you can compare them frame-for-frame.
 *
 * Notes baked into the controls:
 *   - onset = 1 reproduces the OLD coupled behavior (alpha = t); 8 is the new
 *     decoupled default. That IS the A/B toggle.
 *   - "Static fallback" forces .fade-always, mirroring the @supports-not path
 *     that pins t/b/l/r = 1 where scroll-driven animation is unsupported.
 */
(() => {
  'use strict';

  const COLORS = ['#6ea8fe', '#5be0c0', '#ffb454', '#ff7eb6', '#b388ff', '#7ee787', '#f0883e', '#79c0ff'];
  const grad = (i) => `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 3) % COLORS.length]})`;

  const state = {
    size: null,      // null = plugin default; else number (px)
    travel: null,      // null = plugin default; else number (px)
    onset: 8,
    clear: 0,        // px
    scrollPct: 0,    // 0..1
    scrollPx: null,  // when set, absolute px offset (overrides pct)
    scrollMode: 'start', // 'start' | 'end' — which side scrollPx is measured from
    rtl: false,
    content: 'auto',
    bg: 'light',
    shape: 'rounded',
    fallback: false,
  };

  let autoTimer = null;
  let autoDir = 1;

  /* ---- content generators ------------------------------------------- */
  const LOREM = [
    'Scroll-driven masks ride the container’s own scroll position—no JavaScript, no observers.',
    'The leading edge is covered the instant you scroll, while the soft band keeps easing open over the travel.',
    'Each edge is an independent linear-gradient mask layer, composited with mask-composite: intersect.',
    'Because the fade is a mask, whatever sits behind the scroller shows through the faded pixels.',
    'Try a checkerboard or photo background to see the exact silhouette the mask carves.',
    'Vertical edges stay physical; horizontal start/end edges flip with text direction.',
    'A flush, unscrolled edge shows nothing—alpha is zero until the scroll timeline advances.',
    'Crank onset down to 1 and the old hard-clip coupling returns: the edge lags the scroll.',
  ];

  function cText(n) {
    let h = '<div class="body-pad"><h3>Read me while scrolling</h3>';
    for (let i = 0; i < n; i++) h += `<p>${LOREM[i % LOREM.length]}</p>`;
    return h + '</div>';
  }
  function cCards(n) {
    let h = '<div class="minilist">';
    for (let i = 0; i < n; i++) h += `<div class="minicard"><b>Item ${i + 1}</b><span>secondary line of supporting metadata</span></div>`;
    return h + '</div>';
  }
  function cTiles(n) {
    let h = '<div class="tilegrid">';
    for (let i = 0; i < n; i++) h += `<div class="tile" style="background:${grad(i)}"></div>`;
    return h + '</div>';
  }
  function cCode() {
    const lines = [
      '<div class="fade-y overflow-auto">',
      '  <!-- the leading edge is masked the',
      '       instant you scroll -->',
      '</div>',
      '',
      '.fade-y {',
      '  --tw-fade-size: 3rem;',
      '  --tw-fade-travel: 2rem;  /* band open */',
      '  --tw-fade-onset: 8;    /* edge speed */',
      '}',
      '',
      'fade        all four edges',
      'fade-y      top + bottom',
      'fade-x      start + end (RTL-aware)',
      'fade-top    leading vertical only',
      'fade-bottom trailing vertical only',
    ];
    let body = '';
    for (let k = 0; k < 3; k++) body += lines.join('\n') + '\n\n';
    return `<pre class="code">${body}</pre>`;
  }
  function cDense(n) {
    let h = '<div class="dense">';
    for (let i = 0; i < n; i++) h += `<div class="row"><span>row label ${i + 1}</span><span>${(Math.sin(i) * 1000 | 0)}</span></div>`;
    return h + '</div>';
  }
  function cChips(n) {
    const words = ['All', 'Design', 'Engineering', 'Marketing', 'Sales', 'Support', 'Research', 'Ops', 'Finance', 'Legal', 'People', 'Data', 'Brand', 'Growth'];
    let h = '<div class="track">';
    for (let i = 0; i < n; i++) h += `<div class="chip">${words[i % words.length]} ${i + 1}</div>`;
    return h + '</div>';
  }
  function cHCards(n) {
    let h = '<div class="track">';
    for (let i = 0; i < n; i++) h += `<div class="hcard" style="background:${grad(i)}">Card ${i + 1}</div>`;
    return h + '</div>';
  }
  function cPlane(cols, rows) {
    let h = `<div class="plane"><div class="grid2d" style="grid-template-columns:repeat(${cols},84px)">`;
    for (let i = 0; i < cols * rows; i++) h += `<div class="cell" style="background:${grad(i)}">${i + 1}</div>`;
    return h + '</div></div>';
  }

  const CONTENT = {
    text: () => cText(10),
    cards: () => cCards(14),
    images: () => cTiles(18),
    code: () => cCode(),
    dense: () => cDense(28),
  };

  /* ---- scenarios ----------------------------------------------------- */
  // kind: 'simple' (scroller + body html) or a named special builder.
  // flex: body follows the global content-type selector when true.
  const SCENARIOS = {
    directions: [
      { id: 'fy', label: 'fade-y', cls: 'fade-y', body: () => cText(10), flex: true, note: 'Top + bottom. The canonical vertical scroller.' },
      { id: 'ftop', label: 'fade-top', cls: 'fade-top', body: () => cText(10), flex: true, note: 'Leading edge only; bottom is never masked.' },
      { id: 'fbot', label: 'fade-bottom', cls: 'fade-bottom', body: () => cText(10), flex: true, note: 'Trailing edge only; only dissolves near the very end.' },
      { id: 'fall', label: 'fade (all edges)', cls: 'fade', special: 'plane', note: '2-D scroll. Four mask layers intersect at the corners.' },
      { id: 'fx', label: 'fade-x', cls: 'fade-x', special: 'hscroll', content: 'chips', note: 'Inline start + end. Flips under RTL.' },
      { id: 'fstart', label: 'fade-start', cls: 'fade-start', special: 'hscroll', content: 'chips', note: 'Inline leading edge. Right edge under RTL.' },
      { id: 'fend', label: 'fade-end', cls: 'fade-end', special: 'hscroll', content: 'chips', note: 'Inline trailing edge. Left edge under RTL.' },
    ],
    realworld: [
      { id: 'short', label: 'Short content', cls: 'fade-y short', special: 'short', note: 'Does NOT overflow → must show NO fade (scroll-driven path).' },
      { id: 'sticky', label: 'Sticky header', cls: 'fade-y', special: 'sticky', note: 'Sticky header sits over the faded top edge — watch for double-dim.' },
      { id: 'leadin', label: 'Padding lead-in', cls: 'fade-y', special: 'leadin', note: 'Top/bottom padding inside the scroller; fade rides the padded edge.' },
      { id: 'snap', label: 'Scroll-snap', cls: 'fade-y snap', special: 'snap', note: 'scroll-snap-type: y mandatory. Fade should track snapped offsets.' },
      { id: 'nested', label: 'Nested fade', cls: 'fade-y', special: 'nested', note: 'A fade-y scroller inside a fade-y scroller (block-axis isolation).' },
      { id: 'images', label: 'Image grid', cls: 'fade-y', special: 'simple', content: 'images', flex: true, note: 'Dense visual content; mask edge crosses tile boundaries.' },
      { id: 'code', label: 'Code block', cls: 'fade-y', special: 'simple', content: 'code', flex: true, note: 'Monospace, pre-wrapped; check baseline alignment at the edge.' },
      { id: 'tiny', label: 'Tiny container', cls: 'fade-y tiny', special: 'simple', content: 'dense', note: 'Very short viewport; size may exceed the box.' },
      { id: 'bordered', label: 'Thick border', cls: 'fade-y', special: 'bordered', note: 'Mask clips the element box — border + fade interaction.' },
      { id: 'hcards', label: 'Horizontal cards', cls: 'fade-x', special: 'hscroll', content: 'hcards', note: 'Fast flick row; both inline edges fade.' },
      { id: 'bigsize', label: 'Oversized fade (50%)', cls: 'fade-y', special: 'simple', content: 'text', lock: { vars: { '--tw-fade-size': '50%' } }, note: 'Degenerate: each band is half the viewport. Bands should not cross.' },
      { id: 'peredge', label: 'Per-edge sizes', cls: 'fade-y', special: 'simple', content: 'text', lock: { vars: { '--tw-fade-size-top': '72px', '--tw-fade-size-bottom': '16px' } }, note: 'top 72px / bottom 16px — asymmetric per-edge sizing.' },
      { id: 'clip', label: 'overflow: clip (trap)', cls: 'fade-y', special: 'clip', content: 'text', note: 'overflow:clip is not a scroll container → timeline inert → NO fade though content IS clipped.' },
      { id: 'fnone', label: 'fade-none (control)', cls: 'fade-y fade-none', special: 'simple', content: 'text', noFallback: true, note: 'Forced off — must never fade, even mid-scroll.' },
      { id: 'noney', label: 'fade-none-y on fade', cls: 'fade fade-none-y', special: 'plane', noFallback: true, note: 'All edges armed, vertical forced off → only the inline (l/r) edges fade.' },
      { id: 'alwaysx', label: 'fade-always-x on fade-y', cls: 'fade-y fade-always-x', special: 'simple', content: 'text', noFallback: true, note: 'l/r pinned to 1 but fade-y has no horizontal layer → identity mask, NO horizontal fade.' },
    ],
  };

  // One parameter swept across its scale, all cells at the global scroll offset.
  const SWEEPS = [
    {
      title: 'Travel sweep', key: 'travel', unit: 'px',
      desc: 'Band-open speed. With the new decouple, the edge is covered immediately at every travel — only the soft band widens. Scrub to ~8px to compare.',
      values: [12, 24, 48, 80, 120, 160],
    },
    {
      title: 'Onset sweep', key: 'onset', unit: '',
      desc: 'Edge-coverage speed. onset 1 = the OLD coupled hard-clip; 8 = current default. Scrub to ~8px to see the difference.',
      values: [1, 2, 4, 8, 12, 24],
    },
    {
      title: 'Size sweep', key: 'size', unit: 'px',
      desc: 'Band width at full fade. Pure cosmetics — does not affect when the clip is covered.',
      values: [24, 32, 48, 64, 96, 128],
    },
    {
      title: 'Clear sweep', key: 'clear', unit: 'px',
      desc: 'Untouched gap before the band starts. Useful to keep a pinned first row crisp.',
      values: [0, 8, 16, 24, 40],
    },
  ];

  /* ---- DOM building -------------------------------------------------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function bodyHtmlFor(scn) {
    const content = (state.content !== 'auto' && scn.flex) ? state.content : scn.content;
    if (content && CONTENT[content]) return CONTENT[content]();
    if (content === 'chips') return cChips(26);
    if (content === 'hcards') return cHCards(12);
    return cText(10);
  }

  function buildScroller(scn) {
    const lock = scn.lock ? JSON.stringify(scn.lock) : '{}';
    const extra = scn.noFallback ? ' data-nofallback="1"' : '';
    const sp = scn.special;
    let cls = 'scroller ' + scn.cls;
    let styleAttr = '';
    let inner;

    if (sp === 'plane') { cls += ' h'; inner = cPlane(8, 8); }
    else if (sp === 'clip') { styleAttr = ' style="overflow:clip"'; inner = bodyHtmlFor(scn); }
    else if (sp === 'hscroll') { cls += ' h'; inner = bodyHtmlFor(scn); }
    else if (sp === 'sticky') {
      inner = '<div class="sticky-h">Sticky header · stays pinned</div>' + cCards(14);
    }
    else if (sp === 'leadin') { inner = '<div class="body-pad lead-in"><p>' + LOREM.join('</p><p>') + '</p></div>'; }
    else if (sp === 'snap') {
      let s = '<div>';
      for (let i = 0; i < 10; i++) s += `<div class="snapitem" style="background:${grad(i)}">${i + 1}</div>`;
      inner = s + '</div>';
    }
    else if (sp === 'short') { inner = '<div class="body-pad"><p>' + LOREM[0] + '</p></div>'; }
    else { inner = bodyHtmlFor(scn); }

    let html = `<div class="${cls}" data-lock='${lock}'${extra}${styleAttr}>${inner}</div>`;

    if (sp === 'nested') {
      html = `<div class="scroller fade-y" data-lock='${lock}'${extra}>`
        + '<div class="nested-outer"><p style="margin:0 0 8px">Outer scroller. The inner box is its own fade-y scroll context.</p>'
        + '<div class="nested-inner scroller fade-y" data-lock=\'{}\'>' + cDense(18) + '</div>'
        + '<p style="margin:8px 0 0">After the nested region the outer keeps scrolling so its own bottom edge fades.</p>'
        + cText(6).replace('<div class="body-pad">', '<div class="body-pad" style="padding-top:0">')
        + '</div></div>';
    }
    if (sp === 'bordered') {
      html = `<div class="scroller fade-y" data-lock='${lock}'${extra} style="border:6px solid #6ea8fe">${cCards(14)}</div>`;
    }
    return html;
  }

  function buildCard(scn) {
    return `<div class="card" data-card="${scn.id}">`
      + `<div class="card-head"><span class="card-label">${esc(scn.label)}</span>`
      + `<span class="card-tag">${esc(scn.cls.replace('scroller', '').trim())}</span>`
      + '<span class="readout"></span></div>'
      + buildScroller(scn)
      + `<div class="card-note">${esc(scn.note || '')}</div>`
      + '</div>';
  }

  function buildSweepCard(sweep, value) {
    const lock = { [sweep.key]: value };
    const label = `${sweep.key} ${value}${sweep.unit}` + (sweep.key === 'onset' && value === 1 ? ' (old)' : (sweep.key === 'onset' && value === 8 ? ' (default)' : ''));
    return `<div class="card"><div class="card-head"><span class="card-label">${esc(label)}</span><span class="readout"></span></div>`
      + `<div class="scroller fade-y short" data-lock='${JSON.stringify(lock)}'>${cText(9)}</div>`
      + '</div>';
  }

  function render() {
    const stage = document.getElementById('stage');
    let h = '';

    h += '<div class="section-h"><h2>Directions</h2><span class="desc">all seven public direction utilities on identical content</span></div>';
    h += '<div class="grid">' + SCENARIOS.directions.map(buildCard).join('') + '</div>';

    h += '<div class="section-h"><h2>Real-world &amp; edge cases</h2><span class="desc">layouts and content that have historically broken edge-fade plugins</span></div>';
    h += '<div class="grid">' + SCENARIOS.realworld.map(buildCard).join('') + '</div>';

    SWEEPS.forEach((sw) => {
      h += `<div class="section-h"><h2>${esc(sw.title)}</h2><span class="desc">${esc(sw.desc)}</span></div>`;
      h += '<div class="grid sweep">' + sw.values.map((v) => buildSweepCard(sw, v)).join('') + '</div>';
    });

    stage.innerHTML = h;
    applyStageChrome();
    applyAll();
    syncScroll();
  }

  /* ---- applying parameters ------------------------------------------ */
  function setVarPx(el, prop, value) {
    if (value == null || value === '') el.style.removeProperty(prop);
    else el.style.setProperty(prop, typeof value === 'number' ? value + 'px' : value);
  }

  function applyTo(el) {
    const lock = JSON.parse(el.dataset.lock || '{}');
    const p = {
      size: 'size' in lock ? lock.size : state.size,
      travel: 'travel' in lock ? lock.travel : state.travel,
      onset: 'onset' in lock ? lock.onset : state.onset,
      clear: 'clear' in lock ? lock.clear : state.clear,
    };
    setVarPx(el, '--tw-fade-size', p.size);
    setVarPx(el, '--tw-fade-travel', p.travel);
    el.style.setProperty('--tw-fade-onset', String(p.onset));
    setVarPx(el, '--tw-fade-clear', p.clear);
    if (lock.vars) for (const k in lock.vars) el.style.setProperty(k, lock.vars[k]);
    const allowFallback = state.fallback && !el.dataset.nofallback;
    el.classList.toggle('fade-always', allowFallback);
  }

  function applyAll() {
    document.querySelectorAll('.scroller').forEach(applyTo);
  }

  function applyStageChrome() {
    const stage = document.getElementById('stage');
    stage.className = 'stage bg-' + state.bg + ' shape-' + state.shape;
    const grid = stage;
    grid.dir = state.rtl ? 'rtl' : 'ltr';
  }

  /* ---- scroll sync --------------------------------------------------- */
  function syncScroll() {
    document.querySelectorAll('.scroller').forEach((el) => {
      const maxY = el.scrollHeight - el.clientHeight;
      const maxX = el.scrollWidth - el.clientWidth;
      const sign = state.rtl ? -1 : 1;
      if (state.scrollPx != null) {
        const fromEnd = state.scrollMode === 'end';
        const posY = fromEnd ? maxY - state.scrollPx : state.scrollPx;
        const posX = fromEnd ? maxX - state.scrollPx : state.scrollPx;
        if (maxY > 0) el.scrollTop = Math.max(0, Math.min(posY, maxY));
        if (maxX > 0) el.scrollLeft = sign * Math.max(0, Math.min(posX, maxX));
      } else {
        if (maxY > 0) el.scrollTop = Math.round(state.scrollPct * maxY);
        if (maxX > 0) el.scrollLeft = sign * Math.round(state.scrollPct * maxX);
      }
    });
    requestAnimationFrame(() => requestAnimationFrame(updateReadouts));
  }

  function updateReadouts() {
    document.querySelectorAll('.card').forEach((card) => {
      const out = card.querySelector('.readout');
      const el = card.querySelector('.scroller');
      if (!out || !el) return;
      const maxY = el.scrollHeight - el.clientHeight;
      const maxX = el.scrollWidth - el.clientWidth;
      const cs = getComputedStyle(el);
      const amt = (p) => (Number(cs.getPropertyValue('--tw-fade-' + p)) || 0).toFixed(2).replace(/^0(?=\.)/, '');
      if (maxX > maxY && maxX > 0) {
        const x = Math.abs(el.scrollLeft);
        out.textContent = `x ${x|0}/${maxX|0} · ${Math.round(x / maxX * 100)}% · l${amt('l')} r${amt('r')}`;
      } else if (maxY > 0) {
        out.textContent = `y ${el.scrollTop|0}/${maxY|0} · ${Math.round(el.scrollTop / maxY * 100)}% · t${amt('t')} b${amt('b')}`;
      } else {
        out.textContent = 'no overflow → no fade';
      }
    });
  }

  /* ---- auto-scroll --------------------------------------------------- */
  function toggleAuto(on) {
    if (autoTimer) { cancelAnimationFrame(autoTimer); autoTimer = null; }
    if (!on) return;
    const tick = () => {
      state.scrollPx = null;
      state.scrollPct += autoDir * 0.004;
      if (state.scrollPct >= 1) { state.scrollPct = 1; autoDir = -1; }
      if (state.scrollPct <= 0) { state.scrollPct = 0; autoDir = 1; }
      const slider = document.getElementById('scrollRange');
      if (slider) slider.value = String(Math.round(state.scrollPct * 100));
      syncScroll();
      autoTimer = requestAnimationFrame(tick);
    };
    autoTimer = requestAnimationFrame(tick);
  }

  /* ---- controls ------------------------------------------------------ */
  function fmtSize(v) { return v == null ? 'default' : v + 'px'; }

  function wire() {
    const $ = (id) => document.getElementById(id);

    const bind = (id, fn) => { const e = $(id); if (e) e.addEventListener('input', fn); };

    bind('sizeRange', (e) => {
      state.size = e.target.value === '0' ? null : Number(e.target.value);
      $('sizeVal').textContent = fmtSize(state.size);
      applyAll();
    });
    bind('travelRange', (e) => {
      state.travel = e.target.value === '0' ? null : Number(e.target.value);
      $('travelVal').textContent = fmtSize(state.travel);
      applyAll(); syncScroll();
    });
    bind('onsetRange', (e) => {
      state.onset = Number(e.target.value);
      $('onsetVal').textContent = String(state.onset) + (state.onset === 1 ? ' (old)' : '');
      applyAll();
    });
    bind('clearRange', (e) => {
      state.clear = Number(e.target.value);
      $('clearVal').textContent = state.clear + 'px';
      applyAll();
    });

    bind('scrollRange', (e) => {
      toggleAuto(false); $('autoChk').checked = false;
      state.scrollPx = null;
      state.scrollPct = Number(e.target.value) / 100;
      syncScroll();
    });

    document.querySelectorAll('[data-scrollmode]').forEach((b) => b.addEventListener('click', () => {
      state.scrollMode = b.dataset.scrollmode;
      document.querySelectorAll('[data-scrollmode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (state.scrollPx != null) syncScroll();
    }));

    document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      toggleAuto(false); $('autoChk').checked = false;
      const v = b.dataset.step;
      if (v.endsWith('%')) { state.scrollPx = null; state.scrollPct = parseInt(v) / 100; $('scrollRange').value = parseInt(v); }
      else { state.scrollPx = Number(v); }
      syncScroll();
    }));

    $('autoChk').addEventListener('change', (e) => toggleAuto(e.target.checked));

    const reRender = () => render();
    $('contentSel').addEventListener('change', (e) => { state.content = e.target.value; reRender(); });
    $('bgSel').addEventListener('change', (e) => { state.bg = e.target.value; applyStageChrome(); });
    $('shapeSel').addEventListener('change', (e) => { state.shape = e.target.value; applyStageChrome(); });

    $('rtlChk').addEventListener('change', (e) => { state.rtl = e.target.checked; applyStageChrome(); syncScroll(); });
    $('fallbackChk').addEventListener('change', (e) => {
      state.fallback = e.target.checked;
      e.target.closest('.toggle').dataset.on = String(state.fallback);
      applyAll();
    });
    $('resetBtn').addEventListener('click', () => {
      Object.assign(state, { size: null, travel: null, onset: 8, clear: 0, scrollPct: 0, scrollPx: null, fallback: false });
      toggleAuto(false);
      document.querySelectorAll('input,select').forEach((el) => {
        if (el.type === 'checkbox') el.checked = false;
      });
      $('sizeRange').value = 0; $('sizeVal').textContent = 'default';
      $('travelRange').value = 0; $('travelVal').textContent = 'default';
      $('onsetRange').value = 8; $('onsetVal').textContent = '8';
      $('clearRange').value = 0; $('clearVal').textContent = '0px';
      $('scrollRange').value = 0;
      render();
    });

    // Re-sync on real user scroll of any single card (so readouts stay honest)
    document.getElementById('stage').addEventListener('scroll', (e) => {
      if (e.target.classList && e.target.classList.contains('scroller')) {
        requestAnimationFrame(updateReadouts);
      }
    }, true);

    window.addEventListener('resize', () => syncScroll());
  }

  /* ---- init ---------------------------------------------------------- */
  function init() {
    render();
    wire();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
