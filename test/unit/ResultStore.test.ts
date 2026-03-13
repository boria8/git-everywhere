import { describe, it, expect, vi } from 'vitest';
import { ResultStore } from '../../src/search/ResultStore';

describe('ResultStore', () => {
  it('upsertCommit with new SHA returns added and size is 1', () => {
    const store = new ResultStore();
    const result = store.upsertCommit('a'.repeat(40), 'reachable');
    expect(result).toBe('added');
    expect(store.size).toBe(1);
  });

  it('upsertCommit with same SHA different source returns merged and size stays 1', () => {
    const store = new ResultStore();
    const sha = 'b'.repeat(40);
    store.upsertCommit(sha, 'reachable');
    const result = store.upsertCommit(sha, 'reflog');
    expect(result).toBe('merged');
    expect(store.size).toBe(1);

    const commits = store.getCommits();
    expect(commits).toHaveLength(1);
    expect(commits[0].sources).toContain('reachable');
    expect(commits[0].sources).toContain('reflog');
  });

  it('upsertCommit merges matchedPaths without duplicates', () => {
    const store = new ResultStore();
    const sha = 'c'.repeat(40);
    store.upsertCommit(sha, 'reachable', ['src/foo.ts', 'src/bar.ts']);
    store.upsertCommit(sha, 'reflog', ['src/bar.ts', 'src/baz.ts']);

    const commits = store.getCommits();
    expect(commits[0].matchedPaths).toHaveLength(3);
    expect(commits[0].matchedPaths).toContain('src/foo.ts');
    expect(commits[0].matchedPaths).toContain('src/bar.ts');
    expect(commits[0].matchedPaths).toContain('src/baz.ts');
  });

  it('clear() resets size to 0', () => {
    const store = new ResultStore();
    store.upsertCommit('a'.repeat(40), 'reachable');
    store.upsertBlob('b'.repeat(40), 'danglingBlob');
    store.upsertTree('c'.repeat(40), 'danglingTree');
    expect(store.size).toBe(3);

    store.clear();
    expect(store.size).toBe(0);
    expect(store.getCommits()).toHaveLength(0);
    expect(store.getBlobs()).toHaveLength(0);
    expect(store.getTrees()).toHaveLength(0);
  });

  it('on("change") fires after upsert', () => {
    const store = new ResultStore();
    const listener = vi.fn();
    store.on('change', listener);
    store.upsertCommit('a'.repeat(40), 'reachable');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('on("change") fires after clear', () => {
    const store = new ResultStore();
    const listener = vi.fn();
    store.upsertCommit('a'.repeat(40), 'reachable');
    store.on('change', listener);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('same SHA in blob and commit maps are separate (size 2)', () => {
    const store = new ResultStore();
    const sha = 'd'.repeat(40);
    store.upsertCommit(sha, 'reachable');
    store.upsertBlob(sha, 'danglingBlob');
    expect(store.size).toBe(2);
    expect(store.getCommits()).toHaveLength(1);
    expect(store.getBlobs()).toHaveLength(1);
  });

  it('upsertBlob with new SHA returns added', () => {
    const store = new ResultStore();
    const result = store.upsertBlob('e'.repeat(40), 'danglingBlob');
    expect(result).toBe('added');
  });

  it('upsertBlob with same SHA returns merged', () => {
    const store = new ResultStore();
    const sha = 'f'.repeat(40);
    store.upsertBlob(sha, 'danglingBlob');
    const result = store.upsertBlob(sha, 'objectStore');
    expect(result).toBe('merged');
    expect(store.size).toBe(1);
  });

  it('upsertTree with new SHA returns added', () => {
    const store = new ResultStore();
    const result = store.upsertTree('0'.repeat(40), 'danglingTree');
    expect(result).toBe('added');
  });

  it('sources array has no duplicates after repeated same source upsert', () => {
    const store = new ResultStore();
    const sha = '1'.repeat(40);
    store.upsertCommit(sha, 'reachable');
    store.upsertCommit(sha, 'reachable');
    const commits = store.getCommits();
    expect(commits[0].sources).toHaveLength(1);
    expect(commits[0].sources).toContain('reachable');
  });

  it('off("change") stops listener from firing', () => {
    const store = new ResultStore();
    const listener = vi.fn();
    store.on('change', listener);
    store.off('change', listener);
    store.upsertCommit('2'.repeat(40), 'reachable');
    expect(listener).not.toHaveBeenCalled();
  });
});
