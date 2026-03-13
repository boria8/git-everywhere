import { EventEmitter } from 'node:events';
import { CommitResult, BlobResult, TreeResult, ScanSource } from '../types';

export class ResultStore extends EventEmitter {
  private commits = new Map<string, CommitResult>();
  private blobs = new Map<string, BlobResult>();
  private trees = new Map<string, TreeResult>();

  upsertCommit(sha: string, source: ScanSource, matchedPaths?: string[]): 'added' | 'merged' {
    const existing = this.commits.get(sha);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      if (matchedPaths) {
        for (const p of matchedPaths) {
          if (!existing.matchedPaths.includes(p)) {
            existing.matchedPaths.push(p);
          }
        }
      }
      this.emit('change');
      return 'merged';
    }

    const result: CommitResult = {
      sha,
      shortSha: sha.slice(0, 7),
      subject: '',
      authorName: '',
      authorEmail: '',
      authorDate: '',
      commitDate: '',
      parents: [],
      reachableFromHead: false,
      sources: [source],
      matchedPaths: matchedPaths ? [...matchedPaths] : [],
    };
    this.commits.set(sha, result);
    this.emit('change');
    return 'added';
  }

  upsertBlob(sha: string, source: ScanSource, matchedPaths?: string[]): 'added' | 'merged' {
    const existing = this.blobs.get(sha);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      if (matchedPaths) {
        for (const p of matchedPaths) {
          if (!existing.matchedPaths.includes(p)) {
            existing.matchedPaths.push(p);
          }
        }
      }
      this.emit('change');
      return 'merged';
    }

    const result: BlobResult = {
      sha,
      sources: [source],
      matchedPaths: matchedPaths ? [...matchedPaths] : [],
    };
    this.blobs.set(sha, result);
    this.emit('change');
    return 'added';
  }

  upsertTree(sha: string, source: ScanSource, matchedPaths?: string[]): 'added' | 'merged' {
    const existing = this.trees.get(sha);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      if (matchedPaths) {
        for (const p of matchedPaths) {
          if (!existing.matchedPaths.includes(p)) {
            existing.matchedPaths.push(p);
          }
        }
      }
      this.emit('change');
      return 'merged';
    }

    const result: TreeResult = {
      sha,
      sources: [source],
      matchedPaths: matchedPaths ? [...matchedPaths] : [],
    };
    this.trees.set(sha, result);
    this.emit('change');
    return 'added';
  }

  getCommits(): CommitResult[] {
    return Array.from(this.commits.values());
  }

  getBlobs(): BlobResult[] {
    return Array.from(this.blobs.values());
  }

  getTrees(): TreeResult[] {
    return Array.from(this.trees.values());
  }

  clear(): void {
    this.commits.clear();
    this.blobs.clear();
    this.trees.clear();
    this.emit('change');
  }

  get size(): number {
    return this.commits.size + this.blobs.size + this.trees.size;
  }
}
