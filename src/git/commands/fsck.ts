import { GitRunner } from '../GitRunner';

export type DanglingKind = 'commit' | 'tree' | 'blob';

export interface DanglingObject {
  kind: DanglingKind;
  sha: string;
}

export async function* fsck(
  gitRunner: GitRunner,
  cwd: string,
  signal: AbortSignal,
): AsyncGenerator<DanglingObject> {
  const seen = new Set<string>();
  const queue: DanglingObject[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  const streamPromise = gitRunner.stream(
    ['fsck', '--full', '--no-reflogs'],
    cwd,
    signal,
    (line) => {
      const match = line.match(/^dangling (commit|tree|blob) ([0-9a-f]{40})$/);
      if (match && !seen.has(match[2])) {
        seen.add(match[2]);
        queue.push({ kind: match[1] as DanglingKind, sha: match[2] });
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
