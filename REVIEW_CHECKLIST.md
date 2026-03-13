# GitEverywhere — Per-Phase Review Checklists

> After each phase, a review agent runs against this checklist.
> Review passes only when all items are checked. Max 2 fix cycles per phase before escalating to human.

---

## Phase 0 — Scaffold

- [ ] `package.json` has correct `engines.vscode` (≥1.87.0)
- [ ] `package.json` declares `viewsContainers`, `views`, `commands`, `configuration` correctly
- [ ] `activationEvents` uses `onView:` not `*` (don't activate eagerly)
- [ ] `main` points to `./dist/extension.js`
- [ ] `esbuild.mjs` has TWO targets: extension (CJS, platform node) and webview (ESM, platform browser)
- [ ] `external: ['vscode']` is set on the extension target
- [ ] `tsconfig.json` covers only `src/`, `tsconfig.webview.json` covers only `webview-src/`
- [ ] `src/types.ts` defines all shared interfaces: `SearchMode`, `ScanDepth`, `ScanSource`, `CommitResult`, `BlobResult`, `TreeResult`, `SearchProgress`, `FilterLayer`
- [ ] `.vscodeignore` excludes `src/`, `webview-src/`, `test/`, `*.mjs`, `node_modules/`
- [ ] `activate()` pushes all disposables to `context.subscriptions`
- [ ] `deactivate()` exists and cancels any running search
- [ ] `npm run build` succeeds with zero errors
- [ ] No `any` types in `src/types.ts`

---

## Phase 1 — Git Execution Layer

### GitRunner
- [ ] `run()` method exists for full-output commands
- [ ] `stream()` method exists for line-by-line streaming
- [ ] Both methods accept `AbortSignal`
- [ ] On `signal.aborted`, subprocess is killed (SIGTERM on Unix, taskkill on Windows)
- [ ] `process.platform` check used for kill strategy — not hardcoded
- [ ] stderr is routed to VSCode output channel, not thrown as an error
- [ ] Non-zero exit code does NOT throw — handled gracefully (`reject: false` or equivalent)
- [ ] Cancelled runs do not surface as errors to the caller
- [ ] `execa` is not called with `shell: true` (security: no shell injection)

### Command modules (each one)
- [ ] Each module is an async generator function
- [ ] Each accepts `(gitRunner, cwd, signal)` — consistent signature
- [ ] `revList.ts`: uses `git rev-list --all`
- [ ] `reflog.ts`: uses `git reflog --all --format=%H`
- [ ] `stash.ts`: handles all three slots — main, `^2` (index), `^3` (untracked)
- [ ] `fsck.ts`: parses `dangling commit`, `dangling tree`, AND `dangling blob` — all three
- [ ] `fetchHead.ts`: reads `.git/FETCH_HEAD` via `fs.readFile`, uses `path.join` not string concatenation
- [ ] `specialHeads.ts`: missing HEAD file is NOT treated as an error
- [ ] `worktreeHeads.ts`: only yields detached HEADs, not worktrees with a branch
- [ ] `catFile.ts`: used ONLY for Full scan depth
- [ ] `SCAN_DEPTH_SOURCES` in `sources/types.ts` correctly maps each depth to its sources

### RepoDetector
- [ ] Uses `git rev-parse --show-toplevel`, not hardcoded paths
- [ ] Path separators normalized for Windows (no mixed slashes)
- [ ] Handles worktree `.git` directories (path is `.git/worktrees/<name>`, not `.git`)
- [ ] Returns `undefined` gracefully if no git repo found (does not throw)
- [ ] Watches workspace folder changes

### Tests
- [ ] `GitRunner.test.ts` covers: normal run, streaming, cancellation mid-stream
- [ ] `RepoDetector.test.ts` covers: found, not found, worktree case
- [ ] Command module tests use a real tmp git repo (not mocks)
- [ ] `stash.ts` test verifies all three stash slots are scanned
- [ ] All tests pass: `npm run test`

---

## Phase 2 — Search Logic

### ResultStore
- [ ] `Map<sha, CommitResult>` — not an array (dedup by key)
- [ ] `upsertCommit()` MERGES sources if SHA already exists — does not overwrite
- [ ] `upsertCommit()` MERGES matchedPaths without duplicates
- [ ] Separate maps for blobs and trees
- [ ] `onDidChange` event fires after every upsert
- [ ] `clear()` resets all three maps and resets event listeners correctly
- [ ] Full metadata (branches, subject, author) is NOT fetched during scan — only SHA + sources + paths stored
- [ ] Unit test: same SHA via two sources → one entry with both sources in `sources[]`

### SearchController
- [ ] Phase order matches `IMPLEMENTATION_PLAN.md` (Fast → Deep → Full strictly additive)
- [ ] Tree SHA cache exists for filename mode — same tree is NOT scanned twice
- [ ] Content mode uses `git log -1 -S` (pickaxe), NOT `git grep` (different semantics)
- [ ] Commit message mode uses `git log -1 --grep`
- [ ] `AbortController` is created fresh per search — not reused across searches
- [ ] `cancel()` calls `abortController.abort()` — does not kill processes directly
- [ ] `SearchProgress` events emitted at start AND end of each phase
- [ ] Integration test: known string found in commit, reflog, stash, and dangling blob
- [ ] Integration test: cancel mid-scan terminates cleanly with no error thrown

---

## Phase 3 — Sidebar Tree View

- [ ] Implements `vscode.TreeDataProvider<TreeItem>` — correct interface
- [ ] Level 1: one group per `ScanSource` that has ≥1 result
- [ ] Level 1: group label uses `SOURCE_LABELS` constant — not hardcoded strings
- [ ] Level 1: description shows `(N)` result count
- [ ] Level 2: label is short SHA, description is subject truncated to 60 chars
- [ ] ⚠ icon shown for non-reachable sources (dangling, reflog, stash, fetchHead, specialHeads, worktreeHeads)
- [ ] `_onDidChangeTreeData.fire()` is DEBOUNCED (≥100ms) — not fired on every single upsert
- [ ] Subscribe to `ResultStore.onDidChange` — tree auto-updates without polling
- [ ] Welcome message shown when no search has run yet
- [ ] "No results" message shown when search completes empty
- [ ] `giteverywhere.searching` context key set to `true` during search, `false` after
- [ ] Cancel button only visible when `giteverywhere.searching` is true (via `when` clause in package.json)
- [ ] Clicking a result fires `giteverywhere.showDetail` command with the commit SHA

---

## Phase 4 — Detail Panel

### DetailPanel (host side)
- [ ] Singleton per SHA — second click `reveal()`s existing panel, does not open duplicate
- [ ] Asset URIs rewritten with `webview.asWebviewUri()` — not raw `file://` paths
- [ ] CSP header set in HTML with a `nonce` — no `unsafe-inline`
- [ ] `localResourceRoots` restricted to `dist/webview/` only
- [ ] Full commit metadata fetched LAZILY here (not during scan)
- [ ] `git branch --contains <sha>` run here — not in SearchController
- [ ] `webview.onDidDispose` handler clears the singleton reference

### ActionExecutor
- [ ] `restoreFile` shows a MODAL confirm dialog before running `git checkout <sha> -- <path>`
- [ ] `checkoutNewBranch` prompts for branch name with `rescue-<shortSha>` as default
- [ ] `cherryPick` shows an informative message on conflict — does not silently fail
- [ ] `copySha` shows a brief status bar notification after copying
- [ ] No action uses `shell: true` in any subprocess call (security)
- [ ] All actions handle errors and surface them via `vscode.window.showErrorMessage`

### React WebView
- [ ] `acquireVsCodeApi()` called once and stored — not called on every message
- [ ] `ReachabilityBadge` shows warning with tooltip explaining what "not reachable" means
- [ ] `FoundViaBadge` shows chips for ALL sources the commit was found in
- [ ] `ActionBar` only shows "Restore file" button when `matchedPaths.length > 0`
- [ ] Tailwind uses `--vscode-*` CSS variables for colors — panel respects user theme
- [ ] No hardcoded colors (no `text-gray-700`, `bg-white` etc. without VSCode variable fallback)

---

## Phase 5 — Polish

- [ ] Full scan: `git count-objects -v` checked before starting — user warned if >100,000 objects
- [ ] Windows native git tested manually
- [ ] WSL git tested manually (if available)
- [ ] `path.join` used everywhere — no string path concatenation
- [ ] `vsce package` produces `.vsix` with no warnings
- [ ] `.vsix` installs cleanly in a fresh VSCode instance
- [ ] README has: description, GIF/screenshot, scan depth table, action buttons list, FAQ
- [ ] CHANGELOG exists with v1.0.0 entry

---

## Phase 6 — v1.1 Chained Filtering

- [ ] `FilterEngine.apply()` is synchronous — no async, no git calls
- [ ] AND semantics: each layer narrows the set (successive `.filter()`)
- [ ] OR semantics: each layer expands the set (union, no duplicates)
- [ ] `removeLayer()` by ID — not by index (safe if layers are reordered)
- [ ] Filter chain UI: mode dropdown + query input + AND/OR toggle + remove button per layer
- [ ] "Add filter" button visible after first search returns results
- [ ] Result count shows "N results → M after filters" in sidebar view title
- [ ] Filters apply instantly on input change (debounced ≥150ms) — no button to confirm
- [ ] No git commands run when adding/changing/removing filter layers
- [ ] Unit test: 100 results, two AND filters → correct subset returned
- [ ] Unit test: OR filter → superset of either filter alone

---

*Review passes when ALL items for the relevant phase are checked.*
*If any item fails after 2 fix cycles, escalate to human review.*
