# Changelog

## [0.1.0] - 2026-03-13

### Added
- Search git history by content (string in code), commit message, or filename
- Three scan depths: Fast (branches + reflog + stash), Deep (+ dangling objects, FETCH_HEAD, git notes, special heads, worktrees), Full (entire object store)
- Live-streaming results in sidebar tree, grouped by source
- Commit detail panel with full metadata, branch info, and matched files
- Action buttons: Checkout to new branch, Cherry-pick, Restore file, Copy SHA, Show in terminal
- Full scan object count warning for large repos
