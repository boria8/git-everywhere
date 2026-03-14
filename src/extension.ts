import * as vscode from 'vscode';
import * as path from 'path';
import { GitRunner } from './git/GitRunner';
import { RepoDetector } from './repo/RepoDetector';
import { ResultStore } from './search/ResultStore';
import { SearchController } from './search/SearchController';
import { SidebarTreeView } from './ui/SidebarTreeView';
import { ActionExecutor } from './ui/ActionExecutor';
import { DetailPanel } from './ui/DetailPanel';
import { SearchMode, ScanDepth } from './types';
import { SearchOptions } from './search/SearchController';

function resolveGitPath(): string {
  // Prefer the path VS Code's own git extension already resolved (works on Mac/Linux/Windows)
  const builtinGit = vscode.extensions.getExtension('vscode.git');
  if (builtinGit?.isActive) {
    const p: string | undefined = builtinGit.exports?.getAPI(1)?.git?.path;
    if (p) return p;
  }
  // Fall back to user-configured git.path setting, then plain 'git'
  return vscode.workspace.getConfiguration('git').get<string>('path') || 'git';
}

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('GitEverywhere');
  context.subscriptions.push(outputChannel);

  const gitRunner = new GitRunner(outputChannel, resolveGitPath());
  const store = new ResultStore();
  const controller = new SearchController(gitRunner, store, outputChannel);
  const repoDetector = new RepoDetector(gitRunner, outputChannel);
  const treeView = new SidebarTreeView(store);
  const executor = new ActionExecutor(gitRunner, outputChannel);

  // Register the tree view
  const vsTreeView = vscode.window.createTreeView('gitEverywhereExplorer', {
    treeDataProvider: treeView,
    showCollapseAll: true,
  });
  context.subscriptions.push(vsTreeView, treeView);

  // Detect repo on startup
  repoDetector.detect();

  // Helper: execute a search run
  type HistoryEntry = { query: string; mode: SearchMode; depth: ScanDepth };
  async function runSearch(query: string, mode: SearchMode, depth: ScanDepth, cwd: string): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('giteverywhere');
    const searchOptions: SearchOptions = {
      caseInsensitive: cfg.get<boolean>('caseInsensitive', false),
      remoteMode: cfg.get<'none' | 'check' | 'fetch'>('remoteMode', 'none'),
    };
    await vscode.commands.executeCommand('setContext', 'giteverywhere.searching', true);
    treeView.setSearching(true);
    vsTreeView.message = `Searching: "${query}"`;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'GitEverywhere', cancellable: false },
      async (progress) => {
        try {
          await controller.search(query, mode, depth, cwd, (p) => {
            progress.report({ message: `Scanning ${p.phase}… (${p.count} found)` });
          }, searchOptions);
        } finally {
          await vscode.commands.executeCommand('setContext', 'giteverywhere.searching', false);
          treeView.setSearching(false);
          const total = store.size;
          await vscode.commands.executeCommand('setContext', 'giteverywhere.hasResults', total > 0);
          const ciNote = searchOptions.caseInsensitive ? ' (case-insensitive)' : '';
          vsTreeView.message = `"${query}"${ciNote} — ${total} result${total === 1 ? '' : 's'}`;
          outputChannel.appendLine(`Search complete. ${total} result(s) found.`);
        }
      },
    );
  }

  // Search command
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.startSearch', async () => {
      const cwd = repoDetector.repoRoot;
      if (!cwd) {
        vscode.window.showWarningMessage('GitEverywhere: No git repository found in workspace.');
        return;
      }

      // Show history picker if history exists
      const history = context.workspaceState.get<HistoryEntry[]>('searchHistory', []);
      type HistoryItem = vscode.QuickPickItem & { isNew?: boolean; entry?: HistoryEntry };
      if (history.length > 0) {
        const historyItems: HistoryItem[] = [
          { label: '$(add) New search...', isNew: true },
          { label: '', kind: vscode.QuickPickItemKind.Separator },
          ...history.map(h => ({
            label: h.query,
            description: `${h.mode} · ${h.depth}`,
            entry: h,
          })),
        ];
        const pick = await vscode.window.showQuickPick<HistoryItem>(historyItems, {
          title: 'GitEverywhere — Recent Searches',
          placeHolder: 'Pick a recent search or start new',
        });
        if (!pick) return;
        if (!pick.isNew && pick.entry) {
          await runSearch(pick.entry.query, pick.entry.mode, pick.entry.depth, cwd);
          return;
        }
      }

      // New search flow
      const last = history[0];
      type ModeItem = vscode.QuickPickItem & { value: SearchMode };
      const modeItems: ModeItem[] = [
        { label: '$(search) Content', description: 'Search code/text across all history', value: 'content' },
        { label: '$(git-commit) Commit message', description: 'Search commit messages', value: 'commitMessage' },
        { label: '$(file) Filename / path', description: 'Search file names across all history', value: 'filename' },
      ];
      if (last?.mode) {
        const idx = modeItems.findIndex(i => i.value === last.mode);
        if (idx > 0) modeItems.unshift(...modeItems.splice(idx, 1));
      }
      const modeChoice = await vscode.window.showQuickPick<ModeItem>(modeItems, {
        placeHolder: 'How do you want to search?',
        title: 'GitEverywhere — Search Mode',
      });
      if (!modeChoice) return;

      const query = await vscode.window.showInputBox({
        placeHolder: 'Enter search string...',
        title: `GitEverywhere — ${modeChoice.label}`,
        value: last?.query ?? '',
        validateInput: (v) => v.trim() ? null : 'Please enter a search string',
      });
      if (!query) return;

      type DepthItem = vscode.QuickPickItem & { value: ScanDepth };
      const depthItems: DepthItem[] = [
        { label: '$(zap) Fast', description: 'Branches, reflog, stash — seconds', value: 'fast' },
        { label: '$(search) Deep', description: '+ dangling objects, FETCH_HEAD, notes, special heads — 10-30s', value: 'deep' },
        { label: '$(database) Full', description: '+ entire object store — slow on large repos', value: 'full' },
      ];
      if (last?.depth) {
        const idx = depthItems.findIndex(i => i.value === last.depth);
        if (idx > 0) depthItems.unshift(...depthItems.splice(idx, 1));
      }
      const depthChoice = await vscode.window.showQuickPick<DepthItem>(depthItems, {
        placeHolder: 'Select scan depth',
        title: 'GitEverywhere — Scan Depth',
      });
      if (!depthChoice) return;

      // Save to history (deduplicated, max 10)
      const newEntry: HistoryEntry = { query, mode: modeChoice.value, depth: depthChoice.value };
      const updated = [
        newEntry,
        ...history.filter(h => !(h.query === query && h.mode === modeChoice.value && h.depth === depthChoice.value)),
      ].slice(0, 10);
      await context.workspaceState.update('searchHistory', updated);

      await runSearch(query, modeChoice.value, depthChoice.value, cwd);
    }),
  );

  // Toggle case-insensitive command
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.toggleCaseInsensitive', async () => {
      const cfg = vscode.workspace.getConfiguration('giteverywhere');
      const current = cfg.get<boolean>('caseInsensitive', false);
      await cfg.update('caseInsensitive', !current, vscode.ConfigurationTarget.Workspace);
      vscode.window.setStatusBarMessage(
        `GitEverywhere: Case-insensitive ${!current ? 'ON' : 'OFF'}`,
        3000,
      );
    }),
  );

  // Switch repository command
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.switchRepo', async () => {
      await repoDetector.detect();
      const root = repoDetector.repoRoot;
      if (root) {
        vscode.window.setStatusBarMessage(`GitEverywhere: ${path.basename(root)}`, 3000);
      }
    }),
  );

  // Cancel command
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.cancelSearch', () => {
      controller.cancel();
      vscode.commands.executeCommand('setContext', 'giteverywhere.searching', false);
      treeView.setSearching(false);
    }),
  );

  // Clear results command
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.clearResults', () => {
      controller.cancel();
      store.clear();
      vscode.commands.executeCommand('setContext', 'giteverywhere.searching', false);
      vscode.commands.executeCommand('setContext', 'giteverywhere.hasResults', false);
      treeView.setSearching(false);
      vsTreeView.message = undefined;
    }),
  );

  // Show detail command
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.showDetail', (sha: string) => {
      const cwd = repoDetector.repoRoot;
      if (!cwd) return;
      DetailPanel.show(sha, store, gitRunner, executor, context.extensionUri, cwd);
    }),
  );

  // Copy SHA command
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.copysha', async (sha: string) => {
      await vscode.env.clipboard.writeText(sha);
      vscode.window.setStatusBarMessage('SHA copied to clipboard', 2000);
    }),
  );

  // Copy path command (right-click on file node)
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.copyPath', async (node: { filePath?: string }) => {
      if (node?.filePath) {
        await vscode.env.clipboard.writeText(node.filePath);
        vscode.window.setStatusBarMessage('Path copied to clipboard', 2000);
      }
    }),
  );

  // Open file at line (click on line match node)
  context.subscriptions.push(
    vscode.commands.registerCommand('giteverywhere.openAtLine', async (sha: string, filePath: string, lineNum: number) => {
      const cwd = repoDetector.repoRoot;
      if (!cwd) return;
      const absPath = path.join(cwd, filePath);
      try {
        const doc = await vscode.workspace.openTextDocument(absPath);
        const editor = await vscode.window.showTextDocument(doc);
        const line = Math.max(0, lineNum - 1);
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      } catch {
        // File doesn't exist in working tree — fall back to detail panel
        DetailPanel.show(sha, store, gitRunner, executor, context.extensionUri, cwd);
      }
    }),
  );

  outputChannel.appendLine('GitEverywhere activated.');
}

export function deactivate(): void {
  // SearchController.cancel() is called via command; store and controller are GC'd
}
