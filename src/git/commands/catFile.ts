import { GitRunner } from '../GitRunner';

export type ObjectType = 'commit' | 'tree' | 'blob' | 'tag';

export interface GitObject {
  sha: string;
  type: ObjectType;
}

export async function* catFile(
  gitRunner: GitRunner,
  cwd: string,
  signal: AbortSignal,
): AsyncGenerator<GitObject> {
  // Format: "<sha> <type> <size>"
  const seen = new Set<string>();
  const queue: GitObject[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  const streamPromise = gitRunner.stream(
    ['cat-file', '--batch-all-objects', '--batch-check'],
    cwd,
    signal,
    (line) => {
      const parts = line.trim().split(' ');
      const sha = parts[0];
      const type = parts[1] as ObjectType;
      if (sha && type && ['commit', 'tree', 'blob', 'tag'].includes(type) && !seen.has(sha)) {
        seen.add(sha);
        queue.push({ sha, type });
        resolve?.();
        resolve = null;
      }
    },
  ).then(() => {
    done = true;
    resolve?.();
    resolve = null;
  });

  while (!done || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((r) => { resolve = r; });
    }
    while (queue.length > 0) {
      yield queue.shift()!;
    }
  }

  await streamPromise;
}
