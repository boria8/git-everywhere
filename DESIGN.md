# GitEverywhere — VSCode Extension Design

> Search anything, anywhere in your git history.
> Branches, reflog, stash, dangling commits, blobs, notes, orphaned trees — all in one place.

---

## Table of Contents

1. [Vision](#vision)
2. [Target Users](#target-users)
3. [Search Modes](#search-modes)
4. [Scan Depth](#scan-depth)
5. [Feature Scope](#feature-scope)
   - [v1 — Free Core](#v1--free-core)
   - [v1.1 — Chained Filtering](#v11--chained-filtering)
   - [v2 — Pro / Backend](#v2--pro--backend)
6. [Architecture](#architecture)
7. [UX / UI Design](#ux--ui-design)
8. [Monetization Strategy](#monetization-strategy)
9. [Tech Stack](#tech-stack)
10. [Publishing Plan](#publishing-plan)
11. [Risks](#risks)
12. [Open Questions](#open-questions)

---

## Vision

VSCode's built-in git tools only search the **working tree**. This extension searches **everything git knows about** — past, present, deleted, lost, stashed, staged-but-never-committed, or dangling.

One search box. All of git. Nothing escapes.

---

## Target Users

| User | Pain point | What this solves |
|---|---|---|
| Developer who deleted a file | Can't find it in history | Searches all branches + dangling objects |
| Developer who remembers a code hint | Can't recall filename or branch | Content search across all history |
| Developer on a large team | "Where did that function go?" | Searches across all remote branches |
| DevOps / Release engineer | Needs to trace a change | Full commit metadata + copy-paste commands |
| Anyone who uses `git stash` heavily | Stash entries are invisible | Surfaces stash contents with full diff |
| Anyone after a bad reset/rebase | Commit seems lost forever | Dangling + reflog + blob search |

---

## Search Modes

How you describe what you're looking for:

| Mode | Git command | When to use |
|---|---|---|
| **Content** | `git log --all -S "string"` | You remember code/text but not where. Most common. |
| **Commit message** | `git log --all --grep="string"` | You remember what you wrote in the commit |
| **Filename / path** | `git ls-tree -r --name-only` per commit | You remember the file name |

All three modes run across whichever scan depth sources are enabled.

---

## Scan Depth

Where git is searched — user selects per search:

### Fast *(default, seconds)*
| Source | Git command | What it finds |
|---|---|---|
| All branches + tags + remotes | `git rev-list --all` | Every reachable commit |
| Reflog | `git reflog --all --format=%H` | Commits visited after reset/rebase |
| Stash (working tree) | `git stash list` → `stash@{n}` | Stashed snapshots |
| Stash (index) | `stash@{n}^2` | Staged changes inside stash |
| Stash (untracked) | `stash@{n}^3` | Untracked files inside stash |

### Deep *(10–30 seconds)*
Everything in Fast, plus:

| Source | Git command | What it finds |
|---|---|---|
| Dangling commits | `git fsck --full --no-reflogs \| grep "dangling commit"` | Commits with no references (truly lost) |
| Dangling trees | `git fsck --full --no-reflogs \| grep "dangling tree"` | Trees not attached to any commit |
| **Dangling blobs** | `git fsck --full --no-reflogs \| grep "dangling blob"` | Files staged (`git add`) but never committed — `git reset` without committing leaves these |
| **FETCH_HEAD** | `FETCH_HEAD` ref | Commits fetched from remote but never merged or checked out |
| **Git Notes** | `git for-each-ref refs/notes/` | Annotations attached to commits (used by Gerrit, some CI tools) |
| **Special op heads** | `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `BISECT_HEAD` | Commits involved in an active operation (mid-merge, mid-cherry-pick, etc.) |
| **Worktree detached HEADs** | `git worktree list` | Commits checked out in other worktrees with no branch |

### Full *(slow on large repos — use with caution)*
Everything in Deep, plus:

| Source | Git command | What it finds |
|---|---|---|
| **Entire object store** | `git cat-file --batch-all-objects --batch-check` | Every object git has ever stored — nothing escapes |

> **Note:** Full scan is the nuclear option. Every blob, tree, commit, and tag in the object database — reachable or not. Useful for forensic recovery on large/old repos.

---

## Feature Scope

### v1 — Free Core

> Goal: nail the local search experience. Ship fast.

- [ ] Search bar — single input, debounced
- [ ] Search mode selector (Content / Commit message / Filename)
- [ ] Scan depth selector (Fast / Deep / Full)
- [ ] Results stream in live as each source is scanned
- [ ] Progress indicator — shows which source is currently being scanned
- [ ] Cancel search button
- [ ] Result tree view grouped by source:
  - Reachable commits
  - Reflog
  - Stash
  - Dangling commits
  - Dangling trees
  - Dangling blobs
  - FETCH_HEAD
  - Git Notes
  - Special op heads
  - Worktree detached HEADs
- [ ] Result detail panel (opens in editor area on click):
  - Commit SHA (full + short), subject, author, dates
  - "Reachable from HEAD" indicator (⚠ highlighted if not reachable)
  - Found via (which sources matched this commit)
  - Matched file paths / matched lines
  - Branches containing this commit
  - Refs pointing exactly to this commit
  - Files changed in this commit
- [ ] Action buttons per result:
  - Copy SHA
  - `git show` in terminal
  - `git switch -c rescue-<sha>` — checkout to new branch
  - `git cherry-pick`
  - Restore specific file from this commit (`git checkout <sha> -- <path>`)
- [ ] Deduplication — commit reported once even if found via multiple sources
- [ ] Auto-detects `.git` root from open workspace
- [ ] Works on Windows, Mac, Linux (including WSL)

### v1.1 — Chained Filtering

> Inspired by LogExpert. Search within results without re-scanning git.

- [ ] "Add filter" button after initial search returns results
- [ ] Each filter layer is applied in-memory against already-found commits (instant)
- [ ] Filters are ANDed by default — toggle to OR per layer
- [ ] Any filter layer can be removed independently
- [ ] Filter layers can use different modes (e.g. first filter by content, second by author)

```
[ validateSession    ] [X]   ← 847 results
[ Bearer             ] [X]   ← 23 results
[ david              ] [X]   ← 4 results  ← work with these
[+ Add filter]
```

### v2 — Pro / Backend

> Requires SaaS backend. This is the monetization layer.

- [ ] Cross-repo search — search across multiple local repos at once
- [ ] Submodule history search — recurse into submodules
- [ ] GitHub / GitLab org-wide search — index all repos in an org
- [ ] Saved searches — persist and share search presets with team
- [ ] Team annotations — leave notes on commits visible to the whole team
- [ ] AI summary — summarize what changed around a matched commit (Claude API)
- [ ] Timeline view — visualize when a string appeared and disappeared across history

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VSCode Extension                     │
│                                                         │
│  ┌─────────────────┐     ┌──────────────────────────┐  │
│  │  Sidebar        │     │   Extension Host (TS)    │  │
│  │  TreeView       │◄───►│                          │  │
│  │  (native API)   │     │  - SearchController      │  │
│  └─────────────────┘     │  - GitRunner             │  │
│                           │  - ResultStore           │  │
│  ┌─────────────────┐     │  - RepoDetector          │  │
│  │  Detail Panel   │◄───►│  - FilterEngine          │  │
│  │  WebView        │     │  - ActionExecutor        │  │
│  │  (React+Vite)   │     └──────────┬───────────────┘  │
│  └─────────────────┘                │                   │
└────────────────────────────────────┬┘
                                     │ execa (streaming)
                                     ▼
                              git CLI (local)

                     (v2 only) ──► SaaS Backend API
```

### Key modules

| Module | Responsibility |
|---|---|
| `RepoDetector` | Find `.git` root from open workspace, handle worktrees |
| `GitRunner` | Spawn git commands via `execa`, stream output, handle cancellation |
| `SearchController` | Orchestrate scan phases based on selected depth, manage progress |
| `ResultStore` | In-memory Map/Set — deduplication, source tracking, filter state |
| `FilterEngine` | Apply chained in-memory filters against ResultStore |
| `SidebarTreeView` | VSCode TreeDataProvider — renders result tree in sidebar |
| `DetailPanel` | WebviewPanel (React) — renders commit detail + action buttons |
| `ActionExecutor` | Run git actions (checkout, cherry-pick, restore) from button clicks |

---

## UX / UI Design

### Layout

```
LEFT SIDEBAR                        EDITOR AREA (opens on click)
┌────────────────────────┐         ┌──────────────────────────────────┐
│  GITEVERYWHERE         │         │  COMMIT abc1234ef                │
│                        │         │  "fix: remove legacy auth"       │
│  ○ Content             │         │                                  │
│  ○ Commit message      │  click  │  Author : David <d@example.com>  │
│  ○ Filename            │────────►│  Date   : 2025-11-03             │
│                        │         │  Reachable from HEAD: NO ⚠      │
│  [Fast] [Deep] [Full]  │         │  Found via: reflog, dangling     │
│                        │         │                                  │
│  [ search...      ][X] │         │  Matched content:                │
│  [Search] ● Scanning.. │         │  > src/auth/session.ts:42        │
├────────────────────────┤         │    validateSession(token)        │
│  ▼ Reachable (3)       │         │                                  │
│    abc1234 ───────────►│         │  Branches containing this:       │
│    def5678             │         │  - origin/main                   │
│  ▼ Reflog (1)          │         │  - feature/auth-rewrite          │
│    aaa9999  ⚠          │         │                                  │
│  ▼ Stash (0)           │         │  Files changed:                  │
│  ▼ Dangling (2) ⚠      │         │  M src/auth/session.ts           │
│    bbb1111  ⚠          │         │  D lib/legacy-auth.js            │
│    ccc2222  ⚠          │         │                                  │
│  ▼ Blobs (1) ⚠         │         │  [Checkout new branch]           │
│  ▼ FETCH_HEAD (0)      │         │  [Cherry-pick]                   │
│  ▼ Notes (0)           │         │  [Restore file]  [Copy SHA]      │
└────────────────────────┘         │  [Show in terminal]              │
                                   └──────────────────────────────────┘
```

### UX principles
- Results stream in live — don't wait for all phases to complete
- ⚠ icon on anything not reachable from HEAD — makes danger visible
- "Found via" shows all sources that matched this commit
- Actions are one-click — no terminal knowledge needed
- Empty state is helpful: "Nothing found in stash. Try Deep scan to include dangling blobs."
- Scan depth clearly labelled so user knows what was and wasn't searched

---

## Monetization Strategy

### Free tier (marketplace)
- All v1 + v1.1 features
- Local repo only
- Unlimited use
- Goal: maximize installs and trust

### Pro tier ($8–15/month per user)
- All v2 features
- Billed via our own backend (Stripe)
- Extension connects to backend with an API key
- Teams plan: $40–60/month for up to 10 users

### Revenue milestones
| Installs | Conversion | MRR |
|---|---|---|
| 10k | 0.5% → 50 pro | ~$500 |
| 100k | 0.5% → 500 pro | ~$5,000 |
| 1M | 0.3% → 3,000 pro | ~$30,000 |

### Why this works
- Free tier is genuinely useful → organic growth
- Pro features require our infrastructure — can't be replicated locally
- B2B pricing targets teams, not individuals — more sustainable

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Extension host | TypeScript | Required for VSCode extensions |
| Sidebar UI | VSCode TreeView API (native) | No overhead, fast, integrates perfectly |
| Detail panel | React + Vite + Tailwind | Complex UI, worth it here |
| Git execution | `execa` npm package | Clean streaming, cancellation, error handling |
| Testing | Vitest | Fast, TypeScript-native |
| Bundler | esbuild (VSCode scaffold default) | Already configured, don't change it |
| Backend (v2) | Node.js + Fastify | Same language as extension, minimal overhead |
| Database (v2) | PostgreSQL | Saved searches, team annotations |
| Auth (v2) | GitHub OAuth | Devs already have GitHub accounts |
| Payments (v2) | Stripe | Industry standard |
| Hosting (v2) | Railway | Cheap to start (~$5/mo), zero DevOps |

---

## Publishing Plan

### Before writing code
- [ ] Register Microsoft publisher account at marketplace.visualstudio.com
- [ ] Claim publisher name: `GitEverywhere`
- [ ] Create public GitHub repo: `git-everywhere` (enables GitHub Sponsors from day 1)
- [ ] Enable GitHub Sponsors on the repo

### Git branching strategy
```
main          ← always publishable, protected
dev           ← active development
feature/xxx   ← feature branches, PR into dev
```

### Pre-launch
- [ ] Working v1 with good README, GIFs, and screenshots
- [ ] Test on Windows, Mac, Linux, WSL

### Launch
- [ ] `vsce publish` to marketplace
- [ ] Post on: r/vscode, r/git, r/programming, Hacker News (Show HN), Dev.to, Twitter/X

### Post-launch
- [ ] Respond to issues fast in first month — reputation is built here
- [ ] Track install metrics via marketplace dashboard
- [ ] Collect feedback → prioritize v1.1 and v2 features based on what users ask for

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Microsoft ships this natively in VSCode | Medium | v2 team features they won't ship |
| `git fsck` is slow on large repos | High | Run it only in Deep/Full mode, show progress, allow cancel |
| `cat-file --batch-all-objects` overwhelms large repos | High | Full mode opt-in only, show repo size warning first |
| Windows / WSL path issues | High | Test on Windows from day 1, handle both path styles |
| Performance on huge repos | High | Stream results, cancellation tokens, depth modes |
| Support burden if popular | High | Good docs, issue templates, FAQ, clear scope |
| Nobody pays for Pro | Medium | Validate with freemium first before building backend |

---

## Open Questions

- [ ] Should chained filters support date range and author as filter types (not just string)?
- [ ] Should Full scan warn the user with repo object count before starting?
- [ ] Should the extension support bare repos?

---

*Last updated: 2026-03-13*
*Status: Design phase — ready to scaffold*
