import * as vscode from 'vscode';
import { GitRunner } from '../git/GitRunner';

export class ActionExecutor {
  constructor(
    private readonly gitRunner: GitRunner,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  async copySha(sha: string): Promise<void> {
    await vscode.env.clipboard.writeText(sha);
    vscode.window.setStatusBarMessage('$(check) SHA copied', 2000);
  }

  async showInTerminal(sha: string, cwd: string): Promise<void> {
    const terminal = vscode.window.activeTerminal
      ?? vscode.window.createTerminal({ name: 'GitEverywhere', cwd });
    terminal.show();
    terminal.sendText(`git show --stat ${sha}`);
  }

  async checkoutNewBranch(sha: string, cwd: string): Promise<void> {
    const shortSha = sha.slice(0, 7);
    const branchName = await vscode.window.showInputBox({
      title: 'Create rescue branch',
      placeHolder: `rescue-${shortSha}`,
      value: `rescue-${shortSha}`,
      validateInput: (v) => /^[a-zA-Z0-9._\-/]+$/.test(v) ? null : 'Invalid branch name',
    });
    if (!branchName) return;

    const output = await this.gitRunner.run(['switch', '-c', branchName, sha], cwd);
    if (output !== null) {
      vscode.window.showInformationMessage(`GitEverywhere: Created branch '${branchName}' at ${shortSha}`);
    } else {
      vscode.window.showErrorMessage(`GitEverywhere: Failed to create branch. Check the Output panel.`);
    }
  }

  async cherryPick(sha: string, cwd: string): Promise<void> {
    const shortSha = sha.slice(0, 7);
    const cpOutput = await this.gitRunner.run(['cherry-pick', sha], cwd);
    if (cpOutput === null) {
      vscode.window.showErrorMessage(`GitEverywhere: Cherry-pick failed. Check the Output panel.`);
      return;
    }
    const statusOutput = await this.gitRunner.run(['status', '--porcelain'], cwd);
    const hasConflict = statusOutput
      .split('\n').some(l => l.startsWith('UU') || l.startsWith('AA') || l.startsWith('DD'));

    if (hasConflict) {
      vscode.window.showWarningMessage(
        `GitEverywhere: Cherry-pick of ${shortSha} has conflicts. Resolve them and run 'git cherry-pick --continue'.`,
      );
    } else {
      vscode.window.showInformationMessage(`GitEverywhere: Cherry-picked ${shortSha} successfully.`);
    }
  }

  async restoreFile(sha: string, filePath: string, cwd: string): Promise<void> {
    const shortSha = sha.slice(0, 7);
    const confirm = await vscode.window.showWarningMessage(
      `Restore '${filePath}' from commit ${shortSha}? This will overwrite your current version.`,
      { modal: true },
      'Restore',
    );
    if (confirm !== 'Restore') return;

    const result = await this.gitRunner.run(['checkout', sha, '--', filePath], cwd);
    if (result === null) {
      vscode.window.showErrorMessage(`GitEverywhere: Failed to restore '${filePath}'. Check the Output panel.`);
      return;
    }
    vscode.window.showInformationMessage(`GitEverywhere: Restored '${filePath}' from ${shortSha}.`);
  }
}
