import { describe, it, expect, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GitRunner } from '../../src/git/GitRunner';

const mockChannel = { appendLine: () => {} } as any;

describe('GitRunner', () => {
  describe('run()', () => {
    it('returns git version string when called with --version', async () => {
      const runner = new GitRunner(mockChannel);
      const result = await runner.run(['--version'], process.cwd());
      expect(result).toMatch(/git version/);
    });

    it('returns empty string on non-zero exit in a non-repo directory', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitrunner-test-'));
      try {
        const runner = new GitRunner(mockChannel);
        const result = await runner.run(['rev-parse', 'nonexistent-ref-xyz'], tmpDir);
        expect(result).toBe('');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('stream()', () => {
    it('collects lines correctly via callback', async () => {
      const runner = new GitRunner(mockChannel);
      const lines: string[] = [];
      const controller = new AbortController();

      await runner.stream(['--version'], process.cwd(), controller.signal, (line) => {
        lines.push(line);
      });

      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toMatch(/git version/);
    });

    it('stops collecting when AbortSignal is aborted', async () => {
      const runner = new GitRunner(mockChannel);
      const lines: string[] = [];
      const controller = new AbortController();

      // Abort immediately before streaming
      controller.abort();

      await runner.stream(['log', '--all', '--oneline'], process.cwd(), controller.signal, (line) => {
        lines.push(line);
      });

      // With a pre-aborted signal, we expect no lines collected
      expect(lines.length).toBe(0);
    });
  });
});
