import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GitRunner } from '../../src/git/GitRunner';
import { RepoDetector } from '../../src/repo/RepoDetector';

// Minimal mock vscode.OutputChannel
const mockChannel = { appendLine: () => {} } as any;

/**
 * Build a mock vscode with a controllable workspaceFolders value.
 */
function makeVscodeMock(fsPath: string | null) {
  return {
    workspace: {
      workspaceFolders: fsPath
        ? [{ uri: { fsPath } }]
        : [],
      onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
    },
    EventEmitter: class {
      event = (_listener: unknown) => ({ dispose: () => {} });
      fire(_e: unknown) {}
      dispose() {}
    },
  };
}

// We rely on the vscode mock already aliased via vitest.config.ts.
// The mock exports workspace with mutable workspaceFolders.
// We import the real vscode mock and patch it per test.
import * as vscode from 'vscode';

describe('RepoDetector', () => {
  it('returns undefined when there are no workspace folders', async () => {
    // Patch workspace folders to empty
    (vscode.workspace as any).workspaceFolders = [];

    const runner = new GitRunner(mockChannel);
    const detector = new RepoDetector(runner, mockChannel);
    const result = await detector.detect();
    expect(result).toBeUndefined();
    detector.dispose();
  });

  it('returns undefined for a non-git directory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repodetector-test-'));
    try {
      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: tmpDir } },
      ];

      const runner = new GitRunner(mockChannel);
      const detector = new RepoDetector(runner, mockChannel);
      const result = await detector.detect();
      expect(result).toBeUndefined();
      detector.dispose();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns a path string when called in a valid git repo directory', async () => {
    // Create a temp git repo
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repodetector-git-'));
    try {
      // Init a git repo
      const { execa } = await import('execa');
      await execa('git', ['init'], { cwd: tmpDir });
      await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
      await execa('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });

      (vscode.workspace as any).workspaceFolders = [
        { uri: { fsPath: tmpDir } },
      ];

      const runner = new GitRunner(mockChannel);
      const detector = new RepoDetector(runner, mockChannel);
      const result = await detector.detect();

      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
      detector.dispose();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
