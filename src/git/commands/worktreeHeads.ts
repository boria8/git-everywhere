import { GitRunner } from '../GitRunner';

export interface WorktreeHead {
  worktreePath: string;
  sha: string;
}

export async function* worktreeHeads(
  gitRunner: GitRunner,
  cwd: string,
  signal: AbortSignal,
): AsyncGenerator<WorktreeHead> {
  const output = await gitRunner.run(['worktree', 'list', '--porcelain'], cwd, signal);
  if (!output) return;

  // Parse porcelain blocks separated by blank lines
  const blocks = output.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    if (signal.aborted) return;
    const lines = block.split('\n');
    let worktreePath = '';
    let sha = '';
    let hasBranch = false;

    for (const line of lines) {
      if (line.startsWith('worktree ')) worktreePath = line.slice('worktree '.length);
      if (line.startsWith('HEAD ')) sha = line.slice('HEAD '.length);
      if (line.startsWith('branch ')) hasBranch = true;
    }

    // Only yield detached HEADs (no branch line)
    if (!hasBranch && sha && /^[0-9a-f]{40}$/.test(sha)) {
      yield { worktreePath, sha };
    }
  }
}
