# GitEverywhere — Implementation Plan

> Ordered, phased build plan. Each phase is independently testable before moving on.

---

## Project Structure

```
plugin/
├── package.json                      # Extension manifest + npm deps
├── tsconfig.json                     # TypeScript config (extension host)
├── tsconfig.webview.json             # TypeScript config (React webview)
├── esbuild.mjs                       # Two-target build: extension + webview
├── vitest.config.ts
├── .vscodeignore
│
├── src/                              # Extension host (Node/VSCode context)
│   ├── extension.ts                  # activate() / deactivate() — entry point
│   ├── types.ts                      # Shared domain types
│   ├── repo/
│   │   └── RepoDetector.ts
│   ├── git/
│   │   ├── GitRunner.ts              # execa wrapper, streaming, cancellation
│   │   ├── commands/
│   │   │   ├── revList.ts
│   │   │   ├── reflog.ts
│   │   │   ├── stash.ts
│   │   │   ├── fsck.ts               # dangling commits, trees, blobs
│   │   │   ├── fetchHead.ts
│   │   │   ├── notes.ts
│   │   │   ├── specialHeads.ts       # MERGE_HEAD, CHERRY_PICK_HEAD, etc.
│   │   │   ├── worktreeHeads.ts
│   │   │   └── catFile.ts            # Full scan — entire object store
│   │   └── sources/
│   │       ├── types.ts              # ScanSource enum, depth mappings
│   │       ├── FastSources.ts
│   │       ├── DeepSources.ts
│   │       └── FullSources.ts
│   ├── search/
│   │   ├── SearchController.ts       # Orchestrates all scan phases
│   │   ├── ResultStore.ts            # In-memory dedup store + events
│   │   └── FilterEngine.ts           # v1.1 in-memory chained filters
│   └── ui/
│       ├── SidebarTreeView.ts        # TreeDataProvider — live results
│       ├── DetailPanel.ts            # WebviewPanel — commit detail
│       ├── FilterChainView.ts        # v1.1 sidebar webview for filters
│       └── ActionExecutor.ts        # git actions from button clicks
│
├── webview-src/                      # React app (Vite + Tailwind)
│   ├── index.html
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── CommitHeader.tsx
│   │   ├── ReachabilityBadge.tsx
│   │   ├── FoundViaBadge.tsx
│   │   ├── MatchedPaths.tsx
│   │   ├── FilesChanged.tsx
│   │   ├── BranchList.tsx
│   │   ├── ActionBar.tsx
│   │   └── FilterChain.tsx           # v1.1
│   ├── hooks/
│   │   └── useVscodeMessage.ts
│   └── vscode.d.ts
│
└── test/
    ├── unit/
    │   ├── ResultStore.test.ts
    │   ├── FilterEngine.test.ts
    │   ├── GitRunner.test.ts
    │   └── RepoDetector.test.ts
    └── integration/
        └── SearchController.test.ts
```

---

## Dependency Graph

```
Phase 0 (Scaffold)
    └── Phase 1 (Git Layer)
            └── Phase 2 (Search Logic)
                    └── Phase 3 (Sidebar Tree)
                            └── Phase 4 (Detail Panel)
                                    └── Phase 5 (Polish + Ship)
                                            └── Phase 6 (v1.1 Filter Chain)
```

Each phase strictly depends on the previous. No parallel tracks.

---

## ⚠ Spike Before Phase 0

**Do this first — one hour max — before writing any real code.**

Verify that `execa` v9 (pure ESM) can be bundled with esbuild into a CJS output file and called without `ERR_REQUIRE_ESM`. VSCode's extension host is CommonJS — this is a known pain point.

```bash
mkdir spike && cd spike
npm init -y
npm install execa esbuild
# write a 5-line test file that imports execa and runs 'git --version'
# bundle it with esbuild --format=cjs --bundle
# node the output and confirm it works
```

**If it fails:** pin to `execa@8` which ships CJS + ESM dual build. Move on.

---

## Phase 0 — Scaffold and Tooling

> Goal: compilable, launchable extension shell. No features yet.

### Tasks

| # | Task | File | Notes |
|---|---|---|---|
| 0.1 | Extension manifest | `package.json` | viewsContainers, views, commands, configuration, activationEvents |
| 0.2 | TypeScript configs | `tsconfig.json`, `tsconfig.webview.json` | Two separate configs — host vs webview |
| 0.3 | esbuild config | `esbuild.mjs` | Two targets: CJS for host, ESM for webview. `external: ['vscode']` |
| 0.4 | Entry point stub | `src/extension.ts` | `activate()` / `deactivate()` stubs, register commands as no-ops |
| 0.5 | Shared types | `src/types.ts` | All interfaces up front: `SearchMode`, `ScanDepth`, `ScanSource`, `CommitResult`, `SearchProgress`, `FilterLayer` |
| 0.6 | Vitest config | `vitest.config.ts` | Mock `vscode` module via alias |
| 0.7 | .vscodeignore | `.vscodeignore` | Only ship `dist/` and docs — exclude all source |

**Exit criterion:** `npm run build` succeeds. F5 opens Extension Development Host with sidebar icon and no console errors.

---

## Phase 1 — Git Execution Layer

> Goal: reliable, testable git runner and all source command modules. The riskiest layer — must be solid before building on top.

### Tasks

| # | Task | File | Key decisions |
|---|---|---|---|
| 1.1 | **GitRunner** | `src/git/GitRunner.ts` | `run()` for full output, `stream()` for line-by-line. Use `execa`'s async iterable. Kill subprocess on `AbortSignal`. Log stderr to VSCode output channel. |
| 1.2 | Source type constants | `src/git/sources/types.ts` | `SOURCE_LABELS` map, `SCAN_DEPTH_SOURCES` mapping — which sources belong to Fast / Deep / Full |
| 1.3 | `revList` command | `src/git/commands/revList.ts` | `git rev-list --all` — async generator yielding SHAs |
| 1.4 | `reflog` command | `src/git/commands/reflog.ts` | `git reflog --all --format=%H` |
| 1.5 | `stash` command | `src/git/commands/stash.ts` | `git stash list`, then rev-parse `stash@{n}`, `^2`, `^3` for each |
| 1.6 | `fsck` command | `src/git/commands/fsck.ts` | `git fsck --full --no-reflogs`, parse dangling commit / tree / blob |
| 1.7 | `fetchHead` command | `src/git/commands/fetchHead.ts` | Read `.git/FETCH_HEAD` via `fs.readFile`, parse SHA per line |
| 1.8 | `notes` command | `src/git/commands/notes.ts` | `git for-each-ref refs/notes/` + `git notes list` |
| 1.9 | `specialHeads` command | `src/git/commands/specialHeads.ts` | Try `git rev-parse` on MERGE_HEAD, CHERRY_PICK_HEAD, REVERT_HEAD, BISECT_HEAD — missing = not an error |
| 1.10 | `worktreeHeads` command | `src/git/commands/worktreeHeads.ts` | `git worktree list --porcelain`, pick detached HEADs only |
| 1.11 | `catFile` command | `src/git/commands/catFile.ts` | `git cat-file --batch-all-objects --batch-check` — Full scan only. Yield `{ sha, type }` |
| 1.12 | **RepoDetector** | `src/repo/RepoDetector.ts` | `git rev-parse --show-toplevel`. Handle worktrees. Watch workspace folder changes. |
| 1.13 | Unit tests | `test/unit/` | Mock execa for GitRunner. Create real tmp git repos for command modules. |

**Exit criterion:** All unit tests pass. Can call `GitRunner.stream(['rev-list', '--all'], cwd, signal, cb)`, watch SHAs arrive, abort mid-stream, confirm no more lines arrive.

---

## Phase 2 — Search Logic

> Goal: the search engine. Takes a query + mode + depth → deduplicated streaming results.

### Tasks

| # | Task | File | Key decisions |
|---|---|---|---|
| 2.1 | **ResultStore** | `src/search/ResultStore.ts` | `Map<sha, CommitResult>` + separate maps for blobs/trees. `upsertCommit()` merges sources. Event emitter `onDidChange`. Store minimal data during scan — fetch full metadata lazily on click. |
| 2.2 | **SearchController** | `src/search/SearchController.ts` | Orchestrates all phases in order per depth. Mode-specific filter per commit: content=`git log -1 -S`, message=`git log -1 --grep`, filename=`git ls-tree` with tree SHA cache (same optimization as shell script). Emits `SearchProgress`. Owns `AbortController`. |
| 2.3 | Integration tests | `test/integration/` | Real tmp git repo with: known commit, reflog entry, stash, staged blob. Assert correct results at each depth. Test cancellation. |

**Scan phase order:**

| Depth | Phases in order |
|---|---|
| Fast | revList → reflog → stash |
| Deep | (all Fast) → fsck → fetchHead → notes → specialHeads → worktreeHeads |
| Full | (all Deep) → catFile |

**Exit criterion:** `SearchController.search("knownstring", 'content', 'fast', cwd)` returns ≥1 result in `ResultStore` within 2 seconds. Integration tests pass.

---

## Phase 3 — Sidebar Tree View

> Goal: live-updating native VSCode TreeView showing results grouped by source.

### Tasks

| # | Task | File | Key decisions |
|---|---|---|---|
| 3.1 | **SidebarTreeView** | `src/ui/SidebarTreeView.ts` | `TreeDataProvider`. Level 1 = source groups with count. Level 2 = commits with short SHA + subject. ⚠ icon for non-reachable. Subscribe to `ResultStore.onDidChange`. **Debounce tree refresh 150ms** to prevent storm during fast scans. |
| 3.2 | Search input | `src/extension.ts` | Use `vscode.window.showInputBox` for v1 (simple). Mode + depth selected via `showQuickPick`. Switch to sidebar WebView input in v1.1. |
| 3.3 | Search command | `src/extension.ts` | Wire `giteverywhere.startSearch` → mode picker → query input → depth picker → `SearchController.search()` → `withProgress`. Set `giteverywhere.searching` context key for cancel button visibility. |
| 3.4 | Context keys + toolbar | `package.json` | View title buttons: Search icon, Cancel (visible only when searching), Clear results. |

**Exit criterion:** Search produces a live-updating grouped tree. Cancel button stops the scan.

---

## Phase 4 — Detail Panel (WebView)

> Goal: clicking a result opens a styled commit detail panel in the editor area.

### Tasks

| # | Task | File | Key decisions |
|---|---|---|---|
| 4.1 | **DetailPanel** | `src/ui/DetailPanel.ts` | Singleton per SHA — `reveal()` if already open. Rewrite asset URIs with `asWebviewUri()`. Post `{ type: 'init', commit }` after fetching full metadata lazily (`git show`, `git branch --contains`). Listen for action messages → `ActionExecutor`. |
| 4.2 | React app shell | `webview-src/main.tsx`, `App.tsx` | `acquireVsCodeApi()`. Listen for `message` events. Render commit detail on `init`. |
| 4.3 | CommitHeader | `webview-src/components/CommitHeader.tsx` | SHA (full + short + copy button), subject, author, dates |
| 4.4 | ReachabilityBadge | `webview-src/components/ReachabilityBadge.tsx` | Green if reachable, yellow ⚠ if not. Tooltip explains what "not reachable" means. |
| 4.5 | FoundViaBadge | `webview-src/components/FoundViaBadge.tsx` | Chips for each ScanSource this commit appeared in |
| 4.6 | MatchedPaths | `webview-src/components/MatchedPaths.tsx` | Files that matched the search |
| 4.7 | FilesChanged | `webview-src/components/FilesChanged.tsx` | Name-status output, color-coded M/A/D |
| 4.8 | BranchList | `webview-src/components/BranchList.tsx` | Branches containing + refs pointing |
| 4.9 | ActionBar | `webview-src/components/ActionBar.tsx` | Checkout, Cherry-pick, Restore file (only if matched paths exist), Copy SHA, Show in terminal |
| 4.10 | **ActionExecutor** | `src/ui/ActionExecutor.ts` | `copySha` → clipboard. `showInTerminal` → VSCode terminal. `checkoutNewBranch` → input box + `git switch -c`. `cherryPick` → `git cherry-pick`. `restoreFile` → **modal confirm** then `git checkout <sha> -- <path>` (destructive). |
| 4.11 | Tailwind VSCode theme | `webview-src/` | Map `--vscode-*` CSS variables to Tailwind `extend.colors` so panel matches user theme |

**Exit criterion:** Clicking a result opens a styled panel. Copy SHA and Show in terminal work correctly.

---

## Phase 5 — Polish and Ship v1

> Goal: release-ready. No new features — hardening only.

### Tasks

| # | Task | Notes |
|---|---|---|
| 5.1 | Empty states | Welcome message before first search. "No results — try deeper scan" message. Empty source groups show `(0)` with tooltip. |
| 5.2 | Full scan warning | `git count-objects -v` before Full scan. If >100,000 objects → modal confirm with count shown. |
| 5.3 | Windows / WSL paths | Normalize path separators in RepoDetector and fetchHead. Test on native Windows + WSL. Detect WSL terminal vs Windows terminal in ActionExecutor. |
| 5.4 | Deduplication test | Unit test: same SHA via two sources → one tree item with both sources in `sources[]`. |
| 5.5 | Progress granularity | Per-phase progress in `withProgress`. Live result count in sidebar view title. |
| 5.6 | README + icon | Animated GIF of a search, scan depth explanation, action buttons, FAQ. Marketplace listing quality drives installs. |
| 5.7 | CHANGELOG | Standard format |
| 5.8 | Publish | `vsce package` → install `.vsix` and smoke test → `vsce publish` → post on r/vscode, r/git, HN |

**Exit criterion:** Works on Windows 11 (native git), macOS, Ubuntu. `vsce package` produces a clean `.vsix`. Published to marketplace.

---

## Phase 6 — v1.1: Chained Filtering

> Goal: filter within results in-memory — LogExpert style. No new git commands.

### Tasks

| # | Task | File | Notes |
|---|---|---|---|
| 6.1 | **FilterEngine** | `src/search/FilterEngine.ts` | `addLayer()`, `removeLayer()`, `apply(results)`. AND = successive `.filter()`. OR = union. Synchronous — all data is in memory. |
| 6.2 | FilterChainView (host) | `src/ui/FilterChainView.ts` | `WebviewViewProvider` for a second sidebar view below the tree. Posts `filterChanged` to extension host on every input change. |
| 6.3 | FilterChain component | `webview-src/components/FilterChain.tsx` | Mode dropdown + query input + AND/OR toggle + remove button per layer. "Add filter" button. |
| 6.4 | Result count display | `SidebarTreeView.ts` | Show "47 results → 12 after filters" in tree description after filtering |

**Exit criterion:** Search returns 200 results, user adds two filter layers, count drops live with no git re-scan.

---

## Risk Register

| Risk | Phase | Mitigation |
|---|---|---|
| `execa` v9 ESM in CJS bundle | **Spike (before 0)** | Test before writing code. Pin to v8 if it fails. |
| `git fsck` slow on large repos | 2, 3 | Deep+ only. Stream results. Show cancel. |
| `cat-file --batch-all-objects` on huge repos | 2, 5 | Full only. Object count warning before starting (Phase 5.2). |
| Windows path separators | 1, 4 | Phase 5.3 explicit handling. Test Windows from Phase 1. |
| WebView CSP + Tailwind | 4 | Use `nonce` in CSP. Avoid inline styles. |
| TreeView refresh storm | 3 | 150ms debounce on `_onDidChangeTreeData.fire()` |
| `git branch --contains` slow | 4 | Fetch lazily when detail panel opens — not during scan |
| WebviewView API availability | 6 | Available since VSCode 1.73 — covered by minimum engine version |

---

*Last updated: 2026-03-13*
*Status: Ready to build — start with the execa spike*
