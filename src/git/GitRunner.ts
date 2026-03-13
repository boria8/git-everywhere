import { execa } from 'execa';
import * as vscode from 'vscode';

export class GitRunner {
  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  /**
   * Run a git command and return the full stdout as a string.
   * Non-zero exit is returned as an empty string (not thrown), unless it's a real error.
   */
  async run(args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
    try {
      const result = await execa('git', args, {
        cwd,
        reject: false,
        cancelSignal: signal,
      });
      if (result.stderr) {
        this.outputChannel.appendLine(`[git ${args[0]}] stderr: ${result.stderr}`);
      }
      return result.stdout;
    } catch (err) {
      if (signal?.aborted) return '';
      this.outputChannel.appendLine(`[git ${args[0]}] error: ${String(err)}`);
      return '';
    }
  }

  /**
   * Run a git command and stream output line by line.
   * Stops cleanly when signal is aborted.
   */
  async stream(
    args: string[],
    cwd: string,
    signal: AbortSignal,
    onLine: (line: string) => void,
  ): Promise<void> {
    try {
      const subprocess = execa('git', args, {
        cwd,
        reject: false,
        cancelSignal: signal,
        lines: true,
      });

      for await (const line of subprocess) {
        if (signal.aborted) break;
        if (line) onLine(line);
      }
    } catch (err) {
      if (signal?.aborted) return;
      this.outputChannel.appendLine(`[git ${args[0]}] stream error: ${String(err)}`);
    }
  }
}
