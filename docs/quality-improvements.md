# tw-fade quality improvements

The October 11 audit fixes preserve the independent-effects work and single-class public API. The prebuilt stylesheet is 80,750 bytes raw and 7,018 bytes gzip, down from the audited fresh build's 344,539 and 10,983 bytes. Existing edits were copied to `/private/tmp/tw-fade-before-quality-fixes-1791763247` before implementation.

## Plan

Release `0.9.0` includes these improvements and the independent opacity/blur API. Prepare versioned migration notes, run the release checks, and push the source to `main`. Publish the package to npm and deploy the demo through the existing site sync command. Use an isolated site worktree because the main site checkout contains unrelated work. Verify the published package and production assets before declaring the release complete.

The Opus review fixes are complete. Onset stays local to each scroller. Focus rings use unmasked demo containers, and copy failures announce the recovery action. Palette checks exercise first reveal and reveal after a changed selection, before arrow-key handling can repair the Tab order. Explicit scroll events make these checks reliable in Linux WebKit.

| Group | Changes and reason | Verification | Status |
| --- | --- | --- | --- |
| CSS behavior | Private defaults reset in the base layer. Onset is a non-inheriting number with a default of 8 and a fallback when registration is unavailable. | Component-layer, authored-onset, nested-host, invalid-ancestor, renderer-parity, and static-fallback checks pass | Complete |
| CSS size | The prebuilt build derives two shared renderer groups from existing utility definitions. Source-path variants and custom class builds retain their native compilation. | Named API and pixel checks pass; budgets reduced to 90 KB raw and 8 KB gzip | Complete |
| Demo access | Scroller focus rings appear outside the fade masks. The selected surface radio is the sole Tab stop. Copy errors show and announce recovery guidance, and fallback copying restores focus. | Focus pixel comparisons pass. Runtime checks pass on macOS and Linux, including WebKit | Complete |
| Demo adoption | The mobile hero is shorter. | At 390×844, the first scroller starts at 565px instead of about 725px; no horizontal page overflow | Complete |
| Support wording | The blur lab describes detected syntax rather than claiming rendering support. | Unsupported-state check uses visible capability state rather than a frozen sentence | Complete |
| Browser coverage | The same named-API table runs against source and prebuilt CSS. Source blur also has pixel checks. CI installs Firefox. | 1,123 effect checks and the full local verifier chain pass | Complete |
| Native Safari | Safari 18.6 desktop fallback passes. Safari 26.2 on an iPhone 17 Pro simulator passes source/prebuilt blur pixels, scroll state, RTL, and overlay interaction. | Simulator verification completed as requested; physical hardware was not tested | Complete for simulator scope |

## Review and verification

The source-default and build-sharing changes received independent review. The demo review caught focus loss in the legacy clipboard fallback and a stale blur-lab wording assertion; both were corrected. Independent review of the Opus follow-up found no remaining product defect. A coverage gap prompted an added check that nested opacity and blur use the same onset.

Both stylesheets have been regenerated. The package tests pass 33/33. The full `npm run verify` command exits successfully, including 1,123/1,123 independent-effect checks, RTL, stale-state, opacity, scrollbar, demo assets, page behavior, runtime interactions, favicons, SEO, and export checks. The blur lab passes 56/56 checks and reproduces its documented WebKit stale-state limitation.

The complete demo runtime verifier also passes in a disposable Debian 12 container with Linux Chromium and WebKit. This covers palette visibility, real Tab entry on both reveals, copy failure and retry, and existing desktop/mobile scenarios. The container was removed afterward. No remote CI run was started.

Disposable checks confirmed the regressions themselves. A browser response that restored the old palette bug failed both reveal checks, while the current code passed. Focused onset checks reproduced the inheritance failures with pre-fix CSS; all 22 pass with the fix. Pixel comparisons in Chrome 155 confirmed visible focus rings on the chat, type specimen, and patterned-background scrollers while their masks remained active.

Earlier audit runs lost browser page targets during runtime and favicon checks. Installed Chrome 155 was used for those earlier checks. The latest full verifier passed with the default browser, but the cause of the intermittent target closures remains unknown.

The accessibility scan no longer flags the three scrollers. When visible, the existing surface picker is outside all page landmarks. That separate finding is recorded for follow-up; it predates the focus and Tab-order changes. The scan also leaves manual checks for contrast within intentionally faded text and existing generic-element ARIA labels.

Native Safari was checked through its WebDriver because the browser CLI did not provide a working native Safari session. Six pixel/state checks passed in desktop Safari 18.6. The user selected an iPhone simulator for the remaining mobile check. The iPhone 17 Pro simulator runs iOS/Safari 26.2, build 23C54, with a 402 CSS-pixel viewport and device pixel ratio 3.

All six required CSS capabilities are present in simulator Safari. Each distribution path passed eight composited-pixel checks: single blur, progressive blur, crisp centers, blur-only behavior, malformed-layer fallback, clear zones, transformed-host fallback, and a plain backdrop-filter control. Edge sharpness fell from 0.9955 for opacity alone to 0.5946 with single blur and 0.3198 with progressive blur. The center remained at 1.0. These are the existing verifier's normalized edge-profile measurements, not perceptual quality scores.

Eight lab checks passed for vertical start/middle/end, horizontal selection, mixed RTL, all-edge selection, layer counts, and overlay hit testing. A direct native Simulator click increased the test button's visible tap count from 0 to 1 beneath progressive blur with four direct layer spans. Scroll-state checks used programmatic offsets; this does not establish physical gesture performance.

The known shrink limitation reproduced. After content shrank from 2,389 to 390 pixels in a 390-pixel-high scrollport, top/bottom blur amounts remained approximately 0.016/0.984. The lab's warning was active. This remains a documented WebKit limitation.

Safari WebDriver's element screenshots omitted backdrop blur, including the plain control. Pixel proof therefore uses `simctl` display screenshots, calibrated against a viewport-origin marker and downsampled from device pixels to CSS pixels. The native tap check used the Simulator UI after closing the automation session, because WebDriver click calls produced no touch events. No project dependency or simulator setting was changed. [WebKit documents Safari's native simulator automation support](https://webkit.org/blog/9395/webdriver-is-coming-to-safari-in-ios-13/).

No publication, deployment, version bump, or release-tooling change was made. The approved CI change is limited to installing Firefox and keeping its explanatory comment accurate. A remote CI run was not started.

Current verification logs are in `/private/tmp/`: `tw-fade-review-fixes-unit.log`, `tw-fade-review-fixes-verify.log`, `tw-fade-review-fixes-blur-lab.log`, `tw-fade-review-fixes-linux-runtime-final.log`, `tw-fade-review-palette-mutation.log`, and `tw-fade-review-onset-verifier.log`. Focus evidence is in `tw-fade-focus-repair-state.json` and `tw-fade-focus-repair-pixels.json` in that directory. The saved state before these follow-up fixes is `/private/tmp/tw-fade-before-review-fixes-1791768993`.

Earlier native Safari evidence is in `/private/tmp/tw-fade-native-safari-fallback.json` and `/private/tmp/tw-fade-ios-check/`. The simulator directory includes `standalone-composited-results.json`, `source-composited-results.json`, `lab-results.json`, and display captures. `tw-fade-quality-session.diff` isolates the original quality improvements from the earlier working tree. The simulator results cover the requested mobile scope; physical hardware and other Safari releases were not tested.
