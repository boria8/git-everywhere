export type SearchMode = 'content' | 'commitMessage' | 'filename';

export type ScanDepth = 'fast' | 'deep' | 'full';

export type ScanSource =
  | 'reachable'
  | 'reflog'
  | 'stash'
  | 'danglingCommit'
  | 'danglingTree'
  | 'danglingBlob'
  | 'fetchHead'
  | 'notes'
  | 'specialHeads'
  | 'worktreeHeads'
  | 'objectStore';

export interface CommitResult {
  sha: string;
  shortSha: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  commitDate: string;
  parents: string[];
  reachableFromHead: boolean;
  sources: ScanSource[];
  matchedPaths: string[];
  headBranch?: string;
  // Fetched lazily when detail panel opens:
  changedFiles?: string;
  refsPointing?: string[];
  branchesContaining?: string[];
}

export interface BlobResult {
  sha: string;
  sources: ScanSource[];
  matchedPaths: string[];
}

export interface TreeResult {
  sha: string;
  sources: ScanSource[];
  matchedPaths: string[];
}

export interface SearchProgress {
  phase: ScanSource;
  status: 'running' | 'done' | 'error';
  count: number;
  error?: string;
}

export interface FilterLayer {
  id: string;
  mode: SearchMode;
  query: string;
  operator: 'AND' | 'OR';
}
