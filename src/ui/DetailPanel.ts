import * as vscode from 'vscode';
import { GitRunner } from '../git/GitRunner';
import { ActionExecutor } from './ActionExecutor';
import { CommitResult } from '../types';
import { ResultStore } from '../search/ResultStore';

export class DetailPanel {
  // Singleton map: sha -> panel
  private static readonly _panels = new Map<string, DetailPanel>();

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  static show(
    sha: string,
    store: ResultStore,
    gitRunner: GitRunner,
    executor: ActionExecutor,
    extensionUri: vscode.Uri,
    cwd: string,
  ): void {
    const existing = DetailPanel._panels.get(sha);
    if (existing) {
      existing._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'gitEverywhereDetail',
      `Commit ${sha.slice(0, 7)}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
        retainContextWhenHidden: true,
      },
    );

    new DetailPanel(panel, sha, store, gitRunner, executor, extensionUri, cwd);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly sha: string,
    private readonly store: ResultStore,
    private readonly gitRunner: GitRunner,
    private readonly executor: ActionExecutor,
    private readonly extensionUri: vscode.Uri,
    private readonly cwd: string,
  ) {
    this._panel = panel;
    DetailPanel._panels.set(sha, this);

    this._panel.webview.html = this._getHtml();

    // Listen for messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (msg) => this._handleMessage(msg),
      null,
      this._disposables,
    );

    // Clean up on dispose
    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);

    // Send commit data once panel is ready — fetch full metadata lazily
    this._loadAndSend();
  }

  private async _loadAndSend(): Promise<void> {
    const commit = this.store.getCommits().find(c => c.sha === this.sha);
    if (!commit) {
      this._panel.webview.postMessage({ type: 'error', message: 'Commit not found in results.' });
      return;
    }

    const sha = this.sha;

    // Fetch full metadata lazily (not done during scan)
    const [showOutput, branchOutput, refsOutput] = await Promise.all([
      this.gitRunner.run(
        ['show', '--no-patch', '--format=%s%n%an%n%ae%n%ai%n%ci%n%P', sha],
        this.cwd,
      ),
      this.gitRunner.run(['branch', '-a', '--contains', sha], this.cwd),
      this.gitRunner.run(['for-each-ref', '--format=%(refname:short)', `--points-at=${sha}`], this.cwd),
    ]);

    // git log sha ^HEAD shows commits in sha's history NOT in HEAD's history.
    // If sha IS an ancestor of HEAD: result is empty (reachable).
    // If sha is NOT an ancestor: result is non-empty.
    const logCheck = await this.gitRunner.run(
      ['log', '--oneline', sha, '^HEAD', '--max-count=1'],
      this.cwd,
    );
    const reachableFromHead = logCheck.trim() === '';

    const [subject, authorName, authorEmail, authorDate, commitDate, parents] =
      showOutput.split('\n').map(s => s.trim());

    const changedFiles = await this.gitRunner.run(
      ['show', '--name-status', '--format=', sha],
      this.cwd,
    );

    const enriched: CommitResult = {
      ...commit,
      subject: subject ?? '',
      authorName: authorName ?? '',
      authorEmail: authorEmail ?? '',
      authorDate: authorDate ?? '',
      commitDate: commitDate ?? '',
      parents: parents ? parents.split(' ').filter(Boolean) : [],
      reachableFromHead,
      changedFiles: changedFiles.trim(),
      branchesContaining: branchOutput.split('\n').map(s => s.trim().replace(/^\* /, '')).filter(Boolean),
      refsPointing: refsOutput.split('\n').map(s => s.trim()).filter(Boolean),
    };

    this._panel.webview.postMessage({ type: 'init', commit: enriched });
  }

  private async _handleMessage(msg: { type: string; action?: string; sha?: string; filePath?: string }): Promise<void> {
    switch (msg.action) {
      case 'copySha':
        await this.executor.copySha(this.sha);
        break;
      case 'showInTerminal':
        await this.executor.showInTerminal(this.sha, this.cwd);
        break;
      case 'checkout':
        await this.executor.checkoutNewBranch(this.sha, this.cwd);
        break;
      case 'cherryPick':
        await this.executor.cherryPick(this.sha, this.cwd);
        break;
      case 'restoreFile':
        if (msg.filePath) {
          await this.executor.restoreFile(this.sha, msg.filePath, this.cwd);
        }
        break;
    }
  }

  private _getHtml(): string {
    const webview = this._panel.webview;
    const distWebviewUri = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distWebviewUri, 'assets', 'main.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}';
             style-src ${webview.cspSource} 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GitEverywhere</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _dispose(): void {
    DetailPanel._panels.delete(this.sha);
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
