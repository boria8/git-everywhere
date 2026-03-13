import * as vscode from 'vscode';
import * as path from 'path';
import { GitRunner } from '../git/GitRunner';

export class RepoDetector {
  private _repoRoot: string | undefined;
  private readonly _onDidChangeRepo = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeRepo = this._onDidChangeRepo.event;

  constructor(
    private readonly gitRunner: GitRunner,
    private readonly outputChannel: vscode.OutputChannel,
  ) {
    vscode.workspace.onDidChangeWorkspaceFolders(() => this.detect());
  }

  get repoRoot(): string | undefined {
    return this._repoRoot;
  }

  async detect(): Promise<string | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this._repoRoot = undefined;
      this._onDidChangeRepo.fire(undefined);
      return undefined;
    }

    // Try each workspace folder root first
    for (const folder of folders) {
      const cwd = folder.uri.fsPath;
      const root = (await this.gitRunner.run(['rev-parse', '--show-toplevel'], cwd)).trim();
      if (root) {
        const normalized = path.normalize(root);
        if (normalized !== this._repoRoot) {
          this._repoRoot = normalized;
          this._onDidChangeRepo.fire(normalized);
        }
        return normalized;
      }
    }

    // No workspace root is itself a git repo — scan one level deep for .git dirs
    const found: string[] = [];
    for (const folder of folders) {
      try {
        const entries = await vscode.workspace.fs.readDirectory(folder.uri);
        for (const [name, type] of entries) {
          if (type !== vscode.FileType.Directory) continue;
          const subUri = vscode.Uri.joinPath(folder.uri, name);
          try {
            await vscode.workspace.fs.stat(vscode.Uri.joinPath(subUri, '.git'));
            found.push(subUri.fsPath);
          } catch {
            // not a git repo
          }
        }
      } catch {
        // can't read directory
      }
    }

    if (found.length === 0) {
      this._repoRoot = undefined;
      this._onDidChangeRepo.fire(undefined);
      return undefined;
    }

    if (found.length === 1) {
      const normalized = path.normalize(found[0]);
      if (normalized !== this._repoRoot) {
        this._repoRoot = normalized;
        this._onDidChangeRepo.fire(normalized);
      }
      return normalized;
    }

    // Multiple repos found — let user pick
    const pick = await vscode.window.showQuickPick(
      found.map(p => ({ label: path.basename(p), description: p, fsPath: p })),
      { placeHolder: 'Multiple git repositories found — select one to search' },
    );
    if (!pick) return this._repoRoot;

    const normalized = path.normalize(pick.fsPath);
    if (normalized !== this._repoRoot) {
      this._repoRoot = normalized;
      this._onDidChangeRepo.fire(normalized);
    }
    return normalized;
  }

  dispose(): void {
    this._onDidChangeRepo.dispose();
  }
}
