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

    for (const folder of folders) {
      const cwd = folder.uri.fsPath;
      const root = (await this.gitRunner.run(['rev-parse', '--show-toplevel'], cwd)).trim();
      if (root) {
        // Normalize path separators for Windows/WSL
        const normalized = path.normalize(root);
        if (normalized !== this._repoRoot) {
          this._repoRoot = normalized;
          this._onDidChangeRepo.fire(normalized);
        }
        return normalized;
      }
    }

    this._repoRoot = undefined;
    this._onDidChangeRepo.fire(undefined);
    return undefined;
  }

  dispose(): void {
    this._onDidChangeRepo.dispose();
  }
}
