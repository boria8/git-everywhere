import { GitRunner } from '../GitRunner';

export interface StashEntry {
  ref: string;
  sha: string;
  slot: 'main' | 'index' | 'untracked';
}

export async function* stash(
  gitRunner: GitRunner,
  cwd: string,
  signal: AbortSignal,
): AsyncGenerator<StashEntry> {
  // Get stash refs
  const listOutput = await gitRunner.run(['stash', 'list', '--format=%gd'], cwd, signal);
  const refs = listOutput.split('\n').map(l => l.trim()).filter(Boolean);

  for (const ref of refs) {
    if (signal.aborted) return;

    // main slot
    const mainSha = (await gitRunner.run(['rev-parse', ref], cwd, signal)).trim();
    if (mainSha) yield { ref, sha: mainSha, slot: 'main' };

    // index slot (^2)
    const indexSha = (await gitRunner.run(['rev-parse', `${ref}^2`], cwd, signal)).trim();
    if (indexSha) yield { ref, sha: indexSha, slot: 'index' };

    // untracked slot (^3) — may not exist
    const untrackedSha = (await gitRunner.run(['rev-parse', `${ref}^3`], cwd, signal)).trim();
    if (untrackedSha) yield { ref, sha: untrackedSha, slot: 'untracked' };
  }
}
