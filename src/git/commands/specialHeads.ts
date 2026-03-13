import { GitRunner } from '../GitRunner';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SpecialHead {
  ref: string;
  sha: string;
}

const SPECIAL_HEAD_NAMES = [
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'BISECT_HEAD',
] as const;

export async function* specialHeads(
  gitRunner: GitRunner,
  cwd: string,
  signal: AbortSignal,
): AsyncGenerator<SpecialHead> {
  const gitDir = (await gitRunner.run(['rev-parse', '--absolute-git-dir'], cwd, signal)).trim();
  if (!gitDir) return;

  for (const refName of SPECIAL_HEAD_NAMES) {
    if (signal.aborted) return;
    const refPath = path.join(gitDir, refName);
    try {
      const sha = (await fs.readFile(refPath, 'utf-8')).trim();
      if (/^[0-9a-f]{40}$/.test(sha)) {
        yield { ref: refName, sha };
      }
    } catch {
      // File doesn't exist — this head is not active. Not an error.
    }
  }
}
