import { GitRunner } from '../GitRunner';

export async function* reflog(
  gitRunner: GitRunner,
  cwd: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const seen = new Set<string>();
  const queue: string[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  const streamPromise = gitRunner.stream(['reflog', '--all', '--format=%H'], cwd, signal, (sha) => {
    const s = sha.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      queue.push(s);
      resolve?.();
      resolve = null;
    }
  }).then(() => {
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
