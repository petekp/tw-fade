# tw-fade quality audit

This report records the snapshot before repairs. Implementation progress and current verification are in [quality improvements](./quality-improvements.md). The evidence below describes the audited state, including its failed checks.

Audit date: October 11, 2026. The reviewed snapshot is the working tree on `main` at `a72aa76`, including its existing uncommitted changes. This audit changed only this report. Temporary probes, builds, screenshots, and logs were written outside the repository. Nothing was committed, published, or deployed.

## Engineering findings

**1. Component-layer configuration is erased by fade defaults.** High severity; confirmed bug; high confidence.

Location: [src/tw-fade.css:443](../src/tw-fade.css#L443), with the separate onset default at [line 523](../src/tw-fade.css#L523).

Tailwind places the reset sublayer inside `utilities`, which outranks `components`. Compile the following and compare a `panel fade-y` scroller with `fade-y fade-size-lg fade-always`:

```css
@import "tailwindcss";
@import "./src/tw-fade.css";
@layer components {
  .panel { @apply fade-size-lg fade-always; }
}
```

The component case computes the default size and automatic mode. Direct utilities compute `4rem` and forced mode. This rules out invalid values or missing browser capabilities. The existing component comparison in [build/verify-dist.mjs:240](../build/verify-dist.mjs#L240) fails for size, clear zone, and travel. The complete verifier reports 602/603 passing checks.

The documented author property `--tw-fade-onset` is also overwritten: a component-layer value of `2` computes as `8`. Move local resets below component configuration and use a lower-priority default or consumer fallback for onset. Preserve nested-scroller isolation. Reuse the existing component comparison; verify the author property separately.

**2. Stale distribution CSS hides protected classic scrollbar tracks.** Medium severity; confirmed generated-artifact defect; high confidence.

Location: [dist/tw-fade.css](../dist/tw-fade.css), [scripts/build-css.mjs:70](../scripts/build-css.mjs#L70), [test/plugin.test.mjs:206](../test/plugin.test.mjs#L206).

The scrollbar verifier fails 15 track-color assertions. Protected track pixels show the blue page background instead of the green scrollbar track. The failures include horizontal and vertical tracks, zoom, widths, borders, and both blur structures. Geometry checks still pass.

The entire scrollbar verifier passes against a temporary fresh compile of the current source. The previous committed CSS also passes the track-color checks on this machine. These comparisons isolate the failure to the stale distribution. They rule out a simple macOS display-setting explanation and show that another source renderer repair is unnecessary for this failure.

`npm test` reports 32/33 passing tests. The failure compares the distribution against a fresh compile. The current file is 336,981 bytes; the current compiler produces 344,539 bytes. The fresh output declares the theme/base/components/utilities ordering and wraps its utility rules in the utilities layer. The stale output leaves them unlayered.

The normal release command and `prepublishOnly` hook rebuild the distribution. This finding applies to the current checkout and its failed checks; it is not evidence that the published package contains the defect. Finalize the component-default repair, regenerate the distribution, then rerun the freshness and browser checks. Do not loosen those assertions. A temporary demo rebuild also succeeded; its only difference from the checked-in demo CSS was one unused `bg-transparent` rule.

**3. Share renderer rules to reduce the prebuilt stylesheet.** High-priority opportunity; confirmed size cost; high confidence.

Location: [src/tw-fade.css:946](../src/tw-fade.css#L946), [test/plugin.test.mjs:81](../test/plugin.test.mjs#L81).

Fourteen direction utilities expand the common renderer through `@apply`. The current 350,000-byte raw budget permits nearly ten times the previous complete stylesheet. Measurements below use Node's default gzip settings and temporary or in-memory output:

| CSS scope | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Previous committed complete distribution | 34,986 | 3,931 |
| Fresh current complete distribution | 344,539 | 10,983 |
| Current `fade-y` only | 27,823 | 2,995 |
| Current `fade-y fade-blur-y` | 53,882 | 4,843 |

The largest cost falls on prebuilt consumers, who receive all named utilities. Tailwind source consumers can emit only the utilities they use. These small compiles are not measurements of a complete application stylesheet.

Prototype shared renderer emission while retaining the existing single-class API. Compare raw and compressed size and verify variants, RTL, component layers, and actual blur pixels before selecting the implementation. Replacing the API with a mandatory base class would change the product contract.

**4. CI does not install Firefox, which its checks require.** Medium severity; confirmed configuration mismatch; high confidence. The clean-runner failure is inferred from the workflow, not observed in a new CI run.

Location: [.github/workflows/ci.yml:23](../.github/workflows/ci.yml#L23), [build/verify-dist.mjs:457](../build/verify-dist.mjs#L457).

The workflow installs Chromium and WebKit. The required verify chain also launches Firefox unconditionally. Once unit tests pass, a fresh runner lacks that required executable.

Install Firefox in the existing browser-install step, then verify on a clean runner. This specific CI change requires Pete's approval. No workflow was edited.

**5. Source-path blur needs the same pixel proof as standalone CSS.** Medium-priority opportunity; confirmed coverage gap; high confidence.

Location: [build/verify-dist.mjs:237](../build/verify-dist.mjs#L237), [line 330](../build/verify-dist.mjs#L330), [line 456](../build/verify-dist.mjs#L456).

The verifier compiles the real Tailwind source path and checks computed masks, progress, variants, and component composition. Its blur pixel checks use the standalone distribution. A source-specific painting difference can therefore escape the pixel comparisons.

Reuse representative single, progressive, blur-only, and fallback pixel cases with the already compiled source stylesheet. Keep the existing component check, which correctly catches finding 1. No permanent tests were added during the audit.

## Design findings

**6. Three scrolling examples lack explicit keyboard focus.** Medium severity; confirmed accessibility gap; high confidence.

Location: [demo/index.html:1205](../demo/index.html#L1205), [line 1344](../demo/index.html#L1344), [line 2394](../demo/index.html#L2394).

The browser accessibility audit flags the chat, advanced type specimen, and patterned word rail. They have neither an explicit focus target nor focusable content. Some browsers provide automatic scroll-container focus, so this result does not establish universal keyboard failure.

Make each scroller explicitly keyboard reachable and give it a visible focus state and accessible name. Verify arrow keys and Page Up/Down in Chromium and WebKit. The existing runtime smoke's broad accessibility summary does not check this contract.

**7. The color picker hides keyboard focus and adds four Tab stops.** Medium severity; confirmed accessibility defect; high confidence.

Location: [demo/demo-controls.js:974](../demo/demo-controls.js#L974), [line 1066](../demo/demo-controls.js#L1066), [demo/demo.css:1593](../demo/demo.css#L1593).

After scrolling the page, all four radios have `tabIndex=0`. Arrow Right selects and focuses Cobalt, but all four remain Tab stops. The computed outline style is `none`; the CSS provides no replacement focus-visible rule.

Maintain one Tab stop on the selected radio and show focus separately from selection. The existing selected-color treatment should remain. Browser reproduction confirmed the tab indices, arrow behavior, and missing outline.

**8. A failed copy has no visible explanation.** Medium severity; confirmed usability defect; high confidence.

Location: [demo/demo-controls.js:1251](../demo/demo-controls.js#L1251), [demo/index.html:580](../demo/index.html#L580).

Rejecting `navigator.clipboard.writeText` and returning false from the fallback copy command produces `Copy failed` only in the visually hidden live region. Its rendered box is 1×1 pixels. The button returns to its ordinary appearance.

Show concise failure feedback next to the selectable command. Preserve the live announcement. This gives users a recovery path when clipboard access is unavailable.

**9. Show a complete working fade earlier on mobile.** Medium-priority design opportunity; observed layout, inferred adoption benefit; medium confidence.

Location: [demo/index.html:189](../demo/index.html#L189).

At 390×844, the first scroller begins around 725px down the page. Most of its working area is below the opening viewport. The header uses a `75vh` minimum height. The distinctive wordmark works; the large vertical allocation delays the demonstration of the actual package.

Reduce the hero's minimum height on narrow screens. Compare the opening viewport before and after, keeping the wordmark legible and exposing enough scroll content to demonstrate the fade. This is a design judgment, not a measured conversion result.

**10. Complete the path from configuration to implementation.** Medium-priority design opportunity; confirmed missing affordance, inferred user benefit; medium confidence.

Location: [demo/index.html:538](../demo/index.html#L538), [line 1324](../demo/index.html#L1324).

The page copies the install command and shows changing utility names. It has no complete copyable usage example or clearly labeled usage link. Visitors must find the repository instructions to learn the imports, overflow setting, and bounded scroller size.

Add a compact example tied to the current controls, with valid imports and markup. Let users copy it. This directly supports the task the configurator invites them to do. Once blur is ready to release, expose its comparison through the public demo; the current blur lab is intentionally excluded from production.

**11. The blur lab overstates what its support check proves.** Low severity; confirmed wording mismatch; high confidence.

Location: [demo/blur-lab.js:66](../demo/blur-lab.js#L66), [README.md:420](../README.md#L420).

The lab says blur features are supported based only on `CSS.supports`. The README correctly distinguishes accepted syntax from working rendering. A host with an ineligible anchor can pass these checks and still show no blur.

Describe the detected syntax capabilities precisely. Keep native browser rendering verification separate from that status. No broader support promise is justified by this check.

## Verification and next steps

| Check | Result |
| --- | --- |
| Package tests | 32/33 passed; stale distribution failed |
| Base demo fade state | 14/14 passed |
| Horizontal and RTL behavior | 15/15 passed |
| Independent effects and standalone browser checks | 602/603 passed; component-layer comparison failed |
| Dynamic-content verifier | 14/14 passed |
| Opacity pixel verifier | 17/17 passed |
| Scrollbar pixel verifier | 15 assertions fail against checked-in dist; all pass against a fresh temporary compile |
| Demo assets, page structure, favicon, SEO | All exited 0 |
| Demo runtime smoke | Exited 0 across file/export routes, mobile, bundled WebKit iPhone emulation, reduced motion, and its existing interaction checks |
| Blur lab | 56/56 passed; one documented WebKit stale-state limitation reproduced |
| Package dry-run inventory | Expected seven files and export paths present |
| Demo temporary build | Exited 0; only an unused rule differs |
| Browser accessibility audit | Three scrollers flagged for focusability |

The browser verifier used Chromium 149.0.7827.55. Interactive inspection also used installed Chrome 155 and checked normal and reduced motion. Initial browser-process interruptions were resolved through permitted browser launch and isolated reruns. No failed run was counted as a pass.

The whole `npm run verify` chain is not green. Its scripts were run separately after the failing or interrupted stage so later checks were still covered. Existing tests already catch the important layer and scrollbar regressions; the test-audit pass found no reason to replace those tests with source-text assertions.

Native current Safari and physical iPhone blur remain unverified. Bundled WebKit checks establish state and geometry, not native-device rendering. The lab reproduced the already documented stale state after scrollable content shrinks. This is a coverage limit, not a new support guarantee.

| Area | Final coverage |
| --- | --- |
| Selector composition, modes, variants, nested scrollers | Covered; component-layer defect confirmed |
| Mask pixels, RTL, dynamic content, scrollbars | Covered; scrollbar regression confirmed |
| Package exports, artifacts, generated size | Covered; stale artifact and repeated renderer cost confirmed |
| Demo controls, responsive layout, clipboard failure, keyboard | Source and live-browser inspection completed |
| CI and release tooling | Read-only inspection; no release or remote CI run |
| Documentation and public properties | Compared with current source; release status is explicitly marked unreleased |
| Native Safari and physical iPhone blur | Follow-up required |

Fix order: repair the component defaults, regenerate the distribution, and require the existing checks to pass. Reduce renderer duplication before adding more utility families. Address the CI browser installation with separate approval. Follow with keyboard and copy-error fixes, then the mobile layout and copyable example.

The residue sweep found no `TODO`, `FIXME`, `HACK`, or `XXX` markers in the inspected source, scripts, tests, and non-generated demo code. Release preparation writes version metadata before validation; that behavior was recorded during inspection but was not promoted to a defect without a contrary contract. Existing release-status documentation and package exports are internally consistent.

Evidence logs and probes are under `/private/tmp/`, including `tw-fade-audit-npm-test.log`, `tw-fade-quality-dist.log`, `tw-fade-quality-verify-scrollbar.log`, `tw-fade-fresh-dist-scrollbar.log`, `tw-fade-quality-demo-runtime.log`, and `tw-fade-quality-verify-blur-lab.log`. Browser screenshots use the `tw-fade-quality-` prefix. These temporary files support this report; the reproduction commands and outcomes above are the durable record.
