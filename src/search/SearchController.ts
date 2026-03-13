import { GitRunner } from '../git/GitRunner';
import { ResultStore } from './ResultStore';
import { SearchMode, ScanDepth, ScanSource, SearchProgress } from '../types';
import { SCAN_DEPTH_SOURCES } from '../git/sources/types';
import * as vscode from 'vscode';

import { revList } from '../git/commands/revList';
import { reflog } from '../git/commands/reflog';
import { stash } from '../git/commands/stash';
import { fsck } from '../git/commands/fsck';
import { fetchHead } from '../git/commands/fetchHead';
import { notes } from '../git/commands/notes';
import { specialHeads } from '../git/commands/specialHeads';
import { worktreeHeads } from '../git/commands/worktreeHeads';
import { catFile } from '../git/commands/catFile';

export class SearchController {
  private abortController: AbortController | null = null;

  constructor(
    private readonly gitRunner: GitRunner,
    private readonly store: ResultStore,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  async search(
    query: string,
    mode: SearchMode,
    depth: ScanDepth,
    cwd: string,
    onProgress: (progress: SearchProgress) => void,
  ): Promise<void> {
    this.cancel();
    this.store.clear();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const sources = SCAN_DEPTH_SOURCES[depth];
    const treeCache = new Map<string, string[]>();

    // Determine if we need to run fsck (for any dangling source types)
    const needsFsck =
      sources.includes('danglingCommit') ||
      sources.includes('danglingTree') ||
      sources.includes('danglingBlob');

    // Collect all fsck results once if needed, keyed by kind
    let danglingCommits: string[] = [];
    let danglingTrees: string[] = [];
    let danglingBlobs: string[] = [];

    if (needsFsck) {
      // Find the first dangling source to use as the progress phase for fsck collection
      const fsckSource: ScanSource =
        sources.find(s => s === 'danglingCommit' || s === 'danglingTree' || s === 'danglingBlob') ||
        'danglingCommit';

      onProgress({ phase: fsckSource, status: 'running', count: this.store.size });
      try {
        for await (const obj of fsck(this.gitRunner, cwd, signal)) {
          if (signal.aborted) return;
          if (obj.kind === 'commit') {
            danglingCommits.push(obj.sha);
          } else if (obj.kind === 'tree') {
            danglingTrees.push(obj.sha);
          } else if (obj.kind === 'blob') {
            danglingBlobs.push(obj.sha);
          }
        }
      } catch (err) {
        onProgress({ phase: fsckSource, status: 'error', count: this.store.size, error: String(err) });
      }
    }

    for (const source of sources) {
      if (signal.aborted) return;

      // Skip individual dangling sources — handled via pre-collected arrays below
      if (source === 'danglingCommit' || source === 'danglingTree' || source === 'danglingBlob') {
        // Process from pre-collected arrays
        onProgress({ phase: source, status: 'running', count: this.store.size });
        try {
          if (source === 'danglingCommit') {
            for (const sha of danglingCommits) {
              if (signal.aborted) return;
              await this.filterAndStore(sha, 'danglingCommit', query, mode, cwd, signal, treeCache);
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
          } else if (source === 'danglingTree') {
            for (const sha of danglingTrees) {
              if (signal.aborted) return;
              if (mode === 'filename') {
                const lsOutput = await this.gitRunner.run(
                  ['ls-tree', '-r', '--name-only', sha],
                  cwd,
                  signal,
                );
                const matchedPaths = lsOutput.split('\n').filter(p => p.trim().includes(query));
                if (matchedPaths.length > 0) {
                  this.store.upsertTree(sha, 'danglingTree', matchedPaths);
                }
              }
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
          } else if (source === 'danglingBlob') {
            for (const sha of danglingBlobs) {
              if (signal.aborted) return;
              this.store.upsertBlob(sha, 'danglingBlob');
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
          }
          onProgress({ phase: source, status: 'done', count: this.store.size });
        } catch (err) {
          onProgress({ phase: source, status: 'error', count: this.store.size, error: String(err) });
        }
        continue;
      }

      onProgress({ phase: source, status: 'running', count: this.store.size });
      try {
        switch (source) {
          case 'reachable':
            for await (const sha of revList(this.gitRunner, cwd, signal)) {
              if (signal.aborted) return;
              await this.filterAndStore(sha, 'reachable', query, mode, cwd, signal, treeCache);
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
            break;

          case 'reflog':
            for await (const sha of reflog(this.gitRunner, cwd, signal)) {
              if (signal.aborted) return;
              await this.filterAndStore(sha, 'reflog', query, mode, cwd, signal, treeCache);
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
            break;

          case 'stash':
            for await (const entry of stash(this.gitRunner, cwd, signal)) {
              if (signal.aborted) return;
              await this.filterAndStore(entry.sha, 'stash', query, mode, cwd, signal, treeCache);
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
            break;

          case 'fetchHead':
            for await (const sha of fetchHead(this.gitRunner, cwd, signal)) {
              if (signal.aborted) return;
              await this.filterAndStore(sha, 'fetchHead', query, mode, cwd, signal, treeCache);
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
            break;

          case 'notes':
            for await (const sha of notes(this.gitRunner, cwd, signal)) {
              if (signal.aborted) return;
              await this.filterAndStore(sha, 'notes', query, mode, cwd, signal, treeCache);
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
            break;

          case 'specialHeads':
            for await (const head of specialHeads(this.gitRunner, cwd, signal)) {
              if (signal.aborted) return;
              await this.filterAndStore(head.sha, 'specialHeads', query, mode, cwd, signal, treeCache);
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
            break;

          case 'worktreeHeads':
            for await (const head of worktreeHeads(this.gitRunner, cwd, signal)) {
              if (signal.aborted) return;
              await this.filterAndStore(head.sha, 'worktreeHeads', query, mode, cwd, signal, treeCache);
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
            break;

          case 'objectStore': {
            const proceed = await this.checkObjectCount(cwd);
            if (!proceed) {
              onProgress({ phase: source, status: 'done', count: this.store.size });
              continue;
            }
            for await (const obj of catFile(this.gitRunner, cwd, signal)) {
              if (signal.aborted) return;
              if (obj.type === 'commit') {
                await this.filterAndStore(obj.sha, 'objectStore', query, mode, cwd, signal, treeCache);
              }
              onProgress({ phase: source, status: 'running', count: this.store.size });
            }
            break;
          }
        }
        onProgress({ phase: source, status: 'done', count: this.store.size });
      } catch (err) {
        this.outputChannel.appendLine(`[SearchController] error in source ${source}: ${String(err)}`);
        onProgress({ phase: source, status: 'error', count: this.store.size, error: String(err) });
      }
    }
  }

  private async filterAndStore(
    sha: string,
    source: ScanSource,
    query: string,
    mode: SearchMode,
    cwd: string,
    signal: AbortSignal,
    treeCache: Map<string, string[]>,
  ): Promise<void> {
    if (signal.aborted) return;

    if (mode === 'content') {
      const output = await this.gitRunner.run(
        ['log', '-1', `-S${query}`, '--format=%H', sha],
        cwd,
        signal,
      );
      if (output.trim()) {
        this.store.upsertCommit(sha, source);
      }
    } else if (mode === 'commitMessage') {
      const output = await this.gitRunner.run(
        ['log', '-1', `--grep=${query}`, '--format=%H', sha],
        cwd,
        signal,
      );
      if (output.trim()) {
        this.store.upsertCommit(sha, source);
      }
    } else if (mode === 'filename') {
      const treeSha = (
        await this.gitRunner.run(['rev-parse', `${sha}^{tree}`], cwd, signal)
      ).trim();
      if (!treeSha) return;

      let matchedPaths: string[];
      if (treeCache.has(treeSha)) {
        matchedPaths = treeCache.get(treeSha)!;
      } else {
        const lsOutput = await this.gitRunner.run(
          ['ls-tree', '-r', '--name-only', treeSha],
          cwd,
          signal,
        );
        matchedPaths = lsOutput.split('\n').filter(p => p.trim().includes(query));
        treeCache.set(treeSha, matchedPaths);
      }

      if (matchedPaths.length > 0) {
        this.store.upsertCommit(sha, source, matchedPaths);
      }
    }
  }

  private async checkObjectCount(cwd: string): Promise<boolean> {
    const output = await this.gitRunner.run(['count-objects', '-v'], cwd);
    let total = 0;
    for (const line of output.split('\n')) {
      const match = line.match(/^(?:count|in-pack):\s*(\d+)/);
      if (match) total += parseInt(match[1], 10);
    }

    if (total > 100_000) {
      const choice = await vscode.window.showWarningMessage(
        `GitEverywhere: This repo has ~${total.toLocaleString()} objects. Full scan may be slow. Continue?`,
        { modal: true },
        'Continue',
      );
      return choice === 'Continue';
    }
    return true;
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
