import { ScanDepth, ScanSource } from '../../types';

export const SOURCE_LABELS: Record<ScanSource, string> = {
  reachable: 'Reachable Commits',
  reflog: 'Reflog',
  stash: 'Stash',
  danglingCommit: 'Dangling Commits',
  danglingTree: 'Dangling Trees',
  danglingBlob: 'Dangling Blobs',
  fetchHead: 'FETCH_HEAD',
  notes: 'Git Notes',
  specialHeads: 'Special Heads (MERGE, CHERRY-PICK...)',
  worktreeHeads: 'Worktree Detached HEADs',
  objectStore: 'Full Object Store',
};

export const SCAN_DEPTH_SOURCES: Record<ScanDepth, ScanSource[]> = {
  fast: ['reachable', 'reflog', 'stash'],
  deep: [
    'reachable', 'reflog', 'stash',
    'danglingCommit', 'danglingTree', 'danglingBlob',
    'fetchHead', 'notes', 'specialHeads', 'worktreeHeads',
  ],
  full: [
    'reachable', 'reflog', 'stash',
    'danglingCommit', 'danglingTree', 'danglingBlob',
    'fetchHead', 'notes', 'specialHeads', 'worktreeHeads',
    'objectStore',
  ],
};
