import * as vscode from 'vscode';
import * as path from 'node:path';
import { ResultStore } from '../search/ResultStore';
import { CommitResult, BlobResult, TreeResult, ScanSource } from '../types';
import { SOURCE_LABELS } from '../git/sources/types';

// Five levels: filter chips → groups → commits/blobs/trees → path children → line matches
type TreeNode = FilterChipNode | GroupNode | CommitNode | BlobNode | TreeObjectNode | WelcomeNode | PathNode | LineNode;

interface WelcomeNode {
  kind: 'welcome';
  message: string;
}

interface FilterChipNode {
  kind: 'filterChip';
  filter: string;
}

interface GroupNode {
  kind: 'group';
  source: ScanSource;
  count: number;
}

interface CommitNode {
  kind: 'commit';
  commit: CommitResult;
}

interface BlobNode {
  kind: 'blob';
  blob: BlobResult;
}

interface TreeObjectNode {
  kind: 'tree';
  tree: TreeResult;
}

interface PathNode {
  kind: 'path';
  filePath: string;
  commit: CommitResult;
}

interface LineNode {
  kind: 'line';
  lineNum: number;
  content: string;
  filePath: string;
  commit: CommitResult;
}

export class SidebarTreeView implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _hasSearchRun = false;
  private _isSearching = false;
  private _filters: string[] = [];

  constructor(private readonly store: ResultStore) {
    store.on('change', () => this._scheduleRefresh());
  }

  // --- Filter API ---

  get filterCount(): number { return this._filters.length; }

  get filteredCommitCount(): number {
    return this._applyFilters(this.store.getCommits()).length;
  }

  addFilter(filter: string): void {
    if (!this._filters.includes(filter)) {
      this._filters.push(filter);
      this._scheduleRefresh();
    }
  }

  removeFilter(filter: string): void {
    this._filters = this._filters.filter(f => f !== filter);
    this._scheduleRefresh();
  }

  clearFilters(): void {
    this._filters = [];
    this._scheduleRefresh();
  }

  private _applyFilters(commits: CommitResult[]): CommitResult[] {
    if (this._filters.length === 0) return commits;
    return commits.filter(c =>
      this._filters.every(f => {
        const fl = f.toLowerCase();
        return (
          c.subject.toLowerCase().includes(fl) ||
          c.sha.startsWith(fl) ||
          c.matchedPaths.some(p => p.toLowerCase().includes(fl)) ||
          (c.lineMatches ?? []).some(lm => lm.content.toLowerCase().includes(fl)) ||
          (c.headBranch ?? '').toLowerCase().includes(fl)
        );
      }),
    );
  }

  // --- Tree refresh ---

  private _scheduleRefresh(): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._onDidChangeTreeData.fire();
    }, 150);
  }

  setSearching(searching: boolean): void {
    this._isSearching = searching;
    if (searching) {
      this._hasSearchRun = true;
      this._filters = []; // clear filters on new search
    }
    this._onDidChangeTreeData.fire();
  }

  // --- TreeDataProvider ---

  getTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === 'welcome') {
      const item = new vscode.TreeItem(node.message, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('info');
      return item;
    }

    if (node.kind === 'filterChip') {
      const item = new vscode.TreeItem(node.filter, vscode.TreeItemCollapsibleState.None);
      item.description = 'click to remove';
      item.tooltip = `Remove filter: "${node.filter}"`;
      item.iconPath = new vscode.ThemeIcon('filter');
      item.command = {
        command: 'giteverywhere.removeFilter',
        title: 'Remove Filter',
        arguments: [node.filter],
      };
      item.contextValue = 'filterChip';
      return item;
    }

    if (node.kind === 'group') {
      const label = SOURCE_LABELS[node.source];
      const item = new vscode.TreeItem(
        `${label}`,
        node.count > 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.description = `(${node.count})`;
      const nonReachable: ScanSource[] = [
        'reflog', 'stash', 'danglingCommit', 'danglingTree', 'danglingBlob',
        'fetchHead', 'specialHeads', 'worktreeHeads',
      ];
      if (nonReachable.includes(node.source)) {
        item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
      } else {
        item.iconPath = new vscode.ThemeIcon('git-commit');
      }
      return item;
    }

    if (node.kind === 'commit') {
      const c = node.commit;
      const collapsible = c.matchedPaths.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;
      const item = new vscode.TreeItem(c.shortSha, collapsible);
      const subject = c.subject || '(no subject)';
      item.description = c.headBranch ? `${subject} · ${c.headBranch}` : subject;
      item.tooltip = `${c.sha}\nFound via: ${c.sources.join(', ')}`;
      const looksReachable = c.reachableFromHead || c.sources.includes('reachable');
      item.iconPath = looksReachable
        ? new vscode.ThemeIcon('git-commit')
        : new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
      item.command = {
        command: 'giteverywhere.showDetail',
        title: 'Show Detail',
        arguments: [c.sha],
      };
      item.contextValue = 'commitResult';
      return item;
    }

    if (node.kind === 'path') {
      const basename = path.basename(node.filePath);
      const dirname = path.dirname(node.filePath);
      const lines = node.commit.lineMatches?.filter(m => m.filePath === node.filePath) ?? [];
      const collapsible = lines.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None;
      const item = new vscode.TreeItem(basename, collapsible);
      item.description = dirname === '.' ? undefined : dirname;
      item.tooltip = node.filePath;
      item.iconPath = new vscode.ThemeIcon('file');
      item.contextValue = 'pathResult';
      item.command = {
        command: 'giteverywhere.showDetail',
        title: 'Show Detail',
        arguments: [node.commit.sha],
      };
      return item;
    }

    if (node.kind === 'blob') {
      const item = new vscode.TreeItem(node.blob.sha.slice(0, 7), vscode.TreeItemCollapsibleState.None);
      item.description = 'dangling blob';
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
      item.tooltip = `Blob SHA: ${node.blob.sha}\nFound via: ${node.blob.sources.join(', ')}`;
      return item;
    }

    if (node.kind === 'tree') {
      const item = new vscode.TreeItem(node.tree.sha.slice(0, 7), vscode.TreeItemCollapsibleState.None);
      item.description = 'dangling tree';
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
      item.tooltip = `Tree SHA: ${node.tree.sha}`;
      return item;
    }

    // line match
    const content = node.content.length > 60 ? node.content.slice(0, 60) + '…' : node.content;
    const item = new vscode.TreeItem(`L${node.lineNum}`, vscode.TreeItemCollapsibleState.None);
    item.description = content;
    item.tooltip = `${node.filePath}:${node.lineNum}\n${node.content}`;
    item.iconPath = new vscode.ThemeIcon('dash');
    item.command = {
      command: 'giteverywhere.openAtLine',
      title: 'Open File at Line',
      arguments: [node.commit.sha, node.filePath, node.lineNum],
    };
    return item;
  }

  getChildren(node?: TreeNode): TreeNode[] {
    if (!node) return this._getRootChildren();
    if (node.kind === 'welcome' || node.kind === 'filterChip') return [];
    if (node.kind === 'group') return this._getGroupChildren(node.source);
    if (node.kind === 'commit') {
      return node.commit.matchedPaths.map(p => ({
        kind: 'path' as const,
        filePath: p,
        commit: node.commit,
      }));
    }
    if (node.kind === 'path') {
      return (node.commit.lineMatches ?? [])
        .filter(m => m.filePath === node.filePath)
        .map(m => ({
          kind: 'line' as const,
          lineNum: m.lineNum,
          content: m.content,
          filePath: m.filePath,
          commit: node.commit,
        }));
    }
    return [];
  }

  private _getRootChildren(): TreeNode[] {
    if (!this._hasSearchRun) {
      return [{ kind: 'welcome', message: 'Click $(search) to search git history' }];
    }

    const filteredCommits = this._applyFilters(this.store.getCommits());
    const blobs = this.store.getBlobs();
    const trees = this.store.getTrees();

    if (filteredCommits.length + blobs.length + trees.length === 0 && !this._isSearching) {
      const msg = this._filters.length > 0
        ? 'No results match the active filters. Click a filter to remove it.'
        : 'No results found. Try a different query or deeper scan depth.';
      return [...this._getFilterChips(), { kind: 'welcome', message: msg }];
    }

    const allSources: ScanSource[] = [
      'reachable', 'reflog', 'stash',
      'danglingCommit', 'danglingTree', 'danglingBlob',
      'fetchHead', 'notes', 'specialHeads', 'worktreeHeads', 'objectStore',
    ];

    const groups = allSources
      .filter(source => {
        if (source === 'danglingBlob') return blobs.some(b => b.sources.includes(source));
        if (source === 'danglingTree') return trees.some(t => t.sources.includes(source));
        return filteredCommits.some(c => c.sources.includes(source));
      })
      .map(source => {
        let count: number;
        if (source === 'danglingBlob') {
          count = blobs.filter(b => b.sources.includes(source)).length;
        } else if (source === 'danglingTree') {
          count = trees.filter(t => t.sources.includes(source)).length;
        } else {
          count = filteredCommits.filter(c => c.sources.includes(source)).length;
        }
        return { kind: 'group' as const, source, count };
      });

    return [...this._getFilterChips(), ...groups];
  }

  private _getFilterChips(): FilterChipNode[] {
    return this._filters.map(f => ({ kind: 'filterChip' as const, filter: f }));
  }

  private _getGroupChildren(source: ScanSource): TreeNode[] {
    if (source === 'danglingBlob') {
      return this.store.getBlobs()
        .filter(b => b.sources.includes(source))
        .map(blob => ({ kind: 'blob' as const, blob }));
    }
    if (source === 'danglingTree') {
      return this.store.getTrees()
        .filter(t => t.sources.includes(source))
        .map(tree => ({ kind: 'tree' as const, tree }));
    }
    return this._applyFilters(this.store.getCommits())
      .filter(c => c.sources.includes(source))
      .map(commit => ({ kind: 'commit' as const, commit }));
  }

  dispose(): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._onDidChangeTreeData.dispose();
  }
}
