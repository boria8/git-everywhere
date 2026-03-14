# Changelog

## [0.1.6] - 2026-03-14

### Fixed
- Commit subjects now shown in tree during scan (was always "no subject yet")
- Reachable commits now show green icon instead of warning icon

## [0.1.5] - 2026-03-14

### Added
- Click a matched line (L42) to open the file at that line in the editor; falls back to detail panel if file no longer exists
- Case-insensitive search: toggle `giteverywhere.caseInsensitive` in settings
- Active query shown in sidebar header after search (e.g. `"parseToken" — 5 results`)
- Right-click a file node → Copy Path
- Last search (query, mode, depth) persisted across VS Code restarts; pre-filled on next search
- Remote mode setting `giteverywhere.remoteMode`: `none` (default, no network), `check` (warn if remote has new commits), `fetch` (auto-fetch before search)

## [0.1.4] - 2026-03-14

### Added
- Extension icon (128x128) visible on the VS Marketplace and Activity Bar
- Screenshot in README showing the results tree

## [0.1.3] - 2026-03-14

### Added
- Matching lines shown as grandchildren under each file node (content search): `L42  if (parser.parse(input) === null)`
- Clicking any line node opens the commit detail panel

## [0.1.2] - 2026-03-14

### Added
- Results tree now shows matched file paths as expandable child nodes under each commit (content and filename search modes)
- Branch name shown inline in commit description (e.g. `abc1234  Fixed bug · main`)

## [0.1.1] - 2026-03-13

### Fixed
- Git binary not found on macOS — now resolved via VS Code's built-in git extension (works with Homebrew, XCode CLT, custom paths)
- Opening a folder containing multiple git repositories now shows a picker to select which repo to search
- Added "Switch Repository" button in the sidebar to re-trigger repo selection at any time

## [0.1.0] - 2026-03-13

### Added
- Search git history by content (string in code), commit message, or filename
- Three scan depths: Fast (branches + reflog + stash), Deep (+ dangling objects, FETCH_HEAD, git notes, special heads, worktrees), Full (entire object store)
- Live-streaming results in sidebar tree, grouped by source
- Commit detail panel with full metadata, branch info, and matched files
- Action buttons: Checkout to new branch, Cherry-pick, Restore file, Copy SHA, Show in terminal
- Full scan object count warning for large repos
