# Migrating tw-fade

Use the [0.9.0 migration](#migrating-to-090) for independent opacity and blur controls. The [0.6.x to 0.7+ procedure](#migrating-from-tw-fade-06x-to-07) covers the earlier direction and travel renames. Apply required migrations in release order.

## Migrating to 0.9.0

Version `0.9.0` keeps ordinary opacity-only selectors and their appearance. Review overlapping activation modes when upgrading from `0.8.0` or earlier, even if your project does not use blur. Projects using the earlier draft blur API also need the selector changes below.

The draft blur API coupled a strength class to opacity selection. The revised API selects opacity with `fade-*` directions and blur with `fade-blur-*` directions. Strength classes configure blur without activating it. See the [current API reference](./README.md#direction-utilities) for the complete contract.

### Replace draft blur usages

| Current draft usage | Replacement with the same intent |
| --- | --- |
| `fade-y` | unchanged |
| `fade-y fade-blur-md` | `fade-y fade-blur-y fade-blur-md` |
| `fade-y fade-blur-md fade-opaque` | `fade-blur-y fade-blur-md` |
| `fade-x fade-blur-sm fade-opaque` | `fade-blur-x fade-blur-sm` |
| `fade fade-blur-md` | `fade fade-blur fade-blur-md` |
| `fade-top fade-end fade-blur-lg` | `fade-top fade-end fade-blur-top fade-blur-end fade-blur-lg` |
| `fade-top fade-end fade-blur-lg fade-opaque` | `fade-blur-top fade-blur-end fade-blur-lg` |
| `fade-none` intended to disable both effects | `fade-none fade-blur-none` |
| `fade-none-y` intended to disable both vertically | `fade-none-y fade-blur-none-y` |
| `fade-always` intended to force both effects | `fade-always fade-blur-always` |

Add only the blur directions the call site intended. Do not replace every strength class with all-edge `fade-blur`. An explicit `fade-blur-md` may be omitted after migration because `md` (`3px`) is the default strength.

Remove `fade-opaque`; there is no compatibility alias. If it appeared without blur, remove the opacity selector to request no effect. Use `fade-none` when an explicit opacity override is needed. A blur selector alone now produces the blur-only result.

Keep exactly four empty direct `fade-blur-layer` spans to retain progressive rendering. Keep the marker unprefixed. Zero or any other layer count uses single blur. No renderer-mode class is needed.

### Review activation and conditional composition

Opacity and blur now have separate `auto`, `always`, and `none` families. Each supports global, `x`, `y`, `top`, `bottom`, `start`, and `end` scopes. Edge overrides axis, axis overrides global, and an absent mode falls through to automatic behavior. Explicit `auto` restores scrolling at that scope; it is not an unset operation.

At the same scope and identical variant chain, conflicts resolve as `none` > `auto` > `always`. The old implementation made `always` win over `none`. To retain forced opacity from `fade-y fade-none fade-always`, remove `fade-none`. To retain disabled opacity, remove `fade-always`. Reordering the class string does not change the result.

A matching conditional mode can replace the base at the same scope. `fade-none md:fade-always` remains a valid disabled-to-forced transition. A broader conditional mode cannot replace a narrower scope: change `fade-blur-none-y md:fade-blur-auto` to `fade-blur-none-y md:fade-blur-auto-y` when the intent is to restore automatic vertical blur.

Selectors remain additive. Use `max-md:fade-y md:fade-x` to switch axes. `fade-y md:fade-x` now selects both axes at `md`, because the previously inert prefixed selector is generated on the source path. To let a global mode resume after a breakpoint, bound a narrower mode: `fade-y fade-always max-md:fade-auto-y`. There is no public unset utility.

### Rebuild and verify

1. Record the starting diff and preserve unrelated work. Inventory authored class strings, class builders, safelists, and any code reading internal `--tw-fade-*` values.
2. Migrate each call site by intent. Keep opacity-only controls unchanged. Apply both disable namespaces when an app knows an axis cannot overflow and uses both effects.
3. Rebuild generated CSS from source. The standalone stylesheet contains named, unprefixed utilities; responsive and state variants require Tailwind's source path and the app's theme. Safelist complete dynamic class names.
4. Check pure opacity, pure blur, combined effects, and mixed edges at both scroll endpoints and mid-scroll. Check LTR/RTL, nested scrollers, and conditional entry and exit. Confirm geometry, scrollbar protection, and four-span progressive rendering retain their intended behavior.
5. Check fallbacks. Unsupported or anchor-ineligible blur-only hosts keep unmodified content. Combined hosts retain opacity fading. Without scroll timelines, opacity uses its static fallback and blur is omitted. Disabled effects remain disabled.
6. Remove active `fade-opaque` usages and implicit blur activation through strength classes. Historical notes and focused negative tests can retain the retired name.

Internal raw scroll amounts no longer encode selected, forced, or disabled effects. Diagnostics that display treatment should read effective opacity/blur amounts; prefer the public mode utilities for application controls. See [How it works](./README.md#how-it-works) and [dynamic-content guidance](./README.md#dynamic-content-on-a-stable-scrollport).

## Migrating from tw-fade 0.6.x to 0.7+

Use this procedure to replace the 0.6.x API and install an exact 0.7.0-or-newer release.

If the project already resolves 0.7.0 or newer but still contains 0.6.x names, treat it as a partial migration. Do not downgrade it.

## Completion criteria

The migration is complete when:

- the project resolves the requested exact version of `tw-fade`
- every old token in authored code has been replaced and derived output has been regenerated
- every retained old token is classified as history or a negative test
- every horizontal replacement has a recorded direction and edge decision
- every `fade-x` surface that can render in RTL has been reviewed
- the build, tests, and LTR/RTL checks pass
- unrelated working-tree changes remain untouched

Keep the horizontal occurrence ledger described below until verification is complete. It makes the procedure safe to resume after a partial edit.

## Step 0: Record the starting state and target

**Action**

1. Capture the starting state. Do not clean or reset existing changes.

   For Git, save the status and both tracked diffs outside the repository:

   ```bash
   MIGRATION_BASELINE_DIR="$(mktemp -d)"
   printf '%s\n' "$MIGRATION_BASELINE_DIR"
   git status --short > "$MIGRATION_BASELINE_DIR/status.txt"
   git diff --binary > "$MIGRATION_BASELINE_DIR/unstaged.patch"
   git diff --cached --binary > "$MIGRATION_BASELINE_DIR/staged.patch"
   git diff --check > "$MIGRATION_BASELINE_DIR/unstaged-check.txt" 2>&1 || true
   git diff --cached --check > "$MIGRATION_BASELINE_DIR/staged-check.txt" 2>&1 || true
   ```

   Record the printed directory. If unrelated untracked files exist, record their hashes or make a separate backup because Git diffs do not include their contents.

   Without Git, use the project's snapshot or backup tool to capture a before-diff and file list. Stop if there is no way to compare the final files with this baseline.
2. Find how the project loads `tw-fade`:
   - a dependency in a package manifest
   - a pinned or floating CDN URL
   - both
3. For package installs, identify the package manager from the `packageManager` field first, then its lockfile. If the signals disagree, stop and ask which package manager owns the lockfile.
4. Record the currently resolved version and the manifest section that declares it: `dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies`.
5. Record the exact target as `X.Y.Z`. Use the version named in the task. If the task says “current” or “latest,” resolve the current stable registry version and record the returned number:

   ```bash
   npm view tw-fade version
   ```

   Verify every target, including an explicitly requested one:

   ```bash
   npm view tw-fade@X.Y.Z version
   ```

   The command must return exactly `X.Y.Z`. Use the package manager's registry-query equivalent if npm is unavailable. If the registry is unavailable, stop and ask. Do not guess and do not commit a floating `latest` target.
6. Read each `**Migration:**` line in `CHANGELOG.md` from 0.7.0 through `X.Y.Z`. Follow every later required migration in release order. This guide is complete only for the 0.7.0 API break.

**Expected result**

You have the starting worktree state, install path, package manager, current version, and exact target version.

**Stop if**

- the target is older than 0.7.0
- the currently resolved version is older than 0.6.0 and earlier migration steps have not been supplied
- the target would downgrade the currently resolved version
- a release after 0.7.0 requires a migration that has not been completed
- more than one lockfile appears authoritative
- the install path or current version cannot be established

## Step 1: Inventory and classify old tokens

**Action**

Run this scan from the project root:

```bash
rg -nP --hidden \
  -g '!**/.git/**' \
  -g '!**/node_modules/**' \
  -g '!**/vendor/**' \
  '(?<![\w-])fade-(?:t|b|l|r|xy|static)(?![\w-])|(?<![\w-])fade-size-(?:t|b|l|r)-|(?<![\w-])fade-clear-(?:t|b|l|r|xy)-|(?<![\w-])fade-range-|--fade-range-|(?<![\w-])--fade-clear-(?:t|b|l|r|xy)(?![\w-])' .
```

Run a second, review-only scan for `fade-x`. Its name stays the same, but its RTL start/end behavior changed:

```bash
rg -nP --hidden \
  -g '!**/.git/**' \
  -g '!**/node_modules/**' \
  -g '!**/vendor/**' \
  '(?<![\w-])fade-x(?![\w-])' .
```

The second scan is not a rename list. Identify authored markup or components that render a scroller. Prose, API definitions, negative tests, and generated selectors do not need a review row.

Also inspect class builders, safelists, direction enums, and lookup tables for split names such as `fade-${edge}`. The scan only finds assembled tokens.

Classify each result from the removed-token scan before editing:

| Bucket | Examples | Action |
| --- | --- | --- |
| Migrate | authored runtime code, configuration, styles, and current examples | edit |
| Retain | changelogs, historical migration notes, and negative test fixtures | leave in place and record why |
| Regenerate | compiled CSS, bundles, snapshots, and other derived files | update the source, then regenerate |
| Ignore | dependencies, caches, and third-party vendored code | do not edit |

Do not hand-edit generated files or dependencies.

For every Migrate-bucket result in the left or right families, create an occurrence ledger before changing it. Add a review row for each `fade-x` surface that can render in RTL or has dynamic direction, even though its replacement is `unchanged`. Retained history and negative fixtures need only their bucket reason. Derived files inherit the decision from their authored source.

| File and line | Old token or property | Direction source | Possible direction | Intended edge | Replacement | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `src/example.tsx:42` | `fade-l fade-size-l-xl` | inherited `dir` | LTR only | physical left | `fade-start fade-size-start-xl` | pending |

Direction can come from the root `<html dir>`, an inherited `dir` attribute, a component prop, or locale state. Record `LTR only`, `RTL only`, `dynamic`, or `unknown`.

The `:dir()` selector follows document directionality. A CSS-only `direction: rtl` declaration is not enough. Trace the rendered `dir` attribute or inherited document direction.

**Expected result**

Every removed-token match has a bucket. Every left/right Migrate-bucket match and every affected `fade-x` surface has a ledger row.

**Stop if**

A horizontal Migrate-bucket site has unknown direction or unknown edge intent. Ask before changing it.

## Step 2: Decide every horizontal mapping

The 0.6.x left and right names are physical. The 0.7+ start and end names follow text direction.

Choose the new suffix from the intended edge:

| Intended edge | Direction at runtime | New suffix |
| --- | --- | --- |
| inline start | any | `start` |
| inline end | any | `end` |
| physical left | LTR only | `start` |
| physical left | RTL only | `end` |
| physical right | LTR only | `end` |
| physical right | RTL only | `start` |
| fixed physical left or right | dynamic | no single public token |
| unknown | any | stop and ask |

A fixed physical edge under dynamic direction needs an approved direction-conditional mapping. Do not choose one suffix by guesswork.

Enumerate both class strings so Tailwind can detect them. This example preserves the physical left edge:

```js
const physicalLeftFade = {
  ltr: 'fade-start fade-size-start-xl fade-clear-start-var',
  rtl: 'fade-end fade-size-end-xl fade-clear-end-var',
}
```

For a physical right edge, use `end` in LTR and `start` in RTL. Switch the matching custom property too: physical left uses `--fade-clear-start` in LTR and `--fade-clear-end` in RTL; physical right uses the reverse. Apply the same branch to every bare, size, clear, and `-var` class at the site. Do not construct partial class names such as `fade-${suffix}` at runtime.

Apply the chosen suffix to the whole site:

| Old left family | Old right family | New form |
| --- | --- | --- |
| `fade-l` | `fade-r` | `fade-{suffix}` |
| `fade-size-l-*` | `fade-size-r-*` | `fade-size-{suffix}-*` |
| `fade-clear-l-*` | `fade-clear-r-*` | `fade-clear-{suffix}-*` |
| `fade-clear-l-var` | `fade-clear-r-var` | `fade-clear-{suffix}-var` |
| `--fade-clear-l` | `--fade-clear-r` | `--fade-clear-{suffix}` |

Use one chosen suffix for the direction, size, and clear-zone settings that describe the same edge. A mixed replacement can put the fade and its dimensions on opposite physical edges in RTL.

`fade-x` keeps its name and still selects both horizontal edges. Its start/end size and clear-zone settings swap physical sides in RTL, so review every left/right setting paired with it.

**Expected result**

Every horizontal ledger row has an approved replacement.

**Stop if**

Any row has unknown intent, lacks an approved replacement, or maps one site's direction, size, clear, and custom-property settings inconsistently.

## Step 3: Apply the safe renames

**Action**

Apply these exact token or prefix replacements only. Tailwind variants stay in place, such as `sm:fade-t` to `sm:fade-top`.

| Old | New |
| --- | --- |
| `fade-xy` | `fade` |
| `fade-t` | `fade-top` |
| `fade-b` | `fade-bottom` |
| `fade-static` | `fade-always` |
| `fade-size-t-*` | `fade-size-top-*` |
| `fade-size-b-*` | `fade-size-bottom-*` |
| `fade-range-*` | `fade-travel-*` |
| `fade-clear-t-*` | `fade-clear-top-*` |
| `fade-clear-b-*` | `fade-clear-bottom-*` |
| `fade-clear-xy-*` | `fade-clear-*` |
| `--fade-range-*` | `--fade-travel-*` |
| `--fade-clear-t` | `--fade-clear-top` |
| `--fade-clear-b` | `--fade-clear-bottom` |
| `--fade-clear-xy` | `--fade-clear` |

Match whole tokens. Do not replace `fade-r` inside `fade-range-*`. The trailing hyphen protects the prefix replacements and preserves suffixes that are valid for each family:

- size and travel accept named theme values or bracketed lengths and percentages
- clear zones accept named theme values, bracketed lengths and percentages, bare integers, and `-var`

If an old token uses another suffix form, stop and verify it. It may never have compiled.

These names do not change:

- `fade-x` and `fade-y`
- `fade-size-x-*` and `fade-size-y-*`
- `fade-clear-x-*` and `fade-clear-y-*`

Version 0.7.0 changed the default travel from `md` to `sm`. If the old default distance must be retained, add `fade-travel-md`. This retains the distance, not the old edge-opacity model.

**Expected result**

Only reviewed horizontal Migrate matches, intentional Retain matches, and derived Regenerate matches remain.

**Stop if**

A replacement changes a larger token or produces a class that is not listed here.

## Step 4: Apply the horizontal ledger

**Action**

Apply each approved row from Step 2. Mark it complete and review the full site after each change.

Do not rerun a blind left-to-start or right-to-end replacement. RTL mappings can require the opposite suffix.

**Expected result**

All Migrate-bucket horizontal rows are complete, and each fade uses the same semantic suffix as its size and clear-zone settings.

**Stop if**

The rendered direction or intended edge no longer matches the ledger. Update the row or ask before continuing.

## Step 5: Update the dependency or CDN URL

### Package manager

Run the command for the repository's package manager from the package that owns the dependency:

```bash
npm install --save-exact tw-fade@X.Y.Z
pnpm add --save-exact tw-fade@X.Y.Z
yarn add --exact tw-fade@X.Y.Z
bun add --exact tw-fade@X.Y.Z
```

Run only one command and add the matching section flag below. Let the package manager update the lockfile. Do not edit the lockfile by hand.

Preserve the existing manifest section:

| Existing section | npm flag | pnpm flag | Yarn or Bun flag |
| --- | --- | --- | --- |
| `dependencies` | no section flag | no section flag | no section flag |
| `devDependencies` | `--save-dev` | `--save-dev` | `--dev` |
| `optionalDependencies` | `--save-optional` | `--save-optional` | `--optional` |
| `peerDependencies` | `--save-peer` | stop and follow repository policy | `--peer` |

pnpm's `--save-peer` also adds the package to `devDependencies`, so it does not preserve a peer-only declaration. If the package appears in more than one section, a table cell says stop, or the package manager does not support the required section, stop and follow the repository's dependency policy. A default add command can collapse a peer or optional dependency into `dependencies`.

In a workspace, preserve the existing workspace or filter syntax and update the package that declares `tw-fade`.

### Prebuilt CSS

Preserve the current CDN provider and asset path. Change only its version syntax to the exact target. For an existing unpkg URL, use:

```html
<link rel="stylesheet" href="https://unpkg.com/tw-fade@X.Y.Z/dist/tw-fade.css" />
```

Do not switch providers unless the task asks for it. If the link has an `integrity` attribute, update it with the hash for the exact target asset. A stale hash makes the browser reject the stylesheet. Stop if the new hash cannot be verified.

If the project uses both a package and the CDN, update both.

**Expected result**

The manifest and lockfile, or every CDN URL, name the exact target version. Existing dependency sections, CDN providers, and asset paths are unchanged unless the task explicitly changes them. Every integrity hash matches the target asset.

**Stop if**

The install command changes the package manager, moves `tw-fade` to another manifest section, rewrites unrelated dependencies, or resolves a different `tw-fade` version.

## Step 6: Verify

### 1. Verify the resolved version

Use the matching command:

```bash
npm ls tw-fade --depth=0
pnpm list tw-fade --depth=0
yarn why tw-fade
bun pm ls
```

Run only one. Confirm it reports `X.Y.Z`. For CDN use, inspect every `tw-fade` URL and confirm the same exact pin, provider, path, and matching integrity hash.

### 2. Repeat the old-token scan

Run both Step 1 scans again and classify every remaining result.

`rg` exit codes mean:

- `0`: one or more matches were found
- `1`: no matches were found
- `2` or higher: the scan failed

For the removed-token scan, exit `0` can still pass when every match is in the Retain bucket. Exit `1` also passes. The required result is zero Migrate or Regenerate matches, not zero matches across history and negative tests.

For the review-only `fade-x` scan, authored matches remain. Every RTL or dynamic surface must have a completed review row.

### 3. Review the diff

For Git, set `MIGRATION_BASELINE_DIR` to the recorded Step 0 directory, then run:

```bash
git status --short > "$MIGRATION_BASELINE_DIR/final-status.txt"
git diff --binary > "$MIGRATION_BASELINE_DIR/final-unstaged.patch"
git diff --cached --binary > "$MIGRATION_BASELINE_DIR/final-staged.patch"
git diff --check > "$MIGRATION_BASELINE_DIR/final-unstaged-check.txt" 2>&1 || true
git diff --cached --check > "$MIGRATION_BASELINE_DIR/final-staged-check.txt" 2>&1 || true
diff -u "$MIGRATION_BASELINE_DIR/status.txt" "$MIGRATION_BASELINE_DIR/final-status.txt"
diff -u "$MIGRATION_BASELINE_DIR/unstaged.patch" "$MIGRATION_BASELINE_DIR/final-unstaged.patch"
diff -u "$MIGRATION_BASELINE_DIR/staged.patch" "$MIGRATION_BASELINE_DIR/final-staged.patch"
diff -u "$MIGRATION_BASELINE_DIR/unstaged-check.txt" "$MIGRATION_BASELINE_DIR/final-unstaged-check.txt"
diff -u "$MIGRATION_BASELINE_DIR/staged-check.txt" "$MIGRATION_BASELINE_DIR/final-staged-check.txt"
```

`diff` exits `1` when it prints a difference. That is expected for migration-owned changes. Inspect every printed hunk and confirm it belongs to the migration. Existing unrelated hunks and untracked-file hashes must remain unchanged. The final check output must contain no new whitespace errors.

Without Git, use the Step 0 snapshot tool to compare every edited file and the file list. Confirm that all differences belong to the migration and unrelated files match the baseline.

### 4. Run the project's checks

Read the package scripts and contributor instructions. Run the existing build and relevant test commands with the repository's package manager. Each command must exit `0`.

Regenerate derived files through their owning build command, then repeat the old-token scan.

### 5. Check horizontal scrollers in LTR and RTL

Test each affected horizontal scroller with the same direction mechanism used in production. Run the positional matrix in Chrome or Edge 120+, or Safari 26+, where scroll-driven fades and direction-aware horizontal routing both work.

| Scroll position | Expected selected-edge behavior |
| --- | --- |
| start | the start edge is clear; the end edge fades if selected |
| middle | every selected horizontal edge fades |
| end | the start edge fades if selected; the end edge is clear |

Repeat the three positions in LTR and RTL. Confirm that:

- each one-sided fade stays on the intended semantic or physical edge
- its size and clear zone stay on that same edge
- `fade-x` still selects the intended pair of edges

Test fallback browsers separately. Safari 17.x, Safari 18.x, and release Firefox keep every selected fade statically on at all scroll positions. Confirm the intended physical edge, size, and clear zone, but do not expect the fade amount to change while scrolling. Chrome 115 through 119 is not a valid RTL acceptance browser because it maps `start` and `end` to LTR edges.

### 6. Close the ledger

Report:

```text
Target version:
Required migrations through target:
Install path, package manager, and manifest section:
CDN provider, path, and integrity status:
Baseline snapshot:
Files migrated:
Generated files rebuilt:
Retained matches and reasons:
Horizontal decisions:
fade-x reviews:
Build and test commands:
LTR, RTL, and fallback-browser checks:
Unresolved items:
```

The migration is incomplete if `Unresolved items` is not empty.

## Recovery and resuming

Keep unrelated work intact. If a step fails, revert only the migration hunks you own, using an inverse patch or targeted version-control operation. Do not run a broad reset or checkout.

The inventory and safe-renames steps can be repeated. Resume horizontal work from the ledger. Do not reconstruct intent from already-renamed tokens.

## New utilities available in 0.7+

These utilities have no 0.6.x equivalent:

- `fade-none`, `fade-none-x`, and `fade-none-y` disable selected fades
- `fade-always-x` and `fade-always-y` pin selected fades at full strength

They change fade amount, not edge selection. Pair them with a direction utility.

## Why Plain Directions

Vertical edges use physical names: `fade-top`, `fade-bottom`, and `fade-y`. Horizontal edges use logical names: `fade-start` and `fade-end`. Only the horizontal axis changes with text direction.

This matches Tailwind's mix of physical top and bottom insets with logical start and end spacing. It also avoids public `fade-left` and `fade-right` aliases that would silently select the wrong semantic edge in RTL.

The test suite rejects representative removed names and unsupported aliases. Do not restore an old name as an alias without making an explicit public API decision.
