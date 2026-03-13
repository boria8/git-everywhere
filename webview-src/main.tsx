import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CommitResult } from '../src/types';

// VSCode API — call once, store reference
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};
const vscodeApi = acquireVsCodeApi();

function App() {
  const [commit, setCommit] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'init') setCommit(msg.commit);
      if (msg.type === 'error') setError(msg.message);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (error) return <div style={styles.error}>{error}</div>;
  if (!commit) return <div style={styles.loading}>Loading commit details…</div>;

  return (
    <div style={styles.container}>
      <CommitHeader commit={commit} />
      <ReachabilityBadge reachable={commit.reachableFromHead} />
      <FoundViaBadge sources={commit.sources} />
      {commit.matchedPaths.length > 0 && <MatchedPaths paths={commit.matchedPaths} sha={commit.sha} />}
      {commit.changedFiles && <FilesChanged raw={commit.changedFiles} />}
      {(commit.branchesContaining?.length ?? 0) > 0 && (
        <BranchList branches={commit.branchesContaining!} refs={commit.refsPointing ?? []} />
      )}
      <ActionBar commit={commit} hasMatchedPaths={commit.matchedPaths.length > 0} />
    </div>
  );
}

function CommitHeader({ commit }: { commit: CommitResult }) {
  return (
    <div style={styles.section}>
      <div style={styles.sha}>
        <span style={styles.shaText}>{commit.sha}</span>
        <button style={styles.copyBtn} onClick={() => vscodeApi.postMessage({ type: 'action', action: 'copySha' })}>
          Copy
        </button>
      </div>
      <div style={styles.subject}>{commit.subject || '(no subject)'}</div>
      <div style={styles.meta}>{commit.authorName} &lt;{commit.authorEmail}&gt;</div>
      <div style={styles.meta}>Author: {commit.authorDate}</div>
      <div style={styles.meta}>Commit: {commit.commitDate}</div>
      {commit.parents.length > 0 && (
        <div style={styles.meta}>Parents: {commit.parents.join(', ')}</div>
      )}
    </div>
  );
}

function ReachabilityBadge({ reachable }: { reachable: boolean }) {
  return (
    <div style={{ ...styles.badge, background: reachable ? 'var(--vscode-terminal-ansiGreen, #1a4a1a)' : 'var(--vscode-inputValidation-warningBackground, #4a2a00)' }}>
      {reachable
        ? '✓ Reachable from HEAD'
        : '⚠ NOT reachable from HEAD — this commit may be lost. Create a branch to save it.'}
    </div>
  );
}

function FoundViaBadge({ sources }: { sources: string[] }) {
  return (
    <div style={styles.section}>
      <div style={styles.label}>Found via</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {sources.map(s => (
          <span key={s} style={styles.chip}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function MatchedPaths({ paths, sha }: { paths: string[]; sha: string }) {
  return (
    <div style={styles.section}>
      <div style={styles.label}>Matched paths</div>
      {paths.map(p => (
        <div key={p} style={styles.pathRow}>
          <span style={styles.pathText}>{p}</span>
          <button
            style={styles.smallBtn}
            onClick={() => vscodeApi.postMessage({ type: 'action', action: 'restoreFile', filePath: p })}
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}

function FilesChanged({ raw }: { raw: string }) {
  const lines = raw.split('\n').filter(Boolean);
  return (
    <div style={styles.section}>
      <div style={styles.label}>Files changed</div>
      {lines.map((line, i) => {
        const status = line[0];
        const file = line.slice(1).trim();
        const color = status === 'A' ? 'var(--vscode-symbolIcon-namespaceForeground, #4ec94e)' : status === 'D' ? 'var(--vscode-errorForeground, #e05c5c)' : 'var(--vscode-symbolIcon-numberForeground, #e0c04e)';
        return (
          <div key={i} style={{ ...styles.fileRow, color }}>
            <span style={styles.fileStatus}>{status}</span>
            <span>{file}</span>
          </div>
        );
      })}
    </div>
  );
}

function BranchList({ branches, refs }: { branches: string[]; refs: string[] }) {
  return (
    <div style={styles.section}>
      {branches.length > 0 && (
        <>
          <div style={styles.label}>Branches containing this commit</div>
          {branches.map(b => <div key={b} style={styles.listItem}>• {b}</div>)}
        </>
      )}
      {refs.length > 0 && (
        <>
          <div style={{ ...styles.label, marginTop: 8 }}>Refs pointing here</div>
          {refs.map(r => <div key={r} style={styles.listItem}>• {r}</div>)}
        </>
      )}
    </div>
  );
}

function ActionBar({ commit, hasMatchedPaths }: { commit: CommitResult; hasMatchedPaths: boolean }) {
  const btn = (label: string, action: string) => (
    <button key={action} style={styles.actionBtn}
      onClick={() => vscodeApi.postMessage({ type: 'action', action })}>
      {label}
    </button>
  );
  return (
    <div style={styles.actionBar}>
      {btn('Checkout new branch', 'checkout')}
      {btn('Cherry-pick', 'cherryPick')}
      {btn('Show in terminal', 'showInTerminal')}
      {btn('Copy SHA', 'copySha')}
    </div>
  );
}

// Minimal inline styles using VSCode CSS variables where possible
const styles: Record<string, React.CSSProperties> = {
  container: { padding: 16, fontFamily: 'var(--vscode-font-family)', fontSize: 'var(--vscode-font-size)', color: 'var(--vscode-foreground)', maxWidth: 800 },
  section: { marginBottom: 16, borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: 12 },
  sha: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  shaText: { fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12, opacity: 0.7, wordBreak: 'break-all' },
  subject: { fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--vscode-foreground)' },
  meta: { fontSize: 12, opacity: 0.7, marginBottom: 2 },
  badge: { padding: '6px 10px', borderRadius: 4, marginBottom: 16, fontSize: 12 },
  label: { fontSize: 11, textTransform: 'uppercase', opacity: 0.5, marginBottom: 6, letterSpacing: 1 },
  chip: { background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)', padding: '2px 8px', borderRadius: 10, fontSize: 11 },
  pathRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' },
  pathText: { fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12 },
  fileRow: { display: 'flex', gap: 8, padding: '2px 0', fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12 },
  fileStatus: { width: 16, fontWeight: 700 },
  listItem: { fontSize: 12, padding: '1px 0', fontFamily: 'var(--vscode-editor-font-family)' },
  actionBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 },
  actionBtn: { background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', padding: '6px 12px', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  copyBtn: { background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
  smallBtn: { background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', padding: '2px 6px', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
  loading: { padding: 16, opacity: 0.6 },
  error: { padding: 16, color: 'var(--vscode-errorForeground)' },
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
