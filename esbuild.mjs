import esbuild from 'esbuild';
import { readFileSync } from 'fs';

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

// Extension host build (CJS for VSCode)
const extensionBuild = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
};

// Webview build (ESM for browser)
const webviewBuild = {
  entryPoints: ['webview-src/main.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: 'dist/webview/assets/main.js',
  sourcemap: !production,
  minify: production,
};

if (watch) {
  const extCtx = await esbuild.context(extensionBuild);
  const webCtx = await esbuild.context(webviewBuild);
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('Watching...');
} else {
  await Promise.all([
    esbuild.build(extensionBuild),
    esbuild.build(webviewBuild),
  ]);
  console.log('Build complete.');
}
