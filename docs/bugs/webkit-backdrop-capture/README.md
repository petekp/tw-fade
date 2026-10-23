# Safari backdrop-blur verification

Safari 26.2 on an iPhone 17 Pro simulator renders the published tw-fade blur correctly in the tested cases. Composited display captures passed 12 pixel checks. The source build and prebuilt CSS both blur the selected edges while leaving the center unchanged.

Playwright WebKit 26.5 still returns identical screenshots for a standalone backdrop-blur control with the filter enabled and disabled. The failure occurs without tw-fade. Computed styles and successful interaction checks therefore cannot establish visible blur through that capture path.

`npm run verify:blur-lab` now calibrates each browser's screenshot path with that control. It saves the on/off images and `screenshot-capabilities.json` in the reported evidence directory. A capture that omits blur is reported as a known limitation. The geometry, state, and interaction checks continue separately. This does not repair the browser's screenshot implementation.

| Check | Result |
| --- | --- |
| Chromium 149 screenshot control | Captures blur; mean channel difference 126.91 out of 255 |
| Firefox 151 screenshot control | Identical on/off pixels in this capture path |
| WebKit 26.5 screenshot control | Identical on/off pixels in this capture path |
| Native Safari 26.2 display control | Captures blur; mean channel difference 127.22 out of 255 |
| Source and prebuilt, single and progressive blur | Top and bottom edge pixels change with blur enabled |
| Blur-only and combined fade | Both render visible blur; center pixels remain identical to the corresponding blur-off control |
| Start and end of scrolling | The reached edge is pixel-identical to blur-off; the opposite edge remains blurred |
| Lab verifier | 57/57 checks pass; capture limitations and the existing WebKit shrink-state limitation are reported |

The native check uses a separate iOS 26.2 simulator booted without opening a Simulator window. Safari loads a local fixture. `xcrun simctl io <device> screenshot <file>` captures the simulated display. A magenta marker at the viewport origin maps CSS coordinates to display pixels. The test confirms the device scale factor before comparing matching regions. The plain backdrop-filter control must visibly change before any library pixel result is accepted.

The viewport is 402 by 714 CSS pixels at device pixel ratio 3. Both distributions use a 6px single blur, the existing progressive layer sequence, a 48px effect band, and ordinary rounded frames. Middle, start, and end scroll states are tested. The renderer's CSS drives the effect; fixture JavaScript only selects the test state and records geometry.

This evidence covers the published frame-owned backdrop renderer. It does not validate the experimental SVG content-filter wrapper, all Safari releases, or physical iPhone hardware. The prebuilt CSS hash matches the earlier desktop Safari 27 verification, but that older desktop result is not counted as a fresh check here.

The [results](./results.json) include browser versions, source hashes, measured pixel differences, scroll states, and capture geometry. [Blur disabled](./safari-dist-blur-off.png) and [blur enabled](./safari-dist-blur-on.png) are unmodified simulator display captures. The WebKit control images are retained alongside them. The temporary fixture, capture script, pixel analysis, and complete captures are in `/private/tmp/tw-fade-safari-proof-WqnTzY/`.
