import { GitRunner } from '../GitRunner';

export async function* notes(
  gitRunner: GitRunner,
  cwd: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  // Get commit SHAs that have notes attached
  const output = await gitRunner.run(['notes', 'list'], cwd, signal);
  if (!output) return;

  const seen = new Set<string>();
  for (const line of output.split('\n')) {
    if (signal.aborted) return;
    // Format: <note-sha> <commit-sha>
    const parts = line.trim().split(/\s+/);
    const commitSha = parts[1];
    if (commitSha && /^[0-9a-f]{40}$/.test(commitSha) && !seen.has(commitSha)) {
      seen.add(commitSha);
      yield commitSha;
    }
  }
}
