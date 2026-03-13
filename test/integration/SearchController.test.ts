import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { GitRunner } from '../../src/git/GitRunner';
import { ResultStore } from '../../src/search/ResultStore';
import { SearchController } from '../../src/search/SearchController';

const mockChannel = { appendLine: () => {} } as any;

let tmpDir: string;
let gitRunner: GitRunner;
let store: ResultStore;
let controller: SearchController;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'searchcontroller-test-'));

  // Configure git identity for the temp repo
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@test.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@test.com',
  };

  const run = (cmd: string) =>
    execSync(cmd, { cwd: tmpDir, env: gitEnv, stdio: 'pipe' });

  // Init repo
  run('git init');
  run('git config user.email "test@test.com"');
  run('git config user.name "Test"');

  // Create a file with a known unique string and commit it
  await fs.writeFile(path.join(tmpDir, 'findme_test.txt'), 'FINDME_UNIQUE_STRING_XYZ\n');
  run('git add findme_test.txt');
  run('git commit -m "test: add findme file"');

  // Create a commit with a known message
  await fs.writeFile(path.join(tmpDir, 'other.txt'), 'some content\n');
  run('git add other.txt');
  run('git commit -m "FINDME_IN_MESSAGE: something happened"');

  // Create something for stash
  await fs.writeFile(path.join(tmpDir, 'stash_file.txt'), 'stashed content\n');
  run('git add stash_file.txt');
  run('git stash');

  gitRunner = new GitRunner(mockChannel);
  store = new ResultStore();
  controller = new SearchController(gitRunner, store, mockChannel);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('SearchController integration', () => {
  it('content mode finds commit with FINDME_UNIQUE_STRING_XYZ', async () => {
    store.clear();
    await controller.search('FINDME_UNIQUE_STRING_XYZ', 'content', 'fast', tmpDir, () => {});
    expect(store.size).toBeGreaterThanOrEqual(1);
    expect(store.getCommits().length).toBeGreaterThanOrEqual(1);
  });

  it('commitMessage mode finds commit with FINDME_IN_MESSAGE in message', async () => {
    store.clear();
    await controller.search('FINDME_IN_MESSAGE', 'commitMessage', 'fast', tmpDir, () => {});
    expect(store.size).toBeGreaterThanOrEqual(1);
    expect(store.getCommits().length).toBeGreaterThanOrEqual(1);
  });

  it('filename mode finds commit containing file named findme_test.txt', async () => {
    store.clear();
    await controller.search('findme', 'filename', 'fast', tmpDir, () => {});
    expect(store.size).toBeGreaterThanOrEqual(1);
    expect(store.getCommits().length).toBeGreaterThanOrEqual(1);
  });

  it('cancel() stops the search without throwing', async () => {
    const freshStore = new ResultStore();
    const freshController = new SearchController(gitRunner, freshStore, mockChannel);

    let thrown = false;
    const searchPromise = freshController
      .search('FINDME_UNIQUE_STRING_XYZ', 'content', 'fast', tmpDir, () => {})
      .catch(() => {
        thrown = true;
      });

    freshController.cancel();
    await searchPromise;
    expect(thrown).toBe(false);
  });

  it('progress callback is called during search', async () => {
    store.clear();
    const progressEvents: string[] = [];
    await controller.search('FINDME_UNIQUE_STRING_XYZ', 'content', 'fast', tmpDir, (p) => {
      progressEvents.push(`${p.phase}:${p.status}`);
    });
    expect(progressEvents.length).toBeGreaterThan(0);
  });
});
