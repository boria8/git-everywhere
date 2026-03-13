import * as vscode from 'vscode';
import { ResultStore } from '../search/ResultStore';
import { CommitResult, BlobResult, TreeResult, ScanSource } from '../types';
import { SOURCE_LABELS } from '../git/sources/types';

// Two levels of tree items
type TreeNode = GroupNode | CommitNode | BlobNode | TreeObjectNode | WelcomeNode;

interface WelcomeNode {
  kind: 'welcome';
  message: string;
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

export class SidebarTreeView implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _hasSearchRun = false;
  private _isSearching = false;

  constructor(private readonly store: ResultStore) {
    // Subscribe to store changes and debounce tree refresh
    store.on('change', () => this._scheduleRefresh());
  }

  private _scheduleRefresh(): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._onDidChangeTreeData.fire();
    }, 150);
  }

  setSearching(searching: boolean): void {
    this._isSearching = searching;
    if (searching) this._hasSearchRun = true;
    this._onDidChangeTreeData.fire();
  }

  // TreeDataProvider implementation
  getTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === 'welcome') {
      const item = new vscode.TreeItem(node.message, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('info');
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
      // Warning icon for non-reachable sources
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
      const label = c.shortSha;
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
      item.description = c.subject || '(no subject yet)';
      item.tooltip = `${c.sha}\nFound via: ${c.sources.join(', ')}`;
      item.iconPath = c.reachableFromHead
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

    if (node.kind === 'blob') {
      const item = new vscode.TreeItem(node.blob.sha.slice(0, 7), vscode.TreeItemCollapsibleState.None);
      item.description = 'dangling blob';
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
      item.tooltip = `Blob SHA: ${node.blob.sha}\nFound via: ${node.blob.sources.join(', ')}`;
      return item;
    }

    // tree object
    const item = new vscode.TreeItem(node.tree.sha.slice(0, 7), vscode.TreeItemCollapsibleState.None);
    item.description = 'dangling tree';
    item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    item.tooltip = `Tree SHA: ${node.tree.sha}`;
    return item;
  }

  getChildren(node?: TreeNode): TreeNode[] {
    if (!node) {
      // Root level: show welcome/searching/empty state or groups
      return this._getRootChildren();
    }

    if (node.kind === 'welcome') {
      return [];
    }

    if (node.kind === 'group') {
      return this._getGroupChildren(node.source);
    }

    return [];
  }

  private _getRootChildren(): TreeNode[] {
    if (!this._hasSearchRun) {
      return [{ kind: 'welcome', message: 'Click $(search) to search git history' }];
    }

    const total = this.store.size;
    if (total === 0 && !this._isSearching) {
      return [{ kind: 'welcome', message: 'No results found. Try a different query or deeper scan depth.' }];
    }

    const commits = this.store.getCommits();
    const blobs = this.store.getBlobs();
    const trees = this.store.getTrees();

    // Build groups for each source that has at least one result
    // Keep all sources in canonical order so empty groups are visible
    const allSources: ScanSource[] = [
      'reachable', 'reflog', 'stash',
      'danglingCommit', 'danglingTree', 'danglingBlob',
      'fetchHead', 'notes', 'specialHeads', 'worktreeHeads', 'objectStore',
    ];

    return allSources
      .filter(source => {
        // Only show sources that were actually scanned or have results
        if (source === 'danglingBlob') return blobs.some(b => b.sources.includes(source));
        if (source === 'danglingTree') return trees.some(t => t.sources.includes(source));
        return commits.some(c => c.sources.includes(source));
      })
      .map(source => {
        let count: number;
        if (source === 'danglingBlob') {
          count = blobs.filter(b => b.sources.includes(source)).length;
        } else if (source === 'danglingTree') {
          count = trees.filter(t => t.sources.includes(source)).length;
        } else {
          count = commits.filter(c => c.sources.includes(source)).length;
        }
        return { kind: 'group' as const, source, count };
      });
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
    return this.store.getCommits()
      .filter(c => c.sources.includes(source))
      .map(commit => ({ kind: 'commit' as const, commit }));
  }

  dispose(): void {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._onDidChangeTreeData.dispose();
  }
}
