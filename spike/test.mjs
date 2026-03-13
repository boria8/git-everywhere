// Spike: simulate real VSCode extension pattern
// Extensions use async functions (activate, etc.) — no top-level await.
import { execa } from 'execa';

// Simulates how GitRunner.run() will work inside the extension
async function runGitCommand(args) {
    const result = await execa('git', args, { reject: false });
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    return result.stdout;
}

// Simulates streaming — how GitRunner.stream() will work
async function streamGitCommand(args, onLine) {
    const subprocess = execa('git', args);
    for await (const line of subprocess) {
        onLine(line);
    }
}

// Simulate activate() — the VSCode extension entry point
async function activate() {
    const version = await runGitCommand(['--version']);
    console.log('git version:', version);

    console.log('streaming git log:');
    let count = 0;
    await streamGitCommand(['log', '--oneline', '-3'], (line) => {
        console.log(' -', line);
        count++;
    });
    console.log(`streamed ${count} lines`);

    console.log('SPIKE PASSED: execa v9 works in async function pattern');
}

activate().catch(console.error);
