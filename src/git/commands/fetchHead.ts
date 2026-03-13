import { GitRunner } from '../GitRunner';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function* fetchHead(
  gitRunner: GitRunner,
  cwd: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  // Get the .git dir path
  const gitDir = (await gitRunner.run(['rev-parse', '--absolute-git-dir'], cwd, signal)).trim();
  if (!gitDir) return;

  const fetchHeadPath = path.join(gitDir, 'FETCH_HEAD');

  let content: string;
  try {
    content = await fs.readFile(fetchHeadPath, 'utf-8');
  } catch {
    return; // File doesn't exist — no fetch has been done
  }

  const seen = new Set<string>();
  for (const line of content.split('\n')) {
    if (signal.aborted) return;
    // Format: <sha>\t<branch info> or <sha>\tnot-for-merge\t<branch info>
    const sha = line.split('\t')[0].trim();
    if (/^[0-9a-f]{40}$/.test(sha) && !seen.has(sha)) {
      seen.add(sha);
      yield sha;
    }
  }
}
